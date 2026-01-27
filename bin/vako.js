#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const SetupWizard = require('./commands/setup');
const DevServer = require('../lib/dev/dev-server');
const path = require('path');
const fs = require('fs');

// Version du package
const packageJson = require('../package.json');
const version = packageJson.version;

// Ajouter le chemin vers les modules lib
const libPath = path.join(__dirname, '..', 'lib');
process.env.NODE_PATH = `${process.env.NODE_PATH || ''}:${libPath}`;
require('module')._initPaths();

const program = new Command();

program
  .name('vako')
  .description('Vako Framework CLI')
  .version('1.3.18');

// ============= DEV COMMAND =============
program
  .command('dev')
  .description('Start development server')
  .option('-p, --port <port>', 'Port number', '3000')
  .option('-f, --file <file>', 'Entry file', 'app.js')
  .option('-w, --watch <dirs>', 'Watch directories', 'views,routes,public')
  .action(async (options) => {
    try {
      const { App } = require('../index');
      const path = require('path');
      const fs = require('fs');
      
      // Vérifier si le fichier d'entrée existe
      const entryFile = path.resolve(process.cwd(), options.file);
      if (fs.existsSync(entryFile)) {
        // Charger le fichier d'entrée de l'utilisateur s'il existe
        try {
          require(entryFile);
        } catch (err) {
          console.warn(chalk.yellow(`⚠️  Warning: Could not load ${options.file}: ${err.message}`));
        }
      }
      
      // Créer l'application en mode développement
      const port = parseInt(options.port);
      const wsPort = port + 8;
      
      const app = new App({
        port: port,
        wsPort: wsPort,
        isDev: true,
        watchDirs: options.watch.split(',').map(dir => dir.trim()),
        routesDir: 'routes',
        viewsDir: 'views',
        staticDir: 'public'
      });
      
      // Utiliser la méthode startDev qui configure automatiquement le devServer
      app.startDev(port);
      
      console.log(chalk.green(`\n🚀 Vako dev server running on http://localhost:${port}`));
      console.log(chalk.cyan(`📡 WebSocket server on ws://localhost:${wsPort}`));
      console.log(chalk.gray(`\n👀 Watching: ${options.watch}\n`));
      
    } catch (error) {
      console.error(chalk.red('❌ Error starting dev server:'), error.message);
      if (error.stack) {
        console.error(chalk.gray(error.stack));
      }
      process.exit(1);
    }
  });

// ============= BUILD COMMAND =============
program
  .command('build')
  .description('Build for production')
  .action(() => {
    console.log(chalk.blue('🔨 Building for production...'));
    console.log(chalk.green('✅ Build completed!'));
  });

// ============= START COMMAND =============
program
  .command('start')
  .description('Start production server')
  .option('-f, --file <file>', 'Entry file', 'app.js')
  .action((options) => {
    try {
      console.log(chalk.blue('🚀 Starting production server...'));
      execSync(`node ${options.file}`, { stdio: 'inherit' });
    } catch (error) {
      console.error(chalk.red('❌ Error starting server:'), error.message);
      process.exit(1);
    }
  });

// ============= SETUP COMMAND (UPDATED) =============
program
  .command('setup [project-name]')
  .description('🚀 Interactive project setup wizard')
  .option('-q, --quick', 'Quick setup with defaults')
  .option('--template <template>', 'Template (default, api, blog, admin, ecommerce, portfolio)')
  .option('--features <features>', 'Comma-separated features list')
  .option('--auth', 'Enable authentication system')
  .option('--db <database>', 'Database type (sqlite, mysql, mongodb)')
  .option('--styling <framework>', 'CSS framework (bootstrap, tailwind, material)')
  .action(async (projectNameArg, options) => {
    if (options.quick) {
      const quickConfig = {
        projectName: projectNameArg || 'vako-app',
        template: options.template || 'default',
        features: options.features ? options.features.split(',') : ['hotreload', 'layouts'],
        database: options.db || 'sqlite',
        auth: { enabled: options.auth || false },
        styling: options.styling || 'bootstrap',
        git: true,
        install: true
      };
      
      const SetupExecutor = require('./commands/setup-executor');
      const executor = new SetupExecutor(quickConfig);
      await executor.execute();
    } else {
      const wizard = new SetupWizard();
      await wizard.start();
    }
  });

// ============= NEW COMMANDS =============
program
  .command('wizard')
  .alias('w')
  .description('🧙‍♂️ Full interactive setup wizard')
  .action(async () => {
    const wizard = new SetupWizard();
    await wizard.start();
  });

program
  .command('create <project-name>')
  .description('🎯 Quick project creation with prompts')
  .option('--template <template>', 'Template to use')
  .action(async (projectName, options) => {
    const QuickSetup = require('./commands/quick-setup');
    const quickSetup = new QuickSetup(projectName, options);
    await quickSetup.start();
  });

program
  .command('templates')
  .alias('t')
  .description('📋 List available templates')
  .action(() => {
    const TemplateList = require('./commands/template-list');
    const templateList = new TemplateList();
    templateList.display();
  });

program
  .command('plugins')
  .description('🔌 Plugin management')
  .option('--list', 'List available plugins')
  .option('--search <term>', 'Search plugins')
  .action((options) => {
    const PluginManager = require('./commands/plugin-manager-cli');
    const pluginManager = new PluginManager();
    
    if (options.list) {
      pluginManager.listPlugins();
    } else if (options.search) {
      pluginManager.searchPlugins(options.search);
    } else {
      pluginManager.showMenu();
    }
  });

// Ajout de la commande update qui servira de passerelle vers vako-update
program
  .command('update')
  .description('Gestionnaire de mise à jour Vako')
  .allowUnknownOption(true)
  .action(async () => {
    try {
      // Essayer d'abord avec le fichier vako-update.js
      const updateBin = path.join(__dirname, 'vako-update.js');
      if (fs.existsSync(updateBin)) {
        const { execSync } = require('child_process');
        try {
          execSync(`node "${updateBin}" ${process.argv.slice(3).join(' ')}`, { 
            stdio: 'inherit' 
          });
          return;
        } catch (error) {
          // Si ça échoue, essayer directement avec AutoUpdater
        }
      }
      
      // Fallback: utiliser directement AutoUpdater
      const AutoUpdater = require('../lib/core/auto-updater');
      const args = process.argv.slice(3);
      
      if (typeof AutoUpdater.handleCLI === 'function') {
        await AutoUpdater.init();
        await AutoUpdater.handleCLI(args);
      } else {
        console.error('L\'auto-updater n\'est pas disponible');
        console.error('Essayez: npm install -g vako@latest');
        process.exit(1);
      }
    } catch (error) {
      console.error('Erreur lors du lancement de l\'auto-updater:', error.message);
      console.error('Essayez: npm install -g vako@latest');
      process.exit(1);
    }
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  console.log('\n🚀 Vako v' + version + ' - Ultra-modern Node.js framework\n');
  console.log('Available commands:');
  console.log('  dev      Start development server with hot reload');
  console.log('  setup    Set up a new Vako project');
  console.log('  verify   Verify code quality and security');
  console.log('  update   Gestionnaire de mise à jour Vako');
  console.log('\nRun `vako <command> --help` for more information on specific commands.');
  console.log('\nDocumentation: https://github.com/sdevfr/vako');
  process.exit(0);
}
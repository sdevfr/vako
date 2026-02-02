#!/usr/bin/env node

const chalk = require('chalk');
const { Command } = require('commander');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

// Import Setup Classes
let SetupWizard, QuickSetup;
try {
    SetupWizard = require('./commands/setup');
    QuickSetup = require('./commands/quick-setup');
} catch (e) {
    console.log(chalk.yellow('[!] Warning: Setup modules not found. Ensure bin/commands/ exists.'));
}

const program = new Command();

// Dynamic version from package.json
const pkgPath = path.join(__dirname, '..', 'package.json');
const version = fs.existsSync(pkgPath) ? require(pkgPath).version : '1.0.0';

program
  .name('create-vako-app')
  .description('⚡ Create a new Vako application with modern templates')
  .version(version)
  .argument('[project-name]', 'Name of the project')
  .option('--template <template>', 'Template to use (default, api, blog, admin)')
  .option('--quick', 'Quick setup with minimal questions')
  .option('--wizard', 'Full interactive setup')
  .option('--git', 'Initialize git repository after creation')
  .option('--install', 'Run npm install after creation')
  .action(async (projectName, options) => {
    console.log(chalk.blue.bold('\n🚀 Create Vako App\n'));

    // 1. Validate Project Name
    if (!projectName) {
      console.log(chalk.red('[X] Project name is required'));
      program.help();
      process.exit(1);
    }

    // Regex for valid folder names (no special chars, no leading dot)
    if (!/^[a-zA-Z0-9-_]+$/.test(projectName)) {
      console.log(chalk.red('[X] Invalid project name. Use alphanumeric characters, hyphens, or underscores only.'));
      process.exit(1);
    }

    const targetPath = path.join(process.cwd(), projectName);

    // 2. Check if Directory Exists (Fail Fast)
    if (fs.existsSync(targetPath)) {
      console.log(chalk.red(`[X] Directory "${projectName}" already exists.`));
      process.exit(1);
    }

    try {
      // 3. Route to appropriate setup logic
      if (options.wizard) {
        console.log(chalk.gray('🧙‍♂️ Starting Wizard Mode...\n'));
        const wizard = new SetupWizard();
        wizard.config.projectName = projectName;
        wizard.config.options = options; // Pass flags down
        await wizard.start();
      } else if (options.quick || options.template) {
        console.log(chalk.gray('⚡ Starting Quick Setup...\n'));
        const quickSetup = new QuickSetup(projectName, options);
        await quickSetup.start();
      } else {
        // Default: Interactive Choice
        const inquirer = require('inquirer');
        const { setupType } = await inquirer.prompt([{
          type: 'list',
          name: 'setupType',
          message: '[🞖] How would you like to set up your project?',
          choices: [
            { name: '[☈]  Quick - Essential options only', value: 'quick' },
            { name: '🧙‍♂️ Wizard - Full interactive setup', value: 'wizard' }
          ]
        }]);

        if (setupType === 'wizard') {
          const wizard = new SetupWizard();
          wizard.config.projectName = projectName;
          wizard.config.options = options;
          await wizard.start();
        } else {
          const quickSetup = new QuickSetup(projectName, options);
          await quickSetup.start();
        }
      }

      // 4. Post-Creation Hooks (Carte Blanche Improvement)
      const spinner = require('ora'); // Use ora for visual feedback
      
      // Initialize Git
      if (options.git) {
        try {
          console.log(chalk.gray(`\nInitializing git repository...`));
          execSync('git init', { cwd: targetPath, stdio: 'ignore' });
          console.log(chalk.green(`[✓] Git initialized`));
        } catch (err) {
          console.log(chalk.yellow(`[!]  Git not installed or failed to init.`));
        }
      }

      // Install Dependencies
      if (options.install) {
        const installSpinner = spinner('Installing dependencies...').start();
        try {
          execSync('npm install', { cwd: targetPath, stdio: 'ignore' });
          installSpinner.succeed(chalk.green('Dependencies installed'));
        } catch (err) {
          installSpinner.fail(chalk.red('Failed to install dependencies'));
          console.log(chalk.gray('Run "npm install" manually inside the project folder.'));
        }
      }

      // Success Message
      console.log(chalk.green.bold('\n✨ Project created successfully!\n'));
      console.log(chalk.white('Next steps:'));
      console.log(`  ${chalk.cyan('cd')} ${projectName}`);
      if (!options.install) {
        console.log(`  ${chalk.cyan('npm install')}`);
      }
      console.log(`  ${chalk.cyan('npm run dev')}\n`);

    } catch (error) {
      console.error(chalk.red('\n[X] Setup failed:'), error.message);
      process.exit(1);
    }
  });

// Enhanced Help Output
if (process.argv.length <= 2) {
  console.log(chalk.blue.bold('🚀 Create Vako App\n'));
  console.log(chalk.white('Usage:'));
  console.log(chalk.gray('  npx create-vako-app my-app'));
  console.log(chalk.gray('  npx create-vako-app my-app --template api'));
  console.log(chalk.gray('  npx create-vako-app my-app --git --install'));
  console.log(chalk.gray('  npx create-vako-app my-app --wizard'));
  console.log(chalk.gray('  npx create-vako-app my-app --quick'));
  console.log(chalk.white('\nOptions:'));
  console.log(chalk.gray('  --template     Specify template (default, api, blog, admin)'));
  console.log(chalk.gray('  --quick        Skip optional questions'));
  console.log(chalk.gray('  --wizard       Full interactive setup'));
  console.log(chalk.gray('  --git          Initialize git repository'));
  console.log(chalk.gray('  --install      Run npm install automatically'));
  console.log(chalk.white('\nExamples:'));
  console.log(chalk.gray('  npx create-vako-app blog-app --template blog --git'));
  console.log(chalk.gray('  npx create-vako-app api-server --template api --install'));
  process.exit(0);
}

program.parse();
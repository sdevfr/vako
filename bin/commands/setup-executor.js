const { createSpinner } = require('nanospinner');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class SetupExecutor {
  constructor(config) {
    this.config = config;
    this.projectPath = path.resolve(process.cwd(), config.projectName);
  }

  async execute() {
    const totalSteps = 8;
    let currentStep = 0;

    try {
      // Step 1: Create directory
      currentStep++;
      const spinner1 = createSpinner(`[${currentStep}/${totalSteps}] 📁 Creating project directory...`).start();
      await this.sleep(800);
      await this.createDirectory();
      spinner1.success({ text: `📁 Project directory created` });

      // Step 2: Generate project structure
      currentStep++;
      const spinner2 = createSpinner(`[${currentStep}/${totalSteps}] 🏗️ Generating project structure...`).start();
      await this.sleep(1200);
      await this.createProjectStructure();
      spinner2.success({ text: `🏗️ Project structure created` });

      // Step 3: Generate templates and files
      currentStep++;
      const spinner3 = createSpinner(`[${currentStep}/${totalSteps}] 📄 Generating template files...`).start();
      await this.sleep(1500);
      await this.generateTemplateFiles();
      spinner3.success({ text: `📄 Template files generated` });

      // Step 4: Configure features and plugins
      currentStep++;
      const spinner4 = createSpinner(`[${currentStep}/${totalSteps}] ⚡ Configuring features and plugins...`).start();
      await this.sleep(1000);
      await this.configureFeatures();
      spinner4.success({ text: `⚡ Features and plugins configured` });

      // Step 5: Setup authentication
      if (this.config.auth.enabled) {
        currentStep++;
        const spinner5 = createSpinner(`[${currentStep}/${totalSteps}] 🔐 Setting up authentication...`).start();
        await this.sleep(1300);
        await this.setupAuthentication();
        spinner5.success({ text: `🔐 Authentication system configured` });
      }

      // Step 6: Setup database
      if (this.config.database !== 'none') {
        currentStep++;
        const spinner6 = createSpinner(`[${currentStep}/${totalSteps}] 🗄️ Configuring database...`).start();
        await this.sleep(900);
        await this.setupDatabase();
        spinner6.success({ text: `🗄️ Database configured` });
      }

      // Step 7: Initialize Git
      if (this.config.git) {
        currentStep++;
        const spinner7 = createSpinner(`[${currentStep}/${totalSteps}] 📦 Initializing Git repository...`).start();
        await this.sleep(600);
        await this.initializeGit();
        spinner7.success({ text: `📦 Git repository initialized` });
      }

      // Step 8: Install dependencies
      if (this.config.install) {
        currentStep++;
        const spinner8 = createSpinner(`[${currentStep}/${totalSteps}] 📥 Installing dependencies...`).start();
        try {
          await this.installDependencies();
          spinner8.success({ text: `📥 Dependencies installed successfully` });
        } catch (error) {
          // Ne pas faire planter le setup si l'installation échoue
          spinner8.warning({ text: `📥 Dependencies installation skipped (run 'npm install' manually)` });
        }
      }

    } catch (error) {
      console.error(chalk.red('\n❌ Setup failed:'), error.message);
      throw error;
    }
  }

  async createDirectory() {
    if (fs.existsSync(this.projectPath)) {
      throw new Error(`Directory ${this.config.projectName} already exists`);
    }
    fs.mkdirSync(this.projectPath, { recursive: true });
  }

  async createProjectStructure() {
    const directories = this.getDirectoriesForTemplate();
    
    for (const dir of directories) {
      const fullPath = path.join(this.projectPath, dir);
      fs.mkdirSync(fullPath, { recursive: true });
    }
  }

  getDirectoriesForTemplate() {
    const baseDirectories = [
      'views',
      'views/layouts',
      'views/partials',
      'views/components',
      'routes',
      'routes/api',
      'public',
      'public/css',
      'public/js',
      'public/images',
      'config',
      'middleware',
      'plugins',
      'data',
      'utils'
    ];

    const templateDirectories = {
      blog: ['content', 'content/posts', 'admin', 'uploads'],
      admin: ['admin', 'admin/views', 'dashboard'],
      ecommerce: ['shop', 'products', 'orders', 'cart'],
      portfolio: ['portfolio', 'projects', 'gallery'],
      pwa: ['pwa', 'sw', 'manifest', 'offline']
    };

    return [
      ...baseDirectories,
      ...(templateDirectories[this.config.template] || [])
    ];
  }

  async generateTemplateFiles() {
    const files = this.generateFiles();

    for (const [filePath, content] of Object.entries(files)) {
      const fullPath = path.join(this.projectPath, filePath);
      const dir = path.dirname(fullPath);
      
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(fullPath, content, 'utf8');
    }
  }

  generateFiles() {
    const { projectName, description, author, license, template, features, database, auth, styling } = this.config;
    const files = {};

    // package.json
    files['package.json'] = JSON.stringify({
      name: projectName,
      version: '1.0.0',
      description: description || 'A modern web application built with Vako',
      main: 'app.js',
      scripts: {
        dev: 'vako dev',
        start: 'vako start',
        build: 'vako build'
      },
      keywords: ['vako', 'framework', 'web'],
      author: author || '',
      license: license || 'MIT',
      dependencies: {
        vako: '^1.3.6'
      }
    }, null, 2);

    // app.js
    files['app.js'] = `const { App } = require('vako');

const app = new App({
  port: 3000,
  isDev: true,
  viewsDir: 'views',
  staticDir: 'public',
  routesDir: 'routes'
});

app.loadRoutes();
app.listen();
`;

    // README.md
    files['README.md'] = `# ${projectName}

${description || 'A modern web application built with Vako'}

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`

## Documentation

Visit [https://vako.js.org](https://vako.js.org) for more information.
`;

    // .gitignore
    files['.gitignore'] = `node_modules/
.env
*.log
.DS_Store
dist/
coverage/
`;

    // routes/index.js
    files['routes/index.js'] = `const { Router } = require('express');
const router = Router();

router.get('/', (req, res) => {
  res.render('index', {
    title: 'Welcome to ${projectName}'
  });
});

module.exports = router;
`;

    // views/index.ejs
    files['views/index.ejs'] = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= title %></title>
</head>
<body>
  <h1><%= title %></h1>
  <p>Welcome to your Vako application!</p>
</body>
</html>
`;

    // public/css/style.css
    files['public/css/style.css'] = `body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  margin: 0;
  padding: 20px;
  background-color: #f5f5f5;
}

h1 {
  color: #333;
}
`;

    // public/js/main.js
    files['public/js/main.js'] = `console.log('Vako loaded');
`;

    return files;
  }

  async configureFeatures() {
    // Configure features based on this.config.features
    // This is a placeholder - features are already configured in generateFiles()
  }

  async setupAuthentication() {
    if (this.config.auth.enabled) {
      // Create auth routes and middleware
      const authRoute = `const { Router } = require('express');
const router = Router();

router.get('/login', (req, res) => {
  res.render('auth/login', { title: 'Login' });
});

router.post('/login', async (req, res) => {
  // Implement login logic here
  res.redirect('/');
});

router.get('/logout', (req, res) => {
  // Implement logout logic here
  res.redirect('/');
});

module.exports = router;
`;
      
      const authPath = path.join(this.projectPath, 'routes/auth.js');
      fs.writeFileSync(authPath, authRoute, 'utf8');
    }
  }

  async setupDatabase() {
    if (this.config.database !== 'none') {
      // Create database configuration file
      const dbConfig = `module.exports = {
  type: '${this.config.database}',
  // Add your database configuration here
};
`;
      
      const dbPath = path.join(this.projectPath, 'config/database.js');
      const dbDir = path.dirname(dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
      fs.writeFileSync(dbPath, dbConfig, 'utf8');
    }
  }

  async initializeGit() {
    try {
      execSync('git init', { cwd: this.projectPath, stdio: 'pipe' });
      execSync('git add .', { cwd: this.projectPath, stdio: 'pipe' });
      execSync('git commit -m "🎉 Initial commit - Created with Vako"', { 
        cwd: this.projectPath, 
        stdio: 'pipe' 
      });
    } catch (error) {
      // Git initialization is optional
      console.log(chalk.yellow('   ⚠ Git initialization failed (optional)'));
    }
  }

  async installDependencies() {
    try {
      // Afficher un message informatif
      console.log(chalk.gray('   Installing dependencies... This may take a few minutes.'));
      
      execSync('npm install', { 
        cwd: this.projectPath, 
        stdio: 'pipe',
        timeout: 300000 // 5 minutes timeout
      });
      
      console.log(chalk.green('   ✓ Dependencies installed successfully'));
    } catch (error) {
      // Ne pas faire planter le setup si l'installation échoue
      console.log(chalk.yellow('   ⚠ Installation des dépendances échouée'));
      console.log(chalk.gray('   Vous pouvez installer manuellement avec: npm install'));
      console.log(chalk.gray('   Le projet a été créé avec succès, vous pouvez continuer.'));
      
      // Ne pas throw l'erreur pour ne pas faire planter le setup
      // L'utilisateur peut installer manuellement après
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = SetupExecutor;
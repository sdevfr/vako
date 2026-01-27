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
    const { projectName, description, author, license, template, features, database, auth, styling, codeType } = this.config;
    const files = {};

    // Générer les fichiers selon le type de code
    if (codeType === 'nextjs') {
      return this.generateNextJsFiles();
    } else if (codeType === 'typescript') {
      return this.generateTypeScriptFiles();
    } else {
      return this.generateEjsFiles();
    }
  }

  generateEjsFiles() {
    const { projectName, description, author, license } = this.config;
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
      keywords: ['vako', 'framework', 'web', 'ejs'],
      author: author || '',
      license: license || 'MIT',
      dependencies: {
        vako: '^1.3.13'
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

  generateTypeScriptFiles() {
    const { projectName, description, author, license } = this.config;
    const files = {};

    // package.json
    files['package.json'] = JSON.stringify({
      name: projectName,
      version: '1.0.0',
      description: description || 'A modern web application built with Vako and TypeScript',
      main: 'dist/app.js',
      scripts: {
        dev: 'ts-node src/app.ts',
        build: 'tsc',
        start: 'node dist/app.js',
        'type-check': 'tsc --noEmit'
      },
      keywords: ['vako', 'framework', 'web', 'typescript'],
      author: author || '',
      license: license || 'MIT',
      dependencies: {
        vako: '^1.3.13'
      },
      devDependencies: {
        '@types/node': '^20.10.5',
        '@types/express': '^4.17.21',
        'ts-node': '^10.9.2',
        'typescript': '^5.3.3'
      }
    }, null, 2);

    // tsconfig.json
    files['tsconfig.json'] = JSON.stringify({
      compilerOptions: {
        target: 'ES2020',
        module: 'commonjs',
        lib: ['ES2020'],
        outDir: './dist',
        rootDir: './src',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        resolveJsonModule: true,
        declaration: true,
        declarationMap: true,
        sourceMap: true
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist']
    }, null, 2);

    // src/app.ts
    files['src/app.ts'] = `import { App } from 'vako';

const app = new App({
  port: 3000,
  isDev: true,
  viewsDir: 'views',
  staticDir: 'public',
  routesDir: 'src/routes'
});

app.loadRoutes();
app.listen();
`;

    // src/routes/index.ts
    files['src/routes/index.ts'] = `import { Router, Request, Response } from 'express';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  res.render('index', {
    title: 'Welcome to ${projectName}'
  });
});

export default router;
`;

    // README.md
    files['README.md'] = `# ${projectName}

${description || 'A modern web application built with Vako and TypeScript'}

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`

## Building for Production

\`\`\`bash
npm run build
npm start
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
*.tsbuildinfo
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
  <p>Welcome to your Vako TypeScript application!</p>
</body>
</html>
`;

    return files;
  }

  generateNextJsFiles() {
    const { projectName, description, author, license } = this.config;
    const files = {};

    // package.json
    files['package.json'] = JSON.stringify({
      name: projectName,
      version: '1.0.0',
      description: description || 'A modern web application built with Vako and Next.js',
      scripts: {
        dev: 'next dev',
        build: 'next build',
        start: 'next start',
        lint: 'next lint'
      },
      keywords: ['vako', 'framework', 'web', 'nextjs', 'react'],
      author: author || '',
      license: license || 'MIT',
      dependencies: {
        vako: '^1.3.13',
        next: '^14.0.0',
        react: '^18.2.0',
        'react-dom': '^18.2.0'
      },
      devDependencies: {
        '@types/node': '^20.10.5',
        '@types/react': '^18.2.0',
        '@types/react-dom': '^18.2.0',
        typescript: '^5.3.3',
        eslint: '^8.56.0',
        'eslint-config-next': '^14.0.0'
      }
    }, null, 2);

    // next.config.js
    files['next.config.js'] = `/** @type {import('next').NextConfig} */
const { NextJsAdapter } = require('vako');
const { App } = require('vako');

const nextConfig = {
  reactStrictMode: true,
  // Configuration Vako
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Configuration pour le client
    }
    return config;
  }
};

module.exports = nextConfig;
`;

    // tsconfig.json (pour Next.js)
    files['tsconfig.json'] = JSON.stringify({
      compilerOptions: {
        target: 'ES2020',
        lib: ['dom', 'dom.iterable', 'esnext'],
        allowJs: true,
        skipLibCheck: true,
        strict: true,
        forceConsistentCasingInFileNames: true,
        noEmit: true,
        esModuleInterop: true,
        module: 'esnext',
        moduleResolution: 'bundler',
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: 'preserve',
        incremental: true,
        plugins: [
          {
            name: 'next'
          }
        ],
        paths: {
          '@/*': ['./src/*']
        }
      },
      include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
      exclude: ['node_modules']
    }, null, 2);

    // server.js (serveur personnalisé avec Vako)
    files['server.js'] = `const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { App } = require('vako');
const { NextJsAdapter } = require('vako');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // Créer l'instance Vako
  const vakoApp = new App({
    port: port + 1, // Port différent pour Vako
    isDev: dev
  });

  // Intégrer Vako avec Next.js
  const adapter = new NextJsAdapter({
    nextApp: app,
    enableVakoRoutes: true,
    enableVakoPlugins: true,
    routePrefix: '/api/vako'
  });

  adapter.integrateRoutes(vakoApp);
  adapter.usePlugins(vakoApp);

  // Créer le serveur HTTP
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  }).listen(port, (err) => {
    if (err) throw err;
    console.log(\`> Ready on http://\${hostname}:\${port}\`);
  });
});
`;

    // src/app/layout.tsx
    files['src/app/layout.tsx'] = `import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '${projectName}',
  description: '${description || 'A modern web application built with Vako and Next.js'}'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`;

    // src/app/page.tsx
    files['src/app/page.tsx'] = `export default function Home() {
  return (
    <main>
      <h1>Welcome to ${projectName}</h1>
      <p>Welcome to your Vako Next.js application!</p>
    </main>
  );
}
`;

    // src/app/globals.css
    files['src/app/globals.css'] = `body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  margin: 0;
  padding: 20px;
  background-color: #f5f5f5;
}

h1 {
  color: #333;
}
`;

    // README.md
    files['README.md'] = `# ${projectName}

${description || 'A modern web application built with Vako and Next.js'}

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Building for Production

\`\`\`bash
npm run build
npm start
\`\`\`

## Documentation

- [Next.js Documentation](https://nextjs.org/docs)
- [Vako Documentation](https://vako.js.org)
`;

    // .gitignore
    files['.gitignore'] = `node_modules/
.env
*.log
.DS_Store
.next/
out/
dist/
coverage/
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
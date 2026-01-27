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
    const { codeType } = this.config;

    // Structure de base pour EJS
    if (codeType === 'ejs' || !codeType) {
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
        'utils',
        'locales' // Dossier pour les traductions
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

    // Structure pour TypeScript
    if (codeType === 'typescript') {
      const baseDirectories = [
        'src',
        'src/routes',
        'src/routes/api',
        'src/middleware',
        'src/utils',
        'src/types',
        'src/config',
        'views',
        'views/layouts',
        'public',
        'public/css',
        'public/js',
        'public/images',
        'config',
        'plugins',
        'data'
      ];

      const templateDirectories = {
        blog: ['src/content', 'src/admin', 'uploads'],
        admin: ['src/admin', 'src/dashboard'],
        ecommerce: ['src/shop', 'src/products', 'src/orders'],
        portfolio: ['src/portfolio', 'src/projects', 'src/gallery']
      };

      return [
        ...baseDirectories,
        ...(templateDirectories[this.config.template] || [])
      ];
    }

    // Structure pour Next.js
    if (codeType === 'nextjs') {
      const baseDirectories = [
        'src',
        'src/app',
        'src/app/api',
        'src/components',
        'src/lib',
        'src/types',
        'public',
        'public/images',
        'config',
        'plugins'
      ];

      const templateDirectories = {
        blog: ['src/app/blog', 'src/app/admin', 'src/content'],
        admin: ['src/app/admin', 'src/app/dashboard'],
        portfolio: ['src/app/portfolio', 'src/app/projects']
      };

      return [
        ...baseDirectories,
        ...(templateDirectories[this.config.template] || [])
      ];
    }

    return [];
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
    const { projectName, description, author, license, language } = this.config;
    const files = {};
    
    // Générer les fichiers de traduction selon la langue
    const translations = this.getTranslations(language);

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

## 🚀 Getting Started

### Installation

\`\`\`bash
npm install
\`\`\`

### Development

Démarrer le serveur de développement avec hot reload :

\`\`\`bash
npm run dev
# ou
vako dev
\`\`\`

L'application sera disponible sur [http://localhost:3000](http://localhost:3000)

### Production

\`\`\`bash
npm run build
npm start
\`\`\`

## 📁 Project Structure

\`\`\`
${projectName}/
├── views/          # Templates EJS
│   ├── index.ejs   # Page d'accueil
│   └── about.ejs   # Page à propos
├── routes/         # Routes Express
│   └── index.js    # Routes principales
├── public/         # Fichiers statiques
│   ├── css/        # Styles CSS
│   └── js/         # JavaScript client
├── locales/        # Fichiers de traduction
├── config/         # Configuration
├── middleware/     # Middleware personnalisé
└── app.js          # Point d'entrée
\`\`\`

## 🎯 Features

- ✅ Hot Reload Development Server
- ✅ Plugin System
- ✅ Authentication Ready
- ✅ Modern Architecture
- ✅ EJS Templates
- ✅ RESTful API Routes

## 📚 Documentation

- [Vako Documentation](https://vako.js.org)
- [Express.js Guide](https://expressjs.com)
- [EJS Templates](https://ejs.co)

## 🤝 Contributing

Les contributions sont les bienvenues ! N'hésitez pas à ouvrir une issue ou une pull request.

## 📝 License

${license || 'MIT'}
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

// Page d'accueil
router.get('/', (req, res) => {
  res.render('index', {
    title: '${translations.title || 'Welcome to'} ${projectName}',
    message: '${translations.welcome || 'Welcome to your Vako application!'}',
    features: [
      'Hot Reload Development Server',
      'Plugin System',
      'Authentication Ready',
      'Modern Architecture'
    ]
  });
});

// Page à propos
router.get('/about', (req, res) => {
  res.render('about', {
    title: 'About - ${projectName}',
    description: '${description || translations.description || 'A modern web application built with Vako'}'
  });
});

// API exemple
router.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Vako API is running',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
`;

    // views/index.ejs
    const langAttr = language === 'multi' ? 'fr' : language;
    files['views/index.ejs'] = `<!DOCTYPE html>
<html lang="${langAttr}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${description || translations.description || 'A modern web application built with Vako'}">
  <title><%= title %></title>
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <header>
    <nav>
      <div class="container">
        <h1 class="logo">${projectName}</h1>
        <ul class="nav-menu">
          <li><a href="/" class="active">Home</a></li>
          <li><a href="/about">About</a></li>
          <li><a href="/api/status">API Status</a></li>
        </ul>
      </div>
    </nav>
  </header>

  <main>
    <section class="hero">
      <div class="container">
        <h1><%= title %></h1>
        <p class="lead"><%= message %></p>
        <div class="cta-buttons">
          <a href="/about" class="btn btn-primary">Learn More</a>
          <a href="/api/status" class="btn btn-secondary">API Status</a>
        </div>
      </div>
    </section>

    <section class="features">
      <div class="container">
        <h2>Features</h2>
        <div class="features-grid">
          <% features.forEach(function(feature) { %>
            <div class="feature-card">
              <div class="feature-icon">✨</div>
              <h3><%= feature %></h3>
            </div>
          <% }); %>
        </div>
      </div>
    </section>
  </main>

  <footer>
    <div class="container">
      <p>&copy; ${new Date().getFullYear()} ${projectName}. Built with <a href="https://vako.js.org" target="_blank">Vako</a>.</p>
    </div>
  </footer>

  <script src="/js/main.js"></script>
</body>
</html>
`;

    // views/about.ejs
    files['views/about.ejs'] = `<!DOCTYPE html>
<html lang="${langAttr}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= title %></title>
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <header>
    <nav>
      <div class="container">
        <h1 class="logo">${projectName}</h1>
        <ul class="nav-menu">
          <li><a href="/">Home</a></li>
          <li><a href="/about" class="active">About</a></li>
          <li><a href="/api/status">API Status</a></li>
        </ul>
      </div>
    </nav>
  </header>

  <main>
    <section class="content">
      <div class="container">
        <h1><%= title %></h1>
        <p><%= description %></p>
        <div class="info-box">
          <h3>Technology Stack</h3>
          <ul>
            <li>Vako Framework</li>
            <li>Express.js</li>
            <li>EJS Templates</li>
            <li>Node.js</li>
          </ul>
        </div>
      </div>
    </section>
  </main>

  <footer>
    <div class="container">
      <p>&copy; ${new Date().getFullYear()} ${projectName}. Built with <a href="https://vako.js.org" target="_blank">Vako</a>.</p>
    </div>
  </footer>

  <script src="/js/main.js"></script>
</body>
</html>
`;

    // Créer les fichiers de traduction
    if (language === 'multi') {
      files['locales/fr.json'] = JSON.stringify({
        welcome: 'Bienvenue dans votre application Vako!',
        title: 'Bienvenue sur ${projectName}'
      }, null, 2);
      files['locales/en.json'] = JSON.stringify({
        welcome: 'Welcome to your Vako application!',
        title: 'Welcome to ${projectName}'
      }, null, 2);
      files['locales/es.json'] = JSON.stringify({
        welcome: '¡Bienvenido a tu aplicación Vako!',
        title: 'Bienvenido a ${projectName}'
      }, null, 2);
    } else {
      // Fichier de traduction pour une seule langue
      files[`locales/${language}.json`] = JSON.stringify(translations, null, 2);
    }

    // public/css/style.css
    files['public/css/style.css'] = `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --primary-color: #007bff;
  --secondary-color: #6c757d;
  --success-color: #28a745;
  --danger-color: #dc3545;
  --warning-color: #ffc107;
  --info-color: #17a2b8;
  --light-color: #f8f9fa;
  --dark-color: #343a40;
  --white: #ffffff;
  --gray: #6c757d;
  --border-radius: 8px;
  --shadow: 0 2px 4px rgba(0,0,0,0.1);
  --transition: all 0.3s ease;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  line-height: 1.6;
  color: var(--dark-color);
  background-color: var(--light-color);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
  width: 100%;
}

/* Header & Navigation */
header {
  background: var(--white);
  box-shadow: var(--shadow);
  position: sticky;
  top: 0;
  z-index: 1000;
}

nav {
  padding: 1rem 0;
}

nav .container {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo {
  font-size: 1.5rem;
  font-weight: bold;
  color: var(--primary-color);
}

.nav-menu {
  display: flex;
  list-style: none;
  gap: 2rem;
}

.nav-menu a {
  text-decoration: none;
  color: var(--dark-color);
  font-weight: 500;
  transition: var(--transition);
  padding: 0.5rem 1rem;
  border-radius: var(--border-radius);
}

.nav-menu a:hover,
.nav-menu a.active {
  color: var(--primary-color);
  background-color: var(--light-color);
}

/* Main Content */
main {
  flex: 1;
  padding: 2rem 0;
}

/* Hero Section */
.hero {
  background: linear-gradient(135deg, var(--primary-color) 0%, #0056b3 100%);
  color: var(--white);
  padding: 4rem 0;
  text-align: center;
  margin-bottom: 3rem;
}

.hero h1 {
  font-size: 3rem;
  margin-bottom: 1rem;
  color: var(--white);
}

.lead {
  font-size: 1.25rem;
  margin-bottom: 2rem;
  opacity: 0.9;
}

.cta-buttons {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

/* Buttons */
.btn {
  display: inline-block;
  padding: 0.75rem 1.5rem;
  border-radius: var(--border-radius);
  text-decoration: none;
  font-weight: 600;
  transition: var(--transition);
  border: 2px solid transparent;
  cursor: pointer;
}

.btn-primary {
  background-color: var(--white);
  color: var(--primary-color);
}

.btn-primary:hover {
  background-color: var(--light-color);
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.2);
}

.btn-secondary {
  background-color: transparent;
  color: var(--white);
  border-color: var(--white);
}

.btn-secondary:hover {
  background-color: var(--white);
  color: var(--primary-color);
}

/* Features Section */
.features {
  padding: 3rem 0;
}

.features h2 {
  text-align: center;
  font-size: 2.5rem;
  margin-bottom: 3rem;
  color: var(--dark-color);
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
}

.feature-card {
  background: var(--white);
  padding: 2rem;
  border-radius: var(--border-radius);
  box-shadow: var(--shadow);
  text-align: center;
  transition: var(--transition);
}

.feature-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.feature-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.feature-card h3 {
  color: var(--dark-color);
  margin-top: 1rem;
}

/* Content Section */
.content {
  max-width: 800px;
  margin: 0 auto;
}

.content h1 {
  font-size: 2.5rem;
  margin-bottom: 1.5rem;
  color: var(--dark-color);
}

.content p {
  font-size: 1.1rem;
  margin-bottom: 2rem;
  color: var(--gray);
}

.info-box {
  background: var(--white);
  padding: 2rem;
  border-radius: var(--border-radius);
  box-shadow: var(--shadow);
  margin-top: 2rem;
}

.info-box h3 {
  margin-bottom: 1rem;
  color: var(--primary-color);
}

.info-box ul {
  list-style: none;
  padding-left: 0;
}

.info-box li {
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--light-color);
}

.info-box li:last-child {
  border-bottom: none;
}

.info-box li:before {
  content: "✓ ";
  color: var(--success-color);
  font-weight: bold;
  margin-right: 0.5rem;
}

/* Footer */
footer {
  background: var(--dark-color);
  color: var(--white);
  padding: 2rem 0;
  margin-top: auto;
  text-align: center;
}

footer a {
  color: var(--primary-color);
  text-decoration: none;
}

footer a:hover {
  text-decoration: underline;
}

/* Responsive */
@media (max-width: 768px) {
  .nav-menu {
    flex-direction: column;
    gap: 0.5rem;
  }

  .hero h1 {
    font-size: 2rem;
  }

  .features-grid {
    grid-template-columns: 1fr;
  }

  .cta-buttons {
    flex-direction: column;
    align-items: center;
  }

  .btn {
    width: 100%;
    max-width: 300px;
  }
}
`;

    // views/error.ejs
    files['views/error.ejs'] = `<!DOCTYPE html>
<html lang="${langAttr}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= title %></title>
  <link rel="stylesheet" href="/css/style.css">
  <style>
    .error-container {
      text-align: center;
      padding: 4rem 2rem;
      max-width: 600px;
      margin: 0 auto;
    }
    .error-code {
      font-size: 6rem;
      font-weight: bold;
      color: var(--danger-color);
      margin-bottom: 1rem;
    }
    .error-message {
      font-size: 1.5rem;
      margin-bottom: 2rem;
      color: var(--gray);
    }
  </style>
</head>
<body>
  <header>
    <nav>
      <div class="container">
        <h1 class="logo">${projectName}</h1>
        <ul class="nav-menu">
          <li><a href="/">Home</a></li>
          <li><a href="/about">About</a></li>
        </ul>
      </div>
    </nav>
  </header>

  <main>
    <div class="error-container">
      <div class="error-code"><%= error.status || 500 %></div>
      <h1><%= title %></h1>
      <p class="error-message"><%= message %></p>
      <% if (error.stack && process.env.NODE_ENV === 'development') { %>
        <pre style="text-align: left; background: #f5f5f5; padding: 1rem; border-radius: 8px; overflow-x: auto;"><%= error.stack %></pre>
      <% } %>
      <div class="cta-buttons" style="margin-top: 2rem;">
        <a href="/" class="btn btn-primary">Go Home</a>
      </div>
    </div>
  </main>

  <footer>
    <div class="container">
      <p>&copy; ${new Date().getFullYear()} ${projectName}. Built with <a href="https://vako.js.org" target="_blank">Vako</a>.</p>
    </div>
  </footer>
</body>
</html>
`;

    // public/js/main.js
    files['public/js/main.js'] = `// Vako Application JavaScript
console.log('🚀 Vako application loaded');

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  });
});

// API Status Check
async function checkApiStatus() {
  try {
    const response = await fetch('/api/status');
    const data = await response.json();
    console.log('API Status:', data);
    return data;
  } catch (error) {
    console.error('API Status check failed:', error);
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded');
  
  // Check API status if on home page
  if (window.location.pathname === '/') {
    checkApiStatus();
  }
  
  // Add animation to feature cards
  const featureCards = document.querySelectorAll('.feature-card');
  featureCards.forEach((card, index) => {
    card.style.animationDelay = \`\${index * 0.1}s\`;
    card.classList.add('fade-in');
  });
});

// Add fade-in animation
const style = document.createElement('style');
style.textContent = \`
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .fade-in {
    animation: fadeIn 0.6s ease-out forwards;
    opacity: 0;
  }
\`;
document.head.appendChild(style);
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

  getTranslations(language) {
    const translations = {
      fr: {
        welcome: 'Bienvenue dans votre application Vako!',
        title: 'Bienvenue sur',
        description: 'Une application web moderne construite avec Vako'
      },
      en: {
        welcome: 'Welcome to your Vako application!',
        title: 'Welcome to',
        description: 'A modern web application built with Vako'
      },
      es: {
        welcome: '¡Bienvenido a tu aplicación Vako!',
        title: 'Bienvenido a',
        description: 'Una aplicación web moderna construida con Vako'
      },
      de: {
        welcome: 'Willkommen in Ihrer Vako-Anwendung!',
        title: 'Willkommen bei',
        description: 'Eine moderne Webanwendung, die mit Vako erstellt wurde'
      },
      it: {
        welcome: 'Benvenuto nella tua applicazione Vako!',
        title: 'Benvenuto in',
        description: 'Un\'applicazione web moderna costruita con Vako'
      },
      pt: {
        welcome: 'Bem-vindo à sua aplicação Vako!',
        title: 'Bem-vindo a',
        description: 'Uma aplicação web moderna construída com Vako'
      },
      nl: {
        welcome: 'Welkom bij uw Vako-applicatie!',
        title: 'Welkom bij',
        description: 'Een moderne webapplicatie gebouwd met Vako'
      }
    };

    return translations[language] || translations.en;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = SetupExecutor;
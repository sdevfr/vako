# 🚀 Vako

**Ultra-modern** and **intelligent** web framework for Node.js with Express and EJS, designed for rapid and efficient development with **intelligent hot reload**, **beautiful logging**, **extensible plugin system**, **TypeScript support**, **Next.js integration**, and **revolutionary auto-updater**.

[![npm version](https://img.shields.io/npm/v/vako.svg)](https://www.npmjs.com/package/vako)
[![npm downloads](https://img.shields.io/npm/dm/vako.svg)](https://www.npmjs.com/package/vako)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Features

### 🎯 Core Features
- 🔥 **Intelligent Hot Reload** - Selective reloading of modified routes
- 🎨 **Beautiful Logging** - Colorful logging system with icons and timestamps
- ⚡ **Integrated WebSocket** - Real-time communication for development
- 📁 **Auto-loading** - Routes, views, and middleware auto-configured
- 🛠️ **Development Mode** - Advanced file monitoring
- 🌐 **Smart Prefetching** - Route caching and prefetching
- 🔌 **Plugin System** - Extensible architecture with hooks and complete API
- 🛣️ **Dynamic Route Management** - Create/delete routes on-the-fly
- 🎨 **Advanced Layout System** - Powerful templating with sections and helpers
- 📦 **Auto Module Installation** - Automatic dependency management

### 🔷 TypeScript & Next.js (NEW in v1.3.0)
- 🔷 **Full TypeScript Support** - Complete type definitions included
- ⚛️ **Next.js Adapter** - Seamless integration with Next.js
- 📘 **Type Definitions** - Full IntelliSense support
- 🔗 **Next.js Routes** - Use Vako routes in Next.js applications
- 🔌 **Plugin Compatibility** - Use Vako plugins in Next.js projects

### 🔒 Security & Quality
- 🔬 **Advanced Code Verification** - Comprehensive code quality analysis
- 📊 **HTML Reports** - Beautiful verification reports with interactive dashboard
- 🔒 **Security Auditing** - Advanced security vulnerability detection
- 🧮 **Complexity Analysis** - Cyclomatic complexity and performance metrics

### 🔄 Auto-Updater
- 🔄 **Revolutionary Auto-Updater** - The most advanced auto-updater in Node.js ecosystem
- 🛡️ **Security-First Updates** - Automatic critical security updates with rollback protection
- 💾 **Intelligent Backup System** - Smart backups with one-click rollback
- 🎯 **Multi-Channel Updates** - Support for stable, beta, and alpha channels
- 🎨 **Interactive CLI** - Beautiful command-line interface with auto-completion

## 📋 Table of Contents

- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [TypeScript Support](#-typescript-support)
- [Next.js Integration](#-nextjs-integration)
- [Features](#-features)
- [Documentation](#-documentation)
- [Changelog](#-changelog)
- [Contributing](#-contributing)

## 🚀 Installation

### Global Installation (CLI)

```bash
npm install -g vako
```

### Project Installation

```bash
npm install vako
```

### With TypeScript

```bash
npm install vako
npm install -D typescript @types/node @types/express
```

## 📦 Quick Start

### 1. Create a New Project

```bash
# Create a new project
vako setup my-app

# With options
vako setup --name my-blog --template blog --git

# Available templates: default, api, blog, admin
```

### 2. Basic Application

```javascript
const { App } = require('vako');

const app = new App({
  port: 3000,
  viewsDir: 'views',
  staticDir: 'public',
  routesDir: 'routes',
  layouts: {
    enabled: true,
    defaultLayout: 'main'
  },
  plugins: {
    enabled: true,
    autoLoad: true,
    pluginsDir: 'plugins'
  }
});

app.loadRoutes() // Automatically load all routes
   .listen();
```

### 3. Development Mode

```javascript
const { startDev } = require('vako');

// Simple dev startup with hot reload
startDev({ port: 3000 });
```

Or with the App class:

```javascript
const { App } = require('vako');

const app = new App({
  port: 3000,
  isDev: true, // Enable development mode
  wsPort: 3008, // WebSocket port for hot reload
  watchDirs: ['views', 'routes', 'public'], // Watched directories
  layouts: {
    enabled: true,
    defaultLayout: 'main'
  },
  plugins: {
    enabled: true,
    autoLoad: true,
    pluginsDir: 'plugins'
  }
});

app.loadRoutes().listen();
```

### 4. CLI Commands

```bash
# Start development server
vako dev

# Start with custom port
vako dev --port 8080

# Create new project
vako setup my-project

# Create API project
vako setup --template api --name my-api

# Create blog project
vako setup --template blog --name my-blog

# Create admin project
vako setup --template admin --name admin-panel
```

## 🔷 TypeScript Support

Vako includes complete TypeScript support with full type definitions.

### Installation

```bash
npm install vako
npm install -D typescript @types/node @types/express
```

### Usage

```typescript
import { App, VekoOptions } from 'vako';

const options: VekoOptions = {
  port: 3000,
  isDev: true,
  routesDir: 'routes',
  plugins: {
    enabled: true,
    autoLoad: true
  }
};

const app = new App(options);
app.loadRoutes();
app.listen();
```

### Type Definitions

All types are available in `types/index.d.ts`:

```typescript
import { 
  App, 
  VekoOptions, 
  Plugin, 
  PluginContext,
  NextJsAdapter 
} from 'vako';
```

## ⚛️ Next.js Integration

Vako can be seamlessly integrated with Next.js using the built-in adapter.

### Installation

```bash
npm install vako next react react-dom
```

### Basic Integration

```javascript
// server.js (Custom Next.js server)
const express = require('express');
const next = require('next');
const { App, NextJsAdapter } = require('vako');

const vakoApp = new App({ port: 3001 });
vakoApp.loadRoutes();

const nextApp = next({ dev: true });
const handle = nextApp.getRequestHandler();

nextApp.prepare().then(() => {
  const server = express();
  
  const adapter = new NextJsAdapter({
    nextApp: server,
    enableVekoRoutes: true,
    enableVekoPlugins: true,
    routePrefix: '/api/vako'
  });
  
  adapter.integrateRoutes(vakoApp);
  adapter.usePlugins(vakoApp);
  
  server.use(adapter.middleware());
  server.get('*', (req, res) => handle(req, res));
  
  server.listen(3000, () => {
    console.log('🚀 Server ready on http://localhost:3000');
  });
});
```

### Using Vako Plugins in Next.js

```javascript
// pages/api/data.js
import vakoApp from '../../lib/vako-setup';

export default async function handler(req, res) {
  // Use Vako plugins
  const dbPlugin = vakoApp.pluginManager?.getPlugin('database');
  const data = await dbPlugin?.getData();
  
  res.status(200).json({ data });
}
```

For more details, see [Next.js Integration Guide](docs/nextjs-integration.md).

## 📋 Changelog

### 🎉 Version 1.3.0 (Latest) - January 2025

#### 🆕 TypeScript & Next.js Support

- **🔷 Full TypeScript Support**
  - Complete type definitions in `types/index.d.ts`
  - TypeScript configuration (`tsconfig.json`)
  - Full IntelliSense support
  - Type-safe plugin development

- **⚛️ Next.js Adapter**
  - Seamless integration with Next.js
  - Use Vako routes in Next.js applications
  - Use Vako plugins in Next.js projects
  - Middleware for exposing Vako functionality

- **📚 Documentation**
  - Next.js integration guide
  - TypeScript examples
  - Quick start guides

#### 🔧 Improvements

- Updated package name to `vako` for npm publication
- Enhanced plugin system with TypeScript support
- Improved error handling
- Better documentation structure

### 📜 Version 1.2.0 - December 2024

#### 🆕 Revolutionary Auto-Updater System

- **🔄 Advanced Auto-Updater**
  - Automatic version checking with intelligent scheduling
  - Multi-channel support (stable, beta, alpha, custom registries)
  - Security-first approach with cryptographic validation
  - Interactive CLI with beautiful colored interface
  - Real-time notifications and progress indicators

- **🔒 Security-First Architecture**
  - SHA512 integrity verification for all packages
  - Automatic security updates with priority handling
  - Rollback protection against failed updates
  - Vulnerability scanning before installation

- **💾 Smart Backup & Rollback System**
  - Automatic backup before every update
  - Configurable backup retention (1-10 backups)
  - Instant rollback in case of failure
  - Emergency rollback functionality

### 📜 Version 1.1.0

- Initial plugin system implementation
- Basic layout system with EJS integration
- Hot reload functionality with WebSocket
- CLI commands (dev, setup, build, start)
- Basic logging system with colors
- Auto-loading for routes and middleware

## 🔌 Plugin System

Vako includes a powerful and extensible plugin system.

### Plugin Structure

```javascript
// plugins/my-plugin.js
module.exports = {
  name: 'my-plugin',
  version: '1.0.0',
  description: 'Description of my plugin',
  
  defaultConfig: {
    enabled: true,
    option1: 'value'
  },

  async load(app, config, context) {
    context.log('success', 'Plugin loaded!');
    
    // Add a route
    context.addRoute('get', '/my-plugin', (req, res) => {
      res.json({ message: 'Hello from plugin!' });
    });
    
    // Add middleware
    context.addMiddleware((req, res, next) => {
      req.pluginData = { source: 'my-plugin' };
      next();
    });
  }
};
```

### TypeScript Plugin

```typescript
// plugins/my-plugin.ts
import { Plugin, PluginContext } from 'vako';

const myPlugin: Plugin = {
  name: 'my-plugin',
  version: '1.0.0',
  
  async load(app, config, context: PluginContext) {
    context.log('success', 'TypeScript plugin loaded!');
    // ...
  }
};

export default myPlugin;
```

For more details, see [Plugin Documentation](doc.plugin.md).

## 🎨 Advanced Layout System

Vako includes a powerful layout system with sections and helpers.

```javascript
const app = new App({
  layouts: {
    enabled: true,
    layoutsDir: 'views/layouts',
    defaultLayout: 'main',
    sections: ['head', 'header', 'content', 'footer', 'scripts']
  }
});
```

### Layout Helpers

```javascript
// In your views
<% layout.title('My Page Title') %>
<% layout.meta('description', 'Page description') %>
<% layout.css('/css/custom.css') %>
<% layout.js('/js/custom.js') %>
<% layout.section('header', '<div>Custom Header</div>') %>
```

## 🔥 Intelligent Hot Reload

Vako's hot reload system selectively reloads only what's necessary:

- **Modified routes** → Route-only reload
- **Modified views** → Light template reload
- **Static files** → Full browser reload
- **Modified plugins** → Specific plugin reload
- **Modified layouts** → Layout cache clear and reload

## 🛣️ Route System

### Automatic Routes

Vako automatically loads all routes from the `routes/` folder:

- `routes/index.js` → `/`
- `routes/about.js` → `/about`
- `routes/users/[id].js` → `/users/:id`

### Route File Format

```javascript
// routes/users.js
module.exports = {
  get: (req, res) => {
    res.render('users', { users: [] });
  },
  post: (req, res) => {
    const newUser = req.body;
    res.status(201).json({ user: newUser });
  }
};
```

## 🔄 Auto-Updater

### Quick Start

```bash
# Global installation
npm install -g vako

# Check for updates
vako update check

# Update to latest version
vako update update

# Configure auto-updater
vako update config

# View statistics
vako update stats
```

### Programmatic Usage

```javascript
const { App } = require('vako');

const app = new App({
  autoUpdater: {
    enabled: true,
    checkOnStart: true,
    autoUpdate: false,
    updateChannel: 'stable',
    securityUpdates: true,
    backupCount: 5,
    checkInterval: 3600000,
    rollbackOnFailure: true
  }
});
```

## 📚 Documentation

- [Plugin System](doc.plugin.md) - Complete plugin documentation
- [Authentication](doc.auth.md) - Authentication system guide
- [Next.js Integration](docs/nextjs-integration.md) - Next.js integration guide
- [Quick Start Guide](QUICK_START_NEXTJS.md) - Quick start with TypeScript and Next.js

## 🛠️ CLI Commands

```bash
# Development
vako dev                    # Start development server
vako dev --port 8080        # Custom port
vako dev --watch "src,views" # Custom watch directories

# Project Setup
vako setup my-app           # Create new project
vako setup --template api   # Create API project
vako setup --template blog # Create blog project

# Production
vako build                 # Build for production
vako start                 # Start production server

# Updates
vako update check           # Check for updates
vako update update         # Update to latest
vako update config         # Configure auto-updater
vako update stats          # View statistics
```

## 📁 Project Structure

```
my-project/
├── routes/                 # Route files
│   ├── index.js           # Route: /
│   └── api/
│       └── users.js       # Route: /api/users
├── views/                 # View templates
│   ├── layouts/          # Layout templates
│   └── index.ejs
├── public/               # Static files
│   ├── css/
│   └── js/
├── plugins/             # Custom plugins
│   └── my-plugin.js
├── types/               # TypeScript types (optional)
└── package.json
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Local Development

```bash
git clone https://github.com/sdevfr/vako.git
cd vako
npm install
npm run dev
```

### Testing

```bash
npm test
npm run test:watch
npm run lint:check
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🔗 Links

- **npm**: https://www.npmjs.com/package/vako
- **GitHub**: https://github.com/sdevfr/vako
- **Documentation**: See `docs/` folder
- **Issues**: https://github.com/sdevfr/vako/issues

## ⭐ Show Your Support

If you find Vako useful, please consider giving it a star on GitHub!

---

**Vako v1.3.0** - Ultra-modern web framework with TypeScript support and Next.js integration 🚀✨

Built with ❤️ by the Vako team

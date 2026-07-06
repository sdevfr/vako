# Vako

Vako is a Node.js web framework built on Express and EJS, designed for rapid development with selective hot reloading, an extensible plugin architecture, and integrated TypeScript support.

[![npm version](https://img.shields.io/npm/v/vako.svg)](https://www.npmjs.com/package/vako)
[![npm downloads](https://img.shields.io/npm/dm/vako.svg)](https://www.npmjs.com/package/vako)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 📋 Table of Contents
- [Installation](#installation)
- [Quick Start](#quick-start)
- [TypeScript Support](#typescript-support)
- [Next.js Integration](#nextjs-integration)
- [Architecture](#architecture)
- [CLI Commands](#cli-commands)
- [Auto-Updater](#auto-updater)
- [Contributing](#contributing)

## Installation

Install globally for CLI access:
```bash
npm install -g vako
```

Install locally in your project:
```bash
npm install vako
```

For TypeScript projects, install the required dev dependencies:
```bash
npm install -D typescript @types/node @types/express
```

## Quick Start

Generate a new project using the CLI wizard:
```bash
vako setup my-app
# Available templates: default, api, blog, admin
```

Or initialize Vako programmatically:
```javascript
const { App } = require('vako');

const app = new App({
  port: 3000,
  viewsDir: 'views',
  routesDir: 'routes',
  isDev: true, // Enables hot reload
  plugins: { autoLoad: true }
});

app.loadRoutes().listen();
```

## TypeScript Support

Vako ships with complete type definitions. Configure your application using strongly typed options:

```typescript
import { App, VakoOptions } from 'vako';

const options: VakoOptions = {
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

## Next.js Integration

Use the `NextJsAdapter` to mount Vako routes and plugins inside a custom Next.js server.

```javascript
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
    enableVakoRoutes: true,
    routePrefix: '/api/vako'
  });
  
  adapter.integrateRoutes(vakoApp);
  server.use(adapter.middleware());
  
  server.get('*', (req, res) => handle(req, res));
  server.listen(3000);
});
```

## Architecture

### Hot Reload
The development server monitors file changes and selectively reloads components:
- **Routes:** Unregisters and reloads the specific Express router.
- **Views/Layouts:** Clears the EJS cache and triggers a client-side refresh.
- **Plugins:** Unloads and re-initializes the specific plugin instance.

### Route System
Vako auto-loads files from the `routes/` directory. File names map directly to URLs.
- `routes/index.js` maps to `/`
- `routes/users/[id].js` maps to `/users/:id`

Define HTTP methods by exporting them directly:
```javascript
// routes/users.js
module.exports = {
  get: (req, res) => res.render('users', { users: [] }),
  post: (req, res) => res.status(201).json({ user: req.body })
};
```

### Plugin System
Plugins inject routes, middleware, and hooks into the Vako instance.

```javascript
// plugins/my-plugin.js
module.exports = {
  name: 'my-plugin',
  version: '1.0.0',
  defaultConfig: { enabled: true },
  
  async load(app, config, context) {
    context.addRoute('get', '/plugin-data', (req, res) => {
      res.json({ source: 'my-plugin' });
    });
  }
};
```

### Layout System
Configure EJS layouts with sections and asset helpers.

```javascript
const app = new App({
  layouts: {
    enabled: true,
    defaultLayout: 'main',
    sections: ['head', 'header', 'content', 'footer', 'scripts']
  }
});
```

Inject assets and content from your views:
```ejs
<% layout.title('My Page Title') %>
<% layout.css('/css/custom.css') %>
<% layout.section('header', '<div>Custom Header</div>') %>
```

## CLI Commands

```bash
vako dev                  # Start development server
vako dev --port 8080      # Start on custom port
vako setup my-app         # Generate a new project
vako build                # Build for production
vako start                # Start production server
```

## Auto-Updater

Vako includes a built-in auto-updater with SHA-512 integrity verification and automated rollback.

```bash
vako update check         # Check for updates
vako update update        # Apply latest update
vako update rollback      # Revert to previous version
vako update config        # Configure updater settings
```

Programmatic configuration:
```javascript
const app = new App({
  autoUpdater: {
    enabled: true,
    checkOnStart: true,
    autoUpdate: false,
    updateChannel: 'stable',
    backupCount: 5,
    rollbackOnFailure: true
  }
});
```

## Project Structure

```
my-project/
├── routes/               # Auto-loaded route files
│   ├── index.js
│   └── api/
│       └── users.js
├── views/                # EJS templates
│   ├── layouts/          # Layout definitions
│   └── index.ejs
├── public/               # Static assets
├── plugins/              # Custom plugins
├── types/                # TypeScript definitions
└── package.json
```

## Contributing

1. Clone the repository: `git clone https://github.com/sdevfr/vako.git`
2. Install dependencies: `npm install`
3. Run tests: `npm test`
4. Submit a Pull Request.

## License

MIT License - see the [LICENSE](LICENSE) file for details.

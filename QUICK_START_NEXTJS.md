# 🚀 Guide Rapide - Vako avec Next.js et TypeScript

## ✅ Ce qui a été ajouté

1. **Support TypeScript complet**
   - `tsconfig.json` configuré
   - Types TypeScript dans `types/index.d.ts`
   - Support pour les plugins TypeScript

2. **Adaptateur Next.js**
   - `lib/adapters/nextjs-adapter.js` - Intégration avec Next.js
   - Support des routes Vako dans Next.js
   - Support des plugins Vako dans Next.js

3. **Documentation**
   - `docs/nextjs-integration.md` - Guide complet
   - `examples/nextjs-integration.js` - Exemples pratiques

## 📦 Installation

```bash
# Installer les dépendances
npm install

# Pour utiliser avec Next.js
npm install next react react-dom

# Pour TypeScript (optionnel)
npm install -D typescript @types/react @types/node
```

## 🎯 Utilisation rapide

### 1. Avec TypeScript

```typescript
// app.ts
import { App } from 'vako';

const app = new App({
  port: 3000,
  isDev: true
});

app.loadRoutes();
app.listen();
```

### 2. Avec Next.js

```javascript
// server.js
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
  
  server.get('*', (req, res) => handle(req, res));
  server.listen(3000);
});
```

## 📚 Documentation complète

Voir `docs/nextjs-integration.md` pour plus de détails.

## 🔷 Types TypeScript

Les types sont disponibles dans `types/index.d.ts` et sont automatiquement détectés par TypeScript.

```typescript
import { App, VakoOptions, Plugin } from 'vako';
```

## ⚠️ Notes importantes

- Le support TypeScript est **optionnel** - le framework fonctionne toujours en JavaScript pur
- L'adaptateur Next.js est **optionnel** - vous pouvez utiliser Vako seul
- Les types TypeScript sont disponibles mais le code source reste en JavaScript pour compatibilité

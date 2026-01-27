/**
 * Next.js Adapter for Veko.js
 * 
 * Permet d'intégrer Veko.js avec Next.js pour bénéficier des deux frameworks
 * - Utilisez les routes Veko.js dans Next.js
 * - Utilisez les plugins Veko.js dans Next.js
 * - Compatible avec les API routes de Next.js
 */

const path = require('path');

class NextJsAdapter {
  constructor(options = {}) {
    this.nextApp = options.nextApp;
    this.enableVekoRoutes = options.enableVekoRoutes !== false;
    this.enableVekoPlugins = options.enableVekoPlugins !== false;
    this.routePrefix = options.routePrefix || '/api/veko';
    this.vekoApp = null;
    this.integrated = false;
  }

  /**
   * Intègre les routes Veko.js avec Next.js
   * @param {App} vekoApp - Instance de l'application Veko
   */
  integrateRoutes(vekoApp) {
    if (!this.nextApp) {
      throw new Error('Next.js app instance is required');
    }

    this.vekoApp = vekoApp;

    if (!this.enableVekoRoutes) {
      return;
    }

    // Créer un handler Next.js pour toutes les routes Veko
    this.nextApp.use(this.routePrefix, (req, res, next) => {
      // Passer la requête à Express (Veko utilise Express)
      this.vekoApp.express(req, res, next);
    });

    this.integrated = true;
    this.vekoApp.log('success', 'Next.js adapter intégré', `Routes disponibles sous ${this.routePrefix}`);
  }

  /**
   * Active les plugins Veko.js dans Next.js
   * @param {App} vekoApp - Instance de l'application Veko
   */
  usePlugins(vekoApp) {
    if (!this.enableVekoPlugins) {
      return;
    }

    this.vekoApp = vekoApp;

    // Exposer les plugins dans le contexte Next.js
    if (this.nextApp.getRequestHandler) {
      const originalHandler = this.nextApp.getRequestHandler();
      
      this.nextApp.getRequestHandler = (req, res) => {
        // Ajouter les plugins au contexte de la requête
        req.vekoPlugins = vekoApp.pluginManager?.plugins || new Map();
        req.vekoApp = vekoApp;
        
        return originalHandler(req, res);
      };
    }

    vekoApp.log('info', 'Plugins Veko.js disponibles dans Next.js');
  }

  /**
   * Crée un handler API Next.js à partir d'un handler Veko
   * @param {Function} vekoHandler - Handler Veko.js
   * @returns {Function} Handler compatible Next.js API route
   */
  createApiHandler(vekoHandler) {
    return async (req, res) => {
      try {
        // Adapter le contexte pour être compatible avec Express
        await new Promise((resolve, reject) => {
          const next = (err) => {
            if (err) reject(err);
            else resolve();
          };

          // Appeler le handler Veko avec le contexte Express
          const result = vekoHandler(req, res, next);
          
          // Si c'est une Promise, attendre sa résolution
          if (result && typeof result.then === 'function') {
            result.catch(reject);
          }
        });
      } catch (error) {
        if (!res.headersSent) {
          res.status(500).json({ error: error.message });
        }
      }
    };
  }

  /**
   * Middleware pour Next.js qui expose les fonctionnalités Veko
   * @returns {Function} Middleware Express compatible
   */
  middleware() {
    return (req, res, next) => {
      if (!this.vekoApp) {
        return next();
      }

      // Ajouter l'app Veko au contexte de la requête
      req.vekoApp = this.vekoApp;
      req.vekoPlugins = this.vekoApp.pluginManager?.plugins || new Map();
      req.vekoLogger = this.vekoApp.logger;

      // Exécuter les hooks Veko
      if (this.vekoApp.pluginManager) {
        this.vekoApp.pluginManager.executeHook('request:start', req, res);
      }

      // Hook pour la fin de la requête
      const originalEnd = res.end;
      res.end = function(...args) {
        if (this.vekoApp?.pluginManager) {
          this.vekoApp.pluginManager.executeHook('request:end', req, res);
        }
        return originalEnd.apply(this, args);
      }.bind({ vekoApp: this.vekoApp });

      next();
    };
  }

  /**
   * Crée une route API Next.js dynamique depuis une route Veko
   * @param {string} method - Méthode HTTP
   * @param {string} path - Chemin de la route
   * @param {Function|Array} handlers - Handlers Veko
   */
  createNextApiRoute(method, path, handlers) {
    if (!this.nextApp) {
      throw new Error('Next.js app instance is required');
    }

    const fullPath = path.startsWith('/') ? path : `/${path}`;
    const apiPath = `${this.routePrefix}${fullPath}`;

    // Convertir les handlers en handler Next.js
    const handlerArray = Array.isArray(handlers) ? handlers : [handlers];
    const nextHandler = this.createApiHandler(async (req, res) => {
      for (const handler of handlerArray) {
        await new Promise((resolve, reject) => {
          const next = (err) => {
            if (err) reject(err);
            else resolve();
          };
          
          const result = handler(req, res, next);
          if (result && typeof result.then === 'function') {
            result.catch(reject);
          }
        });
      }
    });

    // Enregistrer la route dans Next.js
    // Note: Cela nécessite une configuration spéciale dans Next.js
    // car Next.js utilise un système de routing basé sur les fichiers
    this.vekoApp?.log('info', `Route Next.js créée: ${method.toUpperCase()} ${apiPath}`);
    
    return {
      path: apiPath,
      method: method.toUpperCase(),
      handler: nextHandler
    };
  }

  /**
   * Génère les fichiers de routes API Next.js depuis les routes Veko
   * @param {string} outputDir - Dossier de sortie (pages/api ou app/api)
   */
  generateNextApiFiles(outputDir = 'pages/api') {
    if (!this.vekoApp) {
      throw new Error('Veko app must be integrated first');
    }

    const routes = this.vekoApp.listRoutes();
    const fs = require('fs');
    const path = require('path');

    routes.forEach(route => {
      const routePath = route.path.replace(this.routePrefix, '').replace(/^\//, '');
      const filePath = path.join(outputDir, routePath.replace(/\//g, '/'));
      const dirPath = path.dirname(filePath);

      // Créer le dossier si nécessaire
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      // Générer le fichier API Next.js
      const content = this.generateNextApiFileContent(route);
      fs.writeFileSync(`${filePath}.js`, content);
    });

    this.vekoApp.log('success', 'Fichiers API Next.js générés', `Dans ${outputDir}`);
  }

  /**
   * Génère le contenu d'un fichier API Next.js
   * @private
   */
  generateNextApiFileContent(route) {
    return `// Auto-generated by Veko.js Next.js Adapter
// Route: ${route.method} ${route.path}

export default async function handler(req, res) {
  // Cette route est gérée par Veko.js
  // Pour personnaliser, modifiez ce fichier
  
  if (req.method !== '${route.method}') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rediriger vers le handler Veko
  // Note: Vous devez configurer le proxy ou utiliser le middleware
  return res.status(200).json({ 
    message: 'Route handled by Veko.js',
    route: '${route.path}',
    method: '${route.method}'
  });
}
`;
  }
}

module.exports = NextJsAdapter;

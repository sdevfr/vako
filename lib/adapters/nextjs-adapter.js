/**
 * Next.js Adapter for Vako
 * 
 * Permet d'intégrer Vako avec Next.js pour bénéficier des deux frameworks
 * - Utilisez les routes Vako dans Next.js
 * - Utilisez les plugins Vako dans Next.js
 * - Compatible avec les API routes de Next.js
 */

const path = require('path');

class NextJsAdapter {
  constructor(options = {}) {
    this.nextApp = options.nextApp;
    this.enableVakoRoutes = options.enableVakoRoutes !== false;
    this.enableVakoPlugins = options.enableVakoPlugins !== false;
    this.routePrefix = options.routePrefix || '/api/vako';
    this.vakoApp = null;
    this.integrated = false;
  }

  /**
   * Intègre les routes Vako avec Next.js
   * @param {App} vakoApp - Instance de l'application Vako
   */
  integrateRoutes(vakoApp) {
    if (!this.nextApp) {
      throw new Error('Next.js app instance is required');
    }

    this.vakoApp = vakoApp;

    if (!this.enableVakoRoutes) {
      return;
    }

    // Créer un handler Next.js pour toutes les routes Vako
    this.nextApp.use(this.routePrefix, (req, res, next) => {
      // Passer la requête à Express (Vako utilise Express)
      this.vakoApp.express(req, res, next);
    });

    this.integrated = true;
    this.vakoApp.log('success', 'Next.js adapter intégré', `Routes disponibles sous ${this.routePrefix}`);
  }

  /**
   * Active les plugins Vako dans Next.js
   * @param {App} vakoApp - Instance de l'application Vako
   */
  usePlugins(vakoApp) {
    if (!this.enableVakoPlugins) {
      return;
    }

    this.vakoApp = vakoApp;

    // Exposer les plugins dans le contexte Next.js
    if (this.nextApp.getRequestHandler) {
      const originalHandler = this.nextApp.getRequestHandler();
      
      this.nextApp.getRequestHandler = (req, res) => {
        // Ajouter les plugins au contexte de la requête
        req.vakoPlugins = vakoApp.pluginManager?.plugins || new Map();
        req.vakoApp = vakoApp;
        
        return originalHandler(req, res);
      };
    }

    vakoApp.log('info', 'Plugins Vako disponibles dans Next.js');
  }

  /**
   * Crée un handler API Next.js à partir d'un handler Vako
   * @param {Function} vakoHandler - Handler Vako
   * @returns {Function} Handler compatible Next.js API route
   */
  createApiHandler(vakoHandler) {
    return async (req, res) => {
      try {
        // Adapter le contexte pour être compatible avec Express
        await new Promise((resolve, reject) => {
          const next = (err) => {
            if (err) reject(err);
            else resolve();
          };

          // Appeler le handler Vako avec le contexte Express
          const result = vakoHandler(req, res, next);
          
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
   * Middleware pour Next.js qui expose les fonctionnalités Vako
   * @returns {Function} Middleware Express compatible
   */
  middleware() {
    return (req, res, next) => {
      if (!this.vakoApp) {
        return next();
      }

      // Ajouter l'app Vako au contexte de la requête
      req.vakoApp = this.vakoApp;
      req.vakoPlugins = this.vakoApp.pluginManager?.plugins || new Map();
      req.vakoLogger = this.vakoApp.logger;

      // Exécuter les hooks Vako
      if (this.vakoApp.pluginManager) {
        this.vakoApp.pluginManager.executeHook('request:start', req, res);
      }

      // Hook pour la fin de la requête
      const originalEnd = res.end;
      res.end = function(...args) {
        if (this.vakoApp?.pluginManager) {
          this.vakoApp.pluginManager.executeHook('request:end', req, res);
        }
        return originalEnd.apply(this, args);
      }.bind({ vakoApp: this.vakoApp });

      next();
    };
  }

  /**
   * Crée une route API Next.js dynamique depuis une route Vako
   * @param {string} method - Méthode HTTP
   * @param {string} path - Chemin de la route
   * @param {Function|Array} handlers - Handlers Vako
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
    this.vakoApp?.log('info', `Route Next.js créée: ${method.toUpperCase()} ${apiPath}`);
    
    return {
      path: apiPath,
      method: method.toUpperCase(),
      handler: nextHandler
    };
  }

  /**
   * Génère les fichiers de routes API Next.js depuis les routes Vako
   * @param {string} outputDir - Dossier de sortie (pages/api ou app/api)
   */
  generateNextApiFiles(outputDir = 'pages/api') {
    if (!this.vakoApp) {
      throw new Error('Vako app must be integrated first');
    }

    const routes = this.vakoApp.listRoutes();
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

    this.vakoApp.log('success', 'Fichiers API Next.js générés', `Dans ${outputDir}`);
  }

  /**
   * Génère le contenu d'un fichier API Next.js
   * @private
   */
  generateNextApiFileContent(route) {
    return `// Auto-generated by Vako Next.js Adapter
// Route: ${route.method} ${route.path}

export default async function handler(req, res) {
  // Cette route est gérée par Vako
  // Pour personnaliser, modifiez ce fichier
  
  if (req.method !== '${route.method}') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rediriger vers le handler Vako
  // Note: Vous devez configurer le proxy ou utiliser le middleware
  return res.status(200).json({ 
    message: 'Route handled by Vako',
    route: '${route.path}',
    method: '${route.method}'
  });
}
`;
  }
}

module.exports = NextJsAdapter;

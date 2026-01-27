const App = require('./lib/app');

// Export Next.js adapter
const NextJsAdapter = require('./lib/adapters/nextjs-adapter');

module.exports = {
  App,
  
  // Méthodes de création simplifiées
  createApp: (options = {}) => new App(options),
  
  // Démarrer en mode développement
  startDev: (options = {}) => {
    const app = new App({
      ...options,
      isDev: true
    });
    
    app.loadRoutes();
    return app.listen(options.port || 3000);
  },
  
  // Démarrer en mode production
  start: (options = {}) => {
    const app = new App({
      ...options,
      isDev: false
    });
    
    app.loadRoutes();
    return app.listen(options.port || 3000);
  },
  
  // Next.js adapter
  NextJsAdapter
};

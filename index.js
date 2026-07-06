const App = require('./lib/app')
const NextJsAdapter = require('./lib/adapters/nextjs-adapter')
const AuthManager = require('./lib/core/auth-manager')
const RouteManager = require('./lib/routing/route-manager')
const LayoutManager = require('./lib/layout/layout-manager')
const Logger = require('./lib/core/logger')

module.exports = {
  App,
  AuthManager,
  RouteManager,
  LayoutManager,
  Logger,
  NextJsAdapter,

  // Méthodes de création simplifiées
  createApp: (options = {}) => new App(options),

  // Démarrer en mode développement
  startDev: (options = {}) => {
    const app = new App({
      ...options,
      isDev: true,
    })

    app.loadRoutes()
    return app.listen(options.port || 3000)
  },

  // Démarrer en mode production
  start: (options = {}) => {
    const app = new App({
      ...options,
      isDev: false,
    })

    app.loadRoutes()
    return app.listen(options.port || 3000)
  },
}

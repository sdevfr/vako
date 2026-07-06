const path = require('path')
const fs = require('fs')

class NextJsAdapter {
  constructor(options = {}) {
    this.nextApp = options.nextApp
    this.enableVakoRoutes = options.enableVakoRoutes !== false
    this.enableVakoPlugins = options.enableVakoPlugins !== false
    this.routePrefix = options.routePrefix || '/api/vako'
    this.vakoApp = null
    this.integrated = false
  }

  /**
   * Intègre les routes Vako avec Next.js
   * @param {App} vakoApp - Instance de l'application Vako
   */
  integrateRoutes(vakoApp) {
    if (!this.nextApp) {
      throw new Error('Next.js app instance is required')
    }

    this.vakoApp = vakoApp

    if (!this.enableVakoRoutes) {
      return
    }

    // Proxy les requêtes vers l'instance Express de Vako
    this.nextApp.use(this.routePrefix, (req, res, next) => {
      this.vakoApp.express(req, res, next)
    })

    this.integrated = true
    this.vakoApp.log(
      'success',
      'Next.js adapter intégré',
      `Routes disponibles sous ${this.routePrefix}`
    )
  }

  /**
   * Wrap un handler Next.js pour exposer les plugins Vako
   * @param {Function} nextHandler - Le handler Next.js original
   * @returns {Function} Handler wrappé
   */
  wrapNextHandler(nextHandler) {
    return async (req, res) => {
      if (!this.vakoApp) {
        return nextHandler(req, res)
      }

      req.vakoPlugins = this.vakoApp.pluginManager?.plugins || new Map()
      req.vakoApp = this.vakoApp

      return nextHandler(req, res)
    }
  }

  /**
   * Crée un handler API Next.js à partir d'un handler Vako
   * @param {Function} vakoHandler - Handler Vako
   * @returns {Function} Handler compatible Next.js API route
   */
  createApiHandler(vakoHandler) {
    return async (req, res) => {
      return new Promise((resolve) => {
        // FIX: Résoudre la promesse si la réponse est terminée ou si next() est appelé
        let resolved = false
        const done = () => {
          if (!resolved) {
            resolved = true
            resolve()
          }
        }

        const next = (err) => {
          if (err && !res.headersSent) {
            res.status(500).json({ error: err.message })
          }
          done()
        }

        // Écouter la fin de la réponse pour éviter les hangs en serverless
        res.on('finish', done)
        res.on('close', done)

        try {
          const result = vakoHandler(req, res, next)
          if (result && typeof result.then === 'function') {
            result.catch(next)
          }
        } catch (error) {
          next(error)
        }
      })
    }
  }

  /**
   * Middleware pour Next.js qui expose les fonctionnalités Vako
   * @returns {Function} Middleware Express compatible
   */
  middleware() {
    return (req, res, next) => {
      if (!this.vakoApp) {
        return next()
      }

      req.vakoApp = this.vakoApp
      req.vakoPlugins = this.vakoApp.pluginManager?.plugins || new Map()
      req.vakoLogger = this.vakoApp.logger

      if (this.vakoApp.pluginManager) {
        this.vakoApp.pluginManager.executeHook('request:start', req, res)
      }

      const originalEnd = res.end
      const vakoApp = this.vakoApp // Capture l'instance

      // FIX: Conserver le contexte de `res` pour éviter les crashes
      res.end = function (...args) {
        if (vakoApp?.pluginManager) {
          vakoApp.pluginManager.executeHook('request:end', req, res)
        }
        return originalEnd.apply(res, args)
      }

      next()
    }
  }

  /**
   * Crée une route API Next.js dynamique depuis une route Vako
   * @param {string} method - Méthode HTTP
   * @param {string} path - Chemin de la route
   * @param {Function|Array} handlers - Handlers Vako
   */
  createNextApiRoute(method, routePath, handlers) {
    if (!this.nextApp) {
      throw new Error('Next.js app instance is required')
    }

    const fullPath = routePath.startsWith('/') ? routePath : `/${routePath}`
    const apiPath = `${this.routePrefix}${fullPath}`

    const handlerArray = Array.isArray(handlers) ? handlers : [handlers]
    const nextHandler = this.createApiHandler(async (req, res) => {
      for (const handler of handlerArray) {
        await new Promise((resolve, reject) => {
          const next = (err) => {
            if (err) reject(err)
            else resolve()
          }

          const result = handler(req, res, next)
          if (result && typeof result.then === 'function') {
            result.catch(reject)
          }
        })
      }
    })

    this.vakoApp?.log(
      'info',
      `Route Next.js créée: ${method.toUpperCase()} ${apiPath}`
    )

    return {
      path: apiPath,
      method: method.toUpperCase(),
      handler: nextHandler,
    }
  }

  /**
   * Génère les fichiers de routes API Next.js depuis les routes Vako
   * @param {string} outputDir - Dossier de sortie (pages/api ou app/api)
   */
  generateNextApiFiles(outputDir = 'pages/api') {
    if (!this.vakoApp) {
      throw new Error('Vako app must be integrated first')
    }

    const routes = this.vakoApp.listRoutes()

    routes.forEach((route) => {
      // FIX: Nettoyer le path correctement
      const cleanPath = route.path
        .replace(this.routePrefix, '')
        .replace(/^\//, '')
      const fileName = cleanPath || 'index'
      const filePath = path.join(outputDir, fileName)
      const dirPath = path.dirname(filePath)

      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true })
      }

      const content = this.generateNextApiFileContent(route)
      fs.writeFileSync(`${filePath}.js`, content)
    })

    this.vakoApp.log(
      'success',
      'Fichiers API Next.js générés',
      `Dans ${outputDir}`
    )
  }

  /**
   * Génère le contenu d'un fichier API Next.js
   * @private
   */
  generateNextApiFileContent(route) {
    return `// Auto-generated by Vako Next.js Adapter
// Route: ${route.method} ${route.path}

export default async function handler(req, res) {
  if (req.method !== '${route.method}') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // TODO: Importez votre handler Vako ici et utilisez-le
  // const vakoHandler = require('../../path/to/vako/handler');
  // await vakoHandler(req, res);

  return res.status(200).json({
    message: 'Route handled by Vako',
    route: '${route.path}',
    method: '${route.method}'
  });
}
`
  }
}

module.exports = NextJsAdapter

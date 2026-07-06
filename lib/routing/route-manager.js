const path = require('path')
const fs = require('fs')
const crypto = require('crypto')

class RouteManager {
  constructor(app, options) {
    this.app = app
    this.options = options
    this.routeMap = new Map()
    this.dynamicRoutes = new Map()

    // Limite le nombre de routes dynamiques pour éviter les attaques
    this.maxDynamicRoutes = options.maxDynamicRoutes || 1000
    this.allowedMethods = [
      'get',
      'post',
      'put',
      'delete',
      'patch',
      'head',
      'options',
    ]

    // Cache pour optimisation
    this.methodsCache = new Map()
    this.pathValidationCache = new Map()

    // Configuration de sécurité
    this.securityConfig = {
      maxParamLength: options.maxParamLength || 1000,
      maxPathLength: options.maxPathLength || 500,
    }

    // Démarrer le nettoyage périodique
    this.startCacheCleanup()
  }

  // Validation sécurisée et optimisée des paramètres
  validateRouteInput(method, routePath, handler) {
    // Cache key pour éviter les revalidations
    const cacheKey = `${method}:${routePath}:${typeof handler}`
    if (this.pathValidationCache.has(cacheKey)) {
      const cached = this.pathValidationCache.get(cacheKey)
      return { ...cached, handler } // Handler peut changer
    }

    // Validation de la méthode HTTP
    if (!method || typeof method !== 'string') {
      throw new Error('Méthode HTTP invalide')
    }

    const normalizedMethod = method.toLowerCase()
    if (!this.allowedMethods.includes(normalizedMethod)) {
      throw new Error(`Méthode HTTP non autorisée: ${method}`)
    }

    // Validation du chemin
    if (!routePath || typeof routePath !== 'string') {
      throw new Error('Chemin de route invalide')
    }

    // Validation contre les attaques par traversée de chemin
    if (this.containsDangerousPatterns(routePath)) {
      throw new Error('Chemin de route contient des caractères dangereux')
    }

    if (routePath.length > this.securityConfig.maxPathLength) {
      throw new Error(
        `Chemin de route trop long (max: ${this.securityConfig.maxPathLength})`
      )
    }

    // Validation du handler
    if (
      !handler ||
      (typeof handler !== 'function' && !Array.isArray(handler))
    ) {
      throw new Error('Handler de route invalide')
    }

    if (Array.isArray(handler)) {
      handler.forEach((h, index) => {
        if (typeof h !== 'function') {
          throw new Error(`Handler ${index} n'est pas une fonction`)
        }
      })
    }

    const result = {
      method: normalizedMethod,
      path: this.sanitizePath(routePath),
    }
    this.pathValidationCache.set(cacheKey, result)

    return { ...result, handler }
  }

  // Détection optimisée de patterns dangereux
  containsDangerousPatterns(routePath) {
    const dangerousPatterns = [
      /\.\./, // Path traversal
      /[\\]/, // Backslashes
      /javascript:/i, // JavaScript protocol
      /vbscript:/i, // VBScript
      /eval\s*\(/i, // eval calls
    ]
    return dangerousPatterns.some((pattern) => pattern.test(routePath))
  }

  // Nettoyage sécurisé du chemin
  sanitizePath(routePath) {
    let cleaned = routePath.trim()
    cleaned = cleaned.replace(/[\x00-\x1f\x7f-\x9f]/g, '')

    try {
      cleaned = decodeURIComponent(cleaned)
    } catch (e) {
      // Si le décodage échoue, utiliser la chaîne originale
    }

    if (!cleaned.startsWith('/')) {
      cleaned = '/' + cleaned
    }

    cleaned = cleaned.replace(/\/+/g, '/')

    if (cleaned.length > 1 && cleaned.endsWith('/')) {
      cleaned = cleaned.slice(0, -1)
    }

    return cleaned
  }

  // Méthode unique pour créer une route
  async createRoute(method, routePath, handler, options = {}) {
    try {
      const validated = this.validateRouteInput(method, routePath, handler)
      method = validated.method
      routePath = validated.path
      handler = validated.handler

      if (this.dynamicRoutes.size >= this.maxDynamicRoutes) {
        throw new Error('Limite de routes dynamiques atteinte')
      }

      if (this.app.plugins) {
        await this.app.plugins.executeHook(
          'route:security-check',
          method,
          routePath,
          handler,
          options
        )
      }

      if (this.routeExists(method, routePath)) {
        this.app.logger.log(
          'warning',
          'Route already exists',
          `${method.toUpperCase()} ${routePath}`
        )
        return this.app
      }

      const secureHandler = this.createSecureHandler(
        handler,
        method,
        routePath,
        options
      )

      if (Array.isArray(secureHandler)) {
        this.app.app[method](routePath, ...secureHandler)
      } else {
        this.app.app[method](routePath, secureHandler)
      }

      const routeKey = `${method}:${routePath}`
      this.dynamicRoutes.set(routeKey, {
        method,
        path: routePath,
        handler: secureHandler,
        options: this.sanitizeOptions(options),
        createdAt: new Date().toISOString(),
        createdBy: options.createdBy || 'system',
        routeId: this.generateRouteId(method, routePath),
      })

      this.app.logger.log(
        'create',
        'Route created dynamically',
        `${method.toUpperCase()} ${routePath}`
      )

      if (this.app.plugins) {
        await this.app.plugins.executeHook(
          'route:created',
          method,
          routePath,
          secureHandler,
          options
        )
      }

      if (this.app.options.isDev && this.app.devServer) {
        this.app.devServer.broadcast({
          type: 'route-created',
          method: method.toUpperCase(),
          path: routePath,
          timestamp: new Date().toISOString(),
        })
      }

      return this.app
    } catch (error) {
      this.app.logger.log(
        'error',
        'Error creating route',
        `${method?.toUpperCase()} ${routePath} → ${error.message}`
      )
      throw error
    }
  }

  // Crée un wrapper sécurisé unique pour les handlers
  createSecureHandler(handler, method, routePath, options = {}) {
    const wrapHandler = (originalHandler) => {
      return async (req, res, next) => {
        const startTime = Date.now()
        let timeoutId = null

        try {
          // Log de sécurité
          this.app.logger.log(
            'security',
            'Route accessed',
            `${method.toUpperCase()} ${routePath} from ${req.ip} (${req.get('User-Agent') || 'Unknown'})`
          )

          // Exécute le handler original avec timeout
          const timeoutMs = options.timeout || 30000

          const handlerPromise = Promise.resolve(
            originalHandler(req, res, next)
          )
          const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(
              () => reject(new Error('Handler timeout')),
              timeoutMs
            )
          })

          await Promise.race([handlerPromise, timeoutPromise])

          // Log de performance
          const duration = Date.now() - startTime
          if (duration > 1000) {
            this.app.logger.log(
              'performance',
              'Slow route',
              `${method.toUpperCase()} ${routePath} took ${duration}ms`
            )
          }
        } catch (error) {
          const duration = Date.now() - startTime
          this.app.logger.log(
            'error',
            'Handler error',
            `${method.toUpperCase()} ${routePath} → ${error.message} (${duration}ms)`
          )

          if (!res.headersSent) {
            const isDev = process.env.NODE_ENV !== 'production'
            const statusCode = error.statusCode || error.status || 500

            res.status(statusCode).json({
              error: 'Une erreur est survenue',
              details: isDev ? error.message : undefined,
              stack: isDev ? error.stack : undefined,
            })
          }
        } finally {
          // FIX: Toujours clear le timeout pour éviter les fuites de mémoire
          if (timeoutId) clearTimeout(timeoutId)
        }
      }
    }

    if (Array.isArray(handler)) {
      return handler.map((h) => wrapHandler(h))
    } else {
      return wrapHandler(handler)
    }
  }

  // Génération d'ID unique pour les routes
  generateRouteId(method, routePath) {
    return crypto
      .createHash('md5')
      .update(`${method}:${routePath}:${Date.now()}`)
      .digest('hex')
      .substring(0, 8)
  }

  // Nettoyage des options amélioré
  sanitizeOptions(options) {
    const sanitized = {}
    const allowedKeys = [
      'description',
      'middleware',
      'rateLimit',
      'auth',
      'createdBy',
      'timeout',
      'clientId',
      'security',
      'cache',
    ]

    allowedKeys.forEach((key) => {
      if (options[key] !== undefined) {
        if (key === 'timeout') {
          sanitized[key] = Math.min(
            Math.max(parseInt(options[key]) || 30000, 1000),
            300000
          )
        } else if (key === 'rateLimit' && typeof options[key] === 'object') {
          sanitized[key] = {
            window: Math.min(options[key].window || 60000, 3600000),
            max: Math.min(options[key].max || 100, 10000),
          }
        } else {
          sanitized[key] = options[key]
        }
      }
    })

    return sanitized
  }

  // Nettoyage périodique optimisé
  startCacheCleanup() {
    setInterval(() => {
      this.cleanupCache()
    }, 300000).unref() // .unref() pour ne pas bloquer la fermeture du process
  }

  cleanupCache() {
    let cleaned = 0

    if (this.pathValidationCache && this.pathValidationCache.size > 1000) {
      this.pathValidationCache.clear()
      cleaned += 1000
    }

    if (this.methodsCache && this.methodsCache.size > 1000) {
      this.methodsCache.clear()
      cleaned += 1000
    }

    if (cleaned > 0) {
      this.app.logger.log(
        'maintenance',
        'Cache cleaned',
        `${cleaned} entries removed`
      )
    }
  }

  async deleteRoute(method, routePath) {
    try {
      method = method.toLowerCase()
      const routeKey = `${method}:${routePath}`

      if (
        !this.dynamicRoutes.has(routeKey) &&
        !this.routeExists(method, routePath)
      ) {
        this.app.logger.log(
          'warning',
          'Route not found',
          `${method.toUpperCase()} ${routePath}`
        )
        return this.app
      }

      this.removeRouteFromRouter(method, routePath)
      this.dynamicRoutes.delete(routeKey)

      this.app.logger.log(
        'delete',
        'Route deleted dynamically',
        `${method.toUpperCase()} ${routePath}`
      )

      if (this.app.options.isDev && this.app.devServer) {
        this.app.devServer.broadcast({
          type: 'route-deleted',
          method: method.toUpperCase(),
          path: routePath,
          timestamp: new Date().toISOString(),
        })
      }

      return this.app
    } catch (error) {
      this.app.logger.log(
        'error',
        'Error deleting route',
        `${method?.toUpperCase()} ${routePath} → ${error.message}`
      )
      return this.app
    }
  }

  async updateRoute(method, routePath, newHandler) {
    try {
      await this.deleteRoute(method, routePath)
      await this.createRoute(method, routePath, newHandler)
      this.app.logger.log(
        'reload',
        'Route updated',
        `${method.toUpperCase()} ${routePath}`
      )
      return this.app
    } catch (error) {
      this.app.logger.log(
        'error',
        'Error updating route',
        `${method?.toUpperCase()} ${routePath} → ${error.message}`
      )
      return this.app
    }
  }

  routeExists(method, routePath) {
    if (!this.app.app._router) return false
    return this.app.app._router.stack.some((layer) => {
      if (layer.route) {
        const routeMethods = Object.keys(layer.route.methods)
        return (
          layer.route.path === routePath &&
          routeMethods.includes(method.toLowerCase())
        )
      }
      return false
    })
  }

  removeRouteFromRouter(method, routePath) {
    if (!this.app.app._router) return

    this.app.app._router.stack = this.app.app._router.stack.filter((layer) => {
      if (layer.route) {
        const routeMethods = Object.keys(layer.route.methods)
        const shouldRemove =
          layer.route.path === routePath &&
          routeMethods.includes(method.toLowerCase())
        if (shouldRemove) {
          this.app.logger.log(
            'dev',
            'Route removed from Express router',
            `🗑️ ${method.toUpperCase()} ${routePath}`
          )
        }
        return !shouldRemove
      }
      return true
    })
  }

  loadRoutes(routesDir = this.options.routesDir) {
    const routesPath = path.join(process.cwd(), routesDir)

    if (!fs.existsSync(routesPath)) {
      this.app.logger.log(
        'warning',
        'Routes directory not found',
        `📁 ${routesDir}`
      )
      this.createRoutesDirectory(routesPath)
      return this.app
    }

    this.app.logger.log('info', 'Scanning routes...', `📂 ${routesDir}`)
    this.scanDirectory(routesPath, routesPath)

    if (!this.routeExists('get', '/')) {
      this.app.logger.log(
        'warning',
        'No root route found',
        'Create routes/index.js to define the home page'
      )
    }

    return this.app
  }

  scanDirectory(dirPath, basePath) {
    const files = fs.readdirSync(dirPath)
    files.forEach((file) => {
      const filePath = path.join(dirPath, file)
      const stat = fs.statSync(filePath)
      if (stat.isDirectory()) {
        this.scanDirectory(filePath, basePath)
      } else if (file.endsWith('.js')) {
        this.loadRouteFile(filePath, basePath)
      }
    })
  }

  loadRouteFile(filePath, basePath) {
    try {
      const resolvedPath = path.resolve(filePath)
      const resolvedBase = path.resolve(basePath)
      if (!resolvedPath.startsWith(resolvedBase)) {
        throw new Error(
          "Tentative d'accès à un fichier en dehors du répertoire autorisé"
        )
      }

      delete require.cache[require.resolve(filePath)]
      const routeModule = require(filePath)

      const relativePath = path.relative(basePath, filePath)
      const routePath = this.filePathToRoute(relativePath)
      this.routeMap.set(filePath, routePath)

      if (typeof routeModule === 'function') {
        routeModule(this.app.app)
      } else if (routeModule.router) {
        this.app.app.use(routePath, routeModule.router)
      } else if (
        routeModule.get ||
        routeModule.post ||
        routeModule.put ||
        routeModule.delete ||
        routeModule.patch
      ) {
        this.setupRouteHandlers(routePath, routeModule)
      } else {
        this.app.logger.log(
          'warning',
          'Invalid route module',
          `${path.basename(filePath)} - No valid exports found`
        )
      }

      this.app.logger.log(
        'route',
        'Route loaded',
        `${path.basename(filePath)} → ${routePath}`
      )
    } catch (error) {
      this.app.logger.log(
        'error',
        'Failed to load',
        `${path.basename(filePath)} → ${error.message}`
      )
      if (process.env.NODE_ENV !== 'production') throw error
    }
  }

  createRoutesDirectory(routesPath) {
    try {
      fs.mkdirSync(routesPath, { recursive: true })
      this.app.logger.log(
        'create',
        'Routes directory created',
        `📁 ${path.relative(process.cwd(), routesPath)}`
      )

      const indexPath = path.join(routesPath, 'index.js')
      const defaultIndexContent = `// Route principale de l'application
module.exports = {
  get: (req, res) => {
    res.render('index', {
      title: 'Vako - Ultra modern framework',
      message: 'Welcome to Vako! 🚀',
      description: 'Your application is running successfully.'
    });
  }
};`

      fs.writeFileSync(indexPath, defaultIndexContent, 'utf8')
      this.app.logger.log(
        'create',
        'Default index route created',
        `📄 ${path.relative(process.cwd(), indexPath)}`
      )
      this.createDefaultIndexView()
    } catch (error) {
      this.app.logger.log(
        'error',
        'Error creating routes directory',
        error.message
      )
    }
  }

  createDefaultIndexView() {
    const viewsPath = path.join(process.cwd(), this.app.options.viewsDir)
    const indexViewPath = path.join(viewsPath, 'index.ejs')

    if (!fs.existsSync(indexViewPath)) {
      if (!fs.existsSync(viewsPath)) {
        fs.mkdirSync(viewsPath, { recursive: true })
      }

      const defaultViewContent = `<% layout.css = ['/css/home.css'] %>
<% layout.js = ['/js/home.js'] %>
<div class="hero">
    <h1><%= title %></h1>
    <p class="lead"><%= message %></p>
</div>`

      fs.writeFileSync(indexViewPath, defaultViewContent, 'utf8')
    }
  }

  filePathToRoute(filePath) {
    let route = filePath
      .replace(/\\/g, '/')
      .replace(/\.js$/, '')
      .replace(/\/index$/, '')
      .replace(/\[([^\]]+)\]/g, ':$1')

    if (!route.startsWith('/')) route = '/' + route
    if (route === '' || route === '/') route = '/'
    return route
  }

  setupRouteHandlers(routePath, handlers) {
    if (handlers.get) this.app.app.get(routePath, handlers.get)
    if (handlers.post) this.app.app.post(routePath, handlers.post)
    if (handlers.put) this.app.app.put(routePath, handlers.put)
    if (handlers.delete) this.app.app.delete(routePath, handlers.delete)
    if (handlers.patch) this.app.app.patch(routePath, handlers.patch)
  }

  listRoutes() {
    const routes = []
    this.routeMap.forEach((routePath, filePath) => {
      routes.push({
        type: 'file',
        path: routePath,
        source: path.relative(process.cwd(), filePath),
        methods: this.getRouteMethods(routePath),
      })
    })
    this.dynamicRoutes.forEach((routeInfo) => {
      routes.push({
        type: 'dynamic',
        path: routeInfo.path,
        method: routeInfo.method.toUpperCase(),
        createdAt: routeInfo.createdAt,
      })
    })
    return routes
  }

  getRouteMethods(routePath) {
    const cacheKey = `methods:${routePath}`
    if (this.methodsCache.has(cacheKey)) return this.methodsCache.get(cacheKey)
    if (!this.app.app._router) return []

    const methods = new Set()
    this.app.app._router.stack.forEach((layer) => {
      if (layer.route && layer.route.path === routePath) {
        Object.keys(layer.route.methods).forEach((method) =>
          methods.add(method.toUpperCase())
        )
      }
    })

    const result = Array.from(methods)
    this.methodsCache.set(cacheKey, result)
    return result
  }
}

module.exports = RouteManager

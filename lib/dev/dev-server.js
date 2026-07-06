const path = require('path')
const fs = require('fs')

let chokidar, WebSocket

try {
  chokidar = require('chokidar')
  WebSocket = require('ws')
} catch (error) {
  console.warn(
    'Dev dependencies not available. Run "npm install chokidar ws" to enable hot reload.'
  )
}

class DevServer {
  constructor(app, options) {
    this.app = app
    this.options = options
    this.wss = null
    this.watchers = []
  }

  setup() {
    // FIX: Removed setupErrorHandling() to avoid hijacking the Node.js process globally.
    // Fatal errors should crash the process so the developer can fix them.

    this.setupWebSocketServer()
    this.setupFileWatching()
  }

  setupWebSocketServer() {
    if (!WebSocket) {
      this.app.logger.log(
        'warning',
        'WebSocket module not available',
        'Hot reload disabled'
      )
      return
    }

    // Prevent EADDRINUSE if setup() is called multiple times
    if (this.wss) this.wss.close()

    this.wss = new WebSocket.Server({ port: this.options.wsPort })

    this.wss.on('connection', (ws) => {
      this.app.logger.log(
        'dev',
        'Client connected',
        `WebSocket on port ${this.options.wsPort}`
      )

      ws.send(
        JSON.stringify({
          type: 'connected',
          message: 'Connected to Vako server ✨',
        })
      )

      if (this.options.prefetch?.enabled) {
        this.sendAvailableRoutes(ws)
      }
    })
  }

  setupFileWatching() {
    if (!chokidar) {
      this.app.logger.log(
        'warning',
        'Chokidar module not available',
        'File watching disabled'
      )
      return
    }

    const watchPaths = [
      ...this.options.watchDirs.map((dir) => path.resolve(process.cwd(), dir)),
      path.resolve(process.cwd(), this.options.layouts.layoutsDir),
    ]

    watchPaths.forEach((watchPath) => {
      if (fs.existsSync(watchPath)) {
        const watcher = chokidar.watch(watchPath, {
          ignored: /node_modules/,
          persistent: true,
          ignoreInitial: true,
        })

        watcher.on('change', (filePath) => this.handleFileChange(filePath))
        watcher.on('add', (filePath) => {
          this.app.logger.log(
            'file',
            'File added',
            `➕ ${path.relative(process.cwd(), filePath)}`
          )
          this.handleFileChange(filePath)
        })
        watcher.on('unlink', (filePath) => {
          this.app.logger.log(
            'file',
            'File deleted',
            `🗑️ ${path.relative(process.cwd(), filePath)}`
          )
          this.handleFileChange(filePath)
        })

        this.watchers.push(watcher)
      }
    })
  }

  handleFileChange(filePath) {
    const relativePath = path.relative(process.cwd(), filePath)
    this.app.logger.log('file', 'File modified', `📝 ${relativePath}`)

    if (this.isRouteFile(filePath)) {
      this.reloadSpecificRoute(filePath)
    } else if (this.isViewFile(filePath)) {
      this.broadcast({ type: 'view-reload', file: relativePath })
      this.app.logger.log('reload', 'View reloaded', `🎨 ${relativePath}`)
    } else if (this.isLayoutFile(filePath)) {
      this.app.layoutManager.reloadLayouts()
      this.broadcast({ type: 'layout-reload', file: relativePath })
      this.app.logger.log('reload', 'Layout reloaded', `🎨 ${relativePath}`)
    } else {
      this.broadcast({ type: 'reload' })
    }
  }

  isRouteFile(filePath) {
    const routesPath = path.resolve(process.cwd(), this.options.routesDir)
    return filePath.startsWith(routesPath) && filePath.endsWith('.js')
  }

  isViewFile(filePath) {
    const viewsPath = path.resolve(process.cwd(), this.options.viewsDir)
    return filePath.startsWith(viewsPath) && filePath.endsWith('.ejs')
  }

  isLayoutFile(filePath) {
    const layoutsPath = path.resolve(
      process.cwd(),
      this.options.layouts.layoutsDir
    )
    return (
      filePath.startsWith(layoutsPath) &&
      filePath.endsWith(this.options.layouts.extension)
    )
  }

  reloadSpecificRoute(filePath) {
    try {
      delete require.cache[require.resolve(filePath)]
      this.removeRouteFromExpress(filePath)

      const routesPath = path.join(process.cwd(), this.options.routesDir)
      this.app.routeManager.loadRouteFile(filePath, routesPath)

      const relativePath = path.relative(process.cwd(), filePath)
      this.app.logger.log('reload', 'Route reloaded', `🔄 ${relativePath}`)

      this.broadcast({
        type: 'route-reload',
        file: relativePath,
        route: this.app.routeManager.routeMap.get(filePath),
      })
    } catch (error) {
      this.app.logger.log('error', 'Error reloading route', error.message)
      this.broadcast({ type: 'reload' })
    }
  }

  removeRouteFromExpress(filePath) {
    const routePath = this.app.routeManager.routeMap.get(filePath)

    if (routePath && this.app.app._router) {
      this.app.app._router.stack = this.app.app._router.stack.filter(
        (layer) => {
          if (layer.route && layer.route.path === routePath) {
            this.app.logger.log(
              'dev',
              'Route removed from router',
              `🗑️ ${routePath}`
            )
            return false
          }
          return true
        }
      )
    }
  }

  sendAvailableRoutes(ws) {
    const routes = this.collectAvailableRoutes()

    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'routes',
            routes: routes,
            config: this.options.prefetch,
          })
        )
        this.app.logger.log(
          'dev',
          'Routes sent for prefetching',
          `📋 ${routes.length} routes`
        )
      }
    }, this.options.prefetch.prefetchDelay)
  }

  collectAvailableRoutes() {
    const routes = ['/']
    try {
      const stack = this.app.app._router?.stack || []
      stack.forEach((layer) => {
        if (layer.route) {
          const routePath = layer.route.path
          if (routePath && !routes.includes(routePath)) {
            routes.push(routePath)
          }
        }
      })
    } catch (error) {
      // Ignore errors
    }
    return [...new Set(routes)]
  }

  middleware() {
    const self = this // Capture DevServer instance to access options

    return (req, res, next) => {
      const start = Date.now()

      res.on('finish', () => {
        const duration = Date.now() - start
        const status = res.statusCode

        let logType = 'info'
        if (status >= 400) logType = 'error'
        else if (status >= 300) logType = 'warning'
        else logType = 'success'

        this.app.logger.log(
          logType,
          `${req.method} ${req.url}`,
          `${status} - ${duration}ms`
        )
      })

      const originalSend = res.send

      res.send = function (body) {
        const contentType = res.getHeader('Content-Type') || ''

        // FIX: Only inject if it's an HTML response
        if (
          typeof body === 'string' &&
          contentType.includes('text/html') &&
          body.includes('</body>')
        ) {
          // FIX: Use self.options.wsPort instead of req.app.locals.wsPort
          // FIX: Added auto-reconnect logic for better DX
          const reloadScript = `
            <script>
              (function() {
                let ws;
                function connect() {
                  ws = new WebSocket('ws://localhost:${self.options.wsPort}');

                  ws.onopen = () => console.log('🔗 Vako connected');
                  ws.onmessage = (event) => {
                    const data = JSON.parse(event.data);
                    switch(data.type) {
                      case 'reload':
                        console.log('🔄 Full reload...');
                        setTimeout(() => window.location.reload(), 300);
                        break;
                      case 'route-reload':
                        console.log('🔄 Route reloaded:', data.route);
                        if (window.location.pathname === data.route) {
                          setTimeout(() => window.location.reload(), 300);
                        }
                        break;
                      case 'view-reload':
                      case 'layout-reload':
                        console.log('🎨 Resource reloaded:', data.file);
                        setTimeout(() => window.location.reload(), 300);
                        break;
                    }
                  };

                  ws.onclose = () => {
                    console.log('🔌 Vako disconnected. Retrying in 1s...');
                    setTimeout(connect, 1000);
                  };
                }
                connect();
              })();
            </script>
          `
          body = body.replace('</body>', `${reloadScript}</body>`)
        }
        return originalSend.call(this, body)
      }

      next()
    }
  }

  broadcast(data) {
    if (this.wss) {
      this.wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(data))
        }
      })
    }
  }

  stop() {
    this.watchers.forEach((watcher) => watcher.close())
    this.watchers = []

    if (this.wss) {
      this.wss.close()
      this.wss = null
    }

    this.app.logger.log('dev', 'Development server stopped', '🛑')
  }
}

module.exports = DevServer

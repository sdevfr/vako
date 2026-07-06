const path = require('path')
const fs = require('fs')
const EventEmitter = require('events')

// Couleurs pour les logs
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  white: '\x1b[37m',
  bgGreen: '\x1b[42m',
  bgRed: '\x1b[41m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
}

class PluginManager extends EventEmitter {
  constructor(app, options = {}) {
    super()

    this.app = app
    this.options = {
      pluginsDir: 'plugins',
      autoLoad: true,
      enableHooks: true,
      enableAPI: true,
      maxRetries: 3,
      timeout: 30000,
      supportTypeScript: true,
      devMode: process.env.NODE_ENV === 'development',
      watchMode: false,
      enableMetrics: true,
      enableValidation: true,
      allowHotReload: true,
      enableSandbox: false,
      ...options,
    }

    this.plugins = new Map()
    this.hooks = new Map()
    this.middleware = []
    this.routes = []
    this.commands = new Map()
    this.loadOrder = []
    this.loadingQueue = new Set()
    this.errorCount = new Map()
    this.metrics = new Map()
    this.watchers = new Map()
    this.schemas = new Map()
    this.devTools = new Map()

    this.metricsInterval = null // FIX: Store interval to clear it later

    // Support TypeScript
    this.tsSupport = this.initTypeScriptSupport()

    this.init()
  }

  // ============= SUPPORT TYPESCRIPT =============

  initTypeScriptSupport() {
    if (!this.options.supportTypeScript) return null
    try {
      const tsNode = require('ts-node')
      tsNode.register({
        transpileOnly: true,
        compilerOptions: {
          module: 'commonjs',
          target: 'es2020',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
        },
      })
      this.log('info', 'Support TypeScript activé', '🔷 ts-node configuré')
      return { enabled: true, runtime: 'ts-node' }
    } catch (error) {
      this.log(
        'warning',
        'ts-node non trouvé',
        'compilation à la volée activée'
      )
      return { enabled: true, runtime: 'compile' }
    }
  }

  async loadTypeScriptPlugin(pluginPath) {
    if (!this.tsSupport?.enabled)
      throw new Error('Support TypeScript non activé')

    if (this.tsSupport.runtime === 'ts-node') {
      return require(pluginPath)
    } else {
      const typescript = require('typescript')
      const tsContent = await fs.promises.readFile(pluginPath, 'utf8')
      const result = typescript.transpile(tsContent, {
        module: typescript.ModuleKind.CommonJS,
        target: typescript.ScriptTarget.ES2020,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      })

      const jsPath = pluginPath.replace('.ts', '.js')
      await fs.promises.writeFile(jsPath, result)
      try {
        const plugin = require(jsPath)
        await fs.promises.unlink(jsPath)
        return plugin
      } catch (error) {
        if (fs.existsSync(jsPath)) await fs.promises.unlink(jsPath)
        throw error
      }
    }
  }

  // ============= INITIALISATION AVANCÉE =============

  init() {
    this.setupHooks()
    this.setupDevTools()
    this.setupMetrics()
    this.setupWatcher()

    if (this.options.autoLoad) {
      this.loadAllPlugins().catch((error) => {
        this.log(
          'error',
          'Erreur lors du chargement automatique',
          error.message
        )
      })
    }
  }

  setupHooks() {
    const defaultHooks = [
      'app:init',
      'app:start',
      'app:stop',
      'app:restart',
      'route:load',
      'route:create',
      'route:delete',
      'route:update',
      'request:start',
      'request:end',
      'request:error',
      'response:start',
      'response:end',
      'response:error',
      'middleware:add',
      'middleware:remove',
      'error:handle',
      'error:critical',
      'websocket:connect',
      'websocket:disconnect',
      'websocket:message',
      'file:change',
      'file:add',
      'file:delete',
      'plugin:load',
      'plugin:unload',
      'plugin:error',
      'plugin:timeout',
      'plugin:activate',
      'plugin:deactivate',
      'plugin:reload',
      'config:change',
      'config:validate',
      'database:connect',
      'database:disconnect',
      'database:query',
      'cache:set',
      'cache:get',
      'cache:delete',
      'cache:clear',
      'auth:login',
      'auth:logout',
      'auth:register',
      'dev:hotreload',
      'dev:debug',
      'dev:profile',
    ]
    defaultHooks.forEach((hookName) => this.hooks.set(hookName, []))
  }

  setupDevTools() {
    if (!this.options.devMode) return
    this.devTools.set('profiler', {
      start: (name) => {
        const start = process.hrtime.bigint()
        return {
          end: () => {
            const end = process.hrtime.bigint()
            const duration = Number(end - start) / 1000000
            this.log('debug', `Profil: ${name}`, `${duration.toFixed(2)}ms`)
            return duration
          },
        }
      },
    })
    this.devTools.set('debugger', {
      breakpoint: (message, data = {}) => {
        if (this.options.devMode) console.log(`🔴 BREAKPOINT: ${message}`, data)
      },
      inspect: (obj, label = 'Object') => {
        console.log(
          `🔍 ${label}:`,
          require('util').inspect(obj, { colors: true, depth: 3 })
        )
      },
    })
    this.devTools.set('hotreload', {
      enable: () => this.enableHotReload(),
      disable: () => this.disableHotReload(),
      trigger: (pluginName) => this.triggerHotReload(pluginName),
    })
  }

  setupMetrics() {
    if (!this.options.enableMetrics) return
    // FIX: Store interval reference
    this.metricsInterval = setInterval(() => this.collectMetrics(), 30000)
    if (this.metricsInterval.unref) this.metricsInterval.unref()
  }

  setupWatcher() {
    if (!this.options.watchMode && !this.options.allowHotReload) return
    try {
      const chokidar = require('chokidar')
      const pluginsPath = path.join(process.cwd(), this.options.pluginsDir)
      const watcher = chokidar.watch(
        [`${pluginsPath}/**/*.js`, `${pluginsPath}/**/*.ts`],
        {
          ignored: /node_modules/,
          persistent: true,
        }
      )

      watcher.on('change', async (filePath) => {
        const pluginName = this.getPluginNameFromFile(filePath)
        if (pluginName && this.plugins.has(pluginName)) {
          this.log('info', 'Fichier modifié', `${pluginName} → rechargement`)
          try {
            await this.reloadPlugin(pluginName)
          } catch (error) {
            this.log('error', 'Erreur hot reload', error.message)
          }
        }
      })
      this.watchers.set('files', watcher)
    } catch (e) {
      this.log('warning', 'Chokidar non disponible', 'Watch mode désactivé')
    }
  }

  // ============= CHARGEMENT AVANCÉ DES PLUGINS =============

  async loadPlugin(plugin, config = {}) {
    let pluginName
    try {
      let pluginModule
      if (typeof plugin === 'string') {
        pluginName = plugin
        if (this.loadingQueue.has(pluginName))
          throw new Error(`Plugin "${pluginName}" déjà en cours de chargement`)
        this.loadingQueue.add(pluginName)
        pluginModule = await this.resolvePlugin(plugin)
      } else {
        pluginModule = plugin
        pluginName = plugin.name || 'anonymous'
        this.loadingQueue.add(pluginName)
      }

      if (this.plugins.has(pluginName)) {
        this.log('warning', 'Plugin déjà chargé', pluginName)
        this.loadingQueue.delete(pluginName)
        return this
      }

      await this.validatePluginAdvanced(pluginModule, pluginName)

      const pluginInstance = {
        name: pluginName,
        version: pluginModule.version || '1.0.0',
        description: pluginModule.description || '',
        author: pluginModule.author || '',
        dependencies: pluginModule.dependencies || [],
        peerDependencies: pluginModule.peerDependencies || [],
        config: { ...pluginModule.defaultConfig, ...config },
        module: pluginModule,
        loaded: false,
        active: false,
        loadTime: Date.now(),
        errorCount: 0,
        metrics: {
          loadTime: 0,
          executeCount: 0,
          errorCount: 0,
          lastError: null,
          performance: {},
        },
        type: this.detectPluginType(pluginModule),
        priority: pluginModule.priority || 10,
        sandbox: this.options.enableSandbox
          ? this.createSandbox(pluginName)
          : null,
      }

      await this.checkDependenciesAdvanced(pluginInstance)
      await this.executePluginLoadWithTimeout(pluginInstance)

      this.plugins.set(pluginName, pluginInstance)
      this.loadOrder.push(pluginName)
      this.loadingQueue.delete(pluginName)

      this.log(
        'success',
        'Plugin chargé',
        `${pluginName} v${pluginInstance.version}`
      )
      this.emit('plugin:loaded', pluginName, pluginInstance)
      await this.executeHook('plugin:load', pluginName, pluginInstance)
      return this
    } catch (error) {
      if (pluginName) {
        this.loadingQueue.delete(pluginName)
        this.errorCount.set(
          pluginName,
          (this.errorCount.get(pluginName) || 0) + 1
        )
      }
      this.log('error', 'Erreur lors du chargement', error.message)
      this.emit('plugin:error', pluginName, error)
      throw error
    }
  }

  async resolvePlugin(pluginName) {
    const pluginsPath = path.join(process.cwd(), this.options.pluginsDir)
    const possiblePaths = [
      path.join(pluginsPath, `${pluginName}.js`),
      path.join(pluginsPath, `${pluginName}.ts`),
      path.join(pluginsPath, pluginName, 'index.js'),
      path.join(pluginsPath, pluginName, 'index.ts'),
      path.join(pluginsPath, pluginName, 'main.js'),
      path.join(pluginsPath, pluginName, 'main.ts'),
    ]

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return p.endsWith('.ts')
          ? await this.loadTypeScriptPlugin(p)
          : require(p)
      }
    }
    try {
      return require(pluginName)
    } catch (e) {
      throw new Error(`Plugin "${pluginName}" introuvable`)
    }
  }

  detectPluginType(pluginModule) {
    if (pluginModule.type) return pluginModule.type
    if (pluginModule.middleware) return 'middleware'
    if (pluginModule.routes) return 'router'
    if (pluginModule.commands) return 'cli'
    if (pluginModule.websocket) return 'websocket'
    if (pluginModule.database) return 'database'
    if (pluginModule.auth) return 'auth'
    if (pluginModule.theme) return 'theme'
    return 'generic'
  }

  // FIX: Merged validation logic
  async validatePluginAdvanced(pluginModule, pluginName) {
    if (!this.options.enableValidation) return
    if (!pluginModule || typeof pluginModule !== 'object')
      throw new Error(`Plugin "${pluginName}" doit exporter un objet`)
    if (!pluginModule.load || typeof pluginModule.load !== 'function')
      throw new Error(`Plugin "${pluginName}" doit avoir une méthode load()`)

    if (pluginModule.version && !this.isValidVersion(pluginModule.version))
      throw new Error(`Plugin "${pluginName}": version invalide`)
    if (pluginModule.dependencies && !Array.isArray(pluginModule.dependencies))
      throw new Error(
        `Plugin "${pluginName}": dependencies doit être un tableau`
      )

    if (pluginModule.configSchema)
      this.schemas.set(pluginName, pluginModule.configSchema)
    if (pluginModule.hooks && Array.isArray(pluginModule.hooks)) {
      for (const hookName of pluginModule.hooks) {
        if (!this.hooks.has(hookName))
          this.log(
            'warning',
            `Plugin ${pluginName}`,
            `Hook inconnu: ${hookName}`
          )
      }
    }
    if (pluginModule.permissions && Array.isArray(pluginModule.permissions)) {
      await this.validatePermissions(pluginName, pluginModule.permissions)
    }
  }

  // FIX: Implemented missing method
  async validatePermissions() {
    // Basic stub: allow all permissions for now
    return true
  }

  // FIX: Merged dependency check
  async checkDependenciesAdvanced(plugin) {
    if (plugin.dependencies && plugin.dependencies.length > 0) {
      const missing = plugin.dependencies.filter(
        (dep) => !this.plugins.has(dep)
      )
      if (missing.length > 0)
        throw new Error(
          `Plugin "${plugin.name}" nécessite: ${missing.join(', ')}`
        )
    }
    if (plugin.peerDependencies && plugin.peerDependencies.length > 0) {
      const missingPeers = plugin.peerDependencies.filter((peerDep) => {
        try {
          require.resolve(peerDep)
          return false
        } catch (e) {
          return true
        }
      })
      if (missingPeers.length > 0)
        this.log(
          'warning',
          `Plugin ${plugin.name}`,
          `Peer deps manquantes: ${missingPeers.join(', ')}`
        )
    }
    if (plugin.module.engines)
      await this.checkEngineCompatibility(plugin.name, plugin.module.engines)
  }

  // FIX: Implemented missing method
  async checkEngineCompatibility(name, engines) {
    if (engines.node) {
      const currentNode = process.versions.node
      // Simple check, real semver is better
      this.log(
        'info',
        `Plugin ${name}`,
        `Requires Node ${engines.node}, running ${currentNode}`
      )
    }
    return true
  }

  // FIX: Implemented missing method
  createSandbox(pluginName) {
    return {
      require: (mod) => require(mod),
      console: {
        log: (...args) => this.log('info', `[${pluginName}]`, args.join(' ')),
        error: (...args) =>
          this.log('error', `[${pluginName}]`, args.join(' ')),
      },
    }
  }

  // ============= FONCTIONS UTILITAIRES POUR DÉVELOPPEURS =============

  createDevPlugin(name, options = {}) {
    return {
      name,
      version: '1.0.0-dev',
      description: `Plugin de développement: ${name}`,
      type: 'dev',
      load: async (app, config, context) => {
        context.log('info', `Plugin de dev ${name} chargé`)
        if (options.routes)
          Object.entries(options.routes).forEach(([p, h]) =>
            context.addRoute('GET', p, h)
          )
        if (options.middleware)
          options.middleware.forEach((mw) => context.addMiddleware(mw))
        if (options.hooks)
          Object.entries(options.hooks).forEach(([hn, cb]) =>
            context.hook(hn, cb)
          )
        if (options.load) await options.load(app, config, context)
      },
      unload: options.unload,
      ...options,
    }
  }

  // FIX: Removed createPluginBuilder to avoid referencing undefined class

  async injectCode(pluginName, code, type = 'before-load') {
    if (!this.options.devMode)
      throw new Error('Injection disponible uniquement en dev')
    const plugin = this.plugins.get(pluginName)
    if (!plugin) throw new Error(`Plugin ${pluginName} non trouvé`)
    if (!plugin.injections) plugin.injections = []
    plugin.injections.push({ code, type, timestamp: Date.now(), active: true })
    this.log('debug', `Code injecté dans ${pluginName}`, `Type: ${type}`)
  }

  profilePlugin(pluginName, duration = 60000) {
    const plugin = this.plugins.get(pluginName)
    if (!plugin) return null
    const profiler = {
      start: Date.now(),
      end: Date.now() + duration,
      data: {
        hookCalls: 0,
        executionTime: 0,
        memoryUsage: process.memoryUsage(),
        errors: 0,
      },
    }
    this.wrapPluginMethods(plugin, profiler)
    setTimeout(
      () =>
        this.log(
          'info',
          `Profil de ${pluginName}`,
          JSON.stringify(profiler.data, null, 2)
        ),
      duration
    )
    return profiler
  }

  debugPlugin(pluginName) {
    const plugin = this.plugins.get(pluginName)
    if (!plugin) return null
    const debugInterface = {
      inspect: () =>
        this.devTools.get('debugger').inspect(plugin, `Plugin ${pluginName}`),
      config: () => console.log('Configuration:', plugin.config),
      metrics: () => console.log('Métriques:', plugin.metrics),
      hooks: () => this.listPluginHooks(pluginName),
      reload: () => this.reloadPlugin(pluginName),
      toggle: () => this.togglePlugin(pluginName),
      breakpoint: (message) =>
        this.devTools
          .get('debugger')
          .breakpoint(`${pluginName}: ${message}`, plugin),
    }
    global[`debug_${pluginName}`] = debugInterface
    return debugInterface
  }

  async testPlugin(pluginName, tests = {}) {
    const plugin = this.plugins.get(pluginName)
    if (!plugin) throw new Error(`Plugin ${pluginName} non trouvé`)
    const results = { passed: 0, failed: 0, errors: [], details: {} }
    const defaultTests = {
      load: () => plugin.loaded === true,
      active: () => plugin.active === true,
      config: () => plugin.config !== null,
      version: () => plugin.version && this.isValidVersion(plugin.version),
    }
    const allTests = { ...defaultTests, ...tests }
    for (const [testName, testFn] of Object.entries(allTests)) {
      try {
        const result = await testFn(plugin)
        if (result) {
          results.passed++
          results.details[testName] = 'PASS'
        } else {
          results.failed++
          results.details[testName] = 'FAIL'
        }
      } catch (error) {
        results.failed++
        results.errors.push({ test: testName, error: error.message })
        results.details[testName] = `ERROR: ${error.message}`
      }
    }
    return results
  }

  async generatePlugin(name, template = 'basic', options = {}) {
    const templates = {
      basic: this.getBasicTemplate(),
      middleware: this.getMiddlewareTemplate(),
      api: this.getApiTemplate(),
    }
    const pluginTemplate = templates[template]
    if (!pluginTemplate) throw new Error(`Template ${template} non trouvé`)
    const pluginCode = this.renderTemplate(pluginTemplate, { name, ...options })
    const pluginPath = path.join(
      process.cwd(),
      this.options.pluginsDir,
      `${name}.js`
    )
    await fs.promises.mkdir(path.dirname(pluginPath), { recursive: true })
    await fs.promises.writeFile(pluginPath, pluginCode)
    this.log('success', 'Plugin généré', `${name} → ${pluginPath}`)
    return pluginPath
  }

  async backupPlugins(backupPath = null) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const defaultPath = path.join(
      process.cwd(),
      'backups',
      `plugins-${timestamp}.json`
    )
    const outputPath = backupPath || defaultPath
    const backup = {
      timestamp: Date.now(),
      plugins: Array.from(this.plugins.entries()).map(([name, plugin]) => ({
        name,
        version: plugin.version,
        config: plugin.config,
        active: plugin.active,
        loadOrder: this.loadOrder.indexOf(name),
      })),
      loadOrder: this.loadOrder,
      options: this.options,
    }
    await fs.promises.mkdir(path.dirname(outputPath), { recursive: true })
    await fs.promises.writeFile(outputPath, JSON.stringify(backup, null, 2))
    return outputPath
  }

  async restorePlugins(backupPath) {
    if (!fs.existsSync(backupPath))
      throw new Error(`Fichier de sauvegarde non trouvé: ${backupPath}`)
    const backup = JSON.parse(await fs.promises.readFile(backupPath, 'utf8'))
    for (const pluginName of Array.from(this.plugins.keys()))
      await this.unloadPlugin(pluginName)
    const sortedPlugins = backup.plugins.sort(
      (a, b) => a.loadOrder - b.loadOrder
    )
    for (const pluginData of sortedPlugins) {
      try {
        await this.loadPlugin(pluginData.name, pluginData.config)
        if (!pluginData.active) await this.togglePlugin(pluginData.name, false)
      } catch (error) {
        this.log(
          'error',
          `Erreur restauration ${pluginData.name}`,
          error.message
        )
      }
    }
  }

  // ============= TEMPLATES DE PLUGINS =============

  getBasicTemplate() {
    return `module.exports = {
  name: '{{name}}', version: '1.0.0', description: 'Plugin {{name}}', author: 'Vous',
  defaultConfig: { enabled: true },
  async load(app, config, context) {
    context.log('info', 'Plugin {{name}} chargé !');
  },
  async unload(app, config) { console.log('Plugin {{name}} déchargé'); }
};`
  }

  getMiddlewareTemplate() {
    return `module.exports = {
  name: '{{name}}', version: '1.0.0', type: 'middleware',
  async load(app, config, context) {
    context.addMiddleware((req, res, next) => { next(); });
    context.log('success', 'Middleware {{name}} ajouté');
  }
};`
  }

  getApiTemplate() {
    return `module.exports = {
  name: '{{name}}', version: '1.0.0', type: 'api',
  async load(app, config, context) {
    context.addRoute('GET', '/api/{{name}}', (req, res) => res.json({ msg: 'Hello' }));
  }
};`
  }

  renderTemplate(template, variables) {
    let rendered = template
    for (const [key, value] of Object.entries(variables)) {
      rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), value)
    }
    return rendered
  }

  // ============= FONCTIONS UTILITAIRES =============

  isValidVersion(version) {
    return /^\d+\.\d+\.\d+(-[a-zA-Z0-9-]+)?$/.test(version)
  }

  getPluginNameFromFile(filePath) {
    const pluginsPath = path.join(process.cwd(), this.options.pluginsDir)
    const relativePath = path.relative(pluginsPath, filePath)
    const parts = relativePath.split(path.sep)
    if (parts[0].endsWith('.js') || parts[0].endsWith('.ts'))
      return path.parse(parts[0]).name
    return parts[0]
  }

  listPluginHooks(pluginName) {
    const hooks = []
    this.hooks.forEach((hookList, hookName) => {
      const pluginHooks = hookList.filter((h) => h.plugin === pluginName)
      if (pluginHooks.length > 0)
        hooks.push({ hook: hookName, count: pluginHooks.length })
    })
    return hooks
  }

  wrapPluginMethods(plugin, profiler) {
    const originalLoad = plugin.module.load
    plugin.module.load = async (...args) => {
      const start = process.hrtime.bigint()
      try {
        const result = await originalLoad.call(plugin.module, ...args)
        profiler.data.executionTime +=
          Number(process.hrtime.bigint() - start) / 1000000
        return result
      } catch (error) {
        profiler.data.errors++
        throw error
      }
    }
  }

  collectMetrics() {
    for (const [name, plugin] of this.plugins.entries()) {
      const memUsage = process.memoryUsage()
      const errorCount = this.errorCount.get(name) || 0
      this.metrics.set(name, {
        uptime: Date.now() - plugin.loadTime,
        memoryUsage: memUsage,
        errorCount,
        lastCheck: Date.now(),
        health:
          errorCount === 0
            ? 'healthy'
            : errorCount < 5
              ? 'warning'
              : 'critical',
      })
    }
  }

  // ============= GESTION DES PLUGINS =============

  async unloadPlugin(pluginName) {
    try {
      const plugin = this.plugins.get(pluginName)
      if (!plugin) return this
      if (plugin.module.unload && typeof plugin.module.unload === 'function') {
        try {
          await Promise.race([
            plugin.module.unload(this.app, plugin.config),
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error('Timeout')),
                this.options.timeout
              )
            ),
          ])
        } catch (error) {
          this.log(
            'warning',
            `Erreur déchargement ${pluginName}`,
            error.message
          )
        }
      }
      this.cleanupPluginHooks(pluginName)
      this.cleanupPluginMiddleware(pluginName)
      this.cleanupPluginRoutes(pluginName)
      this.cleanupPluginCommands(pluginName)
      try {
        if (plugin.module && plugin.module.__filename)
          delete require.cache[plugin.module.__filename]
      } catch (e) {
        /* ignore */
      }

      this.plugins.delete(pluginName)
      this.loadOrder = this.loadOrder.filter((name) => name !== pluginName)
      this.errorCount.delete(pluginName)
      this.log('success', 'Plugin déchargé', pluginName)
      await this.executeHook('plugin:unload', pluginName)
      return this
    } catch (error) {
      this.log('error', 'Erreur unload plugin', error.message)
      throw error
    }
  }

  async reloadPlugin(pluginName, newConfig = {}) {
    const plugin = this.plugins.get(pluginName)
    if (!plugin) throw new Error(`Plugin "${pluginName}" introuvable`)
    const config = { ...plugin.config, ...newConfig }
    await this.unloadPlugin(pluginName)
    await this.loadPlugin(pluginName, config)
    return this
  }

  async loadAllPlugins() {
    const pluginsPath = path.join(process.cwd(), this.options.pluginsDir)
    if (!fs.existsSync(pluginsPath)) {
      await fs.promises.mkdir(pluginsPath, { recursive: true })
      return this
    }

    const files = await fs.promises.readdir(pluginsPath)
    const pluginFiles = files.filter(
      (file) =>
        file.endsWith('.js') ||
        file.endsWith('.ts') ||
        (fs.statSync(path.join(pluginsPath, file)).isDirectory() &&
          fs.existsSync(path.join(pluginsPath, file, 'index.js')))
    )

    const pluginsInfo = []
    for (const file of pluginFiles) {
      try {
        const pluginName = file.replace(/\.(js|ts)$/, '')
        const pluginModule = await this.resolvePlugin(pluginName)
        pluginsInfo.push({
          name: pluginName,
          dependencies: pluginModule.dependencies || [],
          module: pluginModule,
        })
      } catch (error) {
        this.log('warning', `Problème d'analyse`, `${file} → ${error.message}`)
      }
    }

    const loadOrder = this.sortPluginsByDependencies(pluginsInfo)
    for (const pluginName of loadOrder) {
      let retries = 0,
        loaded = false
      while (retries < this.options.maxRetries && !loaded) {
        try {
          await this.loadPlugin(pluginName)
          loaded = true
        } catch (error) {
          retries++
          if (retries < this.options.maxRetries)
            await new Promise((r) => setTimeout(r, 1000 * retries))
          else
            this.log(
              'error',
              `Échec définitif`,
              `${pluginName} → ${error.message}`
            )
        }
      }
    }
    return this
  }

  sortPluginsByDependencies(pluginsInfo) {
    const loadOrder = []
    const loaded = new Set()
    const loading = new Set()
    const load = (plugin) => {
      if (loaded.has(plugin.name)) return
      if (loading.has(plugin.name)) {
        this.log('warning', 'Dépendance circulaire', plugin.name)
        return
      }
      loading.add(plugin.name)
      for (const depName of plugin.dependencies) {
        const depPlugin = pluginsInfo.find((p) => p.name === depName)
        if (depPlugin) load(depPlugin)
        else
          this.log(
            'warning',
            `Dépendance manquante`,
            `${plugin.name} → ${depName}`
          )
      }
      loadOrder.push(plugin.name)
      loaded.add(plugin.name)
      loading.delete(plugin.name)
    }
    pluginsInfo.forEach(load)
    return loadOrder
  }

  async executePluginLoadWithTimeout(plugin) {
    const pluginContext = this.createPluginContext(plugin)
    try {
      await Promise.race([
        plugin.module.load(this.app, plugin.config, pluginContext),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Timeout de chargement dépassé')),
            this.options.timeout
          )
        ),
      ])
      plugin.loaded = true
      plugin.active = true
    } catch (error) {
      if (error.message.includes('Timeout'))
        this.emit('plugin:timeout', plugin.name)
      throw error
    }
  }

  // ============= CONTEXTE ET API POUR PLUGINS =============

  createPluginContext(plugin) {
    return {
      hook: (hookName, callback, priority = 10) =>
        this.addHook(hookName, callback, plugin.name, priority),
      removeHook: (hookName, callback) =>
        this.removeHook(hookName, callback, plugin.name),
      addMiddleware: (middleware) =>
        this.addPluginMiddleware(middleware, plugin.name),
      addRoute: (method, p, handler) =>
        this.addPluginRoute(method, p, handler, plugin.name),
      addCommand: (name, handler, description) =>
        this.addPluginCommand(name, handler, description, plugin.name),
      log: (type, message, details = '') =>
        this.log(type, `[${plugin.name}] ${message}`, details),
      getPlugin: (name) => this.getPlugin(name),
      listPlugins: () => this.listPlugins(),
      getConfig: () => ({ ...plugin.config }),
      updateConfig: (newConfig) =>
        this.updatePluginConfig(plugin.name, newConfig),
      storage: this.createPluginStorage(plugin.name),
      emit: (eventName, ...args) =>
        this.emit(`plugin:${plugin.name}:${eventName}`, ...args),
      app: this.app,
    }
  }

  createPluginStorage(pluginName) {
    const storageFile = path.join(
      process.cwd(),
      'data',
      'plugins',
      `${pluginName}.json`
    )
    return {
      get: async (key, defaultValue = null) => {
        try {
          if (!fs.existsSync(storageFile)) return defaultValue
          const data = JSON.parse(
            await fs.promises.readFile(storageFile, 'utf8')
          )
          return key
            ? data[key] !== undefined
              ? data[key]
              : defaultValue
            : data
        } catch {
          return defaultValue
        }
      },
      set: async (key, value) => {
        try {
          await fs.promises.mkdir(path.dirname(storageFile), {
            recursive: true,
          })
          let data = {}
          if (fs.existsSync(storageFile)) {
            try {
              data = JSON.parse(await fs.promises.readFile(storageFile, 'utf8'))
            } catch {}
          }
          if (typeof key === 'object') data = { ...data, ...key }
          else data[key] = value
          await fs.promises.writeFile(
            storageFile,
            JSON.stringify(data, null, 2)
          )
          return true
        } catch {
          return false
        }
      },
      delete: async (key) => {
        try {
          if (!fs.existsSync(storageFile)) return true
          const data = JSON.parse(
            await fs.promises.readFile(storageFile, 'utf8')
          )
          delete data[key]
          await fs.promises.writeFile(
            storageFile,
            JSON.stringify(data, null, 2)
          )
          return true
        } catch {
          return false
        }
      },
      clear: async () => {
        try {
          if (fs.existsSync(storageFile)) await fs.promises.unlink(storageFile)
          return true
        } catch {
          return false
        }
      },
    }
  }

  // ============= SYSTÈME DE HOOKS =============

  addHook(hookName, callback, pluginName = 'core', priority = 10) {
    if (!this.hooks.has(hookName)) this.hooks.set(hookName, [])
    if (typeof callback !== 'function')
      throw new Error(`Hook callback doit être une fonction pour ${hookName}`)
    this.hooks
      .get(hookName)
      .push({ callback, plugin: pluginName, priority: Number(priority) || 10 })
    this.hooks.get(hookName).sort((a, b) => b.priority - a.priority)
  }

  removeHook(hookName, callback, pluginName) {
    if (!this.hooks.has(hookName)) return
    this.hooks.set(
      hookName,
      this.hooks
        .get(hookName)
        .filter(
          (hook) => !(hook.callback === callback && hook.plugin === pluginName)
        )
    )
  }

  async executeHook(hookName, ...args) {
    if (!this.hooks.has(hookName)) return args
    const hooks = this.hooks.get(hookName)
    let result = args
    for (const hook of hooks) {
      try {
        const hookResult = await Promise.race([
          hook.callback(...result),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Hook timeout')), 5000)
          ),
        ])
        if (hookResult !== undefined)
          result = Array.isArray(hookResult) ? hookResult : [hookResult]
      } catch (error) {
        this.log(
          'error',
          `Erreur hook ${hookName}`,
          `Plugin: ${hook.plugin} → ${error.message}`
        )
      }
    }
    return result
  }

  // ============= GESTION DES ÉLÉMENTS AJOUTÉS PAR LES PLUGINS =============

  addPluginMiddleware(middleware, pluginName) {
    if (typeof middleware !== 'function')
      throw new Error('Le middleware doit être une fonction')
    this.middleware.push({ middleware, plugin: pluginName })
    if (this.app && this.app.use) this.app.use(middleware)
  }

  addPluginRoute(method, p, handler, pluginName) {
    if (!method || !p || !handler)
      throw new Error('Méthode, chemin et handler requis')
    this.routes.push({ method, path: p, handler, plugin: pluginName })
    if (this.app && this.app.createRoute)
      this.app.createRoute(method, p, handler)
  }

  addPluginCommand(name, handler, description, pluginName) {
    if (!name || !handler) throw new Error('Nom et handler requis')
    this.commands.set(name, {
      handler,
      description: description || '',
      plugin: pluginName,
    })
  }

  cleanupPluginHooks(pluginName) {
    this.hooks.forEach((hooks, hookName) =>
      this.hooks.set(
        hookName,
        hooks.filter((hook) => hook.plugin !== pluginName)
      )
    )
  }
  cleanupPluginMiddleware(pluginName) {
    this.middleware = this.middleware.filter(
      (item) => item.plugin !== pluginName
    )
  }
  cleanupPluginRoutes(pluginName) {
    this.routes = this.routes.filter((route) => route.plugin !== pluginName)
  }
  cleanupPluginCommands(pluginName) {
    for (const [name, command] of this.commands.entries())
      if (command.plugin === pluginName) this.commands.delete(name)
  }

  // ============= UTILITAIRES =============

  getPlugin(pluginName) {
    return this.plugins.get(pluginName) || null
  }
  listPlugins() {
    return Array.from(this.plugins.values()).map((p) => ({
      name: p.name,
      version: p.version,
      loaded: p.loaded,
      active: p.active,
    }))
  }
  updatePluginConfig(pluginName, newConfig) {
    const p = this.plugins.get(pluginName)
    if (p) {
      p.config = { ...p.config, ...newConfig }
      return true
    }
    return false
  }

  async togglePlugin(pluginName, active = null) {
    const plugin = this.plugins.get(pluginName)
    if (!plugin) return false
    const newState = active !== null ? active : !plugin.active
    try {
      if (newState && !plugin.active) {
        if (plugin.module.activate)
          await plugin.module.activate(this.app, plugin.config)
        plugin.active = true
      } else if (!newState && plugin.active) {
        if (plugin.module.deactivate)
          await plugin.module.deactivate(this.app, plugin.config)
        plugin.active = false
      }
    } catch (error) {
      this.log('error', `Erreur toggle ${pluginName}`, error.message)
      throw error
    }
    return plugin.active
  }

  // ============= LOGS =============

  log(type, message, details = '') {
    const timestamp = new Date().toLocaleTimeString('fr-FR')
    const prefix = `${colors.gray}[${timestamp}]${colors.reset}`
    const logStyles = {
      success: {
        badge: `${colors.bgGreen}${colors.white} 🔌 `,
        text: `${colors.green}${colors.bright}`,
      },
      error: {
        badge: `${colors.bgRed}${colors.white} ❌ `,
        text: `${colors.red}${colors.bright}`,
      },
      warning: {
        badge: `${colors.bgYellow}${colors.white} ⚠️ `,
        text: `${colors.yellow}${colors.bright}`,
      },
      info: {
        badge: `${colors.bgBlue}${colors.white} 💎 `,
        text: `${colors.blue}${colors.bright}`,
      },
      debug: {
        badge: `${colors.bgMagenta}${colors.white} 🐛 `,
        text: `${colors.magenta}${colors.bright}`,
      },
    }
    const style = logStyles[type] || logStyles.info
    console.log(
      `${prefix} ${style.badge}${colors.reset} ${style.text}${message}${colors.reset} ${colors.gray}${details}${colors.reset}`
    )
    this.emit('log', { type, message, details, timestamp: new Date() })
  }

  // ============= API PUBLIQUE =============

  getStats() {
    const plugins = Array.from(this.plugins.values())
    return {
      total: plugins.length,
      active: plugins.filter((p) => p.active).length,
      loaded: plugins.filter((p) => p.loaded).length,
      loading: this.loadingQueue.size,
      hooks: this.hooks.size,
      middleware: this.middleware.length,
      routes: this.routes.length,
      commands: this.commands.size,
      errors: Array.from(this.errorCount.values()).reduce(
        (sum, c) => sum + c,
        0
      ),
    }
  }

  // FIX: Added destroy method to clean up intervals and watchers
  destroy() {
    if (this.metricsInterval) clearInterval(this.metricsInterval)
    this.watchers.forEach((watcher) => watcher.close())
    this.watchers.clear()
    this.plugins.clear()
    this.hooks.clear()
  }
}

module.exports = PluginManager

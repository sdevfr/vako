const path = require('path')
const fs = require('fs')

class LayoutManager {
  constructor(app, options = {}) {
    this.app = app
    this.options = {
      defaultLayout: 'default',
      layoutsDir: 'views/layouts',
      extension: '.ejs',
      ...options,
    }
    this.layoutCache = new Map()

    // Verrou pour éviter les race conditions lors de la création de layouts
    this.layoutCreationLock = new Map()

    // Configuration de sécurité
    this.securityConfig = {
      maxCacheSize: 1000,
      maxSectionSize: 50000, // 50KB par section
      allowedExtensions: ['.ejs', '.html'],
      maxNestingDepth: 10,
    }

    // Initialisation du nettoyage automatique du cache
    this.initCacheCleanup()
  }

  /**
   * Middleware principal pour la gestion des layouts
   */
  middleware() {
    return (req, res, next) => {
      const originalRender = res.render

      // Wrapper sécurisé pour res.render
      res.render = this.createSecureRenderWrapper(originalRender, req, res)

      // Helpers de layout
      res.locals.layout = this.createLayoutHelpers(req, res)

      next()
    }
  }

  /**
   * Créer un wrapper sécurisé pour res.render
   */
  createSecureRenderWrapper(originalRender, req, res) {
    return (view, options = {}, callback) => {
      try {
        // Validation des paramètres
        this.validateRenderParameters(view, options)

        // Bypass du layout si demandé
        if (options.layout === false) {
          return originalRender.call(res, view, options, callback)
        }

        const layoutName = this.sanitizeLayoutName(
          options.layout || this.options.defaultLayout
        )
        const layoutData = this.prepareLayoutData(view, options, req)

        this.renderWithLayout(
          res,
          view,
          layoutName,
          layoutData,
          originalRender,
          callback
        )
      } catch (error) {
        this.handleRenderError(
          error,
          res,
          view,
          options,
          originalRender,
          callback
        )
      }
    }
  }

  /**
   * Validation sécurisée des paramètres de rendu
   */
  validateRenderParameters(view, options) {
    if (!view || typeof view !== 'string') {
      throw new Error('View name must be a non-empty string')
    }

    if (view.length > 255) {
      throw new Error('View name too long')
    }

    // Validation contre la traversée de répertoire
    if (view.includes('..') || view.includes('\\') || view.startsWith('/')) {
      throw new Error('Invalid view name: path traversal detected')
    }

    if (options && typeof options !== 'object') {
      throw new Error('Options must be an object')
    }
  }

  /**
   * Nettoyage sécurisé du nom de layout
   */
  sanitizeLayoutName(layoutName) {
    if (!layoutName || typeof layoutName !== 'string') {
      return this.options.defaultLayout
    }

    const sanitized = layoutName
      .replace(/[^a-zA-Z0-9\-_]/g, '')
      .substring(0, 50)

    return sanitized || this.options.defaultLayout
  }

  /**
   * Préparation sécurisée des données de layout
   */
  prepareLayoutData(view, options, req) {
    const baseData = {
      view: this.sanitizeViewName(view),
      sections: this.sanitizeSections(options.sections || {}),
      meta: this.sanitizeMetaData(options.meta),
      layout: this.sanitizeLayoutOptions(options.layout),
      request: this.extractSafeRequestData(req),
    }

    return this.mergeOptionsSecurely(baseData, options)
  }

  /**
   * Nettoyage des sections
   */
  sanitizeSections(sections) {
    const sanitized = {}

    for (const [key, value] of Object.entries(sections)) {
      if (typeof key === 'string' && key.length <= 50) {
        const cleanKey = key.replace(/[^a-zA-Z0-9\-_]/g, '')

        if (
          typeof value === 'string' &&
          value.length <= this.securityConfig.maxSectionSize
        ) {
          sanitized[cleanKey] = value
        }
      }
    }

    return sanitized
  }

  /**
   * Nettoyage des métadonnées
   */
  sanitizeMetaData(meta = {}) {
    const allowedFields = [
      'title',
      'description',
      'keywords',
      'author',
      'viewport',
    ]
    const sanitized = {}

    allowedFields.forEach((field) => {
      if (meta[field] && typeof meta[field] === 'string') {
        sanitized[field] = meta[field].substring(0, 200)
      }
    })

    return {
      title: sanitized.title || 'Vako App',
      description: sanitized.description || '',
      keywords: sanitized.keywords || '',
      author: sanitized.author || '',
      viewport: sanitized.viewport || 'width=device-width, initial-scale=1.0',
    }
  }

  /**
   * Extraction sécurisée des données de requête
   */
  extractSafeRequestData(req) {
    return {
      url: req.url || '',
      path: req.path || '',
      method: req.method || 'GET',
      query: this.sanitizeQueryParams(req.query),
      params: this.sanitizeParams(req.params),
    }
  }

  /**
   * Rendu avec layout de manière asynchrone et sécurisée
   */
  async renderWithLayout(
    res,
    view,
    layoutName,
    data,
    originalRender,
    callback
  ) {
    try {
      // Rendu de la vue en contenu
      const content = await this.renderViewToString(view, data)
      data.sections.content = content

      const layoutPath = this.getLayoutPath(layoutName)

      if (await this.layoutExists(layoutPath)) {
        originalRender.call(res, layoutPath, data, callback)
      } else {
        // Utilisation du verrou pour éviter la création multiple
        await this.createDefaultLayoutAsync(layoutName)
        originalRender.call(res, layoutPath, data, callback)
      }
    } catch (error) {
      this.handleRenderError(error, res, view, data, originalRender, callback)
    }
  }

  /**
   * Rendu de vue en chaîne de caractères avec gestion d'erreur (NON-BLOQUANT)
   */
  async renderViewToString(view, data) {
    const viewPath = this.resolveViewPath(view)

    try {
      const ejs = require('ejs')
      // FIX: Utilisation de fs.promises.readFile au lieu de readFileSync pour ne pas bloquer l'event loop
      const template = await fs.promises.readFile(viewPath, 'utf8')

      // Options sécurisées pour EJS (sans double échappement)
      const ejsOptions = {
        filename: viewPath,
        rmWhitespace: true,
      }

      return ejs.render(template, data, ejsOptions)
    } catch (error) {
      throw new Error(`Template rendering failed: ${error.message}`)
    }
  }

  /**
   * Résolution sécurisée du chemin de vue
   */
  resolveViewPath(view) {
    const viewsDir = path.resolve(
      process.cwd(),
      this.app.options.viewsDir || 'views'
    )
    let viewPath = path.join(viewsDir, view)

    // Validation contre la traversée de répertoire
    if (!viewPath.startsWith(viewsDir)) {
      throw new Error('Invalid view path: outside views directory')
    }

    if (!viewPath.endsWith('.ejs')) {
      viewPath += '.ejs'
    }

    return viewPath
  }

  /**
   * Obtenir le chemin du layout de manière sécurisée
   */
  getLayoutPath(layoutName) {
    const layoutsDir = path.resolve(process.cwd(), this.options.layoutsDir)
    let layoutPath = path.join(layoutsDir, layoutName)

    if (!layoutPath.startsWith(layoutsDir)) {
      throw new Error('Invalid layout path: outside layouts directory')
    }

    if (!layoutPath.endsWith(this.options.extension)) {
      layoutPath += this.options.extension
    }

    return layoutPath
  }

  /**
   * Vérification asynchrone de l'existence d'un layout
   */
  async layoutExists(layoutPath) {
    try {
      await fs.promises.access(layoutPath, fs.constants.R_OK)
      return true
    } catch {
      return false
    }
  }

  /**
   * Création de helpers de layout sécurisés
   */
  createLayoutHelpers(req, res) {
    return {
      section: (name, content) => {
        if (!res.locals.sections) res.locals.sections = {}
        const safeName = this.sanitizeSectionName(name)
        const safeContent = this.sanitizeSectionContent(content)
        res.locals.sections[safeName] = safeContent
        return ''
      },

      css: (href) => {
        if (!res.locals.css) res.locals.css = []
        const safeHref = this.sanitizeResourceUrl(href)
        if (safeHref && res.locals.css.length < 20) {
          res.locals.css.push(safeHref)
        }
        return ''
      },

      js: (src) => {
        if (!res.locals.js) res.locals.js = []
        const safeSrc = this.sanitizeResourceUrl(src)
        if (safeSrc && res.locals.js.length < 20) {
          res.locals.js.push(safeSrc)
        }
        return ''
      },

      title: (title) => {
        res.locals.title = this.sanitizeText(title, 100)
        return ''
      },

      meta: (name, content) => {
        if (!res.locals.meta) res.locals.meta = {}
        const safeName = this.sanitizeText(name, 50)
        const safeContent = this.sanitizeText(content, 200)
        if (safeName && safeContent) {
          res.locals.meta[safeName] = safeContent
        }
        return ''
      },
    }
  }

  /**
   * Création asynchrone du layout par défaut avec verrou
   */
  async createDefaultLayoutAsync(layoutName) {
    // FIX: Système de verrou pour éviter les créations concurrentes
    if (this.layoutCreationLock.has(layoutName)) {
      return this.layoutCreationLock.get(layoutName)
    }

    const creationPromise = this._executeLayoutCreation(layoutName)
    this.layoutCreationLock.set(layoutName, creationPromise)

    try {
      await creationPromise
    } finally {
      this.layoutCreationLock.delete(layoutName)
    }
  }

  async _executeLayoutCreation(layoutName) {
    const layoutsDir = path.join(process.cwd(), this.options.layoutsDir)
    await fs.promises.mkdir(layoutsDir, { recursive: true })

    const layoutPath = this.getLayoutPath(layoutName)

    try {
      await fs.promises.access(layoutPath, fs.constants.F_OK)
      return // Existe déjà
    } catch {
      // N'existe pas, on le crée
      const defaultContent = this.generateDefaultLayoutContent()
      await fs.promises.writeFile(layoutPath, defaultContent, 'utf8')
      const relativePath = path.relative(process.cwd(), layoutPath)
      this.app.logger?.log(
        'create',
        'Default layout created',
        `📄 ${relativePath}`
      )
    }
  }

  /**
   * Génération du contenu de layout par défaut optimisé
   */
  generateDefaultLayoutContent() {
    return `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="<%= meta.viewport %>">
    <title><%= meta.title %></title>

    <% if (meta.description) { %>
    <meta name="description" content="<%= meta.description %>">
    <% } %>

    <% if (meta.keywords) { %>
    <meta name="keywords" content="<%= meta.keywords %>">
    <% } %>

    <% if (meta.author) { %>
    <meta name="author" content="<%= meta.author %>">
    <% } %>

    <!-- CSS par défaut avec CSP -->
    <style nonce="<%= locals.nonce || '' %>">
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; margin: 0; padding: 0; line-height: 1.6; color: #333; }
        .container { max-width: 1200px; margin: 0 auto; padding: 1rem; }
        header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 1rem 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        main { min-height: 60vh; padding: 2rem 0; }
        footer { background: #333; color: white; text-align: center; padding: 1rem 0; margin-top: 2rem; }
    </style>

    <% if (locals.css && Array.isArray(locals.css)) { %>
        <% locals.css.forEach(href => { %>
        <link rel="stylesheet" href="<%= href %>" crossorigin="anonymous">
        <% }); %>
    <% } %>

    <% if (sections && sections.head) { %>
    <%- sections.head %>
    <% } %>
</head>
<body class="<%= locals.bodyClass || '' %>">
    <% if (sections && sections.header) { %>
    <header><div class="container"><%- sections.header %></div></header>
    <% } else { %>
    <header><div class="container"><h1>🚀 Vako</h1><p>Ultra modern Node.js framework</p></div></header>
    <% } %>

    <main><div class="container"><%- sections.content || '' %></div></main>

    <% if (sections && sections.footer) { %>
    <footer><div class="container"><%- sections.footer %></div></footer>
    <% } else { %>
    <footer><div class="container"><p>Powered by Vako ⚡</p></div></footer>
    <% } %>

    <% if (locals.js && Array.isArray(locals.js)) { %>
        <% locals.js.forEach(src => { %>
        <script src="<%= src %>" crossorigin="anonymous"></script>
        <% }); %>
    <% } %>

    <% if (sections && sections.scripts) { %>
    <%- sections.scripts %>
    <% } %>
</body>
</html>`
  }

  /**
   * Création de layout avec validation améliorée
   */
  async createLayout(layoutName, content = null) {
    try {
      const sanitizedName = this.sanitizeLayoutName(layoutName)
      const layoutPath = this.getLayoutPath(sanitizedName)
      const layoutsDir = path.dirname(layoutPath)

      await fs.promises.mkdir(layoutsDir, { recursive: true })

      const layoutContent = content || this.generateDefaultLayoutContent()

      if (typeof layoutContent !== 'string' || layoutContent.length > 100000) {
        throw new Error('Invalid layout content')
      }

      await fs.promises.writeFile(layoutPath, layoutContent, 'utf8')

      const relativePath = path.relative(process.cwd(), layoutPath)
      this.app.logger?.log('create', 'Layout created', `📄 ${relativePath}`)

      return this.app
    } catch (error) {
      this.app.logger?.log('error', 'Error creating layout', error.message)
      throw error
    }
  }

  /**
   * Suppression sécurisée de layout
   */
  async deleteLayout(layoutName) {
    try {
      const sanitizedName = this.sanitizeLayoutName(layoutName)
      const layoutPath = this.getLayoutPath(sanitizedName)

      await fs.promises.access(layoutPath, fs.constants.F_OK)
      await fs.promises.unlink(layoutPath)

      this.layoutCache.delete(sanitizedName)

      const relativePath = path.relative(process.cwd(), layoutPath)
      this.app.logger?.log('delete', 'Layout deleted', `📄 ${relativePath}`)

      return this.app
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.app.logger?.log('warning', 'Layout not found', `📄 ${layoutName}`)
      } else {
        this.app.logger?.log('error', 'Error deleting layout', error.message)
        throw error
      }
      return this.app
    }
  }

  /**
   * Liste des layouts avec gestion d'erreur
   */
  async listLayouts() {
    try {
      const layoutsDir = path.join(process.cwd(), this.options.layoutsDir)
      await fs.promises.access(layoutsDir, fs.constants.R_OK)
      const files = await fs.promises.readdir(layoutsDir)

      return files
        .filter((file) =>
          this.securityConfig.allowedExtensions.includes(path.extname(file))
        )
        .map((file) => path.basename(file, this.options.extension))
        .filter((name) => name.length > 0)
    } catch (error) {
      if (error.code === 'ENOENT') return []
      throw error
    }
  }

  /**
   * Rechargement sécurisé des layouts
   */
  reloadLayouts() {
    this.layoutCache.clear()
    this.app.logger?.log(
      'reload',
      'Layout cache cleared',
      '🎨 All layouts refreshed'
    )
    return this.app
  }

  // === Méthodes utilitaires de sécurité ===

  sanitizeSectionName(name) {
    if (typeof name !== 'string') return 'default'
    return name.replace(/[^a-zA-Z0-9\-_]/g, '').substring(0, 50) || 'default'
  }

  sanitizeSectionContent(content) {
    if (typeof content !== 'string') return ''
    return content.substring(0, this.securityConfig.maxSectionSize)
  }

  sanitizeResourceUrl(url) {
    if (typeof url !== 'string') return null
    if (url.length > 200 || url.includes('<') || url.includes('>')) return null
    if (
      url.startsWith('/') ||
      url.startsWith('https://') ||
      url.startsWith('./')
    )
      return url
    return null
  }

  sanitizeText(text, maxLength = 100) {
    if (typeof text !== 'string') return ''
    return text.replace(/[<>]/g, '').substring(0, maxLength)
  }

  sanitizeQueryParams(query) {
    if (!query || typeof query !== 'object') return {}
    const sanitized = {}
    for (const [key, value] of Object.entries(query)) {
      if (typeof key === 'string' && key.length <= 50) {
        const cleanKey = key.replace(/[^a-zA-Z0-9\-_]/g, '')
        if (typeof value === 'string' && value.length <= 200) {
          sanitized[cleanKey] = value
        }
      }
    }
    return sanitized
  }

  sanitizeParams(params) {
    return this.sanitizeQueryParams(params)
  }

  mergeOptionsSecurely(baseData, options) {
    const allowedFields = [
      'title',
      'description',
      'keywords',
      'bodyClass',
      'css',
      'js',
    ]
    const merged = { ...baseData }

    allowedFields.forEach((field) => {
      if (options[field] !== undefined) {
        if (field === 'css' || field === 'js') {
          if (Array.isArray(options[field])) {
            merged.layout = merged.layout || {}
            merged.layout[field] = options[field].slice(0, 10)
          }
        } else if (typeof options[field] === 'string') {
          merged.meta = merged.meta || {}
          merged.meta[field] = this.sanitizeText(options[field], 200)
        }
      }
    })

    return merged
  }

  sanitizeLayoutOptions(layoutOptions) {
    if (!layoutOptions || typeof layoutOptions !== 'object') {
      return { css: [], js: [], bodyClass: '' }
    }
    return {
      css: Array.isArray(layoutOptions.css)
        ? layoutOptions.css.slice(0, 10)
        : [],
      js: Array.isArray(layoutOptions.js) ? layoutOptions.js.slice(0, 10) : [],
      bodyClass:
        typeof layoutOptions.bodyClass === 'string'
          ? this.sanitizeText(layoutOptions.bodyClass, 100)
          : '',
    }
  }

  sanitizeViewName(view) {
    if (typeof view !== 'string') return 'index'
    return view.replace(/[^a-zA-Z0-9\-_\/]/g, '').substring(0, 100) || 'index'
  }

  handleRenderError(error, res, view, options, originalRender, callback) {
    this.app.logger?.log('error', 'Layout render error', {
      error: error.message,
      view,
      stack: error.stack,
    })

    try {
      originalRender.call(res, view, options, callback)
    } catch (fallbackError) {
      if (res.headersSent) return
      res.status(500)
      if (typeof callback === 'function') {
        callback(fallbackError)
      } else {
        res.send('Internal Server Error')
      }
    }
  }

  initCacheCleanup() {
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupCache()
      },
      30 * 60 * 1000
    ).unref() // .unref() pour ne pas bloquer la fermeture du process

    process.nextTick(() => this.cleanupCache())
  }

  cleanupCache() {
    try {
      if (this.layoutCache.size > this.securityConfig.maxCacheSize) {
        this.layoutCache.clear()
        this.app.logger?.log(
          'maintenance',
          'Layout cache cleared',
          'Size limit exceeded'
        )
      }
    } catch (error) {
      this.app.logger?.log('error', 'Cache cleanup error', error.message)
    }
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.layoutCache.clear()
  }
}

module.exports = LayoutManager

const path = require('path')
const fs = require('fs')
const crypto = require('crypto')

class AuthManager {
  constructor(app) {
    this.app = app
    this.config = {
      database: {
        type: 'sqlite',
        sqlite: { path: './data/auth.db' },
        mysql: {
          host: 'localhost',
          port: 3306,
          database: 'vako_auth',
          username: 'root',
          password: '',
        },
      },
      session: {
        secret: this.generateSecretKey(),
        maxAge: 24 * 60 * 60 * 1000,
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'strict',
      },
      security: {
        maxLoginAttempts: 5,
        lockoutDuration: 15 * 60 * 1000,
        sessionRotation: true,
        csrfProtection: true,
        rateLimit: { windowMs: 15 * 60 * 1000, max: 10 },
      },
      routes: {
        api: {
          login: '/api/auth/login',
          logout: '/api/auth/logout',
          register: '/api/auth/register',
          check: '/api/auth/check',
          profile: '/api/auth/profile',
        },
        web: {
          enabled: true,
          login: '/auth/login',
          logout: '/auth/logout',
          register: '/auth/register',
          dashboard: '/auth/dashboard',
        },
      },
      redirects: {
        afterLogin: '/auth/dashboard',
        afterLogout: '/auth/login',
        loginRequired: '/auth/login',
      },
      password: {
        minLength: 8,
        requireSpecial: true,
        requireNumbers: true,
        requireUppercase: true,
        requireLowercase: true,
      },
      views: { enabled: true, autoCreate: true },
    }
    this.db = null
    this.isEnabled = false
  }

  generateSecretKey() {
    return crypto.randomBytes(64).toString('hex')
  }

  validateInput(data, schema) {
    const errors = []
    for (const [field, rules] of Object.entries(schema)) {
      const value = data[field]
      if (rules.required && (!value || value.toString().trim() === '')) {
        errors.push(`Le champ ${field} est requis`)
        continue
      }
      if (value) {
        if (rules.type && typeof value !== rules.type) {
          errors.push(`Le champ ${field} doit être de type ${rules.type}`)
          continue
        }
        if (rules.minLength && value.length < rules.minLength) {
          errors.push(
            `Le champ ${field} doit contenir au moins ${rules.minLength} caractères`
          )
        }
        if (rules.maxLength && value.length > rules.maxLength) {
          errors.push(
            `Le champ ${field} ne peut pas dépasser ${rules.maxLength} caractères`
          )
        }
        if (rules.pattern && !rules.pattern.test(value)) {
          errors.push(`Le format du champ ${field} est invalide`)
        }
        if (rules.custom && !rules.custom(value)) {
          errors.push(rules.customMessage || `Le champ ${field} est invalide`)
        }
      }
    }
    return { isValid: errors.length === 0, errors }
  }

  // FIX: Unique sanitizeInput method with HTML escaping
  sanitizeInput(input) {
    if (typeof input !== 'string') return ''
    return input
      .trim()
      .replace(/[<>"'&]/g, (match) => {
        const entities = {
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#x27;',
          '&': '&amp;',
        }
        return entities[match]
      })
      .slice(0, 1000)
  }

  generateCSRFToken() {
    return crypto.randomBytes(32).toString('hex')
  }

  // FIX: Safe CSRF validation against RangeError
  validateCSRFToken(req) {
    const token = req.body._csrf || req.headers['x-csrf-token']
    const sessionToken = req.session.csrfToken

    if (
      !token ||
      !sessionToken ||
      typeof token !== 'string' ||
      typeof sessionToken !== 'string'
    ) {
      return false
    }
    if (token.length !== sessionToken.length) return false

    try {
      return crypto.timingSafeEqual(
        Buffer.from(token),
        Buffer.from(sessionToken)
      )
    } catch (e) {
      return false
    }
  }

  async init(config = {}) {
    try {
      this.config = this.mergeConfig(this.config, config)
      this.validateConfig()

      await this.installDependencies()
      await this.initDatabase()
      this.setupSessions()
      this.setupSecurity()
      this.setupApiRoutes()

      if (this.config.routes.web.enabled) {
        this.setupWebRoutes()
      }

      // FIX: Removed call to non-existent setupMiddlewares()
      if (this.config.views.enabled && this.config.views.autoCreate) {
        this.setupViews() // FIX: Implemented this method
      }

      this.isEnabled = true
      this.logSystemInfo()
    } catch (error) {
      console.error(
        "❌ Erreur lors de l'initialisation de l'authentification:",
        error.message
      )
      throw error
    }
  }

  validateConfig() {
    if (this.config.password.minLength < 8) {
      throw new Error(
        "La longueur minimale du mot de passe doit être d'au moins 8 caractères"
      )
    }
    if (!this.config.session.secret || this.config.session.secret.length < 32) {
      this.config.session.secret = this.generateSecretKey()
    }
  }

  mergeConfig(defaultConfig, userConfig) {
    const result = { ...defaultConfig }
    for (const key in userConfig) {
      if (
        typeof userConfig[key] === 'object' &&
        !Array.isArray(userConfig[key])
      ) {
        result[key] = this.mergeConfig(
          defaultConfig[key] || {},
          userConfig[key]
        )
      } else {
        result[key] = userConfig[key]
      }
    }
    return result
  }

  async installDependencies() {
    const requiredModules = {
      'express-session': '^1.17.3',
      bcryptjs: '^2.4.3',
      'express-rate-limit': '^6.7.0',
      helmet: '^6.1.5',
    }
    if (this.config.database.type === 'mysql')
      requiredModules['mysql2'] = '^3.6.0'
    else if (this.config.database.type === 'sqlite')
      requiredModules['sqlite3'] = '^5.1.6'

    for (const [moduleName, version] of Object.entries(requiredModules)) {
      try {
        require.resolve(moduleName)
      } catch (error) {
        console.log(`📦 Installation de ${moduleName}...`)
        await this.app.installModule(moduleName, version)
      }
    }
  }

  async initDatabase() {
    if (this.config.database.type === 'mysql') await this.initMySQL()
    else if (this.config.database.type === 'sqlite') await this.initSQLite()
    else
      throw new Error(
        `Type de base de données non supporté: ${this.config.database.type}`
      )

    await this.createTables()
  }

  async initMySQL() {
    const mysql = require('mysql2/promise')
    const config = this.config.database.mysql
    this.db = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.username,
      password: config.password,
      database: config.database,
    })
    console.log('✅ Connexion MySQL établie')
  }

  async initSQLite() {
    const sqlite3 = require('sqlite3').verbose()
    const dbPath = path.resolve(this.config.database.sqlite.path)
    const dbDir = path.dirname(dbPath)
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true })
    this.db = new sqlite3.Database(dbPath)
    console.log(`✅ Base SQLite créée: ${dbPath}`)
  }

  async createTables() {
    const isMysql = this.config.database.type === 'mysql'
    const usersTable = isMysql
      ? `
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY, username VARCHAR(255) UNIQUE NOT NULL, email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL, role VARCHAR(50) DEFAULT 'user', login_attempts INT DEFAULT 0,
        locked_until TIMESTAMP NULL, last_login TIMESTAMP NULL, password_changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_username (username), INDEX idx_email (email)
      )`
      : `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL, role TEXT DEFAULT 'user', login_attempts INTEGER DEFAULT 0,
        locked_until DATETIME NULL, last_login DATETIME NULL, password_changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`

    const sessionsTable = isMysql
      ? `
      CREATE TABLE IF NOT EXISTS sessions (
        session_id VARCHAR(128) PRIMARY KEY, expires TIMESTAMP NOT NULL, data TEXT, INDEX idx_expires (expires)
      )`
      : `
      CREATE TABLE IF NOT EXISTS sessions (session_id TEXT PRIMARY KEY, expires DATETIME NOT NULL, data TEXT)
    `

    if (isMysql) {
      await this.db.execute(usersTable)
      await this.db.execute(sessionsTable)
    } else {
      await new Promise((resolve, reject) =>
        this.db.run(usersTable, (err) => (err ? reject(err) : resolve()))
      )
      await new Promise((resolve, reject) =>
        this.db.run(sessionsTable, (err) => (err ? reject(err) : resolve()))
      )
    }
    console.log('✅ Tables de base de données créées')
  }

  setupSessions() {
    const session = require('express-session')
    this.app.use(
      session({
        secret: this.config.session.secret,
        resave: false,
        saveUninitialized: false,
        name: 'vako.sid',
        cookie: {
          maxAge: this.config.session.maxAge,
          secure: this.config.session.secure,
          httpOnly: this.config.session.httpOnly,
          sameSite: this.config.session.sameSite,
        },
        genid: () => crypto.randomUUID(),
      })
    )
    console.log('✅ Sessions configurées avec sécurité renforcée')
  }

  setupSecurity() {
    const helmet = require('helmet')
    const rateLimit = require('express-rate-limit')

    this.app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:'],
          },
        },
      })
    )

    const authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 5,
      skipSuccessfulRequests: true,
      message: {
        success: false,
        message:
          'Trop de tentatives de connexion, compte temporairement bloqué',
      },
    })

    this.app.use('/api/auth', authLimiter)
    this.app.use('/auth', authLimiter)
    console.log('✅ Sécurité renforcée configurée')
  }

  setupApiRoutes() {
    const csrfMiddleware = (req, res, next) => {
      if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
        if (!this.validateCSRFToken(req)) {
          return res
            .status(403)
            .json({ success: false, message: 'Token CSRF invalide' })
        }
      }
      next()
    }

    const loginSchema = {
      username: {
        required: true,
        type: 'string',
        minLength: 3,
        maxLength: 50,
        pattern: /^[a-zA-Z0-9._@-]+$/,
      },
      password: {
        required: true,
        type: 'string',
        minLength: 1,
        maxLength: 128,
      },
    }

    // FIX: Pass middlewares and handlers as an array to createRoute
    this.app.createRoute(
      'post',
      this.config.routes.api.login,
      async (req, res) => {
        try {
          const validation = this.validateInput(req.body, loginSchema)
          if (!validation.isValid)
            return res
              .status(400)
              .json({
                success: false,
                message: validation.errors[0],
                errors: validation.errors,
              })

          const { username, password } = req.body
          const cleanUsername = this.sanitizeInput(username)

          const user = await this.authenticateUser(
            cleanUsername,
            password,
            req.ip
          )
          if (user) {
            await this.resetLoginAttempts(user.id)
            if (this.config.security.sessionRotation)
              await this.regenerateSession(req)

            req.session.csrfToken = this.generateCSRFToken()
            req.session.user = {
              id: user.id,
              username: user.username,
              email: user.email,
              role: user.role,
            }
            await this.updateLastLogin(user.id)

            res.json({
              success: true,
              message: 'Connexion réussie',
              user: req.session.user,
              csrfToken: req.session.csrfToken,
            })
          } else {
            res
              .status(401)
              .json({ success: false, message: 'Identifiants incorrects' })
          }
        } catch (error) {
          console.error('Erreur lors de la connexion:', error.message)
          res.status(500).json({ success: false, message: 'Erreur serveur' })
        }
      }
    )

    const registerSchema = {
      username: {
        required: true,
        type: 'string',
        minLength: 3,
        maxLength: 50,
        pattern: /^[a-zA-Z0-9._-]+$/,
      },
      email: {
        required: true,
        type: 'string',
        maxLength: 254,
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      },
      password: {
        required: true,
        type: 'string',
        minLength: this.config.password.minLength,
        maxLength: 128,
        custom: (value) => this.validatePassword(value).isValid,
      },
      confirmPassword: { required: true, type: 'string' },
    }

    this.app.createRoute(
      'post',
      this.config.routes.api.register,
      async (req, res) => {
        try {
          const validation = this.validateInput(req.body, registerSchema)
          if (!validation.isValid)
            return res
              .status(400)
              .json({
                success: false,
                message: validation.errors[0],
                errors: validation.errors,
              })

          const { username, email, password, confirmPassword } = req.body
          if (password !== confirmPassword)
            return res
              .status(400)
              .json({
                success: false,
                message: 'Les mots de passe ne correspondent pas',
              })

          const cleanUsername = this.sanitizeInput(username)
          const cleanEmail = this.sanitizeInput(email)
          const user = await this.createUser(
            cleanUsername,
            cleanEmail,
            password
          )

          if (this.config.security.sessionRotation)
            await this.regenerateSession(req)
          req.session.csrfToken = this.generateCSRFToken()
          req.session.user = {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
          }

          res.json({
            success: true,
            message: 'Inscription réussie',
            user: req.session.user,
            csrfToken: req.session.csrfToken,
          })
        } catch (error) {
          if (
            error.message.includes('UNIQUE constraint') ||
            error.code === 'ER_DUP_ENTRY'
          ) {
            res
              .status(409)
              .json({ success: false, message: 'Cet utilisateur existe déjà' })
          } else {
            console.error("Erreur lors de l'inscription:", error.message)
            res.status(500).json({ success: false, message: 'Erreur serveur' })
          }
        }
      }
    )

    this.app.createRoute('post', this.config.routes.api.logout, [
      csrfMiddleware,
      (req, res) => {
        if (!req.session.user)
          return res
            .status(401)
            .json({ success: false, message: 'Non authentifié' })
        req.session.destroy((err) => {
          if (err)
            res
              .status(500)
              .json({
                success: false,
                message: 'Erreur lors de la déconnexion',
              })
          else res.json({ success: true, message: 'Déconnexion réussie' })
        })
      },
    ])

    this.app.createRoute('get', this.config.routes.api.check, (req, res) => {
      if (
        req.session &&
        req.session.user &&
        this.isValidSessionUser(req.session.user)
      ) {
        res.json({
          authenticated: true,
          user: req.session.user,
          csrfToken: req.session.csrfToken,
        })
      } else {
        if (req.session) req.session.destroy()
        res.json({ authenticated: false, user: null })
      }
    })

    this.app.createRoute('get', this.config.routes.api.profile, [
      this.requireAuth.bind(this),
      (req, res) => {
        res.json({ success: true, user: req.session.user })
      },
    ])

    this.app.createRoute('put', this.config.routes.api.profile, [
      this.requireAuth.bind(this),
      csrfMiddleware,
      async (req, res) => {
        try {
          const profileUpdateSchema = {
            email: {
              required: false,
              type: 'string',
              maxLength: 254,
              pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            },
          }
          const validation = this.validateInput(req.body, profileUpdateSchema)
          if (!validation.isValid)
            return res
              .status(400)
              .json({
                success: false,
                message: validation.errors[0],
                errors: validation.errors,
              })

          const { email } = req.body
          if (email) {
            const cleanEmail = this.sanitizeInput(email)
            await this.updateUser(req.session.user.id, { email: cleanEmail })
            req.session.user.email = cleanEmail
          }
          res.json({
            success: true,
            message: 'Profil mis à jour',
            user: req.session.user,
          })
        } catch (error) {
          console.error('Erreur lors de la mise à jour:', error.message)
          res
            .status(500)
            .json({ success: false, message: 'Erreur lors de la mise à jour' })
        }
      },
    ])

    console.log("✅ Routes API d'authentification sécurisées configurées")
  }

  setupWebRoutes() {
    const webLoginSchema = {
      username: { required: true, type: 'string', minLength: 3, maxLength: 50 },
      password: {
        required: true,
        type: 'string',
        minLength: 1,
        maxLength: 128,
      },
    }

    this.app.createRoute(
      'get',
      this.config.routes.web.login,
      async (req, res) => {
        if (req.session.user)
          return res.redirect(this.config.redirects.afterLogin)
        if (!req.session.csrfToken)
          req.session.csrfToken = this.generateCSRFToken()
        res.render('auth/login', {
          title: 'Connexion',
          error: req.query.error,
          csrfToken: req.session.csrfToken,
          layout: false,
        })
      }
    )

    this.app.createRoute(
      'post',
      this.config.routes.web.login,
      async (req, res) => {
        try {
          if (!this.validateCSRFToken(req))
            return res.redirect(
              `${this.config.routes.web.login}?error=csrf_invalid`
            )
          const validation = this.validateInput(req.body, webLoginSchema)
          if (!validation.isValid)
            return res.redirect(
              `${this.config.routes.web.login}?error=invalid_input`
            )

          const { username, password } = req.body
          const cleanUsername = this.sanitizeInput(username)
          const user = await this.authenticateUser(cleanUsername, password)

          if (user) {
            await this.resetLoginAttempts(user.id)
            if (this.config.security.sessionRotation)
              await this.regenerateSession(req)
            req.session.user = {
              id: user.id,
              username: user.username,
              email: user.email,
              role: user.role,
            }
            await this.updateLastLogin(user.id)
            res.redirect(this.config.redirects.afterLogin)
          } else {
            res.redirect(
              `${this.config.routes.web.login}?error=invalid_credentials`
            )
          }
        } catch (error) {
          console.error('Erreur lors de la connexion:', error.message)
          res.redirect(`${this.config.routes.web.login}?error=server_error`)
        }
      }
    )

    this.app.createRoute(
      'get',
      this.config.routes.web.register,
      async (req, res) => {
        if (req.session.user)
          return res.redirect(this.config.redirects.afterLogin)
        if (!req.session.csrfToken)
          req.session.csrfToken = this.generateCSRFToken()
        res.render('auth/register', {
          title: 'Inscription',
          error: req.query.error,
          csrfToken: req.session.csrfToken,
          layout: false,
        })
      }
    )

    const webRegisterSchema = {
      username: { required: true, type: 'string', minLength: 3, maxLength: 50 },
      email: {
        required: true,
        type: 'string',
        maxLength: 254,
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      },
      password: {
        required: true,
        type: 'string',
        minLength: this.config.password.minLength,
        maxLength: 128,
      },
      confirmPassword: { required: true, type: 'string' },
    }

    this.app.createRoute(
      'post',
      this.config.routes.web.register,
      async (req, res) => {
        try {
          if (!this.validateCSRFToken(req))
            return res.redirect(
              `${this.config.routes.web.register}?error=csrf_invalid`
            )
          const validation = this.validateInput(req.body, webRegisterSchema)
          if (!validation.isValid)
            return res.redirect(
              `${this.config.routes.web.register}?error=invalid_input`
            )

          const { username, email, password, confirmPassword } = req.body
          if (password !== confirmPassword)
            return res.redirect(
              `${this.config.routes.web.register}?error=password_mismatch`
            )

          const passwordValidation = this.validatePassword(password)
          if (!passwordValidation.isValid)
            return res.redirect(
              `${this.config.routes.web.register}?error=password_weak`
            )

          const cleanUsername = this.sanitizeInput(username)
          const cleanEmail = this.sanitizeInput(email)
          const user = await this.createUser(
            cleanUsername,
            cleanEmail,
            password
          )

          if (this.config.security.sessionRotation)
            await this.regenerateSession(req)
          req.session.user = {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
          }
          res.redirect(this.config.redirects.afterLogin)
        } catch (error) {
          if (
            error.message.includes('UNIQUE constraint') ||
            error.code === 'ER_DUP_ENTRY'
          ) {
            res.redirect(`${this.config.routes.web.register}?error=user_exists`)
          } else {
            console.error("Erreur lors de l'inscription:", error.message)
            res.redirect(
              `${this.config.routes.web.register}?error=server_error`
            )
          }
        }
      }
    )

    this.app.createRoute('get', this.config.routes.web.logout, (req, res) => {
      if (req.session) {
        req.session.destroy((err) => {
          if (err) console.error('Erreur lors de la déconnexion:', err)
          res.redirect(this.config.redirects.afterLogout)
        })
      } else {
        res.redirect(this.config.redirects.afterLogout)
      }
    })

    this.app.createRoute('get', this.config.routes.web.dashboard, [
      this.requireAuth.bind(this),
      (req, res) => {
        res.render('auth/dashboard', {
          title: 'Dashboard',
          user: req.session.user,
          layout: false,
        })
      },
    ])

    console.log("✅ Routes web EJS d'authentification sécurisées configurées")
  }

  // FIX: Implemented missing setupViews method
  setupViews() {
    const viewsDir = path.join(process.cwd(), 'views', 'auth')
    if (!fs.existsSync(viewsDir)) {
      fs.mkdirSync(viewsDir, { recursive: true })
    }

    const loginView = path.join(viewsDir, 'login.ejs')
    if (!fs.existsSync(loginView)) {
      fs.writeFileSync(
        loginView,
        `<form action="/auth/login" method="POST">\n<input type="hidden" name="_csrf" value="<%= csrfToken %>">\n<input type="text" name="username" placeholder="Username" required>\n<input type="password" name="password" placeholder="Password" required>\n<button type="submit">Login</button>\n</form>`
      )
    }

    const registerView = path.join(viewsDir, 'register.ejs')
    if (!fs.existsSync(registerView)) {
      fs.writeFileSync(
        registerView,
        `<form action="/auth/register" method="POST">\n<input type="hidden" name="_csrf" value="<%= csrfToken %>">\n<input type="text" name="username" placeholder="Username" required>\n<input type="email" name="email" placeholder="Email" required>\n<input type="password" name="password" placeholder="Password" required>\n<input type="password" name="confirmPassword" placeholder="Confirm Password" required>\n<button type="submit">Register</button>\n</form>`
      )
    }

    const dashboardView = path.join(viewsDir, 'dashboard.ejs')
    if (!fs.existsSync(dashboardView)) {
      fs.writeFileSync(
        dashboardView,
        `<h1>Welcome, <%= user.username %>!</h1>\n<a href="/auth/logout">Logout</a>`
      )
    }
  }

  isValidSessionUser(user) {
    return (
      user &&
      typeof user.id === 'number' &&
      typeof user.username === 'string' &&
      typeof user.email === 'string' &&
      typeof user.role === 'string' &&
      user.username.length > 0 &&
      user.email.includes('@')
    )
  }

  async authenticateUser(username, password) {
    const bcrypt = require('bcryptjs')
    if (!username || !password) return null

    const query =
      this.config.database.type === 'mysql'
        ? 'SELECT * FROM users WHERE (username = ? OR email = ?) AND (locked_until IS NULL OR locked_until < NOW())'
        : 'SELECT * FROM users WHERE (username = ? OR email = ?) AND (locked_until IS NULL OR locked_until < datetime("now"))'

    let user
    try {
      if (this.config.database.type === 'mysql') {
        const [rows] = await this.db.execute(query, [username, username])
        user = rows[0]
      } else {
        user = await new Promise((resolve, reject) => {
          this.db.get(query, [username, username], (err, row) =>
            err ? reject(err) : resolve(row)
          )
        })
      }

      if (!user) return null
      if (user.login_attempts >= this.config.security.maxLoginAttempts) {
        await this.lockAccount(user.id)
        return null
      }

      const isValidPassword = await bcrypt.compare(password, user.password)
      if (!isValidPassword) {
        await this.incrementLoginAttempts(user.id)
        return null
      }
      return user
    } catch (error) {
      console.error("Erreur lors de l'authentification:", error.message)
      return null
    }
  }

  async createUser(username, email, password) {
    const bcrypt = require('bcryptjs')
    const passwordValidation = this.validatePassword(password)
    if (!passwordValidation.isValid)
      throw new Error(passwordValidation.errors[0])

    const hashedPassword = await bcrypt.hash(password, 12)
    const query =
      this.config.database.type === 'mysql'
        ? 'INSERT INTO users (username, email, password, password_changed_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)'
        : 'INSERT INTO users (username, email, password, password_changed_at) VALUES (?, ?, ?, datetime("now"))'

    if (this.config.database.type === 'mysql') {
      const [result] = await this.db.execute(query, [
        username,
        email,
        hashedPassword,
      ])
      return { id: result.insertId, username, email, role: 'user' }
    } else {
      return new Promise((resolve, reject) => {
        this.db.run(query, [username, email, hashedPassword], function (err) {
          if (err) reject(err)
          else resolve({ id: this.lastID, username, email, role: 'user' })
        })
      })
    }
  }

  requireAuth(req, res, next) {
    if (
      !req.session ||
      !req.session.user ||
      !this.isValidSessionUser(req.session.user)
    ) {
      if (req.xhr || req.headers.accept.indexOf('json') > -1) {
        return res
          .status(401)
          .json({ success: false, message: 'Authentification requise' })
      }
      return res.redirect(this.config.redirects.loginRequired)
    }
    next()
  }

  requireRole(role) {
    return (req, res, next) => {
      if (!req.session.user)
        return res.redirect(this.config.redirects.loginRequired)
      if (req.session.user.role !== role && req.session.user.role !== 'admin') {
        return res.status(403).send('Accès refusé - Permissions insuffisantes')
      }
      next()
    }
  }

  async destroy() {
    if (this.db) {
      if (this.config.database.type === 'mysql') await this.db.end()
      else this.db.close()
    }
    this.isEnabled = false
    console.log("🔐 Système d'authentification fermé")
  }

  async updateUser(userId, updates) {
    const allowedFields = ['email']
    const setClause = []
    const values = []
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        setClause.push(`${key} = ?`)
        values.push(value)
      }
    }
    if (setClause.length === 0)
      throw new Error('Aucun champ valide à mettre à jour')

    values.push(userId)
    const query = `UPDATE users SET ${setClause.join(', ')} WHERE id = ?`

    if (this.config.database.type === 'mysql') {
      await this.db.execute(query, values)
    } else {
      await new Promise((resolve, reject) => {
        this.db.run(query, values, (err) => (err ? reject(err) : resolve()))
      })
    }
  }

  validatePassword(password) {
    const config = this.config.password
    const errors = []
    if (password.length < config.minLength)
      errors.push(
        `Le mot de passe doit contenir au moins ${config.minLength} caractères`
      )
    if (config.requireUppercase && !/[A-Z]/.test(password))
      errors.push('Le mot de passe doit contenir au moins une majuscule')
    if (config.requireLowercase && !/[a-z]/.test(password))
      errors.push('Le mot de passe doit contenir au moins une minuscule')
    if (config.requireNumbers && !/\d/.test(password))
      errors.push('Le mot de passe doit contenir au moins un chiffre')
    if (config.requireSpecial && !/[!@#$%^&*(),.?":{}|<>]/.test(password))
      errors.push('Le mot de passe doit contenir au moins un caractère spécial')
    return { isValid: errors.length === 0, errors }
  }

  // FIX: Removed custom isRateLimited and recordFailedAttempt to prevent memory leaks.
  // express-rate-limit handles this globally in setupSecurity().

  async regenerateSession(req) {
    return new Promise((resolve, reject) => {
      req.session.regenerate((err) => (err ? reject(err) : resolve()))
    })
  }

  async resetLoginAttempts(userId) {
    const query =
      'UPDATE users SET login_attempts = 0, locked_until = NULL WHERE id = ?'
    if (this.config.database.type === 'mysql')
      await this.db.execute(query, [userId])
    else
      await new Promise((resolve, reject) =>
        this.db.run(query, [userId], (err) => (err ? reject(err) : resolve()))
      )
  }

  async updateLastLogin(userId) {
    const query = 'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?'
    if (this.config.database.type === 'mysql')
      await this.db.execute(query, [userId])
    else
      await new Promise((resolve, reject) =>
        this.db.run(query, [userId], (err) => (err ? reject(err) : resolve()))
      )
  }

  async incrementLoginAttempts(userId) {
    const query =
      'UPDATE users SET login_attempts = login_attempts + 1 WHERE id = ?'
    if (this.config.database.type === 'mysql')
      await this.db.execute(query, [userId])
    else
      await new Promise((resolve, reject) =>
        this.db.run(query, [userId], (err) => (err ? reject(err) : resolve()))
      )
  }

  async lockAccount(userId) {
    const lockUntil = new Date(
      Date.now() + this.config.security.lockoutDuration
    )
    const query = 'UPDATE users SET locked_until = ? WHERE id = ?'
    if (this.config.database.type === 'mysql')
      await this.db.execute(query, [lockUntil, userId])
    else
      await new Promise((resolve, reject) =>
        this.db.run(query, [lockUntil.toISOString(), userId], (err) =>
          err ? reject(err) : resolve()
        )
      )
  }

  logSystemInfo() {
    console.log(
      "✅ Système d'authentification initialisé avec sécurité renforcée"
    )
    console.log(`📊 Base de données: ${this.config.database.type}`)
    console.log(
      `🌐 Routes web EJS: ${this.config.routes.web.enabled ? 'Activées' : 'Désactivées'}`
    )
    console.log(
      `🔒 Sécurité: Rate limiting, Protection CSRF, Headers sécurisés`
    )
  }
}

module.exports = AuthManager

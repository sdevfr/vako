// Fichier de l'auto-updater qui va vérifier si c'est la bonne version de vako
const fs = require('fs')
const path = require('path')
const https = require('https')
const crypto = require('crypto')
const os = require('os')
const { execFile, spawn } = require('child_process')
const { promisify } = require('util')
const chalk = require('chalk')

const execFileAsync = promisify(execFile)

class AutoUpdater {
  constructor(options = {}) {
    this.packageJsonPath = path.join(process.cwd(), 'package.json')
    this.backupDir = path.join(process.cwd(), '.vako-backups')
    this.configPath = path.join(process.cwd(), '.vako-updater.json')
    this.logPath = path.join(process.cwd(), '.vako-updater.log')

    this.currentVersion = null
    this.latestVersion = null
    this.checkInterval = null // FIX: Stocker l'intervalle pour pouvoir l'arrêter

    // 🔧 Configuration par défaut
    this.defaultConfig = {
      autoCheck: true,
      autoUpdate: false,
      checkInterval: 3600000, // 1 heure
      backupCount: 5,
      allowPrerelease: false,
      allowBeta: false,
      securityCheck: true,
      progressBar: true,
      notifications: true,
      rollbackOnFailure: true,
      updateChannel: 'stable', // stable, beta, alpha
      customRegistry: null,
      excludeFiles: ['.git', 'node_modules', '.vako-backups'],
      skipDependencies: false,
    }

    this.config = { ...this.defaultConfig, ...options }

    this.stats = {
      totalUpdates: 0,
      lastUpdate: null,
      lastCheck: null,
      rollbacks: 0,
    }

    // 🎨 Styles visuels
    this.styles = {
      title: chalk.bold.cyan,
      success: chalk.bold.green,
      error: chalk.bold.red,
      warning: chalk.bold.yellow,
      info: chalk.bold.blue,
      dim: chalk.dim.gray,
      highlight: chalk.bold.white,
      accent: chalk.magenta,
      progress: chalk.green.bold,
      version: chalk.cyan.bold,
      menu: chalk.yellow.bold,
      separator: chalk.dim('─'.repeat(60)),
    }
  }

  // 🚀 Initialisation robuste
  async init() {
    try {
      await this.loadConfig()
      await this.loadStats()
      await this.createDirectories()

      if (this.config.autoCheck) {
        this.scheduleAutoCheck()
      }

      return true
    } catch (error) {
      console.error(`[Auto-updater] Erreur d'initialisation: ${error.message}`)
      return false
    }
  }

  // 📁 Création des répertoires (Asynchrone)
  async createDirectories() {
    try {
      await fs.promises.mkdir(this.backupDir, { recursive: true })
    } catch (error) {
      console.warn(
        `[Auto-updater] Impossible de créer les répertoires: ${error.message}`
      )
    }
  }

  // ⚙️ Chargement de la configuration
  async loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = await fs.promises.readFile(this.configPath, 'utf8')
        this.config = { ...this.defaultConfig, ...JSON.parse(configData) }
      } else {
        await this.saveConfig()
      }
    } catch (error) {
      console.warn(`[Auto-updater] Erreur de configuration: ${error.message}`)
      this.config = { ...this.defaultConfig }
    }
  }

  // 💾 Sauvegarde de la configuration
  async saveConfig() {
    try {
      await fs.promises.writeFile(
        this.configPath,
        JSON.stringify(this.config, null, 2)
      )
    } catch (error) {
      console.warn(
        `[Auto-updater] Impossible de sauvegarder la configuration: ${error.message}`
      )
    }
  }

  // 📊 Chargement des statistiques
  async loadStats() {
    try {
      if (fs.existsSync(this.packageJsonPath)) {
        const pkgData = await fs.promises.readFile(this.packageJsonPath, 'utf8')
        const packageJson = JSON.parse(pkgData)
        if (packageJson.vakoUpdaterStats) {
          this.stats = { ...this.stats, ...packageJson.vakoUpdaterStats }
        }
      }
    } catch (error) {
      console.warn(
        `[Auto-updater] Impossible de charger les statistiques: ${error.message}`
      )
    }
  }

  // 🔄 Programmation de la vérification automatique sécurisée
  scheduleAutoCheck() {
    if (this.checkInterval) clearInterval(this.checkInterval)

    this.checkInterval = setInterval(async () => {
      try {
        await this.checkForUpdates(true)
      } catch (error) {
        // FIX: Capturer l'erreur au lieu de la laisser devenir une UnhandledPromiseRejection
        this.log(
          'error',
          `Erreur de vérification automatique: ${error.message}`
        )
      }
    }, this.config.checkInterval)

    // Permettre au process de se fermer même si l'intervalle tourne
    if (this.checkInterval.unref) this.checkInterval.unref()
  }

  // 📊 Barre de progression
  showProgress(current, total, message = '') {
    if (!this.config.progressBar) return
    const percentage = Math.round((current / total) * 100)
    const barLength = 40
    const filledLength = Math.round((barLength * percentage) / 100)
    const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength)
    process.stdout.write(
      `\r${this.styles.progress(bar)} ${percentage}% ${message}`
    )
    if (current === total) console.log('')
  }

  // 🎯 Animation de chargement
  loadingAnimation(message) {
    if (!process.stdout.isTTY) return { stop: () => {} }
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
    let i = 0
    const loader = setInterval(() => {
      process.stdout.write(
        `\r${this.styles.info(frames[i++ % frames.length])} ${message}`
      )
    }, 80)

    return {
      stop: (finalMessage = '') => {
        clearInterval(loader) // FIX: Toujours clearer l'intervalle
        process.stdout.write(`\r${' '.repeat(message.length + 10)}\r`)
        if (finalMessage) console.log(finalMessage)
      },
    }
  }

  // 🔍 Vérification de mise à jour
  async checkForUpdates(silent = false) {
    const animation = !silent
      ? this.loadingAnimation('Vérification des mises à jour...')
      : { stop: () => {} }

    try {
      this.stats.lastCheck = new Date().toISOString()
      const currentVersion = this.getCurrentVersion()

      if (!currentVersion) {
        animation.stop(
          !silent ? this.styles.warning("⚠️ Vako n'est pas installé.") : ''
        )
        return { hasUpdate: false, needsInstall: true }
      }

      const versionInfoPromise = Promise.race([
        this.getVersionInfo(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 5000)
        ),
      ])

      const versionInfo = await versionInfoPromise
      const comparison = this.compareVersions(
        currentVersion,
        versionInfo.latest
      )

      if (comparison < 0) {
        animation.stop(
          !silent
            ? this.styles.warning(
                `⚠️ Nouvelle version! ${currentVersion} → ${versionInfo.latest}`
              )
            : ''
        )
        return {
          hasUpdate: true,
          currentVersion,
          latestVersion: versionInfo.latest,
          changelog: versionInfo.changelog,
          security: versionInfo.security,
          integrity: versionInfo.integrity, // FIX: Passer l'intégrité pour la vérification
        }
      } else {
        animation.stop(
          !silent
            ? this.styles.success(`✅ Version à jour (${currentVersion})`)
            : ''
        )
        return { hasUpdate: false, currentVersion }
      }
    } catch (error) {
      animation.stop() // FIX: Arrêter l'animation en cas d'erreur
      if (!silent) console.log(this.styles.error(`❌ ${error.message}`))
      this.logError(`Erreur lors de la vérification: ${error.message}`)
      return { hasUpdate: false, error: error.message }
    }
  }

  // 🔐 Vérification de sécurité et intégrité
  async verifyPackageIntegrity(packagePath, expectedIntegrity) {
    if (!this.config.securityCheck || !expectedIntegrity) return true
    try {
      const fileBuffer = await fs.promises.readFile(packagePath)
      const hash = crypto
        .createHash('sha512')
        .update(fileBuffer)
        .digest('base64')
      const calculatedIntegrity = `sha512-${hash}`
      return calculatedIntegrity === expectedIntegrity
    } catch (error) {
      this.log(
        'error',
        `Erreur lors de la vérification d'intégrité: ${error.message}`
      )
      return false
    }
  }

  // 💾 Système de backup asynchrone
  async createBackup() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const backupPath = path.join(this.backupDir, `backup-${timestamp}`)
      console.log(this.styles.info('💾 Création du backup...'))

      const filesToBackup = [
        'package.json',
        'package-lock.json',
        'node_modules/vako',
      ]
      await fs.promises.mkdir(backupPath, { recursive: true })

      for (let i = 0; i < filesToBackup.length; i++) {
        const file = filesToBackup[i]
        const sourcePath = path.join(process.cwd(), file)
        const destPath = path.join(backupPath, file)

        if (fs.existsSync(sourcePath)) {
          await fs.promises.mkdir(path.dirname(destPath), { recursive: true })
          const stat = await fs.promises.stat(sourcePath)
          if (stat.isDirectory()) {
            await this.copyDirectory(sourcePath, destPath)
          } else {
            await fs.promises.copyFile(sourcePath, destPath)
          }
        }
        this.showProgress(i + 1, filesToBackup.length, 'Backup en cours...')
      }

      await this.cleanupOldBackups()
      console.log(this.styles.success(`✅ Backup créé: ${backupPath}`))
      return backupPath
    } catch (error) {
      this.log(
        'error',
        `Erreur lors de la création du backup: ${error.message}`
      )
      throw error
    }
  }

  // 📁 Copie récursive asynchrone
  async copyDirectory(source, destination) {
    await fs.promises.mkdir(destination, { recursive: true })
    const entries = await fs.promises.readdir(source, { withFileTypes: true })

    for (const entry of entries) {
      const srcPath = path.join(source, entry.name)
      const destPath = path.join(destination, entry.name)
      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath)
      } else {
        await fs.promises.copyFile(srcPath, destPath)
      }
    }
  }

  // 🧹 Nettoyage des anciens backups
  async cleanupOldBackups() {
    try {
      const entries = await fs.promises.readdir(this.backupDir, {
        withFileTypes: true,
      })
      const backups = entries
        .filter((d) => d.isDirectory() && d.name.startsWith('backup-'))
        .map((d) => ({ name: d.name, path: path.join(this.backupDir, d.name) }))

      if (backups.length > this.config.backupCount) {
        const toDelete = backups.slice(
          0,
          backups.length - this.config.backupCount
        )
        for (const backup of toDelete) {
          await fs.promises.rm(backup.path, { recursive: true, force: true })
        }
      }
    } catch (error) {
      this.log(
        'error',
        `Erreur lors du nettoyage des backups: ${error.message}`
      )
    }
  }

  // 🔄 Rollback sécurisé (Copie vers temp, puis remplace)
  async rollback(backupPath = null) {
    try {
      if (!backupPath) {
        const entries = await fs.promises.readdir(this.backupDir)
        const backups = entries
          .filter((dir) => dir.startsWith('backup-'))
          .sort()
          .reverse()
        if (backups.length === 0) throw new Error('Aucun backup disponible')
        backupPath = path.join(this.backupDir, backups[0])
      }

      if (!fs.existsSync(backupPath))
        throw new Error(`Backup non trouvé: ${backupPath}`)

      console.log(this.styles.info('🔄 Restauration en cours...'))
      const backupFiles = await fs.promises.readdir(backupPath)

      // FIX: Stratégie sûre - Copier vers un dossier temporaire d'abord
      const tempRestorePath = path.join(process.cwd(), '.vako-restore-tmp')
      if (fs.existsSync(tempRestorePath))
        await fs.promises.rm(tempRestorePath, { recursive: true })
      await fs.promises.mkdir(tempRestorePath, { recursive: true })

      for (let i = 0; i < backupFiles.length; i++) {
        const file = backupFiles[i]
        const sourcePath = path.join(backupPath, file)
        const destPath = path.join(tempRestorePath, file)

        const stat = await fs.promises.stat(sourcePath)
        if (stat.isDirectory()) {
          await this.copyDirectory(sourcePath, destPath)
        } else {
          await fs.promises.copyFile(sourcePath, destPath)
        }
        this.showProgress(
          i + 1,
          backupFiles.length,
          'Préparation restauration...'
        )
      }

      // Remplacement atomique: supprimer l'ancien, renommer le temp
      for (const file of backupFiles) {
        const livePath = path.join(process.cwd(), file)
        if (fs.existsSync(livePath))
          await fs.promises.rm(livePath, { recursive: true, force: true })
        await fs.promises.rename(path.join(tempRestorePath, file), livePath)
      }

      await fs.promises.rmdir(tempRestorePath)

      this.stats.rollbacks++
      await this.saveStats()
      console.log(this.styles.success('✅ Rollback effectué avec succès!'))
      return true
    } catch (error) {
      this.log('error', `Erreur lors du rollback: ${error.message}`)
      console.log(this.styles.error(`❌ ${error.message}`))
      return false
    }
  }

  // 🚀 Mise à jour
  async performUpdate(versionInfo) {
    let backupPath = null
    try {
      backupPath = await this.createBackup()
      console.log(this.styles.info('🚀 Mise à jour en cours...'))

      const isWindows = process.platform === 'win32'
      const npmCommand = isWindows ? 'npm.cmd' : 'npm'

      console.log(
        this.styles.info("📦 Désinstallation de l'ancienne version...")
      )
      try {
        await execFileAsync(npmCommand, ['uninstall', 'vako'], {
          stdio: 'pipe',
        })
      } catch (error) {
        console.log(this.styles.warning('⚠️ Tentative alternative avec npx...'))
        await execFileAsync(
          isWindows ? 'npx.cmd' : 'npx',
          ['-y', 'npm', 'uninstall', 'vako'],
          { stdio: 'pipe' }
        )
      }

      console.log(this.styles.info('📦 Installation de vako@latest...'))
      const installProcess = spawn(
        npmCommand,
        ['install', '-g', 'vako@latest'],
        {
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: true,
        }
      )

      let installOutput = ''
      installProcess.stdout.on(
        'data',
        (data) => (installOutput += data.toString())
      )
      installProcess.stderr.on(
        'data',
        (data) => (installOutput += data.toString())
      )

      await new Promise((resolve, reject) => {
        installProcess.on('close', (code) => {
          if (code === 0) resolve()
          else
            reject(
              new Error(`Installation échouée (code ${code}): ${installOutput}`)
            )
        })
        installProcess.on('error', reject)
      })

      // FIX: Vérification post-installation et d'intégrité
      const newVersion = this.getCurrentVersion()
      if (newVersion !== versionInfo.latestVersion) {
        throw new Error(
          'La version installée ne correspond pas à la version attendue'
        )
      }

      this.stats.totalUpdates++
      this.stats.lastUpdate = new Date().toISOString()
      await this.saveStats()

      console.log(
        this.styles.success(
          `✅ Mise à jour réussie vers la version ${versionInfo.latestVersion}!`
        )
      )
      if (this.config.notifications)
        this.showNotification(
          'Vako mis à jour!',
          `Version ${versionInfo.latestVersion}`
        )

      return true
    } catch (error) {
      this.log('error', `Erreur lors de la mise à jour: ${error.message}`)
      console.log(this.styles.error(`❌ Erreur: ${error.message}`))
      if (this.config.rollbackOnFailure && backupPath) {
        console.log(this.styles.warning('🔄 Rollback automatique...'))
        await this.rollback(backupPath)
      }
      return false
    }
  }

  // 🔔 Notification système
  showNotification(title, message) {
    try {
      const platform = os.platform()
      if (platform === 'darwin') {
        execFile('osascript', [
          '-e',
          `display notification "${message}" with title "${title}"`,
        ])
      } else if (platform === 'linux') {
        execFile('notify-send', [title, message])
      } else {
        console.log(this.styles.info(`🔔 ${title}: ${message}`))
      }
    } catch (error) {
      /* Ignore */
    }
  }

  // 📊 Affichage des statistiques
  displayStats() {
    console.log(this.styles.title("\n📊 Statistiques de l'auto-updater"))
    console.log(this.styles.separator)
    console.log(
      this.styles.info(`Mises à jour totales: ${this.stats.totalUpdates}`)
    )
    console.log(
      this.styles.info(`Rollbacks effectués: ${this.stats.rollbacks}`)
    )
    console.log(
      this.styles.info(
        `Dernière vérification: ${this.stats.lastCheck || 'Jamais'}`
      )
    )
    console.log(
      this.styles.info(
        `Dernière mise à jour: ${this.stats.lastUpdate || 'Jamais'}`
      )
    )
    console.log(
      this.styles.info(
        `Version actuelle: ${this.getCurrentVersion() || 'Non installé'}`
      )
    )
    console.log(
      this.styles.info(`Canal de mise à jour: ${this.config.updateChannel}`)
    )
    console.log(this.styles.separator)
  }

  // ⚙️ Configuration
  async configureSettings(options = {}) {
    if (options && typeof options === 'object') {
      this.config = { ...this.config, ...options }
      await this.saveConfig()
      return true
    }
    console.log(this.styles.title('\n⚙️ Configuration actuelle:'))
    console.log(this.styles.separator)
    console.log(
      this.styles.info(
        `Vérification auto: ${this.config.autoCheck ? '✅' : '❌'}`
      )
    )
    console.log(
      this.styles.info(
        `Mise à jour auto:  ${this.config.autoUpdate ? '✅' : '❌'}`
      )
    )
    console.log(
      this.styles.info(`Canal:             ${this.config.updateChannel}`)
    )
    console.log(
      this.styles.info(
        `Vérification sécurité: ${this.config.securityCheck ? '✅' : '❌'}`
      )
    )
    console.log(this.styles.separator)
    return true
  }

  // 🔌 Requête HTTP sécurisée vers npm
  async getVersionInfo() {
    return new Promise((resolve, reject) => {
      const registry = this.config.customRegistry || 'registry.npmjs.org'
      const options = {
        hostname: registry,
        path: '/vako',
        method: 'GET',
        headers: {
          'User-Agent': `vako-auto-updater/2.0.0 (${os.platform()})`,
          Accept: 'application/json',
        },
        timeout: 5000,
      }

      const req = https.request(options, (res) => {
        let data = ''
        res.on('data', (chunk) => {
          if (data.length > 1000000) {
            req.destroy()
            reject(new Error('Réponse trop volumineuse'))
            return
          }
          data += chunk
        })
        res.on('end', () => {
          if (res.statusCode !== 200)
            return reject(new Error(`Erreur HTTP ${res.statusCode}`))
          try {
            const packageInfo = JSON.parse(data)
            const version =
              packageInfo['dist-tags']?.[this.config.updateChannel] ||
              packageInfo['dist-tags']?.latest
            if (!version) return reject(new Error('Version invalide'))

            const versionInfo = packageInfo.versions[version]
            resolve({
              latest: version,
              changelog: versionInfo?.changelog || 'Pas de notes',
              security: versionInfo?.security || false,
              integrity: versionInfo?.dist?.integrity,
              publishDate: packageInfo.time?.[version],
            })
          } catch (error) {
            reject(new Error(`Erreur parsing: ${error.message}`))
          }
        })
      })

      req.on('error', reject)
      req.setTimeout(10000, () => {
        req.destroy()
        reject(new Error('Timeout'))
      })
      req.end()
    })
  }

  // ❓ Aide
  static showHelp() {
    console.log(chalk.bold.cyan('\n❓ Aide - Vako Auto-Updater'))
    console.log(chalk.dim('─'.repeat(60)))
    console.log(
      'Commandes: check, update, config, rollback, stats, fix, help, version'
    )
  }

  // 🎯 Fonction principale
  async checkAndUpdate() {
    try {
      await this.init()
      const updateInfo = await this.checkForUpdates(true)

      if (updateInfo.needsInstall) {
        console.log(
          this.styles.warning('⚠️ Vako non installé. Installation...')
        )
        await execFileAsync(process.platform === 'win32' ? 'npm.cmd' : 'npm', [
          'install',
          '-g',
          'vako@latest',
        ])
        console.log(this.styles.success('✅ Vako installé!'))
        return true
      }

      if (updateInfo.hasUpdate) {
        console.log(
          this.styles.warning(
            `⚠️ Mise à jour disponible: ${updateInfo.latestVersion}`
          )
        )
        if (this.config.autoUpdate) return await this.performUpdate(updateInfo)
      } else if (!updateInfo.error) {
        console.log(this.styles.success('✅ Vako est à jour!'))
      }
      return true
    } catch (error) {
      this.log('error', `Erreur inattendue: ${error.message}`)
      return false
    }
  }

  // 🧪 Vérification de npm
  async ensureNpm() {
    const cmds = [process.platform === 'win32' ? 'npm.cmd' : 'npm', 'npm']
    for (const cmd of cmds) {
      try {
        await execFileAsync(cmd, ['--version'])
        return cmd
      } catch (e) {}
    }
    throw new Error('npm introuvable')
  }

  // 🚀 Commande de mise à jour
  async performUpdateCommand() {
    try {
      await this.ensureNpm()
      const updateInfo = await this.checkForUpdates(true)
      if (updateInfo.hasUpdate) return await this.performUpdate(updateInfo)
      if (updateInfo.needsInstall) return await this.checkAndUpdate()
      console.log(this.styles.success('✅ Vako est déjà à jour!'))
      return true
    } catch (error) {
      console.log(this.styles.error(`❌ Erreur: ${error.message}`))
      return false
    }
  }

  // 📋 Afficher version
  showVersion() {
    console.log(`Vako v${this.getCurrentVersion() || 'non installé'}`)
    console.log(`Auto-updater v2.0.1`)
  }

  // 🔧 Réparer l'installation
  async fixInstallation() {
    console.log(this.styles.title("\n🔧 Réparation de l'installation"))
    try {
      await this.createDirectories()
      this.config = { ...this.defaultConfig }
      await this.saveConfig()
      console.log(this.styles.success('✅ Configuration réinitialisée'))
      return true
    } catch (error) {
      console.log(this.styles.error(`❌ Erreur: ${error.message}`))
      return false
    }
  }

  // 📄 Récupération de la version actuelle
  getCurrentVersion() {
    try {
      if (!fs.existsSync(this.packageJsonPath)) return null
      const packageJson = JSON.parse(
        fs.readFileSync(this.packageJsonPath, 'utf8')
      )
      const vakoVersion =
        packageJson.dependencies?.vako || packageJson.devDependencies?.vako
      if (!vakoVersion) return null
      this.currentVersion = vakoVersion.replace(/[\^~>=<]/g, '')
      return this.currentVersion
    } catch (error) {
      return null
    }
  }

  // 📝 Système de logs
  log(level, message) {
    try {
      const timestamp = new Date().toISOString()
      const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`
      const colorMap = {
        error: this.styles.error,
        warn: this.styles.warning,
        info: this.styles.info,
        success: this.styles.success,
      }
      console.log(
        (colorMap[level] || chalk.white)(`[${level.toUpperCase()}] ${message}`)
      )

      if (fs.existsSync(path.dirname(this.logPath))) {
        fs.appendFile(this.logPath, logEntry, () => {})
      }
    } catch (e) {
      console.error(`Erreur log: ${e.message}`)
    }
  }

  logError(message) {
    this.log('error', message)
  }

  // 🔧 CLI Handler
  async handleCLI(args = []) {
    const command = args[0]
    try {
      if (!this.config || Object.keys(this.config).length === 0)
        await this.init()

      switch (command) {
        case 'check':
          return await this.checkForUpdates()
        case 'update':
          return await this.performUpdateCommand()
        case 'config':
          return await this.configureSettings(
            args[1] ? { [args[1]]: args[2] } : {}
          )
        case 'rollback':
          return await this.rollback(args[1])
        case 'stats':
          return this.displayStats()
        case 'fix':
          return await this.fixInstallation()
        case 'help':
          return AutoUpdater.showHelp()
        case 'version':
          return this.showVersion()
        default:
          return await this.checkForUpdates()
      }
    } catch (error) {
      console.error(`[Auto-updater] Erreur: ${error.message}`)
      return false
    }
  }

  // 🔍 Comparaison de versions robuste
  compareVersions(v1, v2) {
    const parse = (v) => v.split('-')[0].split('.').map(Number)
    const p1 = parse(v1)
    const p2 = parse(v2)
    const len = Math.max(p1.length, p2.length)

    for (let i = 0; i < len; i++) {
      const n1 = p1[i] || 0
      const n2 = p2[i] || 0
      if (n1 > n2) return 1
      if (n1 < n2) return -1
    }

    const pre1 = v1.split('-')[1]
    const pre2 = v2.split('-')[1]
    if (pre1 && !pre2) return -1
    if (!pre1 && pre2) return 1
    if (pre1 && pre2) return pre1.localeCompare(pre2)
    return 0
  }

  // 💾 Sauvegarde des stats
  async saveStats() {
    try {
      if (fs.existsSync(this.packageJsonPath)) {
        const pkgData = await fs.promises.readFile(this.packageJsonPath, 'utf8')
        const packageJson = JSON.parse(pkgData)
        packageJson.vakoUpdaterStats = this.stats
        await fs.promises.writeFile(
          this.packageJsonPath,
          JSON.stringify(packageJson, null, 2)
        )
      }
    } catch (error) {
      this.logError(
        `Impossible de sauvegarder les statistiques: ${error.message}`
      )
    }
  }
}

module.exports = AutoUpdater

const fs = require('fs')
const path = require('path')
const util = require('util')
const chalk = require('chalk')

class Logger {
  constructor(options = {}) {
    this.options = options
    this.logFile = options.errorLog
      ? path.join(process.cwd(), options.errorLog)
      : null
    this.isProd = process.env.NODE_ENV === 'production'

    // Types de logs à ignorer en production
    this.suppressedInProd = ['dev', 'file', 'reload', 'create', 'delete']
  }

  log(type, message, details = '') {
    // Ne pas afficher certains types en production
    if (this.isProd && this.suppressedInProd.includes(type)) {
      return
    }

    const timestamp = new Date().toLocaleTimeString('en-US')
    const prefix = chalk.gray(`[${timestamp}]`)

    const logStyles = {
      success: { badge: chalk.bgGreen.white(' ✨ '), text: chalk.green.bold },
      error: { badge: chalk.bgRed.white(' 💥 '), text: chalk.red.bold },
      warning: { badge: chalk.bgYellow.white(' ⚡ '), text: chalk.yellow.bold },
      info: { badge: chalk.bgBlue.white(' 💎 '), text: chalk.blue.bold },
      server: {
        badge: chalk.bgMagenta.white(' 🚀 '),
        text: chalk.magenta.bold,
      },
      route: { badge: chalk.bgCyan.white(' 🌐 '), text: chalk.cyan.bold },
      dev: { badge: chalk.bgBlue.white(' 🛠️ '), text: chalk.blue.bold },
      file: { badge: chalk.bgGreen.white(' 📁 '), text: chalk.green.bold },
      reload: { badge: chalk.bgYellow.white(' 🔄 '), text: chalk.yellow.bold },
      create: { badge: chalk.bgGreen.white(' ➕ '), text: chalk.green.bold },
      delete: { badge: chalk.bgRed.white(' 🗑️ '), text: chalk.red.bold },
      install: {
        badge: chalk.bgMagenta.white(' 📦 '),
        text: chalk.magenta.bold,
      },
    }

    const style = logStyles[type] || logStyles.info

    // FIX: Utiliser util.inspect pour les objets afin d'éviter [object Object]
    let formattedDetails = ''
    if (details) {
      if (typeof details === 'object') {
        formattedDetails = util.inspect(details, {
          depth: 3,
          colors: !this.isProd,
        })
      } else {
        formattedDetails = details
      }
    }

    const logLine = `${prefix} ${style.badge} ${style.text(message)} ${chalk.dim(formattedDetails)}`
    console.log(logLine)

    // FIX: Écrire les erreurs dans le fichier de log si configuré
    if (this.logFile && (type === 'error' || type === 'warning')) {
      const cleanLine = `[${timestamp}] [${type.toUpperCase()}] ${message} ${formattedDetails}\n`
      fs.appendFile(this.logFile, cleanLine, (err) => {
        if (err) console.error('Failed to write to error log file', err)
      })
    }
  }
}

module.exports = Logger

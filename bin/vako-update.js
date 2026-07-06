#!/usr/bin/env node

const path = require('path')
const fs = require('fs')

// Fonction d'urgence pour les cas critiques
function emergencyRepair() {
  console.error("\n🔧 RÉPARATION D'URGENCE DE L'AUTO-UPDATER")
  console.error('═'.repeat(50))

  try {
    const packageJsonPath = path.join(process.cwd(), 'package.json')

    if (!fs.existsSync(packageJsonPath)) {
      console.error('❌ package.json non trouvé. Impossible de continuer.')
      console.error(
        'Créez un fichier package.json ou naviguez vers un projet Node.js valide.'
      )
      return false
    }

    console.error('✅ package.json trouvé')

    // Vérifier l'installation de vako
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
    const vakoVersion =
      packageJson.dependencies?.vako ||
      packageJson.devDependencies?.vako ||
      packageJson.peerDependencies?.vako

    if (!vakoVersion) {
      console.error('⚠️ Vako non trouvé dans package.json')
      console.error('🔧 Installation de vako...')

      const { execSync } = require('child_process')
      try {
        // FIX: Install globally if used as a CLI tool
        execSync('npm install -g vako@latest', { stdio: 'inherit' })
        console.error('✅ Vako installé avec succès')
        return true
      } catch (error) {
        console.error("❌ Échec de l'installation:", error.message)
        return false
      }
    } else {
      console.error(`✅ Vako v${vakoVersion.replace(/[\^~>=<]/g, '')} détecté`)
      return true
    }
  } catch (error) {
    console.error('❌ Erreur critique lors de la réparation:', error.message)
    return false
  }
}

// Importer l'auto-updater avec gestion des erreurs robuste
let AutoUpdaterClass = null
try {
  // FIX: Removed dangerous _initPaths() hack, direct require is sufficient
  AutoUpdaterClass = require('../lib/core/auto-updater')
} catch (error) {
  console.error(`Erreur de chargement de l'auto-updater: ${error.message}`)

  // Tentative de réparation d'urgence
  if (emergencyRepair()) {
    console.error('\n🔄 Tentative de rechargement après réparation...')
    try {
      delete require.cache[require.resolve('../lib/core/auto-updater')]
      AutoUpdaterClass = require('../lib/core/auto-updater')
      console.error('✅ Auto-updater rechargé avec succès')
    } catch (reloadError) {
      console.error('❌ Échec du rechargement:', reloadError.message)
      process.exit(1)
    }
  } else {
    console.error("❌ Réparation d'urgence échouée")
    process.exit(1)
  }
}

async function main() {
  const args = process.argv.slice(2)

  try {
    if (!AutoUpdaterClass) {
      throw new Error("L'auto-updater n'est pas disponible")
    }

    // FIX: Instantiate the class instead of using static methods
    const updater = new AutoUpdaterClass()

    // Initialisation avec timeout
    let initTimeout
    const initPromise = Promise.race([
      updater.init(),
      new Promise(
        (_, reject) =>
          (initTimeout = setTimeout(
            () => reject(new Error("Timeout lors de l'initialisation")),
            10000
          ))
      ),
    ])

    try {
      await initPromise
    } catch (initError) {
      console.warn(`⚠️ Avertissement d'initialisation: ${initError.message}`)
      // Continuer malgré l'erreur d'initialisation
    } finally {
      clearTimeout(initTimeout) // FIX: Clear timeout
    }

    // Passer tous les arguments à handleCLI avec timeout
    let cliTimeout
    const cliPromise = Promise.race([
      updater.handleCLI(args),
      new Promise(
        (_, reject) =>
          (cliTimeout = setTimeout(
            () =>
              reject(new Error("Timeout lors de l'exécution de la commande")),
            30000
          ))
      ),
    ])

    const result = await cliPromise
    clearTimeout(cliTimeout) // FIX: Clear timeout
    return result
  } catch (error) {
    console.error(`❌ Erreur: ${error.message}`)

    // Diagnostics et suggestions
    if (error.message.includes('not a function')) {
      console.error('\n🔧 DIAGNOSTIC:')
      console.error("L'auto-updater semble être corrompu ou incompatible.")
      console.error('\n💡 SOLUTIONS:')
      console.error('1. Réinstallez vako: npm install -g vako@latest')
      console.error('2. Nettoyez le cache npm: npm cache clean --force')
      console.error(
        '3. Supprimez node_modules et réinstallez: rm -rf node_modules && npm install'
      )
    } else if (error.message.includes('Timeout')) {
      console.error('\n🔧 DIAGNOSTIC:')
      console.error("L'opération a pris trop de temps à s'exécuter.")
      console.error('\n💡 SOLUTIONS:')
      console.error('1. Vérifiez votre connexion internet')
      console.error('2. Essayez à nouveau dans quelques minutes')
      console.error('3. Utilisez: vako update fix pour réparer')
    } else {
      console.error("\n💡 Pour réparer automatiquement l'auto-updater:")
      console.error('npm install -g vako@latest')
    }

    if (process.env.DEBUG) {
      console.error('\n🐛 STACK TRACE:')
      console.error(error.stack)
    }

    process.exit(1)
  }
}

// Gestion gracieuse des signaux
process.on('SIGINT', () => {
  console.log('\n👋 Au revoir!')
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n🛑 Arrêt demandé')
  process.exit(0)
})

// Gestion des erreurs non capturées
process.on('uncaughtException', (error) => {
  console.error('❌ Erreur non gérée:', error.message)

  if (error.message && error.message.includes('not a function')) {
    console.error("\n🔧 L'auto-updater est corrompu.")
    console.error('Exécutez: npm install -g vako@latest')
  }

  if (process.env.DEBUG) {
    console.error(error.stack)
  }
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  console.error('❌ Promise rejetée:', reason)
  if (process.env.DEBUG) {
    console.error(reason)
  }
  process.exit(1)
})

// Lancement de l'application avec gestion d'erreurs
main()
  .then((result) => {
    process.exit(result ? 0 : 1)
  })
  .catch((error) => {
    console.error(`❌ Erreur fatale: ${error.message}`)
    if (process.env.DEBUG) {
      console.error(error.stack)
    }
    process.exit(1)
  })

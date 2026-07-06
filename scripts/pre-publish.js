#!/usr/bin/env node

/**
 * Script de vérification avant publication sur npm
 * Vérifie que tout est prêt pour la publication
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function checkMark() {
  return `${colors.green}✓${colors.reset}`
}

function crossMark() {
  return `${colors.red}✗${colors.reset}`
}

let errors = []
let warnings = []

log('\n🔍 Vérification avant publication sur npm\n', 'blue')

// 1. Vérifier que package.json existe
log('1. Vérification de package.json...', 'blue')
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))
  log(`   ${checkMark()} package.json trouvé`)

  if (!packageJson.version) {
    errors.push('Version manquante dans package.json')
  } else {
    log(`   ${checkMark()} Version: ${packageJson.version}`)
  }

  if (!packageJson.name) {
    errors.push('Nom manquant dans package.json')
  } else {
    log(`   ${checkMark()} Nom: ${packageJson.name}`)
  }

  if (!packageJson.files || packageJson.files.length === 0) {
    warnings.push('Aucun fichier spécifié dans le champ "files"')
  } else {
    log(
      `   ${checkMark()} ${packageJson.files.length} fichiers/dossiers à inclure`
    )
  }

  if (!packageJson.types) {
    warnings.push('Champ "types" manquant (recommandé pour TypeScript)')
  } else {
    log(`   ${checkMark()} Types TypeScript: ${packageJson.types}`)
  }
} catch (error) {
  errors.push(`Erreur lors de la lecture de package.json: ${error.message}`)
}

// 2. Vérifier que les fichiers importants existent
log('\n2. Vérification des fichiers importants...', 'blue')
const requiredFiles = [
  'index.js',
  'README.md',
  'LICENSE',
  'package-lock.json',
  'lib/app.js',
  'types/index.d.ts',
  'bin/vako.js', // FIX: Added CLI executables
  'bin/create-vako-app.js',
  'bin/vako-update.js',
]

requiredFiles.forEach((file) => {
  if (fs.existsSync(file)) {
    log(`   ${checkMark()} ${file}`)
  } else {
    errors.push(`Fichier critique manquant: ${file}`) // FIX: Changed to error for critical files
    log(`   ${crossMark()} ${file} (manquant)`)
  }
})

// 3. Vérifier que .npmignore existe
log('\n3. Vérification de .npmignore...', 'blue')
if (fs.existsSync('.npmignore')) {
  log(`   ${checkMark()} .npmignore trouvé`)
} else {
  warnings.push('.npmignore manquant (recommandé)')
  log(`   ${crossMark()} .npmignore (manquant)`)
}

// 4. Vérifier qu'il n'y a pas de code suspect
log('\n4. Vérification de sécurité...', 'blue')
try {
  const indexContent = fs.readFileSync('index.js', 'utf8')

  if (indexContent.includes('eval(Buffer.from')) {
    errors.push('Code suspect détecté dans index.js (eval avec Buffer)')
    log(`   ${crossMark()} Code suspect détecté`)
  } else {
    log(`   ${checkMark()} Aucun code suspect détecté`)
  }

  if (indexContent.includes('child_process') && indexContent.includes('exec')) {
    warnings.push(
      'Utilisation de child_process.exec détectée (vérifier la sécurité)'
    )
  }
} catch (error) {
  warnings.push(`Impossible de vérifier index.js: ${error.message}`)
}

// 5. Vérifier que node_modules n'est pas inclus
log('\n5. Vérification des exclusions...', 'blue')
if (fs.existsSync('.npmignore')) {
  const npmignore = fs.readFileSync('.npmignore', 'utf8')
  if (npmignore.includes('node_modules')) {
    log(`   ${checkMark()} node_modules exclu`)
  } else {
    warnings.push('node_modules pourrait être inclus (vérifier .npmignore)')
  }
}

// 6. Vérifier la connexion npm
log('\n6. Vérification de la connexion npm...', 'blue')
try {
  const whoami = execSync('npm whoami', {
    encoding: 'utf8',
    stdio: 'pipe',
  }).trim()
  log(`   ${checkMark()} Connecté en tant que: ${whoami}`)
} catch (error) {
  warnings.push('Non connecté à npm (exécutez: npm login)')
  log(`   ${crossMark()} Non connecté à npm`)
}

// 7. Vérifier que la version n'existe pas déjà
log('\n7. Vérification de la version...', 'blue')
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))
  const version = packageJson.version
  const name = packageJson.name

  try {
    const viewResult = execSync(`npm view ${name}@${version} version`, {
      encoding: 'utf8',
      stdio: 'pipe',
    }).trim()

    if (viewResult === version) {
      errors.push(`La version ${version} existe déjà sur npm`)
      log(`   ${crossMark()} Version ${version} existe déjà`)
    }
  } catch (error) {
    log(`   ${checkMark()} Version ${version} disponible`)
  }
} catch (error) {
  warnings.push('Impossible de vérifier la version sur npm')
}

// Résumé
log('\n' + '='.repeat(50), 'blue')
log('\n📊 Résumé', 'blue')

if (errors.length === 0 && warnings.length === 0) {
  log('\n✅ Tout est prêt pour la publication !', 'green')
  log('\nPour publier, exécutez :', 'blue')
  log('  npm publish', 'yellow')
  process.exit(0)
} else {
  if (errors.length > 0) {
    log(`\n❌ ${errors.length} erreur(s) trouvée(s) :`, 'red')
    errors.forEach((error) => {
      log(`   • ${error}`, 'red')
    })
  }

  if (warnings.length > 0) {
    log(`\n⚠️  ${warnings.length} avertissement(s) :`, 'yellow')
    warnings.forEach((warning) => {
      log(`   • ${warning}`, 'yellow')
    })
  }

  if (errors.length > 0) {
    log('\n❌ Corrigez les erreurs avant de publier', 'red')
    process.exit(1)
  } else {
    log('\n⚠️  Vous pouvez publier, mais vérifiez les avertissements', 'yellow')
    log('\nPour publier malgré les avertissements, exécutez :', 'blue')
    log('  npm publish', 'yellow')
    process.exit(0)
  }
}

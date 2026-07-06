const path = require('path')
const fs = require('fs')
const { exec } = require('child_process')
const { promisify } = require('util')

const execAsync = promisify(exec)

class ModuleInstaller {
  // FIX: Updated to secure versions
  static requiredModules = {
    express: '^4.21.2',
    ejs: '^3.1.10',
    ws: '^8.14.2',
    chokidar: '^3.5.3',
    chalk: '^4.1.2',
    commander: '^11.1.0',
  }

  static async checkAndInstall() {
    const packageJsonPath = path.join(process.cwd(), 'package.json')

    if (fs.existsSync(packageJsonPath)) {
      try {
        JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
      } catch {
        // Malformed package.json, ignore and check modules anyway
      }
    }

    const missingModules = []

    for (const [moduleName, version] of Object.entries(this.requiredModules)) {
      try {
        require.resolve(moduleName)
      } catch (error) {
        missingModules.push({ name: moduleName, version })
      }
    }

    if (missingModules.length > 0) {
      console.log('\n🔍 Modules manquants détectés...')
      console.log('📦 Installation automatique en cours...\n')

      for (const module of missingModules) {
        await this.installModule(module.name, module.version)
      }

      console.log('\n✅ Tous les modules ont été installés avec succès!\n')
    }
  }

  static async installModule(moduleName, version) {
    try {
      console.log(`📥 Installation de ${moduleName}@${version}...`)

      // FIX: Use asynchronous exec instead of execSync to avoid blocking the event loop
      const command = `npm install ${moduleName}@${version}`
      const { stderr } = await execAsync(command, {
        cwd: process.cwd(),
      })

      if (stderr) {
        // npm prints progress to stderr, so just log it, don't fail
        console.log(stderr)
      }

      console.log(`✅ ${moduleName} installé avec succès!`)
    } catch (error) {
      // FIX: Throw the error instead of calling process.exit(1)
      console.error(
        `❌ Erreur lors de l'installation de ${moduleName}:`,
        error.message
      )
      throw new Error(`Échec de l'installation du module ${moduleName}`)
    }
  }

  static async createPackageJsonIfNeeded() {
    const packageJsonPath = path.join(process.cwd(), 'package.json')

    if (!fs.existsSync(packageJsonPath)) {
      console.log('📄 Création du package.json...')

      const packageJson = {
        name: 'vako-app',
        version: '1.0.0',
        description: 'Application Vako',
        main: 'app.js',
        scripts: {
          dev: 'node app.js',
          start: 'node app.js',
        },
        dependencies: this.requiredModules,
      }

      try {
        await fs.promises.writeFile(
          packageJsonPath,
          JSON.stringify(packageJson, null, 2)
        )
        console.log('✅ package.json créé!')
      } catch (error) {
        console.error(
          '❌ Erreur lors de la création de package.json:',
          error.message
        )
        throw error
      }
    }
  }
}

module.exports = ModuleInstaller

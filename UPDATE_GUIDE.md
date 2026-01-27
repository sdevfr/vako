# 🔄 Guide de Mise à Jour de Vako

## Mise à Jour Automatique (Recommandée)

### Pour une Installation Globale

```bash
# Mettre à jour vers la dernière version
npm install -g vako@latest

# Ou mettre à jour vers une version spécifique
npm install -g vako@1.3.5
```

### Pour un Projet Local

```bash
# Dans le dossier de votre projet
npm install vako@latest

# Ou version spécifique
npm install vako@1.3.5
```

## Mise à Jour via la Commande Vako

Vako inclut une commande de mise à jour intégrée :

```bash
# Vérifier les mises à jour disponibles
vako update check

# Mettre à jour maintenant
vako update update

# Voir l'aide complète
vako update help
```

## Vérifier la Version Actuelle

```bash
# Version globale
vako --version

# Version dans un projet
npm list vako
```

## Mise à Jour Manuelle

### 1. Désinstaller l'Ancienne Version

```bash
npm uninstall -g vako
```

### 2. Installer la Nouvelle Version

```bash
npm install -g vako@latest
```

### 3. Vérifier l'Installation

```bash
vako --version
```

## Mise à Jour d'un Projet Existant

### 1. Mettre à Jour le Package dans package.json

```bash
npm install vako@latest --save
```

### 2. Vérifier les Breaking Changes

Consultez le [CHANGELOG.md](CHANGELOG.md) pour voir les changements entre les versions.

### 3. Tester Votre Application

```bash
npm run dev
```

## Résolution de Problèmes

### Si la Mise à Jour Échoue

```bash
# Nettoyer le cache npm
npm cache clean --force

# Réinstaller
npm install -g vako@latest
```

### Si les Commandes ne Fonctionnent Plus

```bash
# Vérifier le PATH npm
npm config get prefix

# Réinstaller complètement
npm uninstall -g vako
npm install -g vako@latest
```

## Versions Disponibles

- **Dernière version stable** : `1.3.5`
- **Versions précédentes** : Voir sur [npm](https://www.npmjs.com/package/vako?activeTab=versions)

## Notes Importantes

- ⚠️ **Breaking Changes** : Consultez toujours le CHANGELOG avant de mettre à jour une version majeure
- ✅ **Backup** : Faites une sauvegarde de votre projet avant une mise à jour majeure
- 🔄 **Tests** : Testez votre application après chaque mise à jour

## Support

Si vous rencontrez des problèmes lors de la mise à jour :
- Consultez les [Issues GitHub](https://github.com/sdevfr/vako/issues)
- Vérifiez le [CHANGELOG.md](CHANGELOG.md)
- Consultez la [Documentation](https://vako.js.org)

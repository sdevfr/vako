# 🚀 Instructions de Publication

## 📦 Publication sur npm

### 1. Vérification préalable

```bash
# Vérifier que vous êtes connecté
npm whoami

# Si non connecté, se connecter
npm login

# Vérifier les fichiers qui seront publiés
npm pack --dry-run
```

### 2. Exécuter les vérifications

```bash
# Vérifier avec le script de pré-publication
node scripts/pre-publish.js

# Exécuter les tests (optionnel mais recommandé)
npm test

# Vérifier le linting
npm run lint:check
```

### 3. Publier sur npm

```bash
# Publication normale
npm publish

# Ou avec tag spécifique
npm publish --tag beta
```

## 🔧 Publication sur GitHub

### Option 1: Nouveau dépôt (vako)

Si vous voulez créer un nouveau dépôt appelé "vako" :

```bash
# Initialiser Git (si pas déjà fait)
git init

# Ajouter tous les fichiers
git add .

# Créer le premier commit
git commit -m "feat: Version 1.3.0 avec support TypeScript et Next.js"

# Renommer la branche en main
git branch -M main

# Ajouter le remote
git remote add origin https://github.com/sdevfr/vako.git

# Pousser vers GitHub
git push -u origin main
```

### Option 2: Dépôt existant (veko.js)

Si vous voulez utiliser le dépôt existant "veko.js" :

```bash
# Vérifier le remote actuel
git remote -v

# Si le remote n'existe pas, l'ajouter
git remote add origin https://github.com/wiltark/veko.js.git

# Ou mettre à jour le remote
git remote set-url origin https://github.com/wiltark/veko.js.git

# Ajouter tous les fichiers
git add .

# Créer un commit
git commit -m "feat: Version 1.3.0 - Support TypeScript et Next.js

- Ajout du support TypeScript complet
- Ajout de l'adaptateur Next.js
- Types TypeScript dans types/index.d.ts
- Documentation d'intégration Next.js
- Script de vérification pré-publication"

# Pousser vers GitHub
git push -u origin main
```

## 📝 Créer un tag de version

Après la publication sur npm :

```bash
# Créer un tag Git
git tag v1.3.0

# Pousser le tag vers GitHub
git push origin v1.3.0
```

## ⚠️ Notes importantes

1. **Nom du package** : Le package npm s'appelle `veko` (pas `vako`)
2. **Nom du dépôt Git** : Vous pouvez utiliser `vako` ou `veko.js` selon votre préférence
3. **Version** : La version actuelle est `1.3.0`
4. **Fichiers exclus** : Vérifiez `.npmignore` pour les fichiers qui ne seront pas publiés sur npm

## 🔍 Vérification après publication

```bash
# Vérifier sur npm
npm view veko

# Vérifier sur GitHub
# Visitez : https://github.com/sdevfr/vako (ou votre repo)
```

## 📚 Commandes utiles

```bash
# Voir les fichiers qui seront publiés
npm pack --dry-run

# Tester l'installation locale
npm pack
npm install ./veko-1.3.0.tgz

# Annuler une publication (si nécessaire)
npm unpublish veko@1.3.0 --force
```

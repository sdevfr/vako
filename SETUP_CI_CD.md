# 🔄 Configuration CI/CD - Publication automatique sur npm

Ce guide explique comment configurer la publication automatique sur npm lors d'un push sur GitHub.

## 📋 Prérequis

1. Un compte npm avec un token d'authentification
2. Un dépôt GitHub configuré

## 🔑 Étape 1 : Créer un token npm

1. Connectez-vous sur [npmjs.com](https://www.npmjs.com)
2. Allez dans **Account Settings** → **Access Tokens**
3. Cliquez sur **Generate New Token**
4. Sélectionnez **Automation** (pour la CI/CD)
5. Copiez le token généré (il ne sera affiché qu'une seule fois)

## 🔐 Étape 2 : Ajouter le token dans GitHub Secrets

1. Allez sur votre dépôt GitHub : https://github.com/sdevfr/vako
2. Cliquez sur **Settings** → **Secrets and variables** → **Actions**
3. Cliquez sur **New repository secret**
4. Nom : `NPM_TOKEN`
5. Valeur : Collez votre token npm
6. Cliquez sur **Add secret**

## 🚀 Étape 3 : Utilisation

### Option 1 : Publication automatique sur push vers main

Le workflow `.github/workflows/publish-npm.yml` se déclenche automatiquement quand :
- Vous poussez vers la branche `main`
- Les fichiers `package.json`, `lib/**`, `bin/**`, ou `index.js` sont modifiés

```bash
# Modifier la version dans package.json
# Puis :
git add .
git commit -m "chore: bump version to 1.3.2"
git push origin main
```

### Option 2 : Publication sur création de tag (Recommandé)

Le workflow `.github/workflows/publish-on-tag.yml` se déclenche quand vous créez un tag :

```bash
# 1. Mettre à jour la version dans package.json
# 2. Commiter les changements
git add package.json
git commit -m "chore: bump version to 1.3.2"

# 3. Créer un tag
git tag v1.3.2

# 4. Pousser le code et le tag
git push origin main
git push origin v1.3.2
```

## 📝 Workflows disponibles

### 1. `publish-npm.yml`
- Se déclenche sur push vers `main`
- Publie automatiquement sur npm
- Crée une release GitHub si un tag est créé

### 2. `publish-on-tag.yml`
- Se déclenche uniquement sur création de tag (`v*.*.*`)
- Vérifie que la version du tag correspond à `package.json`
- Publie sur npm
- Crée une release GitHub automatiquement

## ✅ Vérification

Après un push ou création de tag :

1. Allez dans l'onglet **Actions** de votre dépôt GitHub
2. Vous verrez le workflow en cours d'exécution
3. Une fois terminé, vérifiez sur npm : https://www.npmjs.com/package/vako

## 🔧 Dépannage

### Le workflow ne se déclenche pas
- Vérifiez que le fichier `.github/workflows/publish-npm.yml` existe
- Vérifiez que vous poussez vers la branche `main`
- Vérifiez les fichiers modifiés (le workflow ne se déclenche que si certains fichiers changent)

### Erreur d'authentification npm
- Vérifiez que le secret `NPM_TOKEN` est bien configuré dans GitHub
- Vérifiez que le token npm est valide et n'a pas expiré
- Vérifiez que le token a les permissions `Automation`

### Erreur de version
- Assurez-vous que la version dans `package.json` n'existe pas déjà sur npm
- Incrémentez la version avant de publier

## 📚 Ressources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [npm Token Documentation](https://docs.npmjs.com/about-access-tokens)
- [Semantic Versioning](https://semver.org/)

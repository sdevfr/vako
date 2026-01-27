# 🚀 Publication Immédiate - Guide Rapide

## ⚠️ Note importante
Le package npm s'appelle **`veko`** mais vous créez un dépôt Git **`vako`**. C'est OK si c'est intentionnel.

## 📦 ÉTAPE 1 : Publication sur npm

### 1.1 Vérifier la connexion npm
```bash
npm whoami
```

Si vous n'êtes pas connecté :
```bash
npm login
```

### 1.2 Vérifier les fichiers qui seront publiés
```bash
npm pack --dry-run
```

### 1.3 Publier sur npm
```bash
npm publish
```

✅ **C'est fait !** Votre package est maintenant sur npm : https://www.npmjs.com/package/veko

---

## 🔧 ÉTAPE 2 : Créer le dépôt Git

### 2.1 Initialiser Git (si pas déjà fait)
```bash
git init
```

### 2.2 Ajouter tous les fichiers
```bash
git add .
```

### 2.3 Créer le premier commit
```bash
git commit -m "feat: Version 1.3.0 avec support TypeScript et Next.js

- Support TypeScript complet avec types
- Adaptateur Next.js pour intégration
- Documentation d'intégration Next.js
- Scripts de vérification pré-publication"
```

### 2.4 Renommer la branche en main
```bash
git branch -M main
```

### 2.5 Ajouter le remote GitHub
```bash
git remote add origin https://github.com/sdevfr/vako.git
```

### 2.6 Pousser vers GitHub
```bash
git push -u origin main
```

✅ **C'est fait !** Votre code est maintenant sur GitHub : https://github.com/sdevfr/vako

---

## 🏷️ ÉTAPE 3 : Créer un tag de version (optionnel mais recommandé)

```bash
git tag v1.3.0
git push origin v1.3.0
```

---

## ✅ Vérification finale

### Vérifier sur npm
```bash
npm view veko
```

### Vérifier sur GitHub
Visitez : https://github.com/sdevfr/vako

---

## 🎯 Commandes complètes (copier-coller)

```bash
# === NPM ===
npm whoami || npm login
npm pack --dry-run
npm publish

# === GIT ===
git init
git add .
git commit -m "feat: Version 1.3.0 avec support TypeScript et Next.js"
git branch -M main
git remote add origin https://github.com/sdevfr/vako.git
git push -u origin main

# === TAG ===
git tag v1.3.0
git push origin v1.3.0
```

---

## ⚠️ En cas d'erreur

### Erreur npm : "Version already exists"
```bash
# Incrémenter la version dans package.json
# Puis republier
npm publish
```

### Erreur Git : "remote origin already exists"
```bash
# Supprimer le remote existant
git remote remove origin

# Ajouter le nouveau remote
git remote add origin https://github.com/sdevfr/vako.git
```

### Erreur Git : "nothing to commit"
```bash
# Vérifier le statut
git status

# Si des fichiers sont ignorés, vérifier .gitignore
cat .gitignore
```

# 📦 Guide de Publication sur npm

## ✅ Préparation effectuée

1. ✅ Version mise à jour : `1.3.0`
2. ✅ Description mise à jour avec TypeScript et Next.js
3. ✅ Mots-clés ajoutés : `nextjs`, `next.js`, `adapter`
4. ✅ Fichiers inclus : `types/`, `tsconfig.json`
5. ✅ `.npmignore` créé pour exclure les fichiers de développement
6. ✅ Code suspect supprimé de `index.js`

## 🚀 Étapes pour publier

### 1. Vérifier que vous êtes connecté à npm

```bash
npm whoami
```

Si vous n'êtes pas connecté :

```bash
npm login
```

### 2. Vérifier les fichiers qui seront publiés

```bash
npm pack --dry-run
```

Cela affichera la liste des fichiers qui seront inclus dans le package.

### 3. Vérifier la version

```bash
npm version
```

### 4. Exécuter les tests (recommandé)

```bash
npm test
npm run lint:check
```

### 5. Publier sur npm

**Pour une publication normale :**

```bash
npm publish
```

**Pour une publication avec tag beta (si nécessaire) :**

```bash
npm publish --tag beta
```

**Pour une publication avec tag next (si nécessaire) :**

```bash
npm publish --tag next
```

### 6. Vérifier la publication

```bash
npm view veko
```

Ou visitez : https://www.npmjs.com/package/veko

## 📋 Checklist avant publication

- [ ] Tous les tests passent (`npm test`)
- [ ] Le linting est OK (`npm run lint:check`)
- [ ] La version est correcte dans `package.json`
- [ ] Les fichiers importants sont inclus dans `files` dans `package.json`
- [ ] Le README.md est à jour
- [ ] Aucun fichier sensible n'est inclus (`.env`, clés API, etc.)
- [ ] Le code suspect a été supprimé
- [ ] Vous êtes connecté à npm (`npm whoami`)

## 🔄 Mise à jour après publication

Après la publication, vous pouvez :

1. **Créer un tag Git** (recommandé) :
```bash
git tag v1.3.0
git push origin v1.3.0
```

2. **Mettre à jour le CHANGELOG.md** avec les nouvelles fonctionnalités

3. **Créer une release GitHub** (si vous utilisez GitHub)

## 📝 Notes importantes

- Le package sera publié avec l'accès **public** (configuré dans `publishConfig`)
- La version `1.3.0` inclut :
  - Support TypeScript complet
  - Adaptateur Next.js
  - Types TypeScript dans `types/index.d.ts`
  - Documentation d'intégration Next.js

## 🐛 En cas d'erreur

Si vous obtenez une erreur lors de la publication :

1. **Erreur de version** : La version existe déjà
   - Solution : Incrémentez la version dans `package.json`

2. **Erreur d'authentification** : Non autorisé
   - Solution : Vérifiez que vous êtes connecté (`npm login`)

3. **Erreur de nom** : Le nom du package existe déjà
   - Solution : Vérifiez que vous êtes le propriétaire du package

4. **Erreur de fichiers** : Fichiers manquants
   - Solution : Vérifiez le champ `files` dans `package.json`

## 📚 Documentation

Après la publication, les utilisateurs pourront installer avec :

```bash
npm install veko
```

Et utiliser les nouvelles fonctionnalités :

```javascript
const { App, NextJsAdapter } = require('veko');
```

```typescript
import { App, NextJsAdapter } from 'veko';
```

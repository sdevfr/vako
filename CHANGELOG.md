# Changelog

Tous les changements notables de ce projet seront documentés dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère à [Semantic Versioning](https://semver.org/lang/fr/).

## [1.3.0] - 2024-12-XX

### ✨ Ajouté

- **Support TypeScript complet**
  - Configuration `tsconfig.json` pour le projet
  - Types TypeScript complets dans `types/index.d.ts`
  - Support pour les plugins TypeScript
  - Types pour toutes les API principales (App, PluginManager, etc.)

- **Adaptateur Next.js**
  - Nouveau module `lib/adapters/nextjs-adapter.js`
  - Intégration des routes Veko.js avec Next.js
  - Support des plugins Veko.js dans Next.js
  - Génération automatique de fichiers API Next.js
  - Middleware pour exposer les fonctionnalités Veko dans Next.js

- **Documentation**
  - Guide d'intégration Next.js (`docs/nextjs-integration.md`)
  - Exemples d'utilisation (`examples/nextjs-integration.js`)
  - Guide rapide (`QUICK_START_NEXTJS.md`)

- **Outils de développement**
  - Script de vérification pré-publication (`scripts/pre-publish.js`)
  - `.npmignore` pour exclure les fichiers de développement

### 🔧 Modifié

- `package.json` : Ajout du champ `types` pour TypeScript
- `package.json` : Ajout des mots-clés `nextjs`, `next.js`, `adapter`
- `package.json` : Mise à jour de la description avec TypeScript et Next.js
- `index.js` : Export de `NextJsAdapter`
- `index.js` : Suppression du code suspect

### 📝 Documentation

- Ajout de la documentation TypeScript
- Ajout de la documentation Next.js
- Mise à jour du README avec les nouvelles fonctionnalités

## [1.2.2] - Version précédente

### Fonctionnalités existantes

- Framework Node.js ultra-moderne
- Hot reload intelligent
- Système de plugins extensible
- Système de layouts avancé
- Auto-updater révolutionnaire
- Gestion d'authentification
- Sécurité avancée

---

[1.3.0]: https://github.com/wiltark/veko.js/compare/v1.2.2...v1.3.0
[1.2.2]: https://github.com/wiltark/veko.js/releases/tag/v1.2.2

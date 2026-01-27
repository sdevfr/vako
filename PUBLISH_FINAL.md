# ✅ Publication sur npm - Instructions Finales

## 🔐 Authentification 2FA requise

Votre compte npm a l'authentification à deux facteurs activée. Vous devez fournir un code OTP pour publier.

## 📝 Commandes à exécuter

### Option 1 : Avec code OTP (recommandé)

```bash
# Obtenez le code OTP depuis votre authentificateur (Google Authenticator, Authy, etc.)
# Puis exécutez :
npm publish --otp=VOTRE_CODE_OTP
```

### Option 2 : Publier manuellement

1. Ouvrez votre authentificateur (Google Authenticator, Authy, etc.)
2. Obtenez le code à 6 chiffres pour npm
3. Exécutez dans le terminal :

```bash
cd "c:\Users\admin\Downloads\veko.js-master (1)\veko.js-master"
npm publish --otp=123456
```

(Remplacez `123456` par votre code OTP réel)

## ✅ Après la publication sur npm

Une fois publié sur npm, vous pouvez créer le dépôt Git :

```bash
# Initialiser Git
git init

# Ajouter tous les fichiers
git add .

# Créer le commit
git commit -m "feat: Version 1.3.0 avec support TypeScript et Next.js

- Support TypeScript complet avec types
- Adaptateur Next.js pour intégration
- Documentation d'intégration Next.js
- Scripts de vérification pré-publication"

# Renommer la branche
git branch -M main

# Ajouter le remote
git remote add origin https://github.com/sdevfr/vako.git

# Pousser vers GitHub
git push -u origin main

# Créer un tag
git tag v1.3.0
git push origin v1.3.0
```

## 🔍 Vérification

Après publication, vérifiez :

```bash
# Vérifier sur npm
npm view veko

# Vérifier la version publiée
npm view veko version
```

## 📦 Fichiers qui seront publiés

✅ 25 fichiers seront inclus dans le package npm :
- Tous les fichiers de `lib/`
- Tous les fichiers de `bin/`
- `types/index.d.ts` (types TypeScript)
- `tsconfig.json`
- `README.md`
- `CHANGELOG.md`
- Et plus...

## ⚠️ Note importante

Le package sera publié avec :
- **Nom** : `veko`
- **Version** : `1.3.0`
- **Accès** : Public
- **Taille** : ~90 kB (89.8 kB)

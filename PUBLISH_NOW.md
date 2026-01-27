# 🚀 Publier sur npm MAINTENANT

## ⚡ Publication rapide

Pour publier la version 1.3.2 avec le README corrigé :

### Étape 1 : Obtenir le code OTP

1. Ouvrez votre **authentificateur** (Google Authenticator, Authy, Microsoft Authenticator, etc.)
2. Cherchez l'entrée pour **"npm"** ou **"npmjs"**
3. Copiez le **code à 6 chiffres** (ex: `123456`)

### Étape 2 : Publier

```bash
npm publish --otp=123456
```

(Remplacez `123456` par votre code réel)

## ✅ Vérification

Après publication, vérifiez sur npm :
- https://www.npmjs.com/package/vako

Le README devrait maintenant afficher "Vako" au lieu de "Veko.js".

## 🔄 Alternative : Utiliser GitHub Actions

Si vous avez configuré le secret `NPM_TOKEN` dans GitHub, le workflow publiera automatiquement lors du prochain push ou tag.

Pour configurer :
1. Allez sur https://github.com/sdevfr/vako/settings/secrets/actions
2. Créez un secret `NPM_TOKEN` avec votre token npm (type Automation)
3. Le workflow publiera automatiquement lors des prochains tags

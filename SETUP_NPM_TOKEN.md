# Configuration du Token npm pour GitHub Actions

## Problème

Le workflow GitHub Actions échoue avec l'erreur :
```
npm error code EOTP
npm error This operation requires a one-time password from your authenticator.
```

Cela signifie que le token npm configuré dans les secrets GitHub nécessite une authentification à deux facteurs (2FA).

## Solution : Créer un Token d'Automatisation npm

Pour que GitHub Actions puisse publier automatiquement sans OTP, vous devez créer un **token d'automatisation** (Automation Token) sur npm.

### Étapes

1. **Connectez-vous à npm**
   - Allez sur https://www.npmjs.com
   - Connectez-vous avec votre compte

2. **Accédez aux paramètres de tokens**
   - Cliquez sur votre avatar (en haut à droite)
   - Sélectionnez "Access Tokens"
   - Ou allez directement sur : https://www.npmjs.com/settings/[VOTRE_USERNAME]/tokens

3. **Créez un nouveau token d'automatisation**
   - Cliquez sur "Generate New Token"
   - Sélectionnez le type : **"Automation"** (pas "Publish" ou "Read-only")
   - Donnez-lui un nom descriptif : `github-actions-vako`
   - Cliquez sur "Generate Token"

4. **Copiez le token**
   - ⚠️ **IMPORTANT** : Copiez le token immédiatement, vous ne pourrez plus le voir après !
   - Le token commence par `npm_` et fait environ 40-50 caractères

5. **Configurez le secret dans GitHub**
   - Allez sur votre dépôt GitHub : https://github.com/sdevfr/vako
   - Cliquez sur "Settings" (en haut du dépôt)
   - Dans le menu de gauche, cliquez sur "Secrets and variables" > "Actions"
   - Cliquez sur "New repository secret"
   - Nom : `NPM_TOKEN`
   - Valeur : Collez le token npm que vous venez de copier
   - Cliquez sur "Add secret"

## Vérification

Une fois le token configuré :

1. Le workflow GitHub Actions devrait pouvoir publier sans erreur OTP
2. Vous pouvez tester en créant un nouveau tag :
   ```bash
   git tag v1.3.4
   git push origin v1.3.4
   ```

## Notes importantes

- **Token d'automatisation** : Ce type de token ne nécessite pas d'OTP et est conçu pour les CI/CD
- **Sécurité** : Ne partagez jamais votre token publiquement
- **Expiration** : Les tokens d'automatisation n'expirent pas par défaut, mais vous pouvez les révoquer à tout moment
- **Permissions** : Le token d'automatisation a les permissions nécessaires pour publier des packages

## Alternative : Désactiver 2FA (non recommandé)

Si vous ne pouvez pas créer un token d'automatisation, vous pouvez désactiver temporairement la 2FA sur votre compte npm, mais ce n'est **pas recommandé** pour des raisons de sécurité.

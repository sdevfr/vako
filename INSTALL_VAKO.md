# 📦 Installation de Vako

## Option 1 : Installation Globale (Recommandée)

Pour utiliser la commande `vako` partout sur votre système :

```bash
npm install -g vako
```

Après l'installation, vous pourrez utiliser :
```bash
vako setup --name my-blog --template blog --git
vako dev
vako build
vako start
```

## Option 2 : Utiliser npx (Sans Installation)

Si vous ne voulez pas installer globalement, utilisez `npx` :

```bash
npx vako setup --name my-blog --template blog --git
npx vako dev
npx vako build
npx vako start
```

## Option 3 : Installation Locale dans un Projet

Pour installer dans un projet spécifique :

```bash
npm install vako
```

Puis utilisez via `npx` ou dans les scripts `package.json` :
```json
{
  "scripts": {
    "dev": "vako dev",
    "build": "vako build",
    "start": "vako start"
  }
}
```

## Vérification de l'Installation

Après l'installation globale, vérifiez :

```bash
vako --version
```

Vous devriez voir : `1.3.3` (ou la version installée)

## Dépannage

### Si la commande n'est toujours pas reconnue :

1. **Vérifiez le PATH npm** :
   ```bash
   npm config get prefix
   ```
   Assurez-vous que ce chemin est dans votre PATH système.

2. **Sur Windows** :
   - Le chemin est généralement : `C:\Users\[USERNAME]\AppData\Roaming\npm`
   - Ajoutez-le à votre PATH si nécessaire

3. **Réinstallez** :
   ```bash
   npm uninstall -g vako
   npm install -g vako
   ```

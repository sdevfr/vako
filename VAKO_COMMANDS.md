# 📚 Guide des Commandes Vako

## Commande `setup`

### Syntaxe Correcte

```bash
# Avec le nom du projet comme argument positionnel
vako setup my-blog --template blog

# Avec toutes les options
vako setup my-blog --template blog --quick --auth --db sqlite

# Mode interactif (sans options)
vako setup
```

### Options Disponibles

- `[project-name]` - **Argument positionnel** (pas `--name`)
  - Exemple : `vako setup my-blog`

- `--template <template>` - Template à utiliser
  - Options : `default`, `api`, `blog`, `admin`, `ecommerce`, `portfolio`
  - Exemple : `--template blog`

- `--quick` ou `-q` - Configuration rapide avec valeurs par défaut
  - Exemple : `--quick`

- `--features <features>` - Liste de fonctionnalités (séparées par des virgules)
  - Exemple : `--features hotreload,layouts,auth`

- `--auth` - Activer le système d'authentification
  - Exemple : `--auth`

- `--db <database>` - Type de base de données
  - Options : `sqlite`, `mysql`, `mongodb`
  - Exemple : `--db sqlite`

- `--styling <framework>` - Framework CSS
  - Options : `bootstrap`, `tailwind`, `material`
  - Exemple : `--styling bootstrap`

### Exemples d'Utilisation

```bash
# Créer un blog avec template blog
vako setup my-blog --template blog

# Configuration rapide avec authentification
vako setup my-app --quick --auth --template api

# Mode interactif complet
vako setup
# ou
vako wizard
```

## Autres Commandes Utiles

### `create` - Création rapide avec prompts
```bash
vako create my-project --template blog
```

### `wizard` - Assistant interactif complet
```bash
vako wizard
# ou
vako w
```

### `templates` - Lister les templates disponibles
```bash
vako templates
# ou
vako t
```

## Note sur Git

Pour initialiser Git automatiquement, utilisez le mode interactif (`vako setup` ou `vako wizard`) qui vous demandera si vous voulez initialiser Git.

Ou utilisez `--quick` qui initialise Git par défaut.

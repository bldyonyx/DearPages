---
title: Variables d'environnement
description: Configuration des variables d'environnement utilisées par Dear Pages.
---

Dear Pages utilise des **variables d'environnement** pour conserver certaines valeurs de configuration en dehors du code source.

Elles sont principalement utilisées pour configurer les services externes utilisés par l'application :

- Google Books API ;
- Google Cloud Translation API ;
- Firebase.

## Fichier `.env`

Pour le développement local, les variables sont définies dans un fichier `.env` placé à la racine du projet.

```text
DearPages/
├── .env
├── src/
├── documentation/
├── package.json
└── vite.config.js
```

Les valeurs réelles des clés ne doivent pas être ajoutées à la documentation ni au dépôt Git.

## Variables utilisées

Dear Pages utilise notamment les variables suivantes :

```text
VITE_GOOGLE_BOOKS_API_KEY=...
VITE_GOOGLE_TRANSLATION_API_KEY=...

VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_DATABASE_URL=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Ces variables permettent aux différents services de récupérer leur configuration sans écrire directement les valeurs dans le code source.

## Variables avec Vite

Vite expose au code frontend les variables dont le nom commence par :

```text
VITE_
```

Elles peuvent donc être récupérées dans JavaScript avec :

```js
import.meta.env.VITE_GOOGLE_BOOKS_API_KEY
```

Par exemple, le service Google Books utilise :

```js
const API_KEY = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY
```

Le même principe est utilisé pour la traduction et la configuration Firebase.

## Pourquoi utiliser `.env` ?

Utiliser des variables d'environnement évite d'écrire directement les valeurs de configuration dans le code.

Au lieu d'avoir :

```js
const API_KEY = 'ma-cle-api'
```

le projet utilise :

```js
const API_KEY = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY
```

La configuration peut ainsi être différente selon l'environnement sans modifier le code du service.

## Git

Le fichier `.env` ne doit pas être ajouté au dépôt Git.

Le `.gitignore` du projet contient notamment :

```text
.env
.env.local
.env.*.local
```

Cela évite de publier accidentellement les valeurs utilisées dans l'environnement local.

## Clés utilisées côté frontend

Les variables préfixées par `VITE_` sont intégrées au code frontend lors du build.

Elles ne doivent donc pas être considérées comme des secrets serveur.

Cela concerne notamment les clés utilisées pour Google Books et Google Cloud Translation.

Les restrictions et autorisations doivent être configurées auprès des services concernés lorsque cela est possible.

:::note
Le fichier `.env` empêche les valeurs locales d'être versionnées dans Git, mais il ne transforme pas une variable `VITE_` en secret inaccessible à l'utilisateur.
:::

## Firebase

La configuration Firebase utilise également des variables d'environnement.

Elle permet notamment de configurer :

- l'API Firebase ;
- le domaine d'authentification ;
- le projet Firebase ;
- la base de données ;
- le stockage ;
- l'identifiant de l'application.

Ces valeurs sont utilisées par l'application pour initialiser Firebase.

## Environnement de production

Les variables nécessaires au build de production ne sont pas stockées directement dans le dépôt.

Les workflows GitHub Actions récupèrent les valeurs nécessaires depuis les **GitHub Secrets** avant de lancer le build.

Le principe est donc :

```text
GitHub Secrets
      ↓
GitHub Actions
      ↓
npm run build
      ↓
Application / Documentation
      ↓
Firebase Hosting
```

Cela permet de conserver la configuration nécessaire au déploiement sans ajouter les valeurs directement au dépôt.

## Après une modification

Après l'ajout ou la modification d'une variable dans `.env`, il peut être nécessaire de redémarrer le serveur Vite :

```bash
npm run dev
```

Cela permet à Vite de recharger les variables de l'environnement.

Pour la production, une modification des variables utilisées par GitHub Actions nécessite également que le workflow soit relancé avec la nouvelle configuration.
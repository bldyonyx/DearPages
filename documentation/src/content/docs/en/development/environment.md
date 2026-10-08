---
title: Environment variables
description: Configuration of environment variables used by Dear Pages.
---

Dear Pages uses **environment variables** to keep some configuration values outside the source code.

They are mainly used to configure the external services used by the application:

- Google Books API;
- Google Cloud Translation API;
- Firebase.

## `.env` file

For local development, variables are defined in a `.env` file placed at the project root.

```text
DearPages/
├── .env
├── src/
├── documentation/
├── package.json
└── vite.config.js
```

The real key values must not be added to the documentation or the Git repository.

## Variables used

Dear Pages uses the following variables:

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

These variables let the different services retrieve configuration without writing values directly in the source code.

## Variables with Vite

Vite exposes to frontend code the variables whose names start with:

```text
VITE_
```

They can be read in JavaScript with:

```js
import.meta.env.VITE_GOOGLE_BOOKS_API_KEY
```

For example, the Google Books service uses:

```js
const API_KEY = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY
```

The same principle is used for translation and Firebase configuration.

## Why use `.env`?

Environment variables avoid writing configuration values directly in code.

Instead of:

```js
const API_KEY = 'my-api-key'
```

the project uses:

```js
const API_KEY = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY
```

Configuration can therefore differ by environment without changing service code.

## Git

The `.env` file must not be added to the Git repository.

The project `.gitignore` includes:

```text
.env
.env.local
.env.*.local
```

This prevents accidentally publishing local environment values.

## Frontend keys

Variables prefixed with `VITE_` are included in frontend code during the build.

They must therefore not be considered server secrets.

This applies especially to keys used for Google Books and Google Cloud Translation.

Restrictions and permissions should be configured with the relevant services when possible.

:::note
The `.env` file prevents local values from being versioned in Git, but it does not make a `VITE_` variable inaccessible to the user.
:::

## Firebase

Firebase configuration also uses environment variables.

It configures:

- the Firebase API;
- the authentication domain;
- the Firebase project;
- the database;
- storage;
- the application identifier.

These values are used by the application to initialize Firebase.

## Production environment

Variables required for the production build are not stored directly in the repository.

GitHub Actions workflows retrieve the required values from **GitHub Secrets** before running the build.

The principle is:

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

This keeps the deployment configuration available without adding the values directly to the repository.

## After a change

After adding or modifying a variable in `.env`, it may be necessary to restart the Vite server:

```bash
npm run dev
```

This lets Vite reload environment variables.

For production, modifying variables used by GitHub Actions also requires rerunning the workflow with the new configuration.

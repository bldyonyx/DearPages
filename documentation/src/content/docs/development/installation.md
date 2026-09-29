---
title: Installation
description: Installation et lancement du projet Dear Pages en environnement de développement.
---

Dear Pages est une application React créée avec **Vite**.

Le projet contient également une documentation séparée construite avec **Astro + Starlight**.

Cette page présente les étapes nécessaires pour récupérer le projet et lancer les différents environnements en local.

## Prérequis

Avant d'installer le projet, il est nécessaire d'avoir :

- **Node.js**
- **npm**
- **Git**

Un éditeur de code comme Visual Studio Code peut également être utilisé pour travailler sur le projet.

## Récupérer le projet

Le projet peut être cloné depuis son dépôt GitHub :

```bash
git clone https://github.com/bldyonyx/DearPages.git
```

Puis entrer dans le dossier :

```bash
cd DearPages
```

## Installer les dépendances

Les dépendances de l'application principale sont définies dans `package.json`.

Pour les installer :

```bash
npm install
```

Cette commande installe les dépendances nécessaires au fonctionnement de Dear Pages.

## Variables d'environnement

Dear Pages utilise plusieurs variables d'environnement pour communiquer avec ses services externes.

Elles sont notamment utilisées pour :

- Google Books ;
- Google Cloud Translation ;
- Firebase.

Un fichier `.env` doit être créé à la racine du projet pour le développement local.

```text
DearPages/
├── .env
├── src/
├── documentation/
├── package.json
└── vite.config.js
```

Les valeurs réelles des clés ne doivent pas être ajoutées à la documentation ni au dépôt Git.

Les variables utilisées par le projet sont détaillées dans la page **Variables d'environnement**.

:::note
Les variables utilisées côté frontend avec le préfixe `VITE_` sont intégrées au build et ne doivent pas être considérées comme des secrets serveur. Les clés concernées doivent donc être correctement restreintes auprès de leurs fournisseurs.
:::

## Lancer l'application

Une fois les dépendances installées et l'environnement configuré :

```bash
npm run dev
```

Vite démarre alors le serveur de développement et affiche l'adresse locale permettant d'ouvrir Dear Pages dans le navigateur.

## Build de production

Pour vérifier le build de l'application principale :

```bash
npm run build
```

Vite génère alors les fichiers optimisés de l'application dans le dossier de build.

Le déploiement de l'application principale est ensuite géré par GitHub Actions et Firebase Hosting.

## Documentation Astro

La documentation possède son propre projet Astro situé dans :

```text
documentation/
```

Depuis la racine de Dear Pages :

```bash
cd documentation
npm install
```

Puis lancer le serveur de développement :

```bash
npm run dev
```

La documentation peut ainsi être consultée localement pendant sa rédaction.

:::note
L'application React principale et la documentation Astro sont deux projets distincts. Chacun possède ses propres dépendances et son propre `package.json`.
:::

## Build de la documentation

Depuis le dossier `documentation/` :

```bash
npm run build
```

Astro génère alors la version statique de la documentation dans :

```text
documentation/dist/
```

Cette version est celle utilisée pour le déploiement Firebase Hosting.

## Déploiement automatique de la documentation

La documentation possède son propre site Firebase Hosting :

```text
https://dear-pages-docs.web.app
```

Le déploiement est automatisé avec GitHub Actions.

Lorsqu'une modification de la documentation est poussée sur la branche `main`, le workflow :

1. récupère le projet ;
2. installe les dépendances de la documentation ;
3. lance le build Astro ;
4. déploie `documentation/dist/` sur Firebase Hosting.

La documentation en ligne est donc mise à jour automatiquement après un push sur `main`.

## Documentation JSDoc

La référence technique JSDoc est générée depuis le projet principal.

Depuis la racine de Dear Pages :

```bash
npm run docs
```

Les fichiers générés sont placés dans :

```text
docs/
```

Ce dossier contient une documentation générée automatiquement et est différent du projet Astro situé dans `documentation/`.

## Résumé

Pour lancer l'application principale :

```bash
git clone https://github.com/bldyonyx/DearPages.git
cd DearPages
npm install
npm run dev
```

Pour lancer la documentation :

```bash
cd documentation
npm install
npm run dev
```

Pour construire la documentation :

```bash
npm run build
```

Après un push sur `main`, les workflows GitHub Actions s'occupent automatiquement des déploiements configurés pour l'application et la documentation.
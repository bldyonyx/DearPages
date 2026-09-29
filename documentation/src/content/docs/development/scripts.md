---
title: Scripts
description: Commandes npm utilisées pour développer, construire et documenter Dear Pages.
---

Dear Pages utilise plusieurs scripts **npm** pour simplifier les tâches courantes de développement.

Les scripts de l'application principale sont définis dans le `package.json` situé à la racine du projet.

## Lancer le serveur de développement

```bash
npm run dev
```

Cette commande démarre le serveur de développement Vite.

Elle permet de travailler sur l'application localement avec le rechargement automatique lorsque le code est modifié.

## Construire l'application

```bash
npm run build
```

Cette commande génère une version optimisée de Dear Pages destinée à la production.

Vite crée alors les fichiers nécessaires au déploiement.

## Prévisualiser le build

```bash
npm run preview
```

Cette commande permet de lancer localement la version générée par `npm run build`.

Elle est utile pour vérifier le comportement de la version de production avant son déploiement.

## Générer la documentation JSDoc

Dear Pages possède également un script permettant de générer automatiquement la documentation technique à partir des commentaires JSDoc présents dans le code.

```bash
npm run docs
```

Le script correspondant est :

```json
"docs": "jsdoc src -r -d docs"
```

JSDoc analyse récursivement le dossier `src` et génère la documentation dans :

```text
docs/
```

Ce dossier est généré automatiquement et est différent de la documentation Astro/Starlight.

## Documentation Astro

La documentation du projet possède son propre `package.json` dans :

```text
documentation/
```

Pour installer ses dépendances :

```bash
cd documentation
npm install
```

Pour lancer la documentation localement :

```bash
npm run dev
```

Cette commande démarre le serveur Astro utilisé pour consulter et modifier la documentation pendant son développement.

## Construire la documentation Astro

Depuis le dossier `documentation/` :

```bash
npm run build
```

Cette commande génère la version statique de la documentation dans :

```text
documentation/dist/
```

Cette version est utilisée lors du déploiement sur Firebase Hosting.

## Déploiement automatique

Le déploiement de la documentation est automatisé avec GitHub Actions.

Lorsqu'une modification est poussée sur `main`, le workflow de documentation :

1. installe les dépendances ;
2. construit la documentation avec Astro ;
3. récupère le dossier `documentation/dist/` ;
4. le déploie sur le site Firebase Hosting dédié à la documentation.

La documentation en ligne est donc mise à jour automatiquement après un push sur `main`.

## Deux projets npm

Dear Pages contient deux environnements npm distincts :

```text
DearPages/
├── package.json
│   └── application React + Vite
│
└── documentation/
    └── package.json
        └── documentation Astro + Starlight
```

Les commandes doivent être exécutées depuis le dossier correspondant au projet que l'on souhaite utiliser.

:::tip
Avant d'exécuter une commande npm, vérifier le dossier courant permet d'éviter de lancer un script de la documentation dans l'application principale, ou inversement.
:::

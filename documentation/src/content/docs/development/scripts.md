---
title: Scripts
description: Commandes npm utilisées pour développer, tester, construire et documenter Dear Pages.
---

Dear Pages utilise plusieurs scripts **npm** pour simplifier les tâches courantes de développement, de vérification et de documentation.

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

Cette commande est également utilisée pour vérifier que l'application peut être construite correctement avant son déploiement.

## Prévisualiser le build

```bash
npm run preview
```

Cette commande permet de lancer localement la version générée par `npm run build`.

Elle est utile pour vérifier le comportement de la version de production avant son déploiement.

## Vérifier le code avec ESLint

```bash
npm run lint
```

Cette commande analyse le code source avec ESLint.

Elle permet notamment de détecter certaines erreurs, incohérences ou utilisations problématiques avant le build ou le déploiement.

## Lancer les tests

Dear Pages utilise Vitest pour ses tests automatisés.

```bash
npm run test
```

Cette commande exécute la suite de tests du projet.

Les tests couvrent notamment certaines parties importantes de l'application comme :

- les services ;
- les utilitaires ;
- les hooks ;
- les composants ;
- certains comportements interactifs.

Ils complètent les vérifications manuelles réalisées sur les principaux parcours utilisateur.

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

Le déploiement de l'application et de la documentation est automatisé avec GitHub Actions.

Lorsqu'une modification concernée est poussée sur `main`, les workflows configurés peuvent notamment :

1. installer les dépendances ;
2. construire le projet concerné ;
3. récupérer les fichiers générés ;
4. les déployer sur la cible Firebase Hosting correspondante.

Dear Pages utilise deux cibles Firebase Hosting distinctes :

```text
app  → application React
docs → documentation Astro + Starlight
```

L'application et la documentation peuvent ainsi être déployées séparément.

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
---
title: Scripts
description: Commandes npm utilisées pour développer, tester, construire et documenter Dear Pages.
---

Dear Pages utilise plusieurs scripts **npm** pour le développement, les vérifications et la documentation. Les commandes de l'application principale sont définies dans le `package.json` à la racine du dépôt.

## Lancer le serveur de développement

```bash
npm run dev
```

Démarre Vite en mode développement, avec rechargement automatique lors des modifications du code.

## Construire l'application

```bash
npm run build
```

Génère la version de production dans `dist/`. Cette commande permet également de vérifier que l'application peut être construite sans erreur bloquante.

## Prévisualiser le build

```bash
npm run preview
```

Lance localement la version de production générée par `npm run build`.

## Vérifier le code avec Oxlint

```bash
npm run lint
```

Exécute **Oxlint**, l'outil d'analyse statique utilisé par Dear Pages. Il signale des erreurs et avertissements potentiels, notamment sur certaines pratiques React.

Le script défini à la racine est :

```json
"lint": "oxlint"
```

Un avertissement n'est pas nécessairement une erreur bloquante. Les résultats doivent être examinés selon leur impact réel.

## Lancer les tests automatisés

Dear Pages utilise **Vitest** et **React Testing Library** pour tester les services, les utilitaires, certains composants React et les comportements importants.

Pour lancer Vitest en mode interactif :

```bash
npm run test
```

Pour exécuter tous les tests une seule fois, notamment avant un déploiement :

```bash
npm run test:run
```

Ce dernier script correspond à `vitest run`.

Les tests automatisés complètent les vérifications manuelles des parcours utilisateurs ; ils ne les remplacent pas.

### Bilan de vérification du 9 octobre 2026

Sur la version vérifiée avant la présentation :

- **Oxlint :** 0 erreur et 11 avertissements non bloquants ;
- **Vitest :** 28 fichiers de tests validés, soit **246 tests réussis sur 246** ;
- **Vite :** build de production réussi.

Ces résultats correspondent à une exécution ponctuelle et ne garantissent pas, à eux seuls, l'absence de bugs.

## Générer la documentation JSDoc

```bash
npm run docs
```

Le script `jsdoc src -r -d docs` analyse les commentaires JSDoc du dossier `src/` et génère une documentation technique dans `docs/`.

Ce dossier généré est distinct du site de documentation Astro/Starlight.

## Documentation Astro et Starlight

La documentation possède son propre projet npm dans `documentation/`.

```bash
cd documentation
npm install
npm run dev
```

Pour produire la version statique du site, depuis `documentation/` :

```bash
npm run build
```

Le résultat se trouve dans `documentation/dist/` et peut être déployé sur Firebase Hosting.

## Déploiement automatique

Les workflows GitHub Actions construisent et déploient l'application et la documentation sur deux cibles Firebase Hosting distinctes :

```text
app  → application React
docs → documentation Astro + Starlight
```

Les workflows concernés peuvent installer les dépendances, construire le projet puis publier les fichiers générés lorsque les modifications sont poussées sur `main`.

## Deux environnements npm

```text
DearPages/
├── package.json           → application React + Vite
└── documentation/
    └── package.json       → documentation Astro + Starlight
```

:::tip
Vérifie toujours le dossier courant avant de lancer une commande npm : les scripts de l'application et ceux de la documentation sont indépendants.
:::

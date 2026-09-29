---
title: Choix techniques
description: Technologies choisies pour Dear Pages et raisons de leur utilisation.
---

Dear Pages utilise plusieurs technologies ayant chacune une responsabilité précise dans le projet.

Les choix ont été faits en fonction des besoins de l'application, mais également dans l'objectif de garder une architecture compréhensible et évolutive.

## React

**React** est utilisé pour construire l'interface utilisateur.

L'application contient de nombreuses parties pouvant être séparées en composants, comme :

- les cartes de livres ;
- la navigation ;
- les formulaires ;
- les sections du Dashboard ;
- les modales ;
- les éléments d'interface réutilisables.

React permet de construire ces éléments indépendamment puis de les assembler dans les différentes pages.

Il permet également de gérer les états nécessaires aux interactions de l'application.

## JavaScript

Dear Pages est actuellement développé en **JavaScript**.

JavaScript est utilisé pour :

- la logique des composants ;
- la gestion des états ;
- les événements utilisateur ;
- les transformations de données ;
- les appels aux services externes.

Les fonctions importantes ou moins évidentes sont documentées avec JSDoc lorsque cela apporte une information utile.

## Vite

**Vite** fournit l'environnement de développement de l'application React.

Il est notamment utilisé pour :

- lancer le serveur de développement ;
- gérer les variables d'environnement ;
- construire la version de production ;
- fournir un rechargement rapide pendant le développement.

Les variables accessibles au frontend utilisent notamment le préfixe :

```text
VITE_
```

## Tailwind CSS

**Tailwind CSS** est utilisé pour construire l'interface et gérer le responsive.

Les classes utilitaires permettent de définir directement :

- les espacements ;
- les tailles ;
- les grilles ;
- les flex layouts ;
- les breakpoints responsive ;
- les couleurs et autres propriétés visuelles.

Dear Pages utilise également une palette personnalisée afin de conserver une identité visuelle cohérente.

## React Router

**React Router** gère la navigation entre les différentes pages de l'application.

Il permet notamment d'utiliser :

- des routes imbriquées ;
- un layout partagé avec `Outlet` ;
- des routes dynamiques comme `/books/:id` et `/collections/:id` ;
- des paramètres de recherche comme `?q=` et `?view=for-you` ;
- une navigation sans rechargement complet de la page.

Les pages principales partagent `PageLayout`, tandis que les pages d'authentification utilisent une structure différente.

## Google Books API

**Google Books API** est utilisée comme source externe pour les informations publiques concernant les livres.

Elle est notamment utilisée pour :

- rechercher des livres ;
- fournir les suggestions de recherche ;
- récupérer les informations détaillées des livres ;
- récupérer des livres par sujet ;
- alimenter certaines recommandations.

Les données reçues sont normalisées par `booksApi.js` avant d'être utilisées dans les composants.

Google Books répond donc principalement à la question :

> Quelles sont les informations de ce livre ?

## Open Library

**Open Library** est utilisée pour l'étagère **Tendances du moment**.

Cette source permet de récupérer des livres classés comme tendance sans devoir maintenir une liste manuelle dans le projet.

Les données reçues sont normalisées dans `trendingBooksApi.js`.

Open Library ne remplace pas Google Books : les deux services fournissent des données publiques de livres, mais avec des identifiants et des formats différents.

## Google Cloud Translation API

**Google Cloud Translation API** est utilisée pour traduire certains contenus provenant des sources de livres.

Elle est notamment utilisée pour les **résumés des livres** lorsque le contenu récupéré doit être présenté dans la langue choisie par l'utilisateur.

Le service de traduction est isolé dans un service dédié afin de séparer les appels à l'API de l'interface React.

La clé utilisée par le service est fournie avec :

```text
VITE_GOOGLE_TRANSLATION_API_KEY
```

Comme les autres variables `VITE_`, cette valeur est utilisée côté frontend et ne doit pas être considérée comme un secret serveur.

## Recommandations temporaires

Le système de recommandations actuel repose encore sur des préférences temporaires.

Il utilise :

- des sujets Google Books ;
- les tendances Open Library ;
- une sélection aléatoire dans des lots de candidats ;
- une déduplication par ISBN, titre/auteur et identifiants source ;
- `sessionStorage` pour conserver les étagères pendant la session.

Cette architecture permet de gérer l'expérience de découverte tout en préparant son évolution vers des recommandations basées sur les préférences et les données de lecture de l'utilisateur.

## Firebase

**Firebase** est maintenant intégré à Dear Pages pour gérer les données propres à l'utilisateur.

Firebase est notamment utilisé pour :

- l'authentification ;
- les préférences de lecture ;
- les données personnelles associées au compte ;
- la bibliothèque et les fonctionnalités liées aux livres de l'utilisateur ;
- les collections ;
- les notes et avis personnels.

La configuration Firebase est fournie à l'application par des variables d'environnement.

La logique d'accès aux fonctionnalités Firebase est séparée dans des services et des contextes afin de ne pas placer directement les appels Firebase dans les composants d'interface.

Firebase répond donc à une question différente des API de livres :

> Quelle est la relation de l'utilisateur avec ce livre ?

## JSDoc

**JSDoc** est utilisé pour documenter directement certaines parties importantes du code JavaScript.

Il est particulièrement adapté aux services, hooks, utilitaires et fonctions dont le contrat mérite d'être explicité.

La documentation technique peut être générée automatiquement avec :

```bash
npm run docs
```

## Astro et Starlight

La documentation que vous consultez est construite avec **Astro** et **Starlight**.

Elle est volontairement séparée de l'application React principale :

```text
DearPages/
├── src/                → application React
├── docs/               → documentation JSDoc générée
└── documentation/      → documentation Astro + Starlight
```

Starlight fournit une structure adaptée à une documentation technique, tandis que le thème personnalisé permet de conserver l'identité visuelle de Dear Pages.

La documentation possède son propre environnement npm et son propre build Astro.

Elle est également déployée séparément sur Firebase Hosting.

## Séparation des responsabilités

L'ensemble de ces choix peut être résumé ainsi :

| Technologie | Responsabilité |
| --- | --- |
| React | Interface et composants |
| JavaScript | Logique de l'application |
| Vite | Environnement de développement et build |
| Tailwind CSS | Styles et responsive |
| React Router | Navigation |
| Google Books API | Recherche et informations publiques des livres |
| Open Library | Tendances de lecture |
| Google Cloud Translation API | Traduction des résumés |
| sessionStorage | Persistance temporaire des recommandations |
| Firebase | Authentification et données personnelles |
| JSDoc | Documentation technique du code |
| Astro + Starlight | Documentation du projet |

L'objectif est que chaque technologie réponde à un besoin identifiable plutôt que d'ajouter des outils sans rôle précis.
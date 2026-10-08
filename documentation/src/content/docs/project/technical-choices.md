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

Dear Pages est développé en **JavaScript**.

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

## i18next et react-i18next

**i18next** et **react-i18next** sont utilisés pour rendre l'interface disponible en français et en anglais.

La configuration se trouve dans :

```text
src/i18n/index.js
```

Elle charge les ressources :

```text
src/i18n/locales/fr.json
src/i18n/locales/en.json
```

Les composants utilisent `useTranslation` pour récupérer les libellés avec `t(...)` et accéder à `i18n.changeLanguage(...)` lorsque l'utilisateur change de langue.

Le choix est conservé dans `localStorage` afin de rester disponible avant authentification. Une fois l'utilisateur connecté, la langue peut aussi être synchronisée avec ses préférences Firebase.

## Google Books API

**Google Books API** est utilisée comme source externe principale pour les informations publiques concernant les livres.

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

**Open Library** complète Google Books dans certaines parties de l'application.

Elle est notamment utilisée pour :

- alimenter l'étagère **Tendances du moment** ;
- récupérer certaines données publiques de livres ;
- résoudre certaines couvertures à partir d'un ISBN lorsqu'une meilleure source est disponible.

Les données de tendances sont normalisées dans `trendingBooksApi.js`.

Open Library ne remplace pas Google Books : les deux services fournissent des données publiques de livres, mais avec des identifiants et des formats différents.

## Google Cloud Translation API

**Google Cloud Translation API** est utilisée pour traduire certains contenus provenant des sources de livres.

Elle est notamment utilisée pour les **résumés des livres** lorsqu'un résumé doit être présenté dans la langue active de l'interface.

Le service de traduction est isolé dans un service dédié afin de séparer les appels à l'API de l'interface React.

La clé utilisée par le service est fournie avec :

```text
VITE_GOOGLE_TRANSLATION_API_KEY
```

Comme les autres variables `VITE_`, cette valeur est utilisée côté frontend et ne doit pas être considérée comme un secret serveur.

## Recommandations

Le système de recommandations combine les préférences enregistrées de l'utilisateur avec les données publiques provenant des API de livres.

Il utilise notamment :

- les genres préférés enregistrés dans Firebase ;
- des sujets Google Books correspondant à ces préférences ;
- les tendances Open Library pour certaines étagères ;
- des lots de candidats afin de renouveler les sélections ;
- une déduplication par ISBN, titre/auteur et identifiants source ;
- un suivi des livres déjà proposés pendant la session ;
- `sessionStorage` pour conserver certaines sélections pendant la session.

Cette organisation permet de proposer plusieurs étagères indépendantes tout en limitant les répétitions lors des rafraîchissements.

Les surfaces de découverte automatiques appliquent également des règles de sélection afin d'éviter de recommander automatiquement certains contenus clairement inadaptés.

Le système reste volontairement plus simple qu'un moteur de recommandation complet basé sur l'historique de lecture : les préférences de genres constituent actuellement la principale source de personnalisation.

## Firebase

**Firebase** est utilisé pour gérer les données propres à l'utilisateur ainsi que plusieurs services nécessaires au fonctionnement et au déploiement de Dear Pages.

Firebase Authentication est utilisé pour :

- la création de compte ;
- la connexion avec e-mail et mot de passe ;
- la connexion avec Google ;
- la gestion de la session utilisateur ;
- la déconnexion ;
- la suppression du compte.

Firebase Realtime Database est utilisé pour enregistrer notamment :

- les préférences de lecture ;
- la langue préférée ;
- la bibliothèque personnelle ;
- les statuts de lecture ;
- les collections ;
- les notes personnelles ;
- les évaluations ;
- les avis ;
- les informations personnelles associées aux livres.

Les données sont organisées par utilisateur afin d'isoler les informations de chaque compte.

La configuration Firebase est fournie à l'application par des variables d'environnement.

La logique d'accès aux fonctionnalités Firebase est séparée dans des services et des contextes afin de ne pas placer directement les appels Firebase dans les composants d'interface.

Firebase répond donc à une question différente des API de livres :

> Quelle est la relation de l'utilisateur avec ce livre ?

## Firebase Hosting

**Firebase Hosting** est utilisé pour publier Dear Pages.

Le projet possède deux cibles distinctes :

```text
app  → application React
docs → documentation Astro + Starlight
```

Cette séparation permet de déployer indépendamment l'application principale et sa documentation tout en utilisant le même projet Firebase.

## GitHub Actions

**GitHub Actions** est utilisé pour automatiser une partie du processus de déploiement.

Les workflows du projet permettent notamment de :

- installer les dépendances ;
- construire l'application ;
- déployer Dear Pages sur Firebase Hosting ;
- créer des previews Firebase pour les Pull Requests de l'application ;
- construire et déployer la documentation.

Le déploiement depuis la branche principale peut ainsi être effectué automatiquement après les modifications validées du projet.

## Vitest et React Testing Library

**Vitest** est utilisé pour les tests automatisés de Dear Pages.

Il s'intègre naturellement à l'environnement Vite du projet et permet de tester notamment :

- les services ;
- les utilitaires ;
- les hooks ;
- certains composants ;
- les comportements interactifs importants.

**React Testing Library** complète Vitest pour tester les composants React à travers leur comportement observable plutôt que leur implémentation interne.

Les tests automatisés complètent les vérifications manuelles réalisées sur les principaux parcours de l'application.

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
| Open Library | Tendances et certaines couvertures |
| Google Cloud Translation API | Traduction des résumés vers la langue active |
| i18next / react-i18next | Interface bilingue français / anglais |
| `sessionStorage` | Persistance temporaire de certaines recommandations |
| Firebase Authentication | Comptes et authentification |
| Firebase Realtime Database | Données personnelles persistantes |
| Firebase Hosting | Hébergement de l'application et de la documentation |
| GitHub Actions | Automatisation du déploiement |
| Vitest | Tests automatisés |
| React Testing Library | Tests des composants React |
| JSDoc | Documentation technique du code |
| Astro + Starlight | Documentation du projet |

L'objectif est que chaque technologie réponde à un besoin identifiable plutôt que d'ajouter des outils sans rôle précis.

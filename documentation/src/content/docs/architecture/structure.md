---
title: Structure du projet
description: Organisation des fichiers et dossiers principaux de Dear Pages.
---

Dear Pages sépare les **pages**, les **composants**, les **hooks**, les **services**, les **utilitaires** et les ressources de l'application. Cette organisation distingue l'affichage, la logique métier et l'accès aux données externes.

## Structure principale

```text
DearPages/
├── .github/workflows/          → CI/CD et déploiements
├── documentation/              → documentation Astro + Starlight
├── src/
│   ├── assets/                → images, polices et textures
│   ├── components/            → composants React par fonctionnalité
│   ├── constants/             → valeurs partagées
│   ├── context/               → contextes React
│   ├── hooks/                 → hooks personnalisés
│   ├── i18n/                  → configuration FR/EN et traductions
│   ├── pages/                 → pages reliées aux routes
│   ├── services/              → API et accès aux données
│   ├── test/                  → tests automatisés
│   ├── utils/                 → logique réutilisable
│   ├── App.jsx
│   ├── index.css
│   └── main.jsx
├── .firebaserc
├── firebase.json
├── package.json
└── vite.config.js
```

Les variables locales d'environnement sont définies dans des fichiers `.env` appropriés, qui ne doivent pas contenir de secrets versionnés dans Git.

## `src/components`

Les composants React sont regroupés par domaine fonctionnel :

```text
components/
├── auth/
├── books/
├── collections/
├── dashboard/
├── discover/
├── layout/
├── settings/
└── ui/
```

Les composants de `ui/` sont réutilisables ; les autres regroupent les éléments propres à une page ou fonctionnalité.

## `src/pages`

Les pages principales comprennent notamment `Dashboard.jsx`, `Discover.jsx`, `MyLibrary.jsx`, `BookPage.jsx`, `Collections.jsx`, `CollectionPage.jsx`, `Settings.jsx`, `Login.jsx`, `SignUp.jsx` et `Onboarding.jsx`.

`App.jsx` définit les routes, notamment les pages privées, les écrans d'authentification et l'onboarding. Les pages de l'application utilisent un layout commun, tandis que l'authentification possède sa propre présentation.

## `src/context` et `src/hooks`

Le contexte d'authentification centralise l'utilisateur connecté et ses préférences. Les hooks personnalisés encapsulent les états et les chargements complexes, notamment la recherche, les recommandations, les étagères Découvrir et la traduction des descriptions.

## `src/services` : séparation des responsabilités

Les services isolent les appels à Firebase et aux API externes afin que les composants React ne gèrent pas directement la communication avec ces sources.

On retrouve notamment :

- `authService.js` pour les opérations d'authentification ;
- `firebase.js` pour la configuration Firebase ;
- `preferencesService.js` pour les préférences ;
- `libraryService.js` pour la bibliothèque et les informations personnelles liées aux livres ;
- `collectionsService.js` pour les collections ;
- `translationService.js` pour la traduction des résumés ;
- `booksApi.js` et `books/` pour les données publiques de livres.

### Organisation des services de livres

La logique de livres a été répartie en modules spécialisés :

```text
src/services/
├── booksApi.js
└── books/
    ├── bookSearchService.js
    ├── bookSubjectService.js
    ├── googleBooksApi.js
    ├── googleBooksFormatter.js
    ├── openLibraryApi.js
    ├── trendingBooksApi.js
    └── coverUtils.js
```

**`booksApi.js` reste le point d'entrée public** : il réexporte les fonctions utilisées par le reste de l'application, tout en conservant les imports existants.

Les modules ont des rôles distincts :

| Module | Responsabilité |
| --- | --- |
| `bookSearchService.js` | Recherche principale, suggestions et combinaison des résultats |
| `bookSubjectService.js` | Recherche par sujet et récupération de candidats pour les recommandations |
| `googleBooksApi.js` | Requêtes et récupération de données Google Books |
| `googleBooksFormatter.js` | Normalisation des réponses Google Books |
| `openLibraryApi.js` | Requêtes et récupération de données Open Library |
| `trendingBooksApi.js` | Tendances et fonctions de recherche complémentaires Open Library |
| `coverUtils.js` | Traitement et résolution des couvertures |

Cette séparation facilite les tests, la maintenance et l'évolution de la recherche sans concentrer toute la logique dans un seul fichier.

## `src/utils`

Les utilitaires contiennent des fonctions indépendantes de l'affichage, notamment pour :

- la pertinence des résultats de recherche ;
- la sélection et la déduplication des recommandations ;
- la gestion des couvertures et des fallbacks ;
- la normalisation et la transformation des données ;
- la gestion des dates et des traductions.

## `src/i18n`

```text
i18n/
├── index.js
└── locales/
    ├── en.json
    └── fr.json
```

La configuration i18next charge les ressources françaises et anglaises. Les composants utilisent `useTranslation` pour afficher les libellés selon la langue active.

## `src/test`

Les tests Vitest couvrent notamment les services, les utilitaires, les comportements d'authentification, la recherche, les recommandations, les composants et certains cas de sécurité. React Testing Library permet de tester les interactions observables des composants.

## Firebase et données personnelles

Firebase Authentication gère les comptes et les sessions. Firebase Realtime Database conserve les bibliothèques, les collections, les préférences et les informations personnelles de lecture, organisées par utilisateur.

Les fichiers `.firebaserc` et `firebase.json` définissent les cibles Firebase Hosting :

```text
app  → application Dear Pages
docs → documentation Astro + Starlight
```

## GitHub Actions et documentation

Les workflows de `.github/workflows/` automatisent les builds et les déploiements de l'application et de la documentation.

Le projet possède deux formes de documentation :

```text
docs/              → JSDoc généré avec npm run docs
documentation/     → site Astro + Starlight versionné
```

Le site Astro possède son propre `package.json`, son propre build et sa propre cible Firebase Hosting.

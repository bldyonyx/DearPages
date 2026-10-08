---
title: Structure du projet
description: Organisation des fichiers et dossiers principaux de Dear Pages.
---

Dear Pages est organisé en plusieurs dossiers afin de séparer l'interface, les pages, les services, les hooks, le contexte global, les constantes, les utilitaires et les ressources de l'application.

Cette organisation permet de garder le projet lisible et de séparer les responsabilités entre l'affichage, la gestion des données et les intégrations externes.

## Structure principale

Le projet se trouve dans le dossier `DearPages`.

```text
DearPages/
├── .github/
│   └── workflows/
├── documentation/
├── src/
│   ├── assets/
│   ├── components/
│   ├── constants/
│   ├── context/
│   ├── hooks/
│   ├── i18n/
│   ├── pages/
│   ├── services/
│   ├── utils/
│   ├── App.jsx
│   ├── index.css
│   └── main.jsx
├── .env
├── .firebaserc
├── firebase.json
├── package.json
└── vite.config.js
```

## `src/assets`

Ce dossier contient les ressources visuelles utilisées par l'application :

- polices locales ;
- images ;
- textures ;
- illustrations utilisées dans l'interface.

## `src/components`

Ce dossier regroupe les composants React de l'application.

Ils sont organisés par fonctionnalité afin d'éviter de placer tous les composants dans un même dossier.

On y retrouve notamment des composants liés :

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

Cette organisation permet de distinguer les composants spécifiques à une fonctionnalité des composants de structure ou réutilisables.

## `src/constants`

Ce dossier contient les valeurs partagées utilisées à plusieurs endroits dans l'application.

Il contient notamment les données statiques nécessaires à certaines fonctionnalités, comme les genres disponibles pour les préférences de lecture.

Les préférences propres à l'utilisateur ne sont pas stockées dans ce dossier : elles sont enregistrées dans Firebase.

## `src/context`

Ce dossier contient les contextes React utilisés pour partager certaines données à travers l'application.

Il contient notamment le contexte d'authentification, qui centralise l'état de l'utilisateur connecté ainsi que ses préférences.

Cela permet aux routes et aux composants concernés d'accéder à ces informations sans les transmettre manuellement à travers plusieurs niveaux de composants.

## `src/hooks`

Ce dossier regroupe les hooks personnalisés.

Ils permettent d'extraire de la logique React complexe hors des composants et de centraliser la gestion de certains états ou chargements de données.

Les fonctionnalités de Découvrir utilisent notamment des hooks dédiés pour :

- la recherche ;
- le chargement des différentes étagères ;
- les recommandations personnalisées ;
- la gestion des données affichées.

La fiche d'un livre utilise également un hook dédié pour gérer l'état de traduction du résumé, la langue cible et le cache de session associé.

## `src/i18n`

Ce dossier contient la configuration bilingue de l'application.

```text
i18n/
├── index.js
└── locales/
    ├── en.json
    └── fr.json
```

`index.js` initialise i18next avec react-i18next, déclare les langues supportées et charge les ressources de traduction.

Les fichiers `fr.json` et `en.json` contiennent les libellés de l'interface. Ils suivent la même organisation de clés afin que les composants puissent utiliser les mêmes appels `t(...)` quelle que soit la langue active.

## `src/pages`

Ce dossier contient les composants utilisés directement par React Router pour représenter les différentes pages de l'application.

On y retrouve notamment :

- `Dashboard.jsx`
- `Discover.jsx`
- `MyLibrary.jsx`
- `BookPage.jsx`
- `Collections.jsx`
- `CollectionPage.jsx`
- `Settings.jsx`
- `Login.jsx`
- `SignUp.jsx`
- `Onboarding.jsx`

Ces pages utilisent maintenant les données réelles de l'utilisateur lorsque la fonctionnalité concernée dépend de Firebase.

## `src/services`

Ce dossier isole la communication avec les services externes et la logique d'accès aux données.

Les services permettent notamment de gérer :

- Google Books ;
- Open Library ;
- Firebase Authentication ;
- les préférences utilisateur ;
- la bibliothèque personnelle ;
- les collections ;
- les données personnelles associées aux livres ;
- les traductions utilisées par l'application.

Cette séparation évite de placer directement les appels API ou Firebase dans les composants d'interface.

## `src/utils`

Ce dossier contient la logique réutilisable qui n'est pas directement liée à l'affichage.

Les utilitaires servent notamment à :

- normaliser certaines données provenant des API ;
- sélectionner et dédupliquer des recommandations ;
- gérer les couvertures et leurs fallbacks ;
- éviter ou partager certaines requêtes identiques ;
- détecter la langue des descriptions et construire les clés de cache des traductions ;
- transformer les données avant leur utilisation dans l'interface.

Ils permettent de garder les composants et les services plus simples.

## Routing

`App.jsx` centralise les routes principales de Dear Pages.

L'application distingue notamment :

- les routes accessibles uniquement aux utilisateurs connectés ;
- les routes publiques d'authentification ;
- l'onboarding ;
- les pages affichées dans le layout principal.

Des composants dédiés contrôlent l'accès aux routes selon l'état d'authentification et les préférences de l'utilisateur.

## Firebase

La configuration Firebase permet à Dear Pages d'utiliser :

- Firebase Authentication ;
- Firebase Realtime Database ;
- Firebase Hosting.

Les données personnelles sont organisées par utilisateur afin d'isoler les bibliothèques, collections, préférences et informations de lecture.

Les fichiers :

```text
.firebaserc
firebase.json
```

configurent également les deux cibles Firebase Hosting :

```text
app  → application Dear Pages
docs → documentation Astro + Starlight
```

## GitHub Actions

Le dossier :

```text
.github/workflows/
```

contient les workflows de CI/CD du projet.

Ils automatisent notamment :

- l'installation des dépendances ;
- le build de l'application ;
- le déploiement de Dear Pages sur Firebase Hosting ;
- les previews Firebase des Pull Requests ;
- le build et le déploiement de la documentation.

L'application et la documentation utilisent deux cibles Firebase Hosting distinctes.

## Documentation

Le projet possède deux formes de documentation.

```text
docs/              → documentation JSDoc générée
documentation/     → documentation Astro + Starlight
```

Le dossier `docs/` est généré avec :

```bash
npm run docs
```

Il contient la documentation technique générée à partir des commentaires JSDoc du code et reste ignoré par Git.

Le dossier :

```text
documentation/src/content/docs/
```

contient les pages Astro/Starlight écrites à la main et versionnées avec le projet.

La documentation possède son propre environnement Astro, son propre build et son propre déploiement Firebase Hosting.

---
title: Firebase
description: Utilisation de Firebase pour l'authentification et les données personnelles de Dear Pages.
---

Dear Pages utilise **Firebase** pour gérer l'authentification et les données personnelles associées aux utilisateurs.

Contrairement à Google Books et Open Library, qui fournissent les informations publiques sur les livres, Firebase permet de conserver les informations propres à chaque compte.

## Rôle de Firebase

Firebase intervient principalement dans deux parties de l'application :

- **Firebase Authentication** pour créer, connecter et identifier les utilisateurs ;
- **Firebase Realtime Database** pour conserver leurs données personnelles.

Les informations bibliographiques des livres continuent à provenir de Google Books et Open Library.

## Authentification

Firebase Authentication gère les comptes utilisateurs et leur état de connexion.

Dear Pages prend en charge notamment :

- la création de compte ;
- la connexion ;
- la déconnexion ;
- l'authentification avec Google ;
- la récupération des informations du compte connecté ;
- la suppression du compte.

Le contexte d'authentification permet à l'application de connaître l'utilisateur actuellement connecté et de rendre ses données personnelles accessibles uniquement dans son espace.

Le parcours général est :

```text
Inscription / Connexion
        │
        ▼
Firebase Authentication
        │
        ▼
Utilisateur identifié
        │
        ▼
Accès aux données personnelles
```

Les principales pages liées à ce parcours sont :

```text
pages/
├── Login.jsx
├── SignUp.jsx
└── Onboarding.jsx
```

## Authentification Google

Dear Pages permet également de se connecter avec un compte Google grâce à Firebase Authentication.

Lorsqu'un utilisateur utilise cette méthode, Firebase fournit les informations de compte nécessaires à l'application, notamment son identité Firebase et les informations de profil disponibles auprès du fournisseur.

Ces informations sont ensuite utilisées par Dear Pages pour afficher le profil de l'utilisateur.

## Données personnelles

Les données personnelles sont séparées des informations publiques provenant des API de livres.

Elles comprennent notamment :

- les informations du profil ;
- les préférences de lecture ;
- l'objectif annuel ;
- la bibliothèque personnelle ;
- les statuts de lecture ;
- les collections ;
- les notes et avis personnels.

Ces données sont associées au compte Firebase de l'utilisateur.

## Préférences de lecture

Les préférences de lecture sont enregistrées avec les données de l'utilisateur.

Elles comprennent notamment :

- les genres préférés ;
- l'objectif annuel de lecture.

Ces informations sont utilisées par Dear Pages pour personnaliser certaines parties de l'application, notamment les recommandations.

Elles peuvent être modifiées depuis la page **Paramètres**.

## Bibliothèque

La bibliothèque personnelle utilise les données utilisateur enregistrées dans Firebase.

Elle permet notamment de conserver :

- les livres ajoutés ;
- leur statut de lecture ;
- leur date d'ajout ;
- les informations nécessaires à leur affichage.

Les données du livre provenant de Google Books ou Open Library restent séparées des informations propres à l'utilisateur.

Cela permet par exemple à deux utilisateurs d'avoir le même livre dans leur bibliothèque avec des statuts différents.

## Collections

Les collections sont également des données personnelles.

Elles permettent à chaque utilisateur de créer ses propres regroupements de livres indépendamment de leur statut de lecture.

Une collection appartient à l'utilisateur qui l'a créée et peut contenir plusieurs livres de sa bibliothèque.

## Notes et avis

Les notes et avis sont associés au compte de l'utilisateur.

Ils représentent son appréciation personnelle d'un livre et ne sont pas envoyés vers Google Books ou Open Library.

Dear Pages conserve donc ces informations comme des données privées liées à l'utilisateur.

## Services Firebase

La logique d'accès aux données Firebase est séparée de l'interface React.

Les services dédiés permettent aux composants et aux pages de communiquer avec Firebase sans placer directement toute la logique de persistance dans les composants.

L'organisation comprend notamment des services liés à :

```text
services/
├── authService.js
├── preferencesService.js
└── ...
```

Cette séparation permet de garder les composants principalement responsables de l'affichage et de l'interaction avec l'utilisateur.

## Flux des données

Le fonctionnement général peut être représenté ainsi :

```text
Google Books / Open Library
          │
          ▼
   Informations du livre
          │
          ▼
      Dear Pages
          │
     ┌────┴────┐
     │         │
     ▼         ▼
Interface   Firebase
React           │
                ├── Authentification
                ├── Profil
                ├── Préférences
                ├── Bibliothèque
                ├── Collections
                └── Données de lecture
```

Les différentes sources ont donc des responsabilités distinctes :

**Google Books et Open Library fournissent les informations publiques sur les livres.**

**Firebase conserve les données propres à l'utilisateur et sa relation avec ces livres.**

## Suppression du compte

Dear Pages permet également à l'utilisateur de demander la suppression de son compte depuis les paramètres.

La suppression passe par Firebase Authentication et les données personnelles associées au compte sont également prises en compte dans ce processus.

Certaines opérations sensibles peuvent nécessiter une réauthentification récente de l'utilisateur avant de pouvoir être effectuées.

## Sécurité et séparation des données

Les données personnelles sont associées à l'utilisateur authentifié.

L'application ne traite donc pas les données de bibliothèque, de collections ou de préférences comme des données globales partagées entre tous les utilisateurs.

Cette séparation est essentielle pour conserver un espace de lecture personnel pour chaque compte.

## Évolution

Firebase constitue maintenant une partie active de l'architecture de Dear Pages.

La documentation pourra continuer à être précisée au fur et à mesure que de nouvelles fonctionnalités utilisant les données utilisateur seront ajoutées, notamment autour de la bibliothèque, des collections et des données de lecture.
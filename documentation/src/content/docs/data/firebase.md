---
title: Firebase
description: Utilisation de Firebase pour l'authentification, les données personnelles et l'hébergement de Dear Pages.
---

Dear Pages utilise **Firebase** pour gérer l'authentification, les données personnelles associées aux utilisateurs et l'hébergement du projet.

Contrairement à Google Books et Open Library, qui fournissent les informations publiques sur les livres, Firebase permet de conserver les informations propres à chaque compte et de déployer l'application ainsi que sa documentation.

## Rôle de Firebase

Firebase intervient principalement dans trois parties de Dear Pages :

- **Firebase Authentication** pour créer, connecter et identifier les utilisateurs ;
- **Cloud Firestore** pour conserver leurs données personnelles ;
- **Firebase Hosting** pour héberger l'application et sa documentation.

Les informations bibliographiques des livres continuent à provenir de Google Books et Open Library.

## Authentification

Firebase Authentication gère les comptes utilisateurs et leur état de connexion.

Dear Pages prend notamment en charge :

- la création de compte avec une adresse e-mail et un mot de passe ;
- la connexion avec une adresse e-mail et un mot de passe ;
- l'authentification avec Google ;
- la déconnexion ;
- la récupération des informations du compte connecté ;
- la conservation de la session ;
- la suppression du compte.

Le contexte d'authentification permet à l'application de connaître l'utilisateur actuellement connecté et de rendre ses données personnelles accessibles dans son espace.

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
Chargement des données personnelles
        │
        ▼
Accès à Dear Pages
```

Les principales pages liées à ce parcours sont :

```text
pages/
├── Login.jsx
├── SignUp.jsx
└── Onboarding.jsx
```

Les routes protégées utilisent également l'état d'authentification afin d'empêcher un utilisateur non connecté d'accéder aux pages personnelles de l'application.

## Authentification Google

Dear Pages permet également de se connecter avec un compte Google grâce à Firebase Authentication.

Lorsqu'un utilisateur utilise cette méthode, Firebase fournit les informations de compte nécessaires à l'application, notamment son identité Firebase et les informations de profil disponibles auprès du fournisseur.

Ces informations sont ensuite utilisées par Dear Pages pour identifier l'utilisateur et afficher les informations de profil disponibles.

## Cloud Firestore

**Cloud Firestore** constitue la base de données utilisée par Dear Pages pour les informations propres aux utilisateurs.

Les données sont organisées de manière à être associées à l'identifiant Firebase du compte concerné.

Elles comprennent notamment :

- les préférences de lecture ;
- l'objectif annuel ;
- la bibliothèque personnelle ;
- les statuts de lecture ;
- les collections ;
- les notes personnelles ;
- les évaluations ;
- les avis ;
- les informations de lecture associées aux livres.

Cette organisation permet de conserver séparément les données de chaque utilisateur.

## Préférences de lecture

Les préférences de lecture sont enregistrées avec les données de l'utilisateur.

Elles comprennent notamment :

- les genres préférés ;
- l'objectif annuel de lecture.

Ces informations sont utilisées par Dear Pages pour personnaliser certaines parties de l'application, notamment :

- les recommandations de la page Découvrir ;
- l'objectif annuel affiché sur le Dashboard.

Elles peuvent être définies pendant l'onboarding puis modifiées depuis la page **Paramètres**.

## Bibliothèque

La bibliothèque personnelle utilise les données utilisateur enregistrées dans Cloud Firestore.

Elle permet notamment de conserver :

- les livres ajoutés ;
- leur statut de lecture ;
- leur date d'ajout ;
- les informations nécessaires à leur affichage ;
- certaines informations liées au suivi de la lecture.

Les données publiques du livre provenant de Google Books ou Open Library restent conceptuellement séparées des informations propres à l'utilisateur.

Cela permet par exemple à deux utilisateurs d'avoir le même livre dans leur bibliothèque avec des statuts et des données personnelles différents.

## Collections

Les collections sont également des données personnelles enregistrées dans Firestore.

Elles permettent à chaque utilisateur de créer ses propres regroupements de livres indépendamment de leur statut de lecture.

L'utilisateur peut notamment :

- créer une collection ;
- modifier une collection ;
- supprimer une collection ;
- ajouter des livres ;
- retirer des livres ;
- consulter le contenu d'une collection.

Une collection appartient au compte qui l'a créée.

Retirer un livre d'une collection ne supprime pas le livre de la bibliothèque personnelle.

## Notes, évaluations et avis

Les données personnelles associées aux livres sont également conservées avec les données de l'utilisateur.

Elles peuvent notamment comprendre :

- des notes personnelles ;
- une évaluation en étoiles ;
- un avis ;
- certaines informations liées à la fin d'une lecture.

Ces informations représentent la relation personnelle de l'utilisateur avec le livre.

Elles ne sont pas envoyées vers Google Books ou Open Library et ne constituent pas des critiques publiques.

## Services Firebase

La logique d'accès à Firebase est séparée de l'interface React.

Les services dédiés permettent aux composants et aux pages de communiquer avec Firebase sans placer directement toute la logique de persistance dans les composants.

L'organisation comprend notamment des services responsables de :

```text
services/
├── authentification
├── préférences
├── bibliothèque
├── collections
└── données personnelles des livres
```

Cette séparation permet de garder les composants principalement responsables de l'affichage et de l'interaction avec l'utilisateur.

## Flux des données

Le fonctionnement général peut être représenté ainsi :

```text
Google Books / Open Library
          │
          ▼
   Informations publiques
          │
          ▼
      Dear Pages
          │
     ┌────┴────┐
     │         │
     ▼         ▼
Interface   Firebase
React          │
               ├── Authentication
               │
               └── Cloud Firestore
                    ├── Préférences
                    ├── Bibliothèque
                    ├── Collections
                    └── Données de lecture
```

Les différentes sources ont donc des responsabilités distinctes :

**Google Books et Open Library fournissent les informations publiques sur les livres.**

**Firebase Authentication identifie l'utilisateur.**

**Cloud Firestore conserve les données propres à l'utilisateur et sa relation avec les livres.**

## Suppression du compte

Dear Pages permet à l'utilisateur de demander la suppression de son compte depuis les paramètres.

La suppression passe par Firebase Authentication et les données personnelles associées au compte sont également prises en compte dans ce processus.

Certaines opérations sensibles peuvent nécessiter une authentification récente de l'utilisateur avant de pouvoir être effectuées.

## Sécurité et séparation des données

Les données personnelles sont associées à l'utilisateur authentifié.

L'application ne traite donc pas les données de bibliothèque, de collections ou de préférences comme des données globales partagées entre tous les utilisateurs.

Cette séparation est essentielle pour conserver un espace de lecture personnel pour chaque compte.

Les informations publiques provenant des API de livres et les informations personnelles stockées dans Firebase remplissent ainsi des rôles différents dans l'architecture.

## Firebase Hosting

Firebase est également utilisé pour héberger Dear Pages.

Le projet possède deux cibles Firebase Hosting :

```text
app  → application Dear Pages
docs → documentation Astro + Starlight
```

Cette séparation permet à l'application et à sa documentation de disposer de leurs propres sites tout en restant rattachées au même projet Firebase.

Les déploiements sont automatisés avec GitHub Actions.

Le flux général est :

```text
Push sur main
      │
      ▼
GitHub Actions
      │
      ├── Build de l'application
      │        ↓
      │   Firebase Hosting → app
      │
      └── Build de la documentation
               ↓
          Firebase Hosting → docs
```

## État actuel

Firebase fait partie intégrante de l'architecture finale de Dear Pages.

Il prend en charge :

- l'authentification ;
- les sessions utilisateur ;
- les préférences de lecture ;
- la bibliothèque ;
- les statuts de lecture ;
- les collections ;
- les données personnelles associées aux livres ;
- la suppression du compte ;
- l'hébergement de l'application ;
- l'hébergement de la documentation.

Cette architecture permet de conserver une séparation claire entre les **données publiques des livres**, fournies par les API externes, et les **données personnelles de lecture**, enregistrées pour chaque utilisateur avec Firebase.
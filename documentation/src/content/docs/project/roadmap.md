---
title: Roadmap
description: État actuel du développement et prochaines étapes de Dear Pages.
---

Dear Pages est développé progressivement, en commençant par la structure générale de l'application avant d'ajouter les fonctionnalités liées aux données personnelles.

Cette roadmap présente l'état actuel du projet et les principales étapes prévues pour la suite du développement.

:::note
Cette page évolue avec le projet. Une fonctionnalité n'est cochée que lorsqu'elle existe réellement dans l'application.
:::

## Base du projet

Les fondations principales de l'application sont en place.

- [x] Création du projet avec React et Vite
- [x] Mise en place de Tailwind CSS v4
- [x] Création de la palette et de l'identité visuelle
- [x] Ajout des polices et textures
- [x] Mise en place de React Router
- [x] Définition des routes principales dans `App.jsx`
- [x] Création du layout responsive avec `PageLayout`
- [x] Navigation desktop, tablette et mobile
- [x] Création des composants UI de base
- [x] Nom officiel Dear Pages

## Dashboard

Le Dashboard constitue la première page principale développée.

- [x] Header du Dashboard
- [x] Recherche depuis le Dashboard
- [x] Section de lecture en cours
- [x] Objectif de lecture
- [x] Livres récemment ajoutés
- [x] Statistiques de lecture
- [x] Compagnon de lecture
- [x] Adaptation responsive
- [x] Connexion progressive aux données utilisateur
- [ ] Personnalisation finale du Dashboard
- [ ] Animations et micro-interactions

## API et données publiques

L'application utilise plusieurs sources externes pour les données de livres et leur traduction.

- [x] Configuration de Google Books API
- [x] Création de `booksApi.js`
- [x] Recherche de livres avec `searchBooks`
- [x] Suggestions de recherche avec `getBookSuggestions`
- [x] Recherche par sujet avec `getBooksBySubject`
- [x] Utilisation de `maxResults` et `startIndex`
- [x] Normalisation des résultats Google Books avec `formatBook`
- [x] Création de `trendingBooksApi.js`
- [x] Récupération des tendances depuis Open Library
- [x] Normalisation des livres Open Library
- [x] Partage des requêtes identiques en cours avec `fetchJsonOnce`
- [x] Service Google Cloud Translation
- [x] Traduction des résumés lorsque nécessaire

## Découvrir

La page Découvrir est fonctionnelle et utilise les données réelles des API.

- [x] Route `/discover`
- [x] Recherche depuis la page
- [x] Synchronisation de la recherche avec `?q=`
- [x] Autocomplétion avec suggestions
- [x] Affichage des résultats de recherche
- [x] État sans résultat
- [x] Navigation des cartes et suggestions vers `/books/:id`
- [x] Composant réutilisable `BookCard`
- [x] Vue de découverte par défaut
- [x] Section **Peut-être pour toi**
- [x] Section **Tendances du moment**
- [x] Section **Les incontournables**
- [x] Vue étendue `/discover?view=for-you`
- [x] Préférences de découverte enregistrées avec Firebase
- [x] Utilisation des préférences utilisateur pour les recommandations
- [x] Rafraîchissement indépendant des tendances
- [x] Rafraîchissement indépendant des incontournables
- [x] Rafraîchissement indépendant par genre dans la vue étendue
- [x] Déduplication et logique anti-répétition
- [x] Persistance des recommandations dans `sessionStorage`
- [x] Grilles responsives
- [x] Logique séparée en composants, hooks, services et utilitaires
- [ ] Polish final des états de chargement et d'erreur

## Recommandations

Le système de recommandations utilise maintenant les préférences de lecture enregistrées pour l'utilisateur.

- [x] Préférences temporaires dans `discoverPreferences.js`
- [x] Lots de candidats par sujet Google Books
- [x] Sélection des livres affichés
- [x] Déduplication par ISBN, titre/auteur et identifiants source
- [x] Suivi des livres déjà vus pendant la session
- [x] Persistance par étagère ou par genre
- [x] Gestion de `startIndex`
- [x] Préparation technique pour exclure les livres présents dans la bibliothèque
- [x] Préférences utilisateur disponibles via Firebase
- [x] Adaptation des recommandations aux préférences persistantes de l'utilisateur
- [ ] Utiliser davantage les données de lecture personnelles pour personnaliser les recommandations
- [ ] Finaliser la persistance et les règles de recommandation

## Authentification

L'authentification Firebase est maintenant fonctionnelle.

- [x] Configuration de Firebase
- [x] Création de compte
- [x] Connexion
- [x] Déconnexion
- [x] Gestion de l'utilisateur connecté
- [x] Onboarding d'un nouvel utilisateur
- [x] Sauvegarde des préférences utilisateur dans Firebase
- [x] Redirection après inscription et onboarding
- [x] Conservation de la session utilisateur
- [x] Gestion des erreurs d'authentification
- [x] Responsive des interfaces d'authentification

## Ma bibliothèque

La bibliothèque personnelle est maintenant intégrée au parcours utilisateur.

- [x] Ajouter un livre à la bibliothèque
- [x] Retirer un livre
- [x] Consulter sa bibliothèque
- [x] Gérer les statuts de lecture
- [x] Relier la bibliothèque au compte utilisateur
- [x] Persister les données avec Firebase
- [x] Gérer les états vides
- [x] Responsive de la bibliothèque
- [ ] Polish final
- [ ] Animations et micro-interactions

## Fiche d'un livre

Chaque livre possède une page dédiée.

- [x] Route dynamique `/books/:id`
- [x] Navigation depuis les cartes vers la fiche
- [x] Affichage des informations du livre
- [x] Affichage de la couverture
- [x] Affichage des auteurs et métadonnées disponibles
- [x] Traduction des résumés
- [x] Ajouter le livre à la bibliothèque
- [x] Retirer le livre de la bibliothèque
- [x] Modifier son statut de lecture
- [x] Ajouter une note personnelle
- [x] Ajouter ou modifier un avis personnel
- [x] Relier les données personnelles à Firebase
- [x] Gestion des états et erreurs principaux
- [ ] Polish final de la couverture et des états secondaires
- [ ] Animations et micro-interactions

## Collections

Les collections permettent de créer des regroupements personnalisés de livres.

- [x] Routes `/collections` et `/collections/:id`
- [x] Afficher les collections
- [x] Créer une collection
- [x] Modifier une collection
- [x] Supprimer une collection
- [x] Afficher le contenu d'une collection
- [x] Ajouter des livres à une collection
- [x] Retirer des livres d'une collection
- [x] Persister les collections avec Firebase
- [x] Gestion des états vides
- [x] Responsive
- [ ] Polish final de `Collections`
- [ ] Polish final de `CollectionPage`
- [ ] Animations et micro-interactions

## Paramètres

La page Paramètres permet maintenant de gérer les informations et préférences liées au compte.

- [x] Route `/settings`
- [x] Lien vers les paramètres depuis la navigation
- [x] Accès aux informations du compte
- [x] Affichage du profil
- [x] Gestion des préférences de lecture
- [x] Objectif annuel de lecture
- [x] Genres préférés
- [x] Sauvegarde des préférences avec Firebase
- [x] Déconnexion
- [x] Suppression du compte
- [x] Gestion des erreurs associées au compte
- [x] Responsive
- [ ] Polish final de la page Settings
- [ ] Animations et micro-interactions

## Responsive et finition

Le responsive est travaillé au fur et à mesure du développement.

- [x] Structure responsive principale
- [x] Dashboard responsive
- [x] Navigation mobile avec header et barre inférieure
- [x] Sidebar desktop
- [x] Adaptation de la sidebar selon la hauteur du viewport
- [x] Layout élargi sur desktop
- [x] Grilles responsives sur Découvrir
- [x] Affichage progressif de 2, 3, 4 puis 5 cartes selon la largeur
- [x] Authentification responsive
- [x] Onboarding responsive
- [x] Bibliothèque responsive
- [x] Fiche de livre responsive
- [x] Collections responsive
- [x] Settings responsive
- [ ] Vérification finale de toutes les pages
- [ ] Accessibilité finale
- [ ] Polish des états de chargement et d'erreur
- [ ] Animations et micro-interactions
- [ ] Corrections visuelles finales

## Documentation

La documentation évolue en parallèle du projet.

- [x] Mise en place de JSDoc
- [x] Mise en place d'Astro et Starlight
- [x] Documentation de l'architecture
- [x] Documentation du routing
- [x] Documentation des composants
- [x] Documentation de Google Books API
- [x] Documentation d'Open Library
- [x] Documentation de Google Cloud Translation
- [x] Documentation du modèle de données
- [x] Documentation du système de recommandations
- [x] Documentation de Firebase
- [x] Documentation de l'environnement de développement
- [x] Documentation des scripts
- [x] Documentation des choix techniques
- [x] Documentation du responsive
- [x] Déploiement de la documentation avec Firebase Hosting
- [x] Déploiement automatique de l'application via GitHub Actions
- [ ] Mise à jour finale du modèle de données selon les fonctionnalités terminées
- [ ] Mise à jour finale lorsque l'application sera terminée

## Polish et animations

Une fois les pages fonctionnelles et leur responsive stabilisé, le projet passe progressivement dans une phase de finition.

### Polish

- [x] Polish général de l'interface
- [x] Polish de l'authentification
- [x] Polish de l'onboarding
- [x] Polish de la bibliothèque
- [x] Polish de la fiche livre
- [ ] Polish de Collections
- [ ] Polish de CollectionPage
- [ ] Polish de Settings
- [ ] Vérification finale des états vides
- [ ] Vérification finale des états d'erreur

### Animations

Les animations seront ajoutées après la fin du polish des dernières pages.

- [ ] Animations de navigation
- [ ] Micro-interactions des boutons
- [ ] Animations des cartes
- [ ] Animations des collections
- [ ] Animations des transitions de pages
- [ ] Animations des états interactifs
- [ ] Passe finale des micro-interactions

## Déploiement

Le projet possède maintenant une infrastructure de déploiement automatisée.

- [x] Firebase Hosting pour l'application
- [x] Firebase Hosting séparé pour la documentation
- [x] Workflow GitHub Actions pour l'application
- [x] Workflow GitHub Actions pour la documentation
- [x] Déploiement automatique après un push sur `main`
- [x] Preview Firebase pour les pull requests de l'application

## Objectif final

L'objectif est d'obtenir une application personnelle permettant de suivre l'ensemble du parcours de lecture :

```text
Découvrir un livre
        ↓
Consulter sa fiche
        ↓
Ajouter à sa bibliothèque
        ↓
Choisir un statut
        ↓
Lire le livre
        ↓
Noter et écrire un avis
        ↓
Organiser dans des collections
        ↓
Retrouver ses lectures et préférences
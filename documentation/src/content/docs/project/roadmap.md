---
title: Roadmap
description: État du développement et évolutions possibles de Dear Pages.
---

Dear Pages a été développé progressivement, depuis la structure générale de l'application jusqu'à l'intégration des données personnelles, des API externes, des tests et du déploiement.

Cette roadmap présente les principales étapes réalisées pour construire la première version complète de Dear Pages ainsi que quelques pistes d'évolution possibles.

:::note
Les fonctionnalités principales prévues pour la première version de Dear Pages sont maintenant implémentées. Les éléments non cochés correspondent à des évolutions possibles et ne sont pas nécessaires au fonctionnement actuel de l'application.
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

Le Dashboard constitue la page d'accueil principale de l'utilisateur connecté.

- [x] Header du Dashboard
- [x] Recherche depuis le Dashboard
- [x] Section de lecture en cours
- [x] Navigation entre plusieurs lectures en cours
- [x] Rotation automatique des lectures en cours
- [x] Objectif de lecture
- [x] Livres récemment ajoutés
- [x] Statistiques de lecture
- [x] Compagnon de lecture
- [x] Connexion aux données utilisateur
- [x] Gestion des états vides
- [x] Adaptation responsive
- [x] Polish final du Dashboard
- [x] Micro-interactions principales

## API et données publiques

L'application utilise plusieurs services externes pour récupérer les données publiques des livres et traduire certains résumés.

- [x] Configuration de Google Books API
- [x] Création de `booksApi.js`
- [x] Refactorisation des services de livres en modules spécialisés dans `src/services/books/`
- [x] Recherche de livres avec `searchBooks`
- [x] Recherche multi-source combinant Google Books et Open Library
- [x] Amélioration de la pertinence des recherches par titre et auteur
- [x] Classement et déduplication des résultats de recherche
- [x] Suggestions de recherche avec `getBookSuggestions`
- [x] Recherche par sujet avec `getBooksBySubject`
- [x] Utilisation de `maxResults` et `startIndex`
- [x] Normalisation des résultats Google Books avec `formatBook`
- [x] Gestion des erreurs temporaires de Google Books
- [x] Création de `trendingBooksApi.js`
- [x] Récupération des tendances depuis Open Library
- [x] Normalisation des livres Open Library
- [x] Partage des requêtes identiques en cours avec `fetchJsonOnce`
- [x] Résolution et fallback des couvertures
- [x] Cache des résolutions de couvertures Open Library
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
- [x] Conseil de recherche affiché dans Découvrir et les résultats de recherche
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
- [x] Suggestions de recherche adaptées au mobile
- [x] Gestion des états de chargement et d'erreur
- [x] Logique séparée en composants, hooks, services et utilitaires

## Recommandations

Le système de recommandations utilise les préférences de lecture enregistrées pour l'utilisateur.

- [x] Lots de candidats par sujet Google Books
- [x] Sélection des livres affichés
- [x] Déduplication par ISBN, titre/auteur et identifiants source
- [x] Suivi des livres déjà vus pendant la session
- [x] Persistance par étagère ou par genre
- [x] Gestion de `startIndex`
- [x] Préférences utilisateur disponibles via Firebase
- [x] Adaptation des recommandations aux préférences persistantes de l'utilisateur
- [x] Renouvellement indépendant des différentes sélections
- [x] Filtrage des contenus clairement inadaptés sur les surfaces automatiques
- [ ] Exploiter davantage l'historique personnel de lecture pour affiner les recommandations

## Authentification

L'authentification Firebase est fonctionnelle et intégrée au parcours utilisateur.

- [x] Configuration de Firebase
- [x] Création de compte avec e-mail et mot de passe
- [x] Connexion avec e-mail et mot de passe
- [x] Connexion avec Google
- [x] Déconnexion
- [x] Gestion de l'utilisateur connecté
- [x] Onboarding d'un nouvel utilisateur
- [x] Sauvegarde des préférences utilisateur dans Firebase
- [x] Redirection après inscription et onboarding
- [x] Conservation de la session utilisateur
- [x] Gestion des erreurs d'authentification
- [x] Protection des routes privées
- [x] Gestion des routes réservées aux utilisateurs non connectés
- [x] Responsive des interfaces d'authentification
- [x] Suppression du compte avec confirmation

## Ma bibliothèque

La bibliothèque personnelle est intégrée au parcours utilisateur et reliée au compte connecté.

- [x] Ajouter un livre à la bibliothèque
- [x] Retirer un livre
- [x] Consulter sa bibliothèque
- [x] Rechercher dans sa bibliothèque
- [x] Filtrer les livres selon leur statut
- [x] Gérer les statuts de lecture
- [x] Relier la bibliothèque au compte utilisateur
- [x] Persister les données avec Firebase
- [x] Conserver les données nécessaires à la fiche du livre
- [x] Gérer les états vides
- [x] Responsive de la bibliothèque
- [x] Polish final

## Fiche d'un livre

Chaque livre possède une page dédiée regroupant les données publiques et personnelles associées à la lecture.

- [x] Route dynamique `/books/:id`
- [x] Navigation depuis les cartes vers la fiche
- [x] Affichage des informations du livre
- [x] Affichage de la couverture
- [x] Gestion des fallbacks de couverture
- [x] Affichage des auteurs et métadonnées disponibles
- [x] Affichage du résumé
- [x] Traduction des résumés
- [x] Ajouter le livre à la bibliothèque
- [x] Retirer le livre de la bibliothèque
- [x] Modifier son statut de lecture
- [x] Ajouter une note personnelle
- [x] Ajouter une évaluation en étoiles
- [x] Ajouter ou modifier un avis personnel
- [x] Conserver la date de fin d'une lecture terminée
- [x] Ajouter le livre à une collection
- [x] Relier les données personnelles à Firebase
- [x] Gestion des états et erreurs principaux
- [x] Optimisation du chargement des données de la fiche
- [x] Polish final de la couverture et des états secondaires
- [x] Responsive de la fiche livre

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
- [x] Polish final de `Collections`
- [x] Polish final de `CollectionPage`

## Paramètres

La page Paramètres permet de gérer les informations et préférences liées au compte.

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
- [x] Lien vers la documentation
- [x] Lien vers le dépôt GitHub
- [x] Responsive
- [x] Polish final de la page Settings

## Responsive et finition

Le responsive a été travaillé progressivement puis vérifié lors de la phase finale de polish.

- [x] Structure responsive principale
- [x] Dashboard responsive
- [x] Navigation mobile avec header et barre inférieure
- [x] Sidebar desktop
- [x] Adaptation de la sidebar selon la hauteur du viewport
- [x] Layout élargi sur desktop
- [x] Grilles responsives sur Découvrir
- [x] Affichage progressif de 2, 3, 4 puis 5 cartes selon la largeur
- [x] Recherche et suggestions adaptées au mobile
- [x] Authentification responsive
- [x] Onboarding responsive
- [x] Bibliothèque responsive
- [x] Fiche de livre responsive
- [x] Collections responsive
- [x] Settings responsive
- [x] Vérification finale des principales pages
- [x] Vérification des états vides
- [x] Vérification des principaux états d'erreur
- [x] Corrections visuelles finales
- [x] Vérification sur différentes tailles de viewport

## Tests et qualité

Dear Pages dispose de tests automatisés ainsi que d'une phase de vérification manuelle.

- [x] Mise en place de Vitest
- [x] Mise en place de React Testing Library
- [x] Tests des services et utilitaires importants
- [x] Tests des hooks et comportements principaux
- [x] Tests de composants interactifs
- [x] Tests du comportement des lectures en cours
- [x] Vérifications manuelles des principaux parcours utilisateur
- [x] Vérification avec `npm run test`
- [x] Vérification avec `npm run lint`
- [x] Vérification avec `npm run build`
- [x] Vérification finale du 9 octobre 2026 : 28 fichiers de tests passés, 246 tests passés sur 246
- [x] Vérification finale du 9 octobre 2026 : `npm run lint` avec 0 erreur et 11 avertissements non bloquants
- [x] Vérification finale du 9 octobre 2026 : `npm run build` réussi

## Documentation

La documentation accompagne la version finale du projet.

- [x] Mise en place de JSDoc
- [x] Mise en place d'Astro et Starlight
- [x] Documentation des fonctionnalités
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
- [x] Déploiement automatique de la documentation via GitHub Actions
- [x] Mise à jour de la documentation pour refléter l'implémentation finale

## Déploiement

Dear Pages possède une infrastructure de déploiement automatisée.

- [x] Firebase Hosting pour l'application
- [x] Firebase Hosting séparé pour la documentation
- [x] Workflow GitHub Actions pour l'application
- [x] Workflow GitHub Actions pour la documentation
- [x] Déploiement automatique après un push sur `main`
- [x] Preview Firebase pour les pull requests de l'application
- [x] Application de production vérifiée après déploiement
- [x] Documentation accessible séparément en production

## Version actuelle

La première version complète de Dear Pages couvre l'ensemble du parcours principal de lecture :

```text
Découvrir un livre
        ↓
Consulter sa fiche
        ↓
Ajouter à sa bibliothèque
        ↓
Choisir un statut
        ↓
Suivre sa lecture
        ↓
Noter et écrire un avis
        ↓
Organiser dans des collections
        ↓
Retrouver ses lectures et préférences
```

L'application réunit désormais les fonctionnalités principales prévues pour le projet, la persistance des données avec Firebase, les API de livres, la traduction des résumés, le responsive, les tests automatisés, la documentation et le déploiement.

## Évolutions possibles

Dear Pages peut continuer à évoluer après cette première version sans que ces améliorations soient nécessaires à son fonctionnement actuel.

- [ ] Affiner les recommandations à partir de davantage de données de lecture personnelles
- [ ] Permettre de consulter et de choisir différentes éditions d'un même livre, selon les données disponibles dans les API.
- [ ] Ajouter de nouvelles statistiques de lecture
- [ ] Enrichir certaines micro-interactions
- [ ] Continuer à améliorer la qualité et la disponibilité des couvertures
- [ ] Étendre les tests à de nouveaux cas limites au fur et à mesure de l'évolution du projet

---
title: Fonctionnalités
description: Les principales fonctionnalités de Dear Pages.
---

Dear Pages est une application personnelle de suivi de lecture conçue pour permettre à l'utilisateur d'organiser sa bibliothèque, suivre ses lectures et découvrir de nouveaux livres.

L'application est pensée comme un espace **privé et personnel** : la bibliothèque, les notes, les avis, les collections, les préférences et les informations de lecture sont associées au compte de l'utilisateur.

## Tableau de bord

Le tableau de bord donne un aperçu personnalisé de l'activité de lecture.

Il permet notamment de retrouver :

- les livres actuellement en cours de lecture ;
- l'objectif annuel de lecture ;
- les livres récemment ajoutés ;
- les statistiques de lecture ;
- un petit compagnon de lecture intégré à l'interface.

Les informations affichées proviennent des données réelles de l'utilisateur enregistrées dans Firebase.

Le tableau de bord s'adapte également aux situations où aucune lecture n'est actuellement en cours ou lorsque certaines données ne sont pas encore disponibles.

## Découvrir des livres

La page **Découvrir** permet de rechercher et d'explorer de nouveaux livres à partir de plusieurs sources.

La recherche principale utilise Google Books et propose :

- une recherche par titre, auteur ou mot-clé ;
- des suggestions pendant la saisie ;
- des résultats présentés sous forme de cartes ;
- une navigation directe vers la fiche détaillée d'un livre.

Selon les données disponibles, les livres peuvent notamment contenir :

- un titre ;
- un ou plusieurs auteurs ;
- une couverture ;
- une description ;
- des catégories ;
- une date de publication.

La page propose également plusieurs étagères de découverte :

- **Peut-être pour toi**, basée sur les genres préférés de l'utilisateur ;
- **Tendances du moment**, alimentée à partir d'Open Library ;
- **Les incontournables**, construite à partir de Google Books ;
- une vue étendue des recommandations personnalisées accessible avec `/discover?view=for-you`.

Certaines étagères peuvent être rafraîchies indépendamment afin de proposer de nouvelles sélections.

Les préférences utilisées pour les recommandations sont enregistrées dans Firebase et associées au compte connecté.

## Ma bibliothèque

La page **Ma bibliothèque** regroupe les livres sauvegardés par l'utilisateur.

Chaque livre peut être associé à l'un des statuts suivants :

- **À lire** ;
- **En cours** ;
- **Terminé** ;
- **Abandonné**.

La bibliothèque permet notamment de :

- retrouver tous les livres enregistrés ;
- rechercher un livre dans sa bibliothèque ;
- filtrer les livres selon leur statut ;
- ouvrir directement leur fiche détaillée ;
- conserver les données après un rafraîchissement ou une nouvelle connexion.

Les données de bibliothèque sont stockées dans Firebase et isolées pour chaque utilisateur.

## Fiche d'un livre

Chaque livre possède une page dédiée accessible avec `/books/:id`.

Dear Pages peut charger des livres provenant de Google Books ou d'Open Library et adapte les informations affichées aux données disponibles.

La fiche peut notamment présenter :

- la couverture ;
- le titre ;
- les auteurs ;
- la date de publication ;
- les catégories ;
- le résumé.

Elle constitue également le point central des actions personnelles liées au livre.

L'utilisateur peut :

- ajouter le livre à sa bibliothèque ;
- choisir ou modifier son statut de lecture ;
- retirer le livre de sa bibliothèque ;
- l'ajouter à une collection ;
- gérer ses notes personnelles ;
- enregistrer une note en étoiles ;
- rédiger un avis ;
- conserver une date de fin de lecture lorsqu'un livre est terminé.

Les informations personnelles sont enregistrées dans Firebase et restaurées lorsque l'utilisateur revient sur le livre.

## Notes, avis et évaluations

Dear Pages permet de conserver du contenu personnel associé aux lectures.

Selon le statut du livre, l'utilisateur peut notamment enregistrer :

- des notes personnelles ;
- un avis ;
- une évaluation en étoiles.

Ces informations sont privées et associées au compte connecté.

Dear Pages ne propose pas de système social de critiques, de commentaires publics ou de profils de lecteurs publics.

## Collections

Les collections permettent de créer des groupes de livres personnalisés indépendamment de leur statut de lecture.

L'utilisateur peut :

- créer une collection ;
- modifier une collection ;
- supprimer une collection ;
- consulter une page dédiée à chaque collection ;
- ajouter des livres à une collection ;
- retirer des livres d'une collection.

Retirer un livre d'une collection ne le supprime pas de la bibliothèque personnelle.

Les collections sont enregistrées dans Firebase et appartiennent uniquement à l'utilisateur connecté.

## Compte et authentification

Dear Pages utilise Firebase Authentication pour gérer les comptes utilisateurs.

L'application permet notamment :

- de créer un compte avec une adresse e-mail et un mot de passe ;
- de se connecter avec une adresse e-mail et un mot de passe ;
- de continuer avec Google ;
- de se déconnecter ;
- de supprimer son compte avec confirmation.

Les routes personnelles de l'application sont protégées et nécessitent une authentification.

## Onboarding et préférences

Lors de la première utilisation, Dear Pages propose un onboarding permettant de définir les principales préférences de lecture.

L'utilisateur peut notamment choisir :

- ses genres préférés ;
- son objectif annuel de lecture.

Ces préférences sont enregistrées dans Firebase et utilisées dans différentes parties de l'application, notamment :

- les recommandations de la page Découvrir ;
- l'objectif de lecture du tableau de bord.

Elles peuvent ensuite être modifiées depuis les paramètres.

## Paramètres

La page **Paramètres** permet de retrouver les informations principales liées au compte et de modifier certaines préférences.

Elle permet notamment de :

- consulter les informations du profil ;
- modifier les genres préférés ;
- modifier l'objectif annuel de lecture ;
- se déconnecter ;
- supprimer son compte ;
- accéder à la documentation technique de Dear Pages ;
- accéder au dépôt GitHub du projet.

## Responsive

Dear Pages est conçu pour fonctionner sur plusieurs tailles d'écran.

L'interface adapte notamment :

- la navigation ;
- la sidebar ;
- les cartes de livres ;
- les pages de contenu ;
- les modales ;
- les différentes dispositions du tableau de bord.

Le projet fait actuellement l'objet d'une dernière phase de polish afin d'améliorer la cohérence visuelle et les interactions sur desktop, tablette et mobile.

:::note
Les fonctionnalités principales de Dear Pages sont maintenant implémentées. Le projet est actuellement en phase de polish, puis passera aux tests automatisés et aux dernières vérifications avant sa version finale.
:::
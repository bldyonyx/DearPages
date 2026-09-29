---
title: Modèle de données
description: Organisation des données utilisées par Dear Pages.
---

Dear Pages sépare les données provenant des sources externes des données propres à chaque utilisateur.

On peut distinguer trois grandes catégories :

1. les **informations publiques des livres**, récupérées depuis Google Books ou Open Library ;
2. les **données d'interface et de recommandation**, utilisées pour gérer certains états temporaires ;
3. les **données personnelles de l'utilisateur**, enregistrées avec Firebase et associées à son compte.

Cette séparation permet de ne pas mélanger les informations fournies par les API externes avec les informations propres au parcours de lecture de chaque utilisateur.

## Livre Google Books

Les données reçues depuis Google Books sont transformées par `formatBook` dans le service dédié aux livres.

Un livre Google Books possède notamment la structure suivante :

```js
{
  id: 'abc123',
  googleBooksId: 'abc123',
  title: 'Titre du livre',
  authors: ['Auteur'],
  isbn: '978...',
  isbns: ['978...', '...'],
  cover: 'https://...',
  description: 'Description du livre',
  categories: ['Fantasy'],
  publishedDate: '2026',
}
```

### Propriétés

| Propriété | Type | Description |
| --- | --- | --- |
| `id` | `string` | Identifiant du volume Google Books utilisé par l'interface |
| `googleBooksId` | `string` | Identifiant source Google Books |
| `title` | `string` | Titre du livre |
| `authors` | `string[]` | Liste des auteurs |
| `isbn` | `string \| null` | Premier ISBN disponible |
| `isbns` | `string[]` | Liste des ISBN disponibles |
| `cover` | `string \| null` | URL de la couverture disponible |
| `description` | `string` | Description du livre |
| `categories` | `string[]` | Catégories associées au livre |
| `publishedDate` | `string` | Date de publication fournie par Google Books |

## Livre Open Library

Les tendances utilisent Open Library et sont normalisées avant d'être utilisées dans l'application.

Le modèle contient notamment :

```js
{
  id: 'OL...',
  openLibraryId: '/works/OL...',
  title: 'Titre du livre',
  authors: ['Auteur'],
  isbn: '978...',
  isbns: ['978...', '...'],
  cover: 'https://covers.openlibrary.org/...',
}
```

Open Library ne fournit pas exactement les mêmes champs que Google Books.

Les données disponibles sont donc adaptées au modèle utilisé par Dear Pages afin de pouvoir afficher les livres dans les composants communs de l'application.

## Valeurs par défaut

Les différentes sources ne fournissent pas toujours toutes les informations nécessaires.

Les services normalisent donc les réponses afin de fournir une structure cohérente aux composants React.

Certaines valeurs peuvent notamment être remplacées lorsqu'une information est absente :

```js
title: volumeInfo.title || 'Titre inconnu'

authors: volumeInfo.authors || ['Auteur inconnu']

description: volumeInfo.description || ''

categories: volumeInfo.categories || []

publishedDate: volumeInfo.publishedDate || ''
```

Pour les couvertures, plusieurs sources ou tailles peuvent être essayées avant de conserver une valeur vide ou un fallback approprié.

Cette normalisation évite que les composants aient à gérer directement toutes les différences entre les API.

## Identité d'un livre

Un simple `id` ne suffit pas toujours pour déterminer si deux résultats représentent le même livre.

Google Books et Open Library utilisent des identifiants différents et peuvent également retourner plusieurs éditions d'une même œuvre.

Dear Pages utilise donc plusieurs informations pour identifier et comparer les livres, notamment :

- l'ISBN ;
- le titre normalisé ;
- l'auteur principal ;
- l'identifiant Google Books ;
- l'identifiant Open Library ;
- certaines clés d'identité internes.

Ces informations sont notamment utilisées par la logique de recommandation afin de limiter les doublons et les répétitions dans les différentes étagères.

## État temporaire des recommandations

Certaines informations liées aux recommandations peuvent être conservées dans `sessionStorage`.

Cet état permet notamment de conserver certaines sélections pendant la session du navigateur et de limiter les répétitions immédiates.

Il ne représente pas les données personnelles persistantes de l'utilisateur.

Les préférences de lecture utilisées pour personnaliser les recommandations, elles, sont désormais associées au compte utilisateur et enregistrées avec Firebase.

## Données personnelles utilisateur

Les informations provenant de Google Books ou Open Library décrivent le livre, mais ne décrivent pas la relation entre ce livre et l'utilisateur.

Dear Pages conserve donc séparément les données propres au compte.

Elles comprennent notamment :

- les livres présents dans la bibliothèque ;
- leur statut de lecture ;
- les notes personnelles ;
- les avis personnels ;
- les collections ;
- les préférences de lecture ;
- l'objectif annuel de lecture.

Ces données sont associées à l'utilisateur connecté et enregistrées avec Firebase.

## Bibliothèque personnelle

La bibliothèque représente les livres que l'utilisateur a ajoutés à son espace personnel.

Elle permet de conserver le lien entre un utilisateur et un livre provenant d'une source externe.

Le livre peut ainsi être associé à un statut de lecture sans modifier les données publiques provenant de Google Books ou Open Library.

## Statuts de lecture

Chaque livre de la bibliothèque peut être associé à un statut représentant son état dans le parcours de lecture.

Dear Pages utilise les statuts :

```text
À lire
En cours
Terminé
Abandonné
```

Le statut appartient à la relation entre l'utilisateur et le livre.

Deux utilisateurs peuvent donc avoir le même livre avec des statuts différents.

## Notes et avis

Les notes et avis sont des données personnelles.

Ils sont associés au compte de l'utilisateur et ne sont pas ajoutés directement au modèle public provenant de Google Books ou Open Library.

Une note ou un avis permet donc à l'utilisateur de conserver sa propre appréciation d'un livre sans modifier les informations communes du livre.

## Collections

Les collections permettent à l'utilisateur de créer des regroupements personnalisés de livres.

Une collection appartient à l'utilisateur qui l'a créée et peut contenir plusieurs livres de sa bibliothèque.

Les collections sont persistantes et sont gérées avec les autres données personnelles de l'utilisateur.

Elles sont indépendantes du statut de lecture : un livre peut appartenir à une collection tout en ayant n'importe quel statut de lecture.

## Préférences de lecture

Les préférences de lecture sont également enregistrées avec le compte utilisateur.

Elles comprennent notamment :

- les genres préférés ;
- l'objectif annuel de lecture ;
- l'état de complétion de l'onboarding.

Ces préférences sont utilisées par différentes parties de l'application, notamment les recommandations personnalisées.

## Principe général

La séparation des données peut être résumée ainsi :

```text
Google Books / Open Library
        ↓
   Informations du livre
        ↓
      Dear Pages
        ↓
Firebase ───→ Relation utilisateur ↔ livre
        │
        ├── Bibliothèque
        ├── Statut de lecture
        ├── Note
        ├── Avis
        ├── Collections
        └── Préférences
```

**Google Books et Open Library décrivent les livres.**

**Firebase conserve les données propres à l'utilisateur et sa relation avec ces livres.**

Cette séparation permet de conserver une architecture claire tout en permettant à chaque utilisateur de construire sa propre bibliothèque et son propre parcours de lecture.
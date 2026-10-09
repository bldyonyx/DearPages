---
title: Sources de livres
description: Recherche et récupération des livres avec Google Books et Open Library.
---

Dear Pages utilise deux sources de données publiques : **Google Books API** et **Open Library**. Les services de livres normalisent leurs réponses avant de les transmettre aux composants React.

## Google Books API

Google Books fournit notamment les informations des livres, les recherches par sujet et une grande partie des candidats utilisés dans les recommandations.

La clé API est fournie au frontend avec :

```text
VITE_GOOGLE_BOOKS_API_KEY=...
```

:::note
Une variable préfixée par `VITE_` est intégrée au frontend et ne constitue pas un secret serveur. La clé Google Books doit donc être restreinte selon son utilisation.
:::

## Recherche principale : Google Books et Open Library

La recherche de la page **Découvrir** combine désormais des candidats provenant de **Google Books et d'Open Library**.

Le paramètre de recherche apparaît dans l'URL :

```text
/discover?q=...
```

Le hook `useDiscoverSearch` synchronise ce paramètre avec l'interface. Le service `bookSearchService.js` coordonne les requêtes et la sélection des résultats.

Le fonctionnement général est le suivant :

```text
Requête utilisateur
        ↓
Variantes de recherche par titre / auteur
        ↓
Google Books + Open Library
        ↓
Normalisation des candidats
        ↓
Fusion, déduplication et classement par pertinence
        ↓
Résultats affichés dans Découvrir
```

Le service peut lancer plusieurs recherches complémentaires, notamment pour les requêtes correspondant à un titre, un auteur ou une combinaison titre/auteur. Il utilise `Promise.allSettled` afin de conserver les réponses exploitables même si une des sources échoue.

La logique de pertinence est regroupée dans `src/utils/bookSearchRelevance.js`. Elle cherche à faire remonter les résultats correspondant à l'intention de recherche et à limiter les doublons ou les correspondances peu pertinentes.

Le nombre de résultats affichés est limité par le service afin de conserver une présentation lisible.

## Suggestions pendant la saisie

La recherche propose également des suggestions avant validation de la requête.

Un délai de saisie (*debounce*) limite les appels réseau inutiles. Les suggestions affichées peuvent mener directement à la fiche d'un livre :

```text
/books/:id
```

Lorsqu'aucun résultat n'est trouvé, l'interface présente un état vide et un conseil invitant à vérifier le titre ou à essayer le nom de l'auteur. Ce conseil apparaît également dans la vue Découvrir.

## Sélections par sujet

Les recommandations personnalisées utilisent des recherches par sujet, principalement via Google Books :

```text
q=subject:<subject>
```

Ces requêtes alimentent notamment **Peut-être pour toi**, **Les incontournables** et la vue étendue `/discover?view=for-you`.

Le module `bookSubjectService.js` gère les recherches par sujet et les fenêtres de résultats permettant de renouveler les candidats.

## Normalisation des données Google Books

Le module `googleBooksFormatter.js` transforme les réponses de Google Books vers une structure commune, comprenant selon les données disponibles :

```js
{
  id,
  googleBooksId,
  title,
  authors,
  isbn,
  isbns,
  cover,
  description,
  categories,
  publishedDate,
}
```

Les informations absentes peuvent être remplacées par des valeurs de fallback adaptées à l'interface.

## Open Library

Open Library complète Google Books pour :

- l'étagère **Tendances du moment** ;
- des candidats supplémentaires pour la recherche principale ;
- certaines informations publiques de livres ;
- la résolution de couvertures lorsque des données complémentaires sont disponibles.

Les données Open Library sont normalisées vers une structure compatible avec les composants de Dear Pages :

```js
{
  id,
  openLibraryId,
  title,
  authors,
  isbn,
  isbns,
  cover,
}
```

Open Library ne nécessite pas de clé API pour les appels publics utilisés ici.

## Couvertures et fallbacks

Dear Pages peut utiliser plusieurs tailles de couvertures Google Books et des couvertures Open Library.

Lorsqu'une couverture Open Library de meilleure qualité est réellement disponible, elle peut être privilégiée. Sinon, l'application conserve ou utilise la couverture Google Books disponible afin d'éviter une dégradation visuelle.

La gestion des couvertures prévoit des fallbacks et des mécanismes visant à limiter les requêtes inutiles.

## Identifiants et doublons

Les deux fournisseurs utilisent des identifiants différents. Dear Pages conserve les identifiants d'origine (`googleBooksId`, `openLibraryId`) et peut comparer les ISBN ainsi que les titres et auteurs pour rapprocher des résultats similaires.

La déduplication de résultats ne signifie pas que toutes les éditions d'une œuvre sont regroupées dans une interface de sélection d'éditions : cette fonctionnalité n'est pas documentée comme disponible dans la version actuelle.

## Données publiques et données personnelles

Les API externes fournissent des informations **publiques** sur les livres. Les données **personnelles** restent indépendantes et sont associées au compte utilisateur dans Firebase :

- statut de lecture et présence dans la bibliothèque ;
- collections ;
- notes, avis et évaluations ;
- dates et autres informations personnelles de lecture.

Cette séparation permet de faire évoluer les sources publiques sans mélanger les informations des livres avec les données privées de chaque utilisateur.

---
title: Sources de livres
description: Utilisation de Google Books et Open Library dans Dear Pages.
---

Dear Pages utilise deux sources externes principales pour récupérer les informations publiques des livres :

- **Google Books API**, pour la recherche, les suggestions et différentes sélections de livres ;
- **Open Library**, comme source complémentaire pour les tendances, certaines informations de livres et les couvertures.

Les appels à ces API sont isolés dans des services afin d'éviter d'effectuer directement les requêtes depuis les composants React.

## Google Books API

Google Books constitue la source principale utilisée par Dear Pages pour rechercher et découvrir des livres.

La clé API est récupérée depuis une variable d'environnement Vite :

```js
const API_KEY = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY
```

La variable attendue est :

```text
VITE_GOOGLE_BOOKS_API_KEY=...
```

:::note
Cette clé est utilisée côté frontend. Elle peut donc être visible depuis le navigateur et ne doit pas être considérée comme un secret serveur.

En production, elle est fournie au build par GitHub Actions et ses restrictions sont configurées depuis Google Cloud.
:::

## Recherche

La recherche principale de la page Découvrir utilise Google Books.

Elle permet de rechercher des livres à partir du texte saisi par l'utilisateur puis d'afficher les résultats dans Dear Pages.

La recherche est représentée dans l'URL avec :

```text
/discover?q=...
```

Le hook `useDiscoverSearch` synchronise l'état de recherche avec ce paramètre et coordonne le chargement des résultats.

## Suggestions

Google Books est également utilisé pour proposer des suggestions pendant la saisie.

Lorsque l'utilisateur commence à rechercher un livre, Dear Pages peut afficher une sélection réduite de résultats avant même la soumission complète de la recherche.

Un debounce limite les appels effectués pendant la saisie.

Chaque suggestion peut ensuite mener directement vers :

```text
/books/:id
```

## Sélections par sujet

Dear Pages utilise également les catégories de Google Books pour construire différentes sélections.

Une recherche par sujet utilise le principe :

```text
q=subject:<subject>
```

Cette logique intervient notamment dans :

- les recommandations **Peut-être pour toi** ;
- **Les incontournables** ;
- la vue étendue `/discover?view=for-you`.

Les recommandations personnalisées utilisent les genres préférés enregistrés pour l'utilisateur afin de choisir les sujets correspondants.

Différentes fenêtres de résultats peuvent être récupérées afin de renouveler les sélections sans toujours afficher les mêmes livres.

## Normalisation des données Google Books

Les réponses de Google Books sont transformées avant d'être utilisées dans l'interface.

Dear Pages normalise notamment des informations comme :

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

Cette normalisation permet aux composants React de travailler avec une structure cohérente sans dépendre directement du format brut de l'API.

Lorsque certaines informations sont absentes, Dear Pages peut utiliser des valeurs de remplacement adaptées à l'interface.

## Couvertures Google Books

Google Books peut fournir plusieurs tailles de couverture.

Dear Pages privilégie les versions de meilleure qualité disponibles avant de revenir vers des formats plus petits lorsque cela est nécessaire.

La couverture Google Books peut également servir de fallback lorsqu'une autre source ne fournit pas une image exploitable.

## Open Library

Open Library constitue la seconde source externe utilisée par Dear Pages.

Elle est notamment utilisée pour alimenter l'étagère :

**Tendances du moment**

à partir des données publiques d'Open Library.

Contrairement à Google Books, cette utilisation ne nécessite pas de clé API dans Dear Pages.

## Tendances

Pour les tendances, Dear Pages récupère un ensemble de livres depuis Open Library avant de les normaliser pour l'interface.

Les données utiles peuvent notamment inclure :

- l'identifiant Open Library ;
- le titre ;
- les auteurs ;
- les ISBN ;
- l'identifiant de couverture.

Les résultats sont ensuite filtrés et adaptés avant leur affichage dans l'étagère correspondante.

## Normalisation des données Open Library

Les livres provenant d'Open Library sont eux aussi transformés vers une structure compatible avec Dear Pages.

Elle peut notamment contenir :

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

Cette structure permet d'utiliser les livres Open Library dans les mêmes composants généraux que les résultats provenant de Google Books.

## Couvertures Open Library

Open Library fournit également un service de couvertures utilisé comme source complémentaire par Dear Pages.

Lorsqu'une couverture Open Library de meilleure qualité est disponible, elle peut être privilégiée.

Dans le cas contraire, Dear Pages conserve ou utilise la couverture Google Books disponible afin d'éviter de dégrader inutilement la qualité de l'image.

La gestion des couvertures prévoit donc plusieurs sources et fallbacks plutôt que de dépendre d'une seule image.

## Identifiants provenant de plusieurs sources

Google Books et Open Library n'utilisent pas les mêmes identifiants.

Un livre provenant de Google Books peut notamment posséder :

```text
id
googleBooksId
```

Un livre provenant d'Open Library peut notamment posséder :

```text
id
openLibraryId
```

Dear Pages conserve ces informations afin de savoir d'où provient un livre et de pouvoir récupérer les données adaptées à sa source.

Pour limiter les doublons entre différentes éditions ou différentes API, la logique peut également utiliser des informations comme :

- l'ISBN ;
- le titre ;
- l'auteur principal.

## Données publiques et données personnelles

Google Books et Open Library fournissent uniquement les informations publiques utilisées pour représenter et découvrir les livres.

Les données personnelles de l'utilisateur ne proviennent pas de ces API.

Cela concerne notamment :

- le statut de lecture ;
- la présence dans la bibliothèque ;
- les collections ;
- les notes personnelles ;
- l'évaluation en étoiles ;
- l'avis ;
- la date de fin de lecture.

Ces informations sont enregistrées séparément dans **Firebase** et associées au compte de l'utilisateur.

Cette séparation permet à Dear Pages d'utiliser les API externes comme sources de livres tout en conservant les données personnelles indépendamment.
---
title: Book data sources
description: Searching and retrieving books with Google Books and Open Library.
---

Dear Pages uses two public book data sources: **Google Books API** and **Open Library**. Book services normalize their responses before passing them to React components.

## Google Books API

Google Books provides book metadata, subject-based queries, and many of the candidates used for recommendations.

The API key is provided to the frontend through:

```text
VITE_GOOGLE_BOOKS_API_KEY=...
```

:::note
A `VITE_` environment variable is bundled into frontend code and is not a server-side secret. The Google Books key must therefore be appropriately restricted.
:::

## Main search: Google Books and Open Library

The **Discover** search now combines candidates from **Google Books and Open Library**.

The query is represented in the URL as:

```text
/discover?q=...
```

The `useDiscoverSearch` hook synchronizes the URL parameter with the interface. The `bookSearchService.js` module coordinates requests and result selection.

The general flow is:

```text
User query
    ↓
Title / author query variants
    ↓
Google Books + Open Library
    ↓
Candidate normalization
    ↓
Merging, deduplication, and relevance ranking
    ↓
Results displayed in Discover
```

The service can run complementary searches for title, author, and combined title/author queries. It uses `Promise.allSettled` so useful responses can still be displayed when one provider fails.

Relevance logic is located in `src/utils/bookSearchRelevance.js`. It aims to rank results matching the user's search intent and reduce duplicates or weak matches.

The service limits the number of displayed results to keep the interface readable.

## Suggestions while typing

Search suggestions are shown before the user submits a query.

A *debounce* limits unnecessary network requests. Suggestions can lead directly to a book details page:

```text
/books/:id
```

When no results are found, the interface displays an empty state and a tip suggesting that users check the title spelling or search by author. The tip also appears in the default Discover view.

## Subject-based selections

Personalized recommendations use subject queries, mainly through Google Books:

```text
q=subject:<subject>
```

These queries support **Maybe for you**, **Trending and curated selections**, and the extended `/discover?view=for-you` view, depending on the shelf's source.

The `bookSubjectService.js` module handles subject queries and result windows used to refresh recommendation candidates.

## Google Books normalization

The `googleBooksFormatter.js` module transforms Google Books responses into a shared structure, including fields such as:

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

Missing information can be replaced with interface-appropriate fallback values.

## Open Library

Open Library complements Google Books through:

- the **Trending** shelf;
- additional candidates for the main search;
- selected public book metadata;
- cover resolution when complementary data is available.

Open Library results are normalized into a structure compatible with Dear Pages components:

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

The public Open Library endpoints used here do not require an API key.

## Covers and fallbacks

Dear Pages can use several Google Books cover sizes and Open Library covers.

When a better-quality Open Library cover is actually available, it can be preferred. Otherwise, the application keeps or falls back to an available Google Books cover to avoid reducing image quality.

Cover handling includes fallbacks and mechanisms intended to reduce unnecessary requests.

## Identifiers and duplicates

The two providers use different identifiers. Dear Pages preserves source IDs (`googleBooksId`, `openLibraryId`) and can compare ISBNs, titles, and authors to identify similar results.

Result deduplication does not mean that every edition of a work is grouped into an edition-picker interface. Such a feature is not documented as available in the current version.

## Public and personal data

External APIs provide **public** book information. **Personal** data remains separate and is associated with the user's Firebase account:

- reading status and library membership;
- collections;
- notes, reviews, and ratings;
- dates and other personal reading information.

This separation lets public data sources evolve independently from each user's private information.

---
title: Book sources
description: How Google Books and Open Library are used in Dear Pages.
---

Dear Pages uses two main external sources to retrieve public book information:

- **Google Books API**, for search, suggestions, and several book selections;
- **Open Library**, as a complementary source for trends, some book information, and covers.

Calls to these APIs are isolated in services so requests are not made directly from React components.

## Google Books API

Google Books is the main source used by Dear Pages to search for and discover books.

The API key is read from a Vite environment variable:

```js
const API_KEY = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY
```

The expected variable is:

```text
VITE_GOOGLE_BOOKS_API_KEY=...
```

:::note
This key is used on the frontend. It can therefore be visible from the browser and should not be treated as a server secret.

In production, it is provided to the build by GitHub Actions and its restrictions are configured in Google Cloud.
:::

## Search

The main search on the Discover page uses Google Books.

It searches for books from the text entered by the user and displays the results in Dear Pages.

Search is represented in the URL with:

```text
/discover?q=...
```

The `useDiscoverSearch` hook synchronizes search state with this parameter and coordinates result loading.

## Suggestions

Google Books is also used to provide suggestions while typing.

When the user starts searching for a book, Dear Pages can display a small selection of results before the full search is submitted.

A debounce limits calls made while typing.

Each suggestion can then lead directly to:

```text
/books/:id
```

## Subject selections

Dear Pages also uses Google Books categories to build different selections.

A subject search uses:

```text
q=subject:<subject>
```

This logic is used in:

- **Maybe for you** recommendations;
- **Must-reads**;
- the expanded `/discover?view=for-you` view.

Personalized recommendations use the user's stored favorite genres to choose the corresponding subjects.

Different result windows can be fetched to refresh selections without always showing the same books.

## Google Books data normalization

Google Books responses are transformed before they are used in the interface.

Dear Pages normalizes information such as:

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

This normalization lets React components work with a consistent structure without depending directly on the raw API format.

When some information is missing, Dear Pages can use replacement values suited to the interface.

## Google Books covers

Google Books can provide several cover sizes.

Dear Pages prefers the best available versions before falling back to smaller formats when necessary.

The Google Books cover can also be used as a fallback when another source does not provide a usable image.

## Open Library

Open Library is the second external source used by Dear Pages.

It notably powers the shelf:

**Trending now**

from Open Library public data.

Unlike Google Books, this use does not require an API key in Dear Pages.

## Trends

For trends, Dear Pages retrieves a set of books from Open Library before normalizing them for the interface.

Useful data can include:

- the Open Library identifier;
- the title;
- authors;
- ISBNs;
- the cover identifier.

Results are then filtered and adapted before display in the matching shelf.

## Open Library data normalization

Books from Open Library are also transformed into a structure compatible with Dear Pages.

It can include:

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

This structure lets Open Library books use the same general components as Google Books results.

## Open Library covers

Open Library also provides a cover service used as a complementary source by Dear Pages.

When a better-quality Open Library cover is available, it can be preferred.

Otherwise, Dear Pages keeps or uses the available Google Books cover to avoid unnecessarily degrading image quality.

Cover management therefore supports several sources and fallbacks instead of depending on a single image.

## Identifiers from several sources

Google Books and Open Library do not use the same identifiers.

A book from Google Books can include:

```text
id
googleBooksId
```

A book from Open Library can include:

```text
id
openLibraryId
```

Dear Pages keeps this information to know where a book comes from and retrieve data suited to its source.

To limit duplicates between editions or APIs, the logic can also use:

- ISBN;
- title;
- main author.

## Public data and personal data

Google Books and Open Library provide only the public information used to represent and discover books.

The user's personal data does not come from these APIs.

This includes:

- reading status;
- presence in the library;
- collections;
- personal notes;
- star rating;
- review;
- finish date.

This information is stored separately in **Firebase** and associated with the user's account.

This separation lets Dear Pages use external APIs as book sources while keeping personal data independent.

---
title: Data model
description: Organization of the data used by Dear Pages.
---

Dear Pages separates data from external sources from data specific to each user.

There are three main categories:

1. **public book information**, retrieved from Google Books or Open Library;
2. **interface and recommendation data**, used to manage some temporary states;
3. **personal user data**, stored with Firebase and associated with the user's account.

This separation avoids mixing information provided by external APIs with information specific to each user's reading journey.

## Google Books book

Data received from Google Books is transformed by `formatBook` in the dedicated book service.

A Google Books book has a structure such as:

```js
{
  id: 'abc123',
  googleBooksId: 'abc123',
  title: 'Book title',
  authors: ['Author'],
  isbn: '978...',
  isbns: ['978...', '...'],
  cover: 'https://...',
  description: 'Book description',
  categories: ['Fantasy'],
  publishedDate: '2026',
  language: 'fr',
}
```

### Properties

| Property | Type | Description |
| --- | --- | --- |
| `id` | `string` | Google Books volume identifier used by the interface |
| `googleBooksId` | `string` | Source Google Books identifier |
| `title` | `string` | Book title |
| `authors` | `string[]` | List of authors |
| `isbn` | `string \| null` | First available ISBN |
| `isbns` | `string[]` | List of available ISBNs |
| `cover` | `string \| null` | Available cover URL |
| `description` | `string` | Book description |
| `categories` | `string[]` | Categories associated with the book |
| `publishedDate` | `string` | Publication date provided by Google Books |
| `language` | `string` | Volume language when provided by Google Books |

## Open Library book

Trends use Open Library and are normalized before being used in the application.

The model includes:

```js
{
  id: 'OL...',
  openLibraryId: '/works/OL...',
  title: 'Book title',
  authors: ['Author'],
  isbn: '978...',
  isbns: ['978...', '...'],
  cover: 'https://covers.openlibrary.org/...',
}
```

Open Library does not provide exactly the same fields as Google Books.

The available data is adapted to the model used by Dear Pages so books can be displayed in the application's shared components.

## Default values

The different sources do not always provide all required information.

Services normalize responses to provide a consistent structure to React components.

Some values can be replaced when information is absent:

```js
title: volumeInfo.title || 'Titre inconnu'

authors: volumeInfo.authors || ['Auteur inconnu']

description: volumeInfo.description || ''

categories: volumeInfo.categories || []

publishedDate: volumeInfo.publishedDate || ''
```

For covers, several sources or sizes can be tried before keeping an empty value or an appropriate fallback.

This normalization prevents components from having to handle all API differences directly.

## Book identity

A simple `id` is not always enough to decide whether two results represent the same book.

Google Books and Open Library use different identifiers and can also return several editions of the same work.

Dear Pages uses several pieces of information to identify and compare books, including:

- ISBN;
- normalized title;
- main author;
- Google Books identifier;
- Open Library identifier;
- some internal identity keys.

This information is especially used by recommendation logic to limit duplicates and repetitions across shelves.

## Temporary recommendation state

Some recommendation-related information can be kept in `sessionStorage`.

This state keeps certain selections during the browser session and limits immediate repetitions.

It does not represent persistent personal user data.

The reading preferences used to personalize recommendations are now associated with the user account and stored with Firebase.

## Personal user data

Information from Google Books or Open Library describes the book, but not the relationship between that book and the user.

Dear Pages therefore keeps account-specific data separately.

It includes:

- books in the library;
- their reading status;
- personal notes;
- personal reviews;
- collections;
- reading preferences;
- the annual reading goal.

This data is associated with the signed-in user and stored with Firebase.

## Personal library

The library represents books the user has added to their personal space.

It keeps the relationship between a user and a book from an external source.

A book can therefore be assigned a reading status without modifying public data from Google Books or Open Library.

## Reading statuses

Each library book can be assigned a status representing its state in the reading journey.

Dear Pages uses the statuses:

```text
To read
Reading
Finished
Abandoned
```

The status belongs to the relationship between the user and the book.

Two users can therefore have the same book with different statuses.

## Notes and reviews

Notes and reviews are personal data.

They are associated with the user's account and are not added directly to the public model from Google Books or Open Library.

A note or review lets the user keep their own appreciation of a book without modifying shared book information.

## Collections

Collections let users create custom groups of books.

A collection belongs to the user who created it and can contain several books from their library.

Collections are persistent and are managed with the user's other personal data.

They are independent from reading status: a book can belong to a collection while having any reading status.

## Reading preferences

Reading preferences are also stored with the user account.

They include:

- favorite genres;
- the annual reading goal;
- the preferred interface language;
- onboarding completion state.

These preferences are used by several parts of the application, especially personalized recommendations.

## General principle

The data separation can be summarized as:

```text
Google Books / Open Library
        ↓
   Book information
        ↓
      Dear Pages
        ↓
Firebase ───→ User ↔ book relationship
        │
        ├── Library
        ├── Reading status
        ├── Note
        ├── Review
        ├── Collections
        └── Preferences
```

**Google Books and Open Library describe books.**

**Firebase stores user-specific data and the user's relationship with those books.**

This separation keeps the architecture clear while letting each user build their own library and reading journey.

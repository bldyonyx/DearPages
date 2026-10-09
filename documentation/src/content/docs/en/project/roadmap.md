---
title: Roadmap
description: Development status and possible evolutions for Dear Pages.
---

This roadmap summarizes the current state of Dear Pages and the main areas that have been implemented or could evolve later.

It reflects the project as a personal reading tracker with authentication, private data, discovery, recommendations, bilingual interface, and documentation.

## Project foundation

The application foundation is in place:

- React application created with Vite;
- routing with React Router;
- Tailwind CSS interface;
- shared layout;
- Firebase configuration;
- separate Astro/Starlight documentation;
- automated checks and builds.

## Dashboard

The dashboard provides a personalized view of reading activity.

It includes:

- currently reading books;
- recently added books;
- reading statistics;
- annual goal;
- a visual reading companion.

Dashboard data comes from the signed-in user's Firebase data.

## Public APIs and data

Dear Pages uses public book APIs to retrieve information used in the interface.

Implemented sources include:

- Google Books for search, suggestions, detailed book information, subject selections, and some recommendations;
- Open Library for the main search, trends, some public book data, and some cover fallbacks.

The book services have been refactored into specialized modules under `src/services/books/`, with `booksApi.js` kept as the public entry point. The main search now combines Google Books and Open Library candidates, improves title and author relevance, then ranks and deduplicates results before they are displayed.

## Discover

The Discover page supports several flows:

- default discovery shelves;
- search with `?q=`;
- suggestions while typing;
- search guidance in the default view and search results;
- an expanded personalized recommendations view with `?view=for-you`.

Shelves can load and refresh independently so one source does not block the entire page.

## Recommendations

The recommendation system currently uses:

- favorite genres stored in Firebase;
- Google Books subject searches;
- Open Library trends;
- candidate selection;
- deduplication;
- anti-repetition during the session;
- content filtering for automatic recommendation surfaces;
- temporary persistence through `sessionStorage`.

The system can later evolve to use more reading-history signals.

## Authentication

Authentication is implemented with Firebase Authentication.

The application supports:

- email/password signup;
- email/password login;
- Google sign-in;
- protected routes;
- public-only authentication routes;
- sign-out;
- account deletion with reauthentication when required.

Language selection is available on Login and Sign Up before authentication.

## My Library

The library lets users keep saved books in their personal space.

Implemented behavior includes:

- adding books;
- storing the saved book information;
- filtering by reading status;
- searching the library;
- opening book pages;
- keeping data across refreshes and sessions through Firebase.

## Book page

The book page is the central place for book information and personal actions.

It supports:

- displaying public book data;
- adding or removing the book from the library;
- changing reading status;
- notes;
- ratings;
- reviews;
- collection actions;
- finish dates for completed books;
- translating descriptions into French or English when needed.

Description translation is handled through a hook, language detection, a session cache, and Google Cloud Translation.

## Collections

Collections let users organize books independently from reading status.

Implemented behavior includes:

- creating collections;
- editing collection information;
- deleting collections;
- opening a dedicated collection page;
- adding books to collections;
- removing books from collections.

Collection data is stored in Firebase for the signed-in user.

## Settings

Settings centralize account and preference management.

They include:

- profile information;
- application language selection;
- reading preferences;
- annual goal;
- project links;
- sign-out;
- account deletion.

Changing language from Settings updates the interface immediately and saves the new value in Firebase preferences.

## Responsive and finish

The interface has been adapted for desktop, tablet, and mobile.

The application uses:

- desktop sidebar navigation;
- mobile bottom navigation;
- responsive grids;
- flexible cards;
- layouts adapted to available width and height;
- consistent empty, loading, and error states.

## Tests and quality

The project uses Vitest and React Testing Library for automated tests.

Tests cover important services, utilities, hooks, and interactive behaviors, including i18n consistency and description translation behavior.

The final verification on October 9, 2026 passed 28 test files and 246 out of 246 tests. On the same date, `npm run lint` reported 0 errors and 11 non-blocking warnings, and `npm run build` completed successfully.

Manual checks complete the automated tests on the main user flows.

## Documentation

The project includes two documentation systems:

- generated JSDoc documentation for code-level references;
- Astro/Starlight documentation for the project, architecture, data, development, and roadmap.

The Starlight documentation is now bilingual with French at the root and English under `/en/`.

## Deployment

Firebase Hosting is configured with two targets:

```text
app  → React application
docs → Astro + Starlight documentation
```

GitHub Actions workflows build and deploy the relevant target after changes are pushed to `main`.

The documentation build outputs static files to `documentation/dist/`, which remains compatible with the existing Firebase Hosting `docs` target, including `/en/` routes.

## Current version

The current version provides a complete personal reading tracker:

- authentication;
- onboarding;
- French / English interface;
- language selectors on Login, Sign Up, and Settings;
- personalized recommendations;
- book search and discovery;
- personal library;
- collections;
- notes, ratings, and reviews;
- Firebase persistence;
- responsive layouts;
- bilingual project documentation.

## Possible evolutions

Future evolutions could include:

- deeper recommendation personalization based on reading history;
- [ ] Allow users to browse and select different editions of the same book, depending on the metadata available from the APIs.
- richer collection organization;
- more advanced statistics;
- improved import/export flows;
- stronger offline or caching behavior;
- additional accessibility checks;
- broader test coverage for complex UI flows.

These evolutions can be added progressively while preserving the existing separation between public book data, personal user data, and interface logic.

---
title: Project structure
description: Organization of Dear Pages files and main directories.
---

Dear Pages separates **pages**, **components**, **hooks**, **services**, **utilities**, and application assets. This structure keeps rendering, application logic, and external data access independent.

## Main structure

```text
DearPages/
├── .github/workflows/          → CI/CD and deployments
├── documentation/              → Astro + Starlight documentation
├── src/
│   ├── assets/                → images, fonts, and textures
│   ├── components/            → React components grouped by feature
│   ├── constants/             → shared values
│   ├── context/               → React contexts
│   ├── hooks/                 → custom hooks
│   ├── i18n/                  → FR/EN setup and translations
│   ├── pages/                 → route-level pages
│   ├── services/              → APIs and data access
│   ├── test/                  → automated tests
│   ├── utils/                 → reusable logic
│   ├── App.jsx
│   ├── index.css
│   └── main.jsx
├── .firebaserc
├── firebase.json
├── package.json
└── vite.config.js
```

Local environment variables belong in appropriate `.env` files. Secrets should not be committed to Git.

## `src/components`

React components are grouped by feature:

```text
components/
├── auth/
├── books/
├── collections/
├── dashboard/
├── discover/
├── layout/
├── settings/
└── ui/
```

Components in `ui/` are reusable, while the other folders group feature-specific interface elements.

## `src/pages`

Main pages include `Dashboard.jsx`, `Discover.jsx`, `MyLibrary.jsx`, `BookPage.jsx`, `Collections.jsx`, `CollectionPage.jsx`, `Settings.jsx`, `Login.jsx`, `SignUp.jsx`, and `Onboarding.jsx`.

`App.jsx` defines the routes, including protected pages, authentication screens, and onboarding. The main application pages share a layout, while authentication has a separate presentation.

## `src/context` and `src/hooks`

The authentication context centralizes the signed-in user and their preferences. Custom hooks encapsulate complex state and data loading, including search, recommendations, Discover shelves, and book-description translation.

## `src/services`: separation of responsibilities

Services isolate Firebase and external API calls so that React components do not communicate directly with those providers.

Important services include:

- `authService.js` for authentication operations;
- `firebase.js` for Firebase configuration;
- `preferencesService.js` for user preferences;
- `libraryService.js` for the library and personal book data;
- `collectionsService.js` for collections;
- `translationService.js` for description translation;
- `booksApi.js` and `books/` for public book information.

### Book service organization

Book-related logic is split into specialized modules:

```text
src/services/
├── booksApi.js
└── books/
    ├── bookSearchService.js
    ├── bookSubjectService.js
    ├── googleBooksApi.js
    ├── googleBooksFormatter.js
    ├── openLibraryApi.js
    ├── trendingBooksApi.js
    └── coverUtils.js
```

**`booksApi.js` remains the public entry point**: it re-exports the functions used elsewhere in the application while preserving existing imports.

Each module has a distinct role:

| Module | Responsibility |
| --- | --- |
| `bookSearchService.js` | Main search, suggestions, and combined results |
| `bookSubjectService.js` | Subject-based queries and recommendation candidates |
| `googleBooksApi.js` | Google Books requests and data retrieval |
| `googleBooksFormatter.js` | Normalization of Google Books responses |
| `openLibraryApi.js` | Open Library requests and data retrieval |
| `trendingBooksApi.js` | Trending books and complementary Open Library search functions |
| `coverUtils.js` | Cover processing and resolution |

This separation makes testing and maintenance easier without concentrating all search logic in one file.

## `src/utils`

Utilities contain presentation-independent functions, including:

- search result relevance;
- recommendation selection and deduplication;
- cover handling and fallbacks;
- data normalization and transformation;
- date and translation helpers.

## `src/i18n`

```text
i18n/
├── index.js
└── locales/
    ├── en.json
    └── fr.json
```

The i18next configuration loads French and English resources. Components use `useTranslation` to display labels in the active language.

## `src/test`

Vitest tests cover services, utilities, authentication behavior, search, recommendations, components, and selected security cases. React Testing Library helps test observable component interactions.

## Firebase and personal data

Firebase Authentication manages accounts and sessions. Firebase Realtime Database stores libraries, collections, preferences, and personal reading information, organized by user.

The `.firebaserc` and `firebase.json` files configure the Firebase Hosting targets:

```text
app  → Dear Pages application
docs → Astro + Starlight documentation
```

## GitHub Actions and documentation

Workflows in `.github/workflows/` automate application and documentation builds and deployments.

The project has two forms of documentation:

```text
docs/              → JSDoc generated with npm run docs
documentation/     → version-controlled Astro + Starlight site
```

The Astro website has its own `package.json`, build, and Firebase Hosting target.

---
title: Technical choices
description: Technologies chosen for Dear Pages and why they are used.
---

Dear Pages uses several technologies, each with a precise responsibility in the project.

The choices were made according to the application's needs and with the goal of keeping the architecture understandable and evolvable.

## React

**React** is used to build the user interface.

The application contains many parts that can be separated into components, such as:

- book cards;
- navigation;
- forms;
- dashboard sections;
- modals;
- reusable interface elements.

React makes it possible to build these elements independently and assemble them across the different pages.

It also manages the state required for application interactions.

## JavaScript

Dear Pages is developed in **JavaScript**.

JavaScript is used for:

- component logic;
- state management;
- user events;
- data transformations;
- calls to external services.

Important or less obvious functions are documented with JSDoc when that adds useful information.

## Vite

**Vite** provides the development environment for the React application.

It is used to:

- start the development server;
- manage environment variables;
- build the production version;
- provide fast reload during development.

Variables exposed to the frontend use the prefix:

```text
VITE_
```

## Tailwind CSS

**Tailwind CSS** is used to build the interface and manage responsive behavior.

Utility classes define:

- spacing;
- sizes;
- grids;
- flex layouts;
- responsive breakpoints;
- colors and other visual properties.

Dear Pages also uses a custom palette to keep a coherent visual identity.

## React Router

**React Router** manages navigation between the application's pages.

It supports:

- nested routes;
- a shared layout with `Outlet`;
- dynamic routes such as `/books/:id` and `/collections/:id`;
- search parameters such as `?q=` and `?view=for-you`;
- navigation without a full page reload.

Main pages share `PageLayout`, while authentication pages use a different structure.

## i18next and react-i18next

**i18next** and **react-i18next** make the interface available in French and English.

The configuration is located in:

```text
src/i18n/index.js
```

It loads the resources:

```text
src/i18n/locales/fr.json
src/i18n/locales/en.json
```

Components use `useTranslation` to retrieve labels with `t(...)` and access `i18n.changeLanguage(...)` when the user changes language.

The choice is kept in `localStorage` so it remains available before authentication. Once the user is signed in, the language can also be synchronized with Firebase preferences.

## Google Books API

**Google Books API** is used as the main external source for public book information.

It is used to:

- search books;
- provide search suggestions;
- retrieve detailed book information;
- retrieve books by subject;
- power some recommendations.

Received data is normalized by `booksApi.js` before being used in components.

Google Books mainly answers:

> What is the information about this book?

## Open Library

**Open Library** complements Google Books in some parts of the application.

It is used to:

- power the **Trending now** shelf;
- retrieve some public book data;
- resolve some covers from an ISBN when a better source is available.

Trend data is normalized in `trendingBooksApi.js`.

Open Library does not replace Google Books: both services provide public book data, but with different identifiers and formats.

## Google Cloud Translation API

**Google Cloud Translation API** is used to translate some content from book sources.

It is used for **book descriptions** when a description should be presented in the active interface language.

The translation service is isolated in a dedicated service to separate API calls from the React interface.

The key used by the service is provided with:

```text
VITE_GOOGLE_TRANSLATION_API_KEY
```

Like other `VITE_` variables, this value is used on the frontend and should not be considered a server secret.

## Recommendations

The recommendation system combines stored user preferences with public data from book APIs.

It uses:

- favorite genres stored in Firebase;
- Google Books subjects matching those preferences;
- Open Library trends for some shelves;
- candidate batches to refresh selections;
- deduplication by ISBN, title/author, and source identifiers;
- tracking of books already shown during the session;
- `sessionStorage` to keep some selections during the session.

This organization provides several independent shelves while limiting repetitions during refreshes.

Automatic discovery surfaces also apply selection rules to avoid automatically recommending clearly unsuitable content.

The system remains simpler than a full recommendation engine based on reading history: genre preferences are currently the main source of personalization.

## Firebase

**Firebase** manages user-specific data and several services required for Dear Pages operation and deployment.

Firebase Authentication is used for:

- account creation;
- email/password sign-in;
- Google sign-in;
- user session management;
- sign-out;
- account deletion.

Firebase Realtime Database stores:

- reading preferences;
- preferred language;
- personal library;
- reading statuses;
- collections;
- personal notes;
- ratings;
- reviews;
- personal information associated with books.

Data is organized by user to isolate each account's information.

Firebase configuration is provided to the application through environment variables.

Firebase-related logic is separated into services and contexts so Firebase calls are not placed directly in interface components.

Firebase therefore answers a different question from book APIs:

> What is the user's relationship with this book?

## Firebase Hosting

**Firebase Hosting** is used to publish Dear Pages.

The project has two distinct targets:

```text
app  → React application
docs → Astro + Starlight documentation
```

This separation lets the main application and documentation be deployed independently while using the same Firebase project.

## GitHub Actions

**GitHub Actions** automates part of the deployment process.

Project workflows can:

- install dependencies;
- build the application;
- deploy Dear Pages to Firebase Hosting;
- create Firebase previews for application Pull Requests;
- build and deploy the documentation.

Deployment from the main branch can therefore be performed automatically after committed project changes.

## Vitest and React Testing Library

**Vitest** is used for Dear Pages automated tests.

It integrates naturally with the Vite environment and can test:

- services;
- utilities;
- hooks;
- some components;
- important interactive behavior.

**React Testing Library** complements Vitest by testing React components through observable behavior rather than internal implementation.

Automated tests complement manual checks performed on the main application flows.

## JSDoc

**JSDoc** documents some important parts of the JavaScript code directly.

It is especially suited to services, hooks, utilities, and functions whose contract deserves to be explicit.

Technical documentation can be generated with:

```bash
npm run docs
```

## Astro and Starlight

The documentation you are reading is built with **Astro** and **Starlight**.

It is deliberately separate from the main React application:

```text
DearPages/
├── src/                → React application
├── docs/               → generated JSDoc documentation
└── documentation/      → Astro + Starlight documentation
```

Starlight provides a structure suited to technical documentation, while the custom theme keeps Dear Pages' visual identity.

The documentation has its own npm environment and Astro build.

It is also deployed separately on Firebase Hosting.

## Separation of responsibilities

These choices can be summarized as:

| Technology | Responsibility |
| --- | --- |
| React | Interface and components |
| JavaScript | Application logic |
| Vite | Development environment and build |
| Tailwind CSS | Styles and responsive behavior |
| React Router | Navigation |
| Google Books API | Book search and public book information |
| Open Library | Trends and some covers |
| Google Cloud Translation API | Description translation into the active language |
| i18next / react-i18next | French / English bilingual interface |
| `sessionStorage` | Temporary persistence for some recommendations |
| Firebase Authentication | Accounts and authentication |
| Firebase Realtime Database | Persistent personal data |
| Firebase Hosting | Application and documentation hosting |
| GitHub Actions | Deployment automation |
| Vitest | Automated tests |
| React Testing Library | React component tests |
| JSDoc | Technical code documentation |
| Astro + Starlight | Project documentation |

The goal is for each technology to answer an identifiable need rather than adding tools without a clear role.

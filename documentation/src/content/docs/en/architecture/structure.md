---
title: Project structure
description: Organization of the main Dear Pages files and folders.
---

Dear Pages is organized into several folders to separate the interface, pages, services, hooks, global context, constants, utilities, and application assets.

This structure keeps the project readable and separates responsibilities between display, data management, and external integrations.

## Main structure

The project lives in the `DearPages` folder.

```text
DearPages/
├── .github/
│   └── workflows/
├── documentation/
├── src/
│   ├── assets/
│   ├── components/
│   ├── constants/
│   ├── context/
│   ├── hooks/
│   ├── i18n/
│   ├── pages/
│   ├── services/
│   ├── utils/
│   ├── App.jsx
│   ├── index.css
│   └── main.jsx
├── .env
├── .firebaserc
├── firebase.json
├── package.json
└── vite.config.js
```

## `src/assets`

This folder contains visual assets used by the application:

- local fonts;
- images;
- textures;
- illustrations used in the interface.

## `src/components`

This folder gathers the application's React components.

They are organized by feature to avoid placing every component in a single folder.

It includes components related to:

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

This organization distinguishes feature-specific components from structural or reusable components.

## `src/constants`

This folder contains shared values used in several places in the application.

It includes static data required by some features, such as the genres available for reading preferences.

User-specific preferences are not stored here: they are stored in Firebase.

## `src/context`

This folder contains React contexts used to share certain data throughout the application.

It includes the authentication context, which centralizes the signed-in user state and preferences.

Routes and components can access that information without manually passing it through several component levels.

## `src/hooks`

This folder groups custom hooks.

They extract complex React logic from components and centralize some state or data-loading behavior.

The Discover features use dedicated hooks for:

- search;
- loading the different shelves;
- personalized recommendations;
- managing displayed data.

The book page also uses a dedicated hook to manage description translation state, target language, and the related session cache.

## `src/i18n`

This folder contains the application's bilingual configuration.

```text
i18n/
├── index.js
└── locales/
    ├── en.json
    └── fr.json
```

`index.js` initializes i18next with react-i18next, declares the supported languages, and loads the translation resources.

The `fr.json` and `en.json` files contain interface labels. They follow the same key structure so components can use the same `t(...)` calls regardless of the active language.

## `src/pages`

This folder contains the components used directly by React Router to represent application pages.

It includes:

- `Dashboard.jsx`
- `Discover.jsx`
- `MyLibrary.jsx`
- `BookPage.jsx`
- `Collections.jsx`
- `CollectionPage.jsx`
- `Settings.jsx`
- `Login.jsx`
- `SignUp.jsx`
- `Onboarding.jsx`

These pages now use the user's real data when the related feature depends on Firebase.

## `src/services`

This folder isolates communication with external services and data-access logic.

Services manage:

- Google Books;
- Open Library;
- Firebase Authentication;
- user preferences;
- the personal library;
- collections;
- personal data associated with books;
- translations used by the application.

This separation avoids placing API or Firebase calls directly in interface components.

## `src/utils`

This folder contains reusable logic that is not directly tied to display.

Utilities are used to:

- normalize some data from APIs;
- select and deduplicate recommendations;
- manage covers and fallbacks;
- avoid or share identical requests;
- detect description language and build translation cache keys;
- transform data before it is used in the interface.

They keep components and services simpler.

## Routing

`App.jsx` centralizes the main Dear Pages routes.

The application distinguishes:

- routes accessible only to signed-in users;
- public authentication routes;
- onboarding;
- pages displayed in the main layout.

Dedicated components control access to routes according to authentication state and user preferences.

## Firebase

The Firebase configuration lets Dear Pages use:

- Firebase Authentication;
- Firebase Realtime Database;
- Firebase Hosting.

Personal data is organized by user to isolate libraries, collections, preferences, and reading information.

The files:

```text
.firebaserc
firebase.json
```

also configure two Firebase Hosting targets:

```text
app  → Dear Pages application
docs → Astro + Starlight documentation
```

## GitHub Actions

The folder:

```text
.github/workflows/
```

contains the project's CI/CD workflows.

They automate:

- dependency installation;
- application build;
- Dear Pages deployment to Firebase Hosting;
- Firebase previews for Pull Requests;
- documentation build and deployment.

The application and documentation use two separate Firebase Hosting targets.

## Documentation

The project has two forms of documentation.

```text
docs/              → generated JSDoc documentation
documentation/     → Astro + Starlight documentation
```

The `docs/` folder is generated with:

```bash
npm run docs
```

It contains technical documentation generated from JSDoc comments in the code and remains ignored by Git.

The folder:

```text
documentation/src/content/docs/
```

contains the hand-written Astro/Starlight pages versioned with the project.

The documentation has its own Astro environment, build, and Firebase Hosting deployment.

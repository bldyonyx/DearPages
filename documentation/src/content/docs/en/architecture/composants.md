---
title: Components
description: Organization and role of the main Dear Pages React components.
---

Dear Pages uses **React components** to divide the interface into smaller, reusable pieces that are easier to maintain.

The architecture separates responsibilities between several levels:

- **pages** coordinate views;
- **components** build the interface;
- **hooks** centralize some state and loading logic;
- **React context** shares authentication and preferences;
- **services** communicate with Firebase and external APIs;
- i18next and react-i18next provide interface text in the active language;
- **utilities** isolate reusable logic.

## Component organization

Components are grouped by feature.

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

This keeps components that belong to the same part of the application together while keeping generic elements in `ui`.

## Interface components

The folder:

```text
components/ui/
```

groups generic elements that can be used in several places in the application.

It includes elements such as buttons, fields, modals, badges, and cards used to build a coherent interface.

The goal is to avoid recreating the same elements on each page and to centralize their visual behavior.

## Book components

Book-specific components are grouped in:

```text
components/books/
```

They are used in several parts of Dear Pages, including:

- Discover;
- search results;
- My Library;
- collections;
- the dashboard;
- a book's detailed page.

### `BookCard`

`BookCard` represents a book in compact form.

Depending on context, it can display:

- a cover;
- a title;
- an author;
- extra information related to the book.

When an identifier is available, the card can link to:

```text
/books/:id
```

Its layout stays flexible enough for different containers and screen sizes.

### `BookDescriptionSection`

`BookDescriptionSection` displays the description available on a book page.

It relies on `useBookDescriptionTranslation` to offer a translation when the detected description language differs from the interface language.

The component does not communicate directly with Google Cloud Translation: it receives translation state, displayed text, action labels, and possible errors from the hook.

## Discover page

`Discover.jsx` coordinates three main modes:

- the default discovery view;
- search when the URL contains `?q=...`;
- the expanded recommendations view when the URL contains `?view=for-you`.

The page assembles specialized hooks and components instead of containing all logic directly.

```text
pages/
└── Discover.jsx

components/discover/
├── DiscoverHome.jsx
├── DiscoverSearch.jsx
├── DiscoverShelf.jsx
├── SearchResults.jsx
├── SearchSuggestions.jsx
├── ForYouSection.jsx
└── ForYouRecommendations.jsx
```

### `DiscoverHome`

`DiscoverHome` displays the main discovery view.

It groups:

- **Maybe for you**;
- **Trending now**;
- **Must-reads**.

Each shelf has its own data and state so an issue with one source does not block the whole page.

### `DiscoverSearch`

`DiscoverSearch` manages the search interface.

It works with `useDiscoverSearch` to display the input, suggestions, and search states.

### `SearchSuggestions`

`SearchSuggestions` displays suggestions returned while typing.

Suggestions can lead directly to the matching book page.

### `SearchResults`

`SearchResults` displays results from Google Books.

It manages:

- loading;
- errors;
- available results;
- the absence of results.

### `DiscoverShelf`

`DiscoverShelf` represents a responsive shelf of books.

Some shelves can be refreshed independently to get a new selection without reloading the entire page.

### `ForYouSection`

`ForYouSection` displays a short selection of personalized recommendations on the Discover page.

Recommendations use the user's stored favorite genres.

The component also links to:

```text
/discover?view=for-you
```

to view more recommendations.

### `ForYouRecommendations`

`ForYouRecommendations` displays the expanded recommendations view.

Recommendations are organized from the user's reading preferences and each selection can be refreshed independently.

## Discover hooks

Discover logic is separated into several hooks to avoid mixing data calls, React state, and JSX.

### `useDiscoverSearch`

`useDiscoverSearch` centralizes search.

It synchronizes search with:

```text
?q=
```

and coordinates Google Books requests and suggestions displayed while typing.

### `useDiscoverHomeBooks`

`useDiscoverHomeBooks` coordinates loading the different shelves on the main view.

It lets sections work independently: an error from one source should not prevent other selections from being displayed.

It also manages independent refreshes for the relevant shelves.

### `useForYouRecommendations`

`useForYouRecommendations` coordinates personalized recommendations.

It uses the user's favorite genres and keeps independent state for the different selections so they can be loaded or refreshed separately.

## Dashboard components

The dashboard is also split into specialized components.

```text
components/dashboard/
├── DashboardHeader.jsx
├── CurrentlyReading.jsx
├── ReadingGoal.jsx
├── RecentlyAdded.jsx
├── ReadingStats.jsx
└── ReadingCompanion.jsx
```

These components use real user data.

They display:

- currently reading books;
- recently added books;
- the annual goal;
- reading statistics;
- the dashboard visual companion.

Each part can also handle its own empty state when the corresponding data is not available yet.

## Collection components

Collection components are grouped in:

```text
components/collections/
```

They separate from the main page the interfaces needed to manage collections.

They support actions to:

- create a collection;
- edit its information;
- confirm deletion;
- display its books;
- add or remove books.

The related data is stored in Firebase and associated with the signed-in user.

## Authentication components

The folder:

```text
components/auth/
```

contains components related to authentication and route protection.

It includes the shared layout for authentication screens and the components that control access to the different parts of the application.

`AuthLayout` integrates the language selector used on Login and Sign Up. This selector lets users change the interface before authentication and relies on i18next local persistence.

`ProtectedRoute` protects pages that require a signed-in user and also manages the required onboarding step when it is not complete.

`PublicOnlyRoute` wraps pages intended for users who are not signed in, such as Login and Sign Up.

## Settings components

Settings page components are grouped in:

```text
components/settings/
```

This separation lets `Settings.jsx` coordinate the page without containing all of its interface.

The different cards handle:

- profile;
- application language;
- reading preferences;
- account-related actions;
- account deletion;
- project information and links.

The page also provides access to Dear Pages documentation and the GitHub repository.

`LanguageCard` reuses the same language selector as the authentication screens, then saves the selected language in the signed-in user's Firebase preferences.

## Layout components

Components responsible for the overall structure are grouped in:

```text
components/layout/
```

### `PageLayout`

`PageLayout` defines the shared structure for the main pages.

It includes:

- navigation;
- backgrounds and textures;
- the main content area;
- the `Outlet` component used by React Router.

### `Sidebar`

`Sidebar` represents the main navigation on screens that are wide enough.

Its layout and dimensions adapt to available space while preserving Dear Pages' visual identity.

### `MobileNav`

`MobileNav` provides navigation for small screens.

The system keeps the same routes and features while adapting their presentation to screen size.

## Services and utilities

Components do not directly access every data source.

**Services** isolate:

- Google Books;
- Open Library;
- Firebase Authentication;
- Firebase Realtime Database;
- preferences;
- library;
- collections;
- personal book data;
- translation.

**Utilities** group reusable transformations and rules, especially for:

- recommendations;
- covers;
- data normalization;
- deduplication;
- description language detection;
- the session cache for description translations;
- some request optimizations.

This separation keeps the architecture clear:

```text
Page
  ↓
Components
  ↓
Hooks / Context
  ↓
Services
  ↓
Firebase / API

Utilities
  ↳ reusable logic
```

:::note
Not every component needs to be split further. A component is extracted when it represents an identifiable part of the interface, can be reused, or avoids mixing too many responsibilities in a single page.
:::

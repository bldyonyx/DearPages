---
title: Recommendations
description: How Dear Pages recommendations work.
---

Dear Pages has a recommendation system integrated into the **Discover** page.

Recommendations combine several sources and mechanisms:

- the user's reading preferences;
- Google Books for genre-based recommendations;
- Open Library for trends;
- a deduplication and anti-repetition system;
- content filtering for automatic recommendation surfaces;
- temporary persistence of some information during the session.

The preferences used to personalize recommendations are associated with the user account and stored with Firebase.

## User preferences

Reading preferences are stored in the user's profile.

They include the favorite genres selected during onboarding and editable from Settings.

These preferences are used to build **Maybe for you** and the expanded view:

```text
/discover?view=for-you
```

The older preferences defined directly in `src/constants/discoverPreferences.js` are no longer the main source of user preferences.

## Candidate sources

Recommendations are built from batches of candidates fetched from external APIs.

For Google Books, the `getBooksBySubject` service searches for books with:

```text
q=subject:<genre>
```

It also accepts:

- `maxResults`, to request a larger batch than the number displayed;
- `startIndex`, to fetch a new result window during refresh.

For trends, `getTrendingBooksDetails` uses Open Library and its `trending` sort.

## Selection and deduplication

Recommendation selection is isolated in:

```text
src/utils/recommendationSelection.js
```

The main function is `selectRecommendationBooks`.

It applies several steps:

1. Deduplicate books received in the candidate batch.
2. Remove books already seen during the session.
3. Remove excluded books when some books should be ignored.
4. Shuffle the remaining books.
5. Keep only the number needed for the shelf.

To recognize duplicates, the application uses several identity values:

- ISBN, when available;
- normalized title + main author;
- Google Books identifier;
- Open Library identifier;
- local object identifier.

This strategy limits duplicates despite differences between book sources.

## Automatic recommendation filtering

Automatic discovery surfaces also apply filtering before books are displayed.

This logic is centralized in:

```text
src/utils/discoveryContentSafety.js
```

It is used to avoid automatically suggesting clearly explicit content in discovery areas.

Filtering applies to:

- **Trending now**;
- **Maybe for you**;
- the expanded genre recommendation view;
- **Must-reads**;
- some candidates from Open Library fallbacks.

The filtering remains deliberately targeted.

General themes such as romance, relationships, sexuality in a non-explicit context, or some health topics are not automatically excluded.

The goal is to control automatically generated recommendations without preventing normal discovery of books that match reading preferences.

Search entered directly by the user remains separate from this mechanism: it responds to an explicit request and therefore does not automatically use the same filtering as recommendation shelves.

## Already seen books

Each shelf keeps identity keys for books that have already been displayed.

This avoids immediately showing the same books again after a refresh.

Trends can still recycle some already-seen books when the number of new candidates becomes insufficient.

This behavior uses `recycleSeenWhenExhausted`, especially because the Open Library source used for trends provides a more limited result set.

## Session persistence

Some recommendation-related information is saved in `sessionStorage` through:

```text
src/utils/recommendationSessionStorage.js
```

This persistence keeps during the session:

- currently displayed books;
- the `startIndex` when a shelf uses Google Books pagination;
- identity keys already seen.

Keys still use the technical prefix:

```text
booktracker:recommendations
```

This prefix is kept to preserve the current storage behavior.

Session persistence does not replace user data stored in Firebase: it only keeps the state of some recommendations during the browser session.

## Discover page

On the default discovery view, `useDiscoverHomeBooks` loads several shelves:

- **Maybe for you**, based on reading preferences;
- **Trending now**, from Open Library;
- **Must-reads**, from Google Books with the `classics` subject.

Trends and must-reads each have their own refresh button.

These refreshes are independent: refreshing trends does not reload must-reads, and the reverse is also true.

Automatically proposed books also go through selection and filtering rules adapted to their shelf before display.

## Expanded view

The view:

```text
/discover?view=for-you
```

is displayed by `ForYouRecommendations`.

It uses `useForYouRecommendations` to create one section per favorite genre.

The genres used for this view come from the user's stored reading preferences.

Each genre has its own state:

- displayed books;
- error;
- loading;
- `startIndex`.

The refresh button for one genre reloads only that section.

Candidates are filtered and selected before display to preserve the same general behavior as other automatic recommendation surfaces.

## Errors and loading

Hooks use separate loading and error states.

The Discover page uses `Promise.allSettled` so a failed request does not necessarily block the other shelves.

Components can display:

- a loading state;
- an error message;
- an empty state when no usable result is available;
- a disabled button during refresh;
- a loading state specific to each genre in the expanded view.

This separation lets one shelf encounter an issue without making the whole Discover page unusable.

## Excluding library books

The selection system accepts books to exclude through `excludedBookIds`.

This logic avoids suggesting some books already present in the library when the related data is provided to selection.

Recommendation selection can therefore remain separate from library logic while still accounting for books the user already owns.

This architecture also makes it possible to evolve personalization without directly mixing Firebase logic with selection utilities.

## Relationship with user preferences

Personalized recommendations use preferences stored for the account.

The general behavior is:

```text
User preferences
        ↓
Favorite genres
        ↓
Google Books
        ↓
Candidate batches
        ↓
Automatic recommendation filtering
        ↓
Deduplication
        ↓
Already seen / excluded books
        ↓
Final selection
        ↓
Recommendation shelves
```

Trends and must-reads follow a similar flow, but use their own sources and selection criteria.

## Search and recommendations

Search and recommendations are two different flows in Dear Pages.

Recommendations are generated automatically from preferences, trends, or predefined selections.

Search, on the other hand, is an explicit user action:

```text
User search
        ↓
Google Books
        ↓
Results matching the query
```

Filtering specific to automatic recommendations is therefore not applied in the same way to search.

This separation keeps discovery surfaces controlled while letting users directly search for books they are interested in.

## Current state

The recommendation system currently includes:

- reading preferences tied to the user account;
- genre recommendations;
- Open Library trends;
- Google Books must-reads;
- multi-source deduplication;
- anti-repetition during the session;
- exclusion of some books;
- filtering of clearly explicit content on automatic surfaces;
- independent refresh by shelf or genre;
- persistence of some information with `sessionStorage`;
- separate loading and error management;
- possible integration of library information in selection.

## Possible evolutions

The system can evolve to use more data from the user's reading journey.

Recommendations could take more into account:

- books already read;
- reading statuses;
- collections;
- personal ratings and reviews;
- other information available in the personal library.

These evolutions can be added progressively without changing the general separation between book sources, recommendation selection, and personal data.

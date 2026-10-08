---
title: Features
description: The main Dear Pages features.
---

Dear Pages is a personal reading tracker designed to let users organize their library, follow their reading, and discover new books.

The application is designed as a **private, personal space**: the library, notes, reviews, collections, preferences, and reading information are associated with the user's account.

The interface is available in **French** and **English**. The language can be changed from the Login and Sign Up screens before authentication, then from Settings once the user is signed in.

## Dashboard

The dashboard gives a personalized overview of reading activity.

It includes:

- currently reading books;
- the annual reading goal;
- recently added books;
- reading statistics;
- a small reading companion integrated into the interface.

The displayed information comes from the user's real data stored in Firebase.

When several books are currently being read, the user can move between them from the dashboard. Covers are displayed as a stack, and the active book can change automatically or manually.

The dashboard also adapts when no book is currently being read or when some data is not available yet.

## Discover Books

The **Discover** page lets users search for and explore new books from several sources.

The main search uses Google Books and offers:

- search by title, author, or keyword;
- suggestions while typing;
- results displayed as cards;
- direct navigation to a detailed book page.

Depending on available data, books can include:

- a title;
- one or more authors;
- a cover;
- a description;
- categories;
- a publication date.

The page also provides several discovery shelves:

- **Maybe for you**, based on the user's favorite genres;
- **Trending now**, powered by Open Library;
- **Must-reads**, built from Google Books;
- an expanded personalized recommendations view available at `/discover?view=for-you`.

Some shelves can be refreshed independently to offer new selections.

The preferences used for recommendations are stored in Firebase and associated with the signed-in account.

## My Library

The **My Library** page gathers the books saved by the user.

Each book can be assigned one of the following statuses:

- **To read**;
- **Reading**;
- **Finished**;
- **Abandoned**.

The library lets users:

- find all saved books;
- search within their library;
- filter books by status;
- open each book's detailed page;
- keep the data after refreshing or signing in again.

Library data is stored in Firebase and isolated for each user.

## Book Page

Each book has a dedicated page available at `/books/:id`.

Dear Pages can load books from Google Books or Open Library and adapts the displayed information to the data that is available.

The page can display:

- the cover;
- the title;
- the authors;
- the publication date;
- the categories;
- the description.

When a description is available in a language different from the interface language, Dear Pages can offer to translate it into French or English using Google Cloud Translation.

The book page is also the central place for personal actions related to the book.

The user can:

- add the book to the library;
- choose or update its reading status;
- remove the book from the library;
- add it to a collection;
- manage personal notes;
- save a star rating;
- write a review;
- keep a finish date when a book is completed.

Personal information is stored in Firebase and restored when the user returns to the book.

## Notes, Reviews, and Ratings

Dear Pages lets users keep personal content associated with their reading.

Depending on the book status, the user can save:

- personal notes;
- a review;
- a star rating.

This information is private and associated with the signed-in account.

Dear Pages does not provide social reviews, public comments, or public reader profiles.

## Collections

Collections make it possible to create custom groups of books independently from their reading status.

The user can:

- create a collection;
- edit a collection;
- delete a collection;
- open a dedicated page for each collection;
- add books to a collection;
- remove books from a collection.

Removing a book from a collection does not remove it from the personal library.

Collections are stored in Firebase and belong only to the signed-in user.

## Account and Authentication

Dear Pages uses Firebase Authentication to manage user accounts.

The application supports:

- creating an account with an email address and password;
- signing in with an email address and password;
- continuing with Google;
- choosing the interface language before login or signup;
- signing out;
- deleting the account with confirmation.

Personal application routes are protected and require authentication.

## Onboarding and Preferences

During first use, Dear Pages provides onboarding to define the main reading preferences.

The user can choose:

- favorite genres;
- an annual reading goal.

These preferences are stored in Firebase and used in different parts of the application, including:

- recommendations on the Discover page;
- the reading goal on the dashboard.

They can later be changed from Settings.

## Settings

The **Settings** page gathers the main account information and lets users edit certain preferences.

It lets users:

- view profile information;
- change the interface language;
- edit favorite genres;
- edit the annual reading goal;
- sign out;
- delete the account;
- access the Dear Pages technical documentation;
- access the project's GitHub repository.

## Responsive

Dear Pages is designed to work across several screen sizes.

The interface adapts:

- navigation;
- the sidebar;
- book cards;
- content pages;
- modals;
- dashboard layouts.

The application has been adapted and checked on different screen sizes to keep navigation and presentation coherent on desktop, tablet, and mobile.

:::note
The main Dear Pages features are implemented. The application also has automated tests and has been manually checked before its final version.
:::

---
title: Firebase
description: Use of Firebase for authentication, personal data, and Dear Pages hosting.
---

Dear Pages uses **Firebase** to manage authentication, personal data associated with users, and project hosting.

Unlike Google Books and Open Library, which provide public book information, Firebase stores account-specific information and deploys the application and documentation.

## Role of Firebase

Firebase is mainly involved in three Dear Pages areas:

- **Firebase Authentication** to create, sign in, and identify users;
- **Firebase Realtime Database** to store their personal data;
- **Firebase Hosting** to host the application and documentation.

Bibliographic book information still comes from Google Books and Open Library.

## Authentication

Firebase Authentication manages user accounts and sign-in state.

Dear Pages supports:

- account creation with an email address and password;
- sign-in with an email address and password;
- Google authentication;
- sign-out;
- retrieving signed-in account information;
- session persistence;
- account deletion.

The authentication context lets the application know the current signed-in user and make personal data available inside their space.

The general flow is:

```text
Sign up / Sign in
        │
        ▼
Firebase Authentication
        │
        ▼
Identified user
        │
        ▼
Load personal data
        │
        ▼
Access Dear Pages
```

The main pages in this flow are:

```text
pages/
├── Login.jsx
├── SignUp.jsx
└── Onboarding.jsx
```

Protected routes also use authentication state to prevent non-signed-in users from accessing personal application pages.

## Google authentication

Dear Pages also lets users sign in with a Google account through Firebase Authentication.

When a user uses this method, Firebase provides the account information needed by the application, including the Firebase identity and profile information available from the provider.

Dear Pages then uses this information to identify the user and display the available profile information.

## Firebase Realtime Database

**Firebase Realtime Database** is the database Dear Pages uses for user-specific information.

Data is organized so it is associated with the Firebase identifier of the relevant account.

It includes:

- reading preferences;
- annual goal;
- personal library;
- reading statuses;
- collections;
- personal notes;
- ratings;
- reviews;
- reading information associated with books.

This organization keeps each user's data separate.

## Reading preferences

Reading preferences are stored with user data.

They include:

- favorite genres;
- annual reading goal;
- preferred interface language.

This information is used by Dear Pages to personalize parts of the application, including:

- recommendations on the Discover page;
- the annual goal displayed on the dashboard.

Preferences can be set during onboarding and then changed from **Settings**.

Language follows the same principle:

- before authentication, the choice made from Login or Sign Up is stored locally by i18next;
- when an email or Google account is created, that language is saved in the initial Firebase preferences;
- when a signed-in user returns to the application, the language stored in preferences is applied if it is supported;
- from **Settings**, changing language updates the interface and also saves the new value in Firebase.

## Library

The personal library uses user data stored in Firebase Realtime Database.

It keeps:

- added books;
- their reading status;
- their added date;
- the information needed to display them;
- some reading-tracking information.

Public book data from Google Books or Open Library remains conceptually separate from user-specific information.

For example, two users can have the same book in their library with different statuses and personal data.

## Collections

Collections are also personal data stored in Firebase Realtime Database.

They let each user create their own groups of books independently from reading status.

The user can:

- create a collection;
- edit a collection;
- delete a collection;
- add books;
- remove books;
- view a collection's contents.

A collection belongs to the account that created it.

Removing a book from a collection does not remove it from the personal library.

## Notes, ratings, and reviews

Personal data associated with books is also stored with user data.

It can include:

- personal notes;
- a star rating;
- a review;
- some information related to finishing a book.

This information represents the user's personal relationship with the book.

It is not sent to Google Books or Open Library and does not become public review content.

## Firebase services

Firebase access logic is separated from the React interface.

Dedicated services let components and pages communicate with Firebase without placing all persistence logic directly in components.

The organization includes services responsible for:

```text
services/
├── authentication
├── preferences
├── library
├── collections
└── personal book data
```

This separation keeps components mainly responsible for display and user interaction.

## Data flow

The general behavior can be represented as:

```text
Google Books / Open Library
          │
          ▼
   Public information
          │
          ▼
      Dear Pages
          │
     ┌────┴────┐
     │         │
     ▼         ▼
   React      Firebase
interface       │
                ├── Authentication
                │
                └── Realtime Database
                     ├── Preferences
                     ├── Library
                     ├── Collections
                     └── Reading data
```

The different sources therefore have distinct responsibilities:

**Google Books and Open Library provide public book information.**

**Firebase Authentication identifies the user.**

**Firebase Realtime Database stores user-specific data and the user's relationship with books.**

## Account deletion

Dear Pages lets users request account deletion from Settings.

Deletion goes through Firebase Authentication and also accounts for personal data associated with the account.

Some sensitive operations can require recent authentication before they can be completed.

## Security and data separation

Personal data is associated with the authenticated user.

The application therefore does not treat library, collection, or preference data as global data shared between all users.

This separation is essential to keep a personal reading space for each account.

Public information from book APIs and personal information stored in Firebase therefore have different roles in the architecture.

## Firebase Hosting

Firebase is also used to host Dear Pages.

The project has two Firebase Hosting targets:

```text
app  → Dear Pages application
docs → Astro + Starlight documentation
```

This separation lets the application and documentation have their own sites while remaining attached to the same Firebase project.

Deployments are automated with GitHub Actions.

The general flow is:

```text
Push to main
      │
      ▼
GitHub Actions
      │
      ├── Application build
      │        ↓
      │   Firebase Hosting → app
      │
      └── Documentation build
               ↓
          Firebase Hosting → docs
```

## Current state

Firebase is an integral part of the final Dear Pages architecture.

It handles:

- authentication;
- user sessions;
- reading preferences;
- language preference;
- library;
- reading statuses;
- collections;
- personal data associated with books;
- account deletion;
- application hosting;
- documentation hosting.

This architecture keeps a clear separation between **public book data**, provided by external APIs, and **personal reading data**, stored for each user with Firebase.

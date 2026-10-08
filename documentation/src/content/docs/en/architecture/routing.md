---
title: Routing
description: Organization of Dear Pages navigation and routes with React Router.
---

Dear Pages uses **React Router** to manage navigation between application pages without fully reloading the browser.

The main routes are defined in `App.jsx`.

## Route structure

```text
/
├── discover
├── library
├── books/:id
├── collections
├── collections/:id
└── settings

/onboarding

/login
/signup
```

Routes are split between protected application pages and public authentication pages.

## Protected routes

The main Dear Pages pages are available only when a user is signed in.

They are grouped behind the `ProtectedRoute` component.

```jsx
<Route element={<ProtectedRoute />}>
  <Route element={<PageLayout />}>
    <Route path="/" element={<Dashboard />} />
    <Route path="/discover" element={<Discover />} />
    <Route path="/library" element={<MyLibrary />} />
    <Route path="/books/:id" element={<BookPage />} />
    <Route path="/collections" element={<Collections />} />
    <Route
      path="/collections/:id"
      element={<CollectionPage />}
    />
    <Route path="/settings" element={<Settings />} />
  </Route>

  <Route path="/onboarding" element={<Onboarding />} />
</Route>
```

`ProtectedRoute` checks:

- whether authentication state is still loading;
- whether a user is signed in;
- whether preferences have been loaded;
- whether onboarding still needs to be completed.

A non-signed-in user who tries to access a protected route is redirected to `/signup`.

If the user still needs to complete onboarding, they are redirected to `/onboarding`.

Once onboarding is complete, it can no longer be shown as a required step and the user is redirected to the dashboard.

## Main layout

The main application pages use `PageLayout`.

`PageLayout` contains the shared page elements, including navigation and the area where the active route content is displayed.

React Router uses the `Outlet` component for that.

Onboarding remains protected by authentication, but it sits outside `PageLayout` so it can use its own layout.

## Public routes

Authentication pages are grouped behind `PublicOnlyRoute`.

```jsx
<Route element={<PublicOnlyRoute />}>
  <Route path="/login" element={<Login />} />
  <Route path="/signup" element={<SignUp />} />
</Route>
```

These routes have their own interface and do not use the application's main navigation.

They are intended for users who are not signed in yet.

## Dynamic routes

Dear Pages uses parameters in some URLs to identify the resource to display.

### Book

```text
/books/:id
```

The `:id` parameter identifies the book whose page should be displayed.

For example:

```text
/books/abc123
```

The Book Page can then retrieve and display the information for the requested book.

### Collection

```text
/collections/:id
```

The same principle opens a specific collection page using its identifier.

Collections belong to the signed-in user and their data is loaded from Firebase.

## Search parameters

The Discover page also uses URL parameters to determine some display modes.

### Search

```text
/discover?q=novel
```

When `q` is present, `Discover.jsx` displays search mode.

The `useDiscoverSearch` hook synchronizes search state with this parameter, launches the Google Books request, and passes results to the relevant components.

This also keeps a URL that directly represents the active search.

### Extended recommendations

```text
/discover?view=for-you
```

When `view=for-you` is present and no search is active, the page displays the expanded personalized recommendations view.

These recommendations use the user's stored favorite genres.

If `q` is also present, search remains prioritized over `view=for-you`.

## Responsive navigation

Navigation adapts to screen size without changing the available routes.

On wider screens, Dear Pages uses a **sidebar**.

On mobile, the main navigation uses a **bottom navigation bar** with `MobileNav`.

Routes and data remain identical: only their presentation changes according to the screen size.

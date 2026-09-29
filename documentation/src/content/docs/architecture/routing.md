---
title: Routing
description: Organisation de la navigation et des routes de Dear Pages avec React Router.
---

Dear Pages utilise **React Router** pour gérer la navigation entre les différentes pages de l'application sans recharger complètement le navigateur.

Les routes principales sont définies dans `App.jsx`.

## Structure des routes

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

Les routes sont réparties entre les pages protégées de l'application et les pages publiques d'authentification.

## Routes protégées

Les pages principales de Dear Pages sont accessibles uniquement lorsqu'un utilisateur est connecté.

Elles sont regroupées derrière le composant `ProtectedRoute`.

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

`ProtectedRoute` vérifie notamment :

- si l'état d'authentification est encore en cours de chargement ;
- si un utilisateur est connecté ;
- si ses préférences ont été chargées ;
- si l'onboarding doit encore être complété.

Un utilisateur non connecté qui tente d'accéder à une route protégée est redirigé vers `/signup`.

Si l'utilisateur doit encore compléter son onboarding, il est redirigé vers `/onboarding`.

Une fois l'onboarding terminé, il ne peut plus être affiché comme étape obligatoire et l'utilisateur est redirigé vers le tableau de bord.

## Layout principal

Les principales pages de l'application utilisent `PageLayout`.

`PageLayout` contient les éléments communs à ces pages, notamment la navigation et la zone dans laquelle le contenu de la route active est affiché.

React Router utilise pour cela le composant `Outlet`.

L'onboarding reste protégé par l'authentification, mais se trouve en dehors de `PageLayout` afin de disposer de sa propre mise en page.

## Routes publiques

Les pages d'authentification sont regroupées derrière `PublicOnlyRoute`.

```jsx
<Route element={<PublicOnlyRoute />}>
  <Route path="/login" element={<Login />} />
  <Route path="/signup" element={<SignUp />} />
</Route>
```

Ces routes possèdent leur propre interface et n'utilisent pas la navigation principale de l'application.

Elles sont destinées aux utilisateurs qui ne sont pas encore connectés.

## Routes dynamiques

Dear Pages utilise des paramètres dans certaines URL afin d'identifier la ressource à afficher.

### Livre

```text
/books/:id
```

Le paramètre `:id` permet d'identifier le livre dont la fiche doit être affichée.

Par exemple :

```text
/books/abc123
```

La Book Page peut ensuite récupérer et afficher les informations correspondant au livre demandé.

### Collection

```text
/collections/:id
```

Le même principe permet d'ouvrir la page d'une collection particulière selon son identifiant.

Les collections appartiennent à l'utilisateur connecté et leurs données sont récupérées depuis Firebase.

## Paramètres de recherche

La page Découvrir utilise également des paramètres d'URL pour déterminer certains modes d'affichage.

### Recherche

```text
/discover?q=roman
```

Lorsque `q` est présent, `Discover.jsx` affiche le mode recherche.

Le hook `useDiscoverSearch` synchronise la recherche avec ce paramètre, lance la requête Google Books et transmet les résultats aux composants concernés.

Cela permet également de conserver une URL représentant directement la recherche active.

### Recommandations étendues

```text
/discover?view=for-you
```

Lorsque `view=for-you` est présent et qu'aucune recherche n'est active, la page affiche la vue étendue des recommandations personnalisées.

Ces recommandations utilisent les genres préférés enregistrés pour l'utilisateur.

Si `q` est également présent, la recherche reste prioritaire sur `view=for-you`.

## Navigation responsive

La navigation s'adapte à la taille de l'écran sans modifier les routes disponibles.

Sur les écrans plus larges, Dear Pages utilise une **sidebar**.

Sur mobile, la navigation principale utilise une **barre de navigation inférieure** avec `MobileNav`.

Les routes et les données restent donc identiques : seule leur présentation change selon la taille de l'écran.
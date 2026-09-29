---
title: Composants
description: Organisation et rôle des principaux composants React de Dear Pages.
---

Dear Pages utilise des **composants React** pour diviser l'interface en éléments plus petits, réutilisables et plus faciles à maintenir.

L'architecture sépare les responsabilités entre plusieurs niveaux :

- les **pages** coordonnent les vues ;
- les **composants** construisent l'interface ;
- les **hooks** centralisent certains états et chargements ;
- le **contexte React** partage l'authentification et les préférences ;
- les **services** communiquent avec Firebase et les API externes ;
- les **utilitaires** isolent la logique réutilisable.

## Organisation des composants

Les composants sont regroupés par fonctionnalité.

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

Cette organisation permet de garder ensemble les composants qui appartiennent à une même partie de l'application tout en conservant les éléments génériques dans `ui`.

## Composants d'interface

Le dossier :

```text
components/ui/
```

regroupe les éléments génériques pouvant être utilisés à plusieurs endroits dans l'application.

On y retrouve notamment des éléments comme les boutons, champs, modales, badges ou cartes utilisés pour construire une interface cohérente.

L'objectif est d'éviter de recréer les mêmes éléments dans chaque page et de centraliser leur comportement visuel.

## Composants liés aux livres

Les composants spécifiques aux livres sont regroupés dans :

```text
components/books/
```

Ils sont utilisés dans plusieurs parties de Dear Pages, notamment :

- Découvrir ;
- les résultats de recherche ;
- Ma bibliothèque ;
- les collections ;
- le tableau de bord ;
- la fiche détaillée d'un livre.

### `BookCard`

`BookCard` représente un livre sous une forme compacte.

Selon son contexte d'utilisation, il peut notamment afficher :

- une couverture ;
- un titre ;
- un auteur ;
- certaines informations complémentaires liées au livre.

Lorsqu'un identifiant est disponible, la carte peut permettre d'accéder à :

```text
/books/:id
```

Sa mise en page reste suffisamment flexible pour être utilisée dans différents conteneurs et différentes tailles d'écran.

## Page Découvrir

`Discover.jsx` coordonne trois modes principaux :

- la vue de découverte par défaut ;
- la recherche lorsque l'URL contient `?q=...` ;
- la vue étendue des recommandations lorsque l'URL contient `?view=for-you`.

La page assemble des hooks et des composants spécialisés au lieu de contenir toute la logique directement.

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

`DiscoverHome` affiche la vue principale de découverte.

Elle regroupe notamment :

- **Peut-être pour toi** ;
- **Tendances du moment** ;
- **Les incontournables**.

Les différentes étagères disposent de leurs propres données et états afin qu'un problème sur une source ne bloque pas toute la page.

### `DiscoverSearch`

`DiscoverSearch` gère l'interface de recherche.

Il travaille avec `useDiscoverSearch` pour afficher la saisie, les suggestions et les différents états associés à la recherche.

### `SearchSuggestions`

`SearchSuggestions` affiche les propositions obtenues pendant la saisie.

Les suggestions permettent d'accéder directement à la fiche du livre correspondant.

### `SearchResults`

`SearchResults` affiche les résultats provenant de Google Books.

Le composant gère notamment :

- le chargement ;
- les erreurs ;
- les résultats disponibles ;
- l'absence de résultats.

### `DiscoverShelf`

`DiscoverShelf` représente une étagère responsive de livres.

Certaines étagères peuvent être rafraîchies indépendamment afin d'obtenir une nouvelle sélection sans recharger l'ensemble de la page.

### `ForYouSection`

`ForYouSection` affiche une sélection courte de recommandations personnalisées dans la page Découvrir.

Les recommandations utilisent les genres préférés enregistrés pour l'utilisateur.

Le composant permet également d'accéder à :

```text
/discover?view=for-you
```

pour consulter davantage de recommandations.

### `ForYouRecommendations`

`ForYouRecommendations` affiche la vue étendue des recommandations.

Les recommandations sont organisées à partir des préférences de lecture de l'utilisateur et les différentes sélections peuvent être renouvelées indépendamment.

## Hooks de Découvrir

La logique de Découvrir est séparée dans plusieurs hooks afin d'éviter de mélanger les appels de données, les états React et le JSX.

### `useDiscoverSearch`

`useDiscoverSearch` centralise la recherche.

Il synchronise notamment la recherche avec le paramètre :

```text
?q=
```

et coordonne les recherches Google Books ainsi que les suggestions affichées pendant la saisie.

### `useDiscoverHomeBooks`

`useDiscoverHomeBooks` coordonne le chargement des différentes étagères de la vue principale.

Il permet aux sections de fonctionner de manière indépendante : une erreur provenant d'une source ne doit pas empêcher les autres sélections d'être affichées.

Il gère également le rafraîchissement indépendant des étagères concernées.

### `useForYouRecommendations`

`useForYouRecommendations` coordonne les recommandations personnalisées.

Il utilise les genres préférés de l'utilisateur et conserve des états indépendants pour les différentes sélections afin de pouvoir les charger ou les renouveler séparément.

## Composants du tableau de bord

Le tableau de bord est lui aussi séparé en plusieurs composants spécialisés.

```text
components/dashboard/
├── DashboardHeader.jsx
├── CurrentlyReading.jsx
├── ReadingGoal.jsx
├── RecentlyAdded.jsx
├── ReadingStats.jsx
└── ReadingCompanion.jsx
```

Ces composants utilisent les données réelles associées à l'utilisateur.

Ils permettent notamment d'afficher :

- les lectures en cours ;
- les livres récemment ajoutés ;
- l'objectif annuel ;
- les statistiques de lecture ;
- le compagnon visuel du tableau de bord.

Chaque partie peut également gérer son propre état vide lorsque les données correspondantes ne sont pas encore disponibles.

## Composants de collections

Les composants liés aux collections sont regroupés dans :

```text
components/collections/
```

Ils permettent de séparer de la page principale les interfaces nécessaires à la gestion des collections.

Ils participent notamment aux actions permettant de :

- créer une collection ;
- modifier ses informations ;
- confirmer sa suppression ;
- afficher ses livres ;
- ajouter ou retirer des livres.

Les données correspondantes sont enregistrées dans Firebase et associées à l'utilisateur connecté.

## Composants d'authentification

Le dossier :

```text
components/auth/
```

contient les composants liés au parcours d'authentification et à la protection des routes.

Il comprend notamment la mise en page commune des écrans d'authentification ainsi que les composants chargés de contrôler l'accès aux différentes parties de l'application.

`ProtectedRoute` protège les pages nécessitant un utilisateur connecté et gère également le passage obligatoire par l'onboarding lorsque celui-ci n'est pas terminé.

`PublicOnlyRoute` encadre les pages destinées aux utilisateurs non connectés, comme Login et Sign Up.

## Composants des paramètres

Les composants de la page Paramètres sont regroupés dans :

```text
components/settings/
```

Cette séparation permet à `Settings.jsx` de coordonner la page sans contenir toute son interface.

Les différentes cartes prennent notamment en charge :

- le profil ;
- les préférences de lecture ;
- les actions liées au compte ;
- la suppression du compte ;
- les informations et liens liés au projet.

La page donne également accès à la documentation Dear Pages et au dépôt GitHub.

## Composants de layout

Les composants responsables de la structure générale sont regroupés dans :

```text
components/layout/
```

### `PageLayout`

`PageLayout` définit la structure commune des pages principales.

Il contient notamment :

- la navigation ;
- les arrière-plans et textures ;
- la zone principale de contenu ;
- le composant `Outlet` utilisé par React Router.

### `Sidebar`

`Sidebar` représente la navigation principale sur les écrans suffisamment larges.

Sa disposition et ses dimensions s'adaptent à l'espace disponible tout en conservant l'identité visuelle de Dear Pages.

### `MobileNav`

`MobileNav` fournit la navigation adaptée aux petits écrans.

Le système permet de conserver les mêmes routes et fonctionnalités tout en adaptant leur présentation à la taille de l'écran.

## Services et utilitaires

Les composants n'accèdent pas directement à toutes les sources de données.

Les **services** isolent notamment :

- Google Books ;
- Open Library ;
- Firebase Authentication ;
- Firestore ;
- les préférences ;
- la bibliothèque ;
- les collections ;
- les données personnelles des livres ;
- la traduction.

Les **utilitaires** regroupent les transformations et règles réutilisables, notamment pour :

- les recommandations ;
- les couvertures ;
- la normalisation des données ;
- la déduplication ;
- certaines optimisations de requêtes.

Cette séparation permet de conserver une architecture claire :

```text
Page
  ↓
Composants
  ↓
Hooks / Context
  ↓
Services
  ↓
Firebase / API

Utilitaires
  ↳ logique réutilisable
```

:::note
Tous les composants n'ont pas besoin d'être séparés davantage. Un composant est extrait lorsqu'il représente une partie identifiable de l'interface, peut être réutilisé ou permet d'éviter de mélanger trop de responsabilités dans une même page.
:::
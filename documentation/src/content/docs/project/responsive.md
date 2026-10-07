---
title: Responsive
description: Stratégie responsive utilisée pour adapter Dear Pages aux différentes tailles d'écran.
---

Dear Pages est conçu pour s'adapter aux différentes tailles d'écran, du mobile aux grands écrans desktop.

Le responsive ne repose pas uniquement sur la réduction de la taille des éléments. La structure de navigation, les espacements, la largeur de la sidebar et la zone principale évoluent également selon l'espace disponible.

## Breakpoint principal

Le layout utilise principalement le breakpoint `lg` de Tailwind CSS.

```text
< 1024 px
→ navigation mobile
→ header fixe
→ MobileNav en bas

≥ 1024 px
→ sidebar fixe
→ navigation desktop
→ contenu principal à droite
```

Le breakpoint `lg` correspond donc au changement principal de structure de l'application.

Les différents formats d'écran sont testés avec plusieurs viewport presets pendant le développement :

```text
mobile
tablet portrait
tablet landscape
laptop 1366
laptop 1440
desktop 1080
desktop tall
qhd desktop
my viewport
```

Ces presets servent à vérifier le comportement de l'interface dans différentes largeurs et hauteurs. Ils ne correspondent pas directement à des breakpoints CSS supplémentaires.

## Layout mobile et tablette

En dessous de `lg`, `PageLayout` affiche un header fixe en haut de l'écran :

```text
┌─────────────────────────────┐
│ Dear Pages          ⚙       │
├─────────────────────────────┤
│                             │
│                             │
│        Contenu              │
│                             │
│                             │
├─────────────────────────────┤
│ Accueil Découvrir           │
│ Bibliothèque Collections    │
└─────────────────────────────┘
```

Le header contient :

- le logo et le nom Dear Pages ;
- un lien vers les paramètres.

Le contenu principal utilise un padding supérieur afin de ne pas passer sous le header :

```text
pt-16
```

La navigation mobile est fournie par `MobileNav`.

Elle reste fixée en bas de l'écran et affiche :

- Accueil ;
- Découvrir ;
- Bibliothèque ;
- Collections.

Elle est masquée à partir de `lg`.

## Layout desktop

À partir de `lg`, le header mobile et `MobileNav` disparaissent.

La navigation principale devient une sidebar fixe :

```text
┌──────────────┬─────────────────────────────┐
│              │                             │
│ Dear Pages   │                             │
│              │                             │
│ Accueil      │                             │
│ Découvrir    │        Contenu              │
│ Bibliothèque │                             │
│ Collections  │                             │
│              │                             │
│      note    │                             │
│              │                             │
│ Paramètres   │                             │
└──────────────┴─────────────────────────────┘
```

La sidebar utilise notamment :

```text
lg:flex
lg:w-72
```

La zone principale est décalée pour laisser la place à la sidebar :

```text
lg:ml-72
lg:w-[calc(100%-18rem)]
```

Le contenu reçoit également un padding et des coins arrondis sur desktop :

```text
lg:p-4
lg:rounded-2xl
```

## Adaptation selon la hauteur

Dear Pages adapte également la largeur de la sidebar et du contenu lorsque le viewport devient particulièrement haut.

À partir de `1000px` de hauteur :

```text
sidebar → 20rem
contenu → calc(100% - 20rem)
```

À partir de `1200px` :

```text
sidebar → 22rem
contenu → calc(100% - 22rem)
```

À partir de `1400px` :

```text
sidebar → 24rem
contenu → calc(100% - 24rem)
```

La sidebar adapte également ses espacements internes :

```text
1000px → padding et gaps légèrement augmentés
1200px → espacements augmentés
1400px → espacements encore augmentés
```

Cette logique permet notamment de conserver une composition équilibrée sur les écrans très hauts.

## Très grands écrans

Des règles supplémentaires prennent en compte la largeur et la hauteur simultanément.

Par exemple :

```text
≥ 1800px de largeur
+ ≥ 1050px de hauteur
→ padding supplémentaire
```

```text
≥ 2200px de largeur
+ ≥ 1100px de hauteur
→ padding supplémentaire
```

```text
≥ 2400px de largeur
+ ≥ 1300px de hauteur
→ padding encore augmenté
```

Ces règles concernent principalement les espacements du contenu et sa hauteur minimale.

## Sidebar

La sidebar est définie dans :

```text
src/components/layout/sidebar/Sidebar.jsx
```

Elle est uniquement visible à partir de `lg`.

Sa largeur évolue selon la hauteur du viewport :

```text
lg                 → 18rem
hauteur ≥ 1000px   → 20rem
hauteur ≥ 1200px   → 22rem
hauteur ≥ 1400px   → 24rem
```

Les espacements internes suivent également cette logique afin de conserver les proportions de la composition.

La navigation est organisée en deux zones :

```text
Navigation principale
        ↓
zone flexible
        ↓
SidebarNote
        ↓
zone flexible
        ↓
Paramètres
```

Cela permet notamment de maintenir la note décorative au centre de la partie restante de la sidebar et de garder `Paramètres` vers le bas.

## Navigation mobile

`MobileNav` est affichée uniquement sous `lg`.

Elle utilise une navigation horizontale où chaque élément occupe une part équivalente de la largeur disponible :

```text
flex-1
```

Les quatre entrées restent donc accessibles même sur les petits écrans.

La barre utilise également :

```text
w-dvw
fixed bottom-0
```

afin de rester attachée au bas du viewport.

## PageLayout

Le composant :

```text
src/components/layout/PageLayout.jsx
```

gère la structure responsive globale.

Il contient :

- `Sidebar` ;
- le header mobile ;
- la zone principale ;
- `Outlet` pour afficher la route active ;
- `MobileNav`.

La structure générale peut être résumée ainsi :

```text
                    PageLayout
                        │
          ┌─────────────┴─────────────┐
          │                           │
      < 1024px                    ≥ 1024px
          │                           │
   Mobile + tablette               Desktop
          │                           │
     ┌────┴────┐                ┌─────┴─────┐
     │          │                │           │
   Header   MobileNav         Sidebar     Content
     │          │                │           │
     └────┬─────┘                └─────┬─────┘
          │                            │
          └──────── Contenu ───────────┘
```

Les routes React Router restent identiques quelle que soit la taille de l'écran. Seule la présentation de la navigation et du layout change.

## Page Découvrir

La page Découvrir possède également son propre responsive.

Les étagères de livres utilisent différentes configurations de grille selon la largeur disponible :

```text
mobile → 2 cartes
md     → 3 cartes
lg     → 4 cartes
xl     → 5 cartes
```

Les cartes utilisent notamment une largeur maximale :

```text
max-w-40
```

afin de conserver des proportions régulières lorsque davantage de cartes peuvent être affichées.

Les sections de Découvrir concernées comprennent notamment :

- `DiscoverShelf` ;
- `ForYouSection` ;
- `ForYouRecommendations`.

## Recherche

Le champ de recherche de Découvrir possède également une largeur adaptée aux petits écrans :

```text
max-w-[calc(100vw-3rem)]
md:max-w-2xl
```

Cela évite qu'il dépasse de l'écran sur mobile tout en permettant une largeur plus confortable sur les écrans plus larges.

Les en-têtes des sections passent également d'une organisation verticale à horizontale à partir de `md` :

```text
md:flex-row
md:items-center
md:justify-between
```

Les suggestions de recherche sont également adaptées aux petits écrans. Leur hauteur est limitée afin qu'elles restent accessibles au-dessus de la navigation mobile.

Lorsque toutes les suggestions ne peuvent pas être affichées simultanément, la liste peut défiler verticalement indépendamment de la page tout en conservant le scroll tactile.

## Résultats de recherche

Les résultats de recherche utilisent une grille responsive.

Sur mobile :

```text
grid-cols-2
```

À partir de `sm`, la grille peut adapter automatiquement le nombre de colonnes :

```text
sm:grid-cols-[repeat(auto-fit,minmax(9rem,10rem))]
```

Cela permet de conserver des cartes relativement compactes tout en utilisant l'espace disponible.

## Gestion de l'overflow

Une attention particulière est portée aux débordements horizontaux.

Le layout utilise notamment :

```text
overflow-x-hidden
min-w-0
max-w-full
```

ainsi que des contraintes de largeur sur certains éléments.

Ces règles sont particulièrement importantes sur mobile, où les champs, les grilles et les éléments flexibles disposent de beaucoup moins d'espace.

Les éléments interactifs qui possèdent leur propre zone de défilement, comme les suggestions de recherche, sont également contraints afin de ne pas passer derrière la navigation mobile fixe.

## État actuel

Le responsive est pris en compte pour :

- le layout général ;
- la navigation mobile ;
- la navigation desktop ;
- la sidebar ;
- les différentes hauteurs de viewport ;
- les très grands écrans ;
- le tableau de bord ;
- la page Découvrir ;
- les étagères de livres ;
- les recommandations ;
- les suggestions et résultats de recherche ;
- la bibliothèque ;
- les collections ;
- les fiches de livres ;
- les paramètres ;
- les modales ;
- les champs et éléments susceptibles de provoquer un overflow.

Les principaux parcours de Dear Pages ont été vérifiés sur différentes tailles d'affichage afin de conserver une interface cohérente et utilisable sur desktop, tablette et mobile.
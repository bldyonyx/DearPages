---
title: Responsive
description: Responsive strategy used to adapt Dear Pages to different screen sizes.
---

Dear Pages is designed to keep the same main features available on desktop, tablet, and mobile while adapting the layout to the available space.

The responsive approach is handled mostly with Tailwind CSS classes and a few shared responsive constants used by components.

## Main breakpoint

The application relies on responsive breakpoints to move from compact layouts to wider layouts.

On smaller screens, content is stacked vertically and navigation uses the mobile bar.

On wider screens, the interface can display more information side by side and use the sidebar.

## Mobile and tablet layout

On mobile and tablet, Dear Pages prioritizes readable content and direct access to primary actions.

The layout uses:

- vertical stacking;
- full-width content areas;
- smaller gaps;
- navigation adapted to touch interaction;
- cards sized for narrow screens.

The goal is to keep the application usable without requiring horizontal scrolling.

## Desktop layout

On desktop, Dear Pages can use the available width to display richer layouts.

Pages can include:

- a persistent sidebar;
- wider content columns;
- grids of book cards;
- side-by-side dashboard sections;
- larger visual surfaces.

Desktop layout keeps the same data and routes as mobile; only the presentation changes.

## Height adaptation

Some components also account for available height.

This is useful for areas such as dashboards, shelves, navigation, and panels where content should remain visible without pushing important controls too far away.

## Very large screens

On very large screens, the interface avoids stretching content indefinitely.

Constrained widths and grid rules keep text readable and preserve the intended composition.

## Sidebar

The sidebar is used on sufficiently wide screens.

It provides access to the main routes and keeps the application navigation visible while the user moves through pages.

Its size and spacing adapt to the available viewport while keeping the Dear Pages visual identity.

## Mobile navigation

On smaller screens, navigation moves to `MobileNav`.

This bottom navigation keeps the main destinations accessible without requiring the desktop sidebar.

Routes remain identical across layouts.

## PageLayout

`PageLayout` centralizes the shared page structure.

It combines:

- navigation;
- backgrounds and textures;
- the main content area;
- React Router's `Outlet`;
- spacing rules adapted to the viewport.

This avoids repeating the same responsive shell across each page.

## Discover page

The Discover page must handle several content densities:

- a search interface;
- suggestions;
- result cards;
- discovery shelves;
- personalized recommendation sections.

The responsive strategy keeps shelves readable on small screens and lets grids expand on larger ones.

## Search

Search fields and suggestions are designed to remain accessible on mobile.

The search state is synchronized with the `?q=` URL parameter, so the responsive layout does not change the navigation model.

## Search results

Search results use cards that can fit narrow screens and expand into denser layouts on wider screens.

Loading, empty, and error states must preserve stable spacing so the page remains easy to scan.

## Overflow management

The application avoids horizontal overflow by using flexible containers, constrained widths, and responsive grids.

Long content such as descriptions, notes, and labels is displayed in containers that can wrap text.

## Current state

The application has been adapted and checked across several screen sizes.

The main routes, dashboard, Discover page, library, collections, settings, authentication screens, and book page all keep the same feature surface while adapting their layout to desktop, tablet, and mobile.

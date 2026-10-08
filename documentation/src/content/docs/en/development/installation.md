---
title: Installation
description: Installing and running Dear Pages in a development environment.
---

Dear Pages is a React application created with **Vite**.

The project also contains separate documentation built with **Astro + Starlight**.

This page presents the steps needed to retrieve the project and run the different local environments.

## Prerequisites

Before installing the project, you need:

- **Node.js**
- **npm**
- **Git**

A code editor such as Visual Studio Code can also be used to work on the project.

## Get the project

The project can be cloned from its GitHub repository:

```bash
git clone https://github.com/bldyonyx/DearPages.git
```

Then enter the folder:

```bash
cd DearPages
```

## Install dependencies

Dependencies for the main application are defined in the root `package.json`.

To install them:

```bash
npm install
```

This command installs the dependencies required to run Dear Pages.

## Environment variables

Dear Pages uses several environment variables to communicate with external services.

They are used for:

- Google Books;
- Google Cloud Translation;
- Firebase.

A `.env` file must be created at the project root for local development.

```text
DearPages/
├── .env
├── src/
├── documentation/
├── package.json
└── vite.config.js
```

The real key values must not be added to the documentation or the Git repository.

The variables used by the project are detailed on the **Environment variables** page.

:::note
Variables used on the frontend with the `VITE_` prefix are included in the build and should not be considered server secrets. The related keys must therefore be properly restricted with their providers.
:::

## Run the application

After installing dependencies and configuring the environment:

```bash
npm run dev
```

Vite starts the development server and displays the local address where Dear Pages can be opened in the browser.

## Production build

To check the main application build:

```bash
npm run build
```

Vite generates the optimized application files in the build folder.

Deployment of the main application is then handled by GitHub Actions and Firebase Hosting.

## Astro documentation

The documentation has its own Astro project located in:

```text
documentation/
```

From the Dear Pages root:

```bash
cd documentation
npm install
```

Then start the development server:

```bash
npm run dev
```

The documentation can then be viewed locally while it is being written.

:::note
The main React application and the Astro documentation are two separate projects. Each has its own dependencies and `package.json`.
:::

## Documentation build

From the `documentation/` folder:

```bash
npm run build
```

Astro generates the static documentation version in:

```text
documentation/dist/
```

This version is used for Firebase Hosting deployment.

## Automatic documentation deployment

The documentation has its own Firebase Hosting site:

```text
https://dear-pages-docs.web.app
```

Deployment is automated with GitHub Actions.

When a documentation change is pushed to the `main` branch, the workflow:

1. retrieves the project;
2. installs documentation dependencies;
3. runs the Astro build;
4. deploys `documentation/dist/` to Firebase Hosting.

The online documentation is therefore updated automatically after a push to `main`.

## JSDoc documentation

The JSDoc technical reference is generated from the main project.

From the Dear Pages root:

```bash
npm run docs
```

Generated files are placed in:

```text
docs/
```

This folder contains automatically generated documentation and is different from the Astro project located in `documentation/`.

## Summary

To run the main application:

```bash
git clone https://github.com/bldyonyx/DearPages.git
cd DearPages
npm install
npm run dev
```

To run the documentation:

```bash
cd documentation
npm install
npm run dev
```

To build the documentation:

```bash
npm run build
```

After a push to `main`, GitHub Actions workflows handle the configured deployments for the application and documentation.

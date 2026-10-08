---
title: JSDoc
description: Technical documentation for Dear Pages JavaScript code with JSDoc.
---

Dear Pages uses **JSDoc** to document important JavaScript functions directly in the source code.

Unlike the Astro/Starlight documentation, which describes the project as a whole, JSDoc provides more technical documentation tied to the code.

## Why use JSDoc?

JSDoc comments can specify:

- the role of a function;
- the parameters it receives;
- their type;
- the returned value;
- errors that can be thrown.

This makes it easier to understand a function's contract without analyzing its entire implementation.

## Example

The Google Books service uses JSDoc to document its functions.

```js
/**
 * Recherche des livres dans l'API Google Books.
 *
 * @param {string} query - Recherche saisie par l'utilisateur.
 * @returns {Promise<Array>} Liste des livres trouvés et formatés.
 * @throws {Error} Si la requête vers Google Books échoue.
 */
export async function searchBooks(query) {
  // ...
}
```

In this example:

- `@param` describes the `query` parameter;
- `@returns` indicates what the function returns;
- `@throws` documents the error that can be thrown.

## Where to use JSDoc?

JSDoc is not automatically added to every component or small function.

It is mainly used when documentation provides useful information about code behavior.

It is especially relevant for:

```text
services/
hooks/
utils/
```

and for functions with parameters, data transformations, or behavior that is not immediately obvious.

## React components

Simple, mostly visual React components do not necessarily need a JSDoc block.

For example, documenting a small component only to repeat its name and obvious props would add noise without really making the project easier to understand.

The goal is therefore to document important parts rather than maximize the number of comments.

## Generate documentation

JSDoc is installed as a development dependency of the project.

Documentation can be generated with:

```bash
npm run docs
```

The script defined in `package.json` is:

```json
"docs": "jsdoc src -r -d docs"
```

This command:

1. analyzes the `src` folder;
2. also traverses subfolders thanks to `-r`;
3. generates documentation in the `docs` folder.

## Generated folder

After running the command, the structure includes:

```text
DearPages/
├── docs/
├── documentation/
└── src/
```

The `docs/` folder is generated automatically by JSDoc and is not versioned.

It can be recreated from the source code when needed.

## JSDoc and Starlight

Dear Pages therefore has two complementary forms of documentation.

| JSDoc | Astro + Starlight |
| --- | --- |
| Code documentation | Project documentation |
| Generated from comments | Written in Markdown/MDX |
| Functions, parameters, returns | Architecture, installation, technical choices |
| Mainly for development | Global project overview |

JSDoc helps understand **how to use some parts of the code**, while Starlight explains more about **how the project is organized and why certain choices were made**.

:::note
JSDoc documentation evolves with the code. Important services, utilities, and hooks are documented when they need extra explanation of their behavior, parameters, or return values.
:::

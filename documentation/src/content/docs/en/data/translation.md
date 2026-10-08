---
title: Translation
description: Management of some translated text content in Dear Pages.
---

Dear Pages uses **Google Cloud Translation Basic v2** to translate some text content when a translation is needed.

Translation is deliberately **targeted**: Dear Pages does not automatically translate all information from book sources.

This approach keeps bibliographic information in its original form while making some text content more accessible.

Dear Pages also uses **i18next** and **react-i18next** for the French / English bilingual interface. Interface translation is separate from dynamic book-description translation.

## Bilingual interface

Interface text is organized in two resource files:

```text
src/i18n/locales/fr.json
src/i18n/locales/en.json
```

The main configuration is located in:

```text
src/i18n/index.js
```

It initializes i18next with `initReactI18next`, declares the supported languages `fr` and `en`, then loads both resources under the `translation` namespace.

React components then use `useTranslation` to access:

- `t(...)`, which returns the label for the active language;
- `i18n.language`, which gives the current language;
- `i18n.changeLanguage(...)`, used by language selectors.

The default language is French.

## Language switching

Language switching is available in two main places:

- on Login and Sign Up screens, through the selector integrated into the authentication layout;
- in **Settings**, through the dedicated application-language card.

Before authentication, the choice is kept in `localStorage` with the key:

```text
dearpages:language
```

After authentication, the language can also be synchronized with the user's Firebase preferences. When an account is created, the active language is saved in the initial preferences. When a signed-in user loads the application, the language stored in their preferences is applied if it is one of the supported languages.

From Settings, changing language updates the interface immediately and saves the new value to Firebase preferences.

## Translation service

Translation is isolated in a dedicated service:

```text
src/services/translationService.js
```

The service communicates with the Google Cloud Translation endpoint:

```text
https://translation.googleapis.com/language/translate/v2
```

The API key is read from a Vite environment variable:

```js
const API_KEY = import.meta.env.VITE_GOOGLE_TRANSLATION_API_KEY
```

The expected variable is:

```text
VITE_GOOGLE_TRANSLATION_API_KEY=...
```

:::note
Like the other keys used on the frontend, this key is not a server secret. It must be protected and restricted with the relevant provider.
:::

## `translateText` function

The service exposes one main function:

```js
translateText(text, sourceLanguage, targetLanguage)
```

It receives:

- `text`: the text to translate;
- `sourceLanguage`: the known language of the source text;
- `targetLanguage`: the desired language.

The function returns only the translated text:

```js
Promise<string>
```

## Request to Google Cloud Translation

The request is sent with the `POST` method.

Data is sent as `application/x-www-form-urlencoded`.

The request includes:

```text
q       → text to translate
target  → target language
format  → text
source  → source language, when known
```

The source language is therefore optional at service level.

## Description translation

Dynamic translation is mainly used on a book page for **descriptions available in a different language from the interface**.

The behavior is managed by the translation hook associated with book data.

The general flow is:

```text
Book description
      ↓
Language detection
      ↓
Different from interface language?
      │
   ┌──┴──┐
   │     │
  no    yes
   │     │
   │     ▼
   │  Google Cloud Translation
   │     │
   │     ▼
   │  FR or EN translation
   │     │
   └─────┴────→ Description display
```

The target language used by Dear Pages matches the active interface language when it is supported for descriptions: French or English.

If the description does not need to be translated, the original text can be used directly without making a request to Google Cloud Translation.

## Language detection

Before requesting a translation, Dear Pages determines whether the description actually needs to be translated.

This avoids unnecessary API calls for descriptions already available in the target language.

When book metadata provides the content language, it is used first for this decision.

If no reliable language is provided by metadata, Dear Pages applies a light heuristic to the description text. It looks for frequent French or English words and accounts for some French accents. Short or ambiguous descriptions remain `unknown`.

In that case, translation can still be requested: Dear Pages does not send an explicit source language to Google Cloud Translation, allowing the provider to auto-detect it.

Translation logic remains separate from component display.

## Session cache

Translations that have already been retrieved can be kept temporarily during the session.

The cache uses the book identity, catalog source, source language, target language, and source description to associate a translation with the matching content.

The cache key includes a hash of the exact description. If the source text changes, the previous translation is not reused for another piece of content.

This avoids repeating a translation request when the same description has already been translated during the session.

The principle is:

```text
Description to translate
      ↓
Already cached?
      │
   ┌──┴──┐
   │     │
  yes    no
   │     │
   ▼     ▼
Cache   Google Cloud Translation
   │     │
   └──┬──┘
      ▼
Display
```

A failed translation is not stored as a valid cached translation.

A new attempt therefore remains possible later.

## Error handling

The service checks several situations before and after the request.

An error is returned when:

- no usable text is provided;
- no target language is provided;
- the API key is unavailable;
- the network request fails;
- Google Cloud returns an HTTP error response;
- the response cannot be parsed as JSON;
- no valid translation is present in the response.

Errors exposed to the rest of the application remain deliberately generic.

This avoids exposing provider details, request data, or internal configuration in the interface.

If translation fails, the original book data remains independent from the translation service.

## Result decoding

Google Cloud can return some characters as HTML entities.

After receiving the translation, Dear Pages uses `decodeHtmlEntities` to convert these entities back to normal text before returning the result.

This step lets the translated text be used directly in the interface.

## Why not translate everything?

Dear Pages deliberately does not translate every piece of information from book sources.

Translation is used for **book descriptions**, which can be written in a different language from the interface.

Bibliographic information such as:

- titles;
- author names;
- categories;
- dates;
- identifiers;

remains in its original form.

This preserves the information provided by the sources while making descriptions more accessible.

It also avoids multiplying translation API calls for information that does not require translation.

## Separation of responsibilities

Translation is deliberately separated from the rest of the application:

```text
Book Page
    ↓
Translation hook
    ↓
Detection / cache
    ↓
Translation service
    ↓
Google Cloud Translation API
```

Each part has a distinct responsibility:

- the **Book Page** displays book information;
- the **hook** decides whether translation is needed and manages its state;
- the **session cache** avoids some repeated requests;
- the **service** communicates with Google Cloud Translation;
- the external API produces the translation.

Components therefore do not need to know the details of how the Google Cloud API works.

:::note
Translation is a complementary Dear Pages feature. It does not replace the original data provided by Google Books or Open Library and does not globally modify bibliographic information.
:::

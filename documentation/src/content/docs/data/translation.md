---
title: Traduction
description: Gestion de la traduction de certains contenus textuels dans Dear Pages.
---

Dear Pages utilise **Google Cloud Translation Basic v2** pour traduire certains contenus textuels lorsqu'une traduction est nécessaire.

La traduction est volontairement **ciblée** : Dear Pages ne traduit pas automatiquement toutes les informations provenant des sources de livres.

Cette approche permet de conserver les informations bibliographiques dans leur forme d'origine tout en rendant certains contenus textuels plus accessibles.

## Service de traduction

La traduction est isolée dans un service dédié :

```text
src/services/translationApi.js
```

Le service communique avec l'endpoint Google Cloud Translation :

```text
https://translation.googleapis.com/language/translate/v2
```

La clé API est récupérée depuis une variable d'environnement Vite :

```js
const API_KEY = import.meta.env.VITE_GOOGLE_TRANSLATION_API_KEY
```

La variable attendue est :

```text
VITE_GOOGLE_TRANSLATION_API_KEY=...
```

:::note
Comme les autres clés utilisées côté frontend, cette clé n'est pas un secret serveur. Elle doit être protégée et restreinte depuis le fournisseur concerné.
:::

## Fonction `translateText`

Le service expose une fonction principale :

```js
translateText(text, sourceLanguage, targetLanguage)
```

Elle reçoit :

- `text` : le texte à traduire ;
- `sourceLanguage` : la langue connue du texte source ;
- `targetLanguage` : la langue souhaitée.

La fonction retourne uniquement le texte traduit :

```js
Promise<string>
```

## Requête vers Google Cloud Translation

La requête est envoyée avec la méthode `POST`.

Les données sont transmises sous forme `application/x-www-form-urlencoded`.

La requête contient notamment :

```text
q       → texte à traduire
target  → langue cible
format  → text
source  → langue source, lorsqu'elle est connue
```

La langue source est donc facultative au niveau du service.

## Gestion des erreurs

Le service vérifie plusieurs situations avant et après la requête.

Une erreur est retournée lorsque :

- aucun texte exploitable n'est fourni ;
- aucune langue cible n'est fournie ;
- la clé API n'est pas disponible ;
- la requête réseau échoue ;
- Google Cloud renvoie une réponse HTTP en erreur ;
- la réponse ne peut pas être interprétée comme du JSON ;
- aucune traduction valide n'est présente dans la réponse.

Les erreurs exposées au reste de l'application restent volontairement génériques.

Cela évite d'exposer dans l'interface des informations concernant le fournisseur, la requête ou la configuration interne.

## Décodage du résultat

Google Cloud peut retourner certains caractères sous forme d'entités HTML.

Après réception de la traduction, Dear Pages utilise `decodeHtmlEntities` afin de convertir ces entités en texte normal avant de retourner le résultat.

Cette étape permet d'utiliser directement le texte traduit dans l'interface.

## Pourquoi ne pas tout traduire ?

Dear Pages ne traduit volontairement pas toutes les informations provenant des sources de livres.

La traduction est utilisée pour les **résumés des livres**, qui peuvent être rédigés dans une langue différente de celle choisie par l'utilisateur.

Les informations bibliographiques comme :

- les titres ;
- les noms d'auteurs ;
- les catégories ;
- les dates ;
- les identifiants ;

restent dans leur langue d'origine.

Ce choix permet de préserver les informations fournies par les sources tout en rendant les résumés plus accessibles à l'utilisateur.

Il permet également d'éviter de multiplier les appels à l'API de traduction pour des informations qui ne nécessitent pas de traduction.

## Séparation des responsabilités

La traduction est volontairement séparée du reste de l'application :

```text
Composant
    ↓
Service de traduction
    ↓
Google Cloud Translation API
```

Les composants n'ont donc pas besoin de connaître le fonctionnement de l'API Google Cloud.

Le service s'occupe de construire la requête, gérer les erreurs, récupérer la traduction et retourner uniquement le texte utilisable par l'application.

:::note
La traduction constitue une fonctionnalité complémentaire de Dear Pages. Elle ne remplace pas les données originales fournies par Google Books ou Open Library et ne modifie pas les informations bibliographiques de manière globale.
:::
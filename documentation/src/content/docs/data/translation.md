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
src/services/translationService.js
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

## Traduction des résumés

La traduction est principalement utilisée sur la fiche d'un livre pour les **résumés disponibles en anglais**.

Le comportement est géré par le hook de traduction associé aux données du livre.

Le flux général est :

```text
Résumé du livre
      ↓
Détection de la langue
      ↓
Résumé en anglais ?
      │
   ┌──┴──┐
   │     │
  non   oui
   │     │
   │     ▼
   │  Google Cloud Translation
   │     │
   │     ▼
   │  Traduction française
   │     │
   └─────┴─────→ Affichage du résumé
```

La langue cible utilisée par Dear Pages pour cette traduction est le français.

Si le résumé n'a pas besoin d'être traduit, le texte original peut être utilisé directement sans effectuer de requête vers Google Cloud Translation.

## Détection de la langue

Avant de demander une traduction, Dear Pages détermine si le résumé doit réellement être traduit.

Cette vérification évite notamment d'envoyer inutilement à l'API un résumé déjà disponible dans la langue cible.

Lorsque les informations du livre permettent de connaître la langue du contenu, elles peuvent être utilisées pour cette décision.

La logique de traduction reste ainsi séparée de l'affichage du composant.

## Cache de session

Les traductions déjà obtenues peuvent être conservées temporairement pendant la session.

Le cache utilise l'identité du livre ainsi que le résumé source afin d'associer une traduction au contenu correspondant.

Cela permet d'éviter de répéter une requête de traduction lorsque le même résumé a déjà été traduit pendant la session.

Le principe est :

```text
Résumé à traduire
      ↓
Traduction déjà en cache ?
      │
   ┌──┴──┐
   │     │
  oui   non
   │     │
   ▼     ▼
Cache   Google Cloud Translation
   │     │
   └──┬──┘
      ▼
Affichage
```

Une traduction échouée n'est pas conservée comme traduction valide dans le cache.

Une nouvelle tentative reste donc possible ultérieurement.

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

En cas d'échec de la traduction, les données originales du livre restent indépendantes du service de traduction.

## Décodage du résultat

Google Cloud peut retourner certains caractères sous forme d'entités HTML.

Après réception de la traduction, Dear Pages utilise `decodeHtmlEntities` afin de convertir ces entités en texte normal avant de retourner le résultat.

Cette étape permet d'utiliser directement le texte traduit dans l'interface.

## Pourquoi ne pas tout traduire ?

Dear Pages ne traduit volontairement pas toutes les informations provenant des sources de livres.

La traduction est utilisée pour les **résumés des livres**, qui peuvent être rédigés dans une langue différente de celle utilisée par l'interface.

Les informations bibliographiques comme :

- les titres ;
- les noms d'auteurs ;
- les catégories ;
- les dates ;
- les identifiants ;

restent dans leur forme d'origine.

Ce choix permet de préserver les informations fournies par les sources tout en rendant les résumés plus accessibles.

Il permet également d'éviter de multiplier les appels à l'API de traduction pour des informations qui ne nécessitent pas de traduction.

## Séparation des responsabilités

La traduction est volontairement séparée du reste de l'application :

```text
Book Page
    ↓
Hook de traduction
    ↓
Détection / cache
    ↓
Service de traduction
    ↓
Google Cloud Translation API
```

Chaque partie possède ainsi une responsabilité distincte :

- la **Book Page** affiche les informations du livre ;
- le **hook** décide si une traduction est nécessaire et gère son état ;
- le **cache de session** évite certaines requêtes répétées ;
- le **service** communique avec Google Cloud Translation ;
- l'API externe produit la traduction.

Les composants n'ont donc pas besoin de connaître directement le fonctionnement de l'API Google Cloud.

:::note
La traduction constitue une fonctionnalité complémentaire de Dear Pages. Elle ne remplace pas les données originales fournies par Google Books ou Open Library et ne modifie pas les informations bibliographiques de manière globale.
:::
---
title: Traduction
description: Gestion de la traduction de certains contenus textuels dans Dear Pages.
---

Dear Pages utilise **Google Cloud Translation Basic v2** pour traduire certains contenus textuels lorsqu'une traduction est nécessaire.

La traduction est volontairement **ciblée** : Dear Pages ne traduit pas automatiquement toutes les informations provenant des sources de livres.

Cette approche permet de conserver les informations bibliographiques dans leur forme d'origine tout en rendant certains contenus textuels plus accessibles.

Dear Pages utilise aussi **i18next** et **react-i18next** pour l'interface bilingue français / anglais. Cette traduction de l'interface est séparée de la traduction dynamique des résumés de livres.

## Interface bilingue

Les textes de l'interface sont organisés dans deux fichiers de ressources :

```text
src/i18n/locales/fr.json
src/i18n/locales/en.json
```

La configuration principale se trouve dans :

```text
src/i18n/index.js
```

Elle initialise i18next avec `initReactI18next`, déclare les langues supportées `fr` et `en`, puis charge les deux ressources sous le namespace `translation`.

Les composants React utilisent ensuite `useTranslation` pour accéder à :

- `t(...)`, qui retourne le libellé correspondant à la langue active ;
- `i18n.language`, qui donne la langue courante ;
- `i18n.changeLanguage(...)`, utilisé par les sélecteurs de langue.

La langue par défaut est le français.

## Changement de langue

Le changement de langue est disponible à deux endroits principaux :

- sur les écrans Login et Sign Up, via le sélecteur intégré au layout d'authentification ;
- dans la page **Paramètres**, via la carte dédiée à la langue de l'application.

Avant authentification, le choix est conservé dans `localStorage` avec la clé :

```text
dearpages:language
```

Après authentification, la langue peut aussi être synchronisée avec les préférences Firebase de l'utilisateur. Lorsqu'un compte est créé, la langue active est enregistrée dans les préférences initiales. Lorsqu'un utilisateur connecté charge l'application, la langue stockée dans ses préférences est appliquée si elle fait partie des langues supportées.

Depuis les paramètres, changer de langue modifie immédiatement l'interface et enregistre la nouvelle valeur dans les préférences Firebase.

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

La traduction dynamique est principalement utilisée sur la fiche d'un livre pour les **résumés disponibles dans une autre langue que celle de l'interface**.

Le comportement est géré par le hook de traduction associé aux données du livre.

Le flux général est :

```text
Résumé du livre
      ↓
Détection de la langue
      ↓
Langue différente de l'interface ?
      │
   ┌──┴──┐
   │     │
  non   oui
   │     │
   │     ▼
   │  Google Cloud Translation
   │     │
   │     ▼
   │  Traduction FR ou EN
   │     │
   └─────┴─────→ Affichage du résumé
```

La langue cible utilisée par Dear Pages correspond à la langue active de l'interface lorsque celle-ci est supportée pour les résumés : français ou anglais.

Si le résumé n'a pas besoin d'être traduit, le texte original peut être utilisé directement sans effectuer de requête vers Google Cloud Translation.

## Détection de la langue

Avant de demander une traduction, Dear Pages détermine si le résumé doit réellement être traduit.

Cette vérification évite notamment d'envoyer inutilement à l'API un résumé déjà disponible dans la langue cible.

Lorsque les informations du livre permettent de connaître la langue du contenu, elles sont utilisées en priorité pour cette décision.

Si aucune langue fiable n'est fournie par les métadonnées, Dear Pages applique une heuristique légère sur le texte du résumé. Elle cherche notamment des mots fréquents en français ou en anglais et prend en compte certains accents français. Les résumés trop courts ou ambigus restent en langue `unknown`.

Dans ce cas, la traduction peut tout de même être demandée : Dear Pages n'envoie alors pas de langue source explicite à Google Cloud Translation afin de laisser le fournisseur faire l'auto-détection.

La logique de traduction reste ainsi séparée de l'affichage du composant.

## Cache de session

Les traductions déjà obtenues peuvent être conservées temporairement pendant la session.

Le cache utilise l'identité du livre, la source du catalogue, la langue source, la langue cible et le résumé source afin d'associer une traduction au contenu correspondant.

La clé de cache inclut un hash du résumé exact. Si le texte source change, l'ancienne traduction n'est donc pas réutilisée pour un autre contenu.

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

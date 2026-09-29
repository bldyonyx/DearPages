---
title: Recommandations
description: Fonctionnement des recommandations de Dear Pages.
---

Dear Pages possède un système de recommandations intégré à la page **Découvrir**.

Les recommandations combinent plusieurs sources et mécanismes :

- les préférences de lecture de l'utilisateur ;
- Google Books pour les recommandations par genre ;
- Open Library pour les tendances ;
- un système de déduplication et d'anti-répétition ;
- une persistance temporaire de certaines informations pendant la session.

Les préférences utilisées pour personnaliser les recommandations sont désormais associées au compte utilisateur et enregistrées avec Firebase.

## Préférences utilisateur

Les préférences de lecture sont enregistrées dans le profil de l'utilisateur.

Elles comprennent notamment les genres préférés sélectionnés lors de l'onboarding et modifiables depuis les paramètres.

Ces préférences sont utilisées pour construire la sélection **Peut-être pour toi** et la vue étendue :

```text
/discover?view=for-you
```

Les anciennes préférences définies directement dans `src/constants/discoverPreferences.js` ne constituent plus la source principale des préférences utilisateur.

## Sources des candidats

Les recommandations sont construites à partir de lots de candidats récupérés depuis les API externes.

Pour Google Books, le service `getBooksBySubject` recherche des livres avec :

```text
q=subject:<genre>
```

Il accepte aussi :

- `maxResults`, pour demander un lot plus grand que le nombre affiché ;
- `startIndex`, pour récupérer une nouvelle fenêtre de résultats lors d'un rafraîchissement.

Pour les tendances, le service `getTrendingBooksDetails` utilise Open Library et le tri `trending`.

## Sélection et déduplication

La sélection des recommandations est isolée dans :

```text
src/utils/recommendationSelection.js
```

La fonction principale est `selectRecommendationBooks`.

Elle applique plusieurs étapes :

1. Dédupliquer les livres reçus dans le lot de candidats.
2. Retirer les livres déjà vus pendant la session.
3. Retirer les livres exclus, notamment lorsque certains livres doivent être ignorés.
4. Mélanger les livres restants.
5. Garder uniquement le nombre nécessaire pour l'étagère.

Pour reconnaître les doublons, l'application utilise plusieurs informations d'identité :

- ISBN, lorsqu'il existe ;
- couple titre + auteur principal normalisé ;
- identifiant Google Books ;
- identifiant Open Library ;
- identifiant local de l'objet.

Cette stratégie permet de limiter les doublons malgré les différences entre les sources de livres.

## Livres déjà vus

Chaque étagère conserve les livres déjà affichés sous forme de clés d'identité.

Cela permet d'éviter de revoir immédiatement les mêmes livres après un rafraîchissement.

Les tendances peuvent toutefois recycler certains livres déjà vus lorsque le nombre de nouveaux candidats disponibles devient insuffisant.

Ce comportement utilise `recycleSeenWhenExhausted`, notamment parce que la source Open Library utilisée pour les tendances fournit un ensemble de résultats plus limité.

## Persistance de session

Certaines informations liées aux recommandations sont sauvegardées dans `sessionStorage` grâce à :

```text
src/utils/recommendationSessionStorage.js
```

Cette persistance permet notamment de conserver pendant la session :

- les livres actuellement affichés ;
- le `startIndex` lorsque l'étagère utilise une pagination Google Books ;
- les clés d'identité déjà vues.

Les clés utilisent encore le préfixe technique :

```text
booktracker:recommendations
```

Ce préfixe est conservé pour préserver le comportement actuel du stockage.

La persistance de session ne remplace pas les données utilisateur enregistrées dans Firebase : elle sert uniquement à conserver l'état de certaines recommandations pendant la session du navigateur.

## Page Découvrir

Sur la vue de découverte par défaut, `useDiscoverHomeBooks` charge plusieurs étagères :

- **Peut-être pour toi**, basée sur les préférences de lecture ;
- **Tendances du moment**, depuis Open Library ;
- **Les incontournables**, depuis Google Books avec le sujet `classics`.

Les tendances et les incontournables possèdent chacun leur propre bouton de rafraîchissement.

Ces rafraîchissements sont indépendants : rafraîchir les tendances ne recharge pas les incontournables, et inversement.

## Vue étendue

La vue :

```text
/discover?view=for-you
```

est affichée par `ForYouRecommendations`.

Elle utilise `useForYouRecommendations` pour créer une section par genre préféré.

Les genres utilisés pour cette vue proviennent désormais des préférences de lecture enregistrées pour l'utilisateur.

Chaque genre possède son propre état :

- livres affichés ;
- erreur ;
- chargement ;
- `startIndex`.

Le bouton de rafraîchissement d'un genre ne recharge donc que cette section.

## Gestion des erreurs et du chargement

Les hooks utilisent des états de chargement et d'erreur séparés.

La page Découvrir utilise `Promise.allSettled` afin qu'une requête échouée ne bloque pas nécessairement les autres étagères.

Les différents composants peuvent afficher :

- un état de chargement ;
- un message d'erreur ;
- un état vide lorsque aucun résultat exploitable n'est disponible ;
- un bouton désactivé pendant un rafraîchissement ;
- un état de chargement propre à chaque genre dans la vue étendue.

## Exclusion des livres de la bibliothèque

Le système de sélection accepte des livres à exclure grâce à `excludedBookIds`.

Cette logique permet de ne pas proposer certains livres déjà présents dans la bibliothèque lorsque les données de celle-ci sont disponibles.

La sélection des recommandations peut ainsi rester séparée de la logique de bibliothèque tout en prenant en compte les livres que l'utilisateur possède déjà.

Cette possibilité prépare également une personnalisation plus poussée des recommandations à partir des données de lecture personnelles.

## Relation avec les préférences utilisateur

Les recommandations personnalisées utilisent maintenant les préférences enregistrées pour le compte.

Le fonctionnement général est donc :

```text
Préférences utilisateur
        ↓
Genres préférés
        ↓
Google Books
        ↓
Lots de candidats
        ↓
Déduplication
        ↓
Livres déjà vus / exclus
        ↓
Sélection finale
        ↓
Étagères de recommandations
```

Les tendances et les incontournables suivent un flux similaire, mais utilisent leurs propres sources et critères de sélection.

## Actuel

Le système de recommandations comprend actuellement :

- préférences de lecture liées au compte utilisateur ;
- recommandations par genres ;
- tendances Open Library ;
- incontournables Google Books ;
- déduplication ;
- anti-répétition pendant la session ;
- exclusion de certains livres ;
- rafraîchissement indépendant par étagère ou par genre ;
- persistance de certaines informations avec `sessionStorage` ;
- gestion séparée des chargements et des erreurs ;
- préparation de la sélection pour fonctionner avec la bibliothèque personnelle.

## Évolution possible

Le système pourra évoluer afin d'utiliser davantage de données issues du parcours de lecture de l'utilisateur.

Les recommandations pourraient notamment prendre en compte :

- les livres déjà lus ;
- les statuts de lecture ;
- les collections ;
- les préférences enregistrées ;
- d'autres informations disponibles dans la bibliothèque personnelle.

Ces évolutions pourront être ajoutées progressivement sans modifier le principe général de séparation entre les sources de livres, la sélection des recommandations et les données personnelles.
---
title: JSDoc
description: Documentation technique du code JavaScript de Dear Pages avec JSDoc.
---


Dear Pages utilise **JSDoc** pour documenter les fonctions JavaScript importantes directement dans le code source.

Contrairement à la documentation Astro/Starlight, qui décrit le projet dans son ensemble, JSDoc fournit une documentation plus technique liée au code.

## Pourquoi utiliser JSDoc ?

Les commentaires JSDoc permettent notamment de préciser :

- le rôle d'une fonction ;
- les paramètres qu'elle reçoit ;
- leur type ;
- la valeur retournée ;
- les erreurs pouvant être déclenchées.

Cela permet de comprendre plus rapidement le contrat d'une fonction sans devoir analyser toute son implémentation.

## Exemple

Le service Google Books utilise JSDoc pour documenter ses fonctions.

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

Dans cet exemple :

- `@param` décrit le paramètre `query` ;
- `@returns` indique ce que la fonction retourne ;
- `@throws` documente l'erreur pouvant être déclenchée.

## Où utiliser JSDoc ?

JSDoc n'est pas ajouté automatiquement à chaque composant ou à chaque petite fonction.

Il est principalement utilisé lorsque la documentation apporte une information utile sur le comportement du code.

Il est particulièrement pertinent pour :

```text
services/
hooks/
utils/
```

ainsi que pour les fonctions possédant des paramètres, des transformations de données ou un comportement qui n'est pas immédiatement évident.

## Composants React

Les composants React simples et principalement visuels n'ont pas nécessairement besoin d'un bloc JSDoc.

Par exemple, documenter un petit composant uniquement pour répéter son nom et ses props évidentes ajouterait du bruit sans réellement faciliter la compréhension du projet.

L'objectif est donc de documenter les parties importantes plutôt que de maximiser le nombre de commentaires.

## Générer la documentation

JSDoc est installé comme dépendance de développement du projet.

La documentation peut être générée avec :

```bash
npm run docs
```

Le script défini dans `package.json` est :

```json
"docs": "jsdoc src -r -d docs"
```

Cette commande :

1. analyse le dossier `src` ;
2. parcourt également ses sous-dossiers grâce à `-r` ;
3. génère la documentation dans le dossier `docs`.

## Dossier généré

Après l'exécution de la commande, la structure contient notamment :

```text
DearPages/
├── docs/
├── documentation/
└── src/
```

Le dossier `docs/` est généré automatiquement par JSDoc et n'est pas versionné.

Il peut être recréé à partir du code source lorsque nécessaire.

## JSDoc et Starlight

Dear Pages possède donc deux formes de documentation complémentaires.

| JSDoc | Astro + Starlight |
| --- | --- |
| Documentation du code | Documentation du projet |
| Générée depuis les commentaires | Écrite en Markdown/MDX |
| Fonctions, paramètres, retours | Architecture, installation, choix techniques |
| Principalement destinée au développement | Vue globale du projet |

JSDoc permet de comprendre **comment utiliser certaines parties du code**, tandis que Starlight explique davantage **comment le projet est organisé et pourquoi certains choix ont été faits**.

:::note
La documentation JSDoc évolue avec le code. Les services, utilitaires et hooks importants sont documentés lorsqu'ils nécessitent une explication supplémentaire de leur comportement, de leurs paramètres ou de leurs valeurs de retour.
:::
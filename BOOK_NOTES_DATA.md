# Notes multiples : couche de données

Cette étape ajoute uniquement un service et des règles **locales**. Aucun composant
ne l'appelle encore. Aucune migration, suppression de champ historique, écriture
en production, modification de configuration Vite ou de ports n'est nécessaire.

## Contrat

Chemin : `users/{uid}/bookNotes/{bookId}/{noteId}`. L'identité stable est la clé
Firebase push, exposée comme `id` à la lecture, sans duplication dans le document.

| Champ | Contrat |
| --- | --- |
| `title` | Texte facultatif à la création, stocké comme `''` si omis ; 200 unités UTF-16 maximum, sans balises ni contrôles. `''` permet de l'effacer. |
| `contentHtml` | Chaîne obligatoire, éventuellement vide ; 200 000 unités UTF-16 maximum avant et après sanitation. |
| `date` | Date civile obligatoire `YYYY-MM-DD`, années 0001–9999, calendrier grégorien avec validation des années bissextiles ; aucun fuseau horaire ni conversion en timestamp. |
| `createdAt` | Timestamp serveur à la création, immuable. |
| `updatedAt` | Timestamp serveur à chaque création/modification. |

Les clés sont des chaînes non vides de 128 unités UTF-16 maximum, sans espaces
ASCII, caractères de contrôle, caractères réservés RTDB ou espaces en bordure.
Le service refuse les champs inconnus et les timestamps fournis par l'appelant.
Il n'impose aucun plafond au nombre de notes.

API de `src/services/bookNotesService.js` :

- `getBookNotes(uid, bookId)` : liste triée par date décroissante, création
  décroissante puis identifiant croissant ; `[]` si aucune note.
- `getBookNote(uid, bookId, noteId)` : note ou `null` si absente.
- `createBookNote(uid, bookId, { title?, contentHtml, date })` : identifiant après
  acquittement serveur.
- `updateBookNote(uid, bookId, noteId, patch)` : patch non vide des champs métier.
- `deleteBookNote(uid, bookId, noteId)` : suppression individuelle.

Les erreurs de validation portent `book-notes/invalid-argument`. Un livre absent
au contrôle initial produit `book-notes/book-not-found` ; une note absente lors
d'une modification/suppression produit `book-notes/note-not-found`. Les erreurs
Firebase, dont `PERMISSION_DENIED` lors d'une course après ces contrôles, remontent
sans masquage. Aucune écriture de secours ne recrée un livre ou une note.

Le sanitizer DOMPurify existant s'applique à l'écriture et à la lecture, en
conservant `b`, `strong`, `i`, `em`, `font` (tailles 2–5), `br`, `div` et `p`.
Le service cible le navigateur React : l'exécution du sanitizer hors DOM conserve
son comportement historique de texte seul. Les tests RTDB du nouveau service
utilisent donc jsdom pour exercer exactement la politique du navigateur.

## Concurrence et règles locales

Les écritures ne visent qu'une note. Les patchs de champs distincts se combinent ;
deux modifications du même champ suivent l'ordre d'arrivée serveur. Aucun champ
`library/{bookId}` n'est écrit : `note`, `rating`, `review`, `updatedAt` et les
autres métadonnées du livre restent intacts.

Les contrôles clients améliorent les erreurs, mais **les règles sont nécessaires**
à la garantie contre les courses. Elles vérifient l'existence du livre avant et
après l'écriture atomique, y compris les suppressions et les patchs multi-chemins.
Une opération arrivée après suppression du livre est refusée ; une opération
validée avant cette suppression peut naturellement réussir.

Les règles refusent aussi les écritures sans propriétaire authentifié, les champs
inconnus, les structures incomplètes, les dates impossibles, le HTML hors liste
autorisée et les timestamps incohérents. Leur grammaire HTML est un filtre
conservateur de sécurité, pas un parseur DOM ; la sanitation à la lecture reste
indispensable. Les contrôles des caractères utilisent les échappements **JSON**
(`\u0000`, etc.), pas des échappements hexadécimaux dans les regex RTDB : le
[dialecte RTDB](https://firebase.google.com/docs/database/security/regex) ne les interprète pas comme JavaScript.
Les timestamps sont comparés à `now` ; RTDB ne permet pas de distinguer un nombre
exactement égal à `now` d'un placeholder serveur déjà résolu.

Aucune autorisation d'écriture n'est accordée aux ancêtres de `bookNotes`.
Une mise à jour multi-chemins reste possible uniquement si chacun de ses chemins
est autorisé. Les branches existantes (`library`, `collections`, `profile`,
`preferences`, etc.) conservent leur accès propriétaire. La lecture globale et la
suppression globale de `users/{uid}` sont volontairement refusées par ce candidat
local pour éviter un contournement par ancêtre. **Avant un éventuel déploiement**,
il faudra concevoir la suppression complète du compte (le service actuel supprime
ce nœud globalement), avec une voie privilégiée adaptée. Ces règles ne constituent
donc pas une proposition de déploiement production immédiat.

Une suppression du livre laisse les nouvelles notes stockées, mais inaccessibles
et non modifiables tant que le livre est absent. Aucun nettoyage automatique
n'est ajouté. Réinsérer le même identifiant de livre rend ces notes accessibles.
La lecture de toute la liste est actuellement non paginée ; une pagination pourra
être ajoutée si les volumes l'exigent, sans fixer de limite métier.

## Compatibilité historique : stratégie uniquement

`library/{bookId}/note` reste inchangé, lu et écrit par l'interface actuelle.
Le nouveau service lit exclusivement `bookNotes` et ne mélange jamais les deux
sources : aucune lecture ne déclenche de migration.

Pour une étape ultérieure, prévoir un adaptateur présentant la note historique
comme entrée virtuelle en lecture seule, avec une identité réservée distincte des
clés push. La date historique n'est pas connue : ne pas déduire une date de note
de `library.updatedAt`, qui sert aussi aux étoiles, avis et statuts. Présenter
cette absence explicitement ou demander une date lors de la conversion.

Une conversion future devra être explicite et idempotente : clé déterministe
réservée, transaction sur la destination qui n'écrit que si elle est absente,
préservation exacte du champ source, sanitation et contrôle d'existence du livre.
Prévoir les réessais, les doublons et les modifications concurrentes de la source,
avec un marqueur/version de conversion conçu et validé avant tout changement de
schéma. Aucun de ces mécanismes n'est exécuté ou implémenté ici. Ne jamais copier
une note vers `review`, ni introduire d'historique de `rating`.

## Vérification locale

Avec les émulateurs déjà démarrés :

```sh
node node_modules/vitest/vitest.mjs run --config vitest.rtdb.config.js
```

Chaque suite RTDB vérifie le projet `demo-dear-pages`, le Hub local, les ports
attendus et le refus d'accès anonyme avant d'initialiser ses SDK. Le CLI recharge
les règles locales lorsqu'elles changent. Sans émulateurs démarrés,
`npm run test:emulator:integration` démarre l'environnement isolé et exécute aussi
ces suites. Les tests créent uniquement des utilisateurs et livres fictifs sur
l'émulateur. Aucune commande de déploiement n'est utilisée.

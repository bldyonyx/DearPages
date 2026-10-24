# Notes multiples : couche de données

Cette étape ajoute uniquement un service et des règles **locales**. Aucun composant
ne l'appelle encore. Aucune migration réelle, suppression de champ historique, écriture
en production, modification de configuration Vite ou de ports n'est nécessaire.

## Contrat

Chemin : `users/{uid}/bookNotes/{bookId}/{noteId}`. L'identité stable est la clé
Firebase push, exposée comme `id` à la lecture, sans duplication dans le document.
Exception réservée : `legacy-note-v1` identifie la copie historique décrite ci-dessous.

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

## Compatibilité historique : contrat v1, émulateur uniquement

`library/{bookId}/note` reste inchangé, lu et écrit par l'interface actuelle.
Le nouveau service lit exclusivement `bookNotes`. Aucune lecture ni opération CRUD
ne déclenche de migration. L'API explicite `migrateLegacyBookNote(uid, bookId)`
permet une conversion paresseuse par livre, seulement dans l'environnement isolé.
Elle retourne le marqueur après traitement et refuse tout appel hors émulateur
avec `book-notes/emulator-only`, avant toute lecture ou écriture Firebase.
`isFirebaseEmulator` vient de l'initialisation Firebase existante : configuration
exacte `demo-dear-pages`, origine locale, contrôle de santé et connexions aux
émulateurs Auth/RTDB. Aucun paramètre de l'appelant ne permet de lever cette garde.
Les tests remplacent cette dépendance exclusivement par leurs SDK locaux vérifiés.

### Marqueur persistant et immuable

Chemin séparé : `users/{uid}/bookNotesLegacy/{bookId}`. Il ne fait jamais partie
de la liste des notes et n'est pas supprimé par `deleteBookNote`.

| Champ | Signification |
| --- | --- |
| `version` | Nombre constant `1`. |
| `outcome` | `copied` si la chaîne source n'est pas vide ; `empty` si elle est absente, nulle ou vide. |
| `sourceHtml` | Copie exacte de la chaîne source observée, ou `''` en l'absence de source. Maximum 200 000 unités UTF-16. |
| `processedAt` | Timestamp serveur du traitement, jamais une date de rédaction historique. |

`sourceHtml` sert à comparer la source observée à la source au moment du commit
dans les règles. C'est un instantané technique brut, potentiellement dangereux :
**ne jamais le rendre en HTML ni le présenter comme une autre note**. La copie
utilisable est uniquement `bookNotes/{bookId}/legacy-note-v1`, après sanitation.
Cette redondance est volontaire : RTDB ne fournit pas de calcul de hash dans les
règles pour vérifier un condensat envoyé par le client.

### Opération atomique et concurrence

1. Vérifier l'émulateur, les identifiants et l'existence du livre.
2. Si le marqueur existe, le retourner sans inspecter ni écrire la destination.
3. Si `legacy-note-v1` existe sans marqueur, lever `book-notes/legacy-conflict`.
   Ne jamais écraser une collision ni prétendre qu'elle représente la source.
4. Valider et assainir la source avec les validations existantes. Une source
   invalide ou trop longue est refusée sans marqueur et sans perte de données.
5. Envoyer un seul `update` multi-chemins : marqueur et, pour `copied`, note
   déterministe. Pour `empty`, seul le marqueur est envoyé.

Les règles locales font office de comparaison-et-échange serveur : le marqueur
ne peut être créé que s'il est absent ; il ne peut ensuite être modifié ou
supprimé. Les règles comparent `sourceHtml` au champ historique **avant commit**,
exigent un livre existant avant/après commit et refusent une destination déjà
existante. Elles imposent ensemble marqueur `copied` + destination ou marqueur
`empty` + absence de destination. Une copie sans marqueur et un marqueur `copied`
sans copie sont refusés. Aucun droit d'écriture d'ancêtre n'est ajouté.
Cette stratégie utilise la vue fusionnée `newData` et la validation atomique des
[règles RTDB](https://firebase.google.com/docs/database/security/rules-conditions).

Un concurrent perdant reçoit un refus serveur ; le service relit alors le
marqueur et retourne celui du gagnant. Sans marqueur, le refus reste visible
(par exemple source modifiée pendant la copie). Les appels simultanés d'une même
instance SDK partagent une promesse par utilisateur/livre pour éviter de lire le
marqueur optimiste non acquitté d'une autre tentative locale. Les livres distincts
restent indépendants. La garantie entre instances vient des règles serveur.

Une coupure avant commit ne laisse aucune moitié d'opération ; une coupure après
commit mais avant acquittement peut remonter une erreur malgré le succès serveur.
Un réessai est sûr dans les deux cas. Le SDK peut garder une écriture hors ligne
en attente jusqu'à reconnexion : aucune promesse de délai ou d'annulation n'est
faite. Les erreurs réseau ne sont pas transformées en succès ni réessayées
automatiquement. Une fermeture du client avant envoi nécessite un réessai explicite.

### Dates, conservation et non-résurrection

La copie utilise `title: ''`. Sa `date` civile est le jour local de la tentative
de migration, modifiable ensuite. C'est une **valeur technique par défaut**, pas
une date historique connue. `createdAt` et `updatedAt` de la copie sont les
timestamps serveur de sa création technique. Aucun champ n'utilise le
`updatedAt` du livre. Une future interface devra rendre explicite cette origine
pour `legacy-note-v1`, et ne pas inventer de date historique.

Après modification ou suppression, le marqueur reste inchangé ; toute nouvelle
conversion est une lecture seule. Les règles interdisent également la recréation
directe de `legacy-note-v1` une fois le marqueur présent et la note supprimée.
Une tentative ancienne encore en vol ne peut ni écraser la version modifiée ni
rétablir la version supprimée, car son écriture du marqueur est refusée et
l'opération entière est atomique.

La migration n'écrit jamais dans `library` et ne touche aucune autre note. Les
champs historiques `note`, `review`, `rating`, `updatedAt`, `status` et toutes les
métadonnées restent intacts. Elle ne remplace jamais le champ source par du HTML
assaini. Ne jamais présenter simultanément une entrée virtuelle historique et sa
copie ; dès que le marqueur existe, ne plus utiliser la source comme fallback,
même si la liste des notes est vide.

### Limites et préparation de la production

- Le traitement est un instantané unique : les modifications ultérieures du champ
  historique ne sont pas recopiées, même après un résultat `empty`. L'interface
  actuelle continue à écrire ce champ ; elle devra cesser cette saisie historique
  dans le parcours des notes multiples. Aucun changement React n'est inclus ici.
- Les règles vérifient le schéma et le lien atomique, mais ne peuvent pas exécuter
  DOMPurify ni prouver que le HTML envoyé est exactement la sanitation de la source.
  Le service effectue cette transformation, et les lectures assainissent à nouveau.
- Les règles existantes de `library` gardent leurs droits propriétaire ; elles ne
  rendent pas le champ historique immuable pour les autres parcours. La garantie
  de non-écriture du livre concerne l'opération de migration et ses chemins.
- Une collision réservée nécessite une décision explicite ultérieure. Aucun
  rapprochement par contenu, déplacement ou écrasement automatique n'est prévu.
- Supprimer puis réinsérer le même identifiant de livre conserve le marqueur.
  Seule une intervention privilégiée hors contrat pourrait le retirer ; les
  garanties ne couvrent pas une modification administrative des données/règles.
- Les règles restent un candidat **local** : le problème déjà documenté de
  suppression globale du compte doit être résolu avant un éventuel déploiement.
  Aucun déploiement ni activation production n'est autorisé par cette étape.

Verdict de périmètre : contrat utilisable pour l'intégration React en émulateur ;
activation en production interdite par la garde et non validée.

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

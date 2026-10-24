# Notes multiples : couche de données

Le service et les règles **locales** sont intégrés à une interface de notes multiples,
activée uniquement dans Firebase Emulator. Aucune migration réelle, suppression de champ historique, écriture
en production, modification de configuration Vite ou de ports n'est nécessaire.

## Contrat

Chemin : `users/{uid}/bookNotes/{bookId}/{noteId}`. L'identité stable est la clé
Firebase push, exposée comme `id` à la lecture, sans duplication dans le document.
Exceptions réservées : `legacy-note-v1` identifie la copie de l'ancien champ
`note` et `legacy-review-v1` celle de l'ancien champ `review`.

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
- `getBookNotesForDisplay(uid, bookId)` : lecture seule de `{ notes, legacy, legacyReview }`.
  Chaque état historique vaut `empty`, `unprocessed`, `processed`, `invalid` ou `conflict`.
  Seul `unprocessed` fournit un contenu historique utile à l'affichage, assaini
  par le service puis à nouveau par la vue, et une empreinte `sourceVersion` pour
  confirmer cet instantané. Aucun marqueur brut n'est renvoyé par cette lecture.
- `migrateLegacyBookNote(uid, bookId, { expectedVersion?, title? } = {})` :
  conversion explicite de `note`, uniquement dans l'émulateur. L'appel historique
  sans options reste compatible et conserve ses identifiant, marqueur et sens.
- `migrateLegacyBookReview(uid, bookId, { expectedVersion?, title? } = {})` :
  conversion explicite et indépendante de `review`, uniquement dans l'émulateur.

Les erreurs de validation portent `book-notes/invalid-argument`. Un livre absent
au contrôle initial produit `book-notes/book-not-found` ; une note absente lors
d'une modification/suppression produit `book-notes/note-not-found`. Les erreurs
Firebase, dont `PERMISSION_DENIED` lors d'une course après ces contrôles, remontent
sans masquage. Aucune écriture de secours ne recrée un livre ou une note.
Exception propre aux conversions : un refus atomique sans marqueur gagnant est
signalé par `book-notes/legacy-conflict`, avec l'erreur Firebase d'origine dans
`cause`. Une source différente de l'instantané confirmé produit
`book-notes/legacy-source-changed` avant toute écriture.

Le sanitizer DOMPurify existant s'applique à l'écriture et à la lecture, en
conservant `b`, `strong`, `i`, `em`, `font` (tailles 2–5), `br`, `div` et `p`.
Le service cible le navigateur React : l'exécution du sanitizer hors DOM conserve
son comportement historique de texte seul. Les tests RTDB du nouveau service
utilisent donc jsdom pour exercer exactement la politique du navigateur.

## Concurrence et règles locales

Les écritures CRUD ne visent qu'une note. Les patchs de champs distincts se combinent ;
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

`library/{bookId}/note` reste inchangé. La nouvelle interface ne l'écrit plus.
Les lectures CRUD portent sur `bookNotes` ; la lecture d'affichage consulte aussi
la source historique et son marqueur pour la compatibilité. Aucune lecture ni
opération CRUD ne déclenche de migration. L'API explicite `migrateLegacyBookNote(uid, bookId)`
permet une conversion paresseuse par livre, seulement dans l'environnement isolé.
Elle retourne le marqueur après traitement et refuse tout appel hors émulateur
avec `book-notes/emulator-only`, avant toute lecture ou écriture Firebase.
`isFirebaseEmulator` vient de l'initialisation Firebase existante : configuration
exacte `demo-dear-pages`, origine locale, contrôle de santé et connexions aux
émulateurs Auth/RTDB. Aucun paramètre de l'appelant ne permet de lever cette garde.
Les tests remplacent cette dépendance exclusivement par leurs SDK locaux vérifiés.

### Marqueur persistant et immuable

Chemin inchangé pour `note` : `users/{uid}/bookNotesLegacy/{bookId}`.
Chemin indépendant pour `review` : `users/{uid}/bookReviewsLegacy/{bookId}`.
Chaque marqueur ne fait jamais partie de la liste des notes et n'est pas supprimé
par `deleteBookNote`. Les marqueurs existants de `note` ne sont ni réinterprétés,
ni déplacés, ni réinitialisés.

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
Pour `review`, la destination correspondante est `bookNotes/{bookId}/legacy-review-v1`.
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

La même opération s'applique à `review` en utilisant exclusivement son propre
marqueur et `legacy-review-v1`. Deux sources identiques restent deux origines
indépendantes : aucune conversion ne réutilise le marqueur de l'autre source,
et aucun rapprochement par contenu ne remplace leur identité persistante.

Un concurrent perdant reçoit un refus serveur ; le service relit alors le
marqueur et retourne celui du gagnant. Sans marqueur, le refus reste visible
(par exemple source modifiée pendant la copie). Les appels simultanés d'une même
instance SDK partagent une promesse par utilisateur/livre pour éviter de lire le
marqueur optimiste non acquitté d'une autre tentative locale. Les livres distincts
restent indépendants. La garantie entre instances vient des règles serveur.
La clé de promesse inclut désormais le type de source : une conversion de note
et une conversion d'avis peuvent avancer indépendamment pour le même livre.

La lecture d'affichage consulte les notes, puis **les deux** marqueurs, et échoue
si un marqueur n'est pas lisible. Elle n'appelle aucune fonction de conversion.
Pour chaque source non traitée valide, elle calcule `sourceVersion` : SHA-256 des
unités UTF-16 brutes encodées en little-endian. Ce calcul exact distingue même
des HTML qui produisent le même texte assaini. Cette empreinte n'est pas rendue
comme contenu et n'est pas stockée dans le marqueur.
L'interface transmet obligatoirement cette empreinte comme `expectedVersion`
après confirmation. Le service compare la source fraîche avant d'écrire ; les
règles comparent ensuite le HTML brut au moment du commit atomique. Une source
modifiée depuis l'affichage ou entre lecture et commit ne peut donc pas être
copiée silencieusement. Après conflit, actualiser et confirmer à nouveau.
Les appels de test sans `expectedVersion` comparent seulement l'instantané pris
au début de leur propre appel au commit ; ils ne représentent pas une ancienne
confirmation de l'interface. Web Crypto est requis dans le contexte local sécurisé.

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
La copie de `review` utilise par défaut « Mon avis sur le livre » ; l'interface
fournit sa traduction FR/EN comme titre initial. Ce titre reste entièrement
modifiable, comme le contenu et la date, via le CRUD ordinaire. Les dates de
`legacy-review-v1` ont exactement la même signification technique.

Après modification ou suppression, le marqueur reste inchangé ; toute nouvelle
conversion est une lecture seule. Les règles interdisent également la recréation
directe de `legacy-note-v1` une fois le marqueur présent et la note supprimée.
Une tentative ancienne encore en vol ne peut ni écraser la version modifiée ni
rétablir la version supprimée, car son écriture du marqueur est refusée et
l'opération entière est atomique.
Ces garanties valent séparément pour `legacy-note-v1` et `legacy-review-v1`.
Un marqueur présent avec destination absente signifie « déjà traité », jamais
« à recréer ». Un ancien `note` déjà converti, modifié ou supprimé avant cette
extension conserve donc son état, même pendant la première conversion de `review`.

La migration n'écrit jamais dans `library` et ne touche aucune autre note. Les
champs historiques `note`, `review`, `rating`, `updatedAt`, `status` et toutes les
métadonnées restent intacts. Elle ne remplace jamais le champ source par du HTML
assaini. Ne jamais présenter simultanément une entrée virtuelle historique et sa
copie ; dès que le marqueur existe, ne plus utiliser la source comme fallback,
même si la liste des notes est vide.

### Limites et préparation de la production

- Le traitement est un instantané unique : les modifications ultérieures du champ
  historique ne sont pas recopiées, même après un résultat `empty`. L'interface
  multiple a supprimé la saisie historique ; les anciennes versions de l'application
  ou d'autres clients peuvent encore l'écrire selon leurs propres autorisations.
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

## Interface React locale

`BookPersonalSpace` présente « Mon évaluation » avant « Mes notes ». Les étoiles
restent visibles uniquement pour les livres terminés, selon la condition existante.
« Mes notes » est disponible pour tous les statuts. L'éditeur « Mon avis » est
retiré ; aucun parcours React n'appelle les anciennes écritures `updateBookReview`
ou `libraryService.updateBookNote`. Les champs `review` et `note` restent intacts.
`useBookNotes` charge les données avec `getBookNotesForDisplay` et délègue toutes
les écritures au service existant. Les opérations de notes multiples sont désactivées
hors de l'environnement émulateur : aucune lecture supplémentaire ni action de note
multiple n'est lancée sur la production. Un message remplace cette section.

Chaque carte possède son propre brouillon, ses erreurs et sa sauvegarde ; une
opération sur une note ne bloque pas les autres cartes ni les étoiles.
« Annuler » ferme l'éditeur sans écriture et conserve son brouillon en mémoire ;
rouvrir l'éditeur permet de le reprendre. Quitter le livre ou recharger la page
perd ces brouillons : aucun stockage persistant de brouillon n'est ajouté.
Les nouvelles notes prennent le jour civil local à l'ouverture du formulaire ;
le titre est facultatif et la date reste modifiable. La copie historique porte
une explication de la date technique initialisée pendant sa conversion.

Les cartes sont repliées par défaut. Leur en-tête présente le titre facultatif,
la date et un chevron. Une seule carte (y compris historique) ou le formulaire
de création peut être ouverte à la fois. Fermer une carte ou en ouvrir une autre
conserve son brouillon en mémoire. La liste utilise l'ordre chronologique
décroissant du service ; les éléments historiques sans date restent séparés.
Les boutons réutilisent `Button`, les champs `Input`/`Select`, les tokens existants
et l'animation `dp-menu-enter`, sans nouvelles couleurs ni dépendances.

### Sources historiques : conversion manuelle confirmée

Dans l'émulateur, `BookHistoricalNotes` utilise uniquement les deux états
historiques validés par le service. Une source non traitée propose « Convertir
l'ancienne note » ou « Convertir l'ancien avis ». Le dialogue précise la copie
dans « Mes notes », la conservation de la source et la date technique initiale.
Aucune écriture n'a lieu avant l'action « Confirmer la conversion ». Annuler ne
modifie rien. Les sources invalides ou en collision n'offrent pas de conversion.
Une fois traitée, chaque source quitte la compatibilité en lecture seule et sa
copie est une carte ordinaire, renommeable, modifiable et supprimable.

Le hook conserve deux états terminaux indépendants. Après acquittement, il masque
immédiatement la source et lit seulement sa destination pour la fusionner dans la
liste, sans remplacer les autres notes ni leurs brouillons. Si cette lecture
échoue, le message « Conversion enregistrée » propose une actualisation ; il ne
prétend pas que l'écriture a échoué. Si la copie a déjà été supprimée par un autre
client, un message indique qu'elle est absente et ne sera pas recréée. Un échec
réseau avant acquittement laisse l'état incertain : actualiser ou réessayer
explicitement est sûr grâce au marqueur. Aucun réessai de conversion automatique.

Hors émulateur, les conversions et les lectures supplémentaires restent
désactivées. La consultation de `libraryBook.review`, déjà chargé par la page,
reste disponible en lecture seule, sans aucun ancien service d'écriture. Cette
compatibilité de production n'active ni n'implémente une migration production.

Si les deux sources historiques encore en lecture seule, `note` et `review`, ont
exactement le même HTML après sanitation, une seule carte les présente avec les
deux origines explicites. Ce regroupement est uniquement visuel, sans effet sur
les données. Aucun lien de conversion n'est déduit entre `review` et une note
modifiable : cette déduction pourrait faire réapparaître un avis après suppression
d'une note. Les corps de cartes ne sont rendus que lorsqu'elles sont ouvertes,
ce qui évite de présenter simultanément un même contenu historique à deux endroits.
Les deux sources respectent leur marqueur indépendant, y compris après suppression
de leur copie. Aucun HTML brut provenant d'un marqueur n'est rendu dans React.

### Calendrier civil

`CivilDatePicker` est un calendrier léger sans dépendance ajoutée. Le composant
existant `BookFinalStatusDate` ne proposant qu'un mois/une année avec une limite
de récence, il n'est pas réutilisé pour les jours de notes.
Le calendrier garde une chaîne `YYYY-MM-DD`, années 0001–9999. Le service et le
calendrier partagent le validateur civil dans `civilDateUtils`. L'arithmétique
et l'affichage utilisent explicitement UTC pour éviter les décalages de jour,
mais la date initiale d'un nouveau brouillon reste le jour civil local.

Les sélecteurs de mois et d'année permettent l'accès direct aux dates anciennes.
Les flèches déplacent le focus d'un jour ou d'une semaine ; Début/Fin restent
dans la semaine ; Page préc./suiv. changent de mois, et Maj + Page préc./suiv.
d'année. Entrée/Espace sélectionnent, Échap ferme et restitue le focus au bouton.
Le focus initial va au jour sélectionné ; Tab reste dans le dialogue ouvert.
Le clic extérieur ferme sans voler le focus à sa cible. Une navigation de mois
ou d'année ne modifie la valeur qu'après sélection explicite d'un jour.

La lecture consulte les notes puis le marqueur. Si la lecture du marqueur échoue,
aucun fallback historique n'est affiché. Un marqueur observé masque définitivement
le fallback pour ce livre dans le hook, y compris après une suppression locale ou
une actualisation ultérieure. `legacy-note-v1` sans marqueur est un conflit :
une seule carte est affichée, en lecture seule, avec un message explicite.
Une source historique invalide est signalée sans tenter de l'afficher.
Aucune comparaison approximative de contenus n'est utilisée pour fusionner des
notes indépendantes, et aucune fonction de migration n'est appelée par React.

Les lectures ne sont pas un abonnement temps réel entre clients. Le bouton
« Actualiser » permet de récupérer les changements d'un autre client. Une copie
créée entre la lecture des notes et celle du marqueur peut manquer temporairement
dans la liste ; le fallback est néanmoins masqué et une nouvelle actualisation
affichera la copie. Une écriture acquittée est appliquée localement sans seconde
lecture susceptible de faire passer une création réussie pour un échec et de
provoquer un doublon au réessai. Les timestamps techniques affichés dans l'ordre
local des nouvelles cartes sont provisoires jusqu'à la prochaine lecture serveur.

### Aperçu sans Firebase

Avec le serveur de développement existant, ouvrir `/preview/book-notes.html`
(en mode émulateur : `http://127.0.0.1:5501/preview/book-notes.html`). Cette entrée
de développement importe uniquement `BookNotesView`, les styles et l'i18n : aucun
SDK Firebase, service de données ou fournisseur d'authentification. Ses opérations
sont en mémoire, y compris les conversions et leur état de traitement persistant
pendant la session d'aperçu. Elle permet de vérifier les variantes vide, plusieurs notes,
historique, copie supprimée, conflit, source invalide, chargement et erreur, ainsi
que les brouillons, les dates, la confirmation et les erreurs de sauvegarde.
Elle est réservée à une origine locale en développement et ne fait pas partie
de l'entrée de build de production. Aucun port ou réglage Vite n'est changé.

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

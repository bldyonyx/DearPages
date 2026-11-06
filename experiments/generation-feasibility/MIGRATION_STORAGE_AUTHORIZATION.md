# 8B.4.3.1 — Stockage et autorisations de migration

Document d'architecture du 3 novembre 2026. **Proposition à valider ; aucune autorisation de mise en œuvre ou de production.**

**Verdict : NO-GO pour coder le moteur en l'état.** Les contrats purs constituent une base réutilisable, mais ne définissent ni un transfert historique complet, ni une preuve serveur de conservation avant purge. Le choix d'autorité, les augmentations techniques du mapping et le protocole de scellement doivent être validés et éprouvés séparément. Firebase production reste strictement **NO-GO**.

## 1. État Git, périmètre et preuves consultées

| Contrôle initial | Résultat |
| --- | --- |
| Répertoire | `/home/bldyonyx/projects/DearPages` |
| Branche | `feature/multiple-book-notes` |
| HEAD | `3b721a5d0e9734979e8a4261b5ded0e992d0a49c` |
| Commit | `feat: define pure generation migration and recovery contracts` |
| Working tree initial | Propre, aucun changement suivi ou non suivi signalé |
| Modification de cette phase | Ce document uniquement |

Aucune modification inattendue constatée. Les incompatibilités identifiées ci-dessous sont des écarts entre contrats, formats historiques et autorisations, et non une dérive Git. Aucun moteur, service, composant React, contrat ou fichier de règles n'est modifié. Aucun commit, push, merge, déploiement ou accès aux données de production.

Sources locales examinées :

- [Contrats purs et portée](PURE_CONTRACTS.md), [résultats de faisabilité](RESULTS.md), [expérience](README.md), [composition des règles](composeRules.mjs), [règles composées](database.rules.json), [scénarios](feasibility.emulator.js), prototype et expérience de borne.
- [Règles intégrées](../generation-integration/database.rules.json) et [règles historiques Emulator](../../emulator/database.rules.json).
- Les six nouveaux modules : [données de contrat](../../src/utils/generationContractData.js), [migration](../../src/utils/generationMigrationContracts.js), [import](../../src/utils/generationImportContracts.js), [batch de memberships](../../src/utils/generationMembershipBatchContracts.js), [activité](../../src/utils/generationCollectionActivityContracts.js), [reprise](../../src/utils/generationRecoveryContracts.js).
- Leurs tests `generationMigrationImportContracts`, `generationMembershipBatchContracts`, `generationRecoveryActivityContracts`, `generationNewContractsPurity` dans `src/test`, ainsi que le [modèle library](../../src/utils/generationLibraryModel.js).
- Services historiques : [library](../../src/services/libraryService.js), [notes](../../src/services/bookNotesService.js), [ratings](../../src/services/bookRatingsService.js), [Collections](../../src/services/collectionsService.js), [préférences](../../src/services/preferencesService.js), [authentification et profil](../../src/services/authService.js).
- Services générationnels : [library](../../src/services/generationLibraryService.js), [notes](../../src/services/generationBookNotesService.js), [ratings](../../src/services/generationBookRatingsService.js), [catalogue](../../src/services/generationCollectionCatalogService.js), [memberships](../../src/services/generationCollectionMembershipService.js), et leurs gardes expérimentales.

Les résultats antérieurs consignés sont : 152 tests des nouveaux contrats, 1 090 tests unitaires globaux ; faisabilité 91/91 et borne 1/1 ; intégration générationnelle 69/69 et historique Emulator 429/429. **Ils ne sont pas réexécutés ici et ne prouvent pas un moteur inexistant.** La présente phase valide un document, sans lancer Firebase ni initialiser l'application.

Les configurations locales ne décrivent pas nécessairement les règles déployées : `firebase.json` racine concerne Hosting, `.firebaserc` référence le projet réel, les configurations Emulator désignent des règles locales distinctes. Les données et règles réellement déployées demeurent inconnues.

### Convention de lecture

**Fait** signifie observé dans le code ou les règles du dépôt, pas observé en production. **Risque/hypothèse** signifie possible, notamment sous des règles anciennes ou via SDK direct, mais non attesté par des données réelles. **Proposition** signifie décision nouvelle soumise à validation. Tous les chemins personnels ci-dessous sont relatifs à `users/{uid}` ; `accountControl/{uid}` est extérieur.

## 2. Inventaire historique et mapping complet

### 2.1 Règles communes de fidélité

La source est le snapshot brut après gel, jamais les objets d'affichage des services. Ceux-ci ajoutent des identifiants, valeurs par défaut, sanitisation HTML ou booléens qui masquent l'absence initiale. Aucune relecture Google Books/Open Library, traduction de titre, déduplication de texte, conversion automatique de note, changement de statut ou affectation de date courante.

RTDB ne conserve pas les propriétés `null` ni les conteneurs vides comme des valeurs distinctes. Une absence réellement stockée n'est pas une chaîne vide, une liste vide d'interface ou `false`. Conserver les chaînes vides effectivement présentes. Les représentations tableau/objet des clés numériques doivent conserver leurs indices ; aucun filtrage ou compactage des trous. Les listes historiques `authors`, `isbns`, `categories` exigent une preuve de représentation compatible, pas une conversion arbitraire d'objet en liste.

Les priorités RTDB sont une hypothèse à contrôler par une lecture/export qui les expose : `snapshot.val()` seul ne suffit pas. Les règles proposées les refusent ; une priorité existante doit bloquer ou recevoir une résolution explicite. Ne pas supprimer `.priority` lors de l'inventaire. Les clés incompatibles, réservées (`__proto__`, `constructor`, `prototype`), trop longues ou anciennes ne sont jamais renommées automatiquement. Un snapshot non admissible au sérialiseur pur doit produire un diagnostic hors unité si nécessaire ; ne pas en omettre les clés pour obtenir un hash.

Les augmentations techniques proposées ci-dessous sont déclarées séparément du payload historique. Les contrats actuels ne fournissent pas encore cette séparation source/cible. Une unité brute valide n'implique pas que le record cible soit complet et autorisable.

### 2.2 `library/{bookId}`

**Faits.** Champs de création : `id`, `googleBooksId`, `title`, `authors`, `isbn`, `isbns`, `cover`, `categories`, `publishedDate`, `description`, `source`, `openLibraryId`, `status`, `addedAt` ; valeurs `null` et listes vides peuvent disparaître au stockage. Champs ultérieurs/facultatifs : `updatedAt`, `finishedAt`, `abandonedAt`, `note`, `review`, `rating`. `startedAt` est accepté par le modèle générationnel mais aucun setter historique ne le produit automatiquement. Statuts : `to-read`, `reading`, `finished`, `abandoned`.

L'identifiant de création vient de `getBookRouteId` : Google Books, puis identifiant Open Library normalisé, puis `id`. La clé stockée reste l'identité d'import ; ne pas la recalculer depuis les métadonnées. La lecture historique remplace un `id` absent par la clé : c'est une projection, pas la preuve qu'il existait. Les dates du service sont des millisecondes `Date.now()`. Un changement de statut efface la date de l'ancien statut final et crée celle du nouveau ; aucune révision historique générale. `note`/`review` sont des HTML modifiables ; `rating` est un entier 1–5. Pas de tombstone library : suppression physique.

**Destination.** `bookData/{bookId}/1/library`, avec `bookLifecycle/{bookId}` génération 1. Contrat `library`, profil `legacy`, contexte livre génération 1. Conserver exactement tous les champs admissibles, y compris sources historiques et note scalaire, sans générer d'entrées de journal supplémentaires.

**Incompatibilités.** Le modèle exige `id === bookId`, titre chaîne ≤ 200, statut connu, `addedAt` non négatif valide ; les dates et champs sont stricts. Les dates de lecture peuvent être négatives dans le modèle, contrairement aux dates de création. Un titre ancien trop long, un champ inconnu, un `id` contradictoire, HTML incompatible ou date mal formée bloque. L'ajout de `id=clé` lorsque absent est une proposition d'augmentation explicite à approuver, jamais un backfill silencieux. Ne pas inventer `addedAt`. Les sources HTML dépassant la grammaire RTDB bloquent même si le sanitizeur historique savait les afficher.

### 2.3 `bookNotes/{bookId}/{noteId}`

**Faits.** Création par push ID ; entrées réservées `legacy-note-v1` et `legacy-review-v1` pour conversion explicite. Record : `title`, `contentHtml`, `date`, `createdAt`, `updatedAt`, `isPinned`. `title` peut être vide ; `isPinned` peut manquer sur une ancienne entrée. Contenu HTML limité à 200 000 et sanitizé à l'écriture ; date civile réelle `0001`–`9999`. Horodatages serveur résolus en nombres. Le pin ne modifie pas `updatedAt`. Édition garde l'identité ; suppression physique, **aucun tombstone historique de note**. Les gardes exigent normalement un livre existant.

**Destination.** Même identifiant dans `bookData/{bookId}/1/bookNotes/{noteId}`. Contrat `note`, profil `legacy` pour capture ; profil `generation` pour cible préparée. Conserver titre, HTML brut admissible, date, timestamps et pin explicite. Ajouter uniquement des métadonnées techniques déclarées : `creation` déterministe sur 64 caractères hexadécimaux et `fieldRevisions:{title:1,contentHtml:1,date:1}`. Si pin absent, la proposition `isPinned:false` correspond à la lecture historique, mais doit être approuvée comme augmentation d'absence. Le contrat legacy admet l'absence ; le record générationnel vivant exige le champ.

**Risques.** Identifiants anciens hors politique, HTML ancien, champs supplémentaires, date vide/non réelle, timestamps absents ou invalides bloquent. Ne pas sanitizer pour faire accepter l'import. Une note sans livre est un orphelin : ne pas recréer un livre fictif ni l'effacer. Une absence de note ne permet pas de reconstruire une suppression passée. Un tombstone générationnel existant relève du profil génération, pas d'une déduction depuis le legacy.

### 2.4 `bookNotesLegacy/{bookId}` et `bookReviewsLegacy/{bookId}`

**Faits.** Chaque marqueur immuable contient `version:1`, `outcome:'empty'|'copied'`, `sourceHtml`, `processedAt`. Une conversion explicite capture le HTML source brut et crée atomiquement, si nécessaire, la copie réservée ; son contenu est sanitizé, sa date civile est celle de conversion, ses timestamps sont ceux de conversion, pin initial faux. Les conversions note et review sont indépendantes. Un marqueur signifie « déjà traité », même si la copie est ensuite modifiée ou supprimée. La source `library.note/review` peut changer après le marqueur.

**Destination.** `bookData/{bookId}/1/bookNotesLegacy` et `bookData/{bookId}/1/bookReviewsLegacy`. Contrats `noteMarker` et `reviewMarker`, profils legacy puis generation ; conserver version, outcome, sourceHtml et processedAt, ajouter `intent` technique déterministe. Si la copie réservée existe, son `creation` doit être cohérent avec l'intent d'import correspondant, sans écraser ses champs édités.

**Blocages et cas légitimes.** `empty` avec source non vide, `copied` avec source vide, version inconnue ou HTML non admissible bloquent. Une copie réservée sans marqueur est contradictoire et doit être résolue explicitement. Un marqueur `copied` avec copie absente peut être légitime après suppression ; conserver le marqueur sans recréer la copie. Pin vrai, dates différentes ou contenu édité ne doivent pas être ramenés aux conditions d'une nouvelle conversion. Une source actuelle différente de `sourceHtml` n'est pas automatiquement une corruption : préserver les deux et définir une politique explicite de diagnostic, sans actualiser le marqueur.

### 2.5 `bookRatings/{bookId}/{ratingId}`

**Faits.** Service expérimental protégé Emulator. ID push de 20 caractères ou `legacy-rating-v1`. Record vivant : `value` entier 1–5, `date` civile, `revision`, `createdAt`, `updatedAt` ; `impression` facultative, ≤ 160 caractères, sans contrôles. Le service omet une impression uniquement blanche à la saisie ; une valeur stockée n'est pas à retrimmer. Révision initiale 1, édition CAS avec incrément. La date vide est réservée à `legacy-rating-v1` pour une ancienne note scalaire sans date.

La suppression produit `{deleted:true,createdAt,updatedAt,revision}` avec révision ≥ 2, sans value/date/impression : **tombstone personnel à importer**, pas une entrée à ignorer. Création/édition/conversion exigent le statut finished ; une suppression reste possible avec un autre statut. Le statut peut changer après une notation : une entrée existante sur livre non finished n'est donc pas à rejeter pour ce seul motif.

**Destination.** `bookData/{bookId}/1/bookRatings/{ratingId}`, contrat `rating`. Préserver exactement les révisions, dates, horodatages et tombstones ; ne pas réinitialiser les révisions à 1, affecter une date connue fictive ou exiger le statut finished pour l'import historique. La borne du contrat rating est l'entier sûr, distincte de la borne 32 bits des memberships/catalogue. Un tombstone portant encore du contenu est contradictoire et bloque.

### 2.6 `bookRatingsLegacy/{bookId}`

**Faits.** Marqueur immuable `{version:1,sourceValue,processedAt}` ; conversion explicite atomique avec `legacy-rating-v1`, date `''`, révision initiale 1. Une conversion passée peut être suivie d'une édition ou d'un tombstone de cette entrée ; la note scalaire actuelle peut différer du marqueur.

**Destination.** `bookData/{bookId}/1/bookRatingsLegacy`, contrat `ratingMarker`, sans inventer d'intent absent de son schéma. Conserver les trois champs. Préserver indépendamment `library.rating`, marqueur et entrée/tombstone réservé. Ne pas appeler `convertLegacy` pendant migration. Copie réservée sans marqueur : diagnostic bloquant ; absence de copie après marqueur : ne pas ressusciter. Une source scalaire divergente nécessite une politique explicite, pas son remplacement par `sourceValue`.

### 2.7 `collections/{collectionId}` et `books/{bookId}`

**Faits.** ID push. Métadonnées de création : `name` trim, `description` trim ou `''`, `icon` ou `'library'`, `pinned:false`, `createdAt`, `updatedAt`, `books:{}`. Les dates viennent de `Date.now()`. Le stockage peut omettre `books` vide. Lectures : ajout `id`, defaults icon/pin/books, tri pins puis `updatedAt || createdAt` : ne pas utiliser ces projections comme source. Aucun compteur/epoch historique. Suppression physique de la Collection ; clear supprime `books` **sans changer updatedAt**.

`books/{bookId}=true` matérialise la relation ; retirer la relation écrit null. Les mises à jour de sélection touchent les Collections concernées et leur date. Le service n'impose pas l'existence du livre pour ajouter une relation. La suppression d'un livre retire les liens découverts dans les Collections au moment de la lecture, mais une concurrence peut laisser un lien. Ces orphelins sont possibles via les services eux-mêmes.

**Destination.** Métadonnées dans `collectionCatalog/{collectionId}` ; chaque relation dans `bookData/{bookId}/1/collectionMemberships/{collectionId}`. Contrat `collection` legacy pour capture du record comprenant `books`, puis `collection` generation sans `books` pour le catalogue. Ajouter explicitement `membershipEpoch:1`, `revision:1`, `creation` déterministe, `fieldRevisions:{name:1,description:1,icon:1,pinned:1}`. Une Collection vide reste un objet de catalogue vivant. Préserver noms, description, icône, pin et dates exacts, sans retraitement de whitespace.

Une relation true devient explicitement `{epoch:1,present:true,revision:1}`, contrat `membership` **profil generation**. Le constructeur n'accepte pas le booléen legacy comme payload. Une unité Collection brute se décompose donc en une unité catalogue et autant d'unités membership : la dépendance doit être ajoutée au plan préparé, sans collision de writers.

**Blocages.** Champs obligatoires manquants, nom vide après trim, icône vide, dates invalides, valeur books autre que true, clé incompatible ou livre absent. Les defaults d'affichage ne constituent pas une autorisation d'inventer description, icône ou pin ; une politique d'augmentation d'absence doit être approuvée. Aucune date manquante ne peut être reconstruite avec now. Une Collection absente ne laisse pas assez d'information pour créer un tombstone. Une ancienne membership false/objet ou un epoch préexistant inattendu n'est pas normalisé.

Ne pas importer via le batch CRUD : il exige ready/identités actives, manipule révisions et activité. Ne pas créer d'activité de migration à now : elle changerait l'ordre personnel. L'absence initiale de `collectionActivity` laisse la projection se baser sur les dates de catalogue conservées.

### 2.8 `profile`, `preferences`, Auth et branches inconnues

**Faits.** Profil RTDB : `displayName`, `email`, `photoURL`, `createdAt` ; un profil existant n'est pas nécessairement complété en createdAt. Mise à jour Auth puis RTDB non atomique. Le profil RTDB n'est donc pas à recalculer depuis Auth.

Préférences : `language`, `onboardingCompleted`, `updatedAt` ; `favoriteGenres` et `annualGoal` lors de l'onboarding, puis patches de réglages. L'onboarding accepte un objectif entier positif sans la borne 200 du formulaire de réglages. L'absence de préférences conserve une sémantique legacy distincte de `onboardingCompleted:false`. Les patches préservent les champs futurs.

**Destination.** Ces branches restent **au même chemin, intégralement**. Aucun des neuf kinds d'import ne les représente ; elles ne font pas partie des sept branches à purger. Ne pas les passer à un validateur d'import pour en perdre des champs inconnus, limiter un objectif ancien à 200 ou backfiller une valeur Auth. Le gel du contenu livres ne nécessite pas de figer ces réglages ; leurs writes restent soumis à la barrière de compte.

Le wildcard propriétaire des règles historiques autorise d'autres branches que les sept spécialisées. Leur existence réelle est inconnue. Avant toute activation, établir une liste exhaustive des racines personnelles réelles par inventaire autorisé ; une racine inconnue est conservée et bloque la déclaration de couverture complète. Aucun grant global de lecture utilisateur n'est proposé au client pour contourner cet inventaire. L'outil contrôlé, si choisi, devra disposer d'une lecture d'audit limitée et justifiée. Un schéma futur devra traiter les nouvelles écritures inconnues en refus par défaut, sans effacer les anciennes données.

Le service historique de suppression fait `remove(users/{uid})`, puis supprime Auth après réauthentification. Les règles locales historiques/intégrées ne fournissent pas le grant ancêtre nécessaire ; leur fonctionnement ne démontre donc pas celui de la production. Le protocole terminal proposé remplace ce raccourci par lock, purge RTDB, finalisation de la barrière, puis suppression Auth.

### 2.9 Chemins cibles exacts et contrôle d'exhaustivité

Le nom des marqueurs doit rester celui du stockage intégré, sans créer des branches homonymes supplémentaires :

| Kind pur | Destination sous `users/{uid}` |
| --- | --- |
| library | `bookData/{bookId}/1/library` |
| note | `bookData/{bookId}/1/bookNotes/{noteId}` |
| rating | `bookData/{bookId}/1/bookRatings/{ratingId}` |
| historicalSources | Champs `note`, `review`, `rating` du même record library ; helper de préparation, aucun second writer concurrent |
| noteMarker / reviewMarker / ratingMarker | Respectivement `bookData/{bookId}/1/bookNotesLegacy`, `bookReviewsLegacy`, `bookRatingsLegacy` sous la même génération ; aucun chemin libre fourni par client |
| collection | `collectionCatalog/{collectionId}` |
| membership | `bookData/{bookId}/1/collectionMemberships/{collectionId}` |

Une bijection de provenance est exigée : chaque valeur historique appartient à une transformation documentée ; chaque valeur cible personnelle vient d'une source ; chaque ajout technique est déclaré. Les totaux globaux ne suffisent pas. Une même valeur recopiée dans deux anciens emplacements reste deux valeurs ; aucune fusion automatique. Les branches supprimées avant le snapshot ne sont pas reconstructibles.

## 3. Contrats réutilisables et limites

| Module | Réemploi | Ce qu'il ne garantit pas |
| --- | --- | --- |
| generationContractData | Copies immuables, JSON admissible, clés sûres, sérialisation canonique, entiers et hashes déclarés | Ne calcule pas de hash, n'exporte pas les priorités ni les sources invalides ; ne prouve aucun contenu serveur |
| generationMigrationContracts | Identité uid/migrationId/transformVersion ; neuf kinds ; unités triées ; diagnostics bloquants ; checkpoint monotone frozen→inventoried→planned→imported→verified→purging→complete | Le plan reçoit sourceVersion ; unité sans digest de payload ; completedUnits et evidence `source:'server'` sont des déclarations de l'appelant |
| generationImportContracts | Capture stricte legacy/generation, rejet des champs inconnus, aucune sanitisation ; réconciliation exact-match et blocage hors migrating | Ne transforme pas legacy en cible, ne produit pas de multipath, ne lie pas toutes les branches entre elles, ne vérifie pas une couverture complète |
| generationMembershipBatchContracts | Capture stable, retries immuables, CAS borné, preuve de reçu ; maximum 32 lignes/128 KiB côté client/64 slots, séquence ≤ 2 147 483 647 | Conçu pour opérations ordinaires, pas pour import arbitraire ni manifeste exhaustif ; preuve évincée indéterminée, jamais permission de rejouer |
| generationCollectionActivityContracts | Projection déterministe pins/date/id, clear garde activité, no-op sans activité, suppression masque la Collection | Projection et effets désirés seulement ; pas d'autorisation de nettoyage activité |
| generationRecoveryContracts | Reprise creating/deleting, revue explicite du creating, barrière compte prioritaire et terminale, gestion des observations incertaines | Pas de découverte serveur, lock réseau, journal durable, suppression Auth ou restauration automatique |

Le `unitId` est une chaîne JSON canonique de tuple ; **ce n'est pas une clé RTDB**. Proposition : clé technique `SHA-256(UTF-8(domaine + unitId))`, avec descripteur complet conservé et comparé. La résistance aux collisions et les correspondances des hashes sont vérifiées par l'autorité de vérification, pas calculées par les règles. Les règles utilisent des chemins typés connus, jamais un `destinationPath` client donnant un accès arbitraire.

Les sources des conversions historiques note/review utilisent SHA-256 sur UTF-16LE ; les services générationnels utilisent UTF-8. Ces jetons ne sont pas interchangeables. Recalculer le jeton du protocole cible sur le texte exact avec domaine/encodage/version explicites ; conserver les timestamps et le texte. `sourceVersion` du plan est un troisième usage à spécifier distinctement.

## 4. Écarts entre contrats et stockage proposé

### 4.1 Écarts bloquants confirmés

1. Les règles intégrées n'autorisent que `bookProtocol:{version:2,state:'ready'}` ; elles n'ont pas de mode import. Le témoin `importWitness` de faisabilité n'autorise pas l'import réel.
2. Les créations ordinaires imposent now, compteurs initiaux et conditions métier ; les tombstones exigent un objet antérieur. Elles ne peuvent recevoir fidèlement des dates/révisions/tombstones historiques par simple appel des services existants.
3. Les marqueurs ordinaires attestent une nouvelle conversion, avec source courante et copie initiale ; ils ne représentent pas toutes les histoires légitimes après édition/suppression. Il faut des prédicats d'initialisation de migration distincts, fermés après import.
4. `bookMigration:{id,version:1}` expérimental n'est pas l'objet pur `{uid,migrationId,transformVersion}`. Proposition de correspondance : uid dans le chemin, id=migrationId, version=version de transformation prise en charge. Ne pas confondre version protocole 2, version de marqueur 1 et transformVersion ; garder une allowlist explicite. Cette correspondance reste à approuver.
5. Un payload Collection legacy contient books ; le catalogue les refuse. Les memberships nécessitent une transformation et une liaison livre/catalogue/epoch que l'enveloppe pure seule n'impose pas.
6. `assertMigrationReady` valide une cohérence interne avec des booléens fournis. Ni la chaîne `server`, ni un checksum client, ni un checkpoint persistant ne sont une attestation indépendante.
7. Les règles de faisabilité autorisent actuellement la purge des sept racines dans le commit migrating→ready sans preuve d'import. Le scénario local `ready requires legacy purge` supprime library puis passe ready : il ne démontre pas sa conservation. **Un import vide suivi d'une purge peut satisfaire ces conditions.**
8. Les reads historiques notes/ratings sont par livre existant ; ils ne permettent pas l'énumération propriétaire de tous les orphelins. Prévoir des reads de migration sur chacune des sept racines connues, sans read ancêtre large.

### 4.2 Stockage de contrôle proposé, non implémenté

| Chemin | Contenu / autorité / durée |
| --- | --- |
| `accountControl/{uid}` | `{state,legacyClosed}` externe, monotone, survit à la purge utilisateur |
| `bookProtocol` | Exactement `{version:2,state:migrating|ready}` ; ne pas ajouter des champs refusés par les lecteurs actuels |
| `bookMigration` | Identité immuable, format et version à valider ci-dessus |
| `migrationControl` | Schéma fermé de liaison migration/version/sourceVersion/planDigest/sealRevision/phase ; transitions autorisées explicitement |
| `migrationWork/{migrationId}` | Manifeste typé, dépendances, reçus exacts et checkpoints ; données personnelles transitoires, pas une seconde bibliothèque permanente |
| Approbation dans `migrationControl` | Attestation minimale de vérification liée au seal et au plan ; écriture réservée à l'autorité choisie, jamais au propriétaire ordinaire dans l'option B |

Il s'agit d'une proposition de responsabilités, **pas encore d'un schéma wire approuvé**. Les champs exacts, limites de tailles et transitions nécessitent une petite spécification pure séparée avant de coder. Le checkpoint pur conserve ses stages ; le scellement est une barrière de stockage distincte, pas une nouvelle valeur glissée dans son enum.

Séquence proposée : gel atomique → inventaire brut → plan admissible → import idempotent → **scellement** → vérification indépendante → approbation → purge des sources → purge des copies de travail → ready. Le scellement interdit tous les nouveaux imports, changements de manifeste, identités et contenus cibles ; sinon une vérification faite en plusieurs reads n'est pas stable. Aucun déverrouillage par délai ou nouvelle identité après une interruption. Un échec de vérification bloque ; une correction nécessite un protocole explicite de nouvelle révision de seal et invalidation d'approbation, encore à concevoir.

Les sources sont gelées tant qu'elles existent. Après le début de purge, ne pas recalculer sourceVersion sur la source partielle et la traiter comme une nouvelle source initiale : reprendre le plan et l'approbation durables associés au snapshot gelé. Les reçus d'import ne sont pas le ring borné des batches ; ne pas les évincer avant réconciliation complète.

Le journal de migration peut contenir des identifiants personnels et liens de Collections. Le supprimer avant ready, après vérification et purge historique, pour ne pas créer une copie oubliée par la suppression d'un livre. Garder seulement une preuve minimale sans titres, textes, listes de livres ou scopes personnels. Tout stockage de provenance supplémentaire sous une génération nécessiterait un schéma explicite : `$other:false` le refuse actuellement. Profile/preferences ne sont ni dupliqués dans ce journal ni inclus dans son hash de contenu livres.

Initialisation de génération : aucun état préexistant contradictoire n'est écrasé. Si bookData/lifecycle/catalogue existe avant le premier gel, analyser l'état ; ne pas remettre un livre supprimé à génération 1 ni réutiliser une identité. Pendant migration, un état d'initialisation non utilisable peut recevoir les données, puis être scellé ; l'activation de chaque livre et l'absence de branches orphelines doivent être vérifiées avant ready. La forme exacte de cette transition doit être prouvée sans affaiblir le cycle creating/active/deleting/deleted ordinaire.

## 5. Autorisations RTDB proposées

### 5.1 Principes d'évaluation

Les permissions `.read/.write` accordées sur un ancêtre se propagent ; un deny descendant ne les retire pas. Les validations ne protègent pas les suppressions null. Les droits de suppression doivent donc être dans `.write`, pas seulement dans `$other:.validate=false`. Une écriture multipath est atomique mais ne fournit pas une boucle de comparaison sur les collections. Voir la [syntaxe officielle des règles RTDB](https://firebase.google.com/docs/database/security/core-syntax).

Les conditions ci-dessous sont des **prédicats de conception**, pas des règles exécutables. Chaque chemin doit avoir sa profondeur `newData.parent()` vérifiée pour comparer les états avant/après ; `root` représente l'avant. Ne pas supposer que `root` voit une autre branche modifiée du multipath.

Définir conceptuellement : propriétaire authentifié ; compte actif avant **et après** ; identité de migration inchangée ; protocole migrating avant/après pour import ; seal non posé ; cible typée de la génération autorisée. Tous les writes ordinaires exigent ready avant/après et compte actif avant/après. Compte terminal prioritaire sur tout checkpoint ou reçu.

### 5.2 Matrice des permissions

| Action / chemin | Conditions nécessaires | Refus explicites |
| --- | --- | --- |
| Bootstrap accountControl | Absent, propriétaire, active/legacyClosed false, schéma fermé ; coexistence avec comptes déjà terminaux impossible | Réinitialisation, suppression de la barrière, retour terminal→active |
| Gel initial | Un multipath crée identité et migrating et passe legacyClosed false→true ; compte actif avant/après ; aucun contenu legacy modifié dans ce commit | Gel partiel, overwrite d'identité, ancien client écrivant pendant le gel, retour legacyClosed false |
| Legacy, sept racines | Avant gel : permissions historiques nécessaires mais bornées aux chemins ; après gel : aucune édition/création ; purge seule après approbation valide | `set` ancêtre de remplacement, écriture mixte gel+modification, suppression prématurée |
| Lecture migration | Propriétaire / outil explicitement ciblé, racines connues, contrôle et génération autorisée | Autre uid, lecture globale de users ou accountControl |
| Import library/notes/ratings/marqueurs/catalogue/memberships | Migrating, non scellé, génération/identité liées, schéma fermé spécifique import, copie existante identique ou création admissible | Champs inconnus, autre génération, mutation contradictoire, révision/date réécrite, suppression arbitraire |
| Checkpoint/reçu | Identité, unité et contenu liés ; progression monotone, ensemble non réduit ; résultat serveur relu en cas de réponse perdue | Checkpoint utilisé seul pour autoriser purge, suppression de preuve pour rejouer |
| Seal | Transition monotone ; bloque tous les writers d'import et de plan dans l'état résultant | Ajout d'une note ou d'une unité après scan, remplacement de plan sous une approbation existante |
| Approbation B | Principal vérificateur distinct, claims ciblés + contrôle persistant de session ; binding exact identité/plan/source/seal | Propriétaire se déclarant verified, approbation d'un autre seal/uid/version |
| Purge legacy / travail | Approbation valide, migrating scellé, compte actif avant/après ; grants null-only au chemin explicitement prévu | Grant de modification sur racine personnelle, restauration de source, destruction sans vérification |
| Ready | Approbation liée, sept racines absentes, travail personnel absent, génération scellée vérifiée, compte actif ; transition irréversible | Ready prématuré, ready→migrating, nouvel import après ready |
| Purge de génération ordinaire | Ready, lifecycle déjà deleting ; suppression intégrale autorisée de la génération selon protocole et purge des reçus personnels | Supprimer une autre génération, restaurer des enfants, réutiliser la génération supprimée |
| Compte terminal | Lock active→deleting ferme legacy ; purge utilisateur seulement null ; deleted seulement si utilisateur absent | Tout write personnel après deleting, toute résurrection après deleted, bootstrap par ancien client |

**Aucun grant large sur `users`, `users/{uid}`, `bookData` ou catalogue.** L'unique exception ancêtre envisagée est la purge terminale de `users/{uid}` : `.write` ne peut réussir que si l'ancienne et la nouvelle barrière sont deleting et `newData` est entièrement absent. Elle ne permet aucun remplacement non nul, même si des validations descendantes disparaissent sur null. Une alternative est la purge racine par racine, avec davantage de couverture et de preuves nécessaires ; le choix doit rester explicite.

Pour les structures fermées, refuser inconnus et priorités à tous les niveaux, y compris tableaux/maps à clés dynamiques. Un grant d'import à la génération entière permettrait aussi d'en supprimer des enfants : préférer des grants par record typé, ne jamais utiliser « migrating donc tout writable ». Les marqueurs et tombstones peuvent être créés directement uniquement dans le sous-protocole d'import, avec validation de leur état historique et blocage d'overwrite. Après ready, retrouver les invariants CRUD existants, y compris non-résurrection et impossibilité de réimporter un tombstone perdu.

### 5.3 Ce que les règles ne peuvent pas attester ici

Les règles peuvent lire un nombre fixe de chemins, imposer des liens locaux, des schémas et une transition. Elles ne peuvent pas parcourir arbitrairement tous les livres/notes/Collections, recalculer un digest global, ni prouver que le manifeste présenté par le client contient toute la source. Comparer un total ou accepter une liste `completedUnits` peut valider une déclaration incomplète. Un slot fixe valide les lignes présentes, pas l'absence de lignes omises. Ne pas supposer une comparaison profonde générique d'objets via `val() === val()`.

Il existe une autre piste **A renforcée**, non démontrée : transférer la garde de chaque feuille historique, autoriser sa suppression seulement si sa valeur exacte existe dans la destination immuable, interdire toute suppression d'ancêtre court-circuitant ces contrôles, puis constater l'épuisement des sept racines. Cela pourrait éviter une attestation indépendante dans un schéma entièrement couvert ; ce n'est pas une preuve d'impossibilité générale du client seul. Il faudrait cependant concevoir et prouver le traitement de toutes les feuilles, listes, marqueurs, dépendances et champs inconnus, ainsi que la reprise sur source partiellement consommée. Ce protocole n'est pas fourni par les six contrats et ne doit pas être présumé acquis.

## 6. Autorité : comparaison et recommandation non approuvée

| Dimension | A — Client propriétaire authentifié, sans backend permanent | B — Outil privilégié contrôlé |
| --- | --- | --- |
| Imposable par règles | Gel, identité unique, schémas fermés, barrières compte/génération, immutabilité après seal, droits locaux et ordre de phases | Même socle si l'outil écrit via règles ; approbation réservée à un principal distinct du propriétaire |
| Vérification globale | Inventaire, bijection, hashes, couverture et égalité source/cible exécutés par le client ; les règles n'attestent pas leur exécution | Vérificateur indépendant relit source et cible scellées, recalcule le mapping et refuse toute omission/excédent ; cette justesse reste celle du programme contrôlé |
| Import incomplet | Un client honnête peut être protégé par contrôles/reprise ; SDK hostile peut omettre source/unités et fabriquer son verified dans un protocole déclaratif | Owner ne peut obtenir l'approbation par sa seule déclaration ; erreur ou compromission du vérificateur reste un risque |
| Suppression prématurée | Impossible à exclure avec les seules auto-attestations + purge par branches ; A renforcée demanderait une preuve supplémentaire | Purge/ready conditionnés par approbation non forgeable, sur état scellé ; validation globale déléguée explicitement |
| Reprise | Identité/plan persistants, exact-match, relecture serveur ; fermeture d'onglet peut laisser un compte migrating indéfiniment | Même journal ; opérateur peut reprendre sans navigateur ; conserver le binding initial pendant purge partielle |
| Exploitation | Pas de secret serveur, coût de reads/écritures/doublons temporaires ; contraintes de mémoire, offline et versions anciennes | Distribution/versionnement outil, identité privilégiée, journal d'audit minimal, déclenchement/assistance opérateur, reads de vérification supplémentaires et politique de secrets |
| Disponibilité | Migration autonome mais dépendante du client ; un refus sûr peut exiger support | Pas nécessairement de service permanent ; opération ponctuelle ou job contrôlé, délai opérateur et responsabilité d'exploitation |
| Suppression du compte | Règles peuvent fermer atomiquement toutes les écritures du client | Attention : un accès Admin non restreint contourne les règles, donc aussi la barrière |

**Recommandation : B pour la vérification et l'approbation destructrice**, avec possibilité de préparation/import par le client. Cela n'impose pas un backend permanent. Le changement par rapport à une orientation client seule doit être validé : le bénéfice est d'empêcher le propriétaire ordinaire de s'auto-autoriser une purge avant conservation vérifiée. Si Dear Pages retient A, il faut choisir explicitement entre garantie limitée au client coopératif et investissement dans la preuve de transfert par feuilles ; ne pas annoncer les garanties de B pour A.

L'outil recommandé ne doit pas effectuer ses writes de données avec un Admin SDK non restreint. Une prélecture `accountControl=active` suivie d'un write Admin a une course : le compte peut devenir deleting entre les deux, puis être ressuscité. L'accès Admin complet contourne les règles ; voir la [documentation Admin RTDB](https://firebase.google.com/docs/database/admin/start).

Proposition B concrète à éprouver : une autorité contrôlée émet une identité Auth d'outil distincte, avec claims de rôle, uid cible, migration et version. Les accès RTDB de données utilisent une authentification soumise aux règles, qui comparent ces claims et une session persistante fermée/révocable, ainsi que la barrière de compte avant/après. Les [custom claims](https://firebase.google.com/docs/auth/admin/custom-claims) doivent être attribués par une autorité privilégiée ; l'utilisateur ne peut pas les écrire dans sa propre branche pour obtenir le rôle. Un token périmé ne suffit pas à rouvrir une session terminale. L'identité de l'outil n'hérite pas d'un wildcard propriétaire sur un autre uid.

Si des writes Admin directs sont retenus malgré tout, il faut une sérialisation de confiance ou un CAS couvrant **ensemble** barrière externe et données personnelles à leur ancêtre commun. Un précheck, une transaction sous users/{uid} seul ou un lock client ne suffit pas ; une transaction racine aurait des coûts/conflits importants. Ce serait une autre architecture, bloquante tant que la priorité terminale n'est pas démontrée. Emulator ne démontre pas la sécurité d'un secret opérateur réel.

## 7. Plan de preuves Emulator à préparer après validation

Projet de démonstration uniquement, règles proposées dans un nouvel espace isolé ; pas de réutilisation implicite de la configuration réelle. Clients owner A/B, autre uid, anonyme, ancien SDK, outil à claims corrects/erronés et observateur de fixture. Les données invalides anciennes sont injectées par le harnais privilégié uniquement pour simuler l'histoire ; les actions testées utilisent les droits réels de leur principal. Aucune utilisation Admin dans le chemin censé démontrer une barrière de règles.

| Scénario | Préparation/action | Résultat observable exigé |
| --- | --- | --- |
| P01 — Fidélité complète | Fixture des sept racines, profil/prefs, Collections vides, métadonnées, unicode, whitespace, HTML admis, note/review identiques mais distinctes | Comparaison brute source→cible par mapping versionné ; seules les augmentations déclarées diffèrent ; zéro valeur personnelle omise |
| P02 — Histoire des marqueurs | Copie éditée/pinnée, copie supprimée, tombstone rating réservé, source actuelle différente du marqueur | Marqueurs et sources conservés séparément ; aucune conversion/résurrection ; politique de divergence appliquée explicitement |
| P03 — Deux migrateurs | Gel simultané même/différente identité ; import simultané même unité | Une identité gagne ; autre identité refusée ; même payload réconciliable ; aucun overwrite |
| P04 — Checkpoints interrompus | Couper après chaque phase, au milieu de fan-out Collection, avant/après commit et avant ack | Relecture serveur décide ; ensemble monotone ; checkpoint en avance ne permet ni purge ni ready ; sourceVersion initiale conservée |
| P05 — Idempotence | Rejouer import identique après timeout ; reprendre après seal et après ready | Aucun changement de dates/révisions/contenu ; exact-match reconnu ; aucun nouvel import après seal/ready |
| P06 — Contradiction | Même unité, contenu/date/creation différents ; collision de dépendance, autre génération | Refus atomique de tout le multipath, aucun sous-ensemble écrit |
| P07 — Sources incompatibles | Orphelins, bool false de membership, champs inconnus, HTML/date invalides, id manquant/mismatch, priorité, clés réservées, listes numériques trouées | Diagnostic explicite et blocage avant purge ; snapshots conservés, aucune troncature/default caché |
| P08 — Purge vérifiée | Vérifier sur seal stable, approuver puis interrompre plusieurs suppressions de branches | Reprise sur binding approuvé ; profil/prefs intacts ; travail personnel retiré avant ready ; imports toujours fermés |
| P09 — Ready prématuré | Source résiduelle, unité omise, cible absente, approbation absente/forgée/ancien seal, import vide+purgesept | Refus ready et purge ; reproduire d'abord la limite des règles de faisabilité actuelles comme témoin négatif, puis la fermer dans les nouvelles règles |
| P10 — SDK direct | set/update/remove/transaction à racine, user, génération, catalogue ; unknown fields/priorités ; multipath valide+invalide | Pas de grant ancêtre exploitable ; tout le commit refusé ; suppressions null contrôlées par write |
| P11 — Seal concurrent | Import/ajout manifeste concurrent au seal ; tentative de modification pendant scan vérificateur | Avant seal commit admissible inclus dans scan, ou après seal refusé ; pas d'état approuvé changeant |
| P12 — Compte prioritaire | active→deleting en concurrence avec gel, import, approbation, purge et ready ; outil à ancien token | Seul ordre linéarisable autorisé ; aucun write personnel accepté lorsque barrière avant/après terminale ; checkpoint sans priorité |
| P13 — Suppression terminale | Purge users depuis absent/migrating/ready ; échec simulé Auth puis reconnexion ancien client/outil | Barrière externe deleting/deleted conservée ; aucune recréation profile/preferences/legacy/destination ; suppression Auth réessayable sans réactivation |
| P14 — Générations | Réimport gen1 après suppression/réajout gen2 ; tombstones existants ; état creating interrompu | Refus identité obsolète, aucun reset compteur ; reprise/revue explicite conforme au contrat recovery |
| P15 — Preuve globale B | Client ment sur count/hash/manifest ; destination en excès ; approbation d'autre uid/version ; session révoquée | Vérificateur recalcule depuis source scellée et refuse ; règles refusent owner et rôle non ciblé |
| P16 — Volumétrie | Plus de 32 relations, plus de 64 unités, grands textes et plusieurs lots | Import indépendant du ring CRUD ; limites réseau/mémoire mesurées, commits bornés ; aucun découpage détruisant l'idempotence |
| P17 — Couverture des reads | Notes/ratings/markers orphelins et racine personnelle inconnue | Inventaire ne se limite pas à library ; unknown root signalée par audit autorisé ; aucun read global ajouté au client |
| P18 — Alternative A renforcée | Si choisie : suppression feuille/champ/parent/listes inconnues, cycles d'interruption avec source consommée | Aucun chemin de destruction sans destination exacte ; preuve de couverture intégrale requise avant de prétendre se passer d'autorité |

Oracles : comparer indépendamment l'inventaire brut, les transformations autorisées et les snapshots serveur finaux ; ne pas réutiliser exclusivement le code du moteur pour calculer le résultat attendu. Contrôler aussi l'absence de copies dans journal, index et reçus. Les horloges d'exécution ne doivent pas remplacer les dates personnelles.

**Limites de preuve.** Sans autorité supplémentaire ou nouveau protocole A renforcé démontré, impossible d'attester serveur une complétude arbitraire à partir d'un manifeste auto-déclaré, ou d'exclure sa purge prématurée. Emulator ne prouve ni l'inventaire réel de production, ni la fiabilité opérationnelle du vérificateur, ni la protection des secrets, ni l'absence de copies externes/exportées. La suppression Auth réelle, les règles déployées et les clients réellement en circulation nécessiteront des validations distinctes, jamais un accès production implicite dans cette phase.

## 8. Questions bloquantes à valider

1. **Autorité :** B avec approbation indépendante et writes soumis aux règles, A à garanties coopératives explicitement limitées, ou preuve nouvelle A par transfert de feuilles ? La recommandation B n'est pas une approbation.
2. **Mapping des absences :** autoriser précisément id=clé, pin absent→false et autres éventuels defaults techniques ? Quelles anciennes absences doivent rester bloquantes ? Aucun remplacement de dates ou de texte proposé.
3. **Histoires divergentes :** confirmer la conservation séparée de source courante, marqueur et copie éditée/supprimée ; définir les diagnostics résolubles sans réparation destructive automatique.
4. **Incompatibles et orphelins :** processus de résolution explicite ou format d'archive approuvé ? Aucun archivage/quarantaine inventé dans les règles ; tant que non résolu, gel conservé et NO-GO purge.
5. **Wire de migration :** version de bookMigration, clés/digests encodés, DTO brut→préparé, dépendances fan-out, phases de seal, reçus et approbation, limites et règles de correction après échec de vérification.
6. **Couverture historique :** inventaire autorisé des racines, priorités et formes réellement présentes ; politique de blocage si une branche hors liste apparaît. Les sept branches du code ne prouvent pas une exhaustivité de production.
7. **Exploitation B :** responsable, émission/révocation des identités, session ciblée, validation du vérificateur, durée de gel et support, reprise sans perdre la liaison au snapshot après purge partielle.
8. **Suppression :** approuver la purge terminale null-only au niveau utilisateur et la conservation minimale de la barrière externe ; vérifier que bootstrap/login, outils et futurs services respectent tous ce terminal.

## 9. Ordre d'implémentation recommandé après validation

1. Valider les décisions bloquantes et le niveau de garantie revendiqué ; maintenir production NO-GO.
2. Spécifier les DTO de source brute, préparation cible, provenance/dépendances, stockage de contrôle et seal ; conserver les six contrats, proposer séparément leurs extensions nécessaires.
3. Constituer des fixtures historiques exhaustives et oracles indépendants, y compris cas incompatibles et tombstones ; aucun accès réel nécessaire pour ces preuves locales.
4. Écrire des règles expérimentales isolées et les attaques directes P03/P06/P09/P10/P11/P12/P13 avant tout moteur ; démontrer l'absence de grant large et la priorité terminale.
5. Prouver les initialiseurs d'import fidèles, marqueurs/tombstones et fan-out, puis le vérificateur/approbation choisi et la purge reprise ; terminer les preuves P01–P18 applicables.
6. Faire une revue d'architecture de ces preuves. Seulement après accord, coder le moteur borné et sa reprise en conservant les mêmes oracles ; ne pas intégrer React ni activer la migration par ce seul accord technique.
7. Examiner séparément intégration applicative, inventaire autorisé réel, plan d'exploitation, règles et activation ; chaque autorisation de production reste à obtenir dans une phase dédiée.

## 10. Verdict

**GO pour soumettre cette conception à validation. NO-GO pour coder le moteur immédiatement.** Les primitives pures sont réutilisables, mais le passage de leurs enveloppes au stockage, la fidélité des transformations techniques et surtout l'autorité préalable à la purge restent à arrêter.

La proposition privilégiée est une migration scellée avec vérification indépendante ponctuelle, approbation ciblée et données écrites sous règles RTDB, suivie d'une purge contrôlée et de ready. Elle ne présume ni l'acceptation d'un outil privilégié par Dear Pages ni un déploiement futur. Cette phase s'arrête à ce rapport.

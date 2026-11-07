# Import historique et autorité de finalisation — Emulator uniquement

Projet fixé à `demo-dear-pages`, Auth `127.0.0.1:9099`, RTDB `127.0.0.1:9000`.
Le transformateur v1, les contrats import/migration, l'orchestration et le
vérificateur indépendant existants sont réutilisés. Aucun changement React,
création de rôle/claim Auth, déploiement ou accès production.

## Tests et configuration

Dépendances, Java 21, JAR RTDB et Firebase CLI déjà installés :

```sh
node experiments/historical-import/composeRules.mjs --check
CI=true NO_UPDATE_NOTIFIER=1 node experiments/historical-import/run.mjs
# Ou, si les Emulators locaux demo sont déjà actifs :
node experiments/historical-import/run.mjs --existing
```

Le runner ne transmet aucun projet/port/compte arbitraire. Il vérifie la
configuration dédiée, le hub demo et le refus de lecture anonyme. Les tests
chargent ce profil par le seul endpoint de règles local et restaurent le profil
précédent en fin de suite. Tous les comptes sont des fixtures `@example.test` ;
aucun effacement de compte ou de branches historiques n'est effectué.

## Import explicite existant

```js
const importer = createHistoricalImportService(localDatabase, {
  uid: fictionalOwnerUid, migrationId: 'stable-migration', transformVersion: 1,
})
await importer.begin()
await importer.resume({ maxUnits: 2 })
await importer.resume()
await importer.sealAndVerify()
```

- `begin` prépare puis gèle atomiquement l'identité, la barrière legacy et les
  liaisons source/plan ; la source est relue après gel.
- `resume` avance frozen→inventoried→planned→imported, initialise seulement les
  lifecycles absents en génération 1/creating et écrit chaque destination avec son
  reçu atomique. Les dépendances, payloads ET reçus sont vérifiés à chaque reprise.
- `sealAndVerify` compare indépendamment avant et après scellement. Un checkpoint
  déclaré complet ne constitue pas une preuve ; source/cible contradictoire bloque.
- Le `finalize()` du client reste un diagnostic sans écriture. Il n'accepte aucune
  preuve cliente et ne contacte pas automatiquement une autorité. Sa raison
  `verification-authority-unavailable` décrit ce contexte propriétaire dépourvu
  de capacité d'approbation ; la vraie opération serveur est distincte ci-dessous.

Les sept sources restent en place : library, bookNotes, bookNotesLegacy,
bookReviewsLegacy, bookRatings, bookRatingsLegacy, collections. Profils,
préférences et autres données ne sont ni recalculés ni déplacés. Sources
incompatibles/inconnues : refus sans réparation. Le journal et les reçus restent
présents ; aucun mécanisme de purge n'est ajouté.

## Autorité réellement utilisée

`finalize.server.mjs` est un outil Node contrôlé, sans endpoint HTTP ni import
possible depuis l'application cliente. Son privilège est l'accès administrateur
**natif d'Emulator** (`Bearer owner`), uniquement côté processus serveur. Il ne
simule pas un compte approbateur, ne crée pas de custom claims, ne distribue pas
une preuve signable par le propriétaire et ne possède aucun accès production.

L'exécution est manuelle et ciblée :

```sh
HISTORICAL_FINALIZATION_SERVER=true \
GCLOUD_PROJECT=demo-dear-pages \
FIREBASE_DATABASE_EMULATOR_HOST=127.0.0.1:9000 \
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
HISTORICAL_EMULATOR_ADMIN_TOKEN=owner \
node experiments/historical-import/finalize.server.mjs FICTITIOUS_UID stable-migration
```

Ces variables n'appartiennent jamais à Vite/React. Le constructeur et chaque
requête refusent une origine, un projet, un namespace, un environnement navigateur
ou une configuration différente. Le hub local est contrôlé ; l'identité Auth est
relue via **accounts:lookup**, opération de lecture, et doit être fictive/existante.
Les règles chargées doivent correspondre exactement au profil généré avant commit.
Aucun token, snapshot ou texte personnel n'est journalisé.

Séquence serveur :

1. Lire avec ETag **la racine exportée** de RTDB locale, incluant accountControl
   et users. Refuser une racine non versionnée ou de plus de 16 Mio.
2. Vérifier compte actif/legacyClosed, identité/version, phase scellée et toutes
   les sources/destinations/reçus avec `verify.mjs`, indépendant du transformateur.
   Refaire aussi la préparation existante pour vérifier la liaison source/plan.
3. Construire une attestation minimale : uid, migration/version, sourceVersion,
   planDigest, digest du snapshot initial, digest des reçus, finalizationId stable.
4. Faire **un seul PUT conditionnel `if-match` à la racine** : toutes les générations
   importées passent creating→active, l'attestation est enregistrée dans
   historicalFinalization et le protocole passe migrating→ready. Rien d'autre
   n'est modifié ; l'export conserve aussi les priorités des autres comptes.
5. HTTP 412 : tout relire et revérifier, sans réutiliser la preuve précédente.
   Quatre tentatives maximum ; compte devenu terminal, source/plan/génération
   incohérents ou profil inattendu : refus. Réseau/5xx après PUT : résultat incertain
   explicite ; le prochain appel réconcilie le résultat persistant.

**Pourquoi le CAS racine :** l'accès Admin contourne les règles. Un précheck ou
un CAS sous users/{uid} n'inclurait pas la barrière externe ; une suppression
concurrente pourrait alors être écrasée. Le CAS choisi couvre **ensemble** cette
barrière et les données. La course terminale est réellement testée avec un client
SDK qui change la barrière juste avant PUT : le commit perd son ETag et n'active rien.

Après succès, un réessai vérifie l'attestation immuable, les sources et les reçus,
puis retourne `already-finalized`, sans réactiver ni réimporter. Les modifications
et suppressions générationnelles ultérieures sont légitimes : la comparaison
initiale n'est pas rejouée contre leur contenu. Cela évite une résurrection après
suppression/réajout en génération 2.

## Permissions et usage générationnel

Les règles n'accordent **aucun droit d'approbation ou de promotion à ready** au
propriétaire. historicalFinalization est non inscriptible par SDK, y compris pour
copier une attestation correcte, la supprimer ou modifier un champ. Aucun grant
ancêtre général n'est ajouté. Le profil conserve le refus de purge utilisateur.

Les prédicats d'import restent typés, source-bound, creating/open/planned avec
compte actif avant/après ; ils sont fermés après seal/ready. Les règles CRUD
validées de faisabilité sont réutilisées après ready, avec une condition
supplémentaire d'attestation serveur liée au compte/plan. Schémas, CAS de champs,
tombstones, révisions, epochs, locks de suppression et gardes terminales restent
ceux du protocole existant. Les règles ne recalculent pas SHA-256 : cette
responsabilité appartient au programme serveur privilégié et au vérificateur.

La seule adaptation de service applicatif est dans
`generationApplicationService.requireReady()` : les sources historiques résiduelles
ne sont acceptées qu'avec le record serveur strict et ses liaisons identité/plan.
Sans ce record, le refus legacy-unmigrated reste inchangé. Les services continuent
à lire/écrire exclusivement le stockage générationnel, sans fallback. La sélection
React existante n'est pas modifiée et reste explicitement opt-in Emulator.

## Validation et limites de confiance

- **45 tests Emulator** : régression complète de l'import/refus client (33), puis
  autorité réelle, conservation des sept branches/profils/préférences/Auth,
  preuve non modifiable/copiable par les propriétaires, refus incomplet/non scellé/
  identité obsolète, concurrence serveur, perte d'ack, course terminale,
  préservation d'un autre compte modifié concurremment et de ses priorités,
  services bibliothèque/notes/évaluations/catalogue après activation, suppression
  et réajout sans résurrection, refus du mauvais profil de règles.
- Tests unitaires d'isolation existants et nouveau module de tests serveur :
  environnement/namespace/identité/bout navigateur refusés avant requête, DTO fermé,
  liaisons d'attestation, ETag obligatoire, erreur 5xx incertaine et aucune dépendance
  de l'autorité dans les entrées clientes. Le bundle généré ne contient pas les
  marqueurs du module serveur ni sa variable de privilège.
- Régression unitaire : **1 228 tests / 65 fichiers**. Lint ciblé propre ; lint global
  sans erreur, avec les 11 avertissements préexistants. Build réussi.

Le compte fictif peut désormais être utilisé en générationnel avec ses sept
branches historiques **intégralement conservées et gelées**. Aucun blocage
fonctionnel de finalisation ne subsiste dans ce périmètre démontré.

Ce privilège Emulator repose sur un **hôte et des ports locaux de confiance**.
Un autre processus doté de la capacité Admin native d'Emulator est déjà privilégié
et sort du modèle de client SDK ordinaire. Ce n'est ni une identité serveur signée
ni une solution de déploiement production. Le CAS global coûte des lectures et peut
entrer en conflit avec tout autre compte ; les bornes 16 Mio/4 tentatives sont
volontairement conservatrices. Le profil doit rester stable sous le contrôle de
l'opérateur pendant l'opération ; un administrateur de règles malveillant n'est
pas assimilé à un client ordinaire. Pas d'automatisation d'activation, de worker,
de réparation de conflits ni de purge. Firebase production reste **NO-GO**.

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
- Régression unitaire : **1 257 tests / 66 fichiers**. Lint ciblé propre ; lint global
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


## Préparation du raccordement à un futur serveur Firebase réel

Inspection ciblée : la configuration racine `firebase.json` ne contient que
Hosting ; aucune infrastructure Functions/Cloud Run, dépendance firebase-admin,
identité de service ou gestion de credentials serveur n'est implémentée dans le
dépôt. Le point d'entrée Node déjà validé est donc réutilisé, sans nouvelle
infrastructure ni dépendance.

La seule extraction est `finalizationCore.server.mjs`, contenant la même boucle
validée de vérification, liaison source/plan/destinations, CAS racine, activation,
attestation et réconciliation. Il ne contient ni URL Firebase, ni credential,
ni découverte ADC, ni initialisation SDK, ni appel réseau, ni route publique.
Sans capacité serveur fournie explicitement, sa construction est refusée ; un
rapport/jeton utilisateur n'est pas une telle capacité. Le module refuse aussi
un environnement navigateur. Les méthodes de capacité sont copiées et figées,
et l'autorisation est revérifiée avant le CAS.

`finalize.server.mjs` reste le **point d’entrée opérationnel Emulator** et conserve exactement
son API et sa CLI. Il fournit au noyau les opérations suivantes :

| Capacité interne serveur | Garantie attendue de l'adaptateur |
| --- | --- |
| `assertAuthorized` / `authorize` | Processus autorisé, principal serveur distinct, destination explicitement admise ; refus par défaut |
| `verifyAccountIdentity(uid)` | Relecture d'identité sans modification Auth ; aucune preuve client |
| `readRoot()` | Export complet de la racine commune users/accountControl, avec ETag |
| `assertWritePolicy()` | Contrôle explicite du profil de droits attendu avant commit |
| `compareAndSwapRoot(etag, root)` | Écriture conditionnelle du même périmètre ; conflit→relecture/revérification, résultat incertain explicite |
| `recordAuthority` | Identifiant de l'autorité effectivement autorisée par le contrat d'attestation |

Il s'agit de capacités internes d'un programme serveur de confiance, **pas**
d'une API RPC acceptant ces fonctions depuis un utilisateur. Le noyau ne crée
pas l'autorité et ne rend pas fiable un adaptateur arbitraire. L'adaptateur livré
reste figé sur les deux Emulators loopback, le projet demo et le privilège natif
Emulator ; ses contrôles de comptes fictifs, de règles et de redirects sont
inchangés. Une variable ressemblant à une activation production ou un chemin
GOOGLE_APPLICATION_CREDENTIALS ne déclenche ni découverte de credentials ni
requête réelle. Aucun adaptateur de production exécutable ou fallback n'est fourni.

Avant toute future exécution réelle, il manque uniquement le raccordement serveur
concret et son autorisation :

- Un environnement serveur privé et un principal IAM/service account distinct des
  utilisateurs, avec permissions et invocation opérateur explicitement validées.
  Aucun secret ne doit être fourni à React ni à une route accessible au propriétaire.
- Un adaptateur réel à destinations autorisées explicitement, réutilisant le même
  noyau et le même CAS couvrant la barrière externe ; validation du contrôle de
  règles, des bornes et de la contention globale. Ne pas remplacer le CAS par
  une simple mise à jour ou une transaction limitée à users/{uid}.
- Une extension explicite et testée du contrat/règles pour cette autorité réelle :
  le wire v1 actuel accepte seulement `emulator-root-cas-v1`. Le privilège local
  `owner` n'est pas une identité production et ne doit pas être transposé.

Ces raccordements ne sont ni implémentés, ni autorisés, ni testés sur Firebase réel
par cette tâche. Les 45 tests Emulator existants sont réutilisés sans recréer
l'import ; cinq tests ciblés ajoutent les refus sans autorité/dans un navigateur,
la capture non retargetable des capacités, la révocation avant CAS et l'absence
d'activation réelle/discovery de credentials. L'inspection des sources clientes
couvre désormais tous les fichiers JavaScript/TypeScript de src hors tests.
Les services, règles, contrats, React, configuration Firebase et données historiques
ne sont pas modifiés par cette extraction. Firebase production reste **NO-GO**.


## Adaptateur serveur préparé — aucune exécution réelle

`firebaseAdapter.server.mjs` fournit `createPreparedFirebaseFinalizationServer`.
Il construit les capacités du noyau existant ; il ne recopie ni la vérification,
ni le calcul d'attestation, ni l'activation, ni la boucle de reprise CAS.
Les primitives réseau existantes ont été extraites dans `firebaseRest.server.mjs`
et sont partagées avec l'adaptateur Emulator opérationnel : lookup Auth en lecture,
export racine avec ETag, lecture des règles, PUT racine avec if-match. Aucune
écriture Auth, suppression de sources ou modification React n'est ajoutée.

Interface interne minimale, pas une route HTTP :

```js
const server = createPreparedFirebaseFinalizationServer({
  environment: { mode: 'local-test', projectId: 'demo-dear-pages', namespace: 'demo-dear-pages' },
  authorizeInvocation,    // capacité du serveur hôte, jamais un champ JSON client
  getServiceCredential,  // fournisseur explicite, sans découverte ADC
  request,               // transport explicite ; pas de fallback sur fetch
  expectedRules,         // politique serveur capturée, pas une déclaration client
})
await server.finalize({ uid: fictionalUid, migrationId: stableId, transformVersion: 1 })
```

Garanties effectivement implémentées :

- Construction refusée sans les capacités explicites, dans un navigateur ou avec
  tout autre mode/projet/namespace. Les URLs sont encore **fixées sur loopback
  demo** ; aucun paramètre client ne peut les remplacer. Production reste bloquée,
  même avec un chemin GOOGLE_APPLICATION_CREDENTIALS dans l'environnement.
- `authorizeInvocation(scope)` doit renvoyer le canal private-job, le rôle
  migration-finalizer, un principal de service distinct du compte cible et de
  l'invocateur, ainsi qu'un scope exact : compte, migration/version, action,
  projet et namespace. Une autorisation réduite à approved:true ne suffit pas.
- `getServiceCredential(scope)` est appelé après autorisation. Son contrat est
  `{kind:'service', principal, accessToken}` ; le principal doit correspondre à
  la décision de l'hôte, un jeton utilisateur ou implicite est refusé. L'autorisation
  est revérifiée avant/après acquisition du jeton et avant chaque requête ; un
  changement de principal pendant l'opération est refusé.
- Ce sont des capacités **de code serveur de confiance**, pas des paramètres
  d'une future requête utilisateur. Un callback arbitraire fourni par l'utilisateur
  ne devient pas une autorité. Aucun endpoint public, émetteur IAM ou credential
  réel n'est créé par cette préparation.
- Les tokens sont passés uniquement en Authorization côté serveur, jamais en URL,
  dans l'attestation ou dans les logs. Les redirects sont refusés. Un CAS sans
  ETag ou avec wildcard est refusé avant acquisition de credential/réseau.
- Le noyau et le vérificateur inchangés restent responsables de la complétude, de
  la liaison aux observations scellées et de la priorité de la barrière compte.
  Le contrat d'attestation et les règles actuels restent inchangés : seul le
  record serveur `emulator-root-cas-v1` est accepté, jamais une preuve cliente.

Validation locale : **24 nouveaux tests avec doubles locaux** couvrent le chemin
complet sur les sept branches, profils/préférences et autres comptes conservés,
les refus d'invocation/projet/credentials, la révocation, les conflits CAS,
le compte terminal, la perte d'ack/reprise et les règles inattendues. Les **45 tests
Emulator existants** valident l'adaptateur opérationnel après mutualisation REST.
La régression compte **1 257 tests, 66 fichiers**. Lint ciblé propre, lint global
sans erreur et 11 avertissements préexistants ; build et vérification d'absence
des modules/variables serveur dans le bundle navigateur réussis.

### Décisions encore bloquantes pour Firebase réel

Les décisions de doubles locaux **ne prouvent pas une identité IAM**. Avant tout
raccordement réel, il faut désigner et implémenter la vérification authentique
côté hôte de l'invocateur privé et du principal de service, avec permissions,
source de credentials, durée/révocation et périmètres approuvés. Les chaînes
servicePrincipal et le champ kind:'service' sont ici un contrat interne testé,
pas une validation cryptographique de token. Ils ne doivent pas être acceptés
comme des revendications d'un body HTTP.

Il faut aussi approuver le privilège Firebase nécessaire au **CAS à la racine
commune** couvrant users et accountControl, le contrôle réel de la politique de
règles et le périmètre projet/base explicitement autorisé. Un accès Admin contourne
les règles : supprimer le CAS racine ou se fier à un simple précheck affaiblirait
la barrière terminale et n'est pas une option silencieuse de l'adaptateur.

Enfin, l'autorité réelle doit obtenir un identifiant/version d'attestation reconnu
explicitement par le contrat et les règles. Ne pas la faire passer pour
emulator-root-cas-v1 et ne pas créer un grant propriétaire pour approved:true.
Aucune de ces décisions n'est contournée ici : l'adaptateur reste volontairement
non exécutable sur Firebase réel, aucune connexion/credential IAM/déploiement
n'a été effectué et Firebase production reste strictement **NO-GO**.

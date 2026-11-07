# Import historique contrôlé — Emulator uniquement

Expérience isolée sur `demo-dear-pages`, Auth `127.0.0.1:9099` et RTDB
`127.0.0.1:9000`. Elle réutilise le transformateur v1, les contrats import/migration,
le garde de connexion du lifecycle et la composition de faisabilité existants.
Aucun service validé, contrat, composant React ou profil de règles existant n'est
modifié. Firebase production reste strictement **NO-GO**.

## Exécution

Avec les dépendances, Java 21, le JAR RTDB et Firebase CLI déjà installés :

```sh
node experiments/historical-import/composeRules.mjs --check
CI=true NO_UPDATE_NOTIFIER=1 node experiments/historical-import/run.mjs
```

Si les Emulators sont déjà actifs :

```sh
node experiments/historical-import/run.mjs --existing
```

Le runner n'accepte aucun projet, port, chemin de données ou compte en argument.
Il vérifie la configuration dédiée, le hub demo et le refus de lecture anonyme.
`--existing` ne lance pas Firebase CLI. Les tests chargent le profil local par
l'endpoint de configuration Emulator et restaurent les règles précédentes dans
`afterAll`. Cette capacité privilégiée ne sert qu'aux règles, jamais aux données.
Les fixtures et toutes les attaques utilisent de vrais clients SDK propriétaires
ordinaires et des utilisateurs Auth neufs `@example.test`. Aucun effacement ni
réemploi de compte existant, aucun export. Les fixtures restent dans cet Emulator.
Les garanties de règles ci-dessous s'appliquent quand ce profil isolé est chargé ;
il n'est ni déployé ni substitué durablement aux profils existants.

## API explicite

```js
const importer = createHistoricalImportService(localDatabase, {
  uid: fictionalOwnerUid, migrationId: 'stable-migration', transformVersion: 1,
})
await importer.begin()
await importer.resume({ maxUnits: 2 }) // interruption contrôlée facultative
await importer.resume()                // même identité, relecture serveur
const report = await importer.sealAndVerify()
const attempt = await importer.finalize() // refus explicite tant que l'autorité manque
```

La construction et chaque opération vérifient les deux connexions SDK Emulator,
le projet/namespace, l'absence d'accès Admin et le propriétaire fictif connecté.
Le compte doit déjà avoir une barrière active/open ; aucune création Auth,
initialisation implicite de compte, résolution de conflit ou reprise automatique
vers une autre identité n'est fournie. Les seules opérations sont :

1. `begin` : préparer localement ; geler atomiquement protocole `migrating`,
   identité, barrière legacy et liaison source/plan. Relire et vérifier la source
   après le gel. Une source modifiée entre préparation et gel bloque l'import.
2. `resume` : avancer `frozen → inventoried → planned → imported` ; initialiser
   uniquement les lifecycles absents en génération 1, état `creating` ; importer
   chaque record avec son reçu atomique, en respectant les dépendances. Une
   destination déjà présente n'est acceptée qu'avec payload ET reçu exacts.
   Toute autre valeur bloque, sans écrasement. Les checkpoints contractuels
   retournés reconstruisent les unités effectivement observées depuis les reçus.
3. `sealAndVerify` : refuser une importation partielle ; comparer indépendamment
   avant scellement, fermer toutes les écritures d'import, relire l'état scellé,
   vérifier à nouveau. Un appel après interruption/rejeu reste réconciliable.
4. `finalize` : tentative explicite, en lecture seule. Relire la barrière active,
   l'identité, les liaisons source/plan et les destinations scellées ; réexécuter
   le vérificateur indépendant. Refuser toute preuve fournie par le client. Un
   import complet retourne `blocked / verification-authority-unavailable` ; une
   source/cible contradictoire ou incomplète reste bloquée. Aucun champ ni état
   n'est modifié, même lors d'un réessai concurrent ou après une interruption.

Les identifiants, versions, sourceVersion et planDigest sont immuables. Les reçus
ont une clé SHA-256 du unitId contractuel, et contiennent unitId + digest du payload,
avec domaines versionnés distincts. Ils ne sont pas le ring borné des batches CRUD.
Ils ne prouvent rien seuls : chaque reprise relit et compare les destinations.
Le journal persiste dans cette migration non finalisée ; aucune purge n'existe.

## Modification minimale des autorisations

Le test témoin montre les refus sous les règles de faisabilité non modifiées :
pas d'initialisation lifecycle ni d'import pendant `migrating` ; prédicats CRUD
incompatibles avec les anciens timestamps/tombstones/conversions éditées.
`composeRules.mjs` dérive donc un profil **distinct**, sans élargir ces profils :

- Sources historiques modifiables uniquement avant gel ; aucun delete ni write
  après gel, y compris dans un multipath de freeze ou de changement d'état.
- Initialisation lifecycle absente→`creating`, génération 1 seulement ; aucun
  reset, passage `active`, réajout ou suppression autorisé par l'expérience.
- Grants par record typé, source existante, phase open/planned, compte actif
  avant/après. Champs historiques scalaires identiques, absence comprise ;
  validations de type/HTML/date existantes réutilisées. Les prédicats d'import
  distincts admettent les anciens timestamps, révisions et tombstones exacts.
- Métadonnées techniques initiales fermées, dépendances de marqueurs réservés,
  catalogue/epoch et memberships contrôlées. Champs inconnus et priorités refusés.
- Sources et cibles restent immuables après scellement. Les suppressions sont
  dans les refus `.write`, pas seulement dans des validations ignorées sur null.
- Aucun grant utilisateur/génération/catalogue ancêtre, aucune purge terminale
  de l'utilisateur dans ce profil, aucune approbation ou transition `ready`.

Les règles ne calculent pas SHA-256 et ne parcourent pas des listes arbitraires.
Un hash technique de forme correcte mais faux, ou une liste source partiellement
recopiée, peut être provisoirement stocké par un SDK hostile ; ces cas échouent
à la reprise et à la vérification indépendante, ne permettent ni approbation ni
ready, et ne détruisent aucune source. Un champ de progression forgé ne change
pas cette garantie. Ces limites sont testées, pas présentées comme des preuves
cryptographiques réalisées par les règles.

## Vérificateur indépendant

`verify.mjs` ne dépend ni du transformateur, ni des services ou du SDK Firebase
(test du graphe d'import). Il recalcule directement les valeurs attendues depuis
les sept branches brutes gelées et reconstruit séparément les métadonnées
techniques, avec SHA-256 Node plutôt que les destinations du transformateur.
Il vérifie les marqueurs, toutes les unités, les reçus et l'absence de cibles en
excès. La représentation RTDB `[null, génération1]` n'est traitée que pour le
conteneur de générations créé par le protocole ; aucune liste historique n'est
compactée ou convertie.

Le service fournit les observations REST sans cache, avec `format=export` pour
ne pas ignorer des priorités, sous le contrôle propriétaire avant/après. Un
rapport pur fourni hors de ce chemin n'est pas une observation serveur fiable.
Aucune validation `verified`/`approved` n'est persistée ni autorisée. Le résultat
positif est **`verified-unfinalized`, `canApprove:false`, `canReady:false`** :
comparaison locale indépendante, pas attestation d'une autorité d'exploitation.

## Validation et blocage final

- **33 tests Emulator** : sept branches fidèles, notes multiples/copies éditées
  ou supprimées, ratings révisés/tombstones, Collections vides/liens multiples,
  conservation brute/profile/préférences/Auth, interruptions/rejeux/perte d'ack,
  gel et import concurrents, écriture hors ligne obsolète, conflits, faux
  contenus/hashes/checkpoints, import incomplet, priorité/champ inconnu,
  barrière terminale, isolation et refus ready/activation/approbation. Les dix
  scénarios supplémentaires de finalisation couvrent le refus de confiance pour
  un import complet, les preuves clientes falsifiées/périmées/d'autre compte ou
  migration/rejouées, la concurrence et l'interruption, les reçus en excès, la
  façade fermée et l'absence de résurrection.
- **18 tests unitaires d'isolation** : projets/connexions/namespace/Auth/Admin
  refusés avant ref/réseau, changements après construction/token et indépendance
  du vérificateur, refus des preuves clientes sans les lire et garde Emulator
  revérifié sur la tentative de finalisation.
- Régression : **1 216 tests unitaires, 64 fichiers, réussis**.
- Lint ciblé propre ; lint global : 11 avertissements préexistants, aucune erreur.
  Build réussi. Compositions faisabilité et intégration existantes inchangées.

Les sept branches historiques sont conservées, les comptes Auth/profils/
préférences sont intacts, les livres restent `creating`, le protocole reste
`migrating`. Le protocole applicatif existant exige l'absence des anciennes
branches pour ready : elles ne seront pas supprimées pour satisfaire cette
condition. L'activation demeure donc **bloquée intentionnellement**. Aucune
approbation de production, autorité privilégiée, finalisation, réparation de
migration scellée contradictoire ou politique de nettoyage n'est introduite.


## Finalisation : blocage de confiance confirmé

Conditions exactes, distinctes :

- Dans ce profil d'import, le grant lifecycle exige `!data.exists()` et ne crée
  que `creating`. Le grant protocole exige un nœud absent et ne crée que
  `migrating`. Aucune transition de finalisation n'est autorisée.
- Dans le profil de faisabilité réutilisé, les opérations lifecycle ordinaires
  exigent `ready` ; la transition protocole vers ready exige l'absence des sept
  anciennes racines. Ces conditions ne permettent donc pas leur coexistence.
- `generationApplicationService.requireReady()` refuse aussi les anciennes
  racines (`legacy-unmigrated`), indépendamment de la permission RTDB. Modifier
  les seules règles ne rendrait pas ce compte utilisable par la façade.

Le vérificateur existant est indépendant du transformateur, mais ses observations
et son exécution utilisent le propriétaire. Aucun principal d'approbation distinct,
aucune émission de claims de rôle/cible/migration et aucune approbation signée
vérifiable par les règles ne sont disponibles dans ce mécanisme. Les champs de
checkpoint, hashes et rapports clients ne constituent pas cette autorité.

`finalize()` n'accepte donc aucun argument et ne persiste jamais son résultat.
Il lie son diagnostic au contexte capturé et aux versions source/plan recalculées,
puis vérifie le contenu réel observé sous le seal. Le diagnostic ne peut pas être
présenté à un autre appel comme une approbation. Les règles existantes continuent
à refuser les approbations fabriquées, activations et passages ready, y compris
un multipath réunissant ces opérations.

La clause de repli demandée est appliquée : seules ces protections vérifiables
sont implémentées. Aucun approbateur fictif, clé auto-émise, claim fabriqué ni
write Admin de finalisation n'est introduit. Les règles ne sont pas assouplies.
La finalisation positive authentifiée et le fonctionnement après activation ne
sont **pas réalisés ni prétendus testés** : ils restent bloqués par cette absence
d'autorité et, pour l'utilisation via la façade, par son refus du résidu legacy.
La non-résurrection est testée sur les tentatives refusées et les rejeux SDK ;
elle n'est pas présentée comme un test de suppression après activation.

Le prochain changement de permissions devrait consommer une approbation issue
d'une autorité distincte réellement authentifiée et liée au seal, sans contourner
la barrière de compte ; cette autorité n'est pas créée par cette tâche. Aucun
bypass du refus legacy de la façade n'est ajouté en attendant. Les sept racines,
profils, préférences, identités Auth et autres données existantes restent intacts.

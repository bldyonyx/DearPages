# Préparation historique pure — transformVersion 1

`src/utils/historicalGenerationTransformer.js` ajoute uniquement la préparation
locale décrite dans `MIGRATION_STORAGE_AUTHORIZATION.md`. Aucun service, contrat
existant, règle, compte, composant React ou mécanisme réseau n'est modifié.

## API et portée

```js
const result = await transformHistoricalSnapshot(rawUserValue, {
  uid: 'owner', migrationId: 'explicit-stable-id', transformVersion: 1,
})
```

`rawUserValue` est la valeur brute complète sous `users/{uid}`, non un objet de
service/d'affichage ni un `DataSnapshot`. `null` signifie nœud absent. Les objets
JSON ordinaires sont capturés avant le premier `await`, sans modifier ni geler
l'entrée. Les sept racines inventoriées sont `library`, `bookNotes`,
`bookNotesLegacy`, `bookReviewsLegacy`, `bookRatings`, `bookRatingsLegacy` et
`collections`. Une racine absente reste absente ; une racine explicitement nulle,
scalaire ou tableau n'est pas normalisée en map vide.

`profile` et `preferences` sont copiés sans validation métier dans `retained`,
avec leur chemin inchangé. Ils ne sont ni importés ni inclus dans le digest du
contenu livres. Toute autre racine, y compris un état générationnel préexistant,
est bloquante : pas de fusion ou de réinitialisation implicite.

## Sortie

- `status: 'prepared'` : compatibilité structurelle locale seulement. `plan`
  réutilise `createMigrationPlan` ; chaque destination contient une enveloppe
  `createGenerationImport` de profil `generation`.
- `status: 'blocked'` : `plan: null`, `destinations: []`. Les diagnostics portent
  le diagnostic contractuel bloquant, le chemin, les segments source exacts,
  le type observé et une raison. Les segments font autorité si une clé invalide
  contient un séparateur. Les anomalies de plusieurs records sont cumulées.
- `source` : copie brute immuable pour comprendre les incompatibilités métier.
  Si la structure elle-même est inadmissible (getter, cycle, clé interdite,
  priorité/export, tableau troué…), `source` et `sourceVersion` valent `null` :
  aucun snapshot filtré n'est présenté comme fidèle. L'entrée originale reste
  intacte ; les diagnostics indiquent où l'inspecter, sans exécuter les getters.
- Chaque destination expose `historical`, `technical`, son chemin, ses segments
  source et ses dépendances par `unitId`. Pour une membership, `historical` vaut
  exactement `true`, devenu `payload.present` ; epoch/révision sont techniques.
  Pour un catalogue, `historical` contient les métadonnées, les relations étant
  représentées séparément. Une Collection sans relation reste au catalogue.
- `books` décrit les contextes génération 1 qui nécessiteront une initialisation
  lifecycle séparément éprouvée. Aucun état lifecycle n'est choisi ni écrit.

Les sources scalaires note/review/rating restent dans l'unique import library :
pas de writer `historicalSources` supplémentaire, de conversion automatique ou
de création d'une copie absente. Les marqueurs et les copies éditées restent
indépendants. Les tombstones/révisions d'évaluation sont conservés exactement.
Le stockage historique de notes n'a pas de tombstones persistés : une telle
forme est bloquée, pas interprétée comme un record générationnel.

## Métadonnées et déterminisme

Les ajouts sont ceux décrits dans le mapping : `creation` et `fieldRevisions`
initiales pour les notes, `intent` pour les marqueurs note/review, `creation`,
`membershipEpoch`, `revision` et `fieldRevisions` pour le catalogue ; epoch et
révision initiales pour les appartenances. Le marqueur rating n'a aucun ajout.
Une copie note/review réservée partage le `creation` de l'`intent` de son marqueur
et dépend de son unité. Aucune date personnelle n'est générée.

Les digests locaux utilisent Web Crypto SHA-256, UTF-8 de la sérialisation JSON
canonique contractuelle du tuple :

```
['dear-pages/historical-transform', 1, domaine, valeur]
```

Pour `source`, valeur = les sept branches présentes, sans profil/préférences.
Pour `technical-identity`, valeur = `{migration, sourcePath, payload}` du record
source (celui du marqueur pour une copie réservée). L'ordre des clés ne compte
pas, celui des listes compte. Identité de migration ou contenu différents peuvent
donner des métadonnées différentes ; reprendre exige le même contexte/source.
Ces digests ne sont pas les anciens jetons UTF-16LE, les jetons CRUD UTF-8 ou une
preuve serveur. L'API nécessite Web Crypto ; une indisponibilité est une erreur
d'exécution, jamais une permission de continuer avec un hash fictif.

## Blocages sans réparation

Champs inconnus ou requis absents (dont id, dates, pin et métadonnées Collection),
id contradictoire, HTML/date/type/révision non admissibles, orphelins, relation
autre que `true`, copie réservée sans marqueur, marqueur contradictoire, source
courante divergente du marqueur, représentation numérique non approuvée, priorité
ou clé non admissible : aucun défaut implicite, trim, sanitisation, renommage,
compactage ou nouvelle date. Une source absente et un marqueur note/review vide
restent représentables sans matérialiser un champ vide. Les sources divergentes
sont conservées dans `source` mais restent bloquantes tant que leur politique
n'est pas approuvée. Une suppression physique passée n'est pas reconstructible.

## Limites avant tout import Emulator

`prepared` ne signifie ni approuvé, ni vérifié, ni `ready`, ni terminé. Le module
ne découvre pas les sources, ne prouve pas leur exhaustivité réelle, ne gèle rien
et ne produit aucun multipath Firebase. Une projection déjà amputée ne peut pas
être détectée par ce transformateur seul.

Restent à spécifier/éprouver selon le document d'autorisation existant : stockage
et reprise, règles d'initialisation/import, preuve de conservation sur état
scellé, autorité d'approbation et traitement des incompatibilités. Aucun de ces
choix n'est autorisé par ce module. Aucune purge n'est proposée ou implémentée.
Firebase production reste strictement **NO-GO**.

# 8B.4.2.2 — Contrats purs et limites d'intégration

Point de départ : branche `feature/multiple-book-notes`, HEAD
`001e7434ef56d9a56235428dc7b7d98fd8041947`, working tree propre. Ce commit
versionne les 14 fichiers de faisabilité précédents ; aucun écart inattendu.

Les six nouveaux modules sous `src/utils` n'importent ni Firebase, ni un service,
ni DOMPurify. Aucun accès réseau, horloge, génération aléatoire ou calcul de hash
asynchrone n'est effectué. Les empreintes sont des valeurs explicites fournies.
Les sorties sont des copies profondément figées ; les entrées ne sont pas figées
à la place de leur propriétaire. Les getters, symboles, champs cachés, prototypes
non ordinaires, cycles et valeurs non JSON sont refusés avant sérialisation.

## Modules et responsabilités

| Module | Contrats principaux |
| --- | --- |
| `generationContractData.js` | Copie sûre, comparaison canonique, immutabilité profonde, bornes, timestamps, discriminants, empreintes |
| `generationMigrationContracts.js` | Identité/version, unités, diagnostics, plan, checkpoints, transitions, readiness et réconciliation |
| `generationImportContracts.js` | Enveloppes distinctes du CRUD pour neuf types d'import, profils legacy/generation, validation fidèle et réconciliation |
| `generationMembershipBatchContracts.js` | Sélection, gardes, canonisation initiale, enveloppe, résultats attendus, séquences, slots, reçus, éviction et purge |
| `generationCollectionActivityContracts.js` | Activité, effets métier purs et tri déterministe |
| `generationRecoveryContracts.js` | Lifecycles, découverte, intentions de reprise, compte terminal et ordre RTDB/Auth |

Les lecteurs existants `contractRecord`, `contractArray`, les contextes livres,
les contextes/catalogues de Collections, le modèle de bibliothèque et les dates
civiles sont réutilisés sans modification. Les validateurs d'import HTML restent
structurels, alignés sur la grammaire RTDB ; ils ne doivent pas importer le
sanitizer DOM, qui transformerait les sources selon l'environnement.

## Migration : identité et progression

Une identité figée est `{uid, migrationId, transformVersion}`. Une unité porte
`{migration, kind, scope, unitId}`. L'identifiant d'unité est une sérialisation
canonique non ambiguë de ces valeurs. C'est une VALEUR d'identité, pas une clé
RTDB prête à écrire : encodage/indexation/hachage de stockage restent à définir.

Transitions : `absent -> migrating -> ready` uniquement. La fermeture legacy
est explicite et monotone. Une intention d'une autre migration/version devient
périmée ; elle n'est jamais redirigée.

Checkpoints : `frozen`, `inventoried`, `planned`, `imported`, `verified`, `purging`,
`complete`. Même étape ou étape suivante seulement ; aucune unité confirmée ne
disparaît. Les ensembles d'unités sont triés et dédupliqués par refus des doublons.

Un plan fige identité, empreinte source fournie, unités et diagnostics. Une
anomalie reste bloquante ; aucune option de suppression, réparation ou renoncement
implicite n'existe. Les diagnostics portent un code et un nom de champ, jamais
le contenu fautif. Une identité de livre invalide peut utiliser un diagnostic
sans unité, en conservant la source hors de ces DTO.

`assertSameMigrationPlan` interdit de remplacer un plan/source lors d'un réessai.
`assertMigrationReady` exige un plan non bloqué, toutes les mêmes unités au
checkpoint complete et des faits serveur explicitement fournis : compte actif,
legacy fermé et purgé. Il ne constitue PAS une attestation serveur de complétude.

## Import fidèle, séparé des opérations ordinaires

`createGenerationImport` produit :

```js
{ type: 'migration.import', migration, unit, profile, context, entryId, payload }
```

Types : bibliothèque, note, évaluation, sources historiques, marqueur note,
marqueur avis, marqueur évaluation, Collection et appartenance.

* Le contexte de livre cible la génération initiale 1 ; aucun réajout n'est
  choisi implicitement. Le contexte propriétaire doit correspondre à la migration.
* Le profil legacy conserve le schéma source : par exemple une note sans
  `creation`/`fieldRevisions`, ou un marqueur sans `intent`, reste exactement ainsi.
* Le profil generation valide les métadonnées déjà présentes, leurs révisions,
  epochs, pins, dates et tombstones. Il ne les réinitialise pas.
* Une Collection legacy conserve son map de livres valides, y compris vide.
  Une appartenance générationnelle doit fournir explicitement epoch et révision ;
  un booléen historique seul n'est pas transformé automatiquement.
* `null` ou tableau vide que le modèle de bibliothèque normaliserait en absence
  provoque un refus d'import explicite, pas une perte silencieuse.
* Aucun trim, défaut d'icône, date actuelle, push ID, conversion HTML, création de
  copie historique ou reconstruction de tombstone n'est appliqué.
* Un marqueur traité peut être importé sans recréer sa copie absente/supprimée.
  Les cohérences entre branches (source modifiée, destination réservée, orphelin)
  restent des diagnostics du futur planificateur, pas une conversion cachée.

Ces enveloppes NE SONT PAS des maps d'écriture acceptées par les règles CRUD
actuelles. L'adaptation des profils historiques au stockage cible et les règles
d'import nécessitent les sous-phases ultérieures. Aucun contrat validé existant
n'est modifié pour contourner cette séparation.

## Batch, observation et réessai

Entrée recommandée : `captureMembershipSelection` avec contextes livre/Collection
figés, identité catalogue, avant-état brut et présence souhaitée. La construction
initiale trie les tuples par ordre déterministe et refuse les doublons ou des
identités contradictoires du même livre/catalogue.

La forme wire reste celle de la preuve : `{uid, sequence, intent, guards, entries,
activity?}`, 32 slots de garde dont les inutilisés sont désactivés. Les gardes
absentes, inchangées et d'ancien epoch restent distinctes. Les révisions changent
seulement lors d'une mutation effective ; un nouvel epoch commence explicitement
à 1. Une activité n'est déclarée que pour les changements effectifs.

Une enveloppe de réessai doit être profondément figée et canonique.
`assertSameMembershipBatchIntent` refuse toute nouvelle séquence, génération,
epoch, précondition, présence ou identité d'intention sur cet ancien travail.
La validation ne réordonne/répare jamais une enveloppe de réessai.

Pour les OBSERVATIONS uniquement, les maps numériques que RTDB représente en
tableaux sont adaptées à leurs emplacements connus : guards, entries, activity,
journal. Les nulls de slots absents ne deviennent pas des lignes applicatives.
Chaque entrée réelle est ensuite comparée à une enveloppe reconstruite complète.
Cette adaptation wire ne s'applique pas aux payloads d'import.

Une validation de sélection est observationnelle. La fraîcheur atomique reste
imposée au commit par les règles, pas démontrée par deux objets JavaScript égaux.

## Séquences, reçus et purge

Limites conservées : 32 gardes, 128 Kio côté client, 64 slots, compteur maximal
2147483647. La séquence suivante est déterministe ; son épuisement est terminal
pour cette allocation, sans remise à zéro. Slot = séquence modulo 64.

Réconciliation d'un reçu fourni :

| Résultat | Sens | Renvoi autorisé par ce résultat |
| --- | --- | --- |
| confirmed | Reçu original identique présent | Non, déjà confirmé |
| conflict | Séquence occupée/demande incohérente | Non |
| indeterminate | Séquence passée, preuve absente/évincée | Non |
| uncertain | Preuve serveur indisponible | Non |
| not-committed | Serveur observé avant la prochaine séquence capturée | Même enveloppe seulement, sous règles |

Un reçu confirme un commit antérieur, pas la persistance actuelle de ses effets.
Les projections de journal contrôlent slots, propriétaires, séquences et identité
de la tête. La purge d'un livre exige son contexte deleting capturé, vide TOUT le
journal et conserve la tête/séquence. Les preuves d'autres livres peuvent devenir
indéterminées : ce compromis n'est pas remplacé par une autre architecture.

## Activité, suppressions et compte

Tri : pins d'abord, puis maximum de la date de métadonnées et de l'activité
d'appartenance, puis identifiant avec comparaison déterministe sans locale.
Clear conserve l'activité ; metadata/pin n'inventent pas d'activité d'appartenance ;
delete retire la projection. Une activité d'une autre identité catalogue est refusée.
Les effets sont des projections, pas des autorisations de suppression de branche.

La découverte distingue `resume-deletion` de `review-creation`. Une création
nécessite une décision explicite : reprise ou abandon. Aucune horloge/expiration
ne déclenche activation ou suppression. L'empreinte `initializationId` est une
valeur de comparaison fournie par le futur adaptateur ; ce n'est pas un nouveau
champ à écrire dans les bibliothèques déjà validées.

La suppression du compte domine les opérations ordinaires et reprises livre.
Ordre projeté : verrou terminal externe, purge utilisateur, finalisation de la
barrière RTDB, suppression Auth. Un Auth encore présent après purge ne réactive
pas le compte. Un état contradictoire est signalé ; aucune réparation automatique.
`hasBookData` désigne la présence dans le sous-arbre du livre entier, nécessaire
pour refuser de confirmer une purge laissant une ancienne génération.

## Compatibilité et validation

Le helper SDK de l'expérience délègue UNIQUEMENT sa construction de batch au
nouveau constructeur pur. Le code d'allocation dupliqué est retiré. Ses gardes
de connexion, lectures, écritures et attaques SDK restent inchangées. Aucun service
sous `src/services`, composant React ou fichier de règles n'est raccordé/modifié.

La canonisation initiale peut changer l'ordre des slots par rapport à l'ancien
helper, sans changer le contenu de la sélection. Les règles expérimentales
acceptent cet ordre, et les enveloppes capturées ne sont pas modifiées au retry.

Tests ciblés : 152 nouveaux tests, dont immutabilité, getters/coercitions,
__proto__, dates, révisions, sources, marqueurs, tombstones, reçus disparus,
comptes terminaux et import graph sans SDK/DOM.

| Validation exécutée | Résultat |
| --- | --- |
| Nouveaux tests purs | 152/152, 4 fichiers |
| Suite unitaire complète | 1090/1090, 60 fichiers |
| Faisabilité avec constructeur pur | 91/91 |
| Frontière des compteurs | 1/1 |
| Intégration générationnelle | 69/69 |
| Appartenances / catalogue | 48/48 et 51/51 |
| Lifecycle service / prototype | 41/41 et 36/36 |
| Bibliothèque / notes / évaluations | 50/50, 34/34 et 40/40 |
| RTDB historique | 129/129 |
| Lint ciblé | Aucun diagnostic |
| Lint global | 11 avertissements existants, aucune erreur |
| Build | Réussi |
| Compositions des règles | Expérimentale et intégrée vérifiées |
| Git / espaces | Seuls les nouveaux contrats/tests, ce document et le helper expérimental ; pas de modification de service/règle/composant validé |

Le lanceur Emulator termine avec code 0 et arrête proprement ses processus.
Les 590 tests Emulator restent verts, y compris les attaques SDK directes. Le
batch de 32 lignes conserve la mesure de 7 825 octets et 66 chemins d'écriture.
Les profils d'import et les DTO de reprise/migration sont validés unitairement ;
leurs futures autorisations serveur ne sont pas démontrées par ces résultats.

## Points encore ouverts avant intégration

* Stockage/encodage des identités d'unité et calcul fiable des empreintes.
* Autorisations d'import et vérification des dépendances entre branches.
* Transport garantissant que source=server représente réellement une lecture
  serveur. Un discriminant fourni n'est pas une preuve d'authenticité.
* Coût du snapshot de réconciliation, contention et rétention des reçus.
* Politiques finales de confidentialité, nettoyage des résidus et conservation
  minimale de la barrière terminale.

GO pour revue et préparation de la prochaine sous-phase après validation explicite.
Aucune migration, activation production ou phase suivante n'est exécutée ici.

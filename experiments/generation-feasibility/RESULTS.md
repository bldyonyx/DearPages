# Résultats — 8B.4.2.1a, 3 novembre 2026

## Verdict actuel

**GO pour les quatre mécanismes dans le périmètre Emulator démontré.**
**Firebase production reste NO-GO.** Aucun moteur de migration, raccordement
React ou changement des services validés n'est inclus.

La suite initiale de 53 cas est verte. Elle est complétée par 38 cas ciblés :
12 tailles progressives, 5 identifiants valides, 16 identifiants interdits et
5 attaques sur les champs inconnus. Total : **91/91**, plus **1/1** pour le
profil de frontière des compteurs. Les résultats ne prouvent pas toutes les
interleavings possibles ni une migration fidèle de données réelles.

## État Git et périmètre

Branche : `feature/multiple-book-notes`.
HEAD initial/final attendu et vérifié :
`ce03e0e124adbe72e201aa223b96b93b98d5c0a1`.
À l'entrée : uniquement les 12 fichiers non versionnés de l'expérience.
Les changements de cette reprise restent dans `experiments/generation-feasibility`.
Aucun fichier existant versionné hors expérience n'a été modifié.
Aucun commit, push, merge, déploiement ou accès Firebase production.

## Causes exactes des quatre échecs initiaux

### 1. Enveloppe différente / séquence occupée

Le refus initial pouvait intervenir AVANT le scénario de conflit, pendant le
commit légitime initial. Son identifiant par défaut dépendait du numéro de test.
Le cas est maintenant reproduit avec `intent-37` indépendamment de cet ordre.

Le simulateur de règles du Database Emulator, appelé avec une identité propriétaire
non admin, identifie précisément les validations refusées :
`batchHead/intent` et `batchReceipts/1/intent`.

Le générateur produisait du texte d'échappement Unicode dans la regex de clé,
au lieu des caractères de contrôle attendus par le parseur RTDB. Il rejetait
notamment `7` et `f` dans des identifiants pourtant valides. La correction émet
les caractères correspondants, ensuite encodés par JSON.stringify, comme dans
la politique catalogue validée. Les autres contraintes de clé sont conservées.

Après correction : commit initial accepté, enveloppe différente en conflit,
réessai identique confirmé sans écriture et rejeu SDK direct refusé. Un refus
légitime de séquence n'a pas été transformé en succès.

### 2. Éviction après 65 commits

La trace situe l'échec au commit 1, sur l'intention `first`, dont le `f` était
refusé par la même regex. Il ne s'agissait pas d'une erreur de modulo, d'éviction
ou de remplacement de reçu.

Après correction : séquences 1 à 65 acceptées ; 64 reçus conservés ; slot 0 à la
séquence 64, slot 1 à la séquence 65, slots 2 à 63 à leurs séquences respectives.
Le premier reçu est évincé. La réconciliation de l'ancienne intention retourne
`indeterminate`, l'API refuse de la renvoyer et le SDK direct ne peut pas la rejouer.
Les 64 no-op supplémentaires ne changent ni la révision d'appartenance ni l'activité.

### 3. Batch de 32 lignes

Le simulateur identifie `batchReceipts/1/guards/7/collectionId` : la valeur `c7`
était rejetée par la même regex. Le multipath et la taille n'étaient pas la cause.

Avant correction, la campagne dans l'ordre complet donnait : tailles 1, 2, 4,
5 et 6 acceptées, puis 7, 8, 12, 16, 24, 31 et 32 refusées. Ce n'était pas une
frontière moteur : le nom d'intention du cas à 7 lignes contenait lui-même `7`,
puis les grandes sélections contenaient `c7`. Le résultat dépendait des valeurs.

Après correction, toutes ces tailles passent. **Maximum effectivement démontré :
32 lignes**, 7 825 octets de reçu et 66 chemins multipath pour la fixture mesurée.
Les lignes inchangées, absentes et résiduelles conservent leurs contrôles serveur.
Aucune impossibilité ni limite d'évaluation du moteur n'a été mise en évidence.

### 4. Assertion lifecycle

Le service validé normalise le refus de sa purge autonome en
`book-lifecycle/transition-conflict`. Le test attendait une permission brute.
Seule cette attente est corrigée ; `bookLifecycleService.js` est inchangé.

Les assertions auparavant inaccessibles passent : purge atomique de la génération
et du journal de reçus, séquence conservée, résultat ancien indéterminé, réajout en
génération 2 sans sources personnelles et refus d'une ancienne intention, même
forgée avec la séquence suivante disponible. La fixture contient explicitement
note, avis et note scalaire personnels synthétiques avant la purge.

## Défaut supplémentaire révélé par des témoins valides

Les anciennes attaques de taille réutilisaient un avant-état périmé : leur refus
ne prouvait donc pas le rejet du champ supplémentaire. Elles utilisent désormais
une enveloppe courante, suivie d'un commit témoin légitime.

Cela a révélé un défaut de `forbidPriorities` : l'expression JavaScript
`node['.validate'] || 'true'` remplaçait les validations booléennes `false` par
`true`. Un champ inconnu `padding` pouvait alors être accepté.

La correction ciblée utilise `??`, préservant chaque refus `false`. Ce changement
RESTAURE les schémas fermés ; il n'ajoute aucun droit. Des attaques SDK distinctes
sur le reçu, une garde active, before, after et une garde désactivée sont refusées,
avec un témoin positif correspondant. Les 16 identifiants interdits restent refusés
en contournant volontairement le validateur JavaScript.

## Instrumentation et niveau de preuve

`simulate.mjs` utilise exclusivement le POST local non mutatif du simulateur de
règles. La requête de contrôle est locale, mais l'action simulée porte seulement
`auth: {uid}` sans droit admin. Les logs ne conservent que les expressions,
positions et chemins de validation refusés, avec UID masqué ; aucun contenu
applicatif ni jeton n'est journalisé par cette instrumentation.

Les traces du simulateur localisent directement les trois refus de regex.
Les acceptations/refus finaux sont ensuite confirmés par de VRAIES écritures SDK
et lectures REST serveur indépendantes : la simulation ne remplace pas ces preuves.
Aucune variante permissive de règles n'a été nécessaire.

`run.mjs --serve` et `diagnose.mjs` permettent des reprises ciblées sur le même
Emulator, avec configuration, projet, ports et hub vérifiés. Les modes sont fixes :
`targeted`, `sizes`, `keys`, `full`, `regressions`, `rules`, `stop`.
Le mode stop signale uniquement le PID du hub demo validé pour un arrêt normal.

## Validations finales

| Validation | Résultat |
| --- | --- |
| Quatre scénarios ciblés corrigés | 4/4 |
| Faisabilité, 53 cas initiaux + 38 renforcements | 91/91 |
| Frontière des compteurs | 1/1 |
| Intégration générationnelle | 69/69 |
| Appartenances Collections | 48/48 |
| Catalogue Collections | 51/51 |
| Lifecycle service | 41/41 |
| Prototype lifecycle | 36/36 |
| Bibliothèque générationnelle | 50/50 |
| Notes générationnelles | 34/34 |
| Évaluations générationnelles | 40/40 |
| RTDB historique | 129/129 |
| Suite unitaire complète | 938/938, 56 fichiers |
| Lint ciblé | Aucun diagnostic |
| Lint global | 11 avertissements existants, aucune erreur |
| Build | Réussi |
| Composition expérimentale et intégrée | Vérifiée |
| Diff hors expérience, espaces et fichiers nouveaux | Vérifiés |

Total Emulator : 91 + 1 + 69 + 429 = **590 tests réussis**.
Le profil frontière change seulement la constante de départ d'une tête absente
à 2147483645. Il démontre les commits 2147483646 puis 2147483647, le refus du
2147483648 et du rejeu ancien, sans injection administrative de données.
La politique normale ne permet pas de sauter directement près de la limite.

Les fichiers `.log` locaux ignorés conservent les sorties des campagnes avant/après
et de validation ; ils ne sont pas des fichiers source à versionner. La référence
initiale 49/53 est historique ; elle n'est plus le verdict courant.

## Limites 32 / 128 Kio / 64 et compromis

* **32 : démontré** sur les tailles progressives et le batch complet. La garde 33
  est refusée avec préconditions courantes. Aucun découpage automatique.
* **128 Kio : borne cliente**, pas compteur d'octets dans les règles. Le schéma
  fermé borne structurellement les reçus ; une enveloppe de plus de 128 Kio avec
  padding interdit est refusée. Accepter exactement 128 Kio de données utiles
  n'est ni démontré ni promis. Le maximum de la fixture valide mesurée est 7 825.
* **64 : démontré** par 65 commits et vérification de tous les slots. Les reçus
  manquants ne donnent jamais une autorisation de rejeu.
* Une séquence par utilisateur impose une contention entre batches indépendants.
* La réconciliation actuelle lit le snapshot utilisateur ; le coût croît avec
  les données et le journal. Ce n'est pas l'API finale de lecture.
* La purge de livre efface tout le journal borné, ce qui peut rendre indéterminés
  des résultats d'autres opérations ; elle ne réinitialise pas la séquence.
* La perte de confirmation est simulée à la frontière du caller, pas au niveau TCP.
* Pas d'attestation serveur de migration fidèle, de moteur de migration complet,
  de suppression Auth réelle, de worker autonome ou de validation de toutes les
  politiques finales de lecture/conservation.
* Les lectures propriétaire larges de l'expérience servent à l'observation et
  ne préjugent pas des règles finales de confidentialité.

## Recommandation

**A, B, C et D : GO de faisabilité pour les comportements testés.**
L'architecture générale reste inchangée : migration client orientée, batch
multipath atomique, gardes par ligne, séquence monotone, journal borné et barrière
terminale externe. Les schémas fermés ont été renforcés conformément à l'intention.

Prochaine étape proposée, seulement après validation : formaliser les contrats
purs à partir de ces preuves et arbitrer les compromis de lecture/rétention.
Aucune phase suivante n'a commencé. Production reste strictement NO-GO.

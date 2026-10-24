# Évaluations multiples et dates de lecture — contrat local

Les phases 7, 7B et 7C ajoutent un historique d'évaluations et sa présentation.
Branche de travail : `feature/multiple-book-notes`. Aucune activation production,
migration automatique, écriture en production ou suppression de donnée historique.

## Sources de vérité

`users/{uid}/bookRatings/{bookId}/{ratingId}` est la source du nouvel historique,
activé uniquement en émulateur. `library.rating` reste un instantané historique
indépendant, sans double écriture ni synchronisation implicite. Le parcours actuel
hors émulateur reste disponible ; les nouveaux services refusent toute opération
hors environnement isolé. Aucun autre lecteur applicatif de rating n'a été trouvé
dans Dashboard, bibliothèque, filtres ou statistiques lors de l'audit initial.
Une future note principale commune à ces fonctionnalités exige une décision explicite.

Les évaluations ne modifient jamais les notes écrites, les punaises, les Collections,
les dates de lecture, les métadonnées ou le statut du livre.

## Schéma et tri

Une entrée contient :

- `value` : entier 1 à 5 ;
- `date` : date civile YYYY-MM-DD réelle, années 0001–9999 ;
- `impression` : texte simple facultatif de 160 unités UTF-16 maximum ;
- `revision` : entier incrémental à partir de 1 ;
- `createdAt` : timestamp serveur immuable ;
- `updatedAt` : timestamp serveur de création/modification.

`date: ''` signifie inconnue, initialement autorisée seulement sur la copie
`legacy-rating-v1`. Elle reste conservable tant qu'aucune date réelle n'a été
renseignée. La date technique de conversion ne devient jamais une date d'évaluation
ou de lecture. CivilDatePicker et civilDateUtils gèrent les dates civiles.

Tri : dates connues décroissantes, puis dates inconnues ; à égalité, createdAt
décroissant puis identifiant croissant. updatedAt et revision ne changent pas le
tri. Une modification de date peut changer l'évaluation principale.

## Phrase facultative

La limite suit maxlength HTML, String.length et RTDB : une paire de substitution
compte pour deux unités UTF-16. Le service et les règles refusent les valeurs non
textuelles, les dépassements et les contrôles ASCII U+0000–001F / U+007F.
React rend la phrase comme texte, même si elle contient des chevrons ; aucun éditeur
riche ni HTML interprété. Le formulaire affiche uniquement le compteur `N/160`,
aligné à droite, avec un libellé FR/EN facultatif et une limite native de 160.

Omettre impression dans une édition conserve la phrase existante. Fournir une
chaîne vide ou blanche l'efface ; une phrase significative est conservée telle
quelle. Un champ absent ou blanc ne crée aucun paragraphe vide. Au niveau RTDB,
null supprime une propriété : le service public refuse null comme saisie mais
utilise cette sémantique pour l'effacement. Étoiles et date restent obligatoires.

Les anciennes entrées restent sans champ, sans écriture au chargement. Une
conversion ne crée jamais de phrase ; les règles refusent son préremplissage
pendant la conversion. Une édition ultérieure peut l'ajouter. Aucun contenu de
library.note, library.review ou des notes écrites n'est récupéré.

## Concurrence et non-résurrection

Les push IDs sont stables. La création est une transaction d'insertion seulement.
Les éditions/suppressions comparent revision ET createdAt à l'instantané présenté
à l'utilisateur. Un conflit garde le brouillon ouvert et demande une actualisation
explicite ; aucun écrasement automatique ou réessai silencieux.

La suppression remplace valeur, date et phrase par un tombstone minimal immuable :
`{ deleted: true, revision, createdAt, updatedAt }`. Les lectures le filtrent.
Même un ancien réessai de création ne peut ressusciter cet identifiant.
Une création incertaine conserve son identifiant de tentative ; un réessai exige
les mêmes étoiles, date et phrase. Un contenu différent provoque un conflit.

La création relit les timestamps acquittés avant d'exposer createdAt comme jeton
de concurrence : les snapshots de complétion des transactions peuvent encore
contenir une estimation locale du timestamp serveur. Si cette lecture échoue,
le réessai au même ID reste sûr. Les erreurs réseau restent visibles.

## Conversion de library.rating

Confirmation manuelle obligatoire avec la valeur historique observée. Une écriture
atomique crée `bookRatingsLegacy/{bookId}` (`version: 1`, `sourceValue`, processedAt)
et `bookRatings/{bookId}/legacy-rating-v1`, revision 1, date inconnue, sans phrase.
Les règles comparent la source au commit, refusent une destination occupée,
rendent le marqueur immuable et empêchent toute recréation après suppression.

Les appels simultanés du même client partagent une promesse ; entre clients,
le marqueur est le verrou CAS. Un réessai après acquittement perdu lit ce marqueur.
Une copie modifiée ou supprimée n'est jamais recopiée et la source reste intacte.
Aucune conversion au chargement ou pour une valeur absente/invalide, zéro inclus.
Après acquittement, le hook masque la source avant sa lecture secondaire ; l'échec
de celle-ci propose Actualiser sans réoffrir la conversion.

Les anciens clients peuvent encore changer library.rating. La conversion compare
la valeur confirmée avant écriture et au commit, puis ne recopie plus les changements.
Une source modifiée puis rétablie à l'identique est indiscernable : l'ancien champ
ne possède aucun compteur historique.

## Date de lecture sous le statut

BookDetails affiche BookReadingDate immédiatement sous BookStatusSelect, uniquement
pour un livre présent en bibliothèque avec status finished ou abandoned. La ligne
« Lecture terminée / abandonnée · mois année » conserve son crayon et l'éditeur
BookFinalStatusDate. En l'absence de date, l'action accessible devient « Ajouter la
date ». Aucun affichage pour to-read/reading ou pour un livre hors bibliothèque.
La ligne est retirée de BookPersonalSpace ; évaluations et notes restent séparées.

useBookLibraryState délègue les sauvegardes aux services existants
updateBookFinishedAt / updateBookAbandonedAt, sans changer leur stockage :
timestamps représentant le mois choisi, premier jour à midi local. Les transitions
de statut et leur initialisation des dates restent celles de libraryService.
LibraryBookCard et readingDateUtils ne sont pas modifiés : affichage mois/année.

Pendant une écriture de date, la fiche bloque statut, retrait et doubles soumissions.
Les résultats d'un ancien livre/utilisateur/route sont ignorés ; la fusion locale
ne recrée pas un livre supprimé et conserve ses autres champs. Les transactions
d'existence du service restent la protection serveur. En cas d'échec, l'erreur est
visible dans la fiche et l'éditeur reste ouvert avec le mois choisi. Annuler ne
modifie rien. Les évaluations, leur historique et les brouillons de notes ne sont
pas réinitialisés par une mise à jour de la date de lecture.

## Interface, actualisation et preview

Une seule évaluation apparaît par défaut, avec un historique repliable et compteur.
Les étoiles d'affichage restent non interactives ; les icônes Modifier/Supprimer
occupent la même ligne et offrent des cibles de 44 px, noms FR/EN et infobulles
sur focus/survol, fermables par Échap. Phrase éventuelle puis date suivent dessous.
L'action Ajouter reste discrète. Supprimer nécessite confirmation et affiche ensuite
la suivante selon le tri. Les évaluations ne sont proposées que pour status finished.
La source historique non convertie reste une valeur à copier explicitement.

Actualiser charge l'instantané de la section et ses marqueurs. Les écritures réussies
sont déjà fusionnées localement. L'icône est à côté du titre Mon évaluation ; les
notes gardent leur propre icône. Pas de polling, abonnement ou lecture automatique
supplémentaire. Les formulaires, brouillons et accordéons des entrées conservées
restent montés pendant l'actualisation ; les erreurs et verrous restent visibles.
Après conflit d'évaluation, annuler puis actualiser et rouvrir l'édition pour obtenir
la nouvelle révision. Une suppression distante d'une note ouverte nécessiterait une
politique supplémentaire avant toute synchronisation automatique.

`/preview/book-notes.html` réutilise BookDetails, BookStatusSelect, BookReadingDate,
BookRatingsView et BookNotesView avec des modèles en mémoire. Les quatre statuts et
le retrait/ajout fictif peuvent y être testés. Aucun SDK, service ou fournisseur
Firebase/auth n'est importé. Les sélecteurs layout=new/old, la variante i18n privée
et sa feuille de styles sont supprimés ; le compteur réel est désormais partagé.
Aucun port Vite ni paramètre WSL2 n'est modifié. Les contrôles de scénario restent
réservés à cette entrée locale de développement.

## Règles et limites de production

Les règles locales imposent propriétaire authentifié, livre existant avant/après,
création/édition d'évaluation seulement si finished, et suppression autorisée au
propriétaire même si le statut a changé. Schéma fermé, bornes, révision incrémentale,
création immuable et timestamps serveur. Les branches nouvelles sont exclues du
wildcard existant ; aucun droit d'écriture d'ancêtre n'est ajouté. Les règles des
notes et de leurs migrations ne changent pas.

Supprimer un livre laisse ces données stockées mais inaccessibles ; réinsérer le
même identifiant retrouve l'historique et les marqueurs. La suppression complète
du compte reste à traiter dans l'audit Firebase global. Les lectures sont des
instantanés, pas une synchronisation temps réel. Aucune configuration ou règle
production n'est modifiée. Production reste NO-GO jusqu'à la fin de cet audit.

## Validation finale

- `npm run test:run` : 534 tests, 43 fichiers réussis ;
- suites RTDB sur demo-dear-pages : 129 tests, 3 fichiers réussis ;
- `npm run lint` : Oxlint réussi, 11 avertissements préexistants ;
- `npm run build` et `git diff --check` : réussis ;
- Chromium 320/390/1440 px : quatre statuts, date sous le statut sans doublon,
  édition du mois/année, compteur seul, clavier, focus, cibles tactiles, historique,
  phrases, brouillons/accordéons et punaises ; aucun débordement, zéro requête
  Firebase et zéro erreur JavaScript.

Commande RTDB isolée (aucun serveur Vite supplémentaire) :

```sh
firebase emulators:exec --config firebase.emulators.json --project demo-dear-pages --only auth,database 'node node_modules/vitest/vitest.mjs run --config vitest.rtdb.config.js'
```

Les tests vérifient projet, Hub et refus anonyme avant d'initialiser leurs SDK.
Les outils de contrôle navigateur restent hors dépôt. GO émulateur dans ce
périmètre ; NO-GO production. Aucun commit, push, merge ou déploiement exécuté.

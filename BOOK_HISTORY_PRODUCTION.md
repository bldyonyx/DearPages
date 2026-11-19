# Notes multiples et évaluations sur Spark

`database.production.rules.json` est le fichier candidat. Le fichier `firebase.json` utilisé par Hosting ne le référence pas. `firebase.production-rules.emulators.json` charge le candidat sur `demo-dear-pages` et réutilise la garde qui refuse tout déploiement de cette configuration.

Les droits ordinaires du propriétaire portent sur `profile`, `preferences`, `library`, `collections` et les entrées personnelles selon le livre et les validations de la branche concernée. Les règles candidates autorisent la création d'un marqueur de note ou d'avis uniquement avec la création atomique de sa note réservée. Le HTML de la copie, du marqueur et de la source doit être identique. Le marqueur reste immuable après la conversion, y compris après suppression de la note. La suppression complète peut retirer aussi les branches orphelines ou anciennes sans les énumérer. Son autorisation exige que l'arbre de l'UID soit entièrement supprimé et que le jeton corresponde à une authentification de moins de cinq minutes. Le client réauthentifie déjà le compte et retire les données RTDB avant de supprimer le compte Auth. Les deux opérations restent séparées. En cas d'échec de la deuxième, le parcours est relançable après réauthentification.

## Validation locale

```sh
firebase emulators:exec --config firebase.production-rules.emulators.json --project demo-dear-pages --only auth,database \
  "DEAR_PAGES_PRODUCTION_RULES=1 node node_modules/vitest/vitest.mjs run --config vitest.rtdb.config.js tests/rtdb/productionRules.emulator.js"
```

La suite candidate couvre la conversion des deux sources avec les services en mode production, la reprise et le rejet des écritures isolées ou incohérentes. Une source vide ou dont le HTML devrait être transformé pour respecter le format des notes modernes garde sa carte de compatibilité.

## Ordre de publication

1. Après autorisation de publication, comparer le candidat aux règles effectives et vérifier le projet et l’instance RTDB ciblés. La configuration active n'a pas été consultée pendant cette préparation.
2. Appliquer d'abord les règles validées via `firebase.book-history-deploy.json`, en ciblant uniquement la base RTDB.
3. Construire en mode production avec `VITE_GENERATION_LIBRARY=false VITE_LEGACY_BOOK_HISTORY=true npm run build` puis publier uniquement Hosting après confirmation que les nouvelles règles sont actives. Sans `VITE_LEGACY_BOOK_HISTORY=true`, le nouveau parcours reste désactivé.

Les nouvelles entrées sont indépendantes des valeurs d'origine. Les actions historiques explicites restent disponibles sur la fiche. La suppression d'un livre masque ses nouvelles entrées, qui sont conservées sous le même identifiant. Elles sont retirées lors de la suppression complète du compte.

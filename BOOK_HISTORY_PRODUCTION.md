# Notes multiples et évaluations sur Spark

`database.production.rules.json` est le fichier candidat. Le fichier `firebase.json` utilisé par Hosting ne le référence pas. `firebase.production-rules.emulators.json` charge le candidat sur `demo-dear-pages` et réutilise la garde qui refuse tout déploiement de cette configuration.

Les droits ordinaires du propriétaire portent sur `profile`, `preferences`, `library`, `collections` et les entrées personnelles selon le livre et les validations de la branche concernée. Les marqueurs de conversion sont en lecture seule. La suppression complète peut retirer aussi les branches orphelines ou anciennes sans les énumérer. Son autorisation exige que l'arbre de l'UID soit entièrement supprimé et que le jeton corresponde à une authentification de moins de cinq minutes. Le client réauthentifie déjà le compte et retire les données RTDB avant de supprimer le compte Auth. Les deux opérations restent séparées. En cas d'échec de la deuxième, le parcours est relançable après réauthentification.

## Validation locale

```sh
firebase emulators:exec --config firebase.production-rules.emulators.json --project demo-dear-pages --only auth,database \
  "DEAR_PAGES_PRODUCTION_RULES=1 node node_modules/vitest/vitest.mjs run --config vitest.rtdb.config.js -t '^(?!.*(atomic emulator-only legacy conversion|independent historical review conversion|explicit rating conversion|converted origins|independent-client conversion winner|old or converted ratings)).*'"
```

Les tests de conversion restent associés aux règles d'émulateur habituelles. La suite candidate couvre leur blocage via les services activés en mode production et via les règles.

## Ordre de publication

1. Faire valider le diff du candidat avec les règles effectives. Vérifier que les branches utilisées par tout client historique sont couvertes. La configuration active n'a pas été consultée pendant cette préparation.
2. Après autorisation distincte, appliquer les règles validées avant de servir un build activé. Le build actuel continue à utiliser les champs historiques.
3. Construire en mode production avec `VITE_GENERATION_LIBRARY=false VITE_LEGACY_BOOK_HISTORY=true npm run build` et cibler uniquement l'application Hosting. Sans `VITE_LEGACY_BOOK_HISTORY=true`, le nouveau parcours reste désactivé.

Les nouvelles entrées sont indépendantes des valeurs d'origine. Les actions historiques explicites restent disponibles sur la fiche. La suppression d'un livre masque ses nouvelles entrées, qui sont conservées sous le même identifiant. Elles sont retirées lors de la suppression complète du compte.

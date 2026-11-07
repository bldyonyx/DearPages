# Fonction privée de finalisation — préparation locale uniquement

État initial vérifié : branche `feature/multiple-book-notes`, HEAD
`8f068de541d9b921b63fcfa98b4efd26d6126aa6`, working tree propre. Aucune
infrastructure Cloud Functions n'existait ; la configuration racine reste Hosting
uniquement. Aucun déploiement ni accès Firebase production n'est autorisé.

## Ce qui est préparé

`index.mjs` exporte **une seule fonction HTTPS v2**, `finalizeHistoricalImport`,
créée par le vrai SDK `firebase-functions@7.4.0` :

- `invoker: 'private'` : aucune permission publique/anonymous déclarée ;
- ingress `ALLOW_INTERNAL_ONLY`, CORS désactivé ;
- serviceAccount = paramètre requis MIGRATION_RUNTIME_SERVICE_ACCOUNT, sans défaut ;
- région europe-west6, zéro instance minimale, une instance/concurrence 1.

Aucun trigger RTDB, Auth, tâche planifiée ou callable Firebase n'est ajouté.
La limitation de concurrence n'est ni une autorisation ni un remplacement du CAS.
Les options sont celles du [SDK HTTPS v2 officiel](https://firebase.google.com/docs/reference/functions/2nd-gen/node/firebase-functions.https.httpsoptions).

`handler.server.mjs` est une enveloppe autour de
`createPreparedFirebaseFinalizationServer`, qui délègue au noyau existant. Aucune
logique d'import, de vérification des données, d'attestation ou de finalisation
n'est recopiée. Le CAS racine et ses reprises restent dans le noyau/adaptateur.

Le handler exige POST, JSON, un bearer token et uniquement le contrat de migration
`{uid,migrationId,transformVersion}`. Une approbation cliente, un champ principal,
req.auth ou X-Goog-* ne constitue pas une identité de service. Les exceptions
externes ne sont jamais retournées avec leur texte ou leur contenu sensible.

## Refus par défaut et limites actuelles

**L'export livré ne peut effectuer aucune finalisation réelle.** Il n'installe
aucun fournisseur de vérification OIDC, de credentials ou de transport Firebase.
Même une configuration locale complète et un bearer présenté à cet export
retournent 503/private-authority-not-configured. L'environnement réel est toujours
refusé avant toute opération de finalisation.

Pour les tests du handler uniquement, des capacités **internes à l'hôte serveur**
sont injectées :

- `verifyInvocationToken(token, audience)` doit vérifier réellement la signature
  et renvoyer un DTO normalisé issuer/audience/subject/email/emailVerified/expiresAt.
  Les tests emploient des doubles ; le handler ne décode pas un JWT non vérifié.
- Le handler impose ensuite un issuer Google accounts, l'audience exacte, le
  subject exact du service invocateur, son email vérifié et une expiration future.
  Un ID token Firebase utilisateur (issuer securetoken) est refusé.
- `getServiceCredential` et `request` alimentent l'adaptateur déjà existant ;
  aucun ADC, fichier de credential ou compte Auth n'est créé ou modifié.
- `expectedRules` est une politique de l'hôte, jamais un champ de la requête.

Les configurations sont requises explicitement et ne contiennent ici aucune
valeur IAM réelle :

| Paramètre | Contrôle local |
| --- | --- |
| FUNCTIONS_EMULATOR | true obligatoire |
| MIGRATION_FUNCTION_LOCAL_ENABLED | true obligatoire |
| GCLOUD_PROJECT | demo-dear-pages seulement |
| FIREBASE_DATABASE_EMULATOR_HOST | 127.0.0.1:9000 seulement |
| FIREBASE_AUTH_EMULATOR_HOST | 127.0.0.1:9099 seulement |
| MIGRATION_RUNTIME_SERVICE_ACCOUNT | SA dédiée fictive du projet demo ; aucun défaut |
| MIGRATION_INVOKER_SERVICE_ACCOUNT | SA invocatrice fictive, distincte du runtime |
| MIGRATION_INVOKER_SUBJECT | subject numérique explicitement attendu |
| MIGRATION_FUNCTION_AUDIENCE | URL HTTPS attendue, sans query/fragment/credentials |

Une configuration changeant pendant une invocation est refusée. La vérification
OIDC est répétée par les contrôles internes de l'adaptateur avant ses requêtes.
Les endpoints et le contrat d'attestation restent ceux d'Emulator ; aucune
permission de production n'est ajoutée. Les capacités de test ne sont pas une
API publique et ne doivent jamais être extraites d'un body HTTP.

## Construction et tests locaux

Depuis la racine du dépôt, après installation des dépendances de l'application :

```sh
npm ci --prefix functions/migration --ignore-scripts --no-audit --no-fund
node functions/migration/build.mjs
npm run test:run -- src/test/privateMigrationFunction.test.js
node experiments/historical-import/run.mjs --existing
```

Le dernier runner réutilise les Emulators Auth/RTDB demo déjà actifs et vérifiés.
L'intégration de l'enveloppe y utilise un double de vérification d'identité et le
privilège natif Emulator dans le fournisseur de credentials de fixture. Ce n'est
**pas** un test de vérification cryptographique Google ni d'application IAM réelle.

Le build utilise le bundler Node déjà disponible via Vite pour réunir l'enveloppe
et les modules existants dans `dist/index.mjs`. Firebase archive uniquement le
dossier source de fonctions : ce bundle résout l'incompatibilité des imports vers
les dossiers src/experiments extérieurs, sans recopier manuellement le noyau.
Le SDK Firebase Functions reste une dépendance runtime externe. Aucun .env,
credential ou asset React n'est copié. `dist` et `node_modules` ne sont pas suivis.
Le package déclare Node 22 ; la validation locale utilise Node 24 installé, pas un
runtime Cloud Functions déployé. Le package-lock fixe les dépendances installées.

La configuration séparée `firebase.migration-functions.json` n'est pas enregistrée
dans `firebase.json` ni dans les workflows Hosting. Le script deploy du package et
le predeploy de cette configuration refusent **inconditionnellement** le déploiement.
Le test lance uniquement ce petit script Node, jamais une commande firebase deploy.
Un hook n'est pas une garantie qu'une CLI de déploiement ne tentera aucune lecture
préalable : ne pas lancer firebase deploy, même pour tester ce refus.

## Vérification locale

- 27 tests unitaires de l'enveloppe : export réel SDK privé/v2, pas de trigger
  automatique, refus sans auth/config/projet, absence de fournisseur implicite,
  issuer/audience/subject/email/expiration, refus req.auth/headers/preuve cliente,
  pas de fuite d'erreur et refus de déploiement. L'export SDK réel est aussi invoqué
  localement avec configuration fictive : refus 503 sans réseau.
- 46 tests Auth/RTDB Emulator : les 45 régressions du finaliseur existant plus
  l'invocation locale du handler qui délègue vraiment au finaliseur, vérifie la
  conservation des sept branches/profil/préférences/destinations puis le rejeu.
- La validation n'est ni un déploiement, ni un test d'autorisation IAM sur Cloud
  Run, ni un test d'un endpoint Functions Emulator avec IAM (qui ne prouverait
  de toute façon pas la politique de production).

## IAM et sécurité encore à configurer, sans action ici

Avant toute autorisation future, les points suivants restent bloquants :

1. Créer/choisir séparément une SA invocatrice et une SA d'exécution dédiées, puis
   renseigner leurs identités réelles, subject/audience et projet autorisé. Aucune
   SA ni aucun binding n'est créé par cette tâche.
2. Accorder uniquement à l'invocateur prévu `roles/run.invoker` sur le service v2
   concerné, jamais allUsers/allAuthenticatedUsers ou un utilisateur Firebase
   ordinaire. Valider l'ingress interne et le chemin privé d'invocation. Voir
   [l'authentification officielle des fonctions](https://docs.cloud.google.com/functions/docs/securing/authenticating).
3. Fournir un vérificateur OIDC serveur authentique et un fournisseur de credentials
   de workload correspondant à l'identité d'exécution ; aucune auto-attestation
   par présence dans Cloud Functions, header ou metadata client. Ces fournisseurs
   ne sont pas livrés comme opérationnels ici.
4. Définir les permissions minimales de lecture Auth et de finalisation RTDB. Le
   CAS commun couvre users **et** accountControl à la racine : il exige des droits
   plus larges qu'une écriture sous users/{uid}. Les réduire en supprimant ce CAS
   casserait la protection terminale ; cette portée requiert une décision explicite.
   Ne pas utiliser le rôle Editor du compte de service par défaut comme raccourci.
5. Valider l'adaptateur réel et le contrat/règles d'attestation pour une autorité
   réelle. Le profil actuel n'accepte que emulator-root-cas-v1 et interdit au
   propriétaire d'écrire une approbation ou de promouvoir le protocole.

Aucun garde existant n'est levé pour rendre cet export fonctionnel en production.
Firebase production reste strictement **NO-GO**.

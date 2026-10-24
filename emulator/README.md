# Développement Firebase isolé — PowerShell

Ce mode est réservé à Authentication et Realtime Database (RTDB). Projet fictif unique :
`demo-dear-pages`, namespace RTDB explicite `demo-dear-pages`. Aucun Firestore,
Hosting, déploiement, migration, import ou export n'est lancé par ces scripts.
`firebase.json`, `.firebaserc`, le `.env` habituel et les règles déployées restent inchangés.
`database.rules.json` reproduit les règles fournies lors de l'audit ; les règles sont chargées
uniquement dans le processus RTDB local. Aucun téléchargement des règles de production.

## Verrou de déploiement

**`firebase.emulators.json` est exclusivement réservé aux émulateurs.** Son unique
cible déployable (`database`) possède un hook `predeploy` qui lance
`node scripts/refuseEmulatorDeploy.mjs`. Ce script échoue inconditionnellement,
sans accès réseau ni lecture d'identifiants : aucun projet, variable d'environnement,
`--force` ou `--dry-run` ne peut l'autoriser. Un script absent ou Node indisponible
fait également échouer le hook.

Avec Firebase CLI 15.31.0, le CLI exécute tous les hooks `predeploy` avant les
phases `prepare`, `deploy` et `release`. L'invocation directe de `firebase deploy`
avec ce fichier est donc bloquée, y compris avec `--only database` et
`--only "database,hosting"`. Aucun bloc Hosting ni autre produit déployable n'est
défini : les filtres excluant RTDB échouent faute de cible. Il n'existe pas de hook
global universel ; ajouter une autre cible à ce fichier pourrait contourner le
verrou et exige une nouvelle revue. Le validateur local et les tests refusent
actuellement un tel ajout.

Les commandes `emulators:start` et `emulators:exec` n'exécutent pas les hooks de
déploiement ; le chargement des règles locales reste inchangé. Le déploiement
Hosting normal utilise toujours `firebase.json`, qui ne contient pas ce verrou.

Le hook bloque la préparation et la publication des ressources, **pas toutes les
requêtes du CLI** : l'authentification et les contrôles de permissions ou métadonnées
peuvent précéder le hook. Ne pas lancer un vrai `firebase deploy`, même avec
`--dry-run`, pour tester ce refus. D'autres commandes administratives (par exemple
des écritures directes en base) ne sont pas protégées par un hook de déploiement.
Ce verrou ne protège pas contre sa suppression volontaire ni contre un CLI modifié.
Pour une interdiction plus forte, avant toute requête du CLI, il faudrait retirer
toute cible déployable du fichier et charger les règles via un bootstrap limité
à RTDB localhost, ou isoler le CLI sans identifiants ni accès réseau distant.
Ces mesures plus larges ne sont pas mises en place par ce correctif.

## Prérequis

Depuis la racine du dépôt, avec Node.js et Java 21+ disponibles dans le PATH :

```powershell
node --version
java -version
firebase.cmd --version
# Si le CLI manque (version utilisée pour la validation) :
npm.cmd install --global firebase-tools@15.31.0
npm.cmd ci
```

Validation effectuée avec Node 24.20.0, Java 21.0.12.1 et Firebase CLI 15.31.0.
Le CLI Firebase est un prérequis externe, pas une dépendance du lockfile du projet.
Le premier lancement peut télécharger le JAR RTDB dans le cache Firebase utilisateur.
Il n'est pas nécessaire de se connecter à un compte Firebase pour le projet démo.
Le CLI peut néanmoins utiliser une session existante, rafraîchir son jeton et demander
des métadonnées pour **demo-dear-pages** ; ce n'est pas une garantie de fonctionnement
entièrement hors réseau. Aucun appel vers la base ou les utilisateurs de production
n'est nécessaire. Ne pas utiliser de comptes ni d'identifiants réels dans les émulateurs.

## Démarrage

Terminal PowerShell 1 :

```powershell
npm.cmd run emulators:start
```

Attendre « All emulators ready », puis, dans un second terminal à la racine :

```powershell
npm.cmd run dev:emulator
```

Ouvrir uniquement `http://127.0.0.1:5501`. Arrêter chaque processus par `Ctrl+C`.
Les utilisateurs et données de test sont éphémères, sans import/export automatique.
L'interface Emulator UI est volontairement désactivée.

| Service | Adresse |
| --- | --- |
| Vite | 127.0.0.1:5501 |
| RTDB | 127.0.0.1:9000 |
| Authentication | 127.0.0.1:9099 |
| Hub | 127.0.0.1:4400 |
| Logs internes | 127.0.0.1:4500 |

Les scripts testent les exclusions TCP Windows IPv4/IPv6 via `netsh`, puis la
possibilité d'écouter sur chaque port. Aucun choix automatique d'un autre port.
Les ports 5141–5440 sont évités, ainsi que toutes les exclusions constatées lors
de l'implémentation. Une erreur de lecture de `netsh` provoque aussi un refus.
Pour examiner manuellement les conflits :

```powershell
netsh interface ipv4 show excludedportrange protocol=tcp
netsh interface ipv6 show excludedportrange protocol=tcp
netstat -ano -p tcp
```

Si un port est occupé, identifier le processus et résoudre le conflit avant de
relancer. Ne pas changer uniquement une variable ou un port : configuration,
contrat de validation, environnement et tests doivent rester cohérents.

## Tests

Arrêter d'abord les émulateurs et Vite pour libérer les ports :

```powershell
npm.cmd run test:emulator
npm.cmd run test:emulator:deploy-guard
npm.cmd run test:emulator:integration
npm.cmd run test:run
npm.cmd run build
npm.cmd run lint
git diff --check
```

`test:emulator` utilise des mocks SDK et vérifie les refus avant initialisation,
les valeurs exactes des variables, les connecteurs locaux et le chemin normal.
`test:emulator:deploy-guard` exécute hors réseau le filtrage des cibles, le moteur
des hooks et l'orchestration de déploiement du CLI installé (version 15.31.0
obligatoire). Les dépendances non explicitement autorisées sont refusées ; les
phases de préparation et de publication sont des substituts locaux, jamais les
implémentations distantes. Le vrai script de refus est exécuté par le moteur de
hooks du CLI. Les variantes sans filtre, RTDB seul, mixte RTDB/Hosting, filtre RTDB,
`--force`, `--dry-run` et exclusions sont couvertes. Les points d'entrée
`emulators:start` et `emulators:exec` sont aussi vérifiés avec un démarrage simulé.
Ce test n'invoque pas la commande complète `firebase deploy`, ne charge pas de
compte Firebase et ne constitue pas un essai de déploiement réel.
`test:emulator:integration` démarre des émulateurs frais avec `emulators:exec`,
vérifie Vite (environnement, CSP, endpoint de santé), puis utilise le vrai SDK
pour créer un utilisateur local, écrire et relire ses données, refuser les
accès à un autre utilisateur et les lectures anonymes, et vérifier le projet
du jeton Auth. Le CLI arrête les émulateurs à la fin, y compris en cas d'échec.

## Protections et limites

- `--mode emulator` charge `emulator/.env.emulator`, pas le `.env` racine. Toutes les
  variables `VITE_FIREBASE_*` sont vérifiées par liste fermée, valeurs exactes et
  présence obligatoire, dans Vite puis dans le module Firebase. Les variables
  du processus et les fichiers `.local` ont la priorité habituelle de Vite mais
  toute valeur Firebase divergente provoque un refus ; ne pas recopier le `.env` réel.
- Vite refuse un build en mode émulateur, une origine ou un port différents, une
  configuration CLI modifiée, un Hub non associé au projet démo, des services
  absents ou avec des hôtes/ports différents, et un RTDB dont la racine est lisible
  sans authentification. Les requêtes de contrôle ont un délai maximal et refusent
  les redirections. Le navigateur revalide la santé avant `initializeApp()`.
- `connectAuthEmulator()` et `connectDatabaseEmulator()` sont appelés immédiatement
  après la création de leurs instances et avant de les exposer aux services de
  l'application. Une panne ultérieure reste dirigée vers localhost : il n'existe
  aucun mécanisme de repli vers Firebase réel.
- La CSP du serveur Vite isolé limite fetch/XHR/WebSocket aux services locaux et
  au serveur Vite. Les appels de découverte et traduction externes sont donc
  bloqués dans ce mode ; leurs clés du `.env` racine ne sont pas chargées.
  Les images et polices distantes ne sont pas couvertes par `connect-src`.
- La disponibilité des ports est contrôlée avant écoute : un autre processus
  peut encore prendre un port entre les deux. `strictPort`, les vérifications
  du Hub et le contrôle de santé détectent les conflits ordinaires. Ces contrôles
  ne constituent pas une attestation cryptographique d'un service localhost.
- L'isolation s'applique à ce mode et aux commandes documentées. `npm.cmd run dev`
  et `npm.cmd run build` conservent leur configuration habituelle et peuvent viser
  Firebase réel. Ne pas les utiliser pour manipuler des données de test.
  La CSP ne remplace pas un pare-feu, et ne couvre pas des scripts Node arbitraires,
  un navigateur compromis ou une modification volontaire des protections.
- Les émulateurs n'assurent pas une équivalence complète à la production, notamment
  pour l'envoi d'e-mails, les fournisseurs OAuth et les mécanismes anti-abus.
  Références : [Auth](https://firebase.google.com/docs/emulator-suite/connect_auth),
  [RTDB](https://firebase.google.com/docs/emulator-suite/connect_rtdb).

Prochaine étape : vérifier cet environnement et son diff avant de préparer des
scénarios de données locales pour les futures notes multiples. Aucun composant
de notes ou d'étoiles n'est modifié à cette étape.

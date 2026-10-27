# Isolated generation-aware ratings — 8B.3.4.3

This experience uses only `demo-dear-pages` and fixed local Auth/RTDB emulators
(`127.0.0.1:9099` and `127.0.0.1:9000`). Deployment is explicitly refused by
configuration. Application rules and existing services remain unchanged. No
application component imports this repository. Production is NO-GO.

## Run

Use the existing Linux Java 21, cached emulator JAR and Firebase CLI. Set
`JAVA_HOME` and prepend its bin to `PATH` for the command only. Set `CI=true`,
`NO_UPDATE_NOTIFIER=1` and a temporary `XDG_CONFIG_HOME` to suppress CLI remote
version/MOTD checks. From the repository root:

```sh
node experiments/generation-ratings/run.mjs
```

The runner verifies its configuration, refuses arguments and checks the four
loopback ports before invoking `emulators:exec`. It performs no installation.
The targeted unit suite is:

```sh
npm run test:run -- src/test/generationBookRatingsService.test.js
```

## API

`createGenerationBookRatingsService(database)` takes an injected client SDK
Database. It reuses the lifecycle's fail-closed demo guard: project, configured
and actual namespace, host, SDK emulator metadata, non-admin credentials and Auth
emulator configuration are checked before references are opened. Owner identity
is checked again across asynchronous work. It imports no application singleton.

All methods require the original frozen generation context. All mutations may
be expressed with the immutable `generationRatingContracts.js` envelopes:

- `getRating(context, ratingId)` returns a frozen live rating with an acknowledged
  immutable `token`, or null for an absent/deleted rating.
- `getRatings(context)` returns a frozen list of live ratings sorted by civil
  date descending (unknown last), creation descending, then ID.
- `execute(operation)` dispatches create, update, delete or historical conversion.
- `reconcile(operation)` only reads server evidence for the exact captured
  context, ID, intended revision and payload. It never writes or allocates IDs.
- `createRating(context, ratingId, payload)` requires a preallocated stable push ID.
- `updateRating(context, ratingId, payload, token)` uses revision/createdAt CAS.
- `deleteRating(context, ratingId, token)` writes a terminal tombstone.
- `getLegacySource(context)` returns empty/processed status or a captured source
  token; it never converts. An invalid nonempty source fails explicitly.
- `convertLegacy(operation)` accepts a historical conversion envelope.

Results of mutations are `{ context, rating, deleted }`; conversion returns
`{ context, processed: true }`. Envelopes must be canonical factory output;
malformed objects, accessors, extras, forged revision steps and mismatched
contexts are rejected before network access. Raw convenience payloads do not
accept null impressions; null is only the pure factory's normalized clear intent.
SDK paths are raw; REST paths encode each validated segment exactly once.

## Business compatibility and schema

Live record fields: `value`, `date`, `revision`, `createdAt`, `updatedAt`, and
optional `impression`. IDs are keys, not mutable record fields.

- Stars are integers 1–5; dates are real civil dates 0001–9999.
- Impressions are optional plain strings, at most 160 UTF-16 code units and no
  C0/DEL controls. Nonempty whitespace is preserved, matching the old service;
  whitespace-only input clears the field. Omission on update preserves it.
- Creation, content modification and initial conversion require `finished` both
  before and after the write. Deletion is allowed in all existing book statuses,
  provided the generation remains active and the protocol ready.
- Ordinary creation starts at revision 1. Matching creation retries are accepted
  only while revision remains 1 and initial normalized content still matches;
  after an edit, even a matching content cannot be labelled initial creation.
- Each update/delete increments exactly once. Creation identity is immutable;
  timestamps are resolved by the server and acknowledged through uncached reads.

A tombstone is exactly `{ deleted: true, revision, createdAt, updatedAt }`.
It retains no stars, impression, civil date or content fingerprint. Rules reject
all subsequent writes, including null and identical overwrites; retry/reconcile
is read-only once this terminal state exists. Only generation purge can physically
remove it after the durable deleting lock. The same ID cannot be reused in that
generation.

Counters are positive safe integers. Overflow is refused rather than reset.
At maximum revision a rating cannot be individually updated/deleted; lifecycle
purge of the whole generation remains possible. No migration is included.

## Server concurrency guarantees

SDK transactions run with `applyLocally: false`. An explicit uncached server
baseline permits non-destructive proposals against cold caches; server hash CAS
retries against the actual record. Every retry rechecks revision and creation
identity. Rejected callbacks abort with undefined rather than throwing into the
SDK event loop. Revision arithmetic comes from the captured envelope, never a
newly resolved generation or incrementing a newer revision opportunistically.

Rules at the *rating record boundary* enforce revision +1 and identity equality,
including for partial SDK writes that omit revision or createdAt. Child schema
validation alone would not suffice for an unchanged revision child. Rules also
enforce integer bounds, allowed content, immutable identity, terminal deletion,
finished status before/after live writes, ready protocol and the exact active
generation before/after all writes. No ancestor write grant permits active data
replacement; the generation-level grant allows only a locked full purge.

An update with an obsolete CAS token is always rejected by execute, even when
its desired content matches. Explicit read-only reconcile may confirm its exact
next revision and desired content without another write, even if a competing operation
produced that state. This proves the effect, not its author or exactly-once
execution. A different revision/content remains a conflict. Explicit read-only
reconciliation may confirm an earlier write after the book status changed;
executing create/update again still requires finished. Later concurrent writes
can make a previously committed operation unconfirmable. Unavailable server
evidence is an error; optimistic cache is never sufficient.

SDK operations can remain pending offline until reconnection. There is no promise
to cancel an already queued SDK write. The queue retains its original path and
server guards reject old-generation writes after lock/purge/readd.

## Historical conversion

Source: `.../{generation}/library/rating`; marker:
`.../{generation}/bookRatingsLegacy`; destination:
`.../{generation}/bookRatings/legacy-rating-v1`.
Marker schema is `{ version: 1, sourceValue, processedAt }`.

The source token captures a valid integer, not the latest library generation.
A single atomic multipath update creates the marker and reserved destination.
Rules compare the actual source both before and after, require both previous
marker and destination absent, tie destination stars to the source, require
revision 1 and empty unknown date, forbid an invented impression, and tie both
destination timestamps to the marker's server timestamp. Reserved creation
without its marker and marker creation without its destination are rejected.

The library's historical rating can still be edited through its existing isolated
API: source changes race safely with conversion through the before/after checks.
No new mutable single-rating source is exposed by this service. A processed
marker is immutable and suppresses future copying even if the converted rating
is deleted or the library source later changes. Matching conversion retries return
that terminal marker; a different captured source is a conflict. A legacy unknown
date may remain unknown during edits, or become known; a known date cannot revert
to unknown. No source or marker is copied to a newer generation implicitly.

## Test evidence and remaining limits

The Emulator tests use real independent SDK clients and inspect final stored
state. Direct writes cover null deletions, revision skipping/reset, immutable
identity, tombstones, hostile multipath/status/lifecycle changes and ancestor
replacement. A maximum-revision fixture uses only the local Emulator admin token;
the service never receives that token. Lost acknowledgement tests throw at the
caller boundary after real committed SDK writes, not actual TCP packet loss.
Real offline queues and cold SDK caches are tested separately.

This phase does not integrate UI, subscriptions, pagination, production rules,
account deletion, Collections or migrations. The guard intentionally depends on
metadata of the pinned SDK, failing closed if its shape changes. There is no
background worker, durable operation journal, global exactly-once guarantee or
production readiness claim. Full historical reconciliation after additional edits
would require a separate explicit operation-history decision, not an implicit
retry using a new identity or generation.

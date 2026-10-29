# 8B.3.5 — isolated integration and historical-source contract

The historical-source library contract conflict is corrected without weakening
rules. The suite now contains 69 tests using actual SDK clients and all six
services under one combined ruleset. No application integration, migration,
production access or deployment is enabled.

## Reproduce locally

Use the existing Linux Java 21, cached RTDB JAR and Firebase CLI. Set JAVA_HOME
and PATH only for the command, plus CI=true, NO_UPDATE_NOTIFIER=1 and a temporary
writable XDG_CONFIG_HOME. Only demo-dear-pages and 127.0.0.1 are supported.

```sh
node experiments/generation-integration/composeRules.mjs --check
node experiments/generation-integration/run.mjs
```

Expected result: all 69 tests pass. Production and application activation remain
NO-GO even when this isolated validation passes.

## Rule composition and explicit comparisons

composeRules.mjs independently reads all six authoritative rule files. It
compares every stage and records added/removed/changed JSON paths, source SHA-256
hashes, branch provenance and combined digest in composition-report.json.
Generated artifacts are deterministic; --check and the runner verify them without
rewriting source files. Only an explicit no-argument generator writes artifacts
in this experiment's own directory.

- Protocol, lifecycle and locked full-generation purge come from 8B.2.
- Full library validators come from generation-library; generation-notes supplies
  the stronger library authorization that freezes historical note/review sources.
- Notes, note/review source markers and field counters come from generation-notes.
- Ratings, CAS, terminal states and historical marker come from generation-ratings.
- Catalog, epochs, field counters and terminal Collection traces come from catalog.
- Scoped membership transitions and guards come from memberships.

The composer checks unchanged protocol/lifecycle/purge clauses in every source,
unchanged library validators outside the permission delta, and exact equality of
the resulting independently assembled tree with the latest accumulated rules.
It also checks absence of broad writes at user, bookData, book, catalog and
record-list ancestors. The one generation-level write grant is unchanged: an
already deleting lifecycle may purge the entire generation to null, optionally
finalizing deleted atomically. It grants no active-generation replacement.
The earlier text/value/boolean placeholders are superseded by their closed schemas.

This is more than copying the latest file: stage deltas and the explicit
library permission conflict are part of the checked artifact.

## Historical-source contract correction

The library service now treats note/review as initialization-only sources.
Its generic patch validator rejects either key (including mixed/no-op patches)
with `generation-library/historical-source-readonly` before RTDB access.
The two compatibility setters reject through the same route. Initialization still
accepts sanitized sources only while creating. Reads and explicit notes/ratings
conversions remain available; they never rewrite these text sources. Statuses,
dates, scalar rating and captured-generation retries retain their behavior.
The combined rules and all source rules remain unchanged. The two contract cases
now assert local rejection, no partial date update, source preservation and no
active-state reinitialization bypass. The end-to-end case checks actual conversions.

## Actually executed end-to-end evidence

One test runs all real services under these exact combined rules:

1. Initialize protocol; create generation 1; initialize library before activation.
2. Move through reading to finished, respecting rating status preconditions.
3. Create multiple notes, edit and pin one, and create/update multiple ratings.
4. Read before conversion and confirm no implicit creation of markers/destinations.
5. Explicitly convert historical note, review and rating; repeat conversions without
   duplicate IDs. Delete converted note/rating and confirm terminal copies remain
   deleted while markers suppress reconversion.
6. Create three Collections, add memberships, remove/readd deliberately and reject
   a stale removal; clear a Collection and reject its old epoch before explicit readd.
7. Delete another Collection and confirm raw residual membership is ineffective.
8. Create a second book sharing a live Collection.
9. Lock the first generation durably; reject later note/rating/membership/status
   operations and verify unchanged generation data during the lock.
10. Purge and verify the entire bookData/{bookId} is null, including library personal
    sources, active/deleted notes/ratings, all source markers and membership rows.
    The technical lifecycle remains deleted; the second book and catalog are unchanged.
11. Readd the same book under generation 2 without historical sources. Read all
    new services: no notes, ratings, markers or memberships are inherited. Replaying
    old mutation and conversion envelopes is rejected; generation 1 stays absent.

## Additional matrices

| Group | Tests | Assertions |
| --- | ---: | --- |
| Book deletion races | 8 | Note create/patch/pin, rating create/update, status, membership add/remove. Delete succeeds; competing intent may succeed before lock or reject. Purge is physically complete, replay fails after readd, other book/catalog stay unchanged. |
| Ordered accepted-before-lock operations | 8 | Every book race mutation is also acknowledged before lock. Its exact field/revision is verified, replay after lock is rejected without changing the committed snapshot, then the whole book subtree is purged. |
| Collection clear/delete versus add | 2 | Old-epoch additions are absent or physically residual but ineffective; old intent cannot retarget epoch 2. Repeating clear does not increment twice; explicit epoch-2 add works. |
| Concurrent membership remove and readd | 1 | Duplicate remove converges to revision 2; explicit readd uses revision 3; old remove is rejected without mutation. |
| Concurrent book delete/readd | 1 | Duplicate delete and successor initialization never skip or increment generation twice; generation 2 starts without personal data. |
| Real offline book queues | 9 | Note, rating and status writes each delayed across lock, purge and readd. Positive online controls establish valid payloads. Queue stays pending at a server barrier, then rejects after reconnect; old/new generation snapshots are checked. |
| Real offline membership queues | 3 | Add delayed across clear/delete, remove delayed across remove/readd. Captured path/epoch/revision stays fixed, no partial/residual overwrite. |
| Accepted-before-lock control | 1 | Real acknowledged note write is present before lock and remains until complete purge. A rejection is never treated as evidence of no earlier commit. |
| Discarded confirmation and retry | 2 | Real note/rating create commits; caller deliberately discards confirmation. Another real client repeats the frozen envelope; stored record is identical, with no duplicate or extra revision. This is a caller-boundary fault, not claimed TCP acknowledgement loss. |
| Conversion versus lock | 3 | Note/review/rating conversion either leaves no pair or an atomic marker/destination pair, even on rejected confirmation. Historical source stays intact. Purge removes the entire book subtree; retry never touches generation 2. |
| Direct authenticated SDK attacks | 28 | Other owner, stale generation, creating/deleting/deleted lifecycle, deleted Collection, stale epoch and three revisions, note/rating/catalog tombstone resurrection, null removal of four branches, ancestor replacements, hostile multipath, three immutable identities, both historical text fields, cross-branch status/lock and forged conversion. Every denial preserves all four owner-readable branches. |

These 66 cases supplement the original end-to-end case and two historical-setter
contract checks. SDK queues use goOffline/goOnline, attach handlers immediately,
and assert pending at an independent server checkpoint. An eight-second timeout
bounds a missing acknowledgement; no sleep orders races. BOOK_RACE,
COLLECTION_RACE, OFFLINE_RESULT and CONVERSION_RACE lines record actual outcomes.
Concurrent tests assert allowed stored outcomes rather than assuming the winning
promise or assuming rejection proves rollback. Ordered pre-lock controls and
post-lock/offline cases complement naturally competing calls; finite tests do not
exhaust every possible scheduler or physical network fault.

The attack observer reads bookProtocol, bookLifecycle, bookData and collectionCatalog
separately. Reading users/{uid} is intentionally forbidden, including for its owner;
no permission is added for test convenience. The attack itself uses direct SDK
writes, independently of the service's preflight guards. All fixtures are created
through real authenticated services, not administrative data injection.

## Residual data and remaining architectural scope

Clearing a Collection changes membershipEpoch; it does not erase all book rows.
Deleting a Collection leaves a terminal catalog tombstone and can leave present
old membership rows. Both kinds of residual row are ineffective. Explicit add at
the new epoch replaces the scoped row; book purge physically removes all its
rows, sources, markers and destinations. The other book and user catalog survive.
No global cleanup or automatic migration is implemented.

No atomic multi-book mutation API is introduced. Future bounded batches require
frozen per-tuple CAS and all-or-nothing guard validation; omitted no-op/missing
rows cannot prove complete selection freshness. Chunking needs explicit partial
outcomes and reconciliation, not automatic compensating writes.

Membership-driven catalog activity is still not written by the membership service.
Matching legacy activity sorting would require an explicitly authorized atomic
catalog-activity contract without faking a metadata or pin edit or exhausting
unrelated field counters. No activity fix is implemented here.

Old-epoch or deleted-Collection residual membership nodes remain physically stored
until book purge or a future scoped cleanup protocol. They must remain ineffective;
cleanup must never remove a newer generation/epoch. Account deletion requires a
separate audit of users/{uid}/bookProtocol, bookLifecycle, bookData, collectionCatalog,
legacy paths and Auth deletion/retry semantics. No account process was modified or
validated here.

If all clients close while deleting is locked, data can remain until an authorized
client calls resumeDeletion with the same captured context. There is no autonomous
backend cleanup worker. A no-client recovery test has not yet been executed here.
Multi-node reads are not atomic snapshots; results can become stale immediately.
Effect reconciliation is not exactly-once execution or proof of who performed a write.

## Validation of this matrix expansion

Actual executions in this reprise (not inherited results):

| Suite/check | Result |
| --- | --- |
| Combined integration | 69/69 |
| Memberships | 48/48 |
| Catalog | 51/51 |
| Ratings | 40/40 |
| Notes | 34/34 |
| Library | 50/50 |
| Lifecycle service | 41/41 |
| 8B.2 prototype | 36/36 |
| Main RTDB | 129/129 across 3 files |
| Full unit suite | 938/938 across 56 files |
| Rule composition | Verified |
| Targeted Oxlint | No diagnostics |
| Global Oxlint | 11 existing warnings, no errors |
| Build | Passed, 2105 modules |
| Tracked and eight untracked whitespace checks | Passed |

Emulators use only demo-dear-pages, Java Linux 21 and Auth/RTDB on 127.0.0.1.
The temporary batch runner loads each suite's own rules through the local Emulator
settings endpoint between suites, then invokes Vitest with that suite's config.
Lifecycle service uses the original book-lifecycle rules; main RTDB uses
emulator/database.rules.json. No source rule file is rewritten or deployed.

Observed concurrent book mutations all lost to deletion in the recorded run;
the eight ordered positive controls separately prove that each mutation can commit
before lock and is then completely purged. Clear/delete also won the concurrent
add races, leaving no row. Conversion/lock races left no marker/destination pair.
The existing end-to-end case separately proves successful conversion pairs,
terminal markers, physical old-epoch/deleted-Collection residuals and full purge.
All 12 real offline queues were pending at their server checkpoint, then rejected
with PERMISSION_DENIED on reconnection, with expected server snapshots preserved.

Initial test development exposed two harness mistakes: 28 attack cases attempted
to read the forbidden owner parent (33 passed/28 failed); after switching to the
four readable branches, the root multipath helper still passed an empty SDK path
(60 passed/1 failed). Correct root ref construction resolved it. The subsequent
61-case run passed, as did the final 69-case expansion. A temporary batch-runner
path incorrectly assumed lifecycle had its own rules file; it was corrected in
/tmp to reuse book-lifecycle rules. No service, contract or rule was changed to
resolve these test harness errors. No intermittent application failure observed.

Verdict: GO to close isolated 8B.3.5 validation. This does not authorize application
integration, migration, production, deployment or the next phase. No commit made.

# Phase 8B.2 — isolated RTDB generation proof

Experimental rules and direct SDK tests only. No React/application service,
existing emulator rules, default Firebase config, npm script or deployment is
changed. Production remains NO-GO. This does not start phase 8B.3.

## Run

Requires the already installed dependencies, Java 21+ and Firebase CLI in PATH.
Stop existing demo emulators first: the prototype reuses the fixed localhost
ports (Auth 9099, RTDB 9000, Hub 4400, logging 4500), never alternative ports.

From the repository root:

```sh
node experiments/book-lifecycle/run.mjs
```

The runner checks the separate config against the existing demo configuration,
checks that ports are free, and starts fresh Auth/RTDB emulators with the fixed
project `demo-dear-pages`. No imports/exports. Tests check the demo Hub, local
services and unauthenticated root denial before initializing any Firebase SDK.
The separate config has the existing unconditional refusal script as predeploy
hook. Do not invoke a deployment command to test that hook.

WSL tools available during this proof were outside the repository:

```sh
PATH=/tmp/dearpages-java/bin:/tmp/dearpages-firebase-tools/node_modules/.bin:$PATH \
XDG_CONFIG_HOME=/tmp/dearpages-poc-config \
node experiments/book-lifecycle/run.mjs
```

Java 21.0.13, Firebase CLI 15.34.1, Node 24.21.0, RTDB emulator 4.11.2.
The temporary XDG config directory avoids using the usual CLI config/credentials
for this execution. The runner does not handle credentials; Firebase CLI itself
is an external tool, not a network sandbox. Never run with real test users or
substitute a real project ID. The existing deployment-guard regression expects
CLI 15.31.0 and was not rerun with this different installed CLI version.

## Schema actually tested

```text
users/{uid}/bookProtocol = { version: 2, state: "ready" }
users/{uid}/bookLifecycle/{bookId} = { generation: integer, state: string }
users/{uid}/bookData/{bookId}/{generation}/
  library = { title: string <= 200, status: known reading status }
  bookNotes/{noteId} = { text: string <= 200 }
  bookRatings/{ratingId} = { value: integer 1..5 }
  collectionMemberships/{collectionId} = true
```

Generation keys are canonical decimal strings. The lifecycle generation is an
integer in [1, 2147483647]. The counter is permanent; readd increments it exactly
once and cannot occur until all book data is absent. No counter rollover.

Allowed transitions:

```text
absent -> creating(1)
creating(g) -> active(g), with library present in the resulting state
creating(g) -> deleting(g)
active(g) -> deleting(g)
deleting(g) -> deleted(g), with all bookData/{bookId} absent
deleted(g) -> creating(g+1)
```

Creating permits only initial library insertion; active permits ordinary record
mutations; deleting blocks ordinary mutations, including membership deletion.
Active note/rating physical deletion is intentionally forbidden in this minimal
proof. This tests that purge can bypass those ordinary deletion restrictions
without weakening normal access. Existing production-shape schemas, revisions,
HTML, historical markers and tombstones are not reimplemented here.

## Important rule behavior demonstrated

`root` is the state BEFORE a multipath write. `newData.parent()` ancestors expose
the merged state AFTER that write, including sibling paths. Paths back to the
user differ by rule depth; they are explicit in the JSON, not runtime helpers.

At a generation node, `.write` grants only a null resulting subtree while the
old lifecycle is deleting that same generation. Normal grants exist only below
it, at library/record/membership nodes; no general user or book ancestor write
grant exists. Parent `set`/`remove` is distinct from a multipath `update` targeting
authorized descendants.

The final operation is:

```js
update(userRef, {
  [`bookData/${bookId}/${generation}`]: null,
  [`bookLifecycle/${bookId}`]: { generation, state: 'deleted' },
})
```

The lifecycle rule requires the resulting book subtree to be entirely absent.
The purge rule checks the old deleting state and the resulting matching
generation/state. Both paths succeed or fail together. A lock plus data mutation
in one update is denied by checking BOTH before and after states. Lock plus
purge is deliberately denied: acquire and acknowledge the lock first.

Required fields, closed schemas and null priorities are validated. Deletion
authorization is in `.write`, since `.validate` does not run on null nodes.
Protocol and lifecycle deletion are denied in `.write`, not merely validation.

## Test scope and results

Final prototype run: **36 passed, 0 failed, 0 skipped**. Tests use two different
Auth UIDs, two SDK connections for one owner, and an anonymous SDK connection.
Server outcomes are read via another authenticated connection; rejected writes
are checked against before/after snapshots. Another book and the other UID's
same book ID are explicitly preserved.

Existing application regressions were run separately with the original rules:
**534 unit tests passed** (43 files), **129 RTDB tests passed** (3 files), no
failures or skipped tests. The experimental directory passes Oxlint with no
warnings. No build was needed for this rules-only proof.

Commands from the repository root (with the same Java/CLI PATH and temporary
XDG config directory for the emulator command):

```sh
node node_modules/vitest/vitest.mjs run
firebase emulators:exec --config firebase.emulators.json --project demo-dear-pages --only auth,database 'node node_modules/vitest/vitest.mjs run --config vitest.rtdb.config.js'
./node_modules/.bin/oxlint experiments/book-lifecycle
git diff --check
```

Covered: creating/activation, normal active writes, protected entry deletion,
deleting lock, atomic and split purge/finalization, readd, stale creates/edits/
removals/transactions, illegal transitions, counter/protocol/ancestor protection,
hostile multipath writes (including cross-UID), offline queued creation replay,
offline interruption/resume, rejected partial attempt/resume, concurrent locks,
concurrent purges, concurrent edit/lock and discarded caller result recovery.

Initial run: 32 passed, 1 failed. The failing test incorrectly expected a rules
rejection for generation key `1.0`; Firebase SDK rejects dots in paths before
sending a request. The final test distinguishes SDK path validation from server
authorization. Three additional scenarios brought the final count to 36.

An uncertain acknowledgement is injected by discarding a successful result and
throwing at the caller boundary, then reading server state independently. This
does NOT claim to simulate a TCP acknowledgement loss. Offline cases use real
SDK goOffline/goOnline. Competing purge losers may be denied; clients must read
the lifecycle to distinguish an already completed operation from a failure.

## Limits before application integration

- Rules cannot determine that a client intentionally resubmits old content as a
  new operation under the current generation. They reject the old path/epoch.
- A transaction callback must capture its expected generation. Automatically
  retargeting an old intention to the latest generation is an application bug
  outside this rules-only proof.
- No progress is possible after all clients disconnect. Deleting is durable and
  resumable but does not guarantee an automatic erasure deadline.
- The lifecycle retains UID/bookId association, generation and state after purge.
  It contains no note/rating but is a persistent technical trace.
- No migration, historical marker transfer, real collection catalog lookup,
  general note concurrency, UI success/error flow or account deletion is proven.
- No background jobs, deployed rule parity, arbitrary restore/admin protection
  or production readiness is claimed.

GO for starting 8B.3 only after explicit user authorization. Keep this isolated
proof until the real schemas, migration and client context are separately tested.

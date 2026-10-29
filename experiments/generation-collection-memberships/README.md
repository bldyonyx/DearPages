# Isolated generation-aware Collection memberships — 8B.3.4.5

Only `demo-dear-pages`, Auth `127.0.0.1:9099`, RTDB `127.0.0.1:9000`.
The dedicated configuration refuses deployment. No application singleton, hooks,
components or existing services are modified/imported for integration. Production
remains NO-GO. No migration of legacy `collections/{id}/books` is included.

## Run

Use the existing Linux Java 21, cached emulator JAR and Firebase CLI. Set
JAVA_HOME/PATH for the command only, CI=true, NO_UPDATE_NOTIFIER=1 and a temporary
writable XDG_CONFIG_HOME. From the repository root:

```sh
node experiments/generation-collection-memberships/run.mjs
npm run test:run -- src/test/generationCollectionMembershipService.test.js
```

The runner pins the demo configuration, refuses forwarded arguments and checks
loopback ports. It does not install tools or dependencies or export/deploy data.

## API and captured scopes

`createGenerationCollectionMembershipService(database)` uses an injected client
Database. The existing lifecycle guard verifies configured AND actual SDK host,
namespace, project, client credentials, emulator metadata and Auth emulator before
references are opened. Auth ownership is rechecked across asynchronous reads and
before writes. The service never discovers a replacement book generation or
Collection epoch during a retry.

- `getRawMembership(context, collection)` returns the frozen raw stored triple
  or null at the exact captured path, including stale-epoch/residual rows. It is
  an owner-scoped diagnostic read and does not claim effective membership.
- `getMembership(context, collection)` returns
  `{context, collection, raw, token, effective, reason}`. `reason` reports failed
  business guards; network/malformed data errors reject rather than trusting cache.
- `getBookMemberships(context)` returns
  `{context, reason, memberships, effective}`. `memberships` contains views of
  every stored row, with Collections scoped to each raw row's epoch. `effective`
  filters only currently valid present rows. It does not search another book
  generation or return every empty Collection.
- `addBook(context, collection, expected = null)` initializes an effectively
  absent row or explicitly readds using a captured false-row token.
- `removeBook(context, collection, expected)` requires an acknowledged token.
- `execute(operation)` accepts the existing immutable membership envelope.
- `reconcile(operation)` checks uncached server evidence without writing.
- `verifySelection(selection)` defensively captures the existing immutable
  selection contract and compares observed tokens using
  `assertCollectionSelectionCurrent`. It returns the captured copy, not a
  potentially caller-mutated nested array. This is observational validation,
  not batch authorization or an atomic multi-book snapshot.

The signatures reused directly are:
`createCollectionContext({uid, collectionId, epoch})`,
`createCollectionMembership({epoch, present, revision})`,
`createMembershipConcurrencyToken({context, collection, membership})`,
`createMembershipOperation({context, collection, intent: 'add'|'remove', expected})`,
`createCollectionSelection({collection, entries: [{context, expected}]})`.

Book and Collection contexts and tokens are copied/frozen. Operations are rebuilt
and descriptor-validated before I/O, including their type, entry ID, desired triple
and changes flag. No new ID, generation, epoch, revision or intent is allocated
opportunistically on retry. SDK paths are raw; REST encodes every validated segment
exactly once, rejects redirects and redacts credential URLs on network failures.

## Exact stored schema

```
users/{uid}/bookData/{bookId}/{generation}/collectionMemberships/{collectionId}
```

```js
{ epoch: 1, present: true, revision: 1 }
```

No book/Collection metadata, timestamps, operation journal or duplicated ID is
stored. Epoch and revision use the catalog's tested 1..2147483647 profile, avoiding
the installed SDK's known numeric hash divergence near 2^53. Generic 8B.3.4.1
models remain unchanged; this service and the experimental rules enforce the
narrower profile. Malformed old boolean placeholders are rejected, not migrated.

## Add, remove and explicit readd

A first add uses revision 1. Removing flips true to false and increments exactly
once, retaining the node; physical null deletion is forbidden. A new explicit add
with the false-row token flips it back to true with another exact increment.
An initial delayed add cannot overwrite a false row, and a stale removal cannot
undo a later readd. Unchanged assignments retain the revision and are reconciled
read-only. Identical concurrent transitions may both confirm the same effect,
without claiming both executed a write or exactly-once execution.

Revisions are monotone **within each book-generation/Collection-epoch scope**.
After catalog clear, an older stored epoch is effectively absent. Only an explicit
add targeting the currently captured new epoch may replace that obsolete row with
revision 1. This is a new scoped counter, not a reset within the old epoch. The old
operation remains bound to its old epoch and cannot be promoted automatically.
A future/contradictory stored epoch fails closed instead of being overwritten.

At maximum scoped revision, further presence changes are refused. A no-op at the
same maximum revision is readable/reconcilable. An explicit catalog clear followed
by a new-epoch add or book-generation purge remains possible; there is no automatic
counter reset. Catalog metadata activity is intentionally untouched. Reproducing
legacy membership-driven activity ordering requires a separate catalog activity
contract; it is not silently simulated with unrelated metadata or pin changes.

## Server invariants

This rules copy preserves the previous catalog, lifecycle, library, notes and
rating rules and only adds the new membership leaf policy. Both **before and
after** an authorized row write must have:

- Authenticated matching owner and protocol version 2 / ready.
- The exact captured current book generation with lifecycle active.
- The existing library record in that generation.
- An existing live Collection at the row's captured current membershipEpoch.

At the row boundary, rules enforce exact required fields/types, no priorities,
integer bounds, present/revision CAS and allowed transitions. Initial or obsolete
rows may only become true/revision 1 in the authoritative current epoch. Same-epoch
changes must flip presence and increment exactly one; unchanged triples may be
idempotent no-ops. Revision jumps, resets, removals of required fields and a new
false row are rejected. Checking the parent is essential when a hostile partial
SDK patch leaves the revision child unchanged.

No write grant exists at membership, active-generation or user ancestors. A
multipath request cannot bootstrap Collection+membership, activate+add a book,
clear+write a new epoch, delete Collection+alter a row, lock+mutate, or change the
protocol to bypass checks. Requests touching multiple leaves fail atomically if
one target is invalid. No cross-user or unrelated-book operation is authorized.

The preexisting generation-level purge grant remains the sole exception to
physical row removal: it requires an already durable deleting lock and null for
the whole generation, optionally atomically finalizing deleted. Purge removes
present and false memberships with all other generation data. Readding a book
uses a distinct generation path and inherits no memberships. Real queued old-path
writes are denied after lock/purge/readd even when the book ID is unchanged.

## Raw and effective reads; consistency limits

Effective membership requires a current active book generation, existing library,
live Collection, matching current epoch and present true. A false, absent, stale,
deleted-Collection or old-generation row is not effective. Current-epoch false
rows still return a CAS token so a deliberate readd is possible. Obsolete rows
in a valid newly captured epoch return raw evidence but no token; an explicit
new add uses expected null. Reads never silently change the caller's scope.

Uncached authenticated REST reads bracket the membership read with lifecycle and
catalog observations, plus protocol and library evidence. Monotone book-generation
and catalog-epoch/terminal guards let detected races fail closed. These are still
multiple requests: a membership can change after it was read, and separate books
are not observed atomically. Selection verification may become stale immediately.
A mutation must always pass its own SDK transaction and server rules afterwards.
No result is a lease. Network errors do not turn cached or optimistic data into
server evidence. Administrative corruption/privileges are outside these claims.

If clear/deletion wins after a write committed but before reconciliation, the
operation can reject even though its old-scope triple remains physically stored.
A rejection does not prove no write occurred. The desired exact triple plus valid
original guards can be reconciled; newer revisions/epochs/generations cannot be
relabelled as success. Fault tests throw after actual SDK commits at the caller
boundary, not actual TCP packet loss. Real offline queues are separate tests.
SDK promises may remain pending until reconnect; there is no cancellation or
background-worker guarantee.

## Residual data and cleanup

Catalog clear/delete does not traverse books or physically delete old membership
rows. Those rows become ineffective; no live Collection can reuse a terminal ID.
Book deletion physically purges all generation rows. Cleanup of stale epochs or
retired Collections across surviving books is deferred: it will need an explicitly
scoped, resumable protocol that cannot remove a newer epoch or generation. No
cleanup grant or worker is introduced here. No metadata is copied between scopes.

## Multi-book / multi-Collection operations: not implemented

Legacy updateCollectionBookMembership/updateBookCollectionMembership compute
set differences and issue atomic multipath writes to unversioned books maps.
That UI behavior is not reproduced by a loop of single-row calls: such a loop
could partially succeed. This API intentionally exposes no batch mutation.

A future bounded batch could capture every book-generation, Collection epoch and
expected row, then use one atomic multipath request with exact per-leaf CAS and
all guards checked before/after. Selection-wide no-ops, especially missing rows,
need additional design: omitting them does not assert their continued absence.
Do not add an ancestor write grant to solve this. Large chunked batches would
also need explicit partial-result/reconciliation semantics, not compensating
writes that could undo concurrent new user intent.

Before such an API, tests must cover mixed valid/invalid rows with all-or-nothing
results; no-op/missing rows; generation readds; clear/delete races; revisions at
bounds; lost acknowledgements and offline queues; duplicate/cross-owner tuples;
size limits and snapshot/selection completeness. New authorization is required
before expanding scope. Current selection verification is not that API.

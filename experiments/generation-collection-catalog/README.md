# Isolated Collection catalog — 8B.3.4.4

Only `demo-dear-pages`, local Auth `127.0.0.1:9099` and RTDB
`127.0.0.1:9000`. The dedicated configuration refuses deployment. Existing
application services, hooks, components, main rules and previous experiments are
unchanged. Production remains NO-GO. This is not a membership implementation.

## Running

With the already installed Linux Java 21, cached RTDB JAR and Firebase CLI, set
JAVA_HOME/PATH for the command only, `CI=true`, `NO_UPDATE_NOTIFIER=1` and a
writable temporary XDG_CONFIG_HOME. From the repository root:

```sh
node experiments/generation-collection-catalog/run.mjs
npm run test:run -- src/test/generationCollectionCatalogModel.test.js src/test/generationCollectionCatalogService.test.js
```

The runner checks the fixed demo configuration, refuses arguments and tests the
four loopback ports. It performs no installation or export/import/deployment.

## API and immutable intents

`createGenerationCollectionCatalogService(database)` takes an injected client
Database. It reuses only the lifecycle's fail-closed connection guard, not book
lifecycle operations. Both configured and actual host/namespace/emulator metadata
and Auth emulator configuration must match the fixed demo environment. It rejects
admin SDK credentials and owner mismatches before opening references.

- `createCollection(context, metadata)` requires a stable caller-supplied ID in
  `createCollectionContext({uid, collectionId, epoch: 1})`.
- `getCollection(context)` reads that captured epoch or fails stale; deleted and
  absent collections return null.
- `getCatalog(uid)` is explicit discovery, returning live records and their current
  frozen contexts/tokens. It is never called internally to redirect a mutation.
- `updateMetadata(context, patch, token)` touches only name/description/icon fields
  explicitly supplied. It accepts independent changes from the same snapshot.
- `setPinned(context, boolean, token)` is an explicit assignment, never a toggle.
- `clearCollection(context, operationId, token)` captures one deterministic next
  epoch. Allocate a fresh stable push-style operation ID before sending.
- `deleteCollection(context, token)` requires the exact current global revision.
- `execute(operation)` and `reconcile(operation)` accept frozen canonical envelopes
  from `createCatalogOperation` in `generationCollectionCatalogModel.js`.
  Reconciliation is read-only and never allocates an ID or selects a newer epoch.

The model reuses the pure Collection context/counter utilities and validated SDK
path builders from 8B.3.4.1. It exposes metadata validation, immutable snapshot
creation and the existing ordering comparator. It performs no Firebase access.
Strict own-data descriptors reject accessors, symbols, hidden/extra fields and
malformed nested records before accessing caller data. SDK paths remain raw;
REST encodes each validated segment exactly once and refuses redirects.

Mutation results are `{context, collection, deleted}`. A successful clear returns
its explicitly computed successor context; it does not mutate the original
context or resolve an arbitrary server epoch. Live views and nested counters/tokens
are frozen copies, not caller/server objects frozen in place.

## Metadata compatibility and schema

Storage: `users/{uid}/collectionCatalog/{collectionId}`.
Live fields:

```js
{
  name, description, icon, pinned,
  createdAt, updatedAt,
  membershipEpoch, revision,
  fieldRevisions: {name, description, icon, pinned},
  creation,             // immutable SHA-256 of normalized initial metadata
  lastClearId,          // absent until the first clear
  lastClearFrom         // previous captured epoch, absent until the first clear
}
```

No `books`, modifiable book list or membership projection is accepted. Existing
behavior inspected in collectionsService/useCollections/useCollectionPage is
retained: nonblank trimmed name, trimmed description defaulting to empty, default
icon `library`, and pinned false at creation. Unknown nonempty string icon IDs
remain accepted, as in the old service. No new name/description length limit is
introduced. Non-string metadata is rejected explicitly. Defaults are parity-tested
against the existing icon constant without importing its React icon graph at runtime.

Ordering remains pinned first, then descending updatedAt (createdAt fallback).
Metadata edits and pin assignments count as activity, even if the supplied value
is unchanged. **Logical clear preserves updatedAt**, matching existing
clearCollectionBooks/useCollectionPage behavior. Membership-related activity
will require a separate contract in the membership phase; it is not implemented.

A creation replay must retain the same normalized initial content. Its immutable
SHA-256 fingerprint permits an identical retry after metadata edits without
restoring old fields, but never across an epoch change or terminal deletion.
The fingerprint is not an authorization secret, author proof or uniqueness claim.
It is removed on deletion. No extra copy of the initial personal metadata is stored.

## Concurrency and server enforcement

All writes are SDK transactions with applyLocally false and server hash CAS.
Explicit uncached REST baselines permit valid non-destructive proposals on a cold
SDK cache. Every callback repeats its identity, epoch and relevant counter checks;
conflicts abort with undefined rather than throwing into the SDK event loop.

Global revision starts at 1 and increments exactly once per live mutation or
terminal deletion. Each touched metadata/pin field independently increments its
counter, even for an explicit assignment of the same value (preserving edit/pin
activity). Independent fields can merge despite a newer global revision; a touched
field must still match its captured counter. Same-field ABA edits are therefore
stale even when text returns to its old value. Deletion requires exact global CAS.
Metadata/pin execution with an old touched-field token fails; explicit readonly
reconcile may confirm the exact intended next field counter and payload.

Rules enforce these cross-field conditions at the **Collection record boundary**,
not only on counter children that an attacker could leave unchanged. Changes of
content without the field counter, jumps/resets, identity/fingerprint changes and
unexpected fields are rejected. Epoch changes cannot be combined with metadata or
pin changes. Ready protocol and ownership must hold before and after writes.
There is no write grant at catalog/user ancestors. Null cannot bypass terminal
or required-field conditions. Hostile atomic multipath writes are checked against
the complete proposed state, not trusted preflight reads.

## Logical clear and retry identity

Epochs start at 1 and are integers bounded by CATALOG_MAX_COUNTER (2147483647). A clear targets exactly the
successor of its captured epoch and records `{lastClearId, lastClearFrom}`. It
retains all metadata and field counters, advances global revision and preserves
activity timestamp. A clear may preserve a metadata edit committed first, but an
old-epoch edit cannot write after clear.

Retrying the same envelope may only confirm that same successor and marker;
it never computes `currentEpoch + 1`. Intervening metadata/pin changes preserve
the marker, so such a retry is read-only. After another clear advanced the epoch,
the old intent is stale and cannot invalidate subsequent additions. Two distinct
concurrent clear IDs for the same predecessor have one winner; identical intents
converge. Consecutive reuse of the same clear ID for a different epoch is rejected.
The captured epoch is part of intent identity; there is no unbounded operation
journal or global uniqueness proof for arbitrary IDs intentionally reused by a caller.

**No membership visibility or authorization guarantee is claimed.** Increasing
the catalog epoch provides the future discriminator; future membership readers,
writers and rules must compare it authoritatively. This experiment rejects all
ordinary SDK writes to the inherited membership branch rather than exposing its
old boolean placeholder. Local admin fixtures may seed residual memberships to
prove clear/deletion leave physical book data untouched. They are fixtures, not
a membership service or a security proof for that proposed membership schema.
No book traversal, logical add/remove or physical cleanup is performed.

## Terminal deletion and numerical bounds

The permanent technical tombstone is exactly:

```js
{deleted: true, createdAt, membershipEpoch, revision}
```

Name, description, icon, pinned state, activity timestamp, field counters,
creation fingerprint and clear marker are removed. The owner can read the
technical trace for reconciliation, but public catalog reads hide it and no
metadata remains. The ID is permanently retired; even identical raw overwrites,
physical null deletion and attempted recreation are rejected. Books, residual
memberships and other Collections remain untouched. Account deletion is not
implemented in this phase; tombstone retention is intentional and permanent
within this catalog protocol.

Epoch/field counters allow 1..CATALOG_MAX_COUNTER (2147483647) and never reset. Exhausted
counters reject the affected mutation. The last supported **global** revision is
reserved for terminal deletion: live revision is at most CATALOG_MAX_COUNTER - 1,
so an exhausted live record remains deletable. Technical timestamps retain their
existing nonnegative JavaScript-safe-integer range; they are not 32-bit counters. Epoch exhaustion still permits
metadata/pin edits and deletion; field exhaustion still permits independent
fields or deletion. Local admin fixtures exercise these boundaries; the service
never receives privileged credentials.

## Evidence and limitations

Lost acknowledgements are simulated after real SDK commits at the caller
boundary, not by claiming actual TCP fault injection. Only server evidence can
confirm uncertain results. SDK promises can remain pending while offline; there
is no cancellation guarantee or background reconciliation worker. Real offline
queues retain their original paths and old counters, and tests verify refusal
after deletion/clear. Later activity can make an earlier operation unconfirmable;
matching state proves the intended effect, not who executed it or exactly-once
execution. SHA-256 is not an authorization mechanism.

The guard deliberately depends on the pinned SDK's internal emulator metadata
and fails closed if its shape changes. No React projection, membership service,
cleanup, migration, production deployment or integration is included. The full
membership protocol and its activity/cleanup policy remain decisions for the
next authorized phase. Production stays NO-GO.

## Numeric SDK diagnostic and compatibility profile

A differential local test found SDK transactions reach maxretry for records with
9007199254740990/9007199254740991 counters, while authenticated REST If-Match PUT
succeeds against the same rules. The installed SDK numeric hash conversion
(doubleToIEEE754String) returns different IEEE-754 bytes than DataView for those
values. At 2147483647 the hashes agree and the real SDK transaction commits.
No SDK or dependency is patched. This catalog explicitly narrows its counter
profile to 32-bit positive integers, matching the established book-generation
ceiling. Generic 8B.3.4.1 contexts remain unchanged and can represent larger
proposals; catalog factories/tokens/rules reject epochs or counters outside the
catalog profile before a write. This cap must be respected by future memberships.

The RTDB rule compiler also rejects the whitespace shorthand and literal line
terminators in regexes. The nonblank-name test uses explicit whitespace ranges
with safe non-whitespace endpoints, admitting those four endpoints separately
via contains. This matches trim's whitespace set without banning ordinary
non-whitespace controls or punctuation that the existing service accepts.

A post-commit epoch race can leave an edit stored but its promise rejected as
unconfirmable in the original epoch. The concurrent clear/edit test checks both
legal serializations in RTDB and never equates a rejection with absence of a write.

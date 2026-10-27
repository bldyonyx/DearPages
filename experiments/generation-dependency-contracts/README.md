# Phase 8B.3.4.1 — pure generation dependency contracts

These are immutable client-side intent/snapshot models only. No SDK import,
Firebase connection/write, clock, ID allocation, migration, rule change or React
integration is introduced. No production schema or authorization is approved.
Firebase production remains NO-GO.

## Shared contract

Book contexts retain exactly `{ uid, bookId, generation }` from 8B.3.1. Existing
frozen contexts are validated and copied. No builder looks up or substitutes a
generation. Stable IDs are supplied before the first send; validation does not
prove uniqueness. A future allocator/service must handle actual ID collisions.

Each operation has `context`, a closed `type`, `entryId`, a copied/frozen `payload`
and `expected` (null or an immutable scoped token). Type-specific immutable fields
describe comparison policy or technical revision intent. All nested records and
arrays returned by the factories are frozen. Caller objects are not frozen or
retained as mutable references. Retry by retaining this operation, not by reading
a newer context or choosing a different ID/payload. No mutable Set/Map is exposed.

Inputs must be ordinary own enumerable data properties, with exact required/
optional fields. Symbols, hidden fields, accessors, custom prototypes, sparse or
decorated selection arrays and implicit coercion are rejected. Getters and custom
array iterators are not invoked. Book/entry/catalog keys reuse the conservative
128-unit RTDB segment validation from 8B.3.1, including its reserved-name policy.

`generationOperationUtils.js` contains internal descriptor readers, context
comparison and numeric helpers; use domain factories as the public boundary.

## Notes — generationNoteContracts.js

| Public factory | Input / captured contract |
| --- | --- |
| `createNoteConcurrencyToken` | `{ context, entryId, createdAt, fields: { title, contentHtml, date } }`. Acknowledged integer createdAt >= 0; byte-exact content snapshot, not an edit revision. |
| `createNoteCreateOperation` | `{ context, entryId, payload }`. Stable supplied ID; optional title defaults to empty. Reserved conversion IDs are refused. |
| `createNotePatchOperation` | `{ context, entryId, payload, expected }`. Nonempty targeted patch; `comparisonFields` includes only touched fields, leaving distinct-field merges expressible. |
| `createNoteSaveOperation` | Same envelope inputs, with all three content fields required. All content fields are comparison fields; pin state is excluded. |
| `createNotePinOperation` | `{ context, entryId, isPinned, expected }`. Explicit boolean assignment with identity comparison, not a toggle or mandatory global content revision. |
| `createNoteDeleteOperation` | `{ context, entryId, expected }`. Terminal `{ deleted: true }` intent with full content comparison; persisted tombstone shape/timestamps remain a server-design obligation. |
| `createNoteSourceToken` | `{ context, kind: 'note' | 'review', sourceVersion }`. Existing lowercase 64-hex UTF-16 source fingerprint concept, not a computed/verified server hash. |
| `createNoteConversionOperation` | `{ context, expected, date, title? }`. Captured explicit conversion civil date; deterministic independent reserved ID. Defaults match existing note/review titles. |

Limits remain title 200 and HTML 200000 UTF-16 units, existing control-character
policy, existing sanitizer and civil-date validator (0001–9999). Input HTML is
sanitized for writes using the existing environment's sanitizer. CAS snapshot
HTML is preserved exactly; a future reader must keep its acknowledged comparison
snapshot separate from sanitized display HTML. No global note revision is added.

Snapshot comparisons can detect differing values, not every intervening edit that
changed values and changed them back (ABA). createdAt identifies the entry; it is
not a reliable content revision. Pin conflicts beyond current last-writer behavior
and terminal note tombstone rules remain to decide/prove. Operation construction
alone does not prevent a future consumer from implementing comparison incorrectly.

## Ratings — generationRatingContracts.js

| Public factory/helper | Contract |
| --- | --- |
| `createRatingConcurrencyToken` | `{ context, entryId, revision, createdAt, date }`, acknowledged values and captured historical-date provenance. |
| `createRatingCreateOperation` | `{ context, entryId, payload }`; existing 20-character push ID format, initialRevision 1. |
| `createRatingUpdateOperation` | `{ context, entryId, payload, expected }`; fixed CAS token and deterministic nextRevision. |
| `createRatingDeleteOperation` | `{ context, entryId, expected }`; terminal deleted intent, nextRevision, no business content in deletion payload. |
| `createRatingSourceToken` | `{ context, sourceValue }` with integer 1..5. |
| `createRatingConversionOperation` | `{ context, expected }`; reserved legacy ID, date `''`, initialRevision 1 and no invented impression. |
| `assertSameRatingCreationIntent` | Compare two captured create operations; refuse changed ID/context/value/date/impression. Does not prove server execution or unique ownership. |

Stars remain integer 1..5. New dates must be real civil dates. Empty date is only
accepted on updates of `legacy-rating-v1` when its captured date is still unknown;
an assigned known date cannot be reset to unknown through this contract.

Impressions retain the existing rules: optional string, <=160 UTF-16 units, no
control characters. Whitespace-only becomes null, nonempty whitespace is kept,
omission remains omission and literal markup stays plain text. Caller-provided
null is invalid; normalized captured null means empty/cleared. Retry comparison
uses the current service's equivalence of omitted/empty impressions.

Revision and epoch snapshots accept 1..Number.MAX_SAFE_INTEGER. Incrementing the
maximum throws RangeError rather than wrapping/resetting. This is a client bound,
not a newly installed server rule. SDK timestamp placeholders are not CAS tokens.

## Collections — generationCollectionContracts.js

| Public factory/helper | Contract |
| --- | --- |
| `createCollectionContext` | Separate `{ uid, collectionId, epoch }`, copied/frozen. |
| `nextCollectionContext` | Deterministic captured predecessor + 1; same predecessor always yields same successor, without looking up current state. |
| `createCollectionMembership` | Proposed `{ epoch, present, revision }`, explicit boolean, positive safe integer counters. |
| `createMembershipConcurrencyToken` | `{ context, collection, membership }`. Same UID and captured epoch required. |
| `createMembershipOperation` | `{ context, collection, intent: 'add' | 'remove', expected }`. Stable collection entry ID, explicit desired value, fixed expected token. |
| `createCollectionSelection` | `{ collection, entries: [{ context, expected }] }`. Immutable dense array, one book row per book ID; no Set IDs later resolved to current generations. |
| `assertCollectionSelectionCurrent` | Compare two supplied selections; reject changed epoch/generation/record revision/presence, missing rows or changed owner. Extra observed books do not invalidate unrelated captured rows. |

Add with expected null proposes revision 1. Changes to an existing captured record
increment its revision. Repeating an already matching captured value has
`changes: false` and keeps its revision. Removal requires a captured token; an
absent-row no-op belongs to a future authoritative service read. Old-epoch tokens
cannot be relabeled with a new epoch. A clear's server execution and global
monotonicity are not proven by constructing a local successor.

This proposal adds no catalog CRUD, clear/delete, cleanup, metadata revision or
second mutable membership index. Epoch transitions, tombstone retention, ordinary
membership deletion, collection-ID reuse and physical cleanup remain unapproved
server/storage decisions. Snapshot freshness is only checked against the supplied
observed values; callers cannot use it as server authorization.

## Paths

Existing `bookGenerationPaths.js` gains:

- `bookNotesLegacyPath(context)` -> `G/bookNotesLegacy`.
- `bookReviewsLegacyPath(context)` -> `G/bookReviewsLegacy`.
- `bookRatingsLegacyPath(context)` -> `G/bookRatingsLegacy`.
- `collectionCatalogPath(uid, collectionId?)` -> user catalog or one metadata node.

Here `G = users/{uid}/bookData/{bookId}/{generation}`. Paths contain raw validated
SDK segments. A literal `%2F`, `?`, Unicode or backslash is not URL encoded here.
REST callers continue encoding each segment at their own boundary. Builders do
not create paths in RTDB or grant permissions to those future schema branches.

## Validation and future Emulator obligations

Unit tests cover immutable inputs/outputs, malicious nested getters, stable IDs,
old-context retries, token mismatches, numeric boundaries, stale selections,
exact paths and no SDK/singleton/clock/network use. A separate parity suite imports
the current services with Firebase mocked to pin business validation; the runtime
contract modules themselves import no service or SDK. Import-graph tests inspect
their local dependencies too. No existing test or business service is modified.

Before services or UI integration, Emulator tests must demonstrate every ordinary
write's owner/protocol/generation/active checks before and after commit, field CAS
and pin coexistence, terminal deletion/resurrection denial, reserved-ID/source/
marker atomicity, real cache-cold retries, uncertain results, offline queues, epoch
barriers and atomic multi-book rejection. Snapshot ABA and pin conflict policy,
counter bounds in rules, historical timestamps and migration still need decisions.
The current experimental schemas are not changed or declared compatible here.

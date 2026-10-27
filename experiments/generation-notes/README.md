# Isolated generation-aware notes (8B.3.4.2)

This experiment is restricted to `demo-dear-pages`, Auth `127.0.0.1:9099`
and RTDB `127.0.0.1:9000`. Its configuration refuses deployment. It does not
replace application rules or `bookNotesService.js`, and is not imported by UI.
Production remains NO-GO.

## Running

Use the existing Linux Java 21 and Firebase CLI, with `CI=true`,
`NO_UPDATE_NOTIFIER=1`, a temporary `XDG_CONFIG_HOME`, and Java's bin on PATH.
From the repository root: `node experiments/generation-notes/run.mjs`.
No installation is performed. Emulator JARs must already be cached.

## Service API

`createGenerationBookNotesService(database)` requires an injected client SDK
Database connected to the fixed demo Auth and Database emulators. It reuses the
lifecycle's fail-closed guard (including actual SDK namespace and connection
metadata), before opening references. Owner identity is checked repeatedly.

- `getNote(context, noteId)` returns a frozen sanitized view with a byte-exact
  immutable concurrency `token`, or null for absent/deleted notes.
- `getNotes(context)` returns all live notes, sorted by pin, civil date descending,
  creation descending, then ID. It imposes no count limit and performs no conversion.
- `execute(operation)` accepts canonical create/patch/save/pin/delete envelopes
  from `generationNoteContracts.js`. Retain the envelope for explicit retries.
- `createNote(context, noteId, payload)` requires an ID allocated before sending.
- `patchNote(context, noteId, patch, token)` compares only touched content fields.
- `saveNote(context, noteId, payload, token)` compares all three content fields.
- `setPinned(context, noteId, boolean, token)` explicitly assigns pin state,
  preserving content and both technical timestamps.
- `deleteNote(context, noteId, token)` compares content and writes a tombstone.
- `getLegacySource(context, 'note' | 'review')` returns a sanitized preview and
  SHA-256 source token. Processed sources return no preview. This is read-only.
- `convertLegacy(operation)` takes `createNoteConversionOperation` output with
  its explicit captured date, title, source token and reserved destination ID.

No method allocates IDs, finds the latest generation, activates a book, copies
across generations, or automatically retries a failed network connection.
REST reads encode each raw validated path segment exactly once. SDK paths remain raw.

## Storage and terminal deletion

Live notes are stored at
`users/{uid}/bookData/{bookId}/{generation}/bookNotes/{noteId}` with fields:
`title`, `contentHtml`, `date`, `isPinned`, `createdAt`, `updatedAt`, `creation`,
`fieldRevisions: { title, contentHtml, date }`. Each field counter starts at 1,
increments exactly when that field changes, and refuses safe-integer overflow.
It cannot be reset or advanced without the corresponding content change.
`creation` is an immutable SHA-256 fingerprint of the normalized initial content,
used for identical creation retries even after later edits. It is not a secret,
proof of authorship, global uniqueness guarantee, or authorization token.
Creation and content edits use server timestamps. Identity's `createdAt` is immutable.

A tombstone is exactly `{ deleted: true, createdAt }`. It retains no title,
HTML, date, pin state, initial-content fingerprint, field counters or update timestamp. A tombstone
cannot be removed, edited, pinned or replaced while the generation is active.
It disappears only with the generation's durable-lock-then-purge lifecycle.
It is excluded from reads of live notes. Repeated deletion with the same identity
converges without retaining content in the tombstone.

## Concurrency and uncertain acknowledgements

Transactions use `applyLocally: false`. A server REST baseline supplies a
non-destructive proposal on a cold SDK cache; the SDK's server hash comparison
retries against the actual record. Every callback repeats field and identity
comparisons. Disjoint patches and pin assignments remain mergeable; a stale
full save is rejected. There is no mandatory global note revision. Rules additionally require each
changed field counter to advance by exactly one, and all untouched counters to
stay unchanged. A raw SDK content patch without this condition, a stale whole
record, a reset, or an unrelated counter advance is rejected server-side. Pins use
explicit last-writer assignment, rather than a toggle.

Rules enforce owner, protocol ready and current active generation before AND
after the write, immutable creation identity, allowed content, and terminal
notes/markers. The parent generation only grants deletion when already locked;
it never grants arbitrary ancestor replacement. Required fields and terminal
conditions are checked at the record boundary so null cannot bypass validation.
The transaction hash supplies atomic conditional updates; rules do not treat a
client snapshot as trusted authority or require all authenticated owner writes
to originate in this service. Field-snapshot tokens cannot detect ABA edits.

After a transaction result/error the service reads server state in the original
context and verifies the intended fields, fingerprint or tombstone. An unavailable
server remains an error, never an excuse to trust optimistic cache or allocate a
new ID. Concurrent later writes can cause a conflict even after an earlier write
committed. SDK writes can remain pending while offline until reconnection; the service does
not promise cancellation of an already queued write. No exactly-once execution
or durable lease is claimed. Fault tests
throw after real SDK writes; they simulate the caller's lost acknowledgement,
not actual TCP packet loss. Direct SDK offline queue tests are separate.

## Historical conversion

Two independent singleton markers under the same generation:
`bookNotesLegacy` and `bookReviewsLegacy`. Destinations are respectively
`legacy-note-v1` and `legacy-review-v1`. Marker schema:
`{version: 1, outcome: 'empty'|'copied', sourceHtml, intent, processedAt}`.
`intent` fingerprints the captured conversion settings and source version.
`sourceHtml` preserves source evidence for server rule comparisons; unlike a
note tombstone, a marker retains historical content until generation purge.
It is never returned by the service's display API.

Markers and destinations are written atomically through multipath update.
Rules compare the source before and after, require an absent marker/destination,
and tie the copied destination to the intent and server creation timestamp. Active library note and
review sources are frozen in these experimental rules, including deletion by
null. They are historical inputs, not additional editable note stores.
An empty or absent source creates only an empty marker. A matching retry returns
the terminal outcome even after destination deletion; incompatible retries fail.
Reading never converts. Sources are not carried to another generation implicitly.

The service sanitizes the captured source using the existing sanitizer. Rules
validate the resulting HTML allowlist, source evidence and atomic pairing; they
do not implement DOMPurify or prove semantic equivalence of transformed HTML.
The existing non-browser sanitizer fallback removes tags; browser behavior
preserves permitted formatting. Both paths are tested separately. A malicious
owner can author different valid text in their own note; markers are not signed
attestations of historical content. Application sources and rules are untouched.

## Limits and remaining decisions

This is an isolated experiment, not production integration. Timestamp identity,
field-snapshot ABA behavior, source-evidence retention, lack of background
reconciliation and browser/non-browser sanitizer parity need explicit decisions
before integration. Only independent field counters are introduced; no global note revision is required. Memberships,
ratings, account deletion, pagination, subscriptions, production data migration,
and production rule deployment are excluded. No server invariant is inferred
from a unit mock: the Emulator suite directly attempts forbidden writes and
checks stored final state.

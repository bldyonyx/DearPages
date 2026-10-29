# Phase 8B.3.3 — isolated generation library

Experimental, demo-only repository. No application integration, migration,
deployment or production access. Legacy services/exports, hooks, components,
8B.2 rules and main emulator rules remain unchanged. The existing lifecycle gets
only a REST path-segment encoding fix for valid keys containing URL syntax; its
API and protocol are unchanged. Production remains NO-GO.

## Run

From the repository root with the already installed Firebase CLI:

```sh
JAVA_HOME="$HOME/.local/opt/jdk-21.0.13+9" \
PATH="$HOME/.local/opt/jdk-21.0.13+9/bin:$PATH" \
CI=true NO_UPDATE_NOTIFIER=1 XDG_CONFIG_HOME=/tmp/dearpages-8b3-3-cli-config \
node experiments/generation-library/run.mjs
```

The runner accepts no arguments, compares its config with the 8B.2 demo config,
checks ports, and starts only Auth/RTDB on `127.0.0.1` for `demo-dear-pages`.
Tests check project/Hub/Auth and unauthenticated RTDB root denial before SDK use.
No import/export or administrative credential is used by this suite or service.

## Schema decision

8B.2's library schema only permits title/status. It cannot store the existing
library projection or reading dates. This directory therefore contains a separate
copy of its rules, not a replacement. Only the `library` node differs:

- Authorization is tightened for active writes by requiring an existing library.
  Creating permits only initial insertion; updating an existing creating record
  is still forbidden. Before/after generation/state checks remain unchanged.
- The closed schema adds explicit field validators. No ancestor permission,
  lifecycle, counter, purge, note/rating record or membership rule is broadened.
- `id`, `title`, `status`, `addedAt` are required. ID equals the path book ID;
  addedAt is immutable. Title retains the prototype's 200-unit cap.
- Metadata strings: `googleBooksId`, `isbn`, `cover`, `publishedDate`,
  `description`, `source`, `openLibraryId`.
- Metadata string arrays: `authors`, `isbns`, `categories`. Their RTDB nodes allow
  canonical numeric indices with string leaves; the repository expects normal
  dense SDK arrays, not sparse numeric maps.
- Optional integer reading timestamps: `startedAt`, `finishedAt`, `abandonedAt`,
  within JavaScript Date's range (negative historical dates are allowed).
- `addedAt`/`updatedAt` are nonnegative integer timestamps in that same range.
- Legacy scalar `rating` is an integer 1..5; `note`/`review` reuse the main local
  notes HTML allowlist/control/length validations verbatim (200000 units).
- Unknown fields, malformed types and nested arbitrary metadata are rejected.
  Nothing silently truncates/drops unknown metadata. Supporting additional real
  historical shapes requires a separately tested schema decision, not migration.

Nulls and empty arrays disappear in RTDB. Validated wire/read snapshots omit
these absent properties, while the pure initial projection retains the legacy
builder's null/default array output until it is prepared for storage.

## API

`createGenerationLibraryService(database)` accepts a client Database already
configured for the fixed demo RTDB/Auth emulators. It reuses
`createBookLifecycleService`'s fail-closed guard, including owner/namespace and
no-Admin/mock-credential checks. It does not import the app Firebase singleton.

Every book operation takes a frozen `{ uid, bookId, generation }`; responses carry
that same captured epoch as `{ context, book }`, with `patch` added for mutations.

| Operation | Contract |
| --- | --- |
| `initializeLibrary(context, record)` | Creating only. Full record initialization; exact repeats join, different competing payloads conflict. Does not initialize protocol/lifecycle or activate. |
| `getActiveBook(context)` | Reads exactly this active generation, with lifecycle checks before/after the book read. Stale/deleting/deleted contexts fail explicitly. |
| `getActiveBooks(uid)` | Discovers active contexts/books, newest addedAt first. Does not retarget any existing mutation. Lifecycle races fail; caller may explicitly reload. |
| `updateBookStatus(context, status, options?)` | Preserves legacy final-date behavior and unrelated fields. Same status is a no-op. |
| `updateBookStartedAt`, `updateBookFinishedAt`, `updateBookAbandonedAt` | Explicit integer timestamp or null/undefined removal, plus optional field expectations. Nullish normalization preserves the old date setters; no month/year conversion is introduced. |
| `updateBookNote`, `updateBookReview` | Compatibility rejection APIs: `generation-library/historical-source-readonly`, before RTDB access. |
| `updateBookRating` | Scalar library rating, integer 1..5. No multiple-rating integration. |
| `updateLibraryFields(context, patch, options?)` | Dates and scalar rating only. Rejects historical note/review, identity, catalog metadata, technical timestamps, status and unknown patch keys. |
| `deleteGeneration`, `resumeDeletion` | Delegation to 8B.3.2 lifecycle only; no second deletion algorithm, no old removeBookFromLibrary replacement. |

`createGenerationLibraryBook(book, status)` is a pure initial projection.
It reuses `getBookRouteId`. Because the existing `createLibraryBook` export is in
a module that imports the application Firebase singleton, it is not imported by
the new runtime service. Unit parity tests instead pin both projection and all
16 status transitions to the existing service, with Firebase mocked only there.
The existing `sanitizeNoteHtml` is reused for creating-only note/review initialization; its Node fallback
and browser DOMPurify behavior remain unchanged.

`startedAt` is a new optional explicit field; the legacy service has no start-date
API/automatic reading-start behavior. Status changes do not invent or clear it.
Legacy metadata setters are not added. Unsupported patch/snapshot data fails
before writing. This isolated schema is stricter than legacy broad library rules;
it must not be treated as validated coverage for all real historical data.

## Concurrency and uncertain results

Writes use fixed-reference SDK transactions, with `applyLocally: false` and one
captured operation timestamp. Each callback merges into the latest record and
preserves unrelated fields. A cold cache uses the acknowledged REST baseline as
a non-destructive proposal; RTDB hash comparison retries against actual server
data. A callback never changes generation or proposes a null/deletion write.

Reads/reconciliation use authenticated fixed-local REST GETs, no cache/redirect,
with a five-second read timeout. Active reads check lifecycle before/after; this
does not lock the lifecycle after returning. Discovery is not an atomic snapshot
of every book. Returned records may already have been changed by another client.

Optional `{ expected: { rating: 4 } }` (and equivalent supported field values)
provides compare-and-set through transaction hash retries. Null expectation means
absent; it does not enable null rating/note writes. A mismatch fails explicitly.
Without expectations, same-field writes use the existing last-writer semantics;
different fields are merged. No global revision/operation-ID protocol is added.

An uncertain SDK write/confirmation error is propagated, never auto-retried or
retargeted. Explicitly re-read the same context. An identical scalar/status intent
already visible in the authoritative baseline is a no-op and preserves dates and
updatedAt. An expected-field retry after its own successful write can conflict;
read the result rather than claiming exactly-once execution. Blindly resubmitting
after an intervening same-field edit can overwrite it without expectations.

Rules, not the preflight, enforce the critical generation/state/ownership gates.
Tests bypass the repository to verify malformed writes, ordinary deletion,
creating/deleting writes, ancestor operations and lock-plus-edit are denied with
no partial commit. Real SDK offline queues and hash retries are tested. Injected
discarded results are caller-boundary faults, not claims of TCP acknowledgement
loss. SDK write promises may remain pending while disconnected; the five-second
limit covers REST reads, not an offline write acknowledgement deadline.

## Before activation

- Complete schema review against historical data; do not drop unsupported fields.
- Settle production connection/authoritative-read interfaces: the reused demo
  guard intentionally depends on pinned SDK internals and fails closed on change.
- Design coordinated notes, rating tombstones/markers and Collections integration.
- Design fail-closed old-client/migration rules, account deletion and UI error/
  reload flows. Existing main rules are not this generation protocol's rules.
- Validate all integration paths before any separate activation authorization.

No hooks/pages, Dashboard/My Library, multiple notes/pins, rating impressions/
tombstones, collection membership catalog, account deletion or real migration is
implemented or declared production-ready by this phase.

## Integrated historical-source contract (8B.3.5 correction)

Historical `note` and `review` remain readable and may be supplied to
`initializeLibrary` only while creating. Initialization sanitizes these sources;
explicit generation notes conversions copy them without altering the sources.
`updateLibraryFields` rejects any patch containing either key, including null,
no-op and mixed patches, with `generation-library/historical-source-readonly`
before any RTDB read/write. `updateBookNote` and `updateBookReview` remain solely
as compatibility rejection APIs with the same error. Earlier writable-source
examples are superseded. Dates, statuses and scalar rating remain supported;
metadata is preserved, not arbitrarily patchable. No rules are relaxed. The older
standalone rules are not the immutable-source integrated security profile.

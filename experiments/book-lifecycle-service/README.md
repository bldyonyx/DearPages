# Phase 8B.3.2 — isolated book lifecycle service

No application integration, migration, deployment or production access. Existing
business services, React components/hooks, rules and 8B.3.1 files are untouched.
The runner reuses `../book-lifecycle/firebase.json` and its **unchanged 8B.2 rules**.
These experimental rules still do not cover complete application data schemas.

## Run

From the repository root, with the existing Firebase CLI and Java Linux in PATH:

```sh
JAVA_HOME="$HOME/.local/opt/jdk-21.0.13+9" \
PATH="$HOME/.local/opt/jdk-21.0.13+9/bin:$PATH" \
CI=true NO_UPDATE_NOTIFIER=1 XDG_CONFIG_HOME=/tmp/dearpages-8b3-2-cli-config \
node experiments/book-lifecycle-service/run.mjs
```

The runner validates the fixed config and free ports before starting only Auth
9099 and RTDB 9000 on `127.0.0.1`, project `demo-dear-pages`; Hub/logging use
4400/4500. Tests verify the Hub, project, Auth endpoint and denied unauthenticated
root access before using SDK clients. No import/export or forwarded arguments.

## API

`createBookLifecycleService(database)` receives an already configured client SDK
Database with the local Auth emulator on the same app. It never imports the app's
Firebase singleton or initializes a production connection. Every method accepts
a frozen 8B.3.1 context `{ uid, bookId, generation }` for the authenticated owner.

| Method | Contract |
| --- | --- |
| `initializeProtocol(context)` | Explicit, idempotent demo bootstrap to version 2/ready; never changes an existing protocol. Returns void. |
| `readLifecycle(context)` | Returns null or a frozen actual `{ generation, state }`; may report a newer generation for diagnosis, without replacing the context. |
| `initializeGeneration(context)` | Requires generation 1, absent -> creating. Returns a frozen copy of the context. A repeat joins creating(1) only. |
| `beginNextGeneration(deletedContext)` | Deterministic predecessor + 1, deleted(g) -> creating(g+1); returns the new frozen context. Retain the **original predecessor** for retries. |
| `activateGeneration(context)` | creating -> active; caller initializes the library separately. Returns confirmed lifecycle. |
| `lockDeletion(context)` | creating/active -> deleting, acknowledged before purge. Returns confirmed lifecycle; repeats join deleting. |
| `purgeGeneration(context)` | Requires deleting (or already deleted). One SDK multipath update removes exactly the captured generation and finalizes deleted. Verifies the book has no residual payload. |
| `resumeDeletion(context)` | Same as purge; refuses active/creating, never initiates a new deletion. |
| `deleteGeneration(context)` | Explicitly locks then purges; repeats accept deleted for this same generation. |

## Concurrency and acknowledgements

The service uses SDK `set` / atomic `update`. Rules enforce compare-and-set
transitions, monotonic counter, owner isolation, before/after generation/state,
acknowledged deleting before purge, absent payload before readd/finalization,
and denial of ancestor/counter deletion. Preflight reads are only for errors and
idempotency; they do not provide concurrency authorization. No rules were relaxed
to permit no-op writes or to turn lock-and-purge into one operation.

The service has no transaction callback that can silently retarget a generation.
Tests also compete with real SDK transactions that capture a fixed generation.
Concurrent calls requesting the same generation/target may **join** the resulting
state; this is not an exclusive ownership or unique operation-ID protocol.

SDK `get()` may return optimistic/cache data. Reconciliation therefore uses
authenticated REST GETs directly to the fixed local RTDB, `cache: no-store`,
redirects refused, with a five-second timeout. Tokens come only from Auth already
connected to `127.0.0.1:9099`; credential URLs are not included in wrapped network
errors. A network error is propagated; there is **no automatic network retry**.
Permission rejection is reconciled only if the server confirms the exact desired
generation/state. Other states remain explicit conflicts. Success can be followed
immediately by another client's transition; results are not permanent leases.

After an uncertain result, call the same operation/context again or read the
lifecycle. Never obtain a new generation just to make old work succeed. If the
generation advanced, the old operation cannot touch it. If the lifecycle advanced
within the same generation, some operations deliberately report `invalid-state`
or `transition-conflict` rather than claiming the earlier operation succeeded.

## Safety guard and limits

The guard checks project, configured URL, actual SDK namespace/host/emulator flag,
Auth emulator and owner, and refuses Admin/mocked credentials. Actual namespace
validation uses `_repoInternal.repoInfo_` from the pinned Firebase 12.19.0 SDK:
`ref().toString()` omits it and also starts the connection. Inspecting metadata
first avoids opening a reference to a mismatched endpoint. This internal coupling
is intentional for this isolated phase; an SDK shape change fails closed and
requires review/tests. It is not proposed as a general production interface.

Fault tests wrap **real** emulator SDK writes or mock a REST failure at the caller
boundary. They do not claim to simulate actual lost TCP acknowledgements. Real
SDK offline queues are tested separately. One maximum-counter test seeds only a
fictional deleted predecessor through the Emulator admin REST token; the service
never receives this token. Fixture privilege is not a guarantee against an admin.

No background worker guarantees eventual progress after all clients disconnect.
No UI/repository integration, historic-marker transfer, real Collections migration,
complete note/rating validation, account-deletion behavior, deployed rule parity
or production readiness is claimed. Firebase production remains NO-GO.

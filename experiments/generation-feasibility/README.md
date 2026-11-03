# 8B.4.2.1 — isolated feasibility proofs

This experiment is restricted to `demo-dear-pages`, Auth/RTDB on
`127.0.0.1:9099/9000`. It does not import the application Firebase singleton,
deploy rules, migrate real data, modify validated services, or connect React.

## Run

Use Linux Java 21, the cached Database Emulator JAR, and Firebase CLI on PATH.
Use a writable temporary XDG_CONFIG_HOME when needed. From the repository root:

```sh
node experiments/generation-feasibility/composeRules.mjs --check
node experiments/generation-feasibility/run.mjs
```

The runner accepts only optional `--serve`, compares the dedicated Firebase configuration with
the existing demo configuration, checks ports, and verifies generated rules.
The configuration retains the predeploy refusal hook. The suite loader only
loads rules through the fixed LOCAL Emulator settings endpoint, after verifying
the demo hub and unauthenticated root-read denial. It never injects database
fixtures administratively. Fixtures use authenticated SDK clients.

For targeted diagnosis, `run.mjs --serve` starts the same protected demo
Emulators without running suites. In another terminal use
`node experiments/generation-feasibility/diagnose.mjs targeted` (or `sizes`,
`keys`, `full`, `regressions`). `rules` reloads the verified experimental profile;
`stop` gracefully stops the verified demo hub process. No arbitrary command or
project arguments are forwarded. Diagnostics log rule failures, not data content.

`composeRules.mjs` without arguments explicitly regenerates only this
experiment's `database.rules.json`. Existing source rules remain unchanged.

## Architecture and trust boundary

The generator composes the complete 8B.3.5 integrated policy, adding an external
account fence before and after every existing write authorization. New ordinary
write grants stay on specific branches. The only user-ancestor grant is an
owner-authenticated, already-deleting-account purge **to null only**. It requires
the external control to remain deleting throughout the commit. This is not a
grant permitting non-null user replacement.

Owner-level user reads are deliberately enabled for the independent REST test
observer, including during deletion. This is an experimental read policy, NOT
the final migration/deletion privacy policy. There is no root read grant or
cross-owner read grant.

### A — historical freeze

The protocol, immutable migration identity, and monotone `legacyClosed` barrier
are initialized in one authenticated multipath commit. Old paths are writable
only with an active account, an open legacy barrier, and an absent protocol both
before and after commit. During migrating they can only be removed as part of
the transition to ready. Ready requires absence of all seven legacy branches.
Migration identity cannot be replaced; resume observes the same stored ID.

`importWitness` is an intentionally small import capability probe. It does NOT
import library/notes/ratings or attest import completeness. Full fidelity,
checkpoints, diagnosis, and a migration engine remain outside this phase.

### B — atomic guarded membership batch

Each immutable receipt has exactly 32 numbered guard slots, padded with disabled
slots. Enabled slots capture book ID/generation, catalog identity/epoch, exact
before state (including physical absence), desired presence, and expected after
state. A bidirectional tuple-to-slot mapping prevents duplicate tuples and
unlisted writes. Every guard validates server before/after snapshots, including
no-op and absent rows. Membership records keep their validated three-field
schema. Rules, not JavaScript preflight, verify the commit.

A commit writes the user sequence/head, one ring receipt, changed membership
leaves, and corresponding collection activity leaves in one SDK multipath update.
All membership writes in this profile require a matching newly committed receipt.
No individual-operation loop or user-ancestor active write grant is used.

The API guarantee covers declared guarded rows; it is not a snapshot of every
book that may later appear in the library. The fixed guards are generated into
the policy and do not depend on rule-language iteration or cryptographic hashing.

### C — sequence and bounded receipts

The first normal sequence is 1; every commit advances exactly once, up to
2147483647. The slot is sequence modulo 64. The head and receipt must agree.
Identical caller retries reconcile first, without issuing a second write. A
different envelope at the occupied sequence conflicts. An unavailable/evicted
receipt yields `indeterminate`, never permission to replay an old sequence.

The ring holds at most 64 receipts. It serializes membership commits per user;
unrelated concurrent edits can conflict on the head. A new sequence is a new
intention, not an automatic retry of the old envelope. Confirmation is evidence
of a prior commit, not a claim that its effects are still current.

Receipts contain personal book/Collection relations. The experiment's book purge
atomically clears the ENTIRE bounded ring along with the generation, retaining
the sequence. This removes other operations' evidence too; their outcomes can
become indeterminate. This is an explicit bounded-cleanup tradeoff.

The unchanged lifecycle service's standalone purge cannot bypass this receipt
condition. The experiment uses an explicit receipt-aware multipath coordinator;
no existing service has been changed. Any later application adaptation needs its
own authorization and tests.

The counter-boundary profile changes only the absent-head genesis constant to
2147483645, then exercises the final two commits and overflow rejection using
authenticated SDK writes. The normal profile cannot jump to that initial value.
There are no privileged database fixture writes in this boundary test.

### D — terminal account fence

`accountControl/{uid}` survives `users/{uid}` deletion. Active can progress to
deleting, then deleted after the user subtree is absent. A terminal control
cannot be erased, reopened, or reset by its owner or another user. Ordinary,
legacy, import, and existing generation writes require an active control.

The Auth failure test intentionally keeps the EMULATED Auth identity alive after
RTDB purge, and attempts recreation with its still-valid credentials. No real
Auth account is deleted. Autonomous cleanup, actual Auth deletion/retry, recent
authentication enforcement, and retention policy are not proved here.

## Bounds, cost, and limitations

* 32 includes every guard, not just changed rows. Larger selections are rejected;
  there is no silent chunking or loss of no-op guards.
* The client checks a 128 KiB serialized receipt ceiling. Server enforcement is
  structural: closed schemas, 32 slots, bounded strings/numbers, reciprocal
  indices, and forbidden priorities. Rules do NOT calculate serialized byte size.
  Exact transport-size acceptance at 128 KiB is not promised.
* The receipt schema carries no free-form note content. Oversize padding is
  rejected by the server's closed schema, not trusted client byte metadata.
* Ring reconciliation currently reads the owner user snapshot: cost grows with
  user data and retained receipts. This is a prototype, not a scalable final API.
* Activity is atomic for actual membership changes; no-op batches do not touch
  it. Existing pin/metadata field counters are not faked or incremented for
  memberships. Clear/delete races reject stale epochs or leave ineffective rows.
  A complete activity projection/cleanup contract remains future work.
* A migration ID or receipt is not independent attestation of faithful import.
* Offline tests use real SDK queues and an independent REST server barrier;
  there is no sleep used to order competing writes. Discarded confirmations
  simulate loss at the caller boundary, not packet-level acknowledgement loss.
* No-client recovery has no autonomous worker. No production rules or data have
  been inspected or changed. Production remains NO-GO.

## Execution results

**8B.4.2.1a: 91/91 feasibility cases and 1/1 counter-boundary case pass.**
The 53 original cases plus 38 targeted cases now pass, as do all 498 existing
Emulator regressions and all 938 unit tests. See [RESULTS.md](RESULTS.md).

The three initial permission failures came from incorrect Unicode escaping in
the generated identifier regex, rejecting valid identifiers such as `first`,
`intent-37` and `c7`. The lifecycle failure was an incorrect test expectation of
the validated service's normalized error. A further closed-schema generator bug
(`false || 'true'`) was exposed by current-state negative controls and corrected
to preserve false with `??`. No authorization was broadened.

Actual 32-row commits, the 65th commit evicting a receipt, receipt purge/readd,
stale replay rejection and the final two sequence values are demonstrated with
authenticated SDK writes and independent server reads. The measured valid
32-row receipt is 7,825 bytes/66 update paths. A 33rd guard and forbidden oversize
padding are rejected with valid current-state controls. Exact useful 128 KiB
payload capacity is not claimed. These are isolated feasibility results, not
production readiness, faithful migration, or final read/privacy guarantees.

# Findings

What the fuzzer actually found during stage 4 (invariants), and how it was
addressed. Per the stage's own DoD: if the harness found zero bugs, the
harness was written wrong — the code isn't assumed to be perfect going in.

---

## 1. Harness bug: I2 indexed `order` out of bounds on a partially-filled `Cancelled` circle

**Found by:** `forge test` invariant campaign, `invariant_I2_eachMemberIsRecipientExactlyOnce`,
first run (256 runs / depth 500), seed `0x8efe3874331494ad0b9fed0b0904a6e62b1f9c2e399496bdc0fa693df19825e4`.

**Failing sequence (shrunk to 2 calls):**
1. one actor calls `join(secret)` — circle has 1 of 5 members, still `Forming`
2. that actor (or another) calls `cancel()` after the fill deadline — circle moves to `Cancelled` with `order.length == 1`

**What broke:** the invariant checked `if (state == Forming) return;` and otherwise
assumed `order` had exactly `memberCount` entries, looping `order(0)..order(memberCount-1)`.
That assumption holds for `Active`/`Completed` (both only reachable once `order`
is fully populated) but not for `Cancelled` — a circle can be cancelled with
anywhere from 0 to `memberCount - 1` members. Reading `order(r)` past its
actual length reverts (it's a real array, not a mapping), so the invariant
call itself threw `EvmError: Revert` instead of failing an assertion.

**This is a bug in the test harness, not in `Circle.sol`.** The contract's own
behavior here is correct — `cancel()` on an under-filled circle is exactly
the intended path. The invariant's precondition was just wrong.

**Fix:** guard on `state == Active || state == Completed` instead of
`state != Forming` — the two states where `order.length == memberCount` is
actually guaranteed. See `test/CircleInvariant.t.sol`.

**Re-run:** same seed, same run count — 7/7 invariants pass. A broader run
(256 runs × depth 500 = 128,000 calls per invariant) also passes clean.

---

## Run record

Command: `forge test --match-path "test/CircleInvariant.t.sol"` with
`[profile.default.invariant]` set to `runs = 256, depth = 500` in
`foundry.toml` (checked in, so this runs on every CI push, not just once
locally).

| Invariant | Calls | Result |
|---|---|---|
| I1 — balance == unclaimed + current round's collected | 128,000 | PASS |
| I2 — each member is recipient exactly once | 128,000 | PASS |
| I3 — order never changes after start | 128,000 | PASS |
| I4 — total claimed ≤ total contributed | 128,000 | PASS |
| I5 — no member contributes more than C × memberCount | 128,000 | PASS |
| I6 — non-members hold no claimable balance or debt | 128,000 | PASS |
| I7 — Completed + fully claimed ⇒ balance == 0 | 128,000 | PASS |

I8 does not appear — it was retired in stage 4 along with `withdraw()`
(see `docs/spec.md`, "Change from v0.2").

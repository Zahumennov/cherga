# Cherga

Cherga (Ukrainian: "queue") is a rotating savings and credit association
(ROSCA) — implemented as a smart contract.

The mechanic fits in one sentence: a fixed group of people chips in the same
amount on a regular schedule, and each round the whole pool goes to one
member — in turn, until everyone has received it exactly once.

Example: ten people, $100 a month, ten months. Each month someone takes home
$1000. After ten months, everyone has paid in $1000 and everyone has
received $1000. On paper, everyone breaks even.

But not in time. Whoever takes the pool first is effectively a borrower:
they got $1000 up front and pay it back over nine interest-free
installments. Whoever takes it last is effectively a lender: they spend nine
months funding everyone else, also interest-free. A circle isn't a savings
tool — it's a liquidity exchange inside a group. The money is almost never
idle, which is why the economist Bauman called this kind of arrangement "a
bank for the poor."

---

## A financial institution older than banks

This structure is one of the oldest financial institutions still in active
use, and it wasn't invented once — it appeared independently in dozens of
cultures: the Jamaican *pardna*, Indian *chit funds*, East African *chama*,
Somali *hagbad*, Scottish *menage*, English *didlum*, Punjabi *kitties*,
Mexican *tanda*, West African *susu*, Chinese *hui*, and more. It remains
common today in low- and middle-income countries, and inside migrant and
refugee communities worldwide, wherever people move faster than the
financial infrastructure around them.

The reason it keeps reappearing is always the same logic: someone needs a
large sum of money right now, and there either is no bank, or the bank won't
lend without collateral and a credit history it doesn't have. So the group
becomes its own bank.

*A note on the name: the Ukrainian phrase "чорна каса" ("black cash box") is
ambiguous — in post-Soviet usage it referred to a genuine workplace mutual
aid fund, but the same words also described a company's off-the-books cash.
For a public project that's the wrong association. "Cherga" — the queue
itself — is the neutral, literal name for what this actually is.*

---

## Why put this on-chain

In most of DeFi you can't borrow money you don't already have — to take out
1000 you first lock up 1500. That's a pawn shop, not a loan. A ROSCA is one
of the few mechanisms where a person receives an unsecured lump sum. The
collateral is real, but it isn't financial — it's reputation within a group
of people who know each other.

**Cherga brings on-chain the one working unsecured-credit mechanism humanity
invented without banks.**

What the contract adds on top of the offline version:

- **A circle for people in different countries.** A classic cash box needs
  physical proximity and hand-to-hand cash. A group of friends spread across
  three countries can't run one — this is the main use case.
- **A circle denominated in stablecoins.** A cash box in a weak local
  currency has a built-in tax: inflation. You pay in with real money for a
  year, you withdraw devalued money. In USDC this problem doesn't exist.
- **Records nobody can dispute.** The most common fight in real cash boxes
  isn't theft — it's "I paid, you just didn't write it down."
- **No treasurer.** The classic way to lose a cash box is the organizer the
  money passes through. There is no such person here, by construction.

Cherga is **not** a fit for everyone. Eight friends in the same country with
the same bank should just use a spreadsheet — it's faster. Cherga wins when:

- members live in **different countries** with different banks;
- members **already hold crypto** and don't want to cash out;
- the **local currency is depreciating** and physical dollars are impractical.

If none of that applies to your group, the honest answer is "you don't need
this," and the interface says so directly.

---

## Trust model — read this before using real money

**The contract does not protect against default. At all.**

The only way to cheat a circle is to take the pool and stop paying. No code
without collateral can prevent that — and this project deliberately has no
collateral (see below). Real-world cash boxes have solved this for centuries
with a social layer: participants know each other, and the reputational cost
of betrayal outweighs the pool amount.

Cherga does not replace that layer — it relies on it. What the contract
provides instead:

1. **Nobody holds the money.** The classic fraud vector in a cash box is the
   organizer the funds pass through. Here, no one holds the funds.
2. **The ledger can't be forged.** Who paid, who didn't, who received what —
   permanently on-chain.
3. **Default is visible to everyone immediately**, not three months later
   from the treasurer's mouth.

**Practical consequence: only share a circle's link with people you know
personally.** This is stated plainly in the app UI, not in fine print.

---

## Design decisions (fixed, not up for casual debate)

1. **No collateral.** The contract does not protect against default and does
   not pretend to. The risk is carried by participants knowing each other
   offline. This is a product decision, not an oversight.
2. **Zero fees.** No protocol fee, no creator fee.
3. **No admin key over funds.** No pause, no rescue function, no proxy
   upgrades. The contract is immutable after deployment.
4. **No token.** No governance token, no points, no airdrop.
5. **ERC-20 only.** The native chain asset is not supported.
6. **No backend.** Circle state is fully reconstructible from on-chain
   events.
7. **Default does not stop the circle.** The recipient takes whatever was
   collected; the shortfall becomes a debt owed by the specific
   non-payer(s) to that specific recipient.

---

## How a circle works

### Parameters

Set at creation, **immutable** for the circle's lifetime:

| Parameter | Type | Description |
|---|---|---|
| `token` | `address` | ERC-20 stablecoin. Native token is not supported |
| `contribution` | `uint256` | Per-round contribution, `C` |
| `memberCount` | `uint8` | Number of members, `N` (2 ≤ N ≤ 20) |
| `roundDuration` | `uint32` | Round length in seconds |
| `fillDeadline` | `uint64` | Deadline to fill the circle; if unmet, it's cancelled |
| `order` | `address[]` | Payout queue, fixed once the circle starts |

### State machine

```
                 create()
                    │
                    ▼
             ┌─────────────┐   fillDeadline passed
             │   Forming   │──────────────┐
             └─────────────┘              │
                    │ join() × N          ▼
                    │              ┌─────────────┐
                    ▼              │  Cancelled  │
             ┌─────────────┐       └─────────────┘
             │   Active    │        (everyone withdraws
             │ round 1..N  │         their own contributions)
             └─────────────┘
                    │ round N closed
                    ▼
             ┌─────────────┐
             │  Completed  │
             └─────────────┘
```

### What happens on default

This is the central design decision of the whole contract. A circle
**does not stop** because one member fails to pay.

On `closeRound()`:

1. `collected` is fixed — however much was actually paid in this round.
2. The round's recipient can claim `collected`, not `C × (N-1)`.
3. The difference, `shortfall = C × (N-1) − collected`, is recorded as a
   **debt owed by the specific non-payer(s) to the specific recipient**.
4. The round closes and the queue moves on.

A later `repay()` goes directly to whoever was shorted in that round.

Why: the alternative — freezing the circle until it's paid in full — lets
one irresponsible person hold nine other people's money hostage. That's
worse than a shortfall.

---

## Invariants

Enforced via Foundry invariant/fuzz testing:

| # | Invariant |
|---|---|
| I1 | `balanceOf(contract) == Σ unclaimed payouts + Σ contributions of the current round` |
| I2 | Every member is the recipient of exactly one round |
| I3 | Payout order never changes once the circle starts |
| I4 | `Σ received by all ≤ Σ contributed by all` — the contract never creates money |
| I5 | A member cannot contribute more than `C` per round, or more than `C × N` per circle |
| I6 | Tokens can never go to an address outside `order` |
| I7 | In `Completed` state, after all `claim()` calls, contract balance == 0 |
| I8 | In `Cancelled` state, each member's refund == exactly what they contributed |

---

## Tech stack

- **Contracts:** [Foundry](https://getfoundry.sh/), Solidity `^0.8.24`, OpenZeppelin (`SafeERC20`)
- **Frontend:** Next.js (App Router), TypeScript, wagmi + viem, a wallet
  connector (ConnectKit / RainbowKit), Tailwind + shadcn/ui
- **Networks:** Whitechain + one popular L2. Intentionally nothing beyond that.

---

## Project status

Early stage — under active development, not deployed, not audited.
See commit history for current progress.

**Do not point real money at this before an audit and before you understand
the trust model above.**

---

## License

MIT — see [LICENSE](LICENSE).

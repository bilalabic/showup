# Demo runbook

Target: a repeatable 2–3 minute product segment. Use two Testnet wallets and
prepare both trustlines and XLM reserves before the presentation.

## Before recording or presenting

- Run `pnpm win:verify` (or `pnpm verify`).
- Confirm Freighter is on Stellar Testnet in both browser profiles.
- Confirm the organizer, participant and community pool can receive pinned USDC.
- Set `NEXT_PUBLIC_ENABLE_DEMO_TOOLS=true` only in the labelled demo environment.
- Open `/wallet` and confirm Anchor discovery/pricing. A green `/health` response
  is not enough; rehearse one complete deposit and record its transaction.
- Seed a compressed fixture with `./scripts/seed-demo-event.sh --fast`.
- Keep Explorer tabs for the deployed contract and recorded transactions ready.

## Live sequence

### 1. The problem — 15 seconds

“Limited-capacity events lose seats because registration carries no commitment.
ShowUp adds a refundable bond without giving the organizer custody.”

### 2. Publish policy — 25 seconds

Open `/organizer/events/new`, show the schedule, bond and exact organizer /
community split, then sign. Open the confirmed Explorer link.

Use the **Check-in open now** preset. The other presets schedule a future
evening, which leaves an event that cannot be checked into during the demo.

### 3. Fund with TRY — 35 seconds

In the participant profile, open the public event and point out the exact USDC
bond plus indicative TRY estimate. Go to `/wallet`, enable USDC if needed, start
the Mock Anchor flow, sign SEP-10, show the firm quote and bank reference, then
use the clearly labelled Testnet bank simulation. Wait for a confirmed Anchor
status and show its Stellar transaction.

Say explicitly: “The bank and KYC are simulated; this is real Testnet USDC. The
Anchor deposit and bond reservation are separate operations.”

### 4. Reserve — 25 seconds

Return to the event, review the full policy confirmation, sign the reservation
and show “Confirmed on ledger” plus the transaction link.

### 5. Attend — 35 seconds

Open `/reservations`, display the QR pass, then scan it from the organizer
profile. Show the current on-chain reservation, sign check-in and show the full
bond refund transaction. Scanning alone never releases funds.

### 6. No-show — 25 seconds

Open the compressed fixture after its check-in deadline. Select the locked
reservation, show the exact two integer settlement amounts, sign settlement and
open the Explorer transaction.

### 7. Close — 10 seconds

Expand the global technical panel: Testnet, contract, settlement SAC, ledger,
connected wallet, current statuses and last transaction are inspectable without
exposing secrets.

## Failure fallbacks

- **Anchor worker degraded:** show the app's pending/degraded state and a
  previously recorded successful Anchor transaction. Never call a faucet-funded
  balance Anchor evidence.
- **RPC intermittent:** use the recorded Explorer hashes; do not display a fake
  success state.
- **Camera unavailable:** paste the pass payload into manual lookup. The signed
  contract path is identical.
- **Deadline missed:** seed a new compressed fixture; never add a force-settle
  contract method.
- **Wallet unavailable:** use the prepared second browser profile. Do not import
  a seed phrase into the application.

## Evidence to capture

| Step | Identifier |
|---|---|
| Browser-created event | `329cf218…4e9dce` (event 18) |
| Anchor deposit id + Stellar payment | `sep_c3awgubgw3jk1sh4owp5` · `f66e2f17…d05c56fd` |
| Reserve | `f53c2122…be717843` (event 18) |
| Check-in/refund | `4bb91c25…32897fd6` (event 18) |
| No-show settlement | `e17cfd91…fb930d350` (event 10, CLI-signed) |
| Reservation cancellation | Pending |
| Event cancellation + pulled refund | Pending |

Full hashes and Explorer links live in the root README's **Submission
evidence** table; this one is the presenter's cue card.

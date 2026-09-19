# ShowUp bond contract

The Soroban contract implements the complete P0 attendance-bond lifecycle on
Stellar Testnet. Mock USDC is locked per reservation, refunded for attendance or
timely cancellation, and split deterministically after a no-show.

The current deployment and transaction evidence are recorded in
[`docs/deployments/testnet.md`](deployments/testnet.md).

## Configuration and amounts

The constructor is:

```text
__constructor(token, community_pool)
```

Both addresses are pinned in instance storage. Event organizers cannot replace
the settlement token or redirect the community share. `Config` contains exactly
those two addresses; the contract stores and transfers integer token units only.
Mock USDC is a classic Stellar asset with 7 decimal places, and display-string
conversion belongs to the frontend domain layer rather than on-chain config.

## State

- `Event` is persistent and keyed by event id.
- `Reservation` is persistent and keyed by `(event_id, participant)`.
- A reservation starts `Locked` and can transition once to `Attended`,
  `Cancelled`, `Refunded`, or `NoShowSettled`.
- An event starts `Active` and can transition once to `Cancelled`.
- Persistent and instance writes use the shared 30-day threshold / 90-day
  extend-to TTL policy, clamped to the network maximum.

## Contract interface

| Method | Authorization | Result |
|---|---|---|
| `create_event(...)` | organizer | stores an active event and returns its id |
| `reserve(event_id, participant)` | participant | transfers the exact bond into contract custody |
| `cancel_reservation(event_id, participant)` | participant | refunds before the inclusive cancellation deadline and frees the seat |
| `check_in(event_id, participant)` | stored verifier | refunds during the inclusive check-in window |
| `cancel_event(event_id)` | stored organizer | flips event status without iterating reservations or moving funds |
| `claim_cancelled_event_refund(event_id, participant)` | permissionless | refunds a locked reservation after event cancellation |
| `settle_no_show(event_id, participant)` | permissionless | after the deadline, pays organizer share plus the exact remainder to the pinned pool |
| `get_config()` | none | returns pinned token and pool |
| `get_event_count()` | none | returns the event enumeration bound |
| `get_event(event_id)` | none | returns one event or `NotFound` |
| `get_reservation(event_id, participant)` | none | returns an optional reservation |

Every money-moving settlement first requires `ReservationStatus::Locked`, which
prevents double refunds and double settlement. The no-show calculation uses
checked arithmetic:

```text
organizer_amount = amount * organizer_bps / 10_000
community_amount = amount - organizer_amount
```

The second leg receives the remainder, so the two transfers always sum to the
original bond without dust.

## Verification

From Windows, Rust commands are routed through WSL:

```bash
pnpm win:contracts:fmt:check
pnpm win:contracts:clippy
pnpm win:contracts:test
pnpm win:contracts:build
```

The suite covers authorization trees, deadline boundaries, terminal-state
guards, exact balances and events, TTL extension, checked overflow, and atomic
rollback when any SAC transfer fails.

## Known P0 limitations

**A participant who cancels cannot reserve the same event again.** `reserve`
rejects any existing `Reservation(event_id, participant)` record, whatever its
status, so a cancellation frees the seat for other people but not for the person
who cancelled. This is a deliberate P0 simplification: the reservation record is
terminal and the history of what happened to that bond is never overwritten.
Allowing re-reservation would mean writing over a terminal record and taking
more care with `reserved_count`, for a case the demo does not exercise.

**Instance-storage TTL is refreshed only when an event is created.** `reserve`,
`check_in`, `cancel_reservation` and the two settlement calls write to
persistent storage only, so they extend their own entries but not the contract
instance. After 90 days with no new event the instance and contract code could
archive. Locked bonds stay safe in restorable persistent storage, and both are
restorable, so this is a maintenance note rather than a risk to funds.

## Testnet deployment

Run in the same WSL environment that owns the Stellar CLI identities:

```bash
bash ./scripts/setup-identities.sh --fund
bash ./scripts/deploy-testnet.sh --dry-run
bash ./scripts/deploy-testnet.sh
```

The deploy script refuses any passphrase other than Testnet, requires protocol
28, checks both public accounts, probes the pinned Mock USDC SAC, builds the
Wasm, deploys with constructor arguments, verifies `get_config`, submits a smoke
`create_event`, then generates `packages/showup-bond-client` from the deployed
contract id. The generated package's Stellar SDK dependency is aligned to
`^17.1.0`.

Secret keys stay in the WSL Stellar CLI keystore. They are never placed in an
environment file, command output, or the repository.

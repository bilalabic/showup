# ShowUp
<img width="1186" height="896" alt="Screenshot 2026-09-20 110520" src="https://github.com/user-attachments/assets/71b76fa6-52ce-4fb5-a02f-e765e26df8fe" />


**Programmable attendance commitment bonds for events and reservations, on Stellar.**

Rise In × Stellar Pro Hackathon Türkiye 2026 — **Genesis** track — **Stellar Testnet**.

**Live demo: [showup-steel.vercel.app](https://showup-steel.vercel.app)** ·
**Contract: [`CCCDFM2M…IRHM`](https://stellar.expert/explorer/testnet/contract/CCCDFM2MGKO5PEBS565O7FO2OL4CZYUFFRTQLUPPIIIL2JNCPUSUIRHM)**

> The P0 product is deployed and the bond lifecycle is verified on-chain — see
> **Submission evidence** for the reserve, check-in refund and 80/20 no-show
> settlement transactions, a Mock Anchor on-ramp that settled end to end, and a
> complete browser-signed round on event 18 — create, reserve, then check-in
> with the bond refunded in the same transaction. This README never presents a
> pending item as complete.

### Try it in two minutes
The organizer sets the refundable bond, capacity, check-in window, and the
published no-show split. Once the first bond is locked, the policy cannot change

<img width="1220" height="902" alt="Screenshot 2026-09-20 111923" src="https://github.com/user-attachments/assets/3ad8eb34-ab3b-4785-a4de-37bee4a35ada" />


1. Open the demo and install [Freighter](https://www.freighter.app/), set to **Testnet**.
2. `/wallet` → fund the account with friendbot, then **Enable USDC**.
3. From the landing page follow **View latest event** to `/events/[id]`, read the
   full policy, and **Reserve**.
4. `/reservations/[id]` → your QR pass. The organizer scans it at
   `/organizer/events/[id]/scan` and signs the check-in; the contract returns
   the bond in the same transaction. If the camera is unavailable, that page's
   **Manual fallback** takes the participant address instead.

Mock USDC arrives through the Anchor on `/wallet`. If its on-ramp worker is
degraded, the [Circle testnet faucet](https://faucet.circle.com) issues the same
asset.

Creating your own event to try the full round: on `/organizer/events/new`, the
**Check-in open now** preset fills a schedule whose check-in window is already
open, so the reserve and check-in can be done back to back. The other presets
schedule a future evening.

## Why

Free and limited-capacity events lose seats when registration carries no
commitment. ShowUp uses a small refundable bond:

1. A participant sees the exact Mock USDC bond and a public TRY estimate.
2. They can add Testnet funds through the TR Mock Anchor.
3. A Soroban contract locks the bond; the organizer never holds it in advance.
4. Check in or cancel on time and the contract returns the full bond.
5. After a no-show, the contract applies the event's published split exactly.

The Anchor funding transaction and the Soroban bond transaction are separate,
asynchronous operations. The UI never presents them as one atomic payment.

### Who this is for

The first users are **organizers of free, limited-capacity events** — meetups,
workshops, community classes, university club sessions — where registration is
free, seats are scarce, and no-show rates routinely run 30–50%. For them a lost
seat is wasted catering, wasted room booking, and a waitlist that never got
called.

The second users are **the participants who do show up**, who today compete for
seats against people who registered with nothing at stake.

Istanbul's meetup and workshop scene is the concrete beachhead: high event
density, an existing TRY payment habit, and a local Anchor path that makes the
bond denominated in a currency attendees actually think in.

The same primitive extends, unchanged, to restaurant reservations, clinic
appointments, sports courts and coworking desks. ShowUp is not a ticketing
platform — it is the commitment-and-settlement layer such a platform would need.

## Claim boundary

| True in this project | Not claimed |
|---|---|
| Turkey Mock Anchor on Stellar Testnet | Real Turkish-lira processing |
| Simulated bank transfer and mock KYC | Production banking or KYC/AML |
| Circle-issued Testnet USDC | Mainnet or production USDC settlement |
| Atomic effects inside one Soroban call | Atomicity between a bank, Anchor and contract |
| Wallet-signed Testnet transactions | Custody of user keys or funds |

No real money moves, no real KYC is performed, and Mainnet is out of scope.

## Architecture

```mermaid
flowchart TD
    UI["Next.js app<br/>wallet-first, no database"]

    UI --> KIT["Stellar Wallets Kit<br/>+ Freighter / WalletConnect"]
    UI --> ANCHOR["TR Mock Anchor<br/>SEP-1 · SEP-10 · SEP-38 · SEP-6"]

    KIT -->|signs| NET["Stellar Testnet"]
    ANCHOR -->|"simulated TRY → Mock USDC<br/>(asynchronous)"| NET

    NET --> BOND["showup-bond<br/>Soroban contract"]
    NET --> SAC["Mock USDC<br/>Stellar Asset Contract"]

    BOND <-->|"custody, refund, settle"| SAC

    BOND --> P["Participant<br/>refund"]
    BOND --> O["Organizer<br/>no-show share"]
    BOND --> C["Community pool<br/>no-show share"]
```

The two inbound paths are deliberately separate. Anchor funding and the Soroban
bond call are different transactions at different times, and nothing in the
product joins them into one step.

### The bond lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor P as Participant
    actor O as Organizer
    participant C as showup-bond
    participant T as Mock USDC SAC

    O->>C: create_event(policy)
    Note over C: Bond, capacity, windows and<br/>the no-show split are now fixed

    P->>C: reserve
    C->>T: transfer participant → contract
    Note over C: Reservation = Locked

    alt Attends
        P-->>O: shows QR pass (identifier only)
        O->>C: check_in (verifier signature)
        C->>T: transfer contract → participant
        Note over C: Attended · bond returned in full
    else Cancels in time
        P->>C: cancel_reservation
        C->>T: transfer contract → participant
        Note over C: Cancelled · seat freed
    else Does not attend
        Note over C: check-in deadline passes
        C->>T: organizer_bps share → organizer
        C->>T: remainder → community pool
        Note over C: NoShowSettled · permissionless
    end
```

The application is wallet-first and has no application database or server-held
signing key. Contract getters and events are the data source. The technical
details panel exposes only allowlisted public Testnet identifiers; it never
renders SEP-10 tokens or environment objects.

### Load-bearing Stellar integrations

- **Soroban:** owns custody, deadlines, authorization and settlement policy.
- **Stellar Asset Contract:** the pinned settlement token is
  `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`.
- **Classic asset:** `USDC` issued by
  `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5` on Testnet.
- **Stellar Wallets Kit + Freighter:** uses the browser extension on desktop
  and WalletConnect v2 to hand mobile sessions to the Freighter app; every
  write remains user-signed.
- **RPC and Horizon:** read contract state, ledgers, balances, reserves and trustlines.
- **TR Mock Anchor:** provides the simulated TRY → Testnet USDC path through
  SEP-1/10/38/6. Its `simulate-bank-transfer` endpoint is sandbox-only.

## Contract guarantees

| Method | Authorization | Effect |
|---|---|---|
| `create_event` | organizer | Publishes immutable bond policy and schedule |
| `reserve` | participant | Transfers the exact event bond into contract custody |
| `cancel_reservation` | participant | Returns the bond before the deadline |
| `check_in` | stored verifier | Returns the bond inside the check-in window |
| `cancel_event` | organizer | Cancels without an unbounded refund loop |
| `claim_cancelled_event_refund` | permissionless | Pulls one participant's full refund |
| `settle_no_show` | permissionless | Pays the exact organizer/community split |

Every money-moving path first requires a `Locked` reservation. A reservation
then enters one terminal state, preventing double refunds and double settlement.
The community leg receives the integer remainder, so no rounding dust is lost.

## Repository

```text
apps/web/                    Next.js 16 application
contracts/showup-bond/       Soroban contract and Rust tests
packages/showup-bond-client/ generated TypeScript bindings
scripts/                     preflight, identities, deploy and demo fixtures
docs/                        architecture, evidence, security and demo runbook
```

## Setup

Requirements: Node.js ≥22.12, pnpm ≥10, stable Rust with `wasm32v1-none`, and
Stellar CLI 28.x.

```bash
pnpm install
pnpm preflight
cp .env.example apps/web/.env.local
pnpm dev
```

The defaults are Testnet-only. Set `NEXT_PUBLIC_ENABLE_DEMO_TOOLS=true` only for
the clearly labelled hackathon sandbox flow; keep it `false` in any environment
that is not demonstrating the Mock Anchor.

Mobile wallet handoff also requires a public Reown project identifier in
`NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`. Create it at
[cloud.reown.com](https://cloud.reown.com), allow the deployed origin, and add
the same value to the Vercel environment. It is a public client identifier, not
a wallet secret.

### Verification

```bash
pnpm verify          # Linux/macOS with a native contract toolchain
pnpm win:verify      # Windows; routes Rust/Soroban commands through WSL
pnpm smoke:stellar   # live Testnet + Anchor discovery smoke check
```

The latest complete local run passes the Next.js production build, ESLint,
TypeScript, all web tests, Rust formatting, clippy, 58 contract tests and the
optimized Wasm build.

### Contract deployment and demo fixtures

Run from the environment that owns the Stellar CLI identities (WSL on this
Windows workstation):

```bash
./scripts/setup-identities.sh --fund
./scripts/deploy-testnet.sh --dry-run
./scripts/deploy-testnet.sh
./scripts/seed-demo-event.sh --fast
```

The scripts refuse non-Testnet passphrases. Secrets remain in the Stellar CLI
keystore and never enter `.env` or the repository.

### Frontend deployment

Import the repository into Vercel as a pnpm monorepo, select `apps/web` as the
application, retain workspace access to `packages/showup-bond-client`, and copy
only the public values from `.env.example`. Before publishing, run
`pnpm win:verify` (or `pnpm verify`) and keep demo tools disabled unless the
deployment is explicitly the labelled Testnet hackathon demo. A public URL has
not yet been recorded.

## Stellar Skills used

The exact files used during development are:

- `skills/standards/SKILL.md`
- `skills/smart-contracts/SKILL.md`
- `skills/assets/SKILL.md`
- `skills/dapp/SKILL.md`
- `skills/data/SKILL.md`

See [docs/stellar-skills.md](docs/stellar-skills.md) for the decisions each file
influenced and the live corrections discovered during implementation.

## Technical decisions and what they cost

**No database.** Financial truth is on-chain by requirement, so the only
question was where the *non*-financial data lives. Event title and venue are
bounded strings in contract storage; discovery enumerates `get_event_count()`
and reads events back. That removed a hosted Postgres, a service-role key, RLS
policies and a second system that can be down during a demo. The cost is a few
extra simulate calls per page load, and organizer reservation lists that depend
on the RPC event window — measured live at ~7 days, which the app reports
honestly when it cannot see far enough back.

**The settlement token is pinned at deploy, not per event.** `create_event`
takes no token address. An organizer therefore cannot point an event at a
worthless token, and cannot name themselves as the community pool. Two attack
classes disappear for the price of one constructor argument.

**Pull-based refunds on event cancellation.** `cancel_event` writes one status
field and returns. Iterating participants would make the organizer's ability to
cancel depend on attendance, could exceed the transaction resource budget, and
would strand people on a partial failure. Each participant claims their own
refund in a fixed-cost, independently retryable transaction.

**The QR carries no authority.** It is `{v, eventId, participant, issuedAt}` —
no signature, no nonce, no server round trip. A short-lived nonce was evaluated
and rejected: the only attack it targets is a participant relaying their pass to
someone present, and any relay window long enough to be usable is long enough to
defeat it. Replay, double check-in and window violations are all rejected by the
contract instead, and only the verifier's wallet can move money.

**Every deadline is judged by the ledger clock.** `env.ledger().timestamp()` in
the contract, `getLedgerNow()` in the UI. Eligibility predicates take the clock
as an explicit parameter so that reaching for `Date.now()` is a type error
rather than a review comment.

### Problems that cost real time

- **Soroban does not build on this Windows host.** `soroban-sdk-macros` is a
  proc-macro crate, so even a `wasm32v1-none` build needs a host C toolchain and
  there is no MSVC linker here. All contract work routes through WSL via the
  `win:*` scripts. Git Bash makes it worse: coreutils `link` shadows MSVC
  `link.exe` and the error misdirects.
- **Stellar Wallets Kit defaults to Mainnet.** Its internal `selectedNetwork` is
  `Networks.PUBLIC`, and every sign call resolves
  `opts?.networkPassphrase || selectedNetwork`. Miss both and a Testnet-only app
  asks the user to sign for Mainnet. The adapter sets the network at `init()`,
  passes the passphrase on every call, and asserts Testnet before signing.
- **The generated bindings pin an older SDK.** `stellar contract bindings
  typescript` writes `^16.0.1` while the app runs 17.1.0; under pnpm that is a
  second SDK copy and every `instanceof` across the boundary silently fails. The
  deploy script rewrites the pin as part of generation.
- **The hackathon's own integration guide is wrong in six places.** Most
  consequentially, `pending_trust` is not the no-trustline path — the Anchor
  issues a claimable balance and the deposit still completes. The corrections are
  catalogued in [docs/architecture/SYSTEM.md](docs/architecture/SYSTEM.md).

## What comes next

The hackathon build stops at the P0 primitive on purpose. The credible next
steps, in order:

1. **Mainnet-readiness review** — a security pass over the settlement paths and
   TTL policy, then a real USDC deployment behind a feature flag.
2. **Organizer self-service** — event editing before the first bond is locked,
   multiple verifiers per event, and a waitlist that promotes automatically when
   someone cancels.
3. **Verticals** — the same contract already fits restaurant covers, clinic
   appointments and court bookings. Each needs its own onboarding, not new
   settlement logic.
4. **Funding path** — the intended next step is the **Stellar Community Fund**,
   with this repository and the Testnet evidence below as the technical basis.

## Known limitations

- A participant who cancels cannot reserve the same event again in P0; the
  terminal reservation record is intentionally never overwritten.
- Contract instance TTL is refreshed when an event is created. Persistent bond
  records extend their own TTL and remain restorable; long-idle deployments
  still need maintenance.
- Reservation discovery depends on retained contract events and explicitly
  reports when history may be incomplete.
- QR data is an identifier, not authorization. Current contract state and the
  verifier's wallet signature remain authoritative; QR age is only a warning.
- Mock Anchor availability and its on-ramp worker are external dependencies.
  `/health` being green does not by itself prove a deposit worker completed a
  payment. The app keeps polling, reports degraded states and never fabricates
  success.
- USDC → TRY withdrawal is P1 and does not gate the P0 demo.

## Team

- [@bilalabic](https://github.com/bilalabic)
- **Berzan Baran** — [@BerzanBaran](https://github.com/BerzanBaran)

## Submission evidence

| Item | Evidence |
|---|---|
| Testnet contract | [CCCDFM2MGKO5PEBS565O7FO2OL4CZYUFFRTQLUPPIIIL2JNCPUSUIRHM](https://stellar.expert/explorer/testnet/contract/CCCDFM2MGKO5PEBS565O7FO2OL4CZYUFFRTQLUPPIIIL2JNCPUSUIRHM) |
| Wasm upload | [651dd075474426439024f83ddb6024e2e3bfc14d46bfeafecefc390c2c6d8703](https://stellar.expert/explorer/testnet/tx/651dd075474426439024f83ddb6024e2e3bfc14d46bfeafecefc390c2c6d8703) |
| Contract deploy | [872d4f9501ef75ce57e17756b8aac3fc09b2fe5d96cda525f7b72cc9598b223e](https://stellar.expert/explorer/testnet/tx/872d4f9501ef75ce57e17756b8aac3fc09b2fe5d96cda525f7b72cc9598b223e) |
| C4 smoke event | [6444c9b41a79397d86756b540a6a3a541385e39740e0d3fd53da4a9dc7a0c796](https://stellar.expert/explorer/testnet/tx/6444c9b41a79397d86756b540a6a3a541385e39740e0d3fd53da4a9dc7a0c796) |
| **Bond locked** (event 9) | [6e3c00ab4915ad81b7e9a93d8771213d7d90aa9a7b91cbc92c98b1de9652ac4d](https://stellar.expert/explorer/testnet/tx/6e3c00ab4915ad81b7e9a93d8771213d7d90aa9a7b91cbc92c98b1de9652ac4d) |
| **Attendance refund** (event 9) | [92a8500e6162459c61e69658a24d8dfc7fd4a8f8d4e1eb56b4c3dc5469596586](https://stellar.expert/explorer/testnet/tx/92a8500e6162459c61e69658a24d8dfc7fd4a8f8d4e1eb56b4c3dc5469596586) |
| **Bond locked** (event 10) | [cb63498d25e17999144059ca60b5390939fbf456232e8e3447e2c108673e92c2](https://stellar.expert/explorer/testnet/tx/cb63498d25e17999144059ca60b5390939fbf456232e8e3447e2c108673e92c2) |
| **No-show settlement** (event 10, 80/20) | [e17cfd91b3c289df03f928a88406bce3d3e122206ba6bd88737bd63fb930d350](https://stellar.expert/explorer/testnet/tx/e17cfd91b3c289df03f928a88406bce3d3e122206ba6bd88737bd63fb930d350) |
| **Browser-signed reserve** (event 11, Freighter) | [09a4dbb9e7d121b6940ed5fc11f39faff27886ef0a323317e60c844b81d055c6](https://stellar.expert/explorer/testnet/tx/09a4dbb9e7d121b6940ed5fc11f39faff27886ef0a323317e60c844b81d055c6) |
| Matching refund (event 11) | [ee6512c079e255e1b173e051d79c44064c2cd9588f8d4261d6764ed71ae48d02](https://stellar.expert/explorer/testnet/tx/ee6512c079e255e1b173e051d79c44064c2cd9588f8d4261d6764ed71ae48d02) |
| **Browser-signed create_event** (event 18, Freighter) | [329cf218a9e82b537347cd4495fbdaffe883d0696af1caf2958b0909464e9dce](https://stellar.expert/explorer/testnet/tx/329cf218a9e82b537347cd4495fbdaffe883d0696af1caf2958b0909464e9dce) |
| **Browser-signed reserve** (event 18, Freighter) | [f53c212241c094d5ec105641920a72f9769e6012bc8eac165bae665dbe717843](https://stellar.expert/explorer/testnet/tx/f53c212241c094d5ec105641920a72f9769e6012bc8eac165bae665dbe717843) |
| **Browser-signed check-in + refund** (event 18, Freighter) | [4bb91c258c0515d641d3237a5385854b6356e75b544afa512416f2c232897fd6](https://stellar.expert/explorer/testnet/tx/4bb91c258c0515d641d3237a5385854b6356e75b544afa512416f2c232897fd6) |
| **Anchor deposit** — SEP-6 id `sep_c3awgubgw3jk1sh4owp5`, 150.00 TRY → 3.0594136 USDC (0.75 TRY fee), external ref `TRMA-S5X3-PLQV` | [f66e2f1745ba6c96fe3c943425fabdcad746d05fa897ea83cd5bd737d05c56fd](https://stellar.expert/explorer/testnet/tx/f66e2f1745ba6c96fe3c943425fabdcad746d05fa897ea83cd5bd737d05c56fd) |
| Public demo URL | [showup-steel.vercel.app](https://showup-steel.vercel.app) |
| Public repository | [github.com/bilalabic/showup](https://github.com/bilalabic/showup) |
| Pitch deck | **Pending** — built from the official Stellar Pro Hackathon template |

Implementation ownership lives in this public repository; team/contact fields
and the project narrative must be completed by the owner in the submission
portal rather than invented in source control.

### Not a submission requirement

A recorded demo video is **not** on the published requirement list, and whether
one is expected has never appeared in an official source — the project's own
specification still carries it as an open question for the organizers. It is
kept here only as **fallback insurance**: if the live demo fails in the room, a
recorded run of the same flow can stand in, labelled as a recording rather than
presented as live. It is worth the time only once the required items above are
finished.

## More documentation

- [System architecture](docs/architecture/SYSTEM.md)
- [Contract reference](docs/contract.md)
- [Security model](docs/SECURITY.md)
- [Hackathon requirement map](docs/HACKATHON_REQUIREMENTS.md)
- [Demo runbook](docs/demo-script.md)
- [Testnet deployment evidence](docs/deployments/testnet.md)

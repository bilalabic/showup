# ShowUp

**Programmable attendance commitment bonds for events and reservations, on Stellar.**

Rise In × Stellar Pro Hackathon Türkiye 2026 — **Genesis** track — **Stellar Testnet**.

> The P0 product is implemented and verified locally. Live Freighter acceptance,
> a successful Mock Anchor on-ramp record, the public frontend URL, video and
> pitch deck remain submission evidence to capture; this README does not present
> those pending items as complete.

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

```text
Participant / organizer browser
        │
        ├── Wallets Kit + Freighter / WalletConnect ──► Stellar Testnet
        │                                         │
        │                                         ├── ShowUp bond contract
        │                                         └── Mock USDC SAC
        │
        └── TR Mock Anchor
              SEP-1 discovery
              SEP-10 authentication
              SEP-38 public price + firm quote
              SEP-6 deposit + status polling
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

## Submission evidence

| Item | Evidence |
|---|---|
| Testnet contract | [CCCDFM2MGKO5PEBS565O7FO2OL4CZYUFFRTQLUPPIIIL2JNCPUSUIRHM](https://stellar.expert/explorer/testnet/contract/CCCDFM2MGKO5PEBS565O7FO2OL4CZYUFFRTQLUPPIIIL2JNCPUSUIRHM) |
| Wasm upload | [651dd075474426439024f83ddb6024e2e3bfc14d46bfeafecefc390c2c6d8703](https://stellar.expert/explorer/testnet/tx/651dd075474426439024f83ddb6024e2e3bfc14d46bfeafecefc390c2c6d8703) |
| Contract deploy | [872d4f9501ef75ce57e17756b8aac3fc09b2fe5d96cda525f7b72cc9598b223e](https://stellar.expert/explorer/testnet/tx/872d4f9501ef75ce57e17756b8aac3fc09b2fe5d96cda525f7b72cc9598b223e) |
| C4 smoke event | [6444c9b41a79397d86756b540a6a3a541385e39740e0d3fd53da4a9dc7a0c796](https://stellar.expert/explorer/testnet/tx/6444c9b41a79397d86756b540a6a3a541385e39740e0d3fd53da4a9dc7a0c796) |
| Browser create/reserve/check-in/no-show/cancellation hashes | **Pending live Freighter acceptance** |
| Successful Anchor deposit id + Stellar transaction | **Pending live Anchor worker acceptance** |
| Public demo URL | **Pending deployment** |
| Demo video | **Pending** |
| Pitch deck | **Pending official-template copy** |

Implementation ownership lives in this public repository; team/contact fields
and the project narrative must be completed by the owner in the submission
portal rather than invented in source control.

## More documentation

- [System architecture](docs/architecture/SYSTEM.md)
- [Contract reference](docs/contract.md)
- [Security model](docs/SECURITY.md)
- [Hackathon requirement map](docs/HACKATHON_REQUIREMENTS.md)
- [Demo runbook](docs/demo-script.md)
- [Testnet deployment evidence](docs/deployments/testnet.md)

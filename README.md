# ShowUp

**Programmable attendance commitment bonds for events and reservations, on Stellar.**

Rise In × Stellar Pro Hackathon Türkiye 2026 — **Genesis** track — **Stellar Testnet**.

> **Status: C5 — Testnet wallet connection and network guard complete.**
> The complete Soroban bond lifecycle is implemented, covered by 58 contract
> tests, deployed on Testnet, and exposed through generated TypeScript bindings.
> The Next.js app now connects through Stellar Wallets Kit + Freighter behind an
> application-owned wallet port, blocks non-Testnet sessions, and resets safely
> when the active account changes. Contract-backed organizer flows begin at C6.

---

## The problem

People reserve scarce slots and do not show up. That wastes seats, organizer
capacity, food, venue resources, and other people's opportunities.

## The idea

ShowUp asks a participant for a small **refundable attendance bond**:

1. The participant sees the bond amount in TRY.
2. They fund it through the hackathon Mock Anchor (simulated TRY → Mock USDC).
3. The Mock USDC is locked in a Soroban smart contract — never in the organizer's hands.
4. Attend → full refund.
5. Cancel within the allowed window → refund per the event policy.
6. No-show → the contract applies the published settlement rule.

The organizer never holds participant bond funds before settlement. Deterministic
contract rules do, not organizer discretion.

---

## Claim boundary

This is important and is stated the same way in the UI, the demo and the pitch.

| What is true | What is **not** claimed |
|---|---|
| The MVP uses the Turkey Mock Anchor on Stellar Testnet. | We process real Turkish lira. |
| The Mock Anchor simulates a local TRY funding flow. | A real bank transfer is executed. |
| Mock KYC is automatically approved. | Production KYC/AML is implemented. |
| The Soroban settlement call is atomic for its on-chain effects. | The Anchor and bank steps are atomic with the contract. |
| Mock USDC is the Testnet settlement asset. | This is production USDC settlement. |
| ShowUp enforces the published bond policy on-chain. | ShowUp proves the physical identity of the attendee. |

No real money moves. No real KYC is performed. Mainnet is out of scope.

---

## Architecture (target)

```
                  ┌──────────────────┐
                  │    Next.js UI    │
                  └────────┬─────────┘
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
   Stellar Wallets Kit             Mock Anchor
     + Freighter              SEP-1/10/12/38/6
             │                           │
             └─────────────┬─────────────┘
                           ▼
                  Participant Mock USDC
                           │
                           ▼
                ┌────────────────────┐
                │ ShowUp Bond        │
                │ Soroban Contract   │
                └───────┬────────────┘
                        │
        ┌───────────────┼────────────────┐
        ▼               ▼                ▼
  Participant       Organizer      Community Pool
    refund          settlement       settlement
```

**Primary ecosystem integration:** Stellar Wallets Kit (SCF Integration List,
Wallet Connection Layers). The guaranteed P0 wallet path is Freighter.

---

## Repository layout

```
ShowUp/
├─ apps/web/               Next.js App Router frontend + API routes
├─ contracts/showup-bond/  Soroban contract (Rust)
├─ packages/showup-bond-client/ generated TypeScript contract bindings
├─ scripts/                deploy / seed / smoke-test tooling
├─ docs/                   architecture, audit, skills evidence, demo script
├─ Cargo.toml              Rust workspace
├─ pnpm-workspace.yaml     pnpm workspace
└─ .env.example            environment template — never commit a real .env
```

---

## Prerequisites

| Tool | Required |
|---|---|
| Node.js | ≥ 22.12.0 (`@stellar/stellar-sdk` 17 requires it). Developed on 24.x. |
| pnpm | ≥ 10 |
| Rust | stable, with the `wasm32v1-none` target |
| Stellar CLI | 28.x (matches Testnet protocol 28) |

`rust-toolchain.toml` pins the Rust channel, components and Wasm target, so
`rustup` provisions them automatically.

### Windows developers: build contracts in WSL

Soroban builds need a working host C toolchain, because `soroban-sdk-macros` is a
proc-macro crate that compiles for the host even when the contract targets
`wasm32v1-none`. Without the MSVC "Desktop development with C++" workload,
`cargo` fails with `linker 'link.exe' not found`.

Either install the MSVC C++ build tools, or run the contract commands in WSL —
the `win:*` scripts below do that for you. Do not run `cargo` from Git Bash on
Windows: GNU coreutils `link` shadows MSVC `link.exe` and the error it produces
is misleading.

## Getting started

```bash
pnpm install
pnpm preflight               # checks Node, Rust, Wasm target, Stellar CLI, linker
cp .env.example .env.local   # then fill in the blanks
pnpm dev
```

Contract workflow (Linux, macOS, or inside WSL):

```bash
cargo test --workspace     # unit tests
stellar contract build     # wasm32v1-none artifact
```

Same thing from a Windows shell, routed through WSL:

```bash
pnpm win:contracts:test
pnpm win:contracts:build
```

Run everything the way CI would:

```bash
pnpm verify
```

On Windows use `pnpm win:verify` instead — it runs the same steps with the
contract half in WSL.

A live toolchain check against Testnet and the Mock Anchor:

```bash
pnpm smoke:stellar
```

Testnet identities and deployment (run where the build works — WSL on Windows):

```bash
./scripts/setup-identities.sh --fund   # once
./scripts/deploy-testnet.sh --dry-run  # every check, deploys nothing
./scripts/deploy-testnet.sh            # build, deploy, invoke
```

Secret keys live in the Stellar CLI keystore and never enter `.env` or this
repository. See [docs/contract.md](docs/contract.md) — the keystore does not
cross the WSL boundary.

---

## Stellar Skills used

The hackathon asks for the exact Skill files used during development.
The working record is **[docs/stellar-skills.md](docs/stellar-skills.md)** and it
is kept current as the build progresses.

---

## Submission evidence

Filled in as the build progresses.

| Item | Value |
|---|---|
| Testnet contract ID | [CCCDFM2MGKO5PEBS565O7FO2OL4CZYUFFRTQLUPPIIIL2JNCPUSUIRHM](https://stellar.expert/explorer/testnet/contract/CCCDFM2MGKO5PEBS565O7FO2OL4CZYUFFRTQLUPPIIIL2JNCPUSUIRHM) |
| Wasm upload transaction | [651dd075474426439024f83ddb6024e2e3bfc14d46bfeafecefc390c2c6d8703](https://stellar.expert/explorer/testnet/tx/651dd075474426439024f83ddb6024e2e3bfc14d46bfeafecefc390c2c6d8703) |
| Contract deploy transaction | [872d4f9501ef75ce57e17756b8aac3fc09b2fe5d96cda525f7b72cc9598b223e](https://stellar.expert/explorer/testnet/tx/872d4f9501ef75ce57e17756b8aac3fc09b2fe5d96cda525f7b72cc9598b223e) |
| C4 smoke event transaction | [6444c9b41a79397d86756b540a6a3a541385e39740e0d3fd53da4a9dc7a0c796](https://stellar.expert/explorer/testnet/tx/6444c9b41a79397d86756b540a6a3a541385e39740e0d3fd53da4a9dc7a0c796) |
| Public demo URL | _pending_ |
| Demo video | _pending_ |
| Pitch deck | _pending_ |

---

## Security notes

- The app never requests or stores a user's secret key. All signing happens in the wallet.
- `.env` files are git-ignored; `.env.example` is the only environment file in the repository.
- `ENABLE_DEMO_TOOLS` must be `false` outside the Testnet demo.
- Testnet only. No mainnet deployment.

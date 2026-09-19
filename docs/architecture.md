# Architecture

> **Superseded by [`docs/architecture/SYSTEM.md`](architecture/SYSTEM.md).**
> That document is the approved P0 system architecture and is authoritative.
> This file is kept only as the Phase 0 record of what was decided before the
> architecture pass, and is folded into `SYSTEM.md` at documentation checkpoint
> C12.

> **Phase 0 placeholder.** This file records only what had been decided and
> verified at the end of Phase 0.

## Decided in Phase 0

| Area | Decision | Why |
|---|---|---|
| Frontend | Next.js App Router + React + TypeScript | One repository for UI and API routes; fast Vercel deploy. |
| Styling | Tailwind CSS | Scaffolded by `create-next-app`; no custom component system during the hackathon. |
| Package manager | pnpm workspace (`apps/*`) | Reproducible lockfile. |
| Contract language | Rust + `soroban-sdk` 28 | Testnet runs protocol 28. |
| Wasm target | `wasm32v1-none` | The only Wasm target the Stellar runtime supports. |
| Network | Stellar Testnet only | Mainnet is explicitly out of scope. |
| Wallet | Stellar Wallets Kit, Freighter as the guaranteed P0 path | Primary ecosystem integration; on the SCF Integration List. |
| Local payments | TR Mock Anchor, SEP-1/10/12/38/6 | Satisfies the hackathon local-payment requirement as a Testnet simulation. |
| Contract builds on Windows | Run in WSL `Ubuntu-24.04` via the `win:*` scripts | No MSVC linker on the dev host; proc-macro crates need a host C toolchain. |

## Locked decision: Stellar Wallets Kit stays, despite its dependency weight

`@creit.tech/stellar-wallets-kit@2.6.0` pulls in roughly 726 transitive packages,
including Solana, NEAR, Coinbase and WalletConnect SDKs that ShowUp will never
call. `@stellar/freighter-api` would cover the guaranteed P0 wallet path in a
fraction of that.

**The kit stays anyway.** It is the project's required Stellar ecosystem
integration, it is on the SCF Integration List, and dropping it would mean
finding another qualifying integration under time pressure — a far larger risk
than a heavy `node_modules` tree.

Mitigations, which are the actual work this decision implies:

- Import the kit only from the client components that genuinely need it, never
  from a server component or a shared barrel file, so it stays out of the server
  bundle.
- Prefer deep imports over the root entry where the kit's exports map allows it.
  The root entry loads Lit web components and is browser-only.
- Only Freighter is guaranteed for P0. Additional providers are exposed only if
  they cost nothing extra to verify.
- Revisit after the demo, not during it.

Reviewed against the dependency audit in
`docs/phase-0-environment-audit.md` section 7.

## Not decided yet

Contract data model, storage layout and TTL policy, authorization matrix,
settlement math, backend/database boundaries, QR nonce design, and page
structure. All of these are specified in
`SHOWUP_HACKATHON_SPEC_REVISED.md` and get implemented in later phases.

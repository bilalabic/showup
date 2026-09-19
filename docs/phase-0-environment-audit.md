# Phase 0 — Environment & Tooling Audit

**Machine:** Windows 11 Pro 26200, PowerShell + Git Bash
**Audit date:** 2026-09-19
**Scope:** environment, tooling, repository foundation and verification only.
No product features and no Soroban business logic were implemented.

---

## 1. Compatibility table

| Tool | Installed | Recommended / required | Action |
|---|---|---|---|
| Git | 2.55.0.windows.5 | any recent 2.x | OK — repository initialised on `main` |
| Node.js | v24.21.0 | **>= 22.12.0** (see discrepancy D1) | OK |
| Corepack | 0.36.0 | n/a | Not used — see discrepancy D2 |
| pnpm | *(missing)* -> **12.4.2** | >= 10 | **Installed** via `npm install -g pnpm` (user-scoped prefix `%APPDATA%\npm`, already on PATH) |
| Rust (rustc) | 1.98.1 | stable, >= 1.84 for `wasm32v1-none` | OK |
| rustup | 1.29.1 | any recent | OK |
| Cargo | 1.98.1 | matches rustc | OK |
| rustfmt | 1.9.0-stable | matches toolchain | OK |
| clippy | 0.1.98 | matches toolchain | OK |
| Rust target `wasm32v1-none` | installed | required — the only Wasm target the Stellar runtime supports | OK — pinned in `rust-toolchain.toml` |
| MSVC C++ build tools (`link.exe`) | **absent** | required to build Soroban natively on Windows | **Not installed** — system-wide change, needs approval. Worked around via WSL, see discrepancy D6 |
| WSL `Ubuntu-24.04` | present — rustc/cargo 1.98.1, Stellar CLI 28.0.0, `wasm32v1-none` | fallback for Linux-only blockchain tooling | **In use for all contract builds** |
| Stellar CLI | 28.0.0 (Windows) / 28.0.0 (WSL) | 28.x (Testnet protocol 28) | OK |
| `soroban` CLI | *(absent)* | n/a — retired, replaced by `stellar` | Correct, nothing to do |
| Claude Code | 2.1.278 | n/a | OK |
| `stellar/stellar-dev-skill` | installed as plugin marketplace `stellar-dev` | required for skill evidence | OK — 8 skills present |
| Raven MCP | configured at user scope, `https://raven.stellar.buzz/mcp` | optional dev tool | **Verified live** — see section 4 |

Nothing pre-existing was deleted or overwritten. The only file in the directory
before Phase 0 was `SHOWUP_HACKATHON_SPEC_REVISED.md`, which is untouched.

---

## 2. Verified versions and live facts

Checked against primary sources on 2026-09-19, not from memory.

| Fact | Value | Source |
|---|---|---|
| Testnet protocol version | **28** | Testnet RPC `getVersionInfo` / `getNetwork` |
| Testnet RPC build | 28.0.1, captive core `stellar-core 28.0.1` | Testnet RPC `getVersionInfo` |
| Testnet passphrase | `Test SDF Network ; September 2015` | Testnet RPC `getNetwork` |
| `soroban-sdk` latest stable | **28.0.0** | crates.io API |
| `stellar-cli` latest stable | **28.0.0** | crates.io API |
| `@stellar/stellar-sdk` latest | **17.1.0**, `engines.node >= 22.12.0` | npm registry |
| `@creit.tech/stellar-wallets-kit` latest | **2.6.0** | npm registry |
| `next` latest | 16.3.5 | npm registry |
| Mock Anchor home domain | `tr-mock-anchor.fly.dev` — live | `/.well-known/stellar.toml` fetched |
| Mock Anchor SEP endpoints | `/auth`, `/sep6`, `/sep12`, `/sep38` | `stellar.toml` |
| Mock Anchor signing key | `GDXYO6FJCNXZEWGXD54GT76FGFYLOLSOGSOJLNQ6WGHCGEQPO7NTE73M` | `stellar.toml` |
| Mock USDC issuer | `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`, `status="test"` | `stellar.toml` |
| Mock Anchor limits | deposit 50–3,000 TRY; withdraw min 1 USDC; TRY 2 dp, USDC 7 dp | hackathon `SKILL.md` |
| Mock-only endpoint | `POST /sep6/tx/{id}/simulate-bank-transfer` | hackathon `SKILL.md` |
| Stellar Wallets Kit on SCF Integration List | **Yes** — "Wallet Connection Layers", estimate under 1 day | `stellar/scf-handbook` integration list |
| Trustless Work on SCF Integration List | **Yes** — DeFi / Individual Protocols, estimate up to 2 weeks | `stellar/scf-handbook` integration list |
| `stellar-dev-skill` skill directories | `agentic-payments`, `assets`, `cross-chain`, `dapp`, `data`, `smart-contracts`, `standards`, `zk-proofs` | GitHub contents API |

Every value the specification asserts about the Mock Anchor was confirmed against
the live `stellar.toml` and the hackathon `SKILL.md`. No corrections were needed.

---

## 3. Discrepancies recorded

Per the Phase 0 brief, outdated technical statements are recorded rather than
silently overwritten. Implementation follows current official documentation.

**D1 — Node.js floor.**
`SHOWUP_HACKATHON_SPEC_REVISED.md` section 9.1 says "Node.js >= 20". The current
`@stellar/stellar-sdk` (17.1.0) declares `engines.node >= 22.12.0`, so Node 20
cannot satisfy the chosen dependency set. The repository therefore pins
`engines.node >= 22.12.0` and develops on Node 24.21.0. This follows the
specification's own rule to prioritise dependency compatibility over copying a
runtime blindly.

**D2 — Corepack unusable on this machine.**
`corepack enable pnpm` fails with `EPERM ... C:\Program Files\nodejs\pnpx`
because Node is installed under `Program Files` and shim creation needs
administrator rights. Rather than escalate privileges, pnpm was installed with
`npm install -g pnpm` into the user-scoped prefix `%APPDATA%\npm`, which is
already on `PATH`. No elevation was used anywhere in Phase 0.

**D3 — Stellar CLI scaffold lags the protocol.**
`stellar contract init` on CLI 28.0.0 still writes `soroban-sdk = "27"` into the
generated workspace `Cargo.toml`, while Testnet runs protocol 28 and
`soroban-sdk` 28.0.0 is stable. ShowUp pins `soroban-sdk = "28"`, consistent with
the documented rule that the SDK major version tracks the protocol version.

**D4 — Official skill documents protocol 27.**
`skills/smart-contracts/SKILL.md` states it was written against protocol 27 and
instructs the reader to resolve current versions from crates.io and RPC
`getVersionInfo`. Following that instruction gives 28. Recorded in
`docs/stellar-skills.md`.

**D5 — `stellar-build` installer rejected.**
The Phase 0 brief suggested a project-local `stellar-build` install. The
installer was downloaded and read in full. Even project-local it grants blanket
tool permissions, registers six learning-loop hooks including a prompt rewriter,
writes a `.codex/` tree, pings an install counter, and duplicates the already
installed `stellar-dev-skill`. It was **not** executed. Four skill folders were
copied by hand instead. Full reasoning and the exact folder mapping are in
`docs/stellar-skills.md` section 3.

**D6 — Soroban cannot be built natively on this Windows host. Blocking.**
`cargo clippy`, `cargo test` and `stellar contract build` all fail on Windows
with:

```
error: linker `link.exe` not found
note: the msvc targets depend on the msvc linker but `link.exe` was not found
error: could not compile `proc-macro2` (build script)
```

Visual Studio 18 Community is installed but the "Desktop development with C++"
workload is not: `VC\Tools\MSVC` is empty, there is no `link.exe` and no Windows
SDK under `Windows Kits\10\bin`. No `gcc`, `clang` or `lld-link` on `PATH`, and
the `x86_64-pc-windows-gnu` target is not installed.

This blocks the Wasm build too, not just host builds: `soroban-sdk-macros` is a
proc-macro crate, so it must be compiled for the **host** even when the contract
targets `wasm32v1-none`. Having the `wasm32v1-none` target installed is not
enough.

Second trap: under Git Bash, GNU coreutils `link` shadows MSVC `link.exe` and
produces a misleading `link: extra operand ...` error. Cargo must not be invoked
from Git Bash on this machine.

**Resolution:** all Rust and Stellar CLI work runs in WSL `Ubuntu-24.04`, which
the project conventions already allow for Linux-only blockchain tooling. WSL was
confirmed to carry identical versions — rustc/cargo 1.98.1, Stellar CLI 28.0.0,
target `wasm32v1-none`. Root `package.json` gained `win:*` script variants that
route the contract commands through WSL; the plain `contracts:*` scripts stay
portable for Linux, macOS and CI.

Installing the MSVC C++ build tools would also fix this, but that is a
system-wide multi-gigabyte change and is **not required** — the WSL path is
verified green end to end. It was therefore not installed.

`scripts/preflight.mjs` (`pnpm preflight`, and the first step of both `verify`
and `win:verify`) detects the MSVC workload through `vswhere`, falls back to
checking for the WSL distro, and prints the applicable path. A contributor now
gets an actionable warning instead of a cryptic linker error partway through a
build.

**Related trap, now documented.** The Stellar CLI keystore lives in
`~/.config/stellar`, and WSL has its own home directory, so identities do not
cross the boundary: a key created on Windows is invisible to a deploy run in WSL.
Both keystores were confirmed empty during Phase 0. The deploy identity must be
created in whichever environment runs the deploy — covered in `docs/contract.md`,
in `scripts/deploy-testnet.sh`, and by a preflight warning.

**D7 — `stellar contract optimize` is deprecated.**
On CLI 28.0.0 it prints: "`stellar contract optimize` is deprecated and will be
removed in future versions of the CLI. Use `stellar contract build --optimize`
instead." `--optimize` already defaults to `true` on `contract build`, so
scripts should not call `optimize` separately.

---

## 4. Raven MCP

- Configured at user scope in `~/.claude.json` as
  `{"stellar-raven": {"type": "http", "url": "https://raven.stellar.buzz/mcp"}}`.
- **Connection verified by a live call**, not by the presence of the config
  entry: a `stellarDocs.search_docs` query returned real
  `developers.stellar.org` result URLs.
- Already authenticated. No OAuth or browser interaction was required.
- Used in Phase 0 for documentation lookups only. The demo and the deployed
  application must not depend on it.

---

## 5. What was installed

| Item | Scope | Command |
|---|---|---|
| pnpm 12.4.2 | user (`%APPDATA%\npm`) | `npm install -g pnpm` |

Nothing else was installed globally. No system-wide software, no elevation, no
unrelated blockchain tooling. Application dependencies live in the workspace and
the lockfile.

---

## 6. Repository foundation created

```
ShowUp/
├─ .claude/skills/          4 workflow skills (git-ignored, see docs/stellar-skills.md)
├─ apps/web/                Next.js 16 App Router + TypeScript + Tailwind v4
├─ contracts/showup-bond/   Soroban scaffold — NO business logic (deliberate)
├─ docs/                    architecture, audit, contract, demo script, skills
├─ scripts/deploy-testnet.sh
├─ Cargo.toml               Rust workspace, soroban-sdk 28
├─ rust-toolchain.toml      stable + rustfmt + clippy + wasm32v1-none
├─ pnpm-workspace.yaml      packages: apps/*
├─ package.json             workspace root, engines + verify script
├─ .env.example             every variable, no secrets
├─ .gitignore
├─ .nvmrc
└─ README.md
```

The contract scaffold exposes a single `version()` method returning `"phase-0"`.
This is a toolchain probe, not a product feature. Event policy, reservations,
check-in, cancellation and no-show settlement are untouched.

---

## 7. Verification results

### Web toolchain — all green

| Step | Result |
|---|---|
| `pnpm lint` | **PASS** |
| `pnpm build` | **PASS** — Turbopack, 4 static routes |
| `pnpm typecheck` | **PASS** (see the ordering note below) |
| Stellar smoke test | **PASS**; the failure path was exercised separately and exits 1 |

Resolved versions: `next` 16.3.5, `react` / `react-dom` 19.2.8, `typescript`
5.9.3, `tailwindcss` 4.3.3, `@stellar/stellar-sdk` 17.1.0 (pinned),
`@creit.tech/stellar-wallets-kit` 2.6.0 (pinned), `@types/node` 22.20.3.

Live values the smoke test read from the network:

```
passphrase             Test SDF Network ; September 2015
protocol version       28
ledger sequence        4759821
WEB_AUTH_ENDPOINT      https://tr-mock-anchor.fly.dev/auth
TRANSFER_SERVER        https://tr-mock-anchor.fly.dev/sep6
KYC_SERVER             https://tr-mock-anchor.fly.dev/sep12
ANCHOR_QUOTE_SERVER    https://tr-mock-anchor.fly.dev/sep38
USDC issuer            GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
```

SDK API confirmed by reading `node_modules`, not assumed: the root export exposes
an `rpc` namespace that re-exports `RpcServer` as `Server`, so `new
rpc.Server(url)` is correct and `SorobanRpc` does not exist. SEP-1 discovery uses
`StellarToml.Resolver.resolve(domain)`.

**Script ordering fix.** Next 16 generates the global `LayoutProps` / `PageProps`
types into `.next/types` during `next build`, so on a clean checkout `tsc
--noEmit` fails with `TS2304: Cannot find name 'LayoutProps'` unless a build ran
first. The root `verify` script therefore runs `lint -> build -> typecheck`, not
`lint -> typecheck -> build`. No application code was changed.

### Contract toolchain — green in WSL, blocked on Windows

| Step | Windows | WSL Ubuntu-24.04 |
|---|---|---|
| `cargo fmt --all -- --check` | PASS | **PASS** |
| `cargo clippy --all-targets -- -D warnings` | FAIL — no linker (D6) | **PASS**, zero warnings |
| `cargo test --workspace` | could not run (D6) | **PASS** — `version_returns_scaffold_marker ... ok` (1 passed, 0 failed) |
| `stellar contract build` | FAIL — no linker (D6) | **PASS** |

Artifact: `target/wasm32v1-none/release/showup_bond.wasm`, **546 bytes**, correct
`wasm32v1-none` target, sha256
`338139fdc5cba56d80299749905fd0f86bcad9c635ba6f8c1103e4cd1e1ed8cb`. The only
exported function is `version`, confirming the contract API was not expanded.
`stellar contract build` already optimises (559 -> 546 bytes); a separate
`stellar contract optimize` pass yielded no further reduction and is deprecated
(D7).

`Cargo.lock` was generated and resolves `soroban-sdk` **28.0.0**,
`soroban-sdk-macros` 28.0.0, `soroban-env-*` 28.0.2 (a normal patch offset from
the SDK, not a mismatch) and `stellar-xdr` 28.0.0. `target/` is correctly ignored
by `.gitignore`.

### Testnet deploy smoke test — the full chain is proven

The specification (section 10.3) asks for a clean build/deploy/invoke smoke test
against live Testnet before relying on the toolchain. That was run, end to end,
using the repository's own scripts rather than ad-hoc commands.

| Step | Result |
|---|---|
| `scripts/setup-identities.sh --fund` | **PASS** — both identities created and funded via friendbot, idempotent on re-run |
| `scripts/deploy-testnet.sh --dry-run` | **PASS** — passphrase, protocol, identity presence, account funding and build all verified, nothing deployed |
| `scripts/deploy-testnet.sh` | **PASS** — upload, deploy, invoke |

| Item | Value |
|---|---|
| Scaffold contract ID | `CDHTJZOO2ZROIR5CC76A3XXXQKWEROFNNA3ENTJPVJRYSNOZOMNQFIXF` |
| Wasm hash | `338139fdc5cba56d80299749905fd0f86bcad9c635ba6f8c1103e4cd1e1ed8cb` |
| Upload transaction | `ca6a999adfbac086cd5c06ead27404f2be0e1617f47881aa54055a97077df7c1` |
| Deploy transaction | `e66706f25b6bb2c8efb378232ccbe87244a137960b395b50382942df2276cc55` |
| `version()` returned | `"phase-0"` |
| Deployer | `GBN4VYCAM6SQWTZV54AQ5IQP5FDGQ7SYTHMU7T5QKRAHJWZSNDKNAVD4` |
| Community pool | `GDCXH26TJFRMADSZKVLNB4EWNV2ORZHNEGDMH3D5UHPX25EW5REJOKP7` |

> **This is not the submission contract.** It is a 546-byte scaffold whose only
> export is `version()`. It exists to prove the build -> upload -> deploy ->
> invoke chain works before hackathon hours, and it is deliberately absent from
> the submission evidence table in the README. The real `showup-bond` contract
> replaces it.

The `--alias showup-bond` entry was written to the WSL user config at
`~/.config/stellar/contract-ids`, not into the repository. No stray files were
created in the working tree.

### Dependency-surface finding

`@creit.tech/stellar-wallets-kit@2.6.0` pulls in **+726 packages** on its own,
taking the lockfile to 818 resolutions. The tree includes Solana SDKs
(`@solana/*`, `@solana-program/*`), `@coinbase/cdp-sdk`, `@reown/appkit`
(WalletConnect), `near-api-js`, `@safe-global/*` and Lit — all of it serving the
multi-wallet / WalletConnect modules.

This materially widens the supply-chain surface, and `@stellar/freighter-api`
would avoid the entire tree if only the Freighter path mattered.

**Decision: the kit stays.** It is the project's required Stellar ecosystem
integration and is on the SCF Integration List; replacing it would mean sourcing
another qualifying integration under deadline pressure, which is the larger risk.
No page imports it yet, so it does not reach the production bundle today. The
import discipline that keeps it that way is recorded as a locked decision in
`docs/architecture.md`.

Four build scripts were explicitly declined in `pnpm-workspace.yaml`
(`@reown/appkit`, `bufferutil`, `secp256k1`, `utf-8-validate`) — all optional
native or postinstall steps with working JavaScript fallbacks.

Unmet peer warnings, none of which affect build or typecheck: `typescript` 5.9.3
against `@twind/*` wanting `^4.8.4`, and `utf-8-validate` 6.0.6 against `ws@7`
wanting `^5.0.2`. Deprecation notices: `eslint@9.39.5`,
`@safe-global/safe-gateway-typescript-sdk@3.23.1`, `uuid@8.3.2`.

### Runtime note

Node 24 executed the TypeScript smoke test directly; `tsx` was not needed. The
file uses the `.mts` extension so Node resolves it as an ES module without
adding `"type": "module"` to `apps/web/package.json`, which would have affected
the Next.js config files.

---

## 8. Not done in Phase 0 (by design)

- No product features, and no UI beyond the `create-next-app` default page.
- No Soroban business logic.
- No contract deployment, no transactions, no funded accounts, no network writes.
- No Supabase project, no shadcn/ui, no React Hook Form, no Zod and no QR
  library — those arrive with the features that need them.
- No commit was made; the working tree is left for review first.

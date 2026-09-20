# Stellar Skills & Development Workflow

The hackathon submission must list the **exact Skill files actually used** during
development, not every skill installed on a machine. This file is the working
record; the public README quotes it.

Everything here is developer tooling. **None of it is a runtime dependency of
ShowUp, and none of it counts as the required Stellar ecosystem integration.**
The required ecosystem integration is Stellar Wallets Kit, which ships inside the
product.

---

## 1. Official `stellar/stellar-dev-skill` modules

Installed as a Claude Code plugin marketplace, not vendored into this repository:

```
marketplace: stellar-dev  ->  github: stellar/stellar-dev-skill
```

Verified on 2026-09-19 against the upstream repository. The `skills/` directory
upstream contains exactly: `agentic-payments`, `assets`, `cross-chain`, `dapp`,
`data`, `smart-contracts`, `standards`, `zk-proofs`.

### Modules used by ShowUp

All five were used. This is the list the hackathon submission requires, and each
row names the code it shaped.

| Skill path | ShowUp use | Where it shows up |
|---|---|---|
| `skills/smart-contracts/SKILL.md` | Soroban project setup, contract anatomy, `wasm32v1-none` target, authorization, storage/TTL, tests. | `contracts/showup-bond/` — the Cargo release profile and `crate-type`, the two-node `require_auth` tree in `reserve`, the persistent/instance storage split and TTL policy in `src/storage.rs`, and the `try_*` negative-test shape throughout `src/test/`. |
| `skills/standards/SKILL.md` | SEP-1/10/38/6 roles, Anchor flow, standards terminology. | `apps/web/lib/anchor/` — `sep1.ts`, `sep10.ts`, `sep38.ts`, `sep6.ts` and the deposit state machine in `machine.ts`. |
| `skills/assets/SKILL.md` | Mock USDC issuer, trustlines, Stellar Asset Contract, token precision. | `apps/web/lib/stellar/horizon.ts` (issuer pinning, `changeTrust`, balance reads), the SAC pinned at deploy in the contract constructor, and 7-decimal integer handling in `apps/web/lib/domain/amounts.ts`. |
| `skills/dapp/SKILL.md` | Wallets Kit / Freighter connection, signing, contract invocation. | `apps/web/lib/wallet/` — the port, the Kit adapter and the provider — plus the simulate → sign → send → confirm pipeline in `apps/web/lib/contract/index.ts`. |
| `skills/data/SKILL.md` | RPC / Horizon queries, contract state and event reads, Explorer evidence. | `apps/web/lib/stellar/rpc.ts`, `apps/web/lib/contract/event-log.ts` (retention-aware `getEvents` indexing), and the Explorer links in `docs/deployments/testnet.md`. |

### Modules deliberately NOT used

`skills/agentic-payments/SKILL.md`, `skills/cross-chain/SKILL.md`, and
`skills/zk-proofs/SKILL.md` are outside the P0 architecture. They will only be
listed if ShowUp actually adopts those features, which is not planned.

### Recorded discrepancy

`skills/smart-contracts/SKILL.md` states it was written against **protocol 27**
(`soroban-sdk` 27, `stellar-cli` 27). The same file tells the reader to resolve
current versions from crates.io and from RPC `getVersionInfo` rather than trust
the document. Following that instruction:

- Testnet RPC `getVersionInfo` reports `protocolVersion: 28` (2026-09-19).
- `soroban-sdk` 28.0.0 and `stellar-cli` 28.0.0 are the current stable releases.

ShowUp therefore targets **28**, which is consistent with the skill's own rule
that the SDK major version tracks the protocol version.

---

## 2. Hackathon `SKILL.md`

Source: `github.com/yigitcangokmen/stellar-hackathon-turkiye` → `SKILL.md`

The source describes `stellar.toml` discovery, SEP-10, simulated SEP-12,
SEP-38, SEP-6 and the mock-only bank-transfer trigger. Live implementation work
corrected three source assumptions: ShowUp's authenticated SEP-6 path needs no
separate SEP-12 call; the modern no-trustline path may complete through a
claimable balance; and the Anchor's reported limits have changed and disagreed
between endpoints, so no range is hard-coded. The server response remains
authoritative.

**Used: yes**, then verified against the Anchor's live discovery document,
health response and endpoint behavior before coding.

---

## 3. `kaankacar/stellar-build`

A development workflow / skill installer. **Not** an npm dependency, **not** a
Rust dependency, **not** an on-chain protocol, and **not** an eligible ecosystem
integration by itself.

### Decision: the installer was NOT run

`install.sh` was downloaded and read in full before any decision. Even with
`--prefix=$(pwd)` (project-local), it:

- adds a blanket `permissions.allow: ["Bash", "Read", "Glob", "Grep"]` entry to
  the target `.claude/settings.json`,
- registers six learning-loop hooks (`PostToolUse`, two `UserPromptSubmit`,
  `SessionStart`, `Stop`, `SessionEnd`), one of which (`reprompt.sh`) rewrites
  the user's prompt before the agent sees it,
- writes a `.codex/` tree plus a `.stellar-build/` config, trace and prompt store,
- pings an anonymous install counter at `abacus.jasoncameron.dev`
  (opt out with `STELLAR_BUILD_NO_TELEMETRY=1`),
- re-installs `stellar/stellar-dev-skill`, which is already present here as a
  Claude Code plugin.

None of that is wanted for a short hackathon build, so the installer was skipped
entirely.

### What was taken instead

Four skill folders were copied by hand out of the inspected `bundle.tar.gz` into
`.claude/skills/`:

| Upstream path in `bundle.tar.gz` | Local folder | Used for |
|---|---|---|
| `skills/methodology/create-architecture/` | `.claude/skills/create-architecture/` | Architecture decision workflow. |
| `skills/methodology/code-review/` | `.claude/skills/adversarial-code-review/` | Adversarial review layers + triage. Renamed to avoid colliding with the built-in `code-review` skill; the `name:` field was updated to match. |
| `skills/methodology/review-edge-case-hunter/` | `.claude/skills/review-edge-case-hunter/` | Exhaustive edge-case pass over contract logic and diffs. |
| `skills/stellar/stellar-competitive-landscape/` | `.claude/skills/stellar-competitive-landscape/` | Research only. Never runtime. |

The copies were checked for network calls, telemetry and hook registration. The
only external reference is `stellar-competitive-landscape` falling back to a
public LumenLoop dataset on GitHub when its local data file is absent.

`github.com/kaankacar/stellar-build` publishes **no license**, so these folders
are git-ignored (`/.claude/skills/` in `.gitignore`) and are not redistributed
with this repository. Reproduce them by copying the four folders listed above out
of `bundle.tar.gz`.

---

## 4. Raven MCP

`https://raven.stellar.buzz/mcp` — hosted MCP server for live Stellar
documentation and ecosystem queries. Used during development to check current
docs and version facts before asserting them.

**The demo and the deployed application must not depend on it.**

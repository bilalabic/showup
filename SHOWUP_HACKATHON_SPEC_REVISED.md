# ShowUp — Hackathon Product & Technical Specification

> **Project type:** Programmable attendance commitment bonds for events and reservations  
> **Target event:** Rise In × Stellar Pro Hackathon Türkiye 2026  
> **Track:** Genesis  
> **Network:** Stellar Testnet  
> **Verification date:** September 19, 2026  
> **Submission deadline:** Day 2, 12:00 local Istanbul time (internal target: 11:30)  
> **MVP goal:** A participant uses the hackathon Mock Anchor to simulate TRY → Mock USDC funding, locks the Mock USDC attendance bond in a Soroban smart contract, and receives deterministic on-chain settlement according to attendance/cancellation/no-show rules.

> **Claim boundary:** The hackathon Mock Anchor is a Testnet simulation. The MVP does **not** process real TRY, real bank transfers, real KYC, or production USDC. The Anchor/banking stage is asynchronous; only the Soroban transaction and its internal on-chain effects can be described as atomic.

---

## 1. Executive Summary

**ShowUp** is a programmable commitment-bond layer for limited-capacity events and reservations.

The core problem is simple: people reserve scarce slots and do not show up. This wastes seats, organizer capacity, food, venue resources, and other participants' opportunities.

ShowUp introduces a small **refundable attendance bond**:

1. The participant sees a bond amount in TRY.
2. They use the hackathon Mock Anchor to simulate **TRY → Mock USDC** funding.
3. Mock Mock USDC is locked in a **Soroban smart contract**.
4. If the participant attends, the bond is fully refunded.
5. If the participant cancels within the allowed window, the bond is refunded according to the event policy.
6. If the participant does not attend, the smart contract applies the predefined no-show settlement rule.
7. Refunded Mock USDC may optionally be sent through the Mock Anchor's USDC → TRY withdrawal simulation as a non-blocking extension.

The product is intentionally **not** a full ticketing platform, restaurant marketplace, CRM, payment processor, or loyalty product. The MVP is a small and complete protocol-backed workflow that can be demonstrated end-to-end during the hackathon.

---

# 2. Product Definition

## 2.1 One-sentence pitch

> **ShowUp lets organizers require a small refundable attendance bond that is automatically returned when a participant shows up and automatically settled according to predefined rules when they do not.**

## 2.2 Short pitch

A participant reserves a scarce spot by locking a small USDC bond. The participant can fund that bond with TRY through the Stellar Anchor. The bond stays in a non-custodial Soroban contract. Attendance, timely cancellation, event cancellation, and no-show outcomes produce deterministic settlement.

## 2.3 Core product principle

The organizer must **never hold participant bond funds directly before settlement**.

Funds are controlled by deterministic smart-contract rules rather than by organizer discretion.

---

# 3. Primary MVP Use Case

The hackathon demo should use **workshops / community events** as the primary use case.

Example:

```text
Event: AI Builders Meetup Istanbul
Capacity: 20
Attendance bond: 200 TRY
Free cancellation deadline: 24 hours before event
Check-in window: 13:30–14:30
No-show settlement:
  80% → Organizer
  20% → Community Pool
```

Why events instead of restaurants for the MVP:

- Easier to demonstrate without third-party integrations.
- QR check-in is natural.
- No dependency on reservation/POS systems.
- A hackathon audience immediately understands the problem.
- The same protocol can later be extended to restaurants, sports facilities, appointments, coworking, classes, and equipment reservations.

---

# 4. Hackathon Framework & Requirement Fit

## 4.1 Confirmed competition frame

The implementation plan must follow the competition mechanics, not only the public "36-hour" label.

| Topic | ShowUp decision |
|---|---|
| Track | **Genesis** — net-new product built from scratch, working prototype, real Stellar integration, Testnet deployment. |
| Team size | Up to **4 people** for Genesis. |
| Submission deadline | **12:00 on Day 2**. Treat the effective build-to-submit window from the Day 1 opening as roughly **26 hours** and preserve a 30-minute submission buffer. |
| Shortlisting | Every team submits; only shortlisted teams present live to the jury. |
| Ecosystem integration | At least one eligible Stellar protocol/ecosystem building block must be integrated into the core product. |
| Anchor/local payments | Demonstrate a working local-payment flow: TRY into a usable Stellar balance **or** the reverse. ShowUp chooses TRY → Mock USDC deposit as the required primary path. |
| Soroban | Smart-contract logic uses the Soroban Rust SDK and is deployed to Stellar Testnet. |
| Submission package | Public GitHub repository, complete README, Testnet contract ID/artifacts, public frontend/demo URL, and pitch deck based on the official presentation template. |
| Skills evidence | README lists the exact Stellar Skill files actually used during development by path. |
| Judging areas | Meaningful idea/impact, technical implementation, ecosystem fit, user experience, traction/continuity, and presentation/documentation. Exact weights are not assumed. |

### Three mandatory product conditions

1. **Integration:** use an eligible Stellar ecosystem building block in the primary product journey.
2. **Anchor / local payments:** show a working TRY ↔ Stellar local-payment path; ShowUp's P0 path is simulated TRY → Mock USDC.
3. **Core feature:** the Anchor and ecosystem integration must be load-bearing parts of the user journey, not decorative demo tabs.

### Opening-briefing confirmations

Do not expand scope while asking these. Record the answers and continue building.

- Confirm that the provided Mock Anchor fully satisfies the local-payment requirement for this hackathon.
- Confirm that Stellar Wallets Kit by itself qualifies as the required ecosystem integration under the event rules.
- Confirm the final submission portal URL and that the 12:00 deadline is Istanbul local time.
- Confirm pitch/Q&A duration and the final official presentation-template link.
- Confirm whether a separate demo video is mandatory or only recommended.

## 4.2 ShowUp requirement mapping

The project must be implemented so that each required element is part of the real product flow—not a separate technical showcase.

| Requirement / expectation | ShowUp implementation | MVP status |
|---|---|---|
| Local-payment flow | Hackathon Mock Anchor | **Required** |
| Simulated TRY → Mock USDC | SEP-6 deposit | **Required P0** |
| Mock USDC → TRY | SEP-6 withdraw simulation | **Optional / P1** |
| Anchor discovery | SEP-1 / `stellar.toml` | **Required P0** |
| Wallet authentication | SEP-10 | **Required P0** |
| KYC behavior | SEP-12 mock approval | **Required as part of Anchor flow** |
| TRY/USDC quote | SEP-38 firm quote / price display | **P0 design choice** |
| Stellar Testnet | Entire MVP | **Required** |
| Stellar ecosystem integration | Stellar Wallets Kit | **Required P0** |
| Core smart-contract logic | Custom Soroban ShowUp contract | **Required P0** |
| Working end-to-end product | Organizer + participant + scanner flows | **Required P0** |
| On-chain settlement | Bond lock/refund/no-show distribution | **Required P0** |
| Public submission evidence | Repo + live URL + Testnet contract ID + Explorer evidence | **Required delivery** |

### Primary ecosystem integration

**Stellar Wallets Kit** is the lowest-risk primary ecosystem integration for the MVP.

Reasons:

- It is currently present on the SCF Integration List.
- Its listed integration estimate is under one day.
- It directly participates in the primary user journey: connect wallet, authorize Anchor authentication, and sign contract/token transactions.
- It avoids adding unrelated DeFi complexity.

The guaranteed P0 wallet path is **Freighter**. Other Wallets Kit providers are optional.

### Optional secondary integration

**Trustless Work** is currently present on the SCF Integration List and can be evaluated only after the custom ShowUp contract and P0 demo are stable. It is **not** required for the ShowUp architecture and is not evidence for the primary innovation.

Do not replace ShowUp's attendance/cancellation/no-show rules with a generic escrow abstraction unless a blocking implementation issue appears.

## 4.3 Accuracy / claim boundaries

Use these statements consistently in the README, UI, demo, and pitch:

| Defensible wording | Do not claim |
|---|---|
| "The MVP uses the Turkey Mock Anchor on Stellar Testnet." | "We process real Turkish lira." |
| "The Mock Anchor simulates a local TRY funding flow." | "A real bank transfer is executed." |
| "Mock KYC is automatically approved." | "Production KYC/AML is implemented." |
| "The Soroban settlement call is atomic for its on-chain effects." | "The Anchor and bank step are atomic with the contract." |
| "Mock USDC is used as the Testnet settlement asset." | "This is production USDC settlement." |
| "ShowUp enforces the published bond policy on-chain." | "ShowUp proves the physical identity of the attendee." |

# 5. Strict Scope Boundaries

## 5.1 P0 — Must Ship

The hackathon submission is not complete unless all P0 items work.

### Organizer

- Connect Stellar wallet.
- Create an event.
- Define:
  - event title,
  - event start time,
  - check-in start,
  - check-in deadline,
  - cancellation deadline,
  - capacity,
  - bond amount,
  - no-show organizer percentage,
  - no-show community-pool percentage.
- View reservations.
- Open organizer scanner.
- Scan participant QR.
- Confirm valid attendance.
- Cancel event.
- Trigger or view no-show settlement.

### Participant

- Connect wallet with Stellar Wallets Kit.
- View event details.
- View bond amount in TRY and estimated USDC.
- Request SEP-38 quote.
- Fund wallet through Mock Anchor TRY → USDC.
- Create USDC trustline if required.
- Reserve event spot by locking USDC bond.
- View reservation status.
- Display one-time/dynamic check-in QR.
- Cancel before deadline.
- Receive attendance refund.
- Receive event-cancellation refund.
- Optionally demonstrate USDC → TRY withdrawal through Mock Anchor.

### Smart contract

- Create event.
- Reserve spot / lock bond.
- Cancel reservation.
- Authorize organizer/verifier check-in.
- Refund attendee.
- Cancel event and make participant funds refundable.
- Settle no-show funds according to event policy.
- Prevent duplicate settlement.
- Emit contract events for major state changes.

### Demo

The final demo must show at least:

1. One successful participant attendance/refund.
2. One no-show settlement.
3. One Anchor deposit.
4. One Wallets Kit connection.
5. On-chain transaction references.

---

## 5.2 P1 — Ship Only After P0 Is Stable

- Event list/search page.
- Organizer dashboard analytics.
- Multiple organizers/verifiers per event.
- Grace period UI.
- Participant cancellation tiers instead of one binary cancellation deadline.
- One-click `Add funds` UX from insufficient-balance state.
- Explorer links for all transactions.
- Simple event QR/link sharing.
- Better mobile scanner experience.
- Minimal admin/community-pool dashboard.

---

## 5.3 P2 — Stretch Goals

Do not work on these until the full P0 demo is reliable.

- Privy embedded wallet / social login.
- Passkey smart wallets.
- Trustless Work integration.
- Reputation / ShowUp Score.
- Dynamic bond pricing based on attendance history.
- Restaurant mode.
- Sports reservation mode.
- Coworking mode.
- Waitlist marketplace.
- Calendar integration.
- NFT/ticket issuance.
- Cross-chain deposits.
- Yield on locked bonds.
- AI recommendations.
- SMS / email reminders.

---

## 5.4 Explicitly Out of Scope for the Hackathon

These must **not** be implemented in the MVP:

- Full ticket marketplace.
- Restaurant POS integration.
- Fiat card payments.
- Mainnet deployment.
- Real KYC data collection.
- Real banking integrations.
- Arbitrary dispute-resolution marketplace.
- DAO governance.
- Token launch.
- Custom stablecoin.
- DeFindex yield strategies.
- Blend lending.
- Soroswap trading.
- CCTP / cross-chain bridging.
- Native mobile applications.
- Complex identity verification.
- Facial recognition / geofencing.
- Attendance proof based only on participant self-scan.
- Custodial handling of user private keys.

The team should reject scope additions that do not improve the 2–3 minute demo or satisfy a hackathon requirement.

---

# 6. Product Roles

## 6.1 Participant

Can:

- connect wallet,
- fund account,
- reserve,
- cancel,
- display check-in pass,
- receive refund,
- withdraw USDC to TRY.

Cannot:

- self-confirm attendance,
- change event rules,
- trigger organizer settlement before deadlines.

## 6.2 Organizer

Can:

- create event,
- define immutable/limited policy parameters,
- scan check-ins,
- view reservations,
- cancel event,
- trigger settlement after deadline if the contract requires an explicit call.

Cannot:

- arbitrarily take a participant's locked bond,
- mark attendance for an event they do not control,
- change the no-show distribution after reservations are funded.

## 6.3 Community Pool

A fixed Stellar address receiving an optional portion of no-show settlement.

For the MVP it can be a team-controlled Testnet public address.

No DAO is required.

## 6.4 Verifier

For MVP, the organizer wallet is also the authorized attendance verifier.

Future versions can separate:

```text
organizer != verifier
```

This is not required in P0.

---

# 7. End-to-End User Flow

## 7.1 Event Creation

```text
Organizer
   ↓
Connect Wallet
   ↓
Create Event
   ↓
Define policy
   ↓
Sign Soroban transaction
   ↓
Event created on Stellar Testnet
```

Minimum policy parameters:

```text
bond_amount_usdc
capacity
start_time
checkin_start
checkin_deadline
cancellation_deadline
organizer_bps
community_bps
```

Constraint:

```text
organizer_bps + community_bps = 10_000
```

---

## 7.2 Participant Funding

```text
Participant
   ↓
Connect Stellar wallet
   ↓
Request TRY/USDC quote (SEP-38)
   ↓
Start deposit (SEP-6)
   ↓
Mock bank transfer simulation
   ↓
USDC arrives in participant wallet
```

The UI must make the fiat flow visible enough for judges to understand it.

Recommended UI:

```text
Attendance Bond
200.00 TRY
≈ 4.32 USDC

[ Add funds with TRY ]
```

Do not label the Anchor as a developer-only feature.

It is part of the product onboarding.

---

## 7.3 Reservation / Bond Lock

```text
Participant Wallet
        │
        │ USDC
        ▼
ShowUp Soroban Contract
        │
        └── Reservation = LOCKED
```

The contract checks:

- event is active,
- current time is before reservation cutoff / event,
- capacity is not exceeded,
- participant has no active duplicate reservation,
- bond amount equals event bond amount,
- participant authorized the transfer.

---

## 7.4 Attendance Check-in

### Required model

Participant **shows a QR code**. Organizer scans it.

The participant does not self-check-in.

```text
Participant phone
   ↓ Show QR
Organizer scanner
   ↓
Verify reservation + nonce
   ↓
Organizer signs check-in tx
   ↓
Soroban checks organizer authorization
   ↓
Reservation → ATTENDED
   ↓
Bond refunded
```

### QR payload

Do not put secrets in the QR.

Recommended payload:

```json
{
  "v": 1,
  "eventId": "...",
  "reservationId": "...",
  "participant": "G...",
  "nonce": "...",
  "expiresAt": 0
}
```

For P0, the backend may issue a short-lived nonce associated with the reservation.

The QR itself is not sufficient proof. The organizer wallet must still authorize the on-chain `check_in` transaction.

### Replay protection

A reservation can only transition to `ATTENDED` once.

The contract rejects a second check-in.

---

## 7.5 Participant Cancellation

P0 policy is intentionally simple:

```text
now <= cancellation_deadline
    → full refund

now > cancellation_deadline
    → participant cannot self-cancel for refund
```

Do **not** implement multi-tier refund percentages in P0.

They can be P1.

---

## 7.6 Organizer Cancels Event

```text
Organizer
  ↓
cancel_event()
  ↓
Event status = CANCELLED
```

All unsettled reservations become fully refundable.

For scalability, avoid looping through all participant addresses in one transaction.

Preferred pattern:

```text
Event = CANCELLED
Participant calls claim_refund()
```

This keeps execution predictable and avoids unbounded iteration.

---

## 7.7 No-show Settlement

After `checkin_deadline`:

```text
reservation = LOCKED
checked_in = false
cancelled = false
current_time > checkin_deadline
```

then:

```text
settle_no_show(event_id, participant)
```

calculates:

```text
organizer_amount = bond * organizer_bps / 10_000
community_amount = bond - organizer_amount
```

and transfers funds.

The settlement must be idempotent: the same reservation cannot be settled twice.

---

# 8. Recommended System Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                        WEB APP                              │
│             Next.js + TypeScript + React                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Participant UI       Organizer UI       QR Scanner          │
│      │                    │                 │               │
│      └────────────┬───────┴─────────────────┘               │
│                   │                                         │
│       Stellar Wallets Kit                                   │
└───────────────────┼─────────────────────────────────────────┘
                    │
        ┌───────────┴──────────────┐
        │                          │
        ▼                          ▼
┌─────────────────┐       ┌────────────────────┐
│ Hackathon Mock  │       │ Stellar Testnet    │
│ Anchor          │       │                    │
│                 │       │ ShowUp Contract    │
│ SEP-1           │       │      +             │
│ SEP-10          │       │ USDC Asset         │
│ SEP-12          │       │ Contract           │
│ SEP-38          │       │                    │
│ SEP-6           │       └──────────┬─────────┘
└─────────────────┘                  │
                                     │ events / state
                                     ▼
                           ┌────────────────────┐
                           │ Supabase / DB      │
                           │ off-chain metadata │
                           │ QR nonce / cache   │
                           └────────────────────┘
```

### Important architectural rule

**Financial truth lives on-chain.**

The database is not allowed to be the source of truth for:

- whether a bond is locked,
- whether it has been refunded,
- whether it has been settled,
- how much USDC belongs to whom.

The database may store:

- event descriptions,
- images,
- venue text,
- human-readable slug,
- QR nonce metadata,
- cached contract state,
- analytics.

---

# 9. Technology Stack

## 9.1 Runtime & Package Manager

### Project choice

- **Node.js ≥ 20**
- **Node.js 24 recommended** if all selected dependencies pass the smoke test
- **pnpm** as the package manager

Node 24 is a project preference, **not a hackathon requirement**. The organizer documentation repository currently uses `.nvmrc = 24`, but ShowUp should prioritize dependency compatibility and a reproducible lockfile over copying that repository's runtime blindly.

---

## 9.2 Frontend

### Framework

- **Next.js** — App Router
- **React**
- **TypeScript**

Why:

- one repository,
- frontend + API routes together,
- fast Vercel deployment,
- strong TypeScript ecosystem,
- good hackathon iteration speed.

### UI

- **Tailwind CSS**
- **shadcn/ui**
- **Lucide React** icons

Do not build a custom component system during the hackathon.

### Forms & Validation

- **React Hook Form**
- **Zod**

Use the same Zod schema on client and server when practical.

### State

Default:

- React state,
- server components / server actions where appropriate,
- small Context for wallet/session state.

Do **not** add Redux unless a concrete need appears.

### Data fetching

Use:

- native `fetch`, and/or
- **TanStack Query** only if wallet/transaction polling becomes difficult to manage manually.

TanStack Query is P1, not mandatory.

---

# 10. Stellar Stack

## 10.1 JavaScript SDK

Use:

```text
@stellar/stellar-sdk
```

The official JS SDK supports classic Stellar transactions, RPC interaction, Horizon access, transaction building, and Soroban contract interaction.

Pin a current stable `@stellar/stellar-sdk` version **after a Testnet smoke test** and commit the exact version in the lockfile. Do not hard-code a speculative major-version range in the project specification.

Do not mix obsolete standalone Soroban JavaScript packages with the current `@stellar/stellar-sdk` approach.

---

## 10.2 Wallet Integration

Use:

```text
@creit.tech/stellar-wallets-kit
```

Initial supported wallet for actual testing:

- **Freighter**

The UI may expose additional Wallets Kit providers, but the team only needs to guarantee the Freighter path for P0.

Network:

```text
TESTNET
```

---

## 10.3 Smart Contract

Language:

- **Rust**

SDK:

```text
soroban-sdk
```

Tooling:

```text
stellar CLI
```

Target the currently supported Stellar Testnet protocol/tooling versions and keep `stellar` CLI, `soroban-sdk`, and generated bindings mutually compatible.

Before the final deploy, query the live Testnet RPC `getVersionInfo` and run a clean build/deploy/invoke smoke test. Treat protocol/version numbers as live environment facts rather than frozen assumptions in this document.

---

# 11. Mock Anchor Integration

## 11.1 Configuration

```text
Home Domain:
tr-mock-anchor.fly.dev

Network:
Stellar Testnet

Asset:
USDC

USDC Issuer:
GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
```

Hackathon Mock Anchor **simulation** limits currently documented:

```text
Deposit: 50 TRY – 3,000 TRY
Withdraw: minimum 1 USDC
TRY precision: 2 decimals
USDC precision: 7 decimals
```

The ShowUp demo bond must stay comfortably within these limits.

Recommended demo bond:

```text
100–250 TRY equivalent
```

---

## 11.2 Required SEP Flow

### SEP-1

Read:

```text
https://tr-mock-anchor.fly.dev/.well-known/stellar.toml
```

Do not hard-code every endpoint if discovery is available.

### SEP-10

Use participant wallet signature to authenticate and obtain JWT.

The app must **never** request or store the user's secret key.

### SEP-12

Mock Anchor automatically approves KYC.

No real PII should be collected for the hackathon.

### SEP-38

Use quote endpoint before deposit to show:

```text
200 TRY ≈ X USDC
```

Store quote ID only as long as needed.

### SEP-6 Deposit

Participant:

```text
TRY → USDC
```

For the mock environment, expose a clearly labeled demo step to invoke `simulate-bank-transfer`.

`simulate-bank-transfer` is **Mock Anchor-specific** and is not a standard SEP endpoint. It must never be presented as a production banking API.

If a firm SEP-38 quote is used, validate `expires_at`; the quote ID may be passed to SEP-6 when supported by the Mock Anchor flow. Do not reuse an expired quote.

### SEP-6 Withdraw

Optional / P1. It is useful for showing the reverse local-payment path, but it must **not** block the P0 submission:

```text
refunded USDC → TRY
```

If implemented, clearly label the TRY payout as a Mock Anchor simulation. Do not sacrifice the working deposit → reserve → attendance/no-show lifecycle to finish withdrawal.

---

# 12. USDC Trustline Handling

A participant may need a USDC trustline before receiving Anchor USDC.

The app should:

1. inspect the connected account,
2. detect whether the ShowUp Testnet USDC asset is trusted,
3. display `Enable USDC`,
4. build a `changeTrust` transaction,
5. request wallet signature,
6. submit to Testnet.

Do not hide an Anchor deposit stuck in `pending_trust`.

Display a clear recovery action.

---

# 13. Soroban Contract Specification

Suggested contract name:

```text
showup_bond
```

## 13.1 Contract responsibilities

The contract is responsible for:

- event policy,
- reservation state,
- capacity enforcement,
- USDC bond custody,
- organizer authorization,
- attendance state,
- cancellation rules,
- event cancellation,
- no-show distribution,
- replay/double-settlement prevention,
- contract events.

The contract is **not** responsible for:

- event images,
- venue maps,
- user profiles,
- messaging,
- QR rendering,
- fiat conversion,
- real-world identity.

---

## 13.2 Proposed Contract API

```rust
initialize(...)

create_event(...)
reserve(...)
cancel_reservation(...)
check_in(...)
cancel_event(...)
claim_cancelled_event_refund(...)
settle_no_show(...)

get_event(...)
get_reservation(...)
```

Optional helper functions:

```rust
is_refundable(...)
is_settleable(...)
```

Do not add methods without a demonstrated product requirement.

---

## 13.3 Event Data Model

Conceptual model:

```rust
Event {
    id: u64,
    organizer: Address,
    verifier: Address,
    usdc_token: Address,
    community_pool: Address,

    bond_amount: i128,
    capacity: u32,
    reserved_count: u32,

    start_time: u64,
    checkin_start: u64,
    checkin_deadline: u64,
    cancellation_deadline: u64,

    organizer_bps: u32,
    community_bps: u32,

    status: EventStatus,
}
```

Event title and rich content remain off-chain.

If an integrity link is desired, store an optional metadata hash.

---

## 13.4 Reservation Data Model

```rust
Reservation {
    participant: Address,
    event_id: u64,
    amount: i128,
    reserved_at: u64,
    status: ReservationStatus,
}
```

Suggested enum:

```rust
ReservationStatus {
    Locked,
    Attended,
    Cancelled,
    Refunded,
    NoShowSettled,
}
```

Avoid multiple booleans when a state enum prevents impossible combinations.

---

## 13.5 Event State

```rust
EventStatus {
    Active,
    Cancelled,
    Closed,
}
```

---

# 14. State Machine

```text
                    reserve()
                       │
                       ▼
                   ┌────────┐
                   │ LOCKED │
                   └───┬────┘
                       │
         ┌─────────────┼───────────────┐
         │             │               │
     check_in()   cancel_before()   timeout
         │             │               │
         ▼             ▼               ▼
    ┌─────────┐   ┌───────────┐   ┌────────────┐
    │ATTENDED │   │ CANCELLED │   │  NO-SHOW   │
    └────┬────┘   └─────┬─────┘   └─────┬──────┘
         │              │               │
         ▼              ▼               ▼
      REFUND          REFUND        DISTRIBUTE
```

Event cancellation overrides unsettled reservations:

```text
ACTIVE EVENT
    ↓ cancel_event()
CANCELLED EVENT
    ↓ participant claim
100% REFUND
```

---

# 15. Authorization Rules

## `create_event`

Requires organizer authentication.

## `reserve`

Requires participant authentication.

USDC transfer must originate from the participant.

## `check_in`

Requires the event's authorized verifier address.

For P0:

```text
verifier = organizer
```

## `cancel_event`

Requires organizer authentication.

## `cancel_reservation`

Requires participant authentication.

## `settle_no_show`

Can be permissionless after the deadline **if** all settlement conditions are deterministic.

This is preferable to making settlement dependent on organizer goodwill.

---

# 16. Contract Time Rules

Use ledger/network timestamp rather than browser clock as financial truth.

Important checks:

```text
reserve:
now < checkin_deadline

participant cancellation:
now <= cancellation_deadline

check-in:
checkin_start <= now <= checkin_deadline

no-show settlement:
now > checkin_deadline
```

Never trust a timestamp supplied by the frontend.

---

# 17. Token Transfers

Use the Stellar Asset Contract representation of the selected Testnet USDC.

Conceptual flow:

```text
reserve()
participant → contract

check_in()
contract → participant

cancel_reservation()
contract → participant

settle_no_show()
contract → organizer
contract → community_pool
```

All arithmetic must use integer token units.

Never use floating-point arithmetic for USDC balances.

---

# 18. Basis Points

Use basis points for distributions.

```text
10,000 bps = 100%
8,000 bps = 80%
2,000 bps = 20%
```

Contract validation:

```text
organizer_bps + community_bps == 10_000
```

Do not accept arbitrary percentage strings.

---

# 19. Storage & TTL

Soroban contract state is subject to state archival / TTL behavior. TTL is an operational lifetime mechanism, **not** a trustworthy business-expiration mechanism.

Recommended ShowUp layout:

- **Instance storage:** small contract-wide configuration that is needed whenever the contract is invoked.
- **Persistent storage:** event and reservation financial state that must remain recoverable and auditable.
- **Temporary storage:** only for truly disposable data whose permanent deletion is acceptable; do not store money-critical reservation state here.

Important rules:

- Enforce cancellation/check-in/no-show deadlines with explicit on-chain timestamps and status checks.
- Never rely on "TTL expired" to mean "event expired" or "nonce is invalid"; third parties can extend ledger-entry TTL.
- Extend/restore the contract instance, code, and required persistent entries when necessary.
- Keep event/reservation entries granular enough to avoid oversized reads/writes.
- Include TTL/state-archival handling in the README and at least one contract/runtime smoke test.

The hackathon is short, but ignoring TTL can still make the implementation technically incomplete.

# 20. Contract Events

Emit events for important transitions.

Recommended:

```text
EventCreated
BondLocked
ReservationCancelled
CheckedIn
BondRefunded
EventCancelled
NoShowSettled
```

Frontend can use these to build a clear transaction/activity view.

---

# 21. Off-chain Backend

## Recommended architecture

Use **Next.js Route Handlers** instead of a separate NestJS/Express service.

This keeps the hackathon stack small.

### Backend responsibilities

- Anchor server-side helpers where appropriate.
- SEP transaction status polling proxy if needed.
- Event metadata CRUD.
- QR nonce generation.
- QR nonce validation.
- Contract state indexing/cache.
- Demo utilities guarded by environment flag.

### Backend must never

- store participant wallet secret keys,
- sign participant financial transactions,
- determine final financial state independently of the contract,
- override contract settlement.

---

# 22. Database

Use:

## **Supabase PostgreSQL**

Reasons:

- fast setup,
- hosted,
- simple dashboard,
- easy Vercel use,
- enough for hackathon metadata.

### Tables

#### `events`

```text
id
contract_event_id
organizer_address
slug
title
description
venue
image_url
created_at
```

#### `reservations_cache`

Optional cache only:

```text
id
event_id
participant_address
contract_status
updated_at
```

Financial state remains on-chain.

#### `checkin_nonces`

```text
id
reservation_key
nonce_hash
expires_at
used_at
created_at
```

### Security

If using Supabase client access, enable RLS.

For the fastest P0 implementation, all writes can go through authenticated server routes using a server-side service key.

Never expose the Supabase service-role key to the browser.

---

# 23. QR Check-in Design

## Library

Recommended:

```text
@zxing/browser
```

Use it only for camera scanning and QR parsing.

## Security model

QR proves **which reservation is being presented**.

Organizer wallet authorization proves **who is allowed to confirm attendance**.

These are separate concepts.

### P0 QR rules

- nonce expires quickly, e.g. 60–120 seconds,
- nonce may only be used once,
- nonce bound to event + participant/reservation,
- organizer signs the actual contract transaction,
- already-attended reservation cannot be processed again.

### What we are not solving in P0

A participant could physically share their phone/pass with someone else.

Strong identity matching is out of scope.

The project's claim is **reservation attendance confirmation**, not biometric identity proof.

---

# 24. Frontend Pages

## Public

### `/`

- product explanation,
- demo event CTA,
- wallet connect.

### `/events`

P1 if time allows.

### `/events/[slug]`

Must show:

- title,
- time,
- venue,
- available capacity,
- bond in TRY,
- current USDC estimate,
- cancellation deadline,
- no-show rule,
- reserve button.

---

## Participant

### `/my-reservations`

Cards:

```text
Upcoming
Attended
Cancelled
No-show
```

### `/reservation/[id]`

Show:

- bond state,
- QR pass,
- cancellation eligibility,
- transaction links.

### `/wallet`

Small balance/funding page:

- XLM balance,
- USDC balance,
- trustline status,
- Add TRY / Anchor deposit,
- Withdraw TRY.

Do not build a general-purpose crypto wallet.

---

## Organizer

### `/organizer`

List organizer events.

### `/organizer/events/new`

Create event.

### `/organizer/events/[id]`

Show:

- capacity,
- reservations,
- attended,
- no-shows,
- locked bond total,
- settlement status.

### `/organizer/events/[id]/scan`

Full-screen mobile-friendly scanner.

This page is critical to the live demo.

---

# 25. Suggested API Routes

Keep APIs minimal.

```text
GET  /api/events/[slug]
POST /api/events/metadata

POST /api/checkin/nonce
POST /api/checkin/verify

GET  /api/anchor/config
POST /api/anchor/deposit/simulate      # demo/testnet only
GET  /api/anchor/transaction/[id]
```

Contract calls should generally be built client-side and signed by the relevant wallet.

---

# 26. Wallet & Signing Rules

## Participant transactions

Signed by participant wallet:

- USDC trustline,
- reserve,
- cancel reservation,
- Anchor-auth challenge signing,
- USDC withdraw transfer.

## Organizer transactions

Signed by organizer wallet:

- create event,
- check-in,
- cancel event.

No backend-owned hot wallet should impersonate these roles.

Community Pool may be a fixed public address.

---

# 27. Environment Variables

Example `.env.example`:

```bash
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_STELLAR_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org

NEXT_PUBLIC_SHOWUP_CONTRACT_ID=C...
NEXT_PUBLIC_USDC_ISSUER=GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
NEXT_PUBLIC_ANCHOR_HOME_DOMAIN=tr-mock-anchor.fly.dev

NEXT_PUBLIC_COMMUNITY_POOL_ADDRESS=G...

NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

CHECKIN_NONCE_SECRET=...
ENABLE_DEMO_TOOLS=true
```

Never commit real secrets.

`ENABLE_DEMO_TOOLS` must be `false` outside the hackathon Testnet demo.

---

# 28. Suggested Repository Structure

```text
showup/
├─ apps/
│  └─ web/
│     ├─ app/
│     │  ├─ page.tsx
│     │  ├─ events/[slug]/page.tsx
│     │  ├─ my-reservations/page.tsx
│     │  ├─ reservation/[id]/page.tsx
│     │  ├─ wallet/page.tsx
│     │  ├─ organizer/
│     │  │  ├─ page.tsx
│     │  │  ├─ events/new/page.tsx
│     │  │  └─ events/[id]/
│     │  │     ├─ page.tsx
│     │  │     └─ scan/page.tsx
│     │  └─ api/
│     │     ├─ anchor/
│     │     └─ checkin/
│     ├─ components/
│     ├─ lib/
│     │  ├─ stellar/
│     │  ├─ anchor/
│     │  ├─ contracts/
│     │  ├─ wallet/
│     │  ├─ qr/
│     │  └─ supabase/
│     └─ public/
│
├─ contracts/
│  └─ showup-bond/
│     ├─ Cargo.toml
│     └─ src/
│        ├─ lib.rs
│        ├─ types.rs
│        ├─ storage.rs
│        ├─ events.rs
│        └─ test.rs
│
├─ scripts/
│  ├─ deploy-testnet.sh
│  ├─ seed-demo.ts
│  └─ smoke-test.ts
│
├─ docs/
│  ├─ architecture.md
│  ├─ demo-script.md
│  └─ contract.md
│
├─ .env.example
├─ README.md
└─ package.json
```

A monorepo is optional. If it slows the team down, use a normal Next.js root plus `/contracts` directory.

Do not spend hackathon time perfecting workspace tooling.

---

# 28.1 Stellar Skills & Development Workflow

The hackathon README should list the **exact Skill files actually used**, not merely every Skill installed on the machine.

## Official `stellar/stellar-dev-skill` modules recommended for ShowUp

| Skill path | ShowUp use |
|---|---|
| `skills/standards/SKILL.md` | Validate SEP-1/6/10/12/38 roles, Anchor flow, and standards terminology. |
| `skills/smart-contracts/SKILL.md` | Soroban authorization, storage, TTL/state archival, contract tests, and security patterns. |
| `skills/assets/SKILL.md` | Mock USDC issuer, trustlines, Stellar Asset Contract interaction, and token precision. |
| `skills/dapp/SKILL.md` | Wallets Kit/Freighter connection, transaction signing, and contract invocation patterns. |
| `skills/data/SKILL.md` | RPC/Horizon queries, contract state/event reads, transaction evidence, and Explorer verification. |

Only add `skills/agentic-payments/SKILL.md`, `skills/cross-chain/SKILL.md`, or `skills/zk-proofs/SKILL.md` if ShowUp actually adopts those features later. They are **not** part of the P0 architecture.

## Useful `stellar-build` workflow skills

`kaankacar/stellar-build` is a **development workflow / Skill installer**, not an npm dependency, Rust dependency, on-chain protocol, or eligible product integration by itself.

Useful optional workflow files:

- `skills/methodology/create-architecture/SKILL.md`
- `skills/methodology/code-review/SKILL.md`
- `skills/methodology/review-edge-case-hunter/SKILL.md`
- `skills/stellar/stellar-competitive-landscape/SKILL.md` — research only, not runtime

For a hackathon project, prefer a project-local install so it does not mutate the developer's global environment unnecessarily:

```bash
curl -fsSL https://raw.githubusercontent.com/kaankacar/stellar-build/main/install.sh \
  | bash -s -- --prefix=$(pwd)
```

Review the installer before running it. It writes Claude/Codex Skill files and can configure hooks/tooling under the selected prefix.

## Raven MCP

`stellar-build` can connect the **Raven MCP** for live Stellar documentation/ecosystem queries. Raven is a developer-assistance tool, not part of the ShowUp runtime architecture and not evidence of the required ecosystem integration.

Use it for:

- checking current Stellar docs before asserting technical facts,
- validating network/tooling changes,
- ecosystem discovery and competitive research.

Do not make the production/demo app depend on an AI MCP server.

---

# 29. Testing Strategy

## 29.1 Contract Unit Tests — Required

At minimum:

### Event creation

- valid event succeeds,
- invalid bps rejected,
- invalid deadlines rejected,
- zero/negative bond rejected,
- zero capacity rejected.

### Reservation

- valid reserve succeeds,
- duplicate reservation rejected,
- full event rejected,
- wrong bond amount rejected,
- reservation after cutoff rejected.

### Cancellation

- before deadline succeeds,
- after deadline fails,
- duplicate refund fails.

### Check-in

- authorized verifier succeeds,
- unauthorized wallet fails,
- before check-in start fails,
- after check-in deadline fails,
- double check-in fails,
- refund amount correct.

### Event cancellation

- only organizer can cancel,
- participant can claim full refund,
- duplicate claim fails.

### No-show

- cannot settle before deadline,
- attended reservation cannot be no-show settled,
- settled reservation cannot settle twice,
- basis-point split is correct.

---

## 29.2 Web Tests

Recommended P0 smoke tests:

- wallet connection,
- Anchor configuration retrieval,
- quote request,
- event loading,
- QR generation,
- QR decoding.

Use **Vitest** for unit-level TypeScript tests if needed.

---

## 29.3 E2E

If P0 is stable, use **Playwright** for one golden path:

```text
create event
→ participant reservation
→ organizer check-in
→ refund visible
```

Do not block submission on extensive browser test coverage.

---

# 30. Security Requirements

## Critical

- Never collect wallet seed phrases.
- Never store secret keys in frontend code.
- Never commit secret keys to Git.
- Never use JavaScript floating point for token accounting.
- Never let the frontend determine final settlement eligibility.
- Never trust browser timestamps for contract deadlines.
- Never allow organizer to bypass contract settlement rules.
- Never store sensitive data on-chain unnecessarily.
- Never make QR alone sufficient to release money.

## Smart-contract safety

- authorization on every privileged call,
- deterministic state transitions,
- no double settlement,
- checked token amounts,
- basis-point validation,
- capacity validation,
- timestamp validation,
- no unbounded participant loop,
- storage TTL consideration,
- explicit contract events.

---

# 31. Privacy Boundaries

Public/on-chain data should be minimized.

On-chain:

- wallet addresses,
- event identifier,
- bond amount,
- reservation financial state,
- timestamps/policy,
- settlement transactions.

Off-chain:

- human-readable participant display name if used,
- venue details,
- event image,
- descriptive metadata.

The MVP should not claim confidential payments or private attendance history.

---

# 32. UX Principles

## Hide unnecessary Web3 terminology

Prefer:

```text
Reserve your spot
Refundable bond
Add funds
Your bond is protected
Attendance verified
Refund received
```

Avoid making the main UI say:

```text
invoke contract
Soroban RPC
SAC
XDR
SEP-6
```

Technical details can be displayed under an expandable developer/debug panel for the judges.

## Always display policy before signature

Before participant locks funds:

```text
Refundable bond: 200 TRY (~4.32 USDC)
Free cancellation until: 19 Sep, 14:00
Check-in window: 20 Sep, 13:30–14:30
If you do not attend:
80% organizer / 20% community pool
```

The participant must not discover the no-show rule after funding.

---

# 33. Error States That Must Be Designed

- Wallet disconnected.
- Wrong Stellar network.
- No USDC trustline.
- Insufficient XLM for fees/reserves.
- Insufficient USDC.
- Anchor authentication expired.
- Anchor deposit waiting for bank simulation.
- Anchor deposit waiting for trustline.
- Event full.
- Reservation already exists.
- Cancellation deadline passed.
- QR expired.
- QR already used.
- Unauthorized organizer/verifier.
- Check-in window not open.
- Check-in window closed.
- Transaction rejected by wallet.
- RPC/network timeout.

Do not allow raw RPC errors to be the only user feedback.

---

# 34. Demo Mode

The live demo must not require waiting hours for deadlines.

Seed a demo event with compressed time windows, for example:

```text
Event starts: now + 5 minutes
Check-in starts: now - 1 minute
Check-in deadline: now + 2 minutes
Cancellation deadline: now - 1 minute
```

Or deploy a separate demo event immediately before presentation.

Do **not** add an insecure contract `force_no_show()` function just for demo purposes.

Demo convenience belongs in deployment scripts/event configuration, not in unsafe production logic.

---

# 35. Final Demo Script

Target for the **live product-demo segment:** **2–3 minutes**. The final pitch/Q&A duration is not treated as confirmed until the organizers announce it. Prepare a **4-minute primary presentation** with adaptable **2-minute** and **5-minute** versions. Only shortlisted teams present live.

## Scene 1 — Problem

> "Free and limited-capacity events lose seats because registration has no commitment. ShowUp adds a small refundable commitment bond without giving organizers custody of participant funds."

## Scene 2 — Organizer creates event

Create:

```text
AI Builders Meetup
20 seats
200 TRY bond
80/20 no-show rule
```

Show contract transaction.

## Scene 3 — Participant has no USDC

Show:

```text
Bond: 200 TRY
Estimated: X USDC
```

Click:

```text
Add funds with TRY
```

Run Anchor flow.

Show USDC arriving.

## Scene 4 — Participant reserves

Click:

```text
Reserve Spot
```

Show:

```text
Bond locked on Stellar ✓
```

## Scene 5 — Participant attends

Participant opens QR.

Organizer scans.

Organizer signs.

Show:

```text
Attendance verified ✓
Bond refunded ✓
```

Show transaction/explorer link.

## Scene 6 — No-show

Use a second seeded reservation whose deadline has passed.

Trigger permissionless settlement.

Show:

```text
80% → Organizer
20% → Community Pool
```

## Scene 7 — Close

> "The same primitive can power workshops, restaurant reservations, sports courts, coworking, appointments and any scarce booking where commitment matters."

---

# 36. Submission-Driven Implementation Plan (~26 Hours)

The public event is described as a 36-hour hackathon, but the submission deadline is **12:00 on Day 2**. From the Day 1 opening session, the practical build-to-submit window is roughly **26 hours**. Plan to submit by **11:30** and preserve a 30-minute buffer.

If development starts later than the opening session, compress this schedule proportionally; do not move the submission target.

| Hour | Deliverable | Scope gate |
|---:|---|---|
| 0–1 | Confirm briefing questions, choose Genesis, create public repo, prepare organizer/participant Testnet wallets | Confirm Mock Anchor + Wallets Kit eligibility; freeze P0. |
| 1–6 | ShowUp Soroban state model, bond custody, refund/no-show settlement, negative tests | Happy path + double-settlement + auth tests pass locally. |
| 6–10 | SEP-1/10/12/38/6 Mock Anchor deposit flow + trustline recovery | Mock USDC is visible in participant Testnet wallet. |
| 10–14 | Wallets Kit/Freighter + event creation + reserve/refund UI | Organizer and participant complete a contract lifecycle without QR. |
| 14–18 | QR nonce/scanner + organizer-authorized check-in | Two-device/two-browser attendance refund works end-to-end. |
| 18–21 | No-show path, event cancellation/refund, TTL/error states, Testnet deployment | Second clean rehearsal passes; Explorer evidence recorded. |
| 21–23 | Public Vercel deploy, README, architecture, exact Skill paths, setup commands, known limitations | Fresh clone/setup can be followed by another teammate. |
| 23–24.5 | Official pitch-template copy, 2/4/5-minute rehearsal, screenshots/backup video | Live demo and backup proof are ready. |
| 24.5–25.5 | Critical fixes only, code freeze, release/tag, portal submission | Submit by 11:30. |

### Hard stop rule

After Hour 21, do not add a new product feature. Only fix blockers, documentation, submission evidence, or demo reliability.

# 37. Development Priority Order

If time becomes limited, follow this order exactly:

```text
1. Soroban contract
2. Wallet connection
3. Reserve + refund
4. Anchor deposit
5. Organizer QR check-in
6. No-show settlement
7. Anchor withdraw
8. UI polish
9. P1 features
10. Stretch features
```

A polished landing page with a broken settlement flow is a failed hackathon MVP.

---

# 38. Definition of Done

The MVP is **done** when the team can perform the following from a clean browser session:

1. Organizer connects a Testnet wallet.
2. Organizer creates a ShowUp event.
3. Participant connects a different Testnet wallet.
4. App detects/creates the correct USDC trustline.
5. Participant obtains a TRY/USDC quote.
6. Participant performs Mock Anchor TRY → USDC funding.
7. Participant locks the exact bond in the contract.
8. Organizer sees the reservation.
9. Participant opens a QR pass.
10. Organizer scans and signs check-in.
11. Contract refunds the bond exactly once.
12. A separate expired reservation can be no-show settled.
13. Settlement split matches the event basis points.
14. Contract states can be inspected from the UI.
15. README explains architecture, Mock/Testnet limitations, all Stellar integrations, and the exact Stellar Skill paths actually used.
16. Public demo URL, Testnet contract ID, transaction/Explorer evidence, and deployment instructions are recorded.

Mock USDC → TRY withdrawal is a P1 bonus, not a Definition-of-Done blocker.

If any of 1–13 fail unpredictably, the team should stop adding features and stabilize the path.

---

# 39. Product Decisions — Locked for MVP

These decisions should be treated as frozen unless a blocking technical issue appears.

| Decision | MVP Choice |
|---|---|
| Primary use case | Workshops / events |
| Network | Stellar Testnet |
| Fiat | TRY |
| Settlement asset | Hackathon Testnet USDC |
| On/off-ramp | TR Mock Anchor |
| Additional integration | Stellar Wallets Kit |
| Wallet guaranteed | Freighter |
| Contract | Custom Soroban Rust contract |
| Backend | Next.js Route Handlers |
| Database | Supabase PostgreSQL |
| Deployment | Vercel + Stellar Testnet |
| QR scanner | `@zxing/browser` |
| Participant attendance proof | Organizer-authorized QR scan |
| Cancellation | Full refund before one deadline |
| No-show split | Organizer + Community Pool |
| Disputes | Out of scope |
| Yield | Out of scope |
| Cross-chain | Out of scope |
| Mainnet | Out of scope |
| Embedded/social wallet | Stretch only |
| Reputation | Stretch only |

---

# 40. Naming & Messaging

Working project name:

# **ShowUp**

Preferred descriptor:

> **Programmable commitment bonds for reservations and events.**

Alternative pitch:

> **Reserve with a refundable bond. Show up, get it back.**

Avoid describing the project as:

- a crypto ticketing platform,
- a punishment system,
- an investment product,
- a restaurant marketplace.

The product is a **commitment and settlement primitive**.

---

# 40.1 Submission & Jury Package

The technical build is not the entire submission. Before code freeze, prepare all competition-facing evidence.

## Required delivery package

- **Public GitHub repository**.
- README fully in English with problem, user journey, architecture, Stellar/Anchor role, setup, testing, deployment, limitations, and team responsibilities.
- **Public frontend/demo URL** usable by judges without private access.
- Stellar **Testnet contract ID**, deployed artifact information, and at least one successful transaction/Explorer reference.
- Mock Anchor integration instructions and at least one successful Anchor transaction ID/status captured for evidence.
- Exact Stellar Skill file paths actually used during development.
- English pitch deck built from a **copy of the official hackathon presentation template**.
- Team/contact/track fields and the project "Why" narrative completed in the submission portal.

## README evidence checklist

- [ ] Genesis track stated.
- [ ] Mock Anchor is described as Testnet simulation; no real-TRY claim.
- [ ] Anchor and Soroban stages shown separately.
- [ ] Wallets Kit integration visible in both code and user flow.
- [ ] Contract methods, authorization model, and no-double-settlement invariant documented.
- [ ] Network, contract ID, Mock USDC issuer/SAC details documented.
- [ ] Exact Skill paths listed.
- [ ] Test and deploy commands work from a fresh clone.
- [ ] Known limitations and production boundaries are explicit.
- [ ] No seed/private key exists in repo, logs, screenshots, deck, or backup video.

## Judging alignment

ShowUp should make evidence visible for all six stated categories:

1. **Meaningful idea and impact:** scarce capacity lost to no-shows; refundable commitment bond.
2. **Technical implementation:** Soroban state machine, token custody, auth, negative tests, QR verifier flow.
3. **Ecosystem fit:** Mock Anchor + Wallets Kit + Stellar Testnet/SAC/Soroban are load-bearing.
4. **User experience:** TRY-denominated bond, hidden Web3 terminology, simple reserve/check-in/refund flow.
5. **Traction and continuity:** credible API/SDK/vertical roadmap without pretending P0 is production-ready.
6. **Presentation and documentation:** short repeatable demo, Explorer proof, clear README and architecture.

---

# 41. Future Product Roadmap — Not Hackathon Scope

## Phase A

- multiple refund tiers,
- waitlist auto-promotion,
- reminder system,
- multi-verifier events,
- organizer teams.

## Phase B

- ShowUp reputation score,
- lower bond for trusted participants,
- API/SDK for third-party reservation systems,
- white-label widgets.

## Phase C

Vertical adapters:

- restaurants,
- sports courts,
- medical appointments,
- coworking,
- university laboratories,
- equipment booking,
- training/classes.

## Phase D

- embedded wallet onboarding,
- sponsored transactions,
- privacy improvements,
- enterprise settlement reporting.

---

# 42. Sources & Technical References

## Hackathon

- Documentation: https://stellar-hackathon-turkiye.vercel.app
- GitHub: https://github.com/yigitcangokmen/stellar-hackathon-turkiye
- Mock Anchor: https://tr-mock-anchor.fly.dev
- Mock Anchor guide: https://tr-mock-anchor.fly.dev/sep

## Stellar

- Stellar Developer Docs: https://developers.stellar.org
- Client SDKs: https://developers.stellar.org/docs/tools/sdks/client-sdks
- Stellar software versions: https://developers.stellar.org/docs/networks/software-versions
- Stellar Wallets Kit: https://stellarwalletskit.dev
- SCF Integration List: https://github.com/stellar/scf-handbook/blob/main/scf-awards/build-award/integration-track/integration-list.md

## Stellar Skills / development workflow

- Official Stellar developer skills: https://github.com/stellar/stellar-dev-skill
- `stellar-build`: https://github.com/kaankacar/stellar-build
- Raven MCP: https://raven.stellar.buzz

## Competition handbook notes

- Organizer handbook: `2026_08_10 Rise In__ Stellar Pro Hackathon Tracks.docx`
- Day 2 submission deadline: 12:00 local Istanbul time (confirm in opening briefing / portal).
- Genesis teams: up to four people.
- Only shortlisted teams present live.
- Use the official presentation template for the final pitch.

## Important current hackathon details

The hackathon repository documents:

- Mock Anchor Testnet use,
- SEP-1 / SEP-6 / SEP-10 / SEP-12 / SEP-38,
- 50–3,000 TRY deposit range,
- minimum 1 USDC withdrawal,
- Stellar Wallets Kit as a supported ecosystem integration,
- combining Anchor with smart-contract logic as a strong core-feature pattern.

---

# 43. Final Architecture Decision

The project should ship with this exact P0 composition:

```text
                        SHOWUP MVP

                  ┌──────────────────┐
                  │    Next.js UI    │
                  └────────┬─────────┘
                           │
             ┌─────────────┴─────────────┐
             │                           │
             ▼                           ▼
   Stellar Wallets Kit             Mock Anchor
     + Freighter              SEP-1/10/12/38/6
             │                           │
             └─────────────┬─────────────┘
                           │
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
        │               │                │
        ▼               ▼                ▼
  Participant       Organizer      Community Pool
    refund          settlement       settlement
```

This architecture is designed to satisfy the hackathon's Anchor/local-payment requirement with the provided **Mock Anchor simulation**, includes Stellar Wallets Kit as the primary ecosystem integration, uses Soroban for core business logic, remains understandable in a short live demo, and stays realistic within the submission-driven build window. Final eligibility interpretations should still be confirmed at the organizer briefing.

---

## Final Rule

> **Do not add a feature unless it improves the required end-to-end demo, fixes a real failure mode, or directly satisfies a hackathon requirement.**

Everything else waits until after the hackathon.

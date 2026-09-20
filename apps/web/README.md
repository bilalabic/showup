# ShowUp web app

Next.js 16 frontend for ShowUp on Stellar Testnet.

## Visual identity

- Space Grotesk is the display face, Geist remains the UI/body face, and Space
  Mono keeps addresses, hashes and tabular amounts technically consistent.
- The brand accent is electric mint `#4DE6C6`; apricot `#FFB454` is reserved
  for community-pool and settlement-adjacent meaning.
- The primary mark is the Constellation Check: network nodes resolving into a
  verified-attendance check. The exported Arrival Ring remains the compact
  fallback concept. Both are code-native SVGs in `components/brand/logo.tsx`.
- Reservation states own their colors: locked/pending mint, attended emerald,
  cancelled/refunded slate, no-show rose and community amber.

## Run locally

From the repository root:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Wallet connection is always
user-initiated. Desktop browsers use the Freighter extension; mobile browsers
use WalletConnect to hand the session to Freighter Mobile. Select Stellar
Testnet, then use **Connect wallet**.

Copy the repository `.env.example` to `apps/web/.env.local` before
contract-backed flows are enabled. Never place a secret key in an environment
file; transaction signing stays in the user's wallet.

## Wallet boundary

- `lib/wallet/port.ts` defines application-owned wallet types.
- `lib/wallet/wallets-kit-adapter.ts` is the only Wallets Kit boundary. It uses
  Freighter's extension transport on desktop and WalletConnect on mobile.
- `lib/wallet/provider.tsx` owns connection, account-change, and network state.
- Non-Testnet sessions are blocked before every signing request.

## Anchor boundary

- `lib/anchor` contains the SEP-1/10/38/6 client and deposit state machine.
- `components/wallet/anchor-deposit.tsx` binds that machine to the wallet page,
  including reload-safe polling and claimable-balance recovery.
- SEP-10 bearer tokens stay in memory; only public deposit and quote ids may use
  `sessionStorage`.
- The Mock Anchor currently permits direct browser CORS, so there are no proxy
  Route Handlers or server-held tokens.
- `NEXT_PUBLIC_ENABLE_DEMO_TOOLS` exposes only the visibly labelled Testnet mock
  bank-transfer control and defaults to `false`.

## Reservation and check-in boundary

- `/reservations` and `/reservations/[id]` read the connected participant's
  current contract records and render a QR pass only for an active locked bond.
- `lib/qr` encodes a strict, size-limited identifier payload. It contains no
  secret, signature, nonce or payout destination.
- `/organizer/events/[id]` discovers participant addresses from retained
  contract events, then re-reads every reservation from contract storage. It
  warns when the RPC retention window makes the list incomplete.
- `/organizer/events/[id]/scan` starts the camera only after a user action,
  rejects a pass for another event before signing, and never submits a check-in
  automatically. The verifier explicitly confirms the transaction in their
  wallet. A manual participant-address lookup uses the same contract path.
- `/reservations/[id]` exposes cancellation before the published deadline and
  pull-refund after event cancellation. `/organizer/events/[id]` exposes final
  event cancellation and permissionless no-show settlement after the check-in
  deadline. Every money-moving action repeats its exact effect before signing.
- Refund and check-in surfaces verify that the participant can still receive
  the pinned Testnet USDC asset. A removed trustline is repaired before the
  transaction rather than discovered through a failed push transfer.

## Verification

```bash
pnpm lint
pnpm build        # run before typecheck: Next 16 generates global route types here
pnpm typecheck
pnpm test         # Vitest, offline fixtures only
```

`pnpm win:verify` from the repository root runs all of the above plus the
contract's fmt, clippy, tests and Wasm build through WSL.

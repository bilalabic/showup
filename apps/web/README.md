# ShowUp web app

Next.js 16 frontend for ShowUp on Stellar Testnet.

## Run locally

From the repository root:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Wallet connection is always
user-initiated. Install and unlock Freighter, select Stellar Testnet, then use
**Connect Freighter**.

Copy the repository `.env.example` to `.env.local` before contract-backed flows
are enabled. Never place a secret key in an environment file; transaction
signing stays in the user's wallet.

## Wallet boundary

- `lib/wallet/port.ts` defines application-owned wallet types.
- `lib/wallet/wallets-kit-adapter.ts` is the only Wallets Kit/Freighter import
  boundary.
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

## Verification

```bash
pnpm lint
pnpm build        # run before typecheck: Next 16 generates global route types here
pnpm typecheck
pnpm test         # Vitest, offline fixtures only
```

`pnpm win:verify` from the repository root runs all of the above plus the
contract's fmt, clippy, tests and Wasm build through WSL.

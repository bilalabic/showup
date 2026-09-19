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

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm build
```

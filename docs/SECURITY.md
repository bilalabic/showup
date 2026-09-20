# Security model

ShowUp is a Stellar Testnet demonstration. It handles no real money and performs
no real KYC. Security claims are divided by the layer that actually enforces
them.

## Contract-enforced

- The settlement token and community pool are constructor-pinned.
- Every privileged call requires the stored actor's authorization.
- Every money-moving path requires a `Locked` reservation and writes one
  terminal state, preventing double refund or double settlement.
- Capacity, schedules, cancellation and check-in windows are checked against
  ledger time, never browser time.
- No-show arithmetic uses checked integers; the community leg receives the
  remainder so the two transfers equal the original bond exactly.
- Settlement is permissionless only after the published deadline and only to
  the published destinations.
- Financial state uses persistent storage with explicit TTL extension.

## Wallet-enforced

Private keys never enter application code. The browser receives a public
address and asks Stellar Wallets Kit/Freighter to sign XDR. Testnet is asserted
when the kit initializes and again before every signature. Account changes
invalidate the current UI session.

## Application boundaries

- There is no application hot wallet or database.
- The SEP-10 token stays in memory, is scoped by account and Anchor domain, and
  is never rendered or persisted to local/session storage.
- Discovered authenticated Anchor endpoints must be HTTPS.
- The global technical panel renders an explicit allowlist of public fields.
- Unknown SDK/RPC text is not copied into primary error messages.
- Event text is rendered through React escaping and bounded in both the form and
  contract.

## UI safeguards, not controls

Balance checks, disabled buttons, countdowns, TRY estimates and QR freshness
warnings improve recovery but do not authorize settlement. The contract
re-evaluates financial rules. A QR contains only an event id, participant
address and issue time; the verifier's wallet signature and current contract
state are authoritative.

## Operational checklist

- Testnet only; refuse the public-network passphrase.
- Keep `NEXT_PUBLIC_ENABLE_DEMO_TOOLS=false` outside the labelled sandbox demo.
- Never commit `.env.local`, Stellar secret keys, seed phrases, JWTs or wallet
  screenshots containing recovery material.
- Verify the pinned issuer/SAC and community-pool trustline before a demo.
- Treat Mock Anchor health as service metadata, not proof that its payment
  worker completed a particular deposit.

# Hackathon requirement map

This checklist maps the internal hackathon specification to implementation and
evidence. “Pending” means an external or wallet-signed acceptance step has not
yet been captured; it is not silently counted as complete.

| Requirement | Implementation | Evidence/state |
|---|---|---|
| Genesis track and problem | Root README and landing page | Complete |
| Testnet wallet connection | Wallets Kit adapter and network guard | Accepted live in Freighter (see event 11 in the README) |
| Soroban attendance bond | `contracts/showup-bond` | 58 tests; deployed contract recorded |
| Mock USDC trustline and balances | Horizon asset/reserve layer and `/wallet` | Implemented; live signature pending |
| Public TRY estimate | SEP-38 `/price` on event detail | Implemented and unit tested |
| Mock Anchor TRY → USDC | SEP-1/10/38/6 client and deposit state machine | Implemented; successful live on-ramp record pending |
| Exact bond reservation | Event detail transaction flow | Browser-signed hash recorded (event 11) |
| Reservation discovery | Retention-aware contract-event index | Implemented; incomplete history is disclosed |
| QR check-in and refund | Reservation pass + organizer scanner | Refund hashes recorded (events 9 and 11); browser-signed check-in pending |
| Cancellation/refund | Participant and organizer actions | Implemented; hashes pending |
| No-show split | Contract + organizer settlement UI | Live 80/20 hash recorded (event 10, CLI-signed) |
| Contract state inspectable | Global allowlisted technical panel | Complete |
| Exact Stellar Skill paths | Root README and `docs/stellar-skills.md` | Complete |
| Deployment evidence | `docs/deployments/testnet.md` | Contract evidence complete |
| Public frontend | Deployed on Vercel | [showup-steel.vercel.app](https://showup-steel.vercel.app) |
| Pitch deck | Submission package | **Pending owner action** — official template |

## Definition-of-Done evidence still requiring a browser wallet

1. Create an event with the organizer wallet.
2. Enable the participant's pinned USDC trustline.
3. Complete a Mock Anchor deposit and record its deposit id and Stellar payment.
4. Scan and check in from the organizer device, against an event created by the
   same wallet, and record the refund hash. The reserve leg is already
   browser-signed; only the verifier side is still CLI-held.
5. Reserve the compressed fixture, settle the no-show, and record the split hash
   from the browser. The split itself is proven, but CLI-signed.
6. Cancel a separate reservation and event, claim the refund, and record hashes.

The frontend is published and its URL is recorded above; the remaining items are
browser-signed transaction hashes that prove the published app actually works.

Faucet-funded Testnet USDC may unblock contract testing, but it is not evidence
of a successful Anchor integration.

## Deliberately not on this list

A demo video is **not** tracked as a requirement. No official source states that
one is expected, and the specification still carries the question as unanswered.
Its only role here is insurance: a recorded run of the same flow, presented as a
recording, if the live demo cannot be trusted in the room. It comes after every
row above is closed, not before.

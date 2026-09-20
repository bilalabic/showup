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
| Mock Anchor TRY → USDC | SEP-1/10/38/6 client and deposit state machine | Live deposit completed: `sep_c3awgubgw3jk1sh4owp5`, 150 TRY → 3.0594136 USDC |
| Exact bond reservation | Event detail transaction flow | Browser-signed hashes recorded (events 11 and 18) |
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

1. Check in from the browser and record the hash. Event 18 was created and
   reserved in the browser with an already-open check-in window; only the
   verifier signature is outstanding.
2. Settle a no-show from the browser and record the split hash. The split itself
   is proven on chain, but CLI-signed.
3. Cancel a reservation and an event from the browser, claim the refund, and
   record the hashes.

The frontend is published and its URL is recorded above; the remaining items are
browser-signed transaction hashes that prove the published app actually works.

Faucet-funded Testnet USDC may unblock contract testing, but it is not evidence
of a successful Anchor integration. That evidence now exists separately: a live
SEP-6 deposit settled end to end, TRY in and USDC paid out on Stellar.

## Deliberately not on this list

A demo video is **not** tracked as a requirement. No official source states that
one is expected, and the specification still carries the question as unanswered.
Its only role here is insurance: a recorded run of the same flow, presented as a
recording, if the live demo cannot be trusted in the room. It comes after every
row above is closed, not before.

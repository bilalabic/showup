# Hackathon requirement map

This checklist maps the internal hackathon specification to implementation and
evidence. “Pending” means an external or wallet-signed acceptance step has not
yet been captured; it is not silently counted as complete.

| Requirement | Implementation | Evidence/state |
|---|---|---|
| Genesis track and problem | Root README and landing page | Complete |
| Testnet wallet connection | Wallets Kit adapter and network guard | Implemented; live Freighter acceptance pending |
| Soroban attendance bond | `contracts/showup-bond` | 58 tests; deployed contract recorded |
| Mock USDC trustline and balances | Horizon asset/reserve layer and `/wallet` | Implemented; live signature pending |
| Public TRY estimate | SEP-38 `/price` on event detail | Implemented and unit tested |
| Mock Anchor TRY → USDC | SEP-1/10/38/6 client and deposit state machine | Implemented; successful live on-ramp record pending |
| Exact bond reservation | Event detail transaction flow | Implemented; hash pending |
| Reservation discovery | Retention-aware contract-event index | Implemented; incomplete history is disclosed |
| QR check-in and refund | Reservation pass + organizer scanner | Implemented; two-device hash pending |
| Cancellation/refund | Participant and organizer actions | Implemented; hashes pending |
| No-show split | Contract + organizer settlement UI | Implemented and tested; live hash pending |
| Contract state inspectable | Global allowlisted technical panel | Complete |
| Exact Stellar Skill paths | Root README and `docs/stellar-skills.md` | Complete |
| Deployment evidence | `docs/deployments/testnet.md` | Contract evidence complete |
| Public frontend | Vercel instructions in README | **Pending URL** |
| Demo video and pitch deck | Submission package | **Pending owner action** |

## Definition-of-Done evidence still requiring a browser wallet

1. Create an event with the organizer wallet.
2. Enable the participant's pinned USDC trustline.
3. Complete a Mock Anchor deposit and record its deposit id and Stellar payment.
4. Reserve, scan/check in, and record the refund hash.
5. Reserve the compressed fixture, settle the no-show, and record the split hash.
6. Cancel a separate reservation and event, claim the refund, and record hashes.
7. Publish the verified frontend and record the public URL.

Faucet-funded Testnet USDC may unblock contract testing, but it is not evidence
of a successful Anchor integration.

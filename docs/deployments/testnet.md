# Testnet deployment

The current ShowUp contract was deployed to Stellar Testnet on 2026-09-19.
It is a hackathon deployment using Mock USDC; it handles no real money and
performs no real KYC.

## Addresses

| Item | Address |
|---|---|
| ShowUp contract | `CCCDFM2MGKO5PEBS565O7FO2OL4CZYUFFRTQLUPPIIIL2JNCPUSUIRHM` |
| Pinned Mock USDC SAC | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` |
| Classic asset | `USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5` |
| Community pool | `GDCXH26TJFRMADSZKVLNB4EWNV2ORZHNEGDMH3D5UHPX25EW5REJOKP7` |
| Deployer / smoke-event organizer | `GBN4VYCAM6SQWTZV54AQ5IQP5FDGQ7SYTHMU7T5QKRAHJWZSNDKNAVD4` |

The constructor's `get_config()` result was verified immediately after deploy
and returned the token and community-pool addresses above.

## Artifact

- Target: `wasm32v1-none`
- Optimized size: 15411 bytes
- SHA-256 / installed Wasm hash:
  `1d7fea9db18823cd643992b09b6d1845e199f1763bde9fd0465a0dfd724f36d0`
- Exported contract functions: 12

## Transaction evidence

| Action | Transaction |
|---|---|
| Upload Wasm | [651dd075474426439024f83ddb6024e2e3bfc14d46bfeafecefc390c2c6d8703](https://stellar.expert/explorer/testnet/tx/651dd075474426439024f83ddb6024e2e3bfc14d46bfeafecefc390c2c6d8703) |
| Deploy with constructor | [872d4f9501ef75ce57e17756b8aac3fc09b2fe5d96cda525f7b72cc9598b223e](https://stellar.expert/explorer/testnet/tx/872d4f9501ef75ce57e17756b8aac3fc09b2fe5d96cda525f7b72cc9598b223e) |
| Create C4 smoke event | [6444c9b41a79397d86756b540a6a3a541385e39740e0d3fd53da4a9dc7a0c796](https://stellar.expert/explorer/testnet/tx/6444c9b41a79397d86756b540a6a3a541385e39740e0d3fd53da4a9dc7a0c796) |

The smoke transaction created event id `1`, and a subsequent simulated
`get_event(1)` read verified its on-chain title and state.

## Generated client

`packages/showup-bond-client` was generated from this deployed contract with
`stellar contract bindings typescript --contract-id`. Its `networks.testnet`
constant therefore contains both the Testnet passphrase and the contract ID.
The generator's Stellar SDK dependency was aligned to `^17.1.0` to prevent a
second incompatible SDK copy in the pnpm workspace.

## Bond lifecycle, verified on-chain

Run on 2026-09-20 against the contract above, signed by the Stellar CLI. These
transactions prove the settlement logic on a live network rather than only in
unit tests. They do **not** prove the browser flow — the web app's signed
equivalents are still outstanding.

Funding note: the Mock Anchor's on-ramp payout worker was down during this run,
so the participant's Mock USDC came from the Circle testnet faucet instead. The
settlement asset is the same Circle testnet USDC the Anchor issues, so the
contract path is unaffected — but this is not Anchor acceptance evidence.

### Attendance refund — event 9

| Step | Transaction | Effect |
|---|---|---|
| `reserve` | [`6e3c00ab…2ac4d`](https://stellar.expert/explorer/testnet/tx/6e3c00ab4915ad81b7e9a93d8771213d7d90aa9a7b91cbc92c98b1de9652ac4d) | participant 20 → 17.5 USDC, contract 0 → 2.5 |
| `check_in` | [`92a8500e…96586`](https://stellar.expert/explorer/testnet/tx/92a8500e6162459c61e69658a24d8dfc7fd4a8f8d4e1eb56b4c3dc5469596586) | contract 2.5 → 0, participant back to 20 |

Final reservation state: `status: "Attended"`, `amount: 25000000`.
Emitted `BondLocked` then `CheckedIn`.

### No-show settlement — event 10

| Step | Transaction | Effect |
|---|---|---|
| `reserve` | [`cb63498d…3e92c2`](https://stellar.expert/explorer/testnet/tx/cb63498d25e17999144059ca60b5390939fbf456232e8e3447e2c108673e92c2) | participant 20 → 17.5 USDC, contract 0 → 2.5 |
| `settle_no_show` | [`e17cfd91…30d350`](https://stellar.expert/explorer/testnet/tx/e17cfd91b3c289df03f928a88406bce3d3e122206ba6bd88737bd63fb930d350) | contract 2.5 → 0, organizer +2.0, community pool +0.5 |

Final reservation state: `status: "NoShowSettled"`.
Emitted `NoShowSettled` with `organizer_amount: 20000000`,
`community_amount: 5000000` — exactly the event's 8000/2000 basis points, summing
to the locked `25000000` with no dust left in the contract.

`settle_no_show` is permissionless by design; this call was made after the
check-in deadline had passed, which is the only condition it enforces.

### Browser-signed reservation — event 11

The first reservation signed by the web app rather than the CLI, from Freighter
on Testnet.

| Step | Transaction | Signed by |
|---|---|---|
| `reserve` | [`09a4dbb9…055c6`](https://stellar.expert/explorer/testnet/tx/09a4dbb9e7d121b6940ed5fc11f39faff27886ef0a323317e60c844b81d055c6) | Freighter, `GCZULUTQ…LL7VN` |
| `check_in` | [`ee6512c0…48d02`](https://stellar.expert/explorer/testnet/tx/ee6512c079e255e1b173e051d79c44064c2cd9588f8d4261d6764ed71ae48d02) | Stellar CLI, event 11's verifier |

Participant balance moved 20 → 17.5 USDC on reserve and back to 20 on check-in.

Event 11 was seeded by `scripts/seed-demo-event.sh`, so its organizer — and
therefore its verifier — is the CLI deploy identity. A fully browser-signed
round requires an event created from `/organizer/events/new`, where the
connected wallet becomes both organizer and verifier.

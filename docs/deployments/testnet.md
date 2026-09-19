# Testnet deployment

The current ShowUp contract was deployed to Stellar Testnet on 2026-09-19.
It is a hackathon deployment using Mock USDC; it handles no real money and
performs no real KYC.

## Addresses

| Item | Address |
|---|---|
| ShowUp contract | `CCCDFM2MGKO5PEBS565O7FO2OL4CZYUFFRTQLUPPIIIL2JNCPUSUIRHM` |
| Pinned Mock USDC SAC | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` |
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

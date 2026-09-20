/**
 * RPC client construction and the ledger clock.
 *
 * `lib/stellar` owns all raw network access. It knows nothing about what a
 * ShowUp event is, never signs anything, and never decides eligibility.
 *
 * Verified against `@stellar/stellar-sdk` 17.1.0: `SorobanRpc` does not exist.
 * The root export is an `rpc` namespace and `rpc.Server` is the client.
 */

import { rpc } from "@stellar/stellar-sdk";

/** Testnet, and only Testnet. Mainnet is explicitly out of scope. */
export const TESTNET_NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";

/** Default public Testnet RPC endpoint. */
export const DEFAULT_RPC_URL = "https://soroban-testnet.stellar.org";

/**
 * The configured RPC URL.
 *
 * `process.env.NEXT_PUBLIC_STELLAR_RPC_URL` is referenced literally so Next can
 * inline it into the client bundle at build time.
 */
export function getRpcUrl(): string {
  const configured = process.env.NEXT_PUBLIC_STELLAR_RPC_URL;
  const trimmed = typeof configured === "string" ? configured.trim() : "";
  return trimmed.length > 0 ? trimmed : DEFAULT_RPC_URL;
}

let cachedServer: rpc.Server | undefined;
let cachedServerUrl: string | undefined;

/**
 * A configured `rpc.Server`, memoised per URL.
 *
 * `allowHttp` is derived from the URL rather than hard-coded, so a local
 * `http://localhost:8000` quickstart works without opening HTTP up in
 * production.
 */
export function getRpc(): rpc.Server {
  const url = getRpcUrl();

  if (!cachedServer || cachedServerUrl !== url) {
    cachedServer = new rpc.Server(url, {
      allowHttp: url.startsWith("http://"),
    });
    cachedServerUrl = url;
  }

  return cachedServer;
}

export type LedgerSnapshot = {
  sequence: number;
  closeTime: number;
};

/** The latest ledger number and close time, for diagnostics and UI clocks. */
export async function getLedgerSnapshot(): Promise<LedgerSnapshot> {
  const latest = await getRpc().getLatestLedger();
  const sequence = Number(latest.sequence);
  const closeTime = Number(latest.closeTime);

  if (!Number.isSafeInteger(sequence) || !Number.isFinite(closeTime)) {
    throw new Error("Stellar RPC returned an unusable latest-ledger response.");
  }

  return { sequence, closeTime: Math.floor(closeTime) };
}

/**
 * The ledger close time, in Unix seconds.
 *
 * This is the clock every eligibility decision in the UI must use. The browser
 * clock is only ever used for cosmetic countdown ticking between refreshes: a
 * user whose machine clock is wrong still sees correct eligibility, and a user
 * who changes their clock changes nothing.
 */
export async function getLedgerNow(): Promise<number> {
  return (await getLedgerSnapshot()).closeTime;
}

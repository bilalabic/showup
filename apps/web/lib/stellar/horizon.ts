/**
 * Horizon access: classic account balances, trustlines and submission.
 *
 * Soroban RPC does not serve classic account state, so balances and trustlines
 * come from Horizon. This module never signs anything — `buildChangeTrust`
 * returns unsigned XDR and `submitSignedTransaction` takes already-signed XDR.
 *
 * Verified against `@stellar/stellar-sdk` 17.1.0: `Server` alone does not exist
 * at the root. The Horizon client is `Horizon.Server`.
 */

import {
  Asset,
  BASE_FEE,
  Horizon,
  NotFoundError,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";

import { toStroops } from "../domain";
import { TESTNET_NETWORK_PASSPHRASE } from "./rpc";
import { calculateXlmReservePosition } from "./xlm-reserve";

/** Default public Testnet Horizon endpoint. */
export const DEFAULT_HORIZON_URL = "https://horizon-testnet.stellar.org";

/** Mock USDC issuer on Testnet (the TR Mock Anchor's asset). */
export const USDC_ISSUER =
  process.env.NEXT_PUBLIC_USDC_ISSUER?.trim() ||
  "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

/** Mock USDC asset code. */
export const USDC_CODE = process.env.NEXT_PUBLIC_USDC_CODE?.trim() || "USDC";

/** Fee used by the locally built one-operation change-trust transaction. */
export const CHANGE_TRUST_FEE_STROOPS = BigInt(BASE_FEE);

/** The settlement asset as a classic Stellar asset. */
export function getUsdcAsset(): Asset {
  return new Asset(USDC_CODE, USDC_ISSUER);
}

/** The configured Horizon base URL. */
export function getHorizonUrl(): string {
  const configured = process.env.NEXT_PUBLIC_HORIZON_URL;
  const trimmed = typeof configured === "string" ? configured.trim() : "";
  return trimmed.length > 0 ? trimmed : DEFAULT_HORIZON_URL;
}

let cachedHorizon: Horizon.Server | undefined;
let cachedHorizonUrl: string | undefined;

/** A configured `Horizon.Server`, memoised per URL. */
export function getHorizon(): Horizon.Server {
  const url = getHorizonUrl();

  if (!cachedHorizon || cachedHorizonUrl !== url) {
    cachedHorizon = new Horizon.Server(url, {
      allowHttp: url.startsWith("http://"),
    });
    cachedHorizonUrl = url;
  }

  return cachedHorizon;
}

/** A classic account's XLM and Mock USDC position, in integer stroops. */
export type AccountAssets = {
  /** `false` when Horizon has never seen this account (not funded yet). */
  exists: boolean;
  /** Native XLM balance in stroops. */
  xlm: bigint;
  /** Current network base reserve in stroops. */
  baseReserve: bigint;
  /** Minimum balance locked by the account and its reserve entries. */
  minimumBalance: bigint;
  /** Native XLM committed to open selling offers. */
  nativeSellingLiabilities: bigint;
  /** XLM available after the minimum balance and native liabilities. */
  spendableXlm: bigint;
  /** Mock USDC balance in stroops; `0n` when there is no trustline. */
  usdc: bigint;
  hasUsdcTrustline: boolean;
};

const EMPTY_ACCOUNT: AccountAssets = {
  exists: false,
  xlm: 0n,
  baseReserve: 0n,
  minimumBalance: 0n,
  nativeSellingLiabilities: 0n,
  spendableXlm: 0n,
  usdc: 0n,
  hasUsdcTrustline: false,
};

function isNotFound(error: unknown): boolean {
  if (error instanceof NotFoundError) return true;
  const status = (error as { response?: { status?: number } } | null)?.response
    ?.status;
  return status === 404;
}

/**
 * Read an account's XLM and Mock USDC position from Horizon.
 *
 * A 404 means the account has never been funded on Testnet, which is a state
 * the UI renders differently rather than an error: it resolves to
 * `{ exists: false, ... }` instead of throwing. `null` is part of the return
 * type so callers written against an "unknown account" case still compile.
 *
 * Balances are parsed as decimal strings into integer stroops. Horizon returns
 * them as decimal text and putting a financial value through `Number` or
 * `parseFloat` would corrupt it, so neither is used here.
 */
export async function getAccountAssets(
  address: string,
): Promise<AccountAssets | null> {
  let account: Horizon.AccountResponse;

  try {
    account = await getHorizon().loadAccount(address);
  } catch (error) {
    if (isNotFound(error)) {
      return { ...EMPTY_ACCOUNT };
    }
    throw error;
  }

  let xlm = 0n;
  let nativeSellingLiabilities = 0n;
  let usdc = 0n;
  let hasUsdcTrustline = false;

  for (const line of account.balances) {
    if (line.asset_type === "native") {
      xlm = toStroops(line.balance);
      nativeSellingLiabilities = toStroops(line.selling_liabilities);
      continue;
    }

    if (line.asset_type === "credit_alphanum4" || line.asset_type === "credit_alphanum12") {
      if (line.asset_code === USDC_CODE && line.asset_issuer === USDC_ISSUER) {
        hasUsdcTrustline = true;
        usdc = toStroops(line.balance);
      }
    }
  }

  const ledgers = await getHorizon()
    .ledgers()
    .order("desc")
    .limit(1)
    .call();
  const latestLedger = ledgers.records[0];
  if (!latestLedger) {
    throw new Error("Horizon did not return a latest ledger.");
  }

  const baseReserve = BigInt(latestLedger.base_reserve_in_stroops);
  const position = calculateXlmReservePosition({
    balance: xlm,
    baseReserve,
    subentryCount: account.subentry_count,
    numSponsoring: account.num_sponsoring,
    numSponsored: account.num_sponsored,
    sellingLiabilities: nativeSellingLiabilities,
  });

  return {
    exists: true,
    xlm,
    baseReserve,
    minimumBalance: position.minimumBalance,
    nativeSellingLiabilities,
    spendableXlm: position.spendable,
    usdc,
    hasUsdcTrustline,
  };
}

/** Whether an account already holds the Mock USDC trustline. */
export async function hasTrustline(address: string): Promise<boolean> {
  const assets = await getAccountAssets(address);
  return assets?.hasUsdcTrustline ?? false;
}

/**
 * Build an UNSIGNED `changeTrust` transaction for Mock USDC.
 *
 * Returns base64 XDR. Signing happens in `lib/wallet`; this module never holds
 * a key and never signs.
 */
export async function buildChangeTrust(address: string): Promise<string> {
  const account = await getHorizon().loadAccount(address);

  return new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: TESTNET_NETWORK_PASSPHRASE,
  })
    .addOperation(Operation.changeTrust({ asset: getUsdcAsset() }))
    .setTimeout(180)
    .build()
    .toXDR();
}

/**
 * Submit already-signed XDR to Horizon and resolve once the ledger has taken
 * it. Horizon's transaction submission is synchronous: it returns after the
 * transaction has been included in a ledger, or errors.
 */
export async function submitSignedTransaction(
  signedXdr: string,
): Promise<{ hash: string }> {
  const transaction = TransactionBuilder.fromXDR(
    signedXdr,
    TESTNET_NETWORK_PASSPHRASE,
  );

  const response = await getHorizon().submitTransaction(transaction);

  if (!response.successful) {
    throw new Error(
      `Transaction ${response.hash} was included in ledger ${response.ledger} but failed.`,
    );
  }

  return { hash: response.hash };
}

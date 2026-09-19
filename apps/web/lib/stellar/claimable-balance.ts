/**
 * Unsigned classic transaction assembly for claimable-balance recovery.
 *
 * Signing remains in `lib/wallet`; submission remains in `lib/stellar`.
 */

import {
  Account,
  Asset,
  BASE_FEE,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";

import { TESTNET_NETWORK_PASSPHRASE } from "./rpc";

const CLAIMABLE_BALANCE_ID_PATTERN = /^[0-9a-f]{72}$/i;

export type BuildClaimOptions = {
  accountId: string;
  /** Current account sequence; TransactionBuilder increments it. */
  sequence: string;
  claimableBalanceId: string;
  asset: { code: string; issuer: string };
  networkPassphrase?: string;
  baseFee?: string;
  timeoutSeconds?: number;
  includeChangeTrust?: boolean;
};

/** Build one unsigned transaction containing changeTrust then claim. */
export function buildClaimWithTrustlineXdr(options: BuildClaimOptions): string {
  const {
    accountId,
    sequence,
    claimableBalanceId,
    asset,
    networkPassphrase = TESTNET_NETWORK_PASSPHRASE,
    baseFee = BASE_FEE,
    timeoutSeconds = 180,
    includeChangeTrust = true,
  } = options;

  if (!CLAIMABLE_BALANCE_ID_PATTERN.test(claimableBalanceId)) {
    throw new Error(
      `"${claimableBalanceId}" is not a valid claimable balance id.`,
    );
  }

  const operationCount = includeChangeTrust ? 2 : 1;
  const source = new Account(accountId, sequence);
  const builder = new TransactionBuilder(source, {
    fee: baseFee,
    networkPassphrase,
  });

  if (includeChangeTrust) {
    builder.addOperation(
      Operation.changeTrust({ asset: new Asset(asset.code, asset.issuer) }),
    );
  }

  builder.addOperation(
    Operation.claimClaimableBalance({ balanceId: claimableBalanceId }),
  );

  const built = builder.setTimeout(timeoutSeconds).build();
  if (built.operations.length !== operationCount) {
    throw new Error(
      "The recovery transaction was not built with the expected operations.",
    );
  }

  return built.toXDR();
}

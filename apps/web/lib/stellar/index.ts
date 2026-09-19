/**
 * `lib/stellar` — layer 1.
 *
 * All raw network access. May import `lib/domain` and the generated bindings;
 * must never know what a ShowUp event is, never sign anything, and never decide
 * eligibility.
 */

export {
  DEFAULT_RPC_URL,
  TESTNET_NETWORK_PASSPHRASE,
  getLedgerNow,
  getRpc,
  getRpcUrl,
} from "./rpc";

export {
  CONTRACT_ERROR_PATTERN,
  extractContractErrorCode,
} from "./contract-error-code";

export { classifyTxError, isTxFailure } from "./tx-result";

export {
  DEFAULT_HORIZON_URL,
  USDC_CODE,
  USDC_ISSUER,
  buildChangeTrust,
  getAccountAssets,
  getHorizon,
  getHorizonUrl,
  getUsdcAsset,
  hasTrustline,
  submitSignedTransaction,
} from "./horizon";

export type { AccountAssets } from "./horizon";

export type { TxFailure, TxResult } from "./tx-result";

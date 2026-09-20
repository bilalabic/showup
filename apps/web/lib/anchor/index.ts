/**
 * `lib/anchor` — layer 3. Every SEP interaction, as domain operations.
 *
 * Boundaries (SYSTEM.md section 4):
 *  - MAY import `lib/domain` and `lib/stellar`.
 *  - MUST NOT import `lib/contract`. Nothing here knows what a ShowUp event is.
 *  - Holds no keys and signs nothing — it receives a `ChallengeSigner` and
 *    returns unsigned XDR.
 *  - Persists no JWT anywhere durable. See `token-store.ts` and `session.ts`.
 *
 * CORS, checked live on 2026-09-19 from a browser origin:
 *   GET  /.well-known/stellar.toml  -> access-control-allow-origin: *
 *   GET  /sep6/info, /sep38/info, /sep38/price, /health -> same
 *   GET  /sep6/deposit (403, no token) -> same
 *   OPTIONS /auth, /sep38/quote, /sep6/deposit, /sep6/transaction
 *        -> 204, allow-origin: *, allow-headers: Content-Type,Authorization
 * The Anchor is fully permissive, including on the authenticated preflight, so
 * every call in this module runs DIRECTLY from the browser. The four proxy
 * route handlers sketched in SYSTEM.md section 15 are not needed and were not
 * created: `app/api/anchor/` does not exist.
 *
 * Nothing in this flow is atomic with anything on-chain. The Anchor delivering
 * USDC and the contract locking a bond are separate events and are never
 * presented as one.
 */

export {
  ANCHOR_ASSET_CODE,
  ANCHOR_ASSET_ISSUER,
  DELIVERY_METHOD,
  DEPOSIT_POLL_INTERVAL_MS,
  DEPOSIT_POLL_MAX_ATTEMPTS,
  FIAT_ASSET_ID,
  FUNDING_METHOD,
  GUIDANCE_ONLY_TRY_RANGE,
  QUOTE_CONTEXT,
  TESTNET_NETWORK_PASSPHRASE,
  getAnchorHomeDomain,
  isDemoToolsEnabled,
  normalizeHomeDomain,
} from "./config";

export {
  AnchorError,
  isAnchorError,
  isAuthenticationRequired,
} from "./errors";
export type { AnchorErrorKind, AnchorRecovery } from "./errors";

/** SEP-1. */
export { discover, parseStellarToml, resetDiscoveryCache } from "./sep1";

/** SEP-10. */
export {
  authenticate,
  exchangeChallenge,
  requestChallenge,
  validateChallenge,
  withFreshToken,
} from "./sep10";
export type { ChallengeResponse, ValidatedChallenge } from "./sep10";

/** SEP-10 token lifetime. The token itself never leaves memory. */
export {
  clearToken,
  hasValidToken,
  readTokenExpiry,
  readTokenSubject,
} from "./token-store";

/** SEP-38. */
export {
  EXPIRED_QUOTE_WARNING,
  getFirmQuote,
  getIndicativePrice,
  getIndicativePriceForBuyAmount,
  isQuoteExpired,
  parseExpiresAt,
  stellarAssetId,
} from "./sep38";
export type { FirmQuoteOptions } from "./sep38";

/** SEP-6. */
export {
  isTerminalDepositStatus,
  parseDepositTransaction,
  parseInstructions,
  pollDeposit,
  pollDepositUntilSettled,
  simulateMockBankTransfer,
  startDeposit,
  unwrapTransactionResponse,
} from "./sep6";
export type {
  PollDepositOptions,
  PollUntilSettledOptions,
  StartDepositOptions,
} from "./sep6";

/** Whether an Anchor status needs claimable-balance recovery. */
export { needsClaim } from "./claim";

/** The state machine. */
export {
  depositReducer,
  describeState,
  initialDepositState,
  isTerminalState,
  isWaitingOnAnchor,
  shouldPoll,
} from "./machine";
export type {
  DepositAction,
  DepositContext,
  DepositState,
  DepositStateName,
} from "./machine";

/** Reload persistence — ids only, never the token. */
export {
  clearDeposit,
  loadDeposit,
  saveDeposit,
  updateDeposit,
} from "./session";
export type { PersistedDeposit } from "./session";

export type {
  AnchorConfig,
  AnchorFee,
  AssetId,
  BankInstructions,
  ChallengeSigner,
  DepositRefunds,
  DepositStatus,
  DepositStatusCode,
  DepositTicket,
  InstructionField,
  Price,
  Quote,
} from "./types";

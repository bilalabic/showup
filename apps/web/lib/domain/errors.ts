/**
 * The contract's `#[contracterror]` codes, and the user-facing copy for each.
 *
 * These numbers are public ABI. They are never renumbered across an upgrade,
 * and `lib/contract` matches on them BY CODE — never by message string.
 */

export enum ContractErrorCode {
  NotFound = 1,
  NotActive = 2,
  AlreadyReserved = 3,
  EventFull = 4,
  NotLocked = 5,
  CheckInNotOpen = 6,
  CheckInWindowClosed = 7,
  CancellationDeadlinePassed = 8,
  SettlementTooEarly = 9,
  InvalidBasisPoints = 10,
  InvalidSchedule = 11,
  InvalidAmount = 12,
  Overflow = 13,
  EventNotCancelled = 14,
}

/** Machine-readable name for each code, as declared in the contract. */
const CONTRACT_ERROR_NAMES: Readonly<Record<ContractErrorCode, string>> = {
  [ContractErrorCode.NotFound]: "NotFound",
  [ContractErrorCode.NotActive]: "NotActive",
  [ContractErrorCode.AlreadyReserved]: "AlreadyReserved",
  [ContractErrorCode.EventFull]: "EventFull",
  [ContractErrorCode.NotLocked]: "NotLocked",
  [ContractErrorCode.CheckInNotOpen]: "CheckInNotOpen",
  [ContractErrorCode.CheckInWindowClosed]: "CheckInWindowClosed",
  [ContractErrorCode.CancellationDeadlinePassed]: "CancellationDeadlinePassed",
  [ContractErrorCode.SettlementTooEarly]: "SettlementTooEarly",
  [ContractErrorCode.InvalidBasisPoints]: "InvalidBasisPoints",
  [ContractErrorCode.InvalidSchedule]: "InvalidSchedule",
  [ContractErrorCode.InvalidAmount]: "InvalidAmount",
  [ContractErrorCode.Overflow]: "Overflow",
  [ContractErrorCode.EventNotCancelled]: "EventNotCancelled",
};

/**
 * Plain-English copy shown to the user.
 *
 * Codes 2 and 14 describe OPPOSITE conditions — `NotActive` means the event has
 * already been cancelled, `EventNotCancelled` means it is still active — so the
 * two messages must never be interchangeable.
 */
const CONTRACT_ERROR_MESSAGES: Readonly<Record<ContractErrorCode, string>> = {
  [ContractErrorCode.NotFound]:
    "That event or reservation was not found on-chain.",
  [ContractErrorCode.NotActive]:
    "This event has been cancelled, so it can no longer be reserved, checked in or settled.",
  [ContractErrorCode.AlreadyReserved]:
    "You already hold a reservation for this event.",
  [ContractErrorCode.EventFull]:
    "The last seat was taken while your transaction was being sent. No bond was taken, though a signed transaction may still have paid a network fee.",
  [ContractErrorCode.NotLocked]:
    "This bond has already been released — it was checked in, cancelled, refunded or settled.",
  [ContractErrorCode.CheckInNotOpen]:
    "Check-in has not opened yet for this event.",
  [ContractErrorCode.CheckInWindowClosed]:
    "The check-in window for this event has closed.",
  [ContractErrorCode.CancellationDeadlinePassed]:
    "The cancellation window has closed, so this reservation can no longer be cancelled.",
  [ContractErrorCode.SettlementTooEarly]:
    "This reservation cannot be settled until the check-in deadline has passed.",
  [ContractErrorCode.InvalidBasisPoints]:
    "The organizer and community shares must add up to exactly 100%.",
  [ContractErrorCode.InvalidSchedule]:
    "The schedule is out of order: the cancellation deadline, check-in window and start time do not line up.",
  [ContractErrorCode.InvalidAmount]:
    "The bond amount, capacity, title or venue is outside the range the contract accepts.",
  [ContractErrorCode.Overflow]:
    "The amounts in this request are too large for the contract to handle.",
  [ContractErrorCode.EventNotCancelled]:
    "This event is still active, so there is no cancelled-event refund to claim.",
};

/** Type guard for a number that is one of the contract's declared codes. */
export function isContractErrorCode(code: number): code is ContractErrorCode {
  return Object.prototype.hasOwnProperty.call(CONTRACT_ERROR_MESSAGES, code);
}

/** The machine-readable name for a code, or `"Unknown"` for anything else. */
export function contractErrorName(code: number): string {
  return isContractErrorCode(code) ? CONTRACT_ERROR_NAMES[code] : "Unknown";
}

/** User-facing copy for a code. Unknown codes still produce something readable. */
export function contractErrorMessage(code: number): string {
  if (isContractErrorCode(code)) {
    return CONTRACT_ERROR_MESSAGES[code];
  }
  return `The contract rejected this call with error code ${code}.`;
}

type ErrorLike = {
  name?: unknown;
  kind?: unknown;
  code?: unknown;
  userMessage?: unknown;
  hash?: unknown;
  transactionHash?: unknown;
  cause?: unknown;
  sendTransactionResponse?: { hash?: unknown };
};

/** User-safe recovery copy for failures crossing an SDK or network boundary. */
export function userFacingError(
  error: unknown,
  fallback = "The request could not be completed. Please try again.",
): string {
  if (!error || typeof error !== "object") return fallback;
  const value = error as ErrorLike;

  if (value.name === "ContractError" && typeof value.code === "number") {
    return contractErrorMessage(value.code);
  }
  if (value.name === "AnchorError" && typeof value.userMessage === "string") {
    return value.userMessage;
  }

  switch (value.kind) {
    case "rejected":
    case "user_rejected":
      return "You declined the signature. Nothing was changed on-chain.";
    case "wrong_network":
      return "Your wallet is not on Stellar Testnet. Switch networks and try again.";
    case "no_wallet":
      return "Freighter is not available. Install or unlock it, then try again.";
    case "mobile_wallet_unconfigured":
      return "Mobile wallet connection is not configured for this deployment.";
    case "not_connected":
      return "Your wallet disconnected. Reconnect and try again.";
    case "account_changed":
      return "Your wallet is using a different account. Reconnect the intended account and try again.";
    case "restore_required":
      return "This on-chain record needs restoration before it can be used. Refresh and try again.";
    case "timeout":
      return "Stellar is taking longer than expected. Check the transaction link before retrying.";
    case "simulation_error":
      return "The contract rejected the request before signature. Refresh the latest state and try again.";
    case "submission_error":
    case "ledger_failure":
      return "Stellar could not confirm this transaction. Check its status before retrying.";
    default:
      return fallback;
  }
}

const TRANSACTION_HASH = /^[0-9a-f]{64}$/i;

/** Recover only a validated public transaction hash from a structured error. */
export function transactionHashFromError(error: unknown): string | undefined {
  let current: unknown = error;
  const seen = new Set<unknown>();

  for (let depth = 0; depth < 4; depth += 1) {
    if (!current || typeof current !== "object" || seen.has(current)) break;
    seen.add(current);
    const value = current as ErrorLike;
    const candidates = [
      value.hash,
      value.transactionHash,
      value.sendTransactionResponse?.hash,
    ];
    const hash = candidates.find(
      (candidate): candidate is string =>
        typeof candidate === "string" && TRANSACTION_HASH.test(candidate),
    );
    if (hash) return hash.toLowerCase();
    current = value.cause;
  }

  return undefined;
}

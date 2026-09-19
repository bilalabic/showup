/**
 * The single result union every network operation maps onto.
 *
 * Each RPC/submission failure mode gets its own variant so the UI can say
 * something useful (SYSTEM.md sections 16 and 17). A raw RPC string is never
 * the only feedback.
 */

import { AssembledTransaction } from "@stellar/stellar-sdk/contract";

import { extractContractErrorCode } from "./contract-error-code";

export type TxFailure =
  /** Rejected during simulation, before the user was ever asked to sign. */
  | { kind: "simulation_error"; message: string; contractErrorCode?: number }
  /** Archived ledger entries must be restored before this call can run. */
  | { kind: "restore_required"; message: string }
  /** The user declined the signature in their wallet. Nothing was spent. */
  | { kind: "user_rejected"; message: string }
  /** The network refused the transaction at submission time. */
  | { kind: "submission_error"; message: string; hash?: string }
  /** The transaction reached a ledger and failed there. */
  | { kind: "ledger_failure"; message: string; hash?: string; contractErrorCode?: number }
  /** Still pending when polling gave up. The hash may still land. */
  | { kind: "timeout"; message: string; hash?: string };

export type TxResult<T> =
  | { ok: true; value: T; hash: string }
  | { ok: false; failure: TxFailure };

/** Narrow an unknown value to a {@link TxFailure}. */
export function isTxFailure(value: unknown): value is TxFailure {
  if (!value || typeof value !== "object" || !("kind" in value)) {
    return false;
  }

  return [
    "simulation_error",
    "restore_required",
    "user_rejected",
    "submission_error",
    "ledger_failure",
    "timeout",
  ].includes(String((value as { kind: unknown }).kind));
}

function isInstanceOf(value: unknown, ctor: unknown): boolean {
  return typeof ctor === "function" && value instanceof (ctor as never);
}

/**
 * Map a thrown value onto a {@link TxFailure}.
 *
 * The SDK's own error classes are matched by identity where they exist; the
 * contract error code, when present, is always recovered numerically.
 */
export function classifyTxError(error: unknown, hash?: string): TxFailure {
  const message = error instanceof Error ? error.message : String(error);
  const contractErrorCode = extractContractErrorCode(error) ?? undefined;
  const sdkErrors = AssembledTransaction.Errors;

  if (isInstanceOf(error, sdkErrors.UserRejected)) {
    return { kind: "user_rejected", message };
  }

  if (
    isInstanceOf(error, sdkErrors.ExpiredState) ||
    isInstanceOf(error, sdkErrors.RestorationFailure)
  ) {
    return { kind: "restore_required", message };
  }

  if (isInstanceOf(error, sdkErrors.SimulationFailed)) {
    return { kind: "simulation_error", message, contractErrorCode };
  }

  const name = error instanceof Error ? error.constructor.name : "";

  if (name === "TransactionStillPendingError") {
    return { kind: "timeout", message, hash };
  }

  if (name === "SendFailedError" || name === "SendResultOnlyError") {
    return { kind: "submission_error", message, hash };
  }

  if (contractErrorCode !== undefined) {
    return { kind: "ledger_failure", message, hash, contractErrorCode };
  }

  return { kind: "submission_error", message, hash };
}

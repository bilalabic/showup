/**
 * Contract errors, mapped BY CODE.
 *
 * `lib/contract` may surface a contract error but never pre-judges a financial
 * rule the contract owns. Codes are public ABI and are never renumbered; error
 * message strings are not, so nothing here matches on them.
 */

import {
  contractErrorMessage,
  contractErrorName,
} from "../domain/errors";
import { extractContractErrorCode } from "../stellar/contract-error-code";

/** A rejection the ShowUp contract returned, carrying its stable numeric code. */
export class ContractError extends Error {
  /** The `#[contracterror]` discriminant, 1..14. */
  readonly code: number;

  /** The machine-readable variant name, for logs and debug panels. */
  readonly reason: string;

  constructor(code: number, options?: { cause?: unknown }) {
    super(contractErrorMessage(code), options);
    this.name = "ContractError";
    this.code = code;
    this.reason = contractErrorName(code);
  }
}

/**
 * Build a {@link ContractError} from anything the SDK threw, or `null` when the
 * value carries no contract error code.
 */
export function contractErrorFrom(value: unknown): ContractError | null {
  if (value instanceof ContractError) {
    return value;
  }

  const code = extractContractErrorCode(value);
  return code === null ? null : new ContractError(code, { cause: value });
}

/**
 * Replace a raw SDK error with a {@link ContractError} when one applies,
 * otherwise pass the original value through untouched.
 */
export function translateContractError(value: unknown): unknown {
  return contractErrorFrom(value) ?? value;
}

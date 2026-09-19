/**
 * Recovering a contract error CODE from an SDK error.
 *
 * Kept in its own dependency-free module so that error mapping can be imported
 * and unit-tested without pulling in the Stellar SDK or touching the network.
 */

/**
 * The literal encoding the Stellar SDK uses for a contract error code.
 *
 * Matching this recovers the NUMBER. The human-readable name the SDK prints
 * alongside it is never matched on: codes are public ABI, messages are not.
 */
export const CONTRACT_ERROR_PATTERN = /Error\(Contract,\s*#(\d+)\)/;

function stringify(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Error) return `${value.message}\n${value.stack ?? ""}`;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

/**
 * Recover the contract error code from anything the SDK throws or reports.
 *
 * Returns `null` when the value carries no contract error code — a network
 * error, a wallet error, or a host error that is not a `#[contracterror]`.
 */
export function extractContractErrorCode(value: unknown): number | null {
  const match = CONTRACT_ERROR_PATTERN.exec(stringify(value));
  if (!match) return null;

  const code = Number.parseInt(match[1], 10);
  return Number.isInteger(code) ? code : null;
}

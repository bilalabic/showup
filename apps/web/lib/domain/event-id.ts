/**
 * Event ids are `u64` on the contract. A route parameter is a string a user can
 * type, so it needs both a parse and a range check before it becomes a bigint
 * the contract facade will accept.
 *
 * This lives here, rather than being re-declared per route, because every page
 * that takes an `[id]` needs exactly the same rule and they must not drift.
 */

/** The largest value the contract's `u64` event id can hold. */
export const MAX_EVENT_ID = (1n << 64n) - 1n;

/**
 * Parse a route parameter into an event id.
 *
 * Returns `null` for anything the contract could never have issued — a
 * non-numeric string, zero or a negative value, or a number past `u64`. Callers
 * render their "no such event" state for `null` rather than sending the value
 * on to a contract read that would fail with a raw error.
 */
export function parseEventId(raw: string): bigint | null {
  // Digits only, deliberately stricter than `BigInt`, which would accept
  // surrounding whitespace, a leading sign, and `0x`/`0o`/`0b` literals. A
  // route parameter that is not a plain decimal id is not an id.
  if (!/^\d+$/.test(raw)) return null;

  let parsed: bigint;

  try {
    parsed = BigInt(raw);
  } catch {
    return null;
  }

  return parsed > 0n && parsed <= MAX_EVENT_ID ? parsed : null;
}

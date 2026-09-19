/**
 * 7-decimal amount arithmetic, shared with the contract.
 *
 * Every function here uses integer (`bigint`) math only. A financial value is
 * NEVER parsed through `Number` or `parseFloat`: IEEE-754 doubles cannot
 * represent 7-decimal stroop amounts exactly, and the resulting drift between
 * the UI estimate and the contract result is the failure mode this module
 * exists to prevent.
 */

/** Decimal places of the settlement asset (Mock USDC, a classic Stellar asset). */
export const AMOUNT_DECIMALS = 7;

/** One whole display unit expressed in stroops. */
export const ONE_UNIT_IN_STROOPS = 10_000_000n;

/** Total basis points. The contract requires the two legs to sum to this. */
export const TOTAL_BPS = 10_000;

const DISPLAY_AMOUNT_PATTERN = /^[+-]?(?:\d+)(?:\.\d+)?$/;

/**
 * Parse a display amount string (for example `"12.5"`) into integer stroops.
 *
 * Throws on anything that is not an exact decimal literal, and on more than
 * {@link AMOUNT_DECIMALS} fractional digits, because silently truncating a
 * financial value is worse than refusing it.
 */
export function toStroops(display: string): bigint {
  if (typeof display !== "string") {
    throw new TypeError("Amount must be a string.");
  }

  const trimmed = display.trim();
  if (trimmed.length === 0) {
    throw new RangeError("Amount is empty.");
  }
  if (!DISPLAY_AMOUNT_PATTERN.test(trimmed)) {
    throw new RangeError(`Amount "${display}" is not a valid decimal number.`);
  }

  const negative = trimmed.startsWith("-");
  const unsigned =
    trimmed.startsWith("-") || trimmed.startsWith("+")
      ? trimmed.slice(1)
      : trimmed;

  const dotIndex = unsigned.indexOf(".");
  const wholePart = dotIndex === -1 ? unsigned : unsigned.slice(0, dotIndex);
  const fractionPart = dotIndex === -1 ? "" : unsigned.slice(dotIndex + 1);

  if (fractionPart.length > AMOUNT_DECIMALS) {
    throw new RangeError(
      `Amount "${display}" has more than ${AMOUNT_DECIMALS} decimal places.`,
    );
  }

  const paddedFraction = fractionPart.padEnd(AMOUNT_DECIMALS, "0");
  const magnitude =
    BigInt(wholePart) * ONE_UNIT_IN_STROOPS + BigInt(paddedFraction);

  return negative ? -magnitude : magnitude;
}

/**
 * Format integer stroops back into a display string. Trailing fractional zeros
 * are dropped, so `fromStroops(toStroops(x))` is a stable round trip for any
 * string this module accepts.
 */
export function fromStroops(v: bigint): string {
  if (typeof v !== "bigint") {
    throw new TypeError("Stroop amounts must be bigint.");
  }

  const negative = v < 0n;
  const magnitude = negative ? -v : v;

  const wholePart = magnitude / ONE_UNIT_IN_STROOPS;
  const fractionPart = magnitude % ONE_UNIT_IN_STROOPS;

  const fractionDigits = fractionPart
    .toString()
    .padStart(AMOUNT_DECIMALS, "0")
    .replace(/0+$/, "");

  const body =
    fractionDigits.length === 0
      ? wholePart.toString()
      : `${wholePart.toString()}.${fractionDigits}`;

  return negative ? `-${body}` : body;
}

/**
 * Split an amount by basis points exactly the way `settle_no_show` does.
 *
 * The organizer leg is `amount * organizerBps / 10_000` with truncating integer
 * division; the community leg is the REMAINDER, derived by subtraction. Using a
 * second multiply-divide instead would strand dust in the contract, so the two
 * legs are guaranteed here to sum to exactly `amount`.
 */
export function splitByBps(
  amount: bigint,
  organizerBps: number,
): { organizer: bigint; community: bigint } {
  if (typeof amount !== "bigint") {
    throw new TypeError("Amount must be bigint.");
  }
  if (!Number.isInteger(organizerBps)) {
    throw new RangeError("Basis points must be an integer.");
  }
  if (organizerBps < 0 || organizerBps > TOTAL_BPS) {
    throw new RangeError(`Basis points must be between 0 and ${TOTAL_BPS}.`);
  }

  const organizer =
    (amount * BigInt(organizerBps)) / BigInt(TOTAL_BPS);
  const community = amount - organizer;

  return { organizer, community };
}

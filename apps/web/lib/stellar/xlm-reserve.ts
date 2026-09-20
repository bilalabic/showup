export type XlmReserveInput = {
  balance: bigint;
  baseReserve: bigint;
  subentryCount: number;
  numSponsoring: number;
  numSponsored: number;
  sellingLiabilities: bigint;
};

export type XlmReservePosition = {
  minimumBalance: bigint;
  reserveEntryCount: number;
  reserveShortfall: bigint;
  spendable: bigint;
};

function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer.`);
  }
}

/**
 * Calculate the native balance an account may actually spend.
 *
 * Stellar's minimum balance is
 * `(2 + subentries + sponsoring - sponsored) * base reserve`. Native selling
 * liabilities are unavailable as well. Values stay in stroops throughout so
 * the precheck cannot lose precision through floating-point conversion.
 */
export function calculateXlmReservePosition(
  input: XlmReserveInput,
): XlmReservePosition {
  if (input.balance < 0n) throw new Error("balance must not be negative.");
  if (input.baseReserve < 0n) {
    throw new Error("baseReserve must not be negative.");
  }
  if (input.sellingLiabilities < 0n) {
    throw new Error("sellingLiabilities must not be negative.");
  }

  assertNonNegativeInteger(input.subentryCount, "subentryCount");
  assertNonNegativeInteger(input.numSponsoring, "numSponsoring");
  assertNonNegativeInteger(input.numSponsored, "numSponsored");

  const reserveEntryCount =
    2 + input.subentryCount + input.numSponsoring - input.numSponsored;
  if (reserveEntryCount < 0) {
    throw new Error("Sponsorship data produced a negative reserve entry count.");
  }

  const minimumBalance = input.baseReserve * BigInt(reserveEntryCount);
  const unavailable = minimumBalance + input.sellingLiabilities;

  return {
    minimumBalance,
    reserveEntryCount,
    reserveShortfall:
      unavailable > input.balance ? unavailable - input.balance : 0n,
    spendable: input.balance > unavailable ? input.balance - unavailable : 0n,
  };
}

/** Exact XLM headroom needed to add one account subentry and pay its fee. */
export function requiredForNewSubentry(
  baseReserve: bigint,
  transactionFee: bigint,
): bigint {
  if (baseReserve < 0n || transactionFee < 0n) {
    throw new Error("Reserve and fee must not be negative.");
  }
  return baseReserve + transactionFee;
}

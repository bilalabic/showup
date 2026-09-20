import { describe, expect, it } from "vitest";

import {
  calculateXlmReservePosition,
  requiredForNewSubentry,
} from "./xlm-reserve";

describe("calculateXlmReservePosition", () => {
  it("reserves two base units for an otherwise empty account", () => {
    expect(
      calculateXlmReservePosition({
        balance: 100_000_000n,
        baseReserve: 5_000_000n,
        subentryCount: 0,
        numSponsoring: 0,
        numSponsored: 0,
        sellingLiabilities: 0n,
      }),
    ).toEqual({
      minimumBalance: 10_000_000n,
      reserveEntryCount: 2,
      reserveShortfall: 0n,
      spendable: 90_000_000n,
    });
  });

  it("includes subentries, sponsorships and native selling liabilities", () => {
    expect(
      calculateXlmReservePosition({
        balance: 50_000_000n,
        baseReserve: 5_000_000n,
        subentryCount: 3,
        numSponsoring: 2,
        numSponsored: 1,
        sellingLiabilities: 4_000_000n,
      }),
    ).toEqual({
      minimumBalance: 30_000_000n,
      reserveEntryCount: 6,
      reserveShortfall: 0n,
      spendable: 16_000_000n,
    });
  });

  it("clamps spendable XLM at zero and reports the shortfall", () => {
    expect(
      calculateXlmReservePosition({
        balance: 9_000_000n,
        baseReserve: 5_000_000n,
        subentryCount: 0,
        numSponsoring: 0,
        numSponsored: 0,
        sellingLiabilities: 500_000n,
      }),
    ).toMatchObject({ spendable: 0n, reserveShortfall: 1_500_000n });
  });

  it("rejects impossible sponsorship counts", () => {
    expect(() =>
      calculateXlmReservePosition({
        balance: 0n,
        baseReserve: 5_000_000n,
        subentryCount: 0,
        numSponsoring: 0,
        numSponsored: 3,
        sellingLiabilities: 0n,
      }),
    ).toThrow("negative reserve entry count");
  });
});

describe("requiredForNewSubentry", () => {
  it("adds one current base reserve and the transaction fee", () => {
    expect(requiredForNewSubentry(5_000_000n, 100n)).toBe(5_000_100n);
  });
});

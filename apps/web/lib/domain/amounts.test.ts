import { describe, expect, it } from "vitest";

import {
  ONE_UNIT_IN_STROOPS,
  fromStroops,
  splitByBps,
  toStroops,
} from "./amounts";

describe("toStroops", () => {
  it("converts whole units", () => {
    expect(toStroops("1")).toBe(ONE_UNIT_IN_STROOPS);
    expect(toStroops("0")).toBe(0n);
    expect(toStroops("25")).toBe(250_000_000n);
  });

  it("pads fractional digits to seven places", () => {
    expect(toStroops("0.5")).toBe(5_000_000n);
    expect(toStroops("1.2345678")).toBe(12_345_678n);
    expect(toStroops("0.0000001")).toBe(1n);
  });

  it("accepts a leading sign and surrounding whitespace", () => {
    expect(toStroops("  12.5  ")).toBe(125_000_000n);
    expect(toStroops("-1")).toBe(-ONE_UNIT_IN_STROOPS);
    expect(toStroops("+1")).toBe(ONE_UNIT_IN_STROOPS);
  });

  it("keeps full precision on a value a double cannot represent", () => {
    expect(toStroops("9007199254740993.0000001")).toBe(
      90_071_992_547_409_930_000_001n,
    );
  });

  it("rejects malformed input", () => {
    expect(() => toStroops("")).toThrow();
    expect(() => toStroops("   ")).toThrow();
    expect(() => toStroops("abc")).toThrow();
    expect(() => toStroops("1.2.3")).toThrow();
    expect(() => toStroops("1e7")).toThrow();
    expect(() => toStroops("1,5")).toThrow();
    expect(() => toStroops(".5")).toThrow();
    expect(() => toStroops("1.")).toThrow();
  });

  it("rejects more than seven decimal places rather than truncating", () => {
    expect(() => toStroops("0.00000001")).toThrow();
  });
});

describe("fromStroops", () => {
  it("formats whole and fractional values", () => {
    expect(fromStroops(0n)).toBe("0");
    expect(fromStroops(ONE_UNIT_IN_STROOPS)).toBe("1");
    expect(fromStroops(5_000_000n)).toBe("0.5");
    expect(fromStroops(1n)).toBe("0.0000001");
    expect(fromStroops(-125_000_000n)).toBe("-12.5");
  });

  it("rejects non-bigint input", () => {
    // @ts-expect-error deliberately wrong type
    expect(() => fromStroops(1)).toThrow();
  });
});

describe("amount round-trips", () => {
  const cases = [
    "0",
    "1",
    "0.5",
    "12.5",
    "25.0000001",
    "0.0000001",
    "-3.14",
    "9007199254740993.0000001",
  ];

  for (const display of cases) {
    it(`round-trips ${display}`, () => {
      const stroops = toStroops(display);
      expect(toStroops(fromStroops(stroops))).toBe(stroops);
    });
  }

  const stroopCases = [0n, 1n, 9_999_999n, 10_000_000n, -1n, 123_456_789n];

  for (const stroops of stroopCases) {
    it(`round-trips ${stroops} stroops`, () => {
      expect(toStroops(fromStroops(stroops))).toBe(stroops);
    });
  }
});

describe("splitByBps", () => {
  it("splits an even amount", () => {
    expect(splitByBps(100_000_000n, 7_000)).toEqual({
      organizer: 70_000_000n,
      community: 30_000_000n,
    });
  });

  it("sums to exactly the input for an odd amount", () => {
    const amount = 3n;
    const { organizer, community } = splitByBps(amount, 7_000);
    expect(organizer).toBe(2n);
    expect(community).toBe(1n);
    expect(organizer + community).toBe(amount);
  });

  it("derives the community leg by subtraction so no dust is stranded", () => {
    for (const amount of [1n, 3n, 7n, 9_999_999n, 12_345_679n, 1_000_000_001n]) {
      for (const bps of [0, 1, 3_333, 5_000, 7_000, 9_999, 10_000]) {
        const { organizer, community } = splitByBps(amount, bps);
        expect(organizer + community).toBe(amount);
      }
    }
  });

  it("gives everything to one leg at the extremes", () => {
    expect(splitByBps(1_000n, 10_000)).toEqual({
      organizer: 1_000n,
      community: 0n,
    });
    expect(splitByBps(1_000n, 0)).toEqual({
      organizer: 0n,
      community: 1_000n,
    });
  });

  it("rejects basis points outside 0..10000", () => {
    expect(() => splitByBps(1n, -1)).toThrow();
    expect(() => splitByBps(1n, 10_001)).toThrow();
    expect(() => splitByBps(1n, 1.5)).toThrow();
  });
});

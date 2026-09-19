import { describe, expect, it } from "vitest";

import {
  MAX_PASS_BYTES,
  QrPayloadError,
  decodePass,
  encodePass,
  isPassStale,
} from "./payload";

const PARTICIPANT = `G${"A".repeat(55)}`;

describe("reservation pass payload", () => {
  it("round-trips the canonical compact JSON shape", () => {
    const encoded = encodePass({
      eventId: 3n,
      participant: PARTICIPANT,
      issuedAt: 1_700_000_000,
    });

    expect(encoded).toBe(
      `{"v":1,"eventId":3,"participant":"${PARTICIPANT}","issuedAt":1700000000}`,
    );
    expect(decodePass(encoded)).toEqual({
      v: 1,
      eventId: 3n,
      participant: PARTICIPANT,
      issuedAt: 1_700_000_000,
    });
  });

  it.each(["", "null", "[]", "1", "{}", "not-json"])(
    "rejects malformed or non-object input: %s",
    (raw) => {
      expect(() => decodePass(raw)).toThrow(QrPayloadError);
    },
  );

  it.each([
    { v: 2, eventId: 3, participant: PARTICIPANT, issuedAt: 1 },
    { v: 1, eventId: 0, participant: PARTICIPANT, issuedAt: 1 },
    { v: 1, eventId: -1, participant: PARTICIPANT, issuedAt: 1 },
    { v: 1, eventId: 1.5, participant: PARTICIPANT, issuedAt: 1 },
    { v: 1, eventId: Number.MAX_SAFE_INTEGER + 1, participant: PARTICIPANT, issuedAt: 1 },
    { v: 1, eventId: 3, participant: "GBAD", issuedAt: 1 },
    { v: 1, eventId: 3, participant: PARTICIPANT, issuedAt: -1 },
    { v: 1, eventId: 3, participant: PARTICIPANT, issuedAt: 1.5 },
    { v: 1, eventId: 3, participant: PARTICIPANT, issuedAt: 1, extra: true },
    JSON.parse(
      `{"v":1,"eventId":3,"participant":"${PARTICIPANT}","issuedAt":1,"__proto__":{"polluted":true}}`,
    ),
  ])("rejects an invalid schema", (value) => {
    expect(() => decodePass(JSON.stringify(value))).toThrow(QrPayloadError);
  });

  it("rejects oversized ASCII and UTF-8 payloads", () => {
    expect(() => decodePass("a".repeat(MAX_PASS_BYTES + 1))).toThrow(
      /too large/i,
    );
    expect(() => decodePass("é".repeat(MAX_PASS_BYTES))).toThrow(/too large/i);
  });

  it("keeps freshness as a non-authoritative hint", () => {
    const pass = decodePass(
      encodePass({ eventId: 3n, participant: PARTICIPANT, issuedAt: 100 }),
    );

    expect(isPassStale(pass, 400)).toBe(false);
    expect(isPassStale(pass, 401)).toBe(true);
    expect(isPassStale(pass, 99)).toBe(true);
  });

  it("rejects event ids that bigint cannot represent safely in JSON", () => {
    expect(() =>
      encodePass({
        eventId: BigInt(Number.MAX_SAFE_INTEGER) + 1n,
        participant: PARTICIPANT,
        issuedAt: 1,
      }),
    ).toThrow(QrPayloadError);
  });
});

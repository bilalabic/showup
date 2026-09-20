import { describe, expect, it } from "vitest";

import { MAX_EVENT_ID, parseEventId } from "./event-id";

describe("parseEventId", () => {
  it("accepts an ordinary event id", () => {
    expect(parseEventId("4")).toBe(4n);
  });

  it("accepts the largest id the contract can hold", () => {
    expect(parseEventId(MAX_EVENT_ID.toString())).toBe(MAX_EVENT_ID);
  });

  it("rejects one past the u64 ceiling", () => {
    expect(parseEventId((MAX_EVENT_ID + 1n).toString())).toBeNull();
  });

  // Ids start at 1: `create_event` increments the counter before writing, so
  // zero is never issued and a negative can only come from a hand-typed URL.
  it("rejects zero and negatives", () => {
    expect(parseEventId("0")).toBeNull();
    expect(parseEventId("-1")).toBeNull();
  });

  it("rejects anything that is not a plain decimal integer", () => {
    expect(parseEventId("")).toBeNull();
    expect(parseEventId("abc")).toBeNull();
    expect(parseEventId("1.5")).toBeNull();
    expect(parseEventId("1e3")).toBeNull();
  });

  // `BigInt` would happily accept all of these. A route parameter that is not a
  // plain decimal id is not an id, so the helper is stricter on purpose.
  it("rejects the forms BigInt would otherwise coerce", () => {
    expect(parseEventId(" 4 ")).toBeNull();
    expect(parseEventId("+4")).toBeNull();
    expect(parseEventId("0x4")).toBeNull();
    expect(parseEventId("0b100")).toBeNull();
  });
});

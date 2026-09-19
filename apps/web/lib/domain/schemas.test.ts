import { describe, expect, it } from "vitest";

import {
  MAX_TITLE_LENGTH,
  MAX_VENUE_LENGTH,
  createEventFormSchema,
  createEventInputSchema,
  utf8ByteLength,
} from "./schemas";
import type { CreateEventInput } from "./types";

const ORGANIZER = "GDCXH26TJFRMADSZKVLNB4EWNV2ORZHNEGDMH3D5UHPX25EW5REJOKP7";

function makeInput(overrides: Partial<CreateEventInput> = {}): CreateEventInput {
  return {
    organizer: ORGANIZER,
    title: "Stellar Istanbul Meetup",
    venue: "Kolektif House, Levent",
    bondAmount: 250_000_000n,
    capacity: 20,
    cancellationDeadline: 1_000,
    checkinStart: 2_000,
    startTime: 2_500,
    checkinDeadline: 3_000,
    organizerBps: 7_000,
    communityBps: 3_000,
    ...overrides,
  };
}

function firstMessage(input: CreateEventInput): string {
  const result = createEventInputSchema.safeParse(input);
  expect(result.success).toBe(false);
  return result.success ? "" : result.error.issues[0].message;
}

describe("createEventInputSchema", () => {
  it("accepts a well-formed event", () => {
    expect(createEventInputSchema.safeParse(makeInput()).success).toBe(true);
  });

  it("accepts the boundary schedule where every timestamp is equal", () => {
    const input = makeInput({
      cancellationDeadline: 2_000,
      checkinStart: 2_000,
      startTime: 2_000,
      checkinDeadline: 2_000,
    });
    expect(createEventInputSchema.safeParse(input).success).toBe(true);
  });

  it("rejects a zero or negative bond", () => {
    expect(firstMessage(makeInput({ bondAmount: 0n }))).toMatch(/greater than zero/);
    expect(firstMessage(makeInput({ bondAmount: -1n }))).toMatch(/greater than zero/);
  });

  it("rejects a zero or negative capacity", () => {
    expect(firstMessage(makeInput({ capacity: 0 }))).toMatch(/greater than zero/);
    expect(firstMessage(makeInput({ capacity: -5 }))).toMatch(/greater than zero/);
  });

  it("rejects a basis-point split that does not total 10000", () => {
    expect(
      firstMessage(makeInput({ organizerBps: 7_000, communityBps: 2_999 })),
    ).toMatch(/10000 bps/);
    expect(
      firstMessage(makeInput({ organizerBps: 7_000, communityBps: 3_001 })),
    ).toMatch(/10000 bps/);
  });

  it("accepts every split that does total 10000", () => {
    for (const organizerBps of [0, 1, 5_000, 9_999, 10_000]) {
      const input = makeInput({
        organizerBps,
        communityBps: 10_000 - organizerBps,
      });
      expect(createEventInputSchema.safeParse(input).success).toBe(true);
    }
  });

  it("rejects a cancellation deadline after check-in opens", () => {
    expect(
      firstMessage(makeInput({ cancellationDeadline: 2_001 })),
    ).toMatch(/Cancellation deadline/);
  });

  it("rejects a check-in window that closes before it opens", () => {
    expect(
      firstMessage(
        makeInput({ checkinStart: 3_001, startTime: 3_001, cancellationDeadline: 0 }),
      ),
    ).toMatch(/Check-in must open before it closes/);
  });

  it("rejects a start time outside the check-in window", () => {
    expect(firstMessage(makeInput({ startTime: 1_999 }))).toMatch(
      /check-in window/,
    );
    expect(firstMessage(makeInput({ startTime: 3_001 }))).toMatch(
      /check-in window/,
    );
  });

  it("rejects an empty or over-long title", () => {
    expect(firstMessage(makeInput({ title: "   " }))).toMatch(/Title is required/);
    expect(
      firstMessage(makeInput({ title: "x".repeat(MAX_TITLE_LENGTH + 1) })),
    ).toMatch(/at most 96 bytes/);
  });

  it("accepts a title of exactly the maximum byte length", () => {
    const input = makeInput({ title: "x".repeat(MAX_TITLE_LENGTH) });
    expect(createEventInputSchema.safeParse(input).success).toBe(true);
  });

  it("measures length in UTF-8 bytes, as the contract does", () => {
    expect(utf8ByteLength("ıüğş")).toBe(8);
    const multiByteTitle = "ü".repeat(MAX_TITLE_LENGTH / 2);
    expect(utf8ByteLength(multiByteTitle)).toBe(MAX_TITLE_LENGTH);
    expect(
      createEventInputSchema.safeParse(makeInput({ title: multiByteTitle }))
        .success,
    ).toBe(true);
    expect(
      createEventInputSchema.safeParse(
        makeInput({ title: "ü".repeat(MAX_TITLE_LENGTH / 2 + 1) }),
      ).success,
    ).toBe(false);
  });

  it("rejects an empty or over-long venue", () => {
    expect(firstMessage(makeInput({ venue: "" }))).toMatch(/Venue is required/);
    expect(
      firstMessage(makeInput({ venue: "x".repeat(MAX_VENUE_LENGTH + 1) })),
    ).toMatch(/at most 160 bytes/);
  });

  it("rejects an organizer that is not a Stellar account", () => {
    expect(firstMessage(makeInput({ organizer: "not-an-address" }))).toMatch(
      /Stellar account/,
    );
  });
});

describe("createEventFormSchema", () => {
  const form = {
    organizer: ORGANIZER,
    title: "Stellar Istanbul Meetup",
    venue: "Kolektif House, Levent",
    bondAmount: "25",
    capacity: "20",
    cancellationDeadline: "2026-09-20T18:00:00.000Z",
    checkinStart: "2026-09-20T19:00:00.000Z",
    startTime: "2026-09-20T19:30:00.000Z",
    checkinDeadline: "2026-09-20T21:00:00.000Z",
    organizerBps: "7000",
    communityBps: "3000",
  };

  it("parses strings into the domain shape", () => {
    const parsed = createEventFormSchema.parse(form);
    expect(parsed.bondAmount).toBe(250_000_000n);
    expect(parsed.capacity).toBe(20);
    expect(parsed.organizerBps).toBe(7_000);
    expect(parsed.checkinStart).toBe(
      Math.floor(Date.parse(form.checkinStart) / 1000),
    );
  });

  it("rejects an amount with too many decimal places", () => {
    const result = createEventFormSchema.safeParse({
      ...form,
      bondAmount: "25.00000001",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-numeric capacity", () => {
    expect(
      createEventFormSchema.safeParse({ ...form, capacity: "twenty" }).success,
    ).toBe(false);
  });

  it("still applies the schedule rules after parsing", () => {
    const result = createEventFormSchema.safeParse({
      ...form,
      startTime: "2026-09-20T22:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });
});

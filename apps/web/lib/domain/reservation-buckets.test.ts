import { describe, expect, it } from "vitest";

import { reservationBucket } from "./reservation-buckets";
import type { EventView, ReservationView } from "./types";

function makeEvent(overrides: Partial<EventView> = {}): EventView {
  return {
    id: 1n,
    organizer: "GORGANIZER",
    verifier: "GORGANIZER",
    title: "Test event",
    venue: "Test venue",
    bondAmount: 25_000_000n,
    capacity: 20,
    reservedCount: 1,
    startTime: 2_500,
    checkinStart: 2_000,
    checkinDeadline: 3_000,
    cancellationDeadline: 1_000,
    organizerBps: 8_000,
    communityBps: 2_000,
    status: "active",
    ...overrides,
  };
}

function makeReservation(
  overrides: Partial<ReservationView> = {},
): ReservationView {
  return {
    eventId: 1n,
    participant: "GPARTICIPANT",
    amount: 25_000_000n,
    reservedAt: 500,
    status: "locked",
    ...overrides,
  };
}

describe("reservationBucket", () => {
  it("keeps a locked reservation upcoming through the inclusive deadline", () => {
    const event = makeEvent();
    const reservation = makeReservation();

    expect(reservationBucket(event, reservation, event.checkinDeadline)).toBe(
      "upcoming",
    );
    expect(
      reservationBucket(event, reservation, event.checkinDeadline + 1),
    ).toBe("no_show");
  });

  it("puts a locked reservation on a cancelled event in the cancelled group", () => {
    expect(
      reservationBucket(
        makeEvent({ status: "cancelled" }),
        makeReservation(),
        10_000,
      ),
    ).toBe("cancelled");
  });

  it.each([
    ["attended", "attended"],
    ["cancelled", "cancelled"],
    ["refunded", "cancelled"],
    ["no_show_settled", "no_show"],
  ] as const)("maps terminal status %s to %s", (status, bucket) => {
    expect(
      reservationBucket(makeEvent(), makeReservation({ status }), 0),
    ).toBe(bucket);
  });
});

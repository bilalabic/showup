import { describe, expect, it } from "vitest";

import type { EventView, ReservationView } from "./types";
import { collectReservationResults } from "./reservation-results";

function event(id: bigint): EventView {
  return {
    id,
    organizer: "G".repeat(56),
    verifier: "G".repeat(56),
    title: `Event ${id}`,
    venue: "Istanbul",
    bondAmount: 10_000_000n,
    capacity: 10,
    reservedCount: 1,
    startTime: 400,
    checkinStart: 300,
    checkinDeadline: 500,
    cancellationDeadline: 200,
    organizerBps: 8_000,
    communityBps: 2_000,
    status: "active",
  };
}

function reservation(eventId: bigint): ReservationView {
  return {
    eventId,
    participant: "P".repeat(56),
    amount: 10_000_000n,
    reservedAt: 100,
    status: "locked",
  };
}

describe("collectReservationResults", () => {
  it("keeps readable reservations when another lookup fails", () => {
    const first = event(1n);
    const second = event(2n);

    expect(
      collectReservationResults(
        [first, second],
        [
          { status: "fulfilled", value: reservation(first.id) },
          { status: "rejected", reason: new Error("temporary RPC failure") },
        ],
      ),
    ).toEqual({
      items: [{ event: first, reservation: reservation(first.id) }],
      unreadable: 1,
    });
  });

  it("does not count a successful empty lookup as unreadable", () => {
    expect(
      collectReservationResults([event(1n)], [{ status: "fulfilled", value: null }]),
    ).toEqual({ items: [], unreadable: 0 });
  });
});

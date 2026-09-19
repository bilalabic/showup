import { describe, expect, it } from "vitest";

import {
  canCancelReservation,
  canCheckIn,
  canClaimCancelledRefund,
  canReserve,
  canSettleNoShow,
} from "./eligibility";
import type { EventView, ReservationView } from "./types";

const CANCELLATION_DEADLINE = 1_000;
const CHECKIN_START = 2_000;
const START_TIME = 2_500;
const CHECKIN_DEADLINE = 3_000;

function makeEvent(overrides: Partial<EventView> = {}): EventView {
  return {
    id: 1n,
    organizer: "GORGANIZER",
    verifier: "GORGANIZER",
    title: "Test event",
    venue: "Test venue",
    bondAmount: 250_000_000n,
    capacity: 20,
    reservedCount: 0,
    startTime: START_TIME,
    checkinStart: CHECKIN_START,
    checkinDeadline: CHECKIN_DEADLINE,
    cancellationDeadline: CANCELLATION_DEADLINE,
    organizerBps: 7_000,
    communityBps: 3_000,
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
    amount: 250_000_000n,
    reservedAt: 500,
    status: "locked",
    ...overrides,
  };
}

describe("canReserve", () => {
  it("is open strictly before the check-in deadline", () => {
    const event = makeEvent();
    expect(canReserve(event, null, CHECKIN_DEADLINE - 1)).toBe(true);
    expect(canReserve(event, null, CHECKIN_DEADLINE)).toBe(false);
    expect(canReserve(event, null, CHECKIN_DEADLINE + 1)).toBe(false);
  });

  it("is closed once the event is full", () => {
    const event = makeEvent({ capacity: 2, reservedCount: 2 });
    expect(canReserve(event, null, 0)).toBe(false);
    expect(canReserve(makeEvent({ capacity: 2, reservedCount: 1 }), null, 0)).toBe(
      true,
    );
  });

  it("is closed for a participant who already holds a reservation", () => {
    expect(canReserve(makeEvent(), makeReservation(), 0)).toBe(false);
  });

  it("is closed for a cancelled event", () => {
    expect(canReserve(makeEvent({ status: "cancelled" }), null, 0)).toBe(false);
  });
});

describe("canCancelReservation", () => {
  it("is open up to and including the cancellation deadline", () => {
    const event = makeEvent();
    const reservation = makeReservation();
    expect(
      canCancelReservation(event, reservation, CANCELLATION_DEADLINE - 1),
    ).toBe(true);
    expect(canCancelReservation(event, reservation, CANCELLATION_DEADLINE)).toBe(
      true,
    );
    expect(
      canCancelReservation(event, reservation, CANCELLATION_DEADLINE + 1),
    ).toBe(false);
  });

  it("requires a locked reservation", () => {
    const event = makeEvent();
    expect(canCancelReservation(event, null, 0)).toBe(false);
    expect(
      canCancelReservation(event, makeReservation({ status: "attended" }), 0),
    ).toBe(false);
  });

  it("requires an active event", () => {
    expect(
      canCancelReservation(
        makeEvent({ status: "cancelled" }),
        makeReservation(),
        0,
      ),
    ).toBe(false);
  });
});

describe("canCheckIn", () => {
  it("is closed before the window opens", () => {
    const event = makeEvent();
    const reservation = makeReservation();
    expect(canCheckIn(event, reservation, CHECKIN_START - 1)).toBe(false);
    expect(canCheckIn(event, reservation, CHECKIN_START)).toBe(true);
    expect(canCheckIn(event, reservation, CHECKIN_START + 1)).toBe(true);
  });

  it("is open up to and including the check-in deadline", () => {
    const event = makeEvent();
    const reservation = makeReservation();
    expect(canCheckIn(event, reservation, CHECKIN_DEADLINE - 1)).toBe(true);
    expect(canCheckIn(event, reservation, CHECKIN_DEADLINE)).toBe(true);
    expect(canCheckIn(event, reservation, CHECKIN_DEADLINE + 1)).toBe(false);
  });

  it("requires a locked reservation on an active event", () => {
    expect(canCheckIn(makeEvent(), null, CHECKIN_START)).toBe(false);
    expect(
      canCheckIn(
        makeEvent(),
        makeReservation({ status: "no_show_settled" }),
        CHECKIN_START,
      ),
    ).toBe(false);
    expect(
      canCheckIn(
        makeEvent({ status: "cancelled" }),
        makeReservation(),
        CHECKIN_START,
      ),
    ).toBe(false);
  });
});

describe("canSettleNoShow", () => {
  it("opens strictly after the check-in deadline", () => {
    const event = makeEvent();
    const reservation = makeReservation();
    expect(canSettleNoShow(event, reservation, CHECKIN_DEADLINE - 1)).toBe(false);
    expect(canSettleNoShow(event, reservation, CHECKIN_DEADLINE)).toBe(false);
    expect(canSettleNoShow(event, reservation, CHECKIN_DEADLINE + 1)).toBe(true);
  });

  it("requires a locked reservation on an active event", () => {
    expect(canSettleNoShow(makeEvent(), null, CHECKIN_DEADLINE + 1)).toBe(false);
    expect(
      canSettleNoShow(
        makeEvent(),
        makeReservation({ status: "attended" }),
        CHECKIN_DEADLINE + 1,
      ),
    ).toBe(false);
    expect(
      canSettleNoShow(
        makeEvent({ status: "cancelled" }),
        makeReservation(),
        CHECKIN_DEADLINE + 1,
      ),
    ).toBe(false);
  });
});

describe("canClaimCancelledRefund", () => {
  it("requires a cancelled event and a locked reservation", () => {
    const cancelled = makeEvent({ status: "cancelled" });
    expect(canClaimCancelledRefund(cancelled, makeReservation(), 0)).toBe(true);
    expect(canClaimCancelledRefund(makeEvent(), makeReservation(), 0)).toBe(
      false,
    );
    expect(
      canClaimCancelledRefund(
        cancelled,
        makeReservation({ status: "refunded" }),
        0,
      ),
    ).toBe(false);
    expect(canClaimCancelledRefund(cancelled, null, 0)).toBe(false);
  });

  it("has no deadline, so every clock value behaves the same", () => {
    const cancelled = makeEvent({ status: "cancelled" });
    const reservation = makeReservation();
    for (const now of [0, CHECKIN_DEADLINE - 1, CHECKIN_DEADLINE, CHECKIN_DEADLINE + 1]) {
      expect(canClaimCancelledRefund(cancelled, reservation, now)).toBe(true);
    }
  });
});

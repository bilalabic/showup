/**
 * Display-side eligibility predicates.
 *
 * Every predicate takes `nowSeconds` as an explicit parameter and NEVER calls
 * `Date.now()`. The clock that matters is the ledger close time fetched from
 * RPC (`lib/stellar.getLedgerNow`); making it a parameter turns "used the wrong
 * clock" into a type-level impossibility rather than a review comment.
 *
 * These are predictions of what the contract will do, not authority. The
 * contract re-checks every one of them against `env.ledger().timestamp()`, and
 * a prediction here is allowed to be wrong.
 */

import type { EventView, ReservationView } from "./types";

/**
 * `reserve` requires: event Active, `now < checkin_deadline`,
 * `reserved_count < capacity`, and no existing reservation for the participant.
 */
export function canReserve(
  event: EventView,
  reservation: ReservationView | null,
  nowSeconds: number,
): boolean {
  return (
    event.status === "active" &&
    nowSeconds < event.checkinDeadline &&
    event.reservedCount < event.capacity &&
    reservation === null
  );
}

/**
 * `cancel_reservation` requires: reservation Locked, event Active, and
 * `now <= cancellation_deadline`.
 */
export function canCancelReservation(
  event: EventView,
  reservation: ReservationView | null,
  nowSeconds: number,
): boolean {
  return (
    reservation !== null &&
    reservation.status === "locked" &&
    event.status === "active" &&
    nowSeconds <= event.cancellationDeadline
  );
}

/**
 * `check_in` requires: reservation Locked, event Active, and
 * `checkin_start <= now <= checkin_deadline`.
 */
export function canCheckIn(
  event: EventView,
  reservation: ReservationView | null,
  nowSeconds: number,
): boolean {
  return (
    reservation !== null &&
    reservation.status === "locked" &&
    event.status === "active" &&
    nowSeconds >= event.checkinStart &&
    nowSeconds <= event.checkinDeadline
  );
}

/**
 * `settle_no_show` requires: reservation Locked, event Active, and
 * `now > checkin_deadline`. It is permissionless.
 */
export function canSettleNoShow(
  event: EventView,
  reservation: ReservationView | null,
  nowSeconds: number,
): boolean {
  return (
    reservation !== null &&
    reservation.status === "locked" &&
    event.status === "active" &&
    nowSeconds > event.checkinDeadline
  );
}

/**
 * `claim_cancelled_event_refund` requires: reservation Locked and event
 * Cancelled. It is permissionless and has no deadline — `nowSeconds` is part of
 * the signature so every predicate in this module is called the same way and no
 * caller is tempted to reach for the browser clock.
 */
export function canClaimCancelledRefund(
  event: EventView,
  reservation: ReservationView | null,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  nowSeconds: number,
): boolean {
  return (
    reservation !== null &&
    reservation.status === "locked" &&
    event.status === "cancelled"
  );
}

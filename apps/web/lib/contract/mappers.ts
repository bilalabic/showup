/**
 * Generated bindings <-> `lib/domain` conversion.
 *
 * The generated types use snake_case fields and tagged unions. Nothing above
 * this file may see them: every value crossing out of `lib/contract` is a
 * `lib/domain` view.
 */

import type {
  Config as GeneratedConfig,
  Event as GeneratedEvent,
  EventStatus as GeneratedEventStatus,
  Reservation as GeneratedReservation,
  ReservationStatus as GeneratedReservationStatus,
} from "showup-bond-client";

import type {
  ContractConfig,
  CreateEventInput,
  EventStatus,
  EventView,
  ReservationStatus,
  ReservationView,
} from "../domain";

/** u64 timestamps are Unix seconds; well inside `Number.MAX_SAFE_INTEGER`. */
function secondsToNumber(value: bigint): number {
  return Number(value);
}

function toEventStatus(status: GeneratedEventStatus): EventStatus {
  switch (status.tag) {
    case "Active":
      return "active";
    case "Cancelled":
      return "cancelled";
  }
}

function toReservationStatus(
  status: GeneratedReservationStatus,
): ReservationStatus {
  switch (status.tag) {
    case "Locked":
      return "locked";
    case "Attended":
      return "attended";
    case "Cancelled":
      return "cancelled";
    case "Refunded":
      return "refunded";
    case "NoShowSettled":
      return "no_show_settled";
  }
}

export function toEventView(event: GeneratedEvent): EventView {
  return {
    id: event.id,
    organizer: event.organizer,
    verifier: event.verifier,
    title: event.title,
    venue: event.venue,
    bondAmount: event.bond_amount,
    capacity: event.capacity,
    reservedCount: event.reserved_count,
    startTime: secondsToNumber(event.start_time),
    checkinStart: secondsToNumber(event.checkin_start),
    checkinDeadline: secondsToNumber(event.checkin_deadline),
    cancellationDeadline: secondsToNumber(event.cancellation_deadline),
    organizerBps: event.organizer_bps,
    communityBps: event.community_bps,
    status: toEventStatus(event.status),
  };
}

export function toReservationView(
  reservation: GeneratedReservation,
): ReservationView {
  return {
    eventId: reservation.event_id,
    participant: reservation.participant,
    amount: reservation.amount,
    reservedAt: secondsToNumber(reservation.reserved_at),
    status: toReservationStatus(reservation.status),
  };
}

export function toContractConfig(config: GeneratedConfig): ContractConfig {
  return {
    token: config.token,
    communityPool: config.community_pool,
  };
}

/** Arguments for the generated `create_event` binding, in its own shape. */
export function toCreateEventArgs(input: CreateEventInput) {
  return {
    organizer: input.organizer,
    title: input.title,
    venue: input.venue,
    bond_amount: input.bondAmount,
    capacity: input.capacity,
    start_time: BigInt(input.startTime),
    checkin_start: BigInt(input.checkinStart),
    checkin_deadline: BigInt(input.checkinDeadline),
    cancellation_deadline: BigInt(input.cancellationDeadline),
    organizer_bps: input.organizerBps,
    community_bps: input.communityBps,
  };
}

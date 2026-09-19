/**
 * Application-shaped views of the on-chain state model (SYSTEM.md section 6).
 *
 * These are the ONLY event/reservation shapes the rest of the app may see. The
 * generated bindings use snake_case fields and tagged unions; `lib/contract`
 * maps those onto the camelCase types below so that no generated type ever
 * escapes into feature code.
 *
 * Amounts are integer stroops (7 decimals) as `bigint`. Timestamps are Unix
 * seconds as `number`.
 */

/** Mirror of the contract's `EventStatus`. Two variants, not three. */
export type EventStatus = "active" | "cancelled";

/**
 * Mirror of the contract's `ReservationStatus`. Only `locked` is non-terminal;
 * the four terminal states are distinguished purely so the UI can explain why a
 * bond came back.
 */
export type ReservationStatus =
  | "locked"
  | "attended"
  | "cancelled"
  | "refunded"
  | "no_show_settled";

/** Application view of an `Event` stored under `Event(u64)`. */
export type EventView = {
  id: bigint;
  organizer: string;
  /** Equal to `organizer` at creation; a separate field so P1 can split roles. */
  verifier: string;
  title: string;
  venue: string;
  /** Integer stroops, 7 decimals. */
  bondAmount: bigint;
  capacity: number;
  reservedCount: number;
  /** Unix seconds. */
  startTime: number;
  /** Unix seconds. */
  checkinStart: number;
  /** Unix seconds. */
  checkinDeadline: number;
  /** Unix seconds. */
  cancellationDeadline: number;
  organizerBps: number;
  communityBps: number;
  status: EventStatus;
};

/** Application view of a `Reservation` stored under `Reservation(u64, Address)`. */
export type ReservationView = {
  eventId: bigint;
  participant: string;
  /**
   * Snapshot of the bond actually paid, in integer stroops. Settlement uses
   * this, never the event's current `bondAmount`.
   */
  amount: bigint;
  /** Unix seconds. */
  reservedAt: number;
  status: ReservationStatus;
};

/** Application view of the instance-storage `Config` written by `__constructor`. */
export type ContractConfig = {
  /** The pinned settlement token (Mock USDC SAC) address. */
  token: string;
  /** The pinned community pool address. */
  communityPool: string;
};

/**
 * Input for `create_event`, in application shape. Seconds as `number`, bond as
 * integer stroops.
 */
export type CreateEventInput = {
  organizer: string;
  title: string;
  venue: string;
  bondAmount: bigint;
  capacity: number;
  startTime: number;
  checkinStart: number;
  checkinDeadline: number;
  cancellationDeadline: number;
  organizerBps: number;
  communityBps: number;
};

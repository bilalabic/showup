import type { EventView, ReservationView } from "./types";

/** The four participant-facing groups required by the P0 reservations page. */
export type ReservationBucket =
  | "upcoming"
  | "attended"
  | "cancelled"
  | "no_show";

/**
 * Classify a reservation for display without pretending to change its on-chain
 * state. A locked reservation whose check-in window has closed is shown in the
 * no-show group as awaiting settlement; only `no_show_settled` means the split
 * has actually happened.
 */
export function reservationBucket(
  event: EventView,
  reservation: ReservationView,
  nowSeconds: number,
): ReservationBucket {
  switch (reservation.status) {
    case "attended":
      return "attended";
    case "cancelled":
    case "refunded":
      return "cancelled";
    case "no_show_settled":
      return "no_show";
    case "locked":
      if (event.status === "cancelled") {
        return "cancelled";
      }
      return nowSeconds > event.checkinDeadline ? "no_show" : "upcoming";
  }
}

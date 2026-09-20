import type { EventView, ReservationView } from "./types";

export type ReadableReservation = {
  event: EventView;
  reservation: ReservationView;
};

/** Keep readable contract records when one event lookup is temporarily unavailable. */
export function collectReservationResults(
  events: readonly EventView[],
  results: readonly PromiseSettledResult<ReservationView | null>[],
): { items: ReadableReservation[]; unreadable: number } {
  const items: ReadableReservation[] = [];
  let unreadable = 0;

  events.forEach((event, index) => {
    const result = results[index];
    if (!result || result.status === "rejected") {
      unreadable += 1;
      return;
    }
    if (result.value) items.push({ event, reservation: result.value });
  });

  return { items, unreadable };
}

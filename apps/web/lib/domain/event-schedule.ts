export type EventSchedule = {
  startTime: string;
  checkinStart: string;
  checkinDeadline: string;
  cancellationDeadline: string;
};

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

/** Format a local wall-clock value for an HTML `datetime-local` input. */
export function toLocalDateTimeValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Build a simple, valid policy around an event start:
 * cancellation closes two hours before, check-in opens 30 minutes before,
 * and check-in closes one hour after the advertised start.
 */
export function scheduleAroundStart(startTime: string): EventSchedule | null {
  const startMs = Date.parse(startTime);
  if (!Number.isFinite(startMs)) return null;

  return {
    startTime: toLocalDateTimeValue(new Date(startMs)),
    cancellationDeadline: toLocalDateTimeValue(
      new Date(startMs - 2 * HOUR_MS),
    ),
    checkinStart: toLocalDateTimeValue(new Date(startMs - 30 * MINUTE_MS)),
    checkinDeadline: toLocalDateTimeValue(new Date(startMs + HOUR_MS)),
  };
}

/**
 * Return a start close enough that `scheduleAroundStart` leaves check-in
 * already open: check-in opens 30 minutes before the start, so a start 20
 * minutes out opens the window ten minutes ago and closes it in 80 minutes.
 *
 * Every other preset here schedules a future evening, which means anyone
 * evaluating the app — or rehearsing the demo — creates an event they cannot
 * check into until the next day. The contract is untouched: this only fills the
 * form, and every deadline is still enforced against the ledger clock.
 */
export function startingSoon(nowMs: number): string {
  const stepMs = EVENT_SCHEDULE_STEP_SECONDS * 1000;
  const target = nowMs + 20 * MINUTE_MS;

  return toLocalDateTimeValue(new Date(Math.ceil(target / stepMs) * stepMs));
}

/** Return a 19:00 local start `daysAhead` calendar days from the given time. */
export function eveningStart(nowMs: number, daysAhead: number): string {
  const start = new Date(nowMs);
  start.setDate(start.getDate() + daysAhead);
  start.setHours(19, 0, 0, 0);
  return toLocalDateTimeValue(start);
}

/** Return the coming Saturday at 19:00, never the current calendar day. */
export function nextSaturdayEvening(nowMs: number): string {
  const now = new Date(nowMs);
  const daysUntilSaturday = (6 - now.getDay() + 7) % 7 || 7;
  return eveningStart(nowMs, daysUntilSaturday);
}

export const EVENT_SCHEDULE_STEP_SECONDS = 5 * 60;

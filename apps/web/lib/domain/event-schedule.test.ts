import { describe, expect, it } from "vitest";

import {
  eveningStart,
  nextSaturdayEvening,
  scheduleAroundStart,
  startingSoon,
  toLocalDateTimeValue,
} from "./event-schedule";

describe("event schedule helpers", () => {
  it("formats a local wall-clock value for datetime-local", () => {
    expect(toLocalDateTimeValue(new Date(2026, 8, 20, 9, 5))).toBe(
      "2026-09-20T09:05",
    );
  });

  it("builds a valid policy around the event start", () => {
    expect(scheduleAroundStart("2026-09-27T19:00")).toEqual({
      startTime: "2026-09-27T19:00",
      cancellationDeadline: "2026-09-27T17:00",
      checkinStart: "2026-09-27T18:30",
      checkinDeadline: "2026-09-27T20:00",
    });
  });

  it("returns null for an invalid start", () => {
    expect(scheduleAroundStart("not-a-date")).toBeNull();
  });

  /**
   * The point of this preset: the other two schedule a future evening, so an
   * event created to rehearse or evaluate the demo cannot be checked into until
   * the next day.
   */
  it("leaves the check-in window already open", () => {
    const now = new Date(2026, 8, 20, 10, 52).getTime();
    const startTime = startingSoon(now);
    const schedule = scheduleAroundStart(startTime)!;

    // 10:52 + 20 minutes is 11:12, rounded up to the five-minute step.
    expect(startTime).toBe("2026-09-20T11:15");
    expect(Date.parse(schedule.checkinStart)).toBeLessThanOrEqual(now);
    expect(Date.parse(schedule.checkinDeadline)).toBeGreaterThan(now);
  });

  it("keeps the start on the five-minute step it is already on", () => {
    const now = new Date(2026, 8, 20, 10, 55).getTime();

    expect(startingSoon(now)).toBe("2026-09-20T11:15");
  });

  it("creates local evening presets", () => {
    const sundayMorning = new Date(2026, 8, 20, 9, 15).getTime();

    expect(eveningStart(sundayMorning, 1)).toBe("2026-09-21T19:00");
    expect(nextSaturdayEvening(sundayMorning)).toBe("2026-09-26T19:00");
  });

  it("moves a Saturday preset to the following Saturday", () => {
    const saturdayMorning = new Date(2026, 8, 26, 9, 15).getTime();

    expect(nextSaturdayEvening(saturdayMorning)).toBe("2026-10-03T19:00");
  });
});

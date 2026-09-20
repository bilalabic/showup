import { describe, expect, it } from "vitest";

import {
  eveningStart,
  nextSaturdayEvening,
  scheduleAroundStart,
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

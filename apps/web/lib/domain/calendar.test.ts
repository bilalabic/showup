import { describe, expect, it } from "vitest";

import {
  buildCalendarIcs,
  buildGoogleCalendarUrl,
  calendarFilename,
  type CalendarEvent,
} from "./calendar";

const event: CalendarEvent = {
  id: "42",
  title: "Build, ship; celebrate",
  venue: "Istanbul, Türkiye",
  startTime: 1_800_000_000,
  endTime: 1_800_007_200,
  cancellationDeadline: 1_799_996_400,
  reservationUrl: "https://showup.example/reservations/42",
};

describe("calendar exports", () => {
  it("builds a prefilled UTC Google Calendar template", () => {
    const url = new URL(buildGoogleCalendarUrl(event));

    expect(url.origin + url.pathname).toBe(
      "https://calendar.google.com/calendar/render",
    );
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("text")).toBe(event.title);
    expect(url.searchParams.get("location")).toBe(event.venue);
    expect(url.searchParams.get("dates")).toBe(
      "20270115T080000Z/20270115T100000Z",
    );
    expect(url.searchParams.get("details")).toContain(event.reservationUrl);
    expect(url.searchParams.get("details")).not.toMatch(/participant|G[A-Z0-9]{55}/i);
  });

  it("generates a deterministic, escaped ICS event", () => {
    const ics = buildCalendarIcs(event, 1_700_000_000);

    expect(ics).toContain("DTSTAMP:20231114T221320Z\r\n");
    expect(ics).toContain("DTSTART:20270115T080000Z\r\n");
    expect(ics).toContain("DTEND:20270115T100000Z\r\n");
    expect(ics).toContain("SUMMARY:Build\\, ship\\; celebrate\r\n");
    expect(ics).toContain("LOCATION:Istanbul\\, Türkiye\r\n");
    expect(ics).toContain(
      "DESCRIPTION:Your ShowUp attendance reservation on Stellar Testnet.\\n",
    );
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("uses a filesystem-safe event filename", () => {
    expect(calendarFilename("42/../bad")).toBe(
      "showup-event-42----bad.ics",
    );
  });
});

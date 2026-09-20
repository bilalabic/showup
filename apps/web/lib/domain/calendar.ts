export type CalendarEvent = {
  id: string;
  title: string;
  venue: string;
  startTime: number;
  endTime: number;
  cancellationDeadline: number;
  reservationUrl: string;
};

function compactUtc(unixSeconds: number): string {
  return new Date(unixSeconds * 1000)
    .toISOString()
    .replaceAll("-", "")
    .replaceAll(":", "")
    .replace(/\.\d{3}Z$/, "Z");
}

function cancellationText(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().replace(".000Z", "Z");
}

function calendarDetails(event: CalendarEvent): string {
  return [
    "Your ShowUp attendance reservation on Stellar Testnet.",
    `Free cancellation until ${cancellationText(event.cancellationDeadline)}.`,
    `Open reservation: ${event.reservationUrl}`,
  ].join("\n");
}

function escapeIcsText(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,");
}

export function buildGoogleCalendarUrl(event: CalendarEvent): string {
  const url = new URL("https://calendar.google.com/calendar/render");
  url.search = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${compactUtc(event.startTime)}/${compactUtc(event.endTime)}`,
    location: event.venue,
    details: calendarDetails(event),
  }).toString();
  return url.toString();
}

export function buildCalendarIcs(
  event: CalendarEvent,
  generatedAt: number,
): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ShowUp//Attendance Commitment//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:showup-event-${escapeIcsText(event.id)}@showup`,
    `DTSTAMP:${compactUtc(generatedAt)}`,
    `DTSTART:${compactUtc(event.startTime)}`,
    `DTEND:${compactUtc(event.endTime)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    `LOCATION:${escapeIcsText(event.venue)}`,
    `DESCRIPTION:${escapeIcsText(calendarDetails(event))}`,
    `URL:${escapeIcsText(event.reservationUrl)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return `${lines.join("\r\n")}\r\n`;
}

export function calendarFilename(eventId: string): string {
  return `showup-event-${eventId.replaceAll(/[^0-9A-Za-z_-]/g, "-")}.ics`;
}

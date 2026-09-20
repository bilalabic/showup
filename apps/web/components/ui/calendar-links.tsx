"use client";

import { useSyncExternalStore } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import {
  buildCalendarIcs,
  buildGoogleCalendarUrl,
  calendarFilename,
  type CalendarEvent,
  type EventView,
} from "@/lib/domain";

function subscribeToBrowserReady(): () => void {
  return () => undefined;
}

function downloadIcs(event: CalendarEvent): void {
  const contents = buildCalendarIcs(event, Math.floor(Date.now() / 1000));
  const blob = new Blob([contents], { type: "text/calendar;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = calendarFilename(event.id);
  document.body.appendChild(anchor);

  try {
    anchor.click();
  } finally {
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(href), 0);
  }
}

export function CalendarLinks({
  event,
  className,
}: {
  event: EventView;
  className?: string;
}) {
  const browserReady = useSyncExternalStore(
    subscribeToBrowserReady,
    () => true,
    () => false,
  );
  const calendarEvent: CalendarEvent | null = browserReady
    ? {
        id: event.id.toString(),
        title: event.title,
        venue: event.venue,
        startTime: event.startTime,
        endTime: event.checkinDeadline,
        cancellationDeadline: event.cancellationDeadline,
        reservationUrl: new URL(
          `/reservations/${event.id.toString()}`,
          window.location.origin,
        ).toString(),
      }
    : null;

  return (
    <div
      aria-label="Add this reservation to a calendar"
      className={cn("flex flex-wrap gap-2", className)}
      role="group"
    >
      {calendarEvent ? (
        <Button asChild size="sm" variant="secondary">
          <a
            href={buildGoogleCalendarUrl(calendarEvent)}
            rel="noreferrer"
            target="_blank"
          >
            Add to Google Calendar
          </a>
        </Button>
      ) : (
        <Button disabled size="sm" type="button" variant="secondary">
          Add to Google Calendar
        </Button>
      )}
      <Button
        disabled={!calendarEvent}
        onClick={() => {
          if (!calendarEvent) return;
          try {
            downloadIcs(calendarEvent);
          } catch {
            toast.error("Could not create the calendar file.");
          }
        }}
        size="sm"
        type="button"
        variant="outline"
      >
        Download .ics
      </Button>
    </div>
  );
}

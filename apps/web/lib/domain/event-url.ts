export function buildPublicEventUrl(origin: string, eventId: string): string {
  return new URL(`/events/${encodeURIComponent(eventId)}`, origin).toString();
}

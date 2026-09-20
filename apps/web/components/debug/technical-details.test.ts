import { describe, expect, it } from "vitest";

import { eventIdFromPath } from "./technical-details";

describe("eventIdFromPath", () => {
  it.each([
    ["/events/2", 2n],
    ["/reservations/19", 19n],
    ["/organizer/events/7", 7n],
    ["/organizer/events/7/scan", 7n],
  ])("reads %s", (path, expected) => {
    expect(eventIdFromPath(path)).toBe(expected);
  });

  it.each(["/", "/wallet", "/events/nope", "/events/0"])(
    "ignores %s",
    (path) => expect(eventIdFromPath(path)).toBeNull(),
  );
});

import { describe, expect, it } from "vitest";

import { buildPublicEventUrl } from "./event-url";

describe("buildPublicEventUrl", () => {
  it("builds the canonical public event route", () => {
    expect(buildPublicEventUrl("https://showup.example", "42")).toBe(
      "https://showup.example/events/42",
    );
  });

  it("does not inherit the current route or query", () => {
    expect(
      buildPublicEventUrl("https://showup.example/organizer?mode=edit", "7"),
    ).toBe("https://showup.example/events/7");
  });
});

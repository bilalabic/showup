import { describe, expect, it } from "vitest";

import { AnchorError, contextualizeAnchorError } from "../errors";

describe("contextualizeAnchorError", () => {
  it("turns an empty generic rejection into operation-specific recovery copy", () => {
    const error = new AnchorError(
      "server_rejected",
      "The Anchor rejected this request.",
      { status: 400, endpoint: "https://anchor.example/auth" },
    );

    const contextualized = contextualizeAnchorError(error, "sign_in");

    expect(contextualized.userMessage).toMatch(/freighter sign-in/i);
    expect(contextualized.status).toBe(400);
    expect(contextualized.endpoint).toBe("https://anchor.example/auth");
  });

  it("preserves the Anchor's own explanation", () => {
    const error = new AnchorError("server_rejected", "Generic", {
      serverMessage: "Amount exceeds the current sandbox limit.",
    });

    expect(contextualizeAnchorError(error, "quote")).toBe(error);
    expect(error.userMessage).toMatch(/sandbox limit/i);
  });
});

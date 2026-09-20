import { describe, expect, it } from "vitest";

import { prefersMobileWallet } from "./platform";

describe("prefersMobileWallet", () => {
  it("uses WalletConnect for Android browsers", () => {
    expect(
      prefersMobileWallet({
        userAgent:
          "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36",
        maxTouchPoints: 5,
      }),
    ).toBe(true);
  });

  it("recognizes the Freighter in-app browser", () => {
    expect(
      prefersMobileWallet({
        userAgent: "Mozilla/5.0",
        maxTouchPoints: 0,
        freighterPlatform: "mobile",
      }),
    ).toBe(true);
  });

  it("recognizes iPadOS desktop-style user agents", () => {
    expect(
      prefersMobileWallet({
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)",
        maxTouchPoints: 5,
      }),
    ).toBe(true);
  });

  it("keeps desktop browsers on the extension path", () => {
    expect(
      prefersMobileWallet({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        maxTouchPoints: 0,
      }),
    ).toBe(false);
  });
});

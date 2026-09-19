/**
 * SEP-10 token lifetime and storage discipline.
 *
 * Two rules are enforced here:
 *  1. The JWT's lifetime is UNDOCUMENTED, so it is read from the token's own
 *     `exp` claim and never assumed.
 *  2. The token lives in memory only. `sessionStorage` and `localStorage` hold
 *     ids, never the token.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearToken,
  getCachedToken,
  hasValidToken,
  readTokenExpiry,
  readTokenSubject,
  storeToken,
} from "../token-store";
import { AnchorError } from "../errors";
import { clearDeposit, loadDeposit, saveDeposit, updateDeposit } from "../session";

const ACCOUNT = "GALBFBDQAAGLKLKCQDH7CNKKA2A7UT5APANR27FMGCNZXUTVKF2O253G";
const HOME_DOMAIN = "tr-mock-anchor.fly.dev";
const OTHER_HOME_DOMAIN = "other-anchor.example";

function base64Url(value: object): string {
  return Buffer.from(JSON.stringify(value))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** A structurally valid JWT. Only the claims matter — nothing verifies it here. */
function makeToken(claims: Record<string, unknown>): string {
  return `${base64Url({ alg: "HS256", typ: "JWT" })}.${base64Url(claims)}.sig`;
}

afterEach(() => {
  clearToken();
});

describe("readTokenExpiry", () => {
  it("reads exp from the token instead of assuming a lifetime", () => {
    expect(readTokenExpiry(makeToken({ sub: ACCOUNT, exp: 1_800_000_000 }))).toBe(
      1_800_000_000,
    );
  });

  it("reads the sub claim, which is G…, G…:memo or M…", () => {
    expect(readTokenSubject(makeToken({ sub: `${ACCOUNT}:42`, exp: 1 }))).toBe(
      `${ACCOUNT}:42`,
    );
  });

  it("refuses a token with no usable exp rather than inventing one", () => {
    expect(() => readTokenExpiry(makeToken({ sub: ACCOUNT }))).toThrowError(
      AnchorError,
    );
  });

  it("refuses a malformed token", () => {
    expect(() => readTokenExpiry("not-a-jwt")).toThrowError(AnchorError);
  });
});

describe("the in-memory token cache", () => {
  it("returns a token that is still inside its window", () => {
    const token = makeToken({ sub: ACCOUNT, exp: 1_000_000 });
    storeToken(ACCOUNT, HOME_DOMAIN, token);

    expect(getCachedToken(ACCOUNT, HOME_DOMAIN, 900_000)).toBe(token);
    expect(hasValidToken(ACCOUNT, HOME_DOMAIN, 900_000)).toBe(true);
  });

  it("drops a token inside the expiry skew, before a request can outlive it", () => {
    storeToken(
      ACCOUNT,
      HOME_DOMAIN,
      makeToken({ sub: ACCOUNT, exp: 1_000_000 }),
    );

    // 20 seconds left, less than the 30-second skew.
    expect(getCachedToken(ACCOUNT, HOME_DOMAIN, 999_980)).toBeUndefined();
    expect(hasValidToken(ACCOUNT, HOME_DOMAIN, 999_980)).toBe(false);
  });

  it("does not hand one account's token to another", () => {
    storeToken(
      ACCOUNT,
      HOME_DOMAIN,
      makeToken({ sub: ACCOUNT, exp: 1_000_000 }),
    );
    expect(
      getCachedToken("GOTHERACCOUNT", HOME_DOMAIN, 900_000),
    ).toBeUndefined();
  });

  it("does not hand one Anchor's token to another Anchor", () => {
    storeToken(
      ACCOUNT,
      HOME_DOMAIN,
      makeToken({ sub: ACCOUNT, exp: 1_000_000 }),
    );

    expect(
      getCachedToken(ACCOUNT, OTHER_HOME_DOMAIN, 900_000),
    ).toBeUndefined();
  });

  it("forgets a token on demand — disconnect, address change, or a 403", () => {
    storeToken(
      ACCOUNT,
      HOME_DOMAIN,
      makeToken({ sub: ACCOUNT, exp: 1_000_000 }),
    );
    clearToken(ACCOUNT);
    expect(getCachedToken(ACCOUNT, HOME_DOMAIN, 900_000)).toBeUndefined();
  });
});

/**
 * A minimal in-memory `Storage`. The test runner is a Node environment, so
 * `sessionStorage` is stubbed rather than pulling in a DOM implementation — the
 * behaviour under test is this module's, not the browser's.
 */
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => void map.set(key, value),
  };
}

describe("sessionStorage holds ids, never the token", () => {
  beforeEach(() => {
    vi.stubGlobal("sessionStorage", memoryStorage());
    clearDeposit();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("round-trips the deposit, quote and claimable balance ids", () => {
    saveDeposit({
      depositId: "sep_abc",
      account: ACCOUNT,
      quoteId: "quote_1",
      claimableBalanceId: "00".repeat(36),
    });

    const loaded = loadDeposit();
    expect(loaded?.depositId).toBe("sep_abc");
    expect(loaded?.quoteId).toBe("quote_1");
    expect(loaded?.claimableBalanceId).toHaveLength(72);
  });

  it("merges a claimable balance id discovered later in the flow", () => {
    saveDeposit({ depositId: "sep_abc" });
    updateDeposit({ claimableBalanceId: "11".repeat(36) });

    const loaded = loadDeposit();
    expect(loaded?.depositId).toBe("sep_abc");
    expect(loaded?.claimableBalanceId).toBe("11".repeat(36));
  });

  it("stores nothing that could be a bearer token", () => {
    saveDeposit({ depositId: "sep_abc", quoteId: "quote_1", account: ACCOUNT });

    const raw = sessionStorage.getItem("showup.anchor.deposit")!;
    expect(raw).not.toMatch(/token/i);
    expect(raw).not.toMatch(/eyJ/); // the leading bytes of a base64url JWT header
    expect(raw).not.toMatch(/bearer/i);
  });

  it("ignores a corrupted record rather than throwing on load", () => {
    sessionStorage.setItem("showup.anchor.deposit", "{ not json");
    expect(loadDeposit()).toBeUndefined();
  });

  it("ignores a record with no deposit id", () => {
    sessionStorage.setItem("showup.anchor.deposit", JSON.stringify({ quoteId: "q" }));
    expect(loadDeposit()).toBeUndefined();
  });
});

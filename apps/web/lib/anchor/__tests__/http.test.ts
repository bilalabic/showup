/**
 * HTTP failure mapping.
 *
 * The headline case: an expired or missing SEP-10 token comes back as HTTP
 * **403** with `{"type":"authentication_required"}`. `SKILL.md`'s
 * troubleshooting table says 401, and a client that only watches for 401 shows
 * a dead end where one silent re-authentication would have fixed it.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { AnchorError, isAuthenticationRequired } from "../errors";
import { anchorRequest, buildUrl } from "../http";
import { AUTH_REQUIRED_403_BODY } from "./fixtures/anchor-responses";

const URL_UNDER_TEST = "https://tr-mock-anchor.fly.dev/sep6/transaction";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubResponse(body: unknown, status: number) {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(typeof body === "string" ? body : JSON.stringify(body), {
          status,
        }),
    ),
  );
}

describe("anchorRequest failure mapping", () => {
  it("maps the live 403 body to authentication_required, with reauthenticate", async () => {
    stubResponse(AUTH_REQUIRED_403_BODY, 403);

    await expect(anchorRequest(URL_UNDER_TEST)).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof AnchorError &&
        error.kind === "authentication_required" &&
        error.status === 403 &&
        error.recovery === "reauthenticate",
    );
  });

  it("is recognised by isAuthenticationRequired, which drives the silent retry", async () => {
    stubResponse(AUTH_REQUIRED_403_BODY, 403);

    const error = await anchorRequest(URL_UNDER_TEST).catch((e: unknown) => e);
    expect(isAuthenticationRequired(error)).toBe(true);
  });

  it("does NOT treat every 4xx as an auth problem", async () => {
    stubResponse({ error: "unsupported asset_code" }, 400);

    const error = (await anchorRequest(URL_UNDER_TEST).catch(
      (e: unknown) => e,
    )) as AnchorError;

    expect(error.kind).toBe("server_rejected");
    expect(isAuthenticationRequired(error)).toBe(false);
  });

  it("does NOT treat a non-authentication 403 as an expired session", async () => {
    stubResponse({ error: "forbidden" }, 403);

    const error = (await anchorRequest(URL_UNDER_TEST).catch(
      (caught: unknown) => caught,
    )) as AnchorError;

    expect(error.kind).toBe("server_rejected");
    expect(error.serverMessage).toBe("forbidden");
    expect(isAuthenticationRequired(error)).toBe(false);
  });

  it("shows the Anchor's rejection VERBATIM, because no limit is hard-coded here", async () => {
    // /health and /sep6/info disagree about the deposit bounds, so the server's
    // own words are the only trustworthy answer.
    const serverWords = "amount 4000.00 is above the maximum of 3000.00 TRY";
    stubResponse({ error: serverWords }, 400);

    const error = (await anchorRequest(URL_UNDER_TEST).catch(
      (e: unknown) => e,
    )) as AnchorError;

    expect(error.serverMessage).toBe(serverWords);
    expect(error.userMessage).toBe(serverWords);
  });

  it("maps a network failure to unreachable — degraded, not broken", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );

    const error = (await anchorRequest(URL_UNDER_TEST).catch(
      (e: unknown) => e,
    )) as AnchorError;

    expect(error.kind).toBe("unreachable");
    expect(error.userMessage).toMatch(/temporarily unavailable/i);
    expect(error.recovery).toBe("retry");
  });

  it("maps an unparseable success body to protocol", async () => {
    stubResponse("<html>not json</html>", 200);

    const error = (await anchorRequest(URL_UNDER_TEST).catch(
      (e: unknown) => e,
    )) as AnchorError;

    expect(error.kind).toBe("protocol");
  });

  it("never puts the token in the reported endpoint", async () => {
    stubResponse({ error: "nope" }, 400);

    const error = (await anchorRequest(`${URL_UNDER_TEST}?id=sep_secret`, {
      token: "header.payload.signature",
    }).catch((e: unknown) => e)) as AnchorError;

    expect(error.endpoint).toBe(URL_UNDER_TEST);
    expect(JSON.stringify(error.endpoint)).not.toContain("payload");
  });

  it("sends the token as a Bearer header when one is supplied", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await anchorRequest(URL_UNDER_TEST, { token: "a.b.c" });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer a.b.c");
  });
});

describe("buildUrl", () => {
  it("preserves an exact discovered endpoint when no child path is requested", () => {
    expect(
      buildUrl("https://tr-mock-anchor.fly.dev/auth", "", {
        account: "GCLIENT",
      }),
    ).toBe("https://tr-mock-anchor.fly.dev/auth?account=GCLIENT");
  });

  it("drops empty and undefined parameters instead of sending them", () => {
    const url = buildUrl("https://tr-mock-anchor.fly.dev/sep6", "/deposit", {
      asset_code: "USDC",
      amount: undefined,
      quote_id: "",
      funding_method: "bank_account",
    });

    const params = new URL(url).searchParams;
    expect(params.get("asset_code")).toBe("USDC");
    expect(params.has("amount")).toBe(false);
    expect(params.has("quote_id")).toBe(false);
    // funding_method, NOT the deprecated type=.
    expect(params.get("funding_method")).toBe("bank_account");
    expect(params.has("type")).toBe(false);
  });

  it("tolerates a trailing slash on the discovered server URL", () => {
    expect(
      buildUrl("https://tr-mock-anchor.fly.dev/sep6/", "/transaction", { id: "x" }),
    ).toBe("https://tr-mock-anchor.fly.dev/sep6/transaction?id=x");
  });
});

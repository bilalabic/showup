/**
 * SEP-38 pricing, quotes and expiry.
 *
 * The rule under test is the counter-intuitive one: an expired quote is a
 * WARNING, not a failure. The Anchor falls back to the live rate rather than
 * refusing the deposit, so a client that hard-fails on expiry invents a bug
 * that does not exist.
 */

import { describe, expect, it, vi, afterEach } from "vitest";

import {
  EXPIRED_QUOTE_WARNING,
  getFirmQuote,
  getIndicativePrice,
  getIndicativePriceForBuyAmount,
  isQuoteExpired,
  parseExpiresAt,
  stellarAssetId,
} from "../sep38";
import { AnchorError } from "../errors";
import type { AnchorConfig, Quote } from "../types";
import {
  ANCHOR_HOME_DOMAIN,
  ANCHOR_SIGNING_KEY,
  QUOTE_EXPIRES_AT_SECONDS,
  SEP38_PRICE_RESPONSE,
  SEP38_QUOTE_RESPONSE,
  TESTNET_PASSPHRASE,
  USDC_ISSUER,
} from "./fixtures/anchor-responses";

const config: AnchorConfig = {
  homeDomain: ANCHOR_HOME_DOMAIN,
  networkPassphrase: TESTNET_PASSPHRASE,
  signingKey: ANCHOR_SIGNING_KEY,
  webAuthEndpoint: `https://${ANCHOR_HOME_DOMAIN}/auth`,
  transferServer: `https://${ANCHOR_HOME_DOMAIN}/sep6`,
  quoteServer: `https://${ANCHOR_HOME_DOMAIN}/sep38`,
  asset: { code: "USDC", issuer: USDC_ISSUER },
};

const quote: Quote = {
  id: SEP38_QUOTE_RESPONSE.id,
  expiresAt: QUOTE_EXPIRES_AT_SECONDS,
  sellAmount: SEP38_QUOTE_RESPONSE.sell_amount,
  buyAmount: SEP38_QUOTE_RESPONSE.buy_amount,
  price: SEP38_QUOTE_RESPONSE.price,
  totalPrice: SEP38_QUOTE_RESPONSE.total_price,
  sellAsset: "iso4217:TRY",
  buyAsset: `stellar:USDC:${USDC_ISSUER}`,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isQuoteExpired", () => {
  it("is false a second before expires_at", () => {
    expect(isQuoteExpired(quote, QUOTE_EXPIRES_AT_SECONDS - 1)).toBe(false);
  });

  it("is true exactly at expires_at", () => {
    expect(isQuoteExpired(quote, QUOTE_EXPIRES_AT_SECONDS)).toBe(true);
  });

  it("is true after expires_at", () => {
    expect(isQuoteExpired(quote, QUOTE_EXPIRES_AT_SECONDS + 1)).toBe(true);
  });

  it("warns about a rate difference rather than announcing a failure", () => {
    expect(EXPIRED_QUOTE_WARNING).toMatch(/still go through/i);
    expect(EXPIRED_QUOTE_WARNING).not.toMatch(/failed|cancelled|error/i);
  });
});

describe("parseExpiresAt", () => {
  it("converts the Anchor's ISO-8601 timestamp to Unix seconds", () => {
    expect(parseExpiresAt("2026-09-19T19:00:00.000Z")).toBe(
      Math.floor(Date.parse("2026-09-19T19:00:00.000Z") / 1000),
    );
  });

  it("treats an unreadable expiry as already expired, the safe direction", () => {
    expect(parseExpiresAt(undefined)).toBe(0);
    expect(parseExpiresAt("not a date")).toBe(0);
  });
});

describe("stellarAssetId", () => {
  it("builds the SEP-38 identifier from discovery, never a constant", () => {
    expect(stellarAssetId(config)).toBe(`stellar:USDC:${USDC_ISSUER}`);
  });
});

describe("getIndicativePrice", () => {
  it("sends NO Authorization header — /price is public", async () => {
    // `SKILL.md` shows a Bearer token here. The Anchor's own guide says /info,
    // /prices and /price are public and only POST /quote is authenticated.
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
      return new Response(JSON.stringify(SEP38_PRICE_RESPONSE), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const price = await getIndicativePrice("200", { config });

    expect(price.buyAmount).toBe("4.0792181");
    expect(price.totalPrice).toBe("49.0290039");
    expect(price.fee?.total).toBe("1.00");
  });

  it("asks for the TRY -> USDC direction with the bank_account delivery method", async () => {
    let requestedUrl = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        requestedUrl = url;
        return new Response(JSON.stringify(SEP38_PRICE_RESPONSE), { status: 200 });
      }),
    );

    await getIndicativePrice("200", { config });

    const params = new URL(requestedUrl).searchParams;
    expect(params.get("sell_asset")).toBe("iso4217:TRY");
    expect(params.get("buy_asset")).toBe(`stellar:USDC:${USDC_ISSUER}`);
    expect(params.get("sell_amount")).toBe("200");
    expect(params.get("context")).toBe("sep6");
    expect(params.get("sell_delivery_method")).toBe("bank_account");
  });

  it("passes the requested amount through unclamped", async () => {
    // The Anchor's /health and /sep6/info contradict each other about limits,
    // so this client hard-codes no bound and lets the Anchor refuse.
    let requestedUrl = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        requestedUrl = url;
        return new Response(JSON.stringify(SEP38_PRICE_RESPONSE), { status: 200 });
      }),
    );

    await getIndicativePrice("999999.99", { config });

    expect(new URL(requestedUrl).searchParams.get("sell_amount")).toBe("999999.99");
  });
});

describe("getIndicativePriceForBuyAmount", () => {
  it("requests the exact USDC bond amount without authentication", async () => {
    let requestedUrl = "";
    const buyAmountResponse = {
      ...SEP38_PRICE_RESPONSE,
      sell_amount: "605.734567890123",
      buy_amount: "12.3456789",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        requestedUrl = url;
        expect(
          (init.headers as Record<string, string>).Authorization,
        ).toBeUndefined();
        return new Response(JSON.stringify(buyAmountResponse), { status: 200 });
      }),
    );

    const price = await getIndicativePriceForBuyAmount("12.3456789", {
      config,
    });

    const params = new URL(requestedUrl).searchParams;
    expect(params.get("buy_amount")).toBe("12.3456789");
    expect(params.has("sell_amount")).toBe(false);
    expect(params.get("sell_asset")).toBe("iso4217:TRY");
    expect(params.get("buy_asset")).toBe(`stellar:USDC:${USDC_ISSUER}`);
    expect(params.get("context")).toBe("sep6");
    expect(params.get("sell_delivery_method")).toBe("bank_account");
    expect(price.sellAmount).toBe("605.734567890123");
    expect(price.buyAmount).toBe("12.3456789");
  });

  it("preserves decimal strings returned by the Anchor", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            ...SEP38_PRICE_RESPONSE,
            sell_amount: "49.0000000000000001",
            buy_amount: "1.0000000",
            total_price: "49.0000000000000001",
          }),
          { status: 200 },
        ),
      ),
    );

    const price = await getIndicativePriceForBuyAmount("1.0000000", {
      config,
    });

    expect(price.sellAmount).toBe("49.0000000000000001");
    expect(price.buyAmount).toBe("1.0000000");
    expect(price.totalPrice).toBe("49.0000000000000001");
  });
});

describe("getFirmQuote", () => {
  it("sends the SEP-10 token and one amount, then parses the firm quote", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const headers = init.headers as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer a.b.c");
      expect(JSON.parse(init.body as string)).toMatchObject({
        sell_asset: "iso4217:TRY",
        buy_asset: `stellar:USDC:${USDC_ISSUER}`,
        sell_amount: "200.00",
        context: "sep6",
        sell_delivery_method: "bank_account",
      });
      return new Response(JSON.stringify(SEP38_QUOTE_RESPONSE), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getFirmQuote({
      config,
      token: "a.b.c",
      sellAmount: "200.00",
    });

    expect(result.id).toBe(SEP38_QUOTE_RESPONSE.id);
    expect(result.expiresAt).toBe(QUOTE_EXPIRES_AT_SECONDS);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    {},
    { sellAmount: "" },
    { buyAmount: "   " },
    { sellAmount: "200", buyAmount: "4" },
  ])("rejects a missing, blank, or ambiguous amount: %o", async (amounts) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getFirmQuote({ config, token: "a.b.c", ...amounts }),
    ).rejects.toBeInstanceOf(AnchorError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

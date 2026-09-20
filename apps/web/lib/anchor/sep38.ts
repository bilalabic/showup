/**
 * SEP-38 — indicative prices and firm quotes.
 *
 * `/info`, `/prices` and `/price` are PUBLIC. They take no Bearer token, and
 * sending one is harmless but pointless. `SKILL.md` shows an Authorization
 * header on `/prices`; the Anchor's `/guide` says plainly that only
 * `POST /quote` is authenticated. This matters more than it looks: because
 * pricing needs no token, an event page can show "200 TRY is about 4.08 USDC"
 * before the wallet is connected at all.
 */

import {
  DELIVERY_METHOD,
  FIAT_ASSET_ID,
  QUOTE_CONTEXT,
} from "./config";
import { AnchorError } from "./errors";
import {
  anchorRequest,
  buildUrl,
  optionalString,
  requireRecord,
  requireString,
} from "./http";
import type { AnchorConfig, AnchorFee, AssetId, Price, Quote } from "./types";

/** The SEP-38 identifier for the Anchor's settlement asset. */
export function stellarAssetId(config: AnchorConfig): AssetId {
  return `stellar:${config.asset.code}:${config.asset.issuer}`;
}

function parseFee(value: unknown): AnchorFee | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const total = optionalString(record.total);
  const asset = optionalString(record.asset);
  if (total === undefined || asset === undefined) {
    return undefined;
  }

  const rawDetails = Array.isArray(record.details) ? record.details : [];
  const details = rawDetails
    .map((entry) => {
      const detail = entry as Record<string, unknown>;
      const name = optionalString(detail.name);
      const amount = optionalString(detail.amount);
      if (name === undefined || amount === undefined) return undefined;
      return {
        name,
        amount,
        description: optionalString(detail.description),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== undefined);

  return { total, asset, details: details.length > 0 ? details : undefined };
}

/**
 * Parse an ISO-8601 `expires_at` into Unix seconds.
 *
 * A quote whose expiry cannot be read is treated as already expired rather than
 * as never expiring — the conservative direction, and harmless here because an
 * expired quote does not block anything.
 */
export function parseExpiresAt(value: unknown): number {
  const text = optionalString(value);
  if (text === undefined) {
    return 0;
  }
  const millis = Date.parse(text);
  return Number.isFinite(millis) ? Math.floor(millis / 1000) : 0;
}

/**
 * `GET {ANCHOR_QUOTE_SERVER}/price` — indicative, public, no token.
 *
 * `tryAmount` is a decimal string in TRY, passed straight through. It is never
 * clamped to a local limit: the Anchor's `/health` and `/sep6/info` disagree
 * about the bounds, so the only honest client behaviour is to ask and surface
 * the refusal.
 */
export async function getIndicativePrice(
  tryAmount: string,
  options: { config: AnchorConfig; signal?: AbortSignal },
): Promise<Price> {
  const { config } = options;
  const buyAsset = stellarAssetId(config);

  const url = buildUrl(config.quoteServer, "/price", {
    sell_asset: FIAT_ASSET_ID,
    buy_asset: buyAsset,
    sell_amount: tryAmount,
    context: QUOTE_CONTEXT,
    sell_delivery_method: DELIVERY_METHOD,
  });

  const payload = requireRecord(
    await anchorRequest<unknown>(url, { signal: options.signal }),
    "SEP-38 price",
  );

  return parsePrice(payload, buyAsset);
}

/**
 * `GET {ANCHOR_QUOTE_SERVER}/price` for an exact USDC amount.
 *
 * This is the public counterpart to a firm buy-amount quote. It lets an event
 * page estimate how much TRY would fund the bond without connecting a wallet or
 * creating an authenticated Anchor session. The decimal string is forwarded
 * unchanged so the caller's exact seven-decimal USDC amount is preserved.
 */
export async function getIndicativePriceForBuyAmount(
  usdcAmount: string,
  options: { config: AnchorConfig; signal?: AbortSignal },
): Promise<Price> {
  const { config } = options;
  const buyAsset = stellarAssetId(config);

  const url = buildUrl(config.quoteServer, "/price", {
    sell_asset: FIAT_ASSET_ID,
    buy_asset: buyAsset,
    buy_amount: usdcAmount,
    context: QUOTE_CONTEXT,
    sell_delivery_method: DELIVERY_METHOD,
  });

  const payload = requireRecord(
    await anchorRequest<unknown>(url, { signal: options.signal }),
    "SEP-38 price",
  );

  return parsePrice(payload, buyAsset);
}

function parsePrice(
  payload: Record<string, unknown>,
  fallbackBuyAsset: AssetId,
): Price {
  return {
    sellAmount: requireString(payload, "sell_amount", "SEP-38 price"),
    buyAmount: requireString(payload, "buy_amount", "SEP-38 price"),
    price: requireString(payload, "price", "SEP-38 price"),
    totalPrice: requireString(payload, "total_price", "SEP-38 price"),
    sellAsset: optionalString(payload.sell_asset) ?? FIAT_ASSET_ID,
    buyAsset: optionalString(payload.buy_asset) ?? fallbackBuyAsset,
    fee: parseFee(payload.fee),
  };
}

export type FirmQuoteOptions = {
  config: AnchorConfig;
  /** SEP-10 token. Only this endpoint needs one. */
  token: string;
  /** TRY to spend. Exactly one of `sellAmount` / `buyAmount`. */
  sellAmount?: string;
  /** USDC to receive. Exactly one of `sellAmount` / `buyAmount`. */
  buyAmount?: string;
  /** ISO-8601. The Anchor allows up to an hour; the default is 15 minutes. */
  expireAfter?: string;
  signal?: AbortSignal;
};

/**
 * `POST {ANCHOR_QUOTE_SERVER}/quote` — a firm, single-use, user-bound quote.
 *
 * The quote id is attached to the SEP-6 deposit. A quote is OPTIONAL: without
 * one the deposit prices at the live rate, which is also what happens if the
 * quote has expired by the time the TRY arrives.
 */
export async function getFirmQuote(options: FirmQuoteOptions): Promise<Quote> {
  const { config, token } = options;

  const hasSell =
    typeof options.sellAmount === "string" && options.sellAmount.trim().length > 0;
  const hasBuy =
    typeof options.buyAmount === "string" && options.buyAmount.trim().length > 0;
  if (hasSell === hasBuy) {
    throw new AnchorError(
      "protocol",
      "A SEP-38 quote needs exactly one of sellAmount or buyAmount.",
    );
  }

  const buyAsset = stellarAssetId(config);
  const body: Record<string, string> = {
    sell_asset: FIAT_ASSET_ID,
    buy_asset: buyAsset,
    context: QUOTE_CONTEXT,
    sell_delivery_method: DELIVERY_METHOD,
  };
  if (options.sellAmount) body.sell_amount = options.sellAmount;
  if (options.buyAmount) body.buy_amount = options.buyAmount;
  if (options.expireAfter) body.expire_after = options.expireAfter;

  const payload = requireRecord(
    await anchorRequest<unknown>(buildUrl(config.quoteServer, "/quote"), {
      method: "POST",
      token,
      body,
      signal: options.signal,
    }),
    "SEP-38 quote",
  );

  return {
    id: requireString(payload, "id", "SEP-38 quote"),
    expiresAt: parseExpiresAt(payload.expires_at),
    sellAmount: requireString(payload, "sell_amount", "SEP-38 quote"),
    buyAmount: requireString(payload, "buy_amount", "SEP-38 quote"),
    price: requireString(payload, "price", "SEP-38 quote"),
    totalPrice: requireString(payload, "total_price", "SEP-38 quote"),
    sellAsset: optionalString(payload.sell_asset) ?? FIAT_ASSET_ID,
    buyAsset: optionalString(payload.buy_asset) ?? buyAsset,
    fee: parseFee(payload.fee),
  };
}

/**
 * Whether a quote's `expires_at` has passed.
 *
 * Read this carefully: an expired quote is NOT a failure. The Anchor silently
 * falls back to the live rate rather than refusing the deposit, so a client
 * that hard-fails on expiry invents a bug the Anchor does not have. The only
 * correct response is to warn that the final rate may differ, re-price for
 * display, and carry on.
 */
export function isQuoteExpired(quote: Quote, nowSeconds: number): boolean {
  return quote.expiresAt <= nowSeconds;
}

/** Copy for an expired quote. Warning tone, never blocking. */
export const EXPIRED_QUOTE_WARNING =
  "Your locked rate has expired. The deposit will still go through at the Anchor's live rate, so the final amount may differ slightly.";

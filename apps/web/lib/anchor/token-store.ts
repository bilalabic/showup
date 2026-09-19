/**
 * The SEP-10 token lives HERE, in memory, and nowhere else.
 *
 * Not `localStorage`, not `sessionStorage`, not a cookie, not a log line, not a
 * React prop that gets rendered. A reload throws the token away and costs one
 * wallet signature; a token in web storage costs the user their Anchor session
 * to any script that can read it. The in-flight deposit id, quote id and
 * claimable-balance id DO persist — see `session.ts` — because a transaction id
 * is a public reference and a bearer token is not.
 */

import { JWT_EXPIRY_SKEW_SECONDS } from "./config";
import { AnchorError } from "./errors";

type StoredToken = {
  token: string;
  /** Unix seconds, read from the token's own `exp`. */
  expiresAt: number;
};

/** Module-level and non-exported: the token cannot be reached from outside. */
const tokens = new Map<string, StoredToken>();

const TOKEN_KEY_SEPARATOR = "\u0000";

function tokenKey(address: string, homeDomain: string): string {
  return `${address}${TOKEN_KEY_SEPARATOR}${homeDomain}`;
}

/** Portable base64url -> UTF-8. Works in the browser and in Node. */
function decodeBase64Url(segment: string): string {
  const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");

  if (typeof atob === "function") {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  }

  // Node without `atob` (older runtimes). `Buffer` is not imported so this file
  // stays browser-safe; it is reached through globalThis.
  const nodeBuffer = (globalThis as { Buffer?: { from: (s: string, e: string) => { toString: (e: string) => string } } }).Buffer;
  if (nodeBuffer) {
    return nodeBuffer.from(padded, "base64").toString("utf8");
  }

  throw new AnchorError("protocol", "No base64 decoder is available in this runtime.");
}

/**
 * Read `exp` out of a SEP-10 token.
 *
 * The Anchor does NOT document the JWT lifetime, so assuming one (15 minutes,
 * an hour, a day) would be a guess that silently breaks when it is wrong. The
 * token states its own expiry; this reads it. The signature is not verified —
 * the client is not the verifier, and pretending otherwise would be theatre.
 */
export function readTokenExpiry(token: string): number {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new AnchorError("protocol", "The Anchor returned a malformed SEP-10 token.");
  }

  let claims: unknown;
  try {
    claims = JSON.parse(decodeBase64Url(parts[1]!));
  } catch (cause) {
    throw new AnchorError("protocol", "The SEP-10 token's claims could not be read.", {
      cause,
    });
  }

  const exp = (claims as { exp?: unknown } | null)?.exp;
  if (typeof exp !== "number" || !Number.isFinite(exp)) {
    throw new AnchorError("protocol", "The SEP-10 token has no usable `exp` claim.");
  }

  return Math.floor(exp);
}

/** Read the `sub` claim, which is `G…`, `G…:memo` or `M…`. */
export function readTokenSubject(token: string): string | undefined {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return undefined;
    const claims = JSON.parse(decodeBase64Url(parts[1]!)) as { sub?: unknown };
    return typeof claims.sub === "string" ? claims.sub : undefined;
  } catch {
    return undefined;
  }
}

/** Cache a freshly issued token against the account it authenticates. */
export function storeToken(
  address: string,
  homeDomain: string,
  token: string,
): StoredToken {
  const entry: StoredToken = { token, expiresAt: readTokenExpiry(token) };
  tokens.set(tokenKey(address, homeDomain), entry);
  return entry;
}

/**
 * The cached token for an account, or `undefined` if there is none or it has
 * expired. `nowSeconds` is a parameter so tests never depend on the clock.
 */
export function getCachedToken(
  address: string,
  homeDomain: string,
  nowSeconds: number,
): string | undefined {
  const key = tokenKey(address, homeDomain);
  const entry = tokens.get(key);
  if (!entry) {
    return undefined;
  }
  if (entry.expiresAt - JWT_EXPIRY_SKEW_SECONDS <= nowSeconds) {
    tokens.delete(key);
    return undefined;
  }
  return entry.token;
}

/** Forget a token — on 403, on wallet disconnect, or on an address change. */
export function clearToken(address?: string, homeDomain?: string): void {
  if (address === undefined) {
    tokens.clear();
    return;
  }

  if (homeDomain !== undefined) {
    tokens.delete(tokenKey(address, homeDomain));
    return;
  }

  const accountPrefix = `${address}${TOKEN_KEY_SEPARATOR}`;
  for (const key of tokens.keys()) {
    if (key.startsWith(accountPrefix)) {
      tokens.delete(key);
    }
  }
}

/** Whether a live token is held for an account. Never exposes the token itself. */
export function hasValidToken(
  address: string,
  homeDomain: string,
  nowSeconds: number,
): boolean {
  return getCachedToken(address, homeDomain, nowSeconds) !== undefined;
}

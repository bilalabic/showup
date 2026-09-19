/**
 * SEP-10 — challenge, signature, token.
 *
 * Three corrections to the hackathon `SKILL.md` are load-bearing here:
 *  - `WebAuth.readChallengeTx`, not `Utils.readChallengeTx` (which is undefined
 *    in `@stellar/stellar-sdk` 17.x).
 *  - The challenge is NEVER validated by hand. `readChallengeTx` checks the
 *    server signature, the source account, sequence 0, the timebounds, the home
 *    domain in the first ManageData key and the `web_auth_domain` in the second.
 *    Re-implementing that is how a wallet ends up signing an attacker's payment.
 *  - A failed call answers HTTP 403 with `{"type":"authentication_required"}`.
 *    Not 401.
 */

import { WebAuth } from "@stellar/stellar-sdk";

import { AnchorError } from "./errors";
import { anchorRequest, buildUrl, requireRecord, requireString } from "./http";
import { discover } from "./sep1";
import { clearToken, getCachedToken, storeToken } from "./token-store";
import type { AnchorConfig, ChallengeSigner } from "./types";

/** What `GET /auth` returns. */
export type ChallengeResponse = {
  transaction: string;
  networkPassphrase: string;
};

/** A challenge that has passed every SEP-10 check and is safe to sign. */
export type ValidatedChallenge = {
  xdr: string;
  clientAccountId: string;
  matchedHomeDomain: string;
};

/** `GET {WEB_AUTH_ENDPOINT}?account=…`. No token — this is the login. */
export async function requestChallenge(
  config: AnchorConfig,
  account: string,
  options: { clientDomain?: string; memo?: string; signal?: AbortSignal } = {},
): Promise<ChallengeResponse> {
  const url = buildUrl(config.webAuthEndpoint, "", {
    account,
    memo: options.memo,
    client_domain: options.clientDomain,
  });

  const payload = requireRecord(
    await anchorRequest<unknown>(url, { signal: options.signal }),
    "SEP-10 challenge",
  );

  return {
    transaction: requireString(payload, "transaction", "SEP-10 challenge"),
    networkPassphrase:
      typeof payload.network_passphrase === "string"
        ? payload.network_passphrase
        : config.networkPassphrase,
  };
}

/**
 * Validate a challenge before it is put in front of a wallet.
 *
 * `webAuthDomain` is the host of `WEB_AUTH_ENDPOINT`; `homeDomains` is the
 * Anchor's home domain. On this Anchor both are `tr-mock-anchor.fly.dev`, but
 * they are genuinely different values in SEP-10 and are passed separately so a
 * relocated auth server does not silently pass validation.
 *
 * Every failure becomes a `challenge_invalid` error with recovery `none`: there
 * is no retry that makes an unsafe challenge safe.
 */
export function validateChallenge(
  challenge: ChallengeResponse,
  config: AnchorConfig,
  expectedClientAccount: string,
): ValidatedChallenge {
  if (challenge.networkPassphrase !== config.networkPassphrase) {
    throw new AnchorError(
      "challenge_invalid",
      "The SEP-10 challenge is for a different Stellar network.",
    );
  }

  const webAuthDomain = new URL(config.webAuthEndpoint).host;

  let read: ReturnType<typeof WebAuth.readChallengeTx>;
  try {
    read = WebAuth.readChallengeTx(
      challenge.transaction,
      config.signingKey,
      config.networkPassphrase,
      [config.homeDomain],
      webAuthDomain,
    );
  } catch (cause) {
    throw new AnchorError(
      "challenge_invalid",
      `The SEP-10 challenge failed validation: ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
      { cause },
    );
  }

  // `readChallengeTx` does not check WHO the challenge is for. A challenge
  // issued for another account must never reach the wallet.
  if (read.clientAccountID !== expectedClientAccount) {
    throw new AnchorError(
      "challenge_invalid",
      "The SEP-10 challenge was issued for a different account.",
    );
  }

  return {
    xdr: challenge.transaction,
    clientAccountId: read.clientAccountID,
    matchedHomeDomain: read.matchedHomeDomain,
  };
}

/** `POST {WEB_AUTH_ENDPOINT}` with the signed challenge. Returns the raw JWT. */
export async function exchangeChallenge(
  config: AnchorConfig,
  signedXdr: string,
  signal?: AbortSignal,
): Promise<string> {
  const payload = requireRecord(
    await anchorRequest<unknown>(buildUrl(config.webAuthEndpoint, ""), {
      method: "POST",
      body: { transaction: signedXdr },
      signal,
    }),
    "SEP-10 token",
  );

  return requireString(payload, "token", "SEP-10 token");
}

export type AuthenticateOptions = {
  config?: AnchorConfig;
  /** Unix seconds, for the cache check. Callers pass the ledger clock. */
  nowSeconds?: number;
  /** Skip the in-memory cache and force a fresh signature. */
  forceRefresh?: boolean;
  clientDomain?: string;
  signal?: AbortSignal;
};

/**
 * SEP-10 end to end: challenge -> validate -> wallet signature -> token.
 *
 * Returns the token so a caller can pass it to the SEP-6/38 functions, and also
 * caches it in memory so nothing has to hold it. It is never persisted and must
 * never be rendered.
 */
export async function authenticate(
  signer: ChallengeSigner,
  options: AuthenticateOptions = {},
): Promise<string> {
  const config = options.config ?? (await discover());
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);

  if (!options.forceRefresh) {
    const cachedToken = getCachedToken(signer.address, config.homeDomain, now);
    if (cachedToken) {
      return cachedToken;
    }
  }
  clearToken(signer.address, config.homeDomain);

  const challenge = await requestChallenge(config, signer.address, {
    clientDomain: options.clientDomain,
    signal: options.signal,
  });

  const validated = validateChallenge(challenge, config, signer.address);
  const signedXdr = await signer.signTransaction(validated.xdr);

  if (typeof signedXdr !== "string" || signedXdr.length === 0) {
    throw new AnchorError(
      "challenge_invalid",
      "The wallet did not return a signed challenge.",
    );
  }

  const token = await exchangeChallenge(config, signedXdr, options.signal);
  storeToken(signer.address, config.homeDomain, token);
  return token;
}

/**
 * Run an authenticated call, re-authenticating ONCE on a 403.
 *
 * This is the silent re-authentication SYSTEM.md section 17 requires: a JWT
 * whose lifetime nobody documented will expire mid-flow, and the correct
 * response is one wallet signature, not an error screen. It only surfaces if
 * the second attempt fails too.
 */
export async function withFreshToken<T>(
  signer: ChallengeSigner,
  call: (token: string) => Promise<T>,
  options: AuthenticateOptions = {},
): Promise<T> {
  const config = options.config ?? (await discover());
  const authOptions = { ...options, config };
  const token = await authenticate(signer, authOptions);

  try {
    return await call(token);
  } catch (error) {
    if (error instanceof AnchorError && error.kind === "authentication_required") {
      clearToken(signer.address, config.homeDomain);
      const refreshed = await authenticate(signer, {
        ...authOptions,
        forceRefresh: true,
      });
      return call(refreshed);
    }
    throw error;
  }
}

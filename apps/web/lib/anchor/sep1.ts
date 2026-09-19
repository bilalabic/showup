/**
 * SEP-1 — discovery from `stellar.toml`.
 *
 * `StellarTomlResolver` is `undefined` in `@stellar/stellar-sdk` 17.x, which
 * this repo pins. The correct export is `StellarToml.Resolver`. The hackathon
 * `SKILL.md` gets this wrong and the resulting `TypeError` is one of the six
 * documented traps in SYSTEM.md section 11.
 */

import { StellarToml } from "@stellar/stellar-sdk";

import {
  ANCHOR_ASSET_CODE,
  ANCHOR_ASSET_ISSUER,
  TESTNET_NETWORK_PASSPHRASE,
  getAnchorHomeDomain,
  normalizeHomeDomain,
} from "./config";
import { AnchorError } from "./errors";
import type { AnchorConfig } from "./types";

/** A `stellar.toml` reduced to `AnchorConfig`, with every requirement checked. */
export function parseStellarToml(
  toml: StellarToml.Api.StellarToml,
  homeDomain: string,
): AnchorConfig {
  const missing: string[] = [];

  const signingKey = toml.SIGNING_KEY;
  const webAuthEndpoint = toml.WEB_AUTH_ENDPOINT;
  const transferServer = toml.TRANSFER_SERVER;
  const quoteServer = toml.ANCHOR_QUOTE_SERVER;
  const networkPassphrase = toml.NETWORK_PASSPHRASE;

  if (!signingKey) missing.push("SIGNING_KEY");
  if (!webAuthEndpoint) missing.push("WEB_AUTH_ENDPOINT");
  if (!transferServer) missing.push("TRANSFER_SERVER");
  if (!quoteServer) missing.push("ANCHOR_QUOTE_SERVER");
  if (!networkPassphrase) missing.push("NETWORK_PASSPHRASE");

  if (missing.length > 0) {
    throw new AnchorError(
      "protocol",
      `The Anchor's stellar.toml is missing ${missing.join(", ")}.`,
    );
  }

  // Testnet only. A Mainnet passphrase here would mean the home domain points
  // at production, and nothing downstream should get the chance to find out.
  if (networkPassphrase !== TESTNET_NETWORK_PASSPHRASE) {
    throw new AnchorError(
      "protocol",
      `The Anchor is on "${networkPassphrase}". ShowUp is Testnet only.`,
    );
  }

  const currencies = Array.isArray(toml.CURRENCIES) ? toml.CURRENCIES : [];
  const currency = currencies.find(
    (entry) => entry?.code === ANCHOR_ASSET_CODE && typeof entry?.issuer === "string",
  );

  if (!currency?.issuer) {
    throw new AnchorError(
      "protocol",
      `The Anchor's stellar.toml does not publish a ${ANCHOR_ASSET_CODE} issuer.`,
    );
  }

  if (currency.issuer !== ANCHOR_ASSET_ISSUER) {
    throw new AnchorError(
      "protocol",
      `The Anchor publishes ${ANCHOR_ASSET_CODE} from an unexpected issuer.`,
    );
  }

  // The issuer and the network are pinned above, but the endpoints are not:
  // they come from the TOML. A plain-http endpoint would carry the SEP-10
  // bearer token in the clear, so require https before anything is sent there.
  for (const [label, endpoint] of [
    ["WEB_AUTH_ENDPOINT", webAuthEndpoint!],
    ["TRANSFER_SERVER", transferServer!],
    ["ANCHOR_QUOTE_SERVER", quoteServer!],
  ] as const) {
    let parsed: URL;
    try {
      parsed = new URL(endpoint);
    } catch {
      throw new AnchorError(
        "protocol",
        `The Anchor's ${label} is not a valid URL.`,
      );
    }
    if (parsed.protocol !== "https:") {
      throw new AnchorError(
        "protocol",
        `The Anchor's ${label} is not https. ShowUp will not send an authenticated request over plain http.`,
      );
    }
  }

  return {
    homeDomain,
    networkPassphrase,
    signingKey: signingKey!,
    webAuthEndpoint: webAuthEndpoint!,
    transferServer: transferServer!,
    quoteServer: quoteServer!,
    kycServer: toml.KYC_SERVER,
    asset: { code: ANCHOR_ASSET_CODE, issuer: ANCHOR_ASSET_ISSUER },
  };
}

let cached: { homeDomain: string; config: AnchorConfig } | undefined;

/**
 * SEP-1 discovery. Cached for the lifetime of the page.
 *
 * The result is the only source of endpoints, the signing key and the issuer.
 * Nothing in this module hard-codes a URL.
 */
export async function discover(homeDomainInput?: string): Promise<AnchorConfig> {
  const homeDomain = homeDomainInput
    ? normalizeHomeDomain(homeDomainInput)
    : getAnchorHomeDomain();

  if (cached && cached.homeDomain === homeDomain) {
    return cached.config;
  }

  let toml: StellarToml.Api.StellarToml;
  try {
    toml = await StellarToml.Resolver.resolve(homeDomain);
  } catch (cause) {
    if (cause instanceof AnchorError) {
      throw cause;
    }
    throw new AnchorError(
      "unreachable",
      "Funding is temporarily unavailable — the Anchor's stellar.toml could not be read.",
      { endpoint: `https://${homeDomain}/.well-known/stellar.toml`, cause },
    );
  }

  const config = parseStellarToml(toml, homeDomain);
  cached = { homeDomain, config };
  return config;
}

/** Drop the discovery cache. Used by tests and by a home-domain change. */
export function resetDiscoveryCache(): void {
  cached = undefined;
}

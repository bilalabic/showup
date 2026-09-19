/**
 * SEP-1 discovery.
 *
 * Every endpoint, the signing key and the USDC issuer come from here. Nothing
 * downstream hard-codes a URL, so a `stellar.toml` that is missing a field, or
 * that points at the wrong network, has to fail here rather than three calls
 * later with a confusing symptom.
 */

import { StellarToml } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";

import { normalizeHomeDomain } from "../config";
import { AnchorError } from "../errors";
import { parseStellarToml } from "../sep1";
import {
  ANCHOR_HOME_DOMAIN,
  ANCHOR_SIGNING_KEY,
  STELLAR_TOML,
  USDC_ISSUER,
} from "./fixtures/anchor-responses";

describe("parseStellarToml", () => {
  it("reads every endpoint from the recorded live stellar.toml", () => {
    const config = parseStellarToml(STELLAR_TOML, ANCHOR_HOME_DOMAIN);

    expect(config.signingKey).toBe(ANCHOR_SIGNING_KEY);
    expect(config.webAuthEndpoint).toBe("https://tr-mock-anchor.fly.dev/auth");
    expect(config.transferServer).toBe("https://tr-mock-anchor.fly.dev/sep6");
    expect(config.quoteServer).toBe("https://tr-mock-anchor.fly.dev/sep38");
    expect(config.kycServer).toBe("https://tr-mock-anchor.fly.dev/sep12");
    expect(config.asset).toEqual({ code: "USDC", issuer: USDC_ISSUER });
  });

  it("refuses anything that is not Testnet", () => {
    const mainnet = {
      ...STELLAR_TOML,
      NETWORK_PASSPHRASE:
        "Public Global Stellar Network ; September 2015" as StellarToml.Api.StellarToml["NETWORK_PASSPHRASE"],
    };

    expect(() => parseStellarToml(mainnet, ANCHOR_HOME_DOMAIN)).toThrowError(
      /Testnet only/i,
    );
  });

  it("names the missing fields instead of failing later with a bad URL", () => {
    const incomplete = { ...STELLAR_TOML };
    delete incomplete.ANCHOR_QUOTE_SERVER;
    delete incomplete.SIGNING_KEY;

    try {
      parseStellarToml(incomplete, ANCHOR_HOME_DOMAIN);
      expect.unreachable("an incomplete toml must not parse");
    } catch (error) {
      expect(error).toBeInstanceOf(AnchorError);
      expect((error as AnchorError).message).toContain("SIGNING_KEY");
      expect((error as AnchorError).message).toContain("ANCHOR_QUOTE_SERVER");
    }
  });

  it("refuses a toml that publishes no USDC issuer", () => {
    expect(() =>
      parseStellarToml({ ...STELLAR_TOML, CURRENCIES: [] }, ANCHOR_HOME_DOMAIN),
    ).toThrowError(/USDC issuer/i);
  });

  it("refuses a USDC issuer that differs from the wallet and contract asset", () => {
    const wrongIssuer = {
      ...STELLAR_TOML,
      CURRENCIES: [{ code: "USDC", issuer: ANCHOR_SIGNING_KEY }],
    };

    expect(() => parseStellarToml(wrongIssuer, ANCHOR_HOME_DOMAIN)).toThrowError(
      /unexpected issuer/i,
    );
  });
});

describe("normalizeHomeDomain", () => {
  it("reduces anything domain-ish to the bare host SEP-10 signs over", () => {
    for (const input of [
      "tr-mock-anchor.fly.dev",
      "https://tr-mock-anchor.fly.dev",
      "https://tr-mock-anchor.fly.dev/",
      "  HTTPS://TR-Mock-Anchor.fly.dev/  ",
    ]) {
      expect(normalizeHomeDomain(input)).toBe(ANCHOR_HOME_DOMAIN);
    }
  });
});

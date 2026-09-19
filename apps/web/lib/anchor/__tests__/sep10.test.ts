/**
 * SEP-10 challenge validation.
 *
 * The point of these tests is that a hostile or misdirected challenge is
 * REFUSED BEFORE it reaches the wallet. A challenge transaction is an arbitrary
 * signed Stellar transaction; treating one as trustworthy because it arrived
 * from the expected URL is how a wallet signs something it should not.
 */

import {
  Keypair,
  Transaction,
  TransactionBuilder,
  WebAuth,
} from "@stellar/stellar-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AnchorError } from "../errors";
import { validateChallenge } from "../sep10";
import type { AnchorConfig } from "../types";
import {
  ANCHOR_HOME_DOMAIN,
  ANCHOR_SIGNING_KEY,
  LIVE_CHALLENGE_ACCOUNT,
  LIVE_CHALLENGE_RESPONSE,
  TESTNET_PASSPHRASE,
  USDC_ISSUER,
} from "./fixtures/anchor-responses";

/**
 * A synthetic Anchor whose signing key is known to the test, so a challenge can
 * be built with live timebounds. The recorded live challenge is used separately
 * for the expiry case — its window closed in September 2026.
 */
const serverKeypair = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 7));
const clientKeypair = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 9));
const impostorKeypair = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 13));

const config: AnchorConfig = {
  homeDomain: ANCHOR_HOME_DOMAIN,
  networkPassphrase: TESTNET_PASSPHRASE,
  signingKey: serverKeypair.publicKey(),
  webAuthEndpoint: `https://${ANCHOR_HOME_DOMAIN}/auth`,
  transferServer: `https://${ANCHOR_HOME_DOMAIN}/sep6`,
  quoteServer: `https://${ANCHOR_HOME_DOMAIN}/sep38`,
  asset: { code: "USDC", issuer: USDC_ISSUER },
};

function buildChallenge(options: { homeDomain?: string; account?: string } = {}) {
  return WebAuth.buildChallengeTx(
    serverKeypair,
    options.account ?? clientKeypair.publicKey(),
    options.homeDomain ?? ANCHOR_HOME_DOMAIN,
    900,
    TESTNET_PASSPHRASE,
    ANCHOR_HOME_DOMAIN,
  );
}

function challengeResponse(transaction: string) {
  return { transaction, networkPassphrase: TESTNET_PASSPHRASE };
}

/** `fromXDR` returns a union; a SEP-10 challenge is never a fee-bump. */
function parseXdr(xdr: string): Transaction {
  return TransactionBuilder.fromXDR(xdr, TESTNET_PASSPHRASE) as Transaction;
}

describe("validateChallenge", () => {
  it("accepts a well-formed challenge and reports the client account", () => {
    const result = validateChallenge(
      challengeResponse(buildChallenge()),
      config,
      clientKeypair.publicKey(),
    );

    expect(result.clientAccountId).toBe(clientKeypair.publicKey());
    expect(result.matchedHomeDomain).toBe(ANCHOR_HOME_DOMAIN);
  });

  it("uses the SEP-10 shape the Anchor actually issues: sequence 0 and two ManageData operations", () => {
    const tx = parseXdr(buildChallenge());

    expect(tx.sequence).toBe("0");
    expect(tx.operations).toHaveLength(2);
    expect(tx.operations.every((op) => op.type === "manageData")).toBe(true);

    // 900-second window, matching the live probe.
    const bounds = tx.timeBounds!;
    expect(Number(bounds.maxTime) - Number(bounds.minTime)).toBe(900);
  });

  it("REJECTS a challenge built for a different home domain", () => {
    const foreign = challengeResponse(
      buildChallenge({ homeDomain: "evil-anchor.example.com" }),
    );

    expect(() =>
      validateChallenge(foreign, config, clientKeypair.publicKey()),
    ).toThrowError(AnchorError);

    try {
      validateChallenge(foreign, config, clientKeypair.publicKey());
      expect.unreachable("a foreign home domain must not validate");
    } catch (error) {
      expect(error).toBeInstanceOf(AnchorError);
      expect((error as AnchorError).kind).toBe("challenge_invalid");
      // No retry makes an unsafe challenge safe.
      expect((error as AnchorError).recovery).toBe("none");
    }
  });

  it("REJECTS a challenge whose server signature is not the Anchor's", () => {
    // Source account stays the Anchor's; only the signature is swapped. This
    // isolates signature verification from source-account verification.
    const tx = parseXdr(buildChallenge());
    tx.signatures.splice(0, tx.signatures.length);
    tx.sign(impostorKeypair);

    expect(() =>
      validateChallenge(
        challengeResponse(tx.toXDR()),
        config,
        clientKeypair.publicKey(),
      ),
    ).toThrowError(/challenge failed validation/i);
  });

  it("REJECTS a challenge signed by a server key other than SIGNING_KEY", () => {
    const rogue = WebAuth.buildChallengeTx(
      impostorKeypair,
      clientKeypair.publicKey(),
      ANCHOR_HOME_DOMAIN,
      900,
      TESTNET_PASSPHRASE,
      ANCHOR_HOME_DOMAIN,
    );

    expect(() =>
      validateChallenge(
        challengeResponse(rogue),
        config,
        clientKeypair.publicKey(),
      ),
    ).toThrowError(AnchorError);
  });

  it("REJECTS a challenge issued for someone else's account", () => {
    const forAnotherAccount = challengeResponse(
      buildChallenge({ account: impostorKeypair.publicKey() }),
    );

    try {
      validateChallenge(forAnotherAccount, config, clientKeypair.publicKey());
      expect.unreachable("a challenge for another account must not validate");
    } catch (error) {
      expect((error as AnchorError).kind).toBe("challenge_invalid");
      expect((error as AnchorError).message).toMatch(/different account/i);
    }
  });

  it("REJECTS a challenge for the wrong network before reading it at all", () => {
    const wrongNetwork = {
      transaction: buildChallenge(),
      networkPassphrase: "Public Global Stellar Network ; September 2015",
    };

    expect(() =>
      validateChallenge(wrongNetwork, config, clientKeypair.publicKey()),
    ).toThrowError(/different Stellar network/i);
  });

});

/**
 * The recorded live challenge — a genuine, correctly signed response captured
 * from `GET /auth` on 2026-09-19 at 18:44:36 UTC.
 *
 * The clock is faked so neither assertion depends on when the suite runs.
 * Together they prove the validator accepts real Anchor traffic signed by the
 * published `SIGNING_KEY`, and rejects it once the 900-second window closes.
 */
describe("validateChallenge against the recorded live challenge", () => {
  const liveConfig: AnchorConfig = {
    ...config,
    signingKey: ANCHOR_SIGNING_KEY,
  };

  // The Anchor answers with snake_case `network_passphrase`; `requestChallenge`
  // maps it, so the fixture is mapped the same way here.
  const recorded = {
    transaction: LIVE_CHALLENGE_RESPONSE.transaction,
    networkPassphrase: LIVE_CHALLENGE_RESPONSE.network_passphrase,
  };

  const issuedAt = Date.parse("2026-09-19T18:44:36Z");

  afterEach(() => {
    vi.useRealTimers();
  });

  it("ACCEPTS it inside its window, proving the real SIGNING_KEY verifies", () => {
    vi.useFakeTimers();
    vi.setSystemTime(issuedAt + 60_000);

    const result = validateChallenge(recorded, liveConfig, LIVE_CHALLENGE_ACCOUNT);

    expect(result.clientAccountId).toBe(LIVE_CHALLENGE_ACCOUNT);
    expect(result.matchedHomeDomain).toBe(ANCHOR_HOME_DOMAIN);
  });

  it("REJECTS it once the 900-second window and the SDK's grace period have closed", () => {
    // `readChallengeTx` allows a 5-minute clock-skew grace period beyond
    // `maxTime`, so "expired" here means 900 s + 300 s + a margin.
    vi.useFakeTimers();
    vi.setSystemTime(issuedAt + (900 + 300 + 10) * 1_000);

    expect(() =>
      validateChallenge(recorded, liveConfig, LIVE_CHALLENGE_ACCOUNT),
    ).toThrowError(AnchorError);
  });

  it("REJECTS it when checked against the wrong home domain", () => {
    vi.useFakeTimers();
    vi.setSystemTime(issuedAt + 60_000);

    expect(() =>
      validateChallenge(
        recorded,
        { ...liveConfig, homeDomain: "evil-anchor.example.com" },
        LIVE_CHALLENGE_ACCOUNT,
      ),
    ).toThrowError(/challenge failed validation/i);
  });
});

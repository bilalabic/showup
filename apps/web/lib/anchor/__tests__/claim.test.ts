/**
 * The claimable-balance recovery transaction.
 *
 * The single assertion that carries the most weight: `changeTrust` and
 * `claimClaimableBalance` end up in ONE transaction, in that order. Split them
 * and the user signs twice; reorder them and the claim fails on-chain because
 * the trustline does not exist yet.
 */

import { Transaction, TransactionBuilder } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";

import { buildClaimWithTrustlineXdr } from "../../stellar";
import { needsClaim } from "../claim";
import { parseDepositTransaction } from "../sep6";
import {
  TESTNET_PASSPHRASE,
  TX_AWAITING_TRANSFER,
  TX_COMPLETED_CLAIMABLE,
  TX_COMPLETED_PAYMENT,
  TX_PENDING_TRUST,
  TX_TREASURY_LOW,
  USDC_ISSUER,
} from "./fixtures/anchor-responses";

const CLAIMANT = "GALBFBDQAAGLKLKCQDH7CNKKA2A7UT5APANR27FMGCNZXUTVKF2O253G";
const ASSET = { code: "USDC", issuer: USDC_ISSUER };
const BALANCE_ID = parseDepositTransaction(TX_COMPLETED_CLAIMABLE.transaction)
  .claimableBalanceId!;

/** `fromXDR` returns a union; every transaction built here is a plain one. */
function parseXdr(xdr: string): Transaction {
  return TransactionBuilder.fromXDR(xdr, TESTNET_PASSPHRASE) as Transaction;
}

describe("buildClaimWithTrustlineXdr", () => {
  it("puts changeTrust and claimClaimableBalance in ONE transaction, in order", () => {
    const xdr = buildClaimWithTrustlineXdr({
      accountId: CLAIMANT,
      sequence: "1234567890",
      claimableBalanceId: BALANCE_ID,
      asset: ASSET,
    });

    const tx = parseXdr(xdr);

    expect(tx.operations).toHaveLength(2);
    expect(tx.operations[0]!.type).toBe("changeTrust");
    expect(tx.operations[1]!.type).toBe("claimClaimableBalance");
    expect(tx.source).toBe(CLAIMANT);
    // The builder increments the supplied sequence.
    expect(tx.sequence).toBe("1234567891");
  });

  it("returns UNSIGNED XDR — nothing here holds a key", () => {
    const xdr = buildClaimWithTrustlineXdr({
      accountId: CLAIMANT,
      sequence: "1",
      claimableBalanceId: BALANCE_ID,
      asset: ASSET,
    });

    expect(parseXdr(xdr).signatures).toHaveLength(
      0,
    );
  });

  it("trusts the Anchor's own asset, not a hard-coded issuer", () => {
    const xdr = buildClaimWithTrustlineXdr({
      accountId: CLAIMANT,
      sequence: "1",
      claimableBalanceId: BALANCE_ID,
      asset: ASSET,
    });

    const op = parseXdr(xdr).operations[0] as {
      type: "changeTrust";
      line: { code: string; issuer: string };
    };

    expect(op.line.code).toBe("USDC");
    expect(op.line.issuer).toBe(USDC_ISSUER);
  });

  it("can omit the trustline when the account already has one", () => {
    const xdr = buildClaimWithTrustlineXdr({
      accountId: CLAIMANT,
      sequence: "1",
      claimableBalanceId: BALANCE_ID,
      asset: ASSET,
      includeChangeTrust: false,
    });

    const tx = parseXdr(xdr);
    expect(tx.operations).toHaveLength(1);
    expect(tx.operations[0]!.type).toBe("claimClaimableBalance");
  });

  it("refuses a malformed claimable balance id", () => {
    expect(() =>
      buildClaimWithTrustlineXdr({
        accountId: CLAIMANT,
        sequence: "1",
        claimableBalanceId: "not-a-balance-id",
        asset: ASSET,
      }),
    ).toThrowError(/valid claimable balance id/i);
  });
});

describe("needsClaim", () => {
  it("is true for a completed deposit carrying a claimable balance", () => {
    expect(
      needsClaim(parseDepositTransaction(TX_COMPLETED_CLAIMABLE.transaction)),
    ).toBe(true);
  });

  it("is true for the legacy pending_trust status", () => {
    expect(needsClaim(parseDepositTransaction(TX_PENDING_TRUST.transaction))).toBe(
      true,
    );
  });

  it("is false for a plain completed payment", () => {
    expect(needsClaim(parseDepositTransaction(TX_COMPLETED_PAYMENT.transaction))).toBe(
      false,
    );
  });

  it("is false while the deposit is still in flight", () => {
    expect(needsClaim(parseDepositTransaction(TX_AWAITING_TRANSFER.transaction))).toBe(
      false,
    );
    expect(needsClaim(parseDepositTransaction(TX_TREASURY_LOW.transaction))).toBe(
      false,
    );
  });
});

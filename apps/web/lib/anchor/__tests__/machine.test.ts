/**
 * The deposit state machine — every state in SYSTEM.md section 11.
 *
 * The transitions that matter most are the three the architecture calls out:
 * `treasury_low` must reach its own state rather than looking like processing,
 * a `completed` deposit with a claimable balance must NOT be reported as done,
 * and an expired quote must not stop anything.
 */

import { describe, expect, it } from "vitest";

import {
  depositReducer,
  describeState,
  initialDepositState,
  isTerminalState,
  isWaitingOnAnchor,
  shouldPoll,
} from "../machine";
import type { DepositState } from "../machine";
import { parseDepositTransaction } from "../sep6";
import { parseExpiresAt } from "../sep38";
import type { AnchorConfig, DepositTicket, Price, Quote } from "../types";
import {
  ANCHOR_HOME_DOMAIN,
  ANCHOR_SIGNING_KEY,
  QUOTE_EXPIRES_AT_SECONDS,
  SEP38_PRICE_RESPONSE,
  SEP38_QUOTE_RESPONSE,
  SEP6_DEPOSIT_RESPONSE,
  TESTNET_PASSPHRASE,
  TX_AWAITING_TRANSFER,
  TX_COMPLETED_CLAIMABLE,
  TX_COMPLETED_PAYMENT,
  TX_ERROR_WITH_REFUND,
  TX_PENDING_ANCHOR,
  TX_PENDING_STELLAR,
  TX_PENDING_TRUST,
  TX_TREASURY_LOW,
  TX_UNKNOWN_STATUS,
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

const price: Price = {
  sellAmount: SEP38_PRICE_RESPONSE.sell_amount,
  buyAmount: SEP38_PRICE_RESPONSE.buy_amount,
  price: SEP38_PRICE_RESPONSE.price,
  totalPrice: SEP38_PRICE_RESPONSE.total_price,
  sellAsset: "iso4217:TRY",
  buyAsset: `stellar:USDC:${USDC_ISSUER}`,
};

const quote: Quote = {
  ...price,
  id: SEP38_QUOTE_RESPONSE.id,
  expiresAt: parseExpiresAt(SEP38_QUOTE_RESPONSE.expires_at),
};

const ticket: DepositTicket = {
  id: SEP6_DEPOSIT_RESPONSE.id,
  instructions: { all: {} },
};

/** Drive the machine to the point where the deposit is open and polling. */
function openDeposit(nowSeconds = QUOTE_EXPIRES_AT_SECONDS - 600): DepositState {
  let state = depositReducer(initialDepositState, { type: "START" });
  state = depositReducer(state, { type: "DISCOVERED", config });
  state = depositReducer(state, { type: "PRICED", price });
  state = depositReducer(state, { type: "AUTHENTICATE" });
  state = depositReducer(state, { type: "AUTHENTICATED" });
  state = depositReducer(state, { type: "QUOTED", quote, nowSeconds });
  return depositReducer(state, { type: "DEPOSIT_STARTED", ticket });
}

describe("the happy path walks every state in order", () => {
  it("IDLE -> DISCOVERING -> PRICING -> AUTHENTICATING -> QUOTING -> DEPOSIT_STARTED", () => {
    let state = initialDepositState;
    expect(state.name).toBe("IDLE");

    state = depositReducer(state, { type: "START", account: "GABC" });
    expect(state.name).toBe("DISCOVERING");

    state = depositReducer(state, { type: "DISCOVERED", config });
    expect(state.name).toBe("PRICING");
    expect(state.context.config).toBe(config);

    state = depositReducer(state, { type: "PRICED", price });
    expect(state.name).toBe("PRICING");
    expect(state.context.price?.buyAmount).toBe("4.0792181");

    state = depositReducer(state, { type: "AUTHENTICATE" });
    expect(state.name).toBe("AUTHENTICATING");

    state = depositReducer(state, { type: "AUTHENTICATED" });
    expect(state.name).toBe("QUOTING");

    state = depositReducer(state, {
      type: "QUOTED",
      quote,
      nowSeconds: QUOTE_EXPIRES_AT_SECONDS - 600,
    });
    expect(state.name).toBe("DEPOSIT_STARTED");

    state = depositReducer(state, { type: "DEPOSIT_STARTED", ticket });
    expect(state.name).toBe("AWAITING_BANK_TRANSFER");
    expect(state.context.depositId).toBe(SEP6_DEPOSIT_RESPONSE.id);
  });

  it("carries no token anywhere in its context", () => {
    const state = openDeposit();
    const serialised = JSON.stringify(state);

    expect(serialised).not.toMatch(/token/i);
    expect(serialised).not.toMatch(/authorization/i);
    expect(Object.keys(state.context)).not.toContain("token");
  });
});

describe("polled statuses drive the second half of the flow", () => {
  it("rehydrates an in-flight deposit without persisting a token", () => {
    const resumed = depositReducer(initialDepositState, {
      type: "RESUME",
      account: "GABC",
      config,
      depositId: SEP6_DEPOSIT_RESPONSE.id,
    });

    expect(resumed.name).toBe("AWAITING_BANK_TRANSFER");
    expect(resumed.context.depositId).toBe(SEP6_DEPOSIT_RESPONSE.id);
    expect(JSON.stringify(resumed)).not.toMatch(/token/i);
  });

  it("rehydrates claim recovery when the public balance id was persisted", () => {
    const resumed = depositReducer(initialDepositState, {
      type: "RESUME",
      account: "GABC",
      config,
      depositId: SEP6_DEPOSIT_RESPONSE.id,
      claimableBalanceId: "00".repeat(36),
    });

    expect(resumed.name).toBe("CLAIM_REQUIRED");
    expect(resumed.context.claimableBalanceId).toHaveLength(72);
  });

  it("pending_user_transfer_start keeps the user on the bank instructions", () => {
    const state = depositReducer(openDeposit(), {
      type: "STATUS_POLLED",
      status: parseDepositTransaction(TX_AWAITING_TRANSFER.transaction),
    });

    expect(state.name).toBe("AWAITING_BANK_TRANSFER");
    expect(shouldPoll(state)).toBe(true);
  });

  it("pending_anchor becomes ANCHOR_PROCESSING", () => {
    const state = depositReducer(openDeposit(), {
      type: "STATUS_POLLED",
      status: parseDepositTransaction(TX_PENDING_ANCHOR.transaction),
    });

    expect(state.name).toBe("ANCHOR_PROCESSING");
    expect(isWaitingOnAnchor(state)).toBe(true);
  });

  it("pending_stellar also becomes ANCHOR_PROCESSING", () => {
    const state = depositReducer(openDeposit(), {
      type: "STATUS_POLLED",
      status: parseDepositTransaction(TX_PENDING_STELLAR.transaction),
    });

    expect(state.name).toBe("ANCHOR_PROCESSING");
  });

  it("treasury_low gets its OWN state, not a silent spinner", () => {
    const state = depositReducer(openDeposit(), {
      type: "STATUS_POLLED",
      status: parseDepositTransaction(TX_TREASURY_LOW.transaction),
    });

    expect(state.name).toBe("TREASURY_LOW");
    // It waits. It is neither terminal nor an error.
    expect(isTerminalState(state)).toBe(false);
    expect(shouldPoll(state)).toBe(true);
    expect(describeState(state)).toMatch(/out of test USDC/i);
  });

  it("recovers from TREASURY_LOW to COMPLETED once the treasury is refilled", () => {
    let state = depositReducer(openDeposit(), {
      type: "STATUS_POLLED",
      status: parseDepositTransaction(TX_TREASURY_LOW.transaction),
    });
    expect(state.name).toBe("TREASURY_LOW");

    state = depositReducer(state, {
      type: "STATUS_POLLED",
      status: parseDepositTransaction(TX_COMPLETED_PAYMENT.transaction),
    });
    expect(state.name).toBe("COMPLETED");
  });

  it("a plain completed deposit is COMPLETED", () => {
    const state = depositReducer(openDeposit(), {
      type: "STATUS_POLLED",
      status: parseDepositTransaction(TX_COMPLETED_PAYMENT.transaction),
    });

    expect(state.name).toBe("COMPLETED");
    expect(isTerminalState(state)).toBe(true);
    expect(shouldPoll(state)).toBe(false);
  });

  it("completed WITH a claimable balance is CLAIM_REQUIRED, not COMPLETED", () => {
    // The status says `completed`, but the USDC is not in the wallet yet.
    // Reporting this as done would be the single most misleading thing the UI
    // could say.
    const state = depositReducer(openDeposit(), {
      type: "STATUS_POLLED",
      status: parseDepositTransaction(TX_COMPLETED_CLAIMABLE.transaction),
    });

    expect(state.name).toBe("CLAIM_REQUIRED");
    expect(state.context.claimableBalanceId).toHaveLength(72);
    expect(isTerminalState(state)).toBe(false);
    expect(describeState(state)).toMatch(/claimable balance/i);
  });

  it("pending_trust also reaches CLAIM_REQUIRED — same action, legacy trigger", () => {
    const state = depositReducer(openDeposit(), {
      type: "STATUS_POLLED",
      status: parseDepositTransaction(TX_PENDING_TRUST.transaction),
    });

    expect(state.name).toBe("CLAIM_REQUIRED");
  });

  it("CLAIMED closes out CLAIM_REQUIRED", () => {
    let state = depositReducer(openDeposit(), {
      type: "STATUS_POLLED",
      status: parseDepositTransaction(TX_COMPLETED_CLAIMABLE.transaction),
    });
    state = depositReducer(state, { type: "CLAIMED" });

    expect(state.name).toBe("COMPLETED");
    expect(state.context.claimableBalanceId).toBeUndefined();
  });

  it("error is terminal and keeps the Anchor's own words plus the refund", () => {
    const state = depositReducer(openDeposit(), {
      type: "STATUS_POLLED",
      status: parseDepositTransaction(TX_ERROR_WITH_REFUND.transaction),
    });

    expect(state.name).toBe("ERROR");
    expect(state.context.error?.userMessage).toMatch(/refunded/i);
    expect(state.context.error?.recovery).toBe("start_fresh_deposit");
    expect(state.context.status?.refunds?.amountRefunded).toBe("200.00");
    expect(isTerminalState(state)).toBe(true);
  });

  it.each(["refunded", "expired"] as const)(
    "%s is terminal rather than looking like Anchor processing",
    (status) => {
      const state = depositReducer(openDeposit(), {
        type: "STATUS_POLLED",
        status: parseDepositTransaction({
          id: SEP6_DEPOSIT_RESPONSE.id,
          status,
          message:
            status === "refunded"
              ? "The TRY amount was refunded."
              : "The deposit expired.",
        }),
      });

      expect(state.name).toBe("ERROR");
      expect(state.context.error?.userMessage).toMatch(
        status === "refunded" ? /refunded/i : /expired/i,
      );
      expect(isTerminalState(state)).toBe(true);
      expect(shouldPoll(state)).toBe(false);
    },
  );

  it("describes the legacy pending_trust path without claiming a balance id exists", () => {
    const state = depositReducer(openDeposit(), {
      type: "STATUS_POLLED",
      status: parseDepositTransaction(TX_PENDING_TRUST.transaction),
    });

    expect(state.context.claimableBalanceId).toBeUndefined();
    expect(describeState(state)).toMatch(/enable USDC/i);
    expect(describeState(state)).not.toMatch(/claims it/i);
  });

  it("an unrecognised status is reported as processing, never as done", () => {
    const state = depositReducer(openDeposit(), {
      type: "STATUS_POLLED",
      status: parseDepositTransaction(TX_UNKNOWN_STATUS.transaction),
    });

    expect(state.name).toBe("ANCHOR_PROCESSING");
  });

  it("ignores a poll that lands after a terminal state — a race, not a crash", () => {
    const completed = depositReducer(openDeposit(), {
      type: "STATUS_POLLED",
      status: parseDepositTransaction(TX_COMPLETED_PAYMENT.transaction),
    });

    const late = depositReducer(completed, {
      type: "STATUS_POLLED",
      status: parseDepositTransaction(TX_PENDING_ANCHOR.transaction),
    });

    expect(late).toBe(completed);
  });

  it("ignores a poll that lands after the user resets the flow", () => {
    const reset = depositReducer(openDeposit(), { type: "RESET" });
    const late = depositReducer(reset, {
      type: "STATUS_POLLED",
      status: parseDepositTransaction(TX_PENDING_ANCHOR.transaction),
    });

    expect(late).toBe(reset);
    expect(late.name).toBe("IDLE");
  });

  it("ignores a response for a different deposit id", () => {
    const active = openDeposit();
    const wrongDeposit = parseDepositTransaction({
      ...TX_PENDING_ANCHOR.transaction,
      id: "sep_old_deposit",
    });
    const late = depositReducer(active, {
      type: "STATUS_POLLED",
      status: wrongDeposit,
    });

    expect(late).toBe(active);
    expect(late.context.depositId).toBe(SEP6_DEPOSIT_RESPONSE.id);
  });
});

describe("quote expiry never blocks the deposit", () => {
  it("flags an expired quote but still opens the deposit", () => {
    let state = depositReducer(initialDepositState, { type: "START" });
    state = depositReducer(state, { type: "DISCOVERED", config });
    state = depositReducer(state, { type: "AUTHENTICATE" });
    state = depositReducer(state, { type: "AUTHENTICATED" });
    state = depositReducer(state, {
      type: "QUOTED",
      quote,
      nowSeconds: QUOTE_EXPIRES_AT_SECONDS + 1,
    });

    // Warned, not blocked: the Anchor falls back to the live rate.
    expect(state.context.quoteExpired).toBe(true);
    expect(state.name).toBe("DEPOSIT_STARTED");
    expect(state.name).not.toBe("ERROR");
  });

  it("does not flag a quote that is still inside its window", () => {
    const state = openDeposit(QUOTE_EXPIRES_AT_SECONDS - 1);
    expect(state.context.quoteExpired).toBe(false);
  });

  it("re-evaluates an active quote when its expiry time arrives", () => {
    const active = openDeposit(QUOTE_EXPIRES_AT_SECONDS - 1);
    const expired = depositReducer(active, {
      type: "QUOTE_EXPIRY_CHECKED",
      nowSeconds: QUOTE_EXPIRES_AT_SECONDS,
    });

    expect(expired.name).toBe("AWAITING_BANK_TRANSFER");
    expect(expired.context.quoteExpired).toBe(true);
    expect(expired.context.error).toBeUndefined();
  });

  it("keeps the refreshed indicative price separate from the expired firm quote", () => {
    const active = openDeposit(QUOTE_EXPIRES_AT_SECONDS - 1);
    const expired = depositReducer(active, {
      type: "QUOTE_EXPIRY_CHECKED",
      nowSeconds: QUOTE_EXPIRES_AT_SECONDS,
    });
    const refreshedPrice = { ...price, buyAmount: "3.9500000" };
    const repriced = depositReducer(expired, {
      type: "QUOTE_REPRICED",
      quoteId: quote.id,
      price: refreshedPrice,
    });

    expect(repriced.context.quote).toBe(quote);
    expect(repriced.context.expiredQuotePrice).toBe(refreshedPrice);
    expect(repriced.name).toBe("AWAITING_BANK_TRANSFER");
  });

  it("ignores late repricing for an unrelated quote", () => {
    const expired = depositReducer(
      openDeposit(QUOTE_EXPIRES_AT_SECONDS + 1),
      {
        type: "QUOTE_REPRICED",
        quoteId: "quote_from_an_old_flow",
        price,
      },
    );

    expect(expired.context.expiredQuotePrice).toBeUndefined();
  });

  it("a deposit with no quote at all still proceeds", () => {
    let state = depositReducer(initialDepositState, { type: "START" });
    state = depositReducer(state, { type: "DISCOVERED", config });
    state = depositReducer(state, { type: "AUTHENTICATE" });
    state = depositReducer(state, { type: "AUTHENTICATED" });
    state = depositReducer(state, { type: "QUOTE_SKIPPED" });

    expect(state.name).toBe("DEPOSIT_STARTED");
  });
});

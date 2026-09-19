/**
 * SEP-6 response parsing, from recorded fixtures.
 *
 * Three of the four assertions here exist because the hackathon `SKILL.md` gets
 * the corresponding fact wrong: the wrapped transaction payload, the
 * claimable-balance completion, and `pending_reason: "treasury_low"`.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { AnchorError } from "../errors";
import {
  isTerminalDepositStatus,
  parseInstructions,
  pollDepositUntilSettled,
  simulateMockBankTransfer,
  startDeposit,
  unwrapTransactionResponse,
} from "../sep6";
import type { AnchorConfig } from "../types";
import {
  ANCHOR_HOME_DOMAIN,
  ANCHOR_SIGNING_KEY,
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

const ACCOUNT = "GALBFBDQAAGLKLKCQDH7CNKKA2A7UT5APANR27FMGCNZXUTVKF2O253G";

/** Built from the recorded `stellar.toml` — no endpoint is hard-coded in tests. */
const config: AnchorConfig = {
  homeDomain: ANCHOR_HOME_DOMAIN,
  networkPassphrase: TESTNET_PASSPHRASE,
  signingKey: ANCHOR_SIGNING_KEY,
  webAuthEndpoint: `https://${ANCHOR_HOME_DOMAIN}/auth`,
  transferServer: `https://${ANCHOR_HOME_DOMAIN}/sep6`,
  quoteServer: `https://${ANCHOR_HOME_DOMAIN}/sep38`,
  asset: { code: "USDC", issuer: USDC_ISSUER },
};

describe("unwrapTransactionResponse", () => {
  it("reads the status from transaction.status, not the top level", () => {
    // Reading `status` off the top level yields undefined and makes every
    // deposit look permanently stuck. This is the guard against that.
    expect(TX_AWAITING_TRANSFER).not.toHaveProperty("status");

    const status = unwrapTransactionResponse(TX_AWAITING_TRANSFER);
    expect(status.status).toBe("pending_user_transfer_start");
    expect(status.id).toBe(SEP6_DEPOSIT_RESPONSE.id);
  });

  it("fails loudly on a response with no transaction wrapper", () => {
    expect(() =>
      unwrapTransactionResponse({ id: "sep_1", status: "completed" }),
    ).toThrowError(AnchorError);
  });

  it("recognises pending_stellar, which SKILL.md never mentions", () => {
    const status = unwrapTransactionResponse(TX_PENDING_STELLAR);
    expect(status.status).toBe("pending_stellar");
    expect(status.treasuryLow).toBe(false);
  });

  it("flags treasury_low, which waits rather than failing", () => {
    const status = unwrapTransactionResponse(TX_TREASURY_LOW);

    expect(status.pendingReason).toBe("treasury_low");
    expect(status.treasuryLow).toBe(true);
    // Still a pending status: the deposit settles once the treasury is refilled.
    expect(status.status).toBe("pending_anchor");
    expect(isTerminalDepositStatus(status)).toBe(false);
  });

  it("detects the claimable balance on a completed deposit", () => {
    const status = unwrapTransactionResponse(TX_COMPLETED_CLAIMABLE);

    expect(status.status).toBe("completed");
    expect(status.claimableBalanceId).toHaveLength(72);
    expect(status.stellarTransactionId).toBeDefined();
  });

  it("leaves claimableBalanceId undefined for a plain payment", () => {
    const status = unwrapTransactionResponse(TX_COMPLETED_PAYMENT);

    expect(status.status).toBe("completed");
    expect(status.claimableBalanceId).toBeUndefined();
    expect(status.amountOut).toBe("4.0792181");
  });

  it("carries the Anchor's own message and refunds through an error", () => {
    const status = unwrapTransactionResponse(TX_ERROR_WITH_REFUND);

    expect(status.status).toBe("error");
    expect(status.message).toMatch(/refunded/i);
    expect(status.refunds?.amountRefunded).toBe("200.00");
    expect(isTerminalDepositStatus(status)).toBe(true);
  });

  it("degrades an unrecognised status instead of guessing", () => {
    const status = unwrapTransactionResponse(TX_UNKNOWN_STATUS);

    expect(status.status).toBe("unknown");
    // The literal is preserved so a debug panel can still show the truth.
    expect(status.rawStatus).toBe("pending_something_new");
  });

  it("treats pending_trust as terminal for polling — it waits on the user", () => {
    const status = unwrapTransactionResponse(TX_PENDING_TRUST);
    expect(isTerminalDepositStatus(status)).toBe(true);
  });

  it("does not treat pending_anchor as terminal", () => {
    expect(isTerminalDepositStatus(unwrapTransactionResponse(TX_PENDING_ANCHOR))).toBe(
      false,
    );
  });
});

describe("parseInstructions", () => {
  it("names the transfer-description reference, the field a transfer is matched on", () => {
    const instructions = parseInstructions(SEP6_DEPOSIT_RESPONSE.instructions);

    expect(instructions.externalTransferMemo?.value).toBe("TRMA-7K2M-Q9XZ");
    expect(instructions.bankAccountNumber?.value).toMatch(/^TR\d{2}/);
    expect(instructions.bankName?.value).toBe("TR Mock Bank A.Ş.");
  });

  it("keeps every field the Anchor sent, including unnamed ones", () => {
    const instructions = parseInstructions({
      ...SEP6_DEPOSIT_RESPONSE.instructions,
      some_future_field: { value: "x", description: "added later" },
    });

    expect(Object.keys(instructions.all)).toContain("some_future_field");
  });

  it("survives a missing instructions block", () => {
    expect(parseInstructions(undefined).all).toEqual({});
  });
});

describe("startDeposit", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends funding_method=bank_account and never the deprecated type=", async () => {
    let requestedUrl = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        requestedUrl = url;
        return new Response(JSON.stringify(SEP6_DEPOSIT_RESPONSE), { status: 200 });
      }),
    );

    const ticket = await startDeposit({
      config,
      token: "a.b.c",
      account: ACCOUNT,
      amount: "200.00",
      quoteId: "quote_1",
    });

    const params = new URL(requestedUrl).searchParams;
    expect(params.get("funding_method")).toBe("bank_account");
    expect(params.has("type")).toBe(false);
    expect(params.get("asset_code")).toBe("USDC");
    expect(params.get("account")).toBe(ACCOUNT);
    expect(params.get("amount")).toBe("200.00");
    expect(params.get("quote_id")).toBe("quote_1");

    expect(ticket.id).toBe(SEP6_DEPOSIT_RESPONSE.id);
    expect(ticket.instructions.externalTransferMemo?.value).toBe("TRMA-7K2M-Q9XZ");
    expect(ticket.eta).toBe(5);
  });
});

describe("pollDepositUntilSettled", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps polling through treasury_low and stops at completed", async () => {
    const sequence = [TX_TREASURY_LOW, TX_TREASURY_LOW, TX_COMPLETED_PAYMENT];
    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        const body = sequence[Math.min(call, sequence.length - 1)];
        call += 1;
        return new Response(JSON.stringify(body), { status: 200 });
      }),
    );

    const seen: string[] = [];
    const final = await pollDepositUntilSettled(SEP6_DEPOSIT_RESPONSE.id, {
      config,
      token: "a.b.c",
      onUpdate: (status) => seen.push(status.rawStatus),
      // No real timer: the suite must never wait 3 seconds per poll.
      sleep: async () => {},
    });

    expect(seen).toEqual(["pending_anchor", "pending_anchor", "completed"]);
    expect(final.status).toBe("completed");
  });

  it("stops immediately on a terminal error", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify(TX_ERROR_WITH_REFUND), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const final = await pollDepositUntilSettled(SEP6_DEPOSIT_RESPONSE.id, {
      config,
      token: "a.b.c",
      sleep: async () => {},
    });

    expect(final.status).toBe("error");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("simulateMockBankTransfer", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("refuses to run unless demo tools are explicitly enabled", async () => {
    // It is a Mock-Anchor convenience endpoint, not a banking API. The gate is
    // what keeps it out of any build that is not labelled a Testnet demo.
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      simulateMockBankTransfer(SEP6_DEPOSIT_RESPONSE.id, "200.00", {
        config,
        token: "a.b.c",
      }),
    ).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof AnchorError && error.kind === "demo_tools_disabled",
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POSTs {amount} and parses nothing back — the body is undocumented", async () => {
    let requestedUrl = "";
    let requestBody: string | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        requestedUrl = url;
        requestBody = init.body as string;
        // Deliberately not JSON: the caller must not depend on the response.
        return new Response("ok", { status: 200 });
      }),
    );

    await simulateMockBankTransfer(SEP6_DEPOSIT_RESPONSE.id, "150.00", {
      config,
      token: "a.b.c",
      allowWithoutDemoFlag: true,
    });

    expect(requestedUrl).toBe(
      `https://tr-mock-anchor.fly.dev/sep6/tx/${SEP6_DEPOSIT_RESPONSE.id}/simulate-bank-transfer`,
    );
    expect(JSON.parse(requestBody!)).toEqual({ amount: "150.00" });
  });
});

/**
 * SEP-6 — deposit, status polling, and the sandbox bank-transfer trigger.
 *
 * Four things here are easy to get wrong and are all verified:
 *  1. The parameter is `funding_method=bank_account`. `type=` is deprecated.
 *  2. `GET /sep6/transaction?id=` WRAPS its payload — the status is at
 *     `transaction.status`, not at the top level.
 *  3. `pending_reason: "treasury_low"` means WAIT, not fail.
 *  4. A missing trustline produces a `claimable_balance_id` on a `completed`
 *     deposit, not a `pending_trust` wall.
 */

import {
  ANCHOR_ASSET_CODE,
  DEPOSIT_POLL_INTERVAL_MS,
  DEPOSIT_POLL_MAX_ATTEMPTS,
  FUNDING_METHOD,
  isDemoToolsEnabled,
} from "./config";
import { AnchorError } from "./errors";
import {
  anchorRequest,
  buildUrl,
  optionalString,
  requireRecord,
  requireString,
} from "./http";
import type {
  AnchorConfig,
  BankInstructions,
  DepositRefunds,
  DepositStatus,
  DepositStatusCode,
  DepositTicket,
  InstructionField,
} from "./types";

const KNOWN_STATUSES: ReadonlySet<string> = new Set<DepositStatusCode>([
  "incomplete",
  "pending_user_transfer_start",
  "pending_user_transfer_complete",
  "pending_external",
  "pending_anchor",
  "pending_stellar",
  "pending_trust",
  "pending_customer_info_update",
  "completed",
  "refunded",
  "expired",
  "error",
]);

function parseInstructionField(value: unknown): InstructionField | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const fieldValue = optionalString(record.value);
  if (fieldValue === undefined) return undefined;
  return { value: fieldValue, description: optionalString(record.description) };
}

/**
 * Map the SEP-9 `instructions` block onto named fields.
 *
 * `all` keeps everything, including fields this type does not name, so a new
 * instruction the Anchor adds still reaches the screen instead of vanishing.
 */
export function parseInstructions(value: unknown): BankInstructions {
  const all: Record<string, InstructionField> = {};

  if (value && typeof value === "object") {
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      const field = parseInstructionField(raw);
      if (field) {
        all[key] = field;
      }
    }
  }

  return {
    bankName: all.bank_name,
    bankAccountNumber: all.bank_account_number,
    accountHolder: all.bank_account_holder ?? all.account_holder,
    externalTransferMemo: all.external_transfer_memo,
    all,
  };
}

export type StartDepositOptions = {
  config: AnchorConfig;
  /** SEP-10 token. SEP-6 deposit is authenticated; SEP-12 is NOT called. */
  token: string;
  /** Destination `G…` (or muxed `M…`) that will receive the USDC. */
  account: string;
  /** TRY amount, as a decimal string. Optional — the Anchor accepts none. */
  amount?: string;
  /** A SEP-38 quote id to lock the rate. Optional; live rate without one. */
  quoteId?: string;
  /** Optional text memo on the on-ramp payment, truncated to 28 bytes. */
  memo?: string;
  signal?: AbortSignal;
};

/**
 * `GET {TRANSFER_SERVER}/deposit?…&funding_method=bank_account`.
 *
 * Returns the transaction id to poll and the SEP-9 bank instructions to show.
 * The `external_transfer_memo` is the transfer-description reference — a TRY transfer that
 * omits it is not matched, so it is the most important value on the screen.
 */
export async function startDeposit(
  options: StartDepositOptions,
): Promise<DepositTicket> {
  const { config, token, account } = options;

  const url = buildUrl(config.transferServer, "/deposit", {
    asset_code: config.asset.code || ANCHOR_ASSET_CODE,
    account,
    funding_method: FUNDING_METHOD,
    amount: options.amount,
    quote_id: options.quoteId,
    memo: options.memo,
  });

  const payload = requireRecord(
    await anchorRequest<unknown>(url, { token, signal: options.signal }),
    "SEP-6 deposit",
  );

  const extraInfo =
    payload.extra_info && typeof payload.extra_info === "object"
      ? (payload.extra_info as Record<string, unknown>)
      : undefined;

  return {
    id: requireString(payload, "id", "SEP-6 deposit"),
    instructions: parseInstructions(payload.instructions),
    how: optionalString(payload.how),
    eta: typeof payload.eta === "number" ? payload.eta : undefined,
    feePercent:
      typeof payload.fee_percent === "number" ? payload.fee_percent : undefined,
    moreInfoUrl: optionalString(payload.more_info_url),
    extraInfoMessage: extraInfo ? optionalString(extraInfo.message) : undefined,
  };
}

function parseRefunds(value: unknown): DepositRefunds | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  return {
    amountRefunded: optionalString(record.amount_refunded),
    amountFee: optionalString(record.amount_fee),
    payments: Array.isArray(record.payments)
      ? (record.payments as Record<string, unknown>[])
      : undefined,
  };
}

/**
 * Map one raw SEP-6 transaction object onto `DepositStatus`.
 *
 * Exported because it is the boundary the fixtures test: everything downstream
 * — the state machine, the UI — reads only this shape.
 */
export function parseDepositTransaction(value: unknown): DepositStatus {
  const tx = requireRecord(value, "SEP-6 transaction");
  const rawStatus = requireString(tx, "status", "SEP-6 transaction");
  const pendingReason = optionalString(tx.pending_reason);

  return {
    id: requireString(tx, "id", "SEP-6 transaction"),
    status: KNOWN_STATUSES.has(rawStatus)
      ? (rawStatus as DepositStatusCode)
      : "unknown",
    rawStatus,
    pendingReason,
    treasuryLow: pendingReason === "treasury_low",
    claimableBalanceId: optionalString(tx.claimable_balance_id),
    stellarTransactionId: optionalString(tx.stellar_transaction_id),
    externalTransactionId: optionalString(tx.external_transaction_id),
    amountIn: optionalString(tx.amount_in),
    amountInAsset: optionalString(tx.amount_in_asset),
    amountOut: optionalString(tx.amount_out),
    amountOutAsset: optionalString(tx.amount_out_asset),
    amountFee: optionalString(tx.amount_fee),
    message: optionalString(tx.message),
    moreInfoUrl: optionalString(tx.more_info_url),
    refunds: parseRefunds(tx.refunds),
    startedAt: optionalString(tx.started_at),
    completedAt: optionalString(tx.completed_at),
  };
}

/**
 * Unwrap `GET /sep6/transaction`.
 *
 * The response is `{ "transaction": { … } }`. Reading `status` off the top
 * level silently yields `undefined` and makes every deposit look stuck, which
 * is exactly the bug this function exists to prevent.
 */
export function unwrapTransactionResponse(payload: unknown): DepositStatus {
  const record = requireRecord(payload, "SEP-6 transaction");
  if (!("transaction" in record)) {
    throw new AnchorError(
      "protocol",
      'The Anchor\'s transaction response has no "transaction" wrapper.',
    );
  }
  return parseDepositTransaction(record.transaction);
}

export type PollDepositOptions = {
  config: AnchorConfig;
  token: string;
  signal?: AbortSignal;
};

/** One `GET {TRANSFER_SERVER}/transaction?id=…`. */
export async function pollDeposit(
  id: string,
  options: PollDepositOptions,
): Promise<DepositStatus> {
  const url = buildUrl(options.config.transferServer, "/transaction", { id });
  const payload = await anchorRequest<unknown>(url, {
    token: options.token,
    signal: options.signal,
  });
  return unwrapTransactionResponse(payload);
}

/** Terminal for polling purposes. `pending_trust` waits for the user, not the Anchor. */
export function isTerminalDepositStatus(status: DepositStatus): boolean {
  return (
    status.status === "completed" ||
    status.status === "error" ||
    status.status === "refunded" ||
    status.status === "expired" ||
    status.status === "pending_trust"
  );
}

export type PollUntilSettledOptions = PollDepositOptions & {
  /** Called after every poll, including the first. */
  onUpdate?: (status: DepositStatus) => void;
  intervalMs?: number;
  maxAttempts?: number;
  /** Injectable so tests never wait on a real timer. */
  sleep?: (ms: number) => Promise<void>;
};

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Poll every ~3 s until the deposit settles.
 *
 * `treasury_low` is NOT a stop condition — the deposit waits and then settles.
 * The caller learns about it through `onUpdate`, which is how the UI shows an
 * explicit "the sandbox is out of test USDC" message instead of a spinner that
 * looks like a broken demo.
 */
export async function pollDepositUntilSettled(
  id: string,
  options: PollUntilSettledOptions,
): Promise<DepositStatus> {
  const interval = options.intervalMs ?? DEPOSIT_POLL_INTERVAL_MS;
  const maxAttempts = options.maxAttempts ?? DEPOSIT_POLL_MAX_ATTEMPTS;
  const sleep = options.sleep ?? defaultSleep;

  let latest: DepositStatus | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (options.signal?.aborted) {
      break;
    }

    latest = await pollDeposit(id, options);
    options.onUpdate?.(latest);

    if (isTerminalDepositStatus(latest)) {
      return latest;
    }

    await sleep(interval);
  }

  if (!latest) {
    throw new AnchorError("protocol", "The deposit was never read.");
  }
  return latest;
}

/**
 * MOCK ONLY. Triggers the sandbox's simulated incoming TRY transfer.
 *
 * This is not a SEP-6 endpoint and not a banking API. It is the Mock Anchor's
 * stand-in for a real bank integration calling in, and the name says so in full
 * so it cannot be mistaken for a production capability at a glance. It is gated
 * behind `NEXT_PUBLIC_ENABLE_DEMO_TOOLS` and must be labelled in the UI as a
 * Testnet simulation step.
 *
 * The response body is UNDOCUMENTED, so this is fire-and-then-poll: nothing is
 * parsed out of it, and the caller learns the outcome from `pollDeposit`.
 */
export async function simulateMockBankTransfer(
  id: string,
  amount: string,
  options: {
    config: AnchorConfig;
    token: string;
    signal?: AbortSignal;
    /** Escape hatch for a script that is not running in the Next.js app. */
    allowWithoutDemoFlag?: boolean;
  },
): Promise<void> {
  if (!options.allowWithoutDemoFlag && !isDemoToolsEnabled()) {
    throw new AnchorError(
      "demo_tools_disabled",
      "The simulated bank transfer is a demo-only tool and is currently disabled.",
    );
  }

  const url = buildUrl(
    options.config.transferServer,
    `/tx/${encodeURIComponent(id)}/simulate-bank-transfer`,
  );

  await anchorRequest<unknown>(url, {
    method: "POST",
    token: options.token,
    body: { amount },
    signal: options.signal,
    // The response body is undocumented, so it is not read at all. A rejection
    // still surfaces normally; a success is followed by polling.
    expectJson: false,
  });
}

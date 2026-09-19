/**
 * The deposit state machine (SYSTEM.md section 11).
 *
 * A pure reducer over a typed state union. No I/O, no timers, no React — the
 * caller performs the effect and feeds the result back in as an action, which
 * is what makes every transition in this file testable without a network.
 *
 * The JWT is deliberately ABSENT from the state. The machine's state is the
 * thing a component renders and a devtool inspects; a bearer token has no
 * business in either. The deposit id, quote id and claimable balance id are all
 * here, because those are public references.
 */

import { AnchorError } from "./errors";
import { needsClaim } from "./claim";
import { isQuoteExpired } from "./sep38";
import type {
  AnchorConfig,
  DepositStatus,
  DepositTicket,
  Price,
  Quote,
} from "./types";

/** Every state in the section 11 diagram, and no others. */
export type DepositStateName =
  | "IDLE"
  | "DISCOVERING"
  | "PRICING"
  | "AUTHENTICATING"
  | "QUOTING"
  | "DEPOSIT_STARTED"
  | "AWAITING_BANK_TRANSFER"
  | "ANCHOR_PROCESSING"
  | "TREASURY_LOW"
  | "COMPLETED"
  | "CLAIM_REQUIRED"
  | "ERROR";

/**
 * Everything learned so far, carried through every state.
 *
 * Kept as one bag rather than per-state payloads because a reload resumes from
 * `sessionStorage` into the middle of the flow, and a state whose shape depends
 * on how it was reached cannot be rehydrated.
 */
export type DepositContext = {
  config?: AnchorConfig;
  /** The indicative price shown before the wallet is connected. */
  price?: Price;
  /** The firm quote, if one was taken. A deposit works without one. */
  quote?: Quote;
  /** True once the quote's `expires_at` has passed. A WARNING, never a block. */
  quoteExpired: boolean;
  ticket?: DepositTicket;
  /** The SEP-6 transaction id. Persisted across reloads. */
  depositId?: string;
  /** The most recent poll. */
  status?: DepositStatus;
  /** Set when the Anchor issued a claimable balance instead of a payment. */
  claimableBalanceId?: string;
  /** The account being funded. */
  account?: string;
  error?: AnchorError;
};

export type DepositState = {
  name: DepositStateName;
  context: DepositContext;
};

/** Actions the caller dispatches after performing an effect. */
export type DepositAction =
  | { type: "START"; account?: string }
  | {
      type: "RESUME";
      account: string;
      config: AnchorConfig;
      depositId: string;
      claimableBalanceId?: string;
    }
  | { type: "DISCOVERED"; config: AnchorConfig }
  | { type: "PRICED"; price: Price }
  | { type: "AUTHENTICATE" }
  | { type: "AUTHENTICATED" }
  | { type: "QUOTED"; quote: Quote; nowSeconds: number }
  | { type: "QUOTE_SKIPPED" }
  | { type: "DEPOSIT_STARTED"; ticket: DepositTicket }
  /** The only action that drives the second half of the flow. */
  | { type: "STATUS_POLLED"; status: DepositStatus }
  /** The recovery transaction succeeded. */
  | { type: "CLAIMED" }
  | { type: "FAILED"; error: AnchorError }
  | { type: "RESET" };

export const initialDepositState: DepositState = {
  name: "IDLE",
  context: { quoteExpired: false },
};

/** Terminal states. `TREASURY_LOW` is NOT one of them — it settles on its own. */
export function isTerminalState(state: DepositState): boolean {
  return state.name === "COMPLETED" || state.name === "ERROR";
}

/** True while the flow is waiting on the Anchor rather than on the user. */
export function isWaitingOnAnchor(state: DepositState): boolean {
  return state.name === "ANCHOR_PROCESSING" || state.name === "TREASURY_LOW";
}

/** True when the UI should keep polling `GET /sep6/transaction`. */
export function shouldPoll(state: DepositState): boolean {
  return (
    state.name === "DEPOSIT_STARTED" ||
    state.name === "AWAITING_BANK_TRANSFER" ||
    state.name === "ANCHOR_PROCESSING" ||
    state.name === "TREASURY_LOW"
  );
}

/**
 * Map a polled SEP-6 status onto the state it implies.
 *
 * The order of these checks is the whole design:
 *  - `treasury_low` is checked BEFORE the generic pending states, because it is
 *    a distinct thing to say to the user, not a variant of "processing".
 *  - the claim check comes BEFORE plain completion, because a `completed`
 *    deposit carrying a `claimable_balance_id` has not actually delivered the
 *    USDC yet.
 */
function stateForStatus(status: DepositStatus): DepositStateName {
  if (
    status.status === "error" ||
    status.status === "refunded" ||
    status.status === "expired"
  ) {
    return "ERROR";
  }
  if (status.treasuryLow) {
    return "TREASURY_LOW";
  }
  if (needsClaim(status)) {
    return "CLAIM_REQUIRED";
  }
  if (status.status === "completed") {
    return "COMPLETED";
  }
  if (
    status.status === "pending_user_transfer_start" ||
    status.status === "incomplete"
  ) {
    return "AWAITING_BANK_TRANSFER";
  }
  // pending_anchor, pending_stellar, pending_external,
  // pending_user_transfer_complete, pending_customer_info_update and anything
  // unrecognised: the Anchor is working. Reported honestly as processing rather
  // than guessed at.
  return "ANCHOR_PROCESSING";
}

/** Copy for a state, so the UI never has to invent it. */
export function describeState(state: DepositState): string {
  switch (state.name) {
    case "IDLE":
      return "Ready to add funds with TRY.";
    case "DISCOVERING":
      return "Reading the Anchor's configuration.";
    case "PRICING":
      return "Checking the current TRY to USDC rate.";
    case "AUTHENTICATING":
      return "Waiting for your wallet signature to sign in to the Anchor.";
    case "QUOTING":
      return "Locking your rate.";
    case "DEPOSIT_STARTED":
      return "Your deposit has been opened.";
    case "AWAITING_BANK_TRANSFER":
      return "Send the TRY transfer with the reference shown, then this updates automatically.";
    case "ANCHOR_PROCESSING":
      return "The Anchor received your TRY and is sending USDC.";
    case "TREASURY_LOW":
      return "The sandbox is out of test USDC — your deposit will settle when it is refilled. Nothing is wrong and nothing is lost.";
    case "COMPLETED":
      return "Your USDC has arrived.";
    case "CLAIM_REQUIRED":
      return state.context.claimableBalanceId
        ? "Your USDC arrived as a claimable balance because the account had no USDC trustline. One transaction adds the trustline and claims it."
        : "The Anchor is waiting for a USDC trustline. Enable USDC, then resume the deposit.";
    case "ERROR":
      return state.context.error?.userMessage ?? "The deposit failed.";
  }
}

/**
 * The reducer.
 *
 * Unknown transitions return the state UNCHANGED rather than throwing: a poll
 * that lands after the user has already reset the flow is a race, not a bug,
 * and crashing on it would take the page down for a harmless reason.
 */
export function depositReducer(
  state: DepositState,
  action: DepositAction,
): DepositState {
  switch (action.type) {
    case "RESET":
      return initialDepositState;

    case "FAILED":
      return {
        name: "ERROR",
        context: { ...state.context, error: action.error },
      };

    case "START":
      return {
        name: "DISCOVERING",
        context: {
          ...initialDepositState.context,
          account: action.account ?? state.context.account,
        },
      };

    case "RESUME":
      return {
        name: action.claimableBalanceId
          ? "CLAIM_REQUIRED"
          : "AWAITING_BANK_TRANSFER",
        context: {
          quoteExpired: false,
          account: action.account,
          config: action.config,
          depositId: action.depositId,
          claimableBalanceId: action.claimableBalanceId,
        },
      };

    case "DISCOVERED":
      if (state.name !== "DISCOVERING") return state;
      return {
        name: "PRICING",
        context: { ...state.context, config: action.config },
      };

    case "PRICED":
      // Pricing is public, so it can also refresh later in the flow without
      // moving the machine. Only an actual PRICING state advances.
      if (state.name !== "PRICING") {
        return { ...state, context: { ...state.context, price: action.price } };
      }
      return {
        name: "PRICING",
        context: { ...state.context, price: action.price },
      };

    case "AUTHENTICATE":
      if (state.name !== "PRICING") return state;
      return { name: "AUTHENTICATING", context: state.context };

    case "AUTHENTICATED":
      if (state.name !== "AUTHENTICATING") return state;
      return { name: "QUOTING", context: state.context };

    case "QUOTED": {
      if (state.name !== "QUOTING") return state;
      return {
        name: "DEPOSIT_STARTED",
        context: {
          ...state.context,
          quote: action.quote,
          quoteExpired: isQuoteExpired(action.quote, action.nowSeconds),
        },
      };
    }

    case "QUOTE_SKIPPED":
      // A quote is optional — without one the Anchor prices at the live rate.
      if (state.name !== "QUOTING") return state;
      return { name: "DEPOSIT_STARTED", context: state.context };

    case "DEPOSIT_STARTED":
      if (state.name !== "DEPOSIT_STARTED" && state.name !== "QUOTING") {
        return state;
      }
      return {
        name: "AWAITING_BANK_TRANSFER",
        context: {
          ...state.context,
          ticket: action.ticket,
          depositId: action.ticket.id,
        },
      };

    case "STATUS_POLLED": {
      const canAcceptPoll =
        state.name === "AWAITING_BANK_TRANSFER" ||
        state.name === "ANCHOR_PROCESSING" ||
        state.name === "TREASURY_LOW" ||
        state.name === "CLAIM_REQUIRED";

      if (
        !canAcceptPoll ||
        !state.context.depositId ||
        action.status.id !== state.context.depositId
      ) {
        return state;
      }

      const next = stateForStatus(action.status);
      const context: DepositContext = {
        ...state.context,
        status: action.status,
        depositId: state.context.depositId,
        claimableBalanceId:
          action.status.claimableBalanceId ?? state.context.claimableBalanceId,
      };

      if (next === "ERROR") {
        return {
          name: "ERROR",
          context: {
            ...context,
            error: new AnchorError(
              "server_rejected",
              "The Anchor could not complete this deposit.",
              {
                serverMessage: action.status.message,
                recovery: "start_fresh_deposit",
              },
            ),
          },
        };
      }

      return { name: next, context };
    }

    case "CLAIMED":
      if (state.name !== "CLAIM_REQUIRED") return state;
      return {
        name: "COMPLETED",
        context: { ...state.context, claimableBalanceId: undefined },
      };

    default:
      return state;
  }
}

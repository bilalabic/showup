"use client";

import { useEffect, useReducer, useRef, useState } from "react";

import { publishTechnicalEvidence } from "@/components/debug/evidence-events";
import {
  TxStatus,
  txFailureState,
  type TxState,
} from "@/components/tx/tx-status";
import { Button } from "@/components/ui/button";
import { AnchorProgress } from "@/components/wallet/anchor-progress";
import { EnableUsdcAction } from "@/components/wallet/enable-usdc-action";
import {
  AnchorError,
  DEPOSIT_POLL_INTERVAL_MS,
  DEPOSIT_POLL_MAX_ATTEMPTS,
  EXPIRED_QUOTE_WARNING,
  clearDeposit,
  contextualizeAnchorError,
  depositReducer,
  describeState,
  discover,
  getFirmQuote,
  getIndicativePrice,
  initialDepositState,
  isAnchorError,
  isDemoToolsEnabled,
  isTerminalDepositStatus,
  loadDeposit,
  pollDeposit,
  saveDeposit,
  simulateMockBankTransfer,
  startDeposit,
  updateDeposit,
  withFreshToken,
  type AnchorConfig,
  type AnchorOperation,
  type PersistedDeposit,
} from "@/lib/anchor";
import { userFacingError } from "@/lib/domain";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import {
  buildClaimWithTrustlineXdr,
  getHorizon,
  submitSignedTransaction,
} from "@/lib/stellar";
import { isWalletError } from "@/lib/wallet/port";
import { useWallet } from "@/lib/wallet/provider";

const AMOUNT_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;

function isPositiveTryAmount(value: string): boolean {
  if (!AMOUNT_PATTERN.test(value)) return false;
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, "0")) > 0n;
}

function failureMessage(error: unknown): string {
  if (isAnchorError(error)) return error.userMessage;
  if (isWalletError(error)) {
    switch (error.kind) {
      case "rejected":
        return "You declined the signature. No Anchor session or transaction was created.";
      case "wrong_network":
        return "Your wallet is not on Stellar Testnet. Switch networks and try again.";
      case "no_wallet":
        return "Freighter is not available. Install or unlock it, then try again.";
      case "mobile_wallet_unconfigured":
        return "Mobile wallet connection is not configured for this deployment.";
      case "not_connected":
        return "Your wallet disconnected. Reconnect and try again.";
      case "account_changed":
        return "Your wallet is using a different account. Reconnect the intended account and try again.";
      default:
        return "The wallet could not complete the request. Please try again.";
    }
  }
  return userFacingError(
    error,
    "The funding request could not be completed. Please try again.",
  );
}

function toMachineError(error: unknown): AnchorError {
  if (isAnchorError(error)) return error;
  return new AnchorError("protocol", failureMessage(error), { cause: error });
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timeout = window.setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timeout);
        resolve();
      },
      { once: true },
    );
  });
}

function safeHttpUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? parsed.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

export function AnchorDeposit({ onSettled }: { onSettled?: () => void }) {
  const { address, canTransact, signTransaction } = useWallet();
  const [state, dispatch] = useReducer(depositReducer, initialDepositState);
  const [amount, setAmount] = useState("150.00");
  const [amountError, setAmountError] = useState<string | null>(null);
  const [recoveryTx, setRecoveryTx] = useState<TxState>({ kind: "idle" });
  const [pollWarning, setPollWarning] = useState<string | null>(null);
  const polling = useRef<AbortController | null>(null);
  const flow = useRef<AbortController | null>(null);
  const flowBusy = useRef(false);

  const saved = useAsyncData<PersistedDeposit | undefined>(
    async () => loadDeposit(),
    [address],
    { enabled: Boolean(address) },
  );

  useEffect(
    () => () => {
      polling.current?.abort();
      flow.current?.abort();
    },
    [],
  );

  const activeQuote = state.context.quote;
  const activeConfig = state.context.config;
  const quoteExpired = state.context.quoteExpired;

  useEffect(() => {
    publishTechnicalEvidence({
      quoteId: activeQuote?.id ?? null,
      anchorTransactionId: state.context.depositId ?? null,
    });
  }, [activeQuote?.id, state.context.depositId]);

  useEffect(() => {
    if (!activeQuote || quoteExpired) return;

    // Add a small boundary margin so Date.now(), rounded down to seconds by
    // the reducer, cannot observe the quote one tick before expires_at.
    const delay = Math.max(0, activeQuote.expiresAt * 1000 - Date.now() + 25);
    const timeout = window.setTimeout(() => {
      dispatch({
        type: "QUOTE_EXPIRY_CHECKED",
        nowSeconds: Math.floor(Date.now() / 1000),
      });
    }, delay);

    return () => window.clearTimeout(timeout);
  }, [activeQuote, quoteExpired]);

  useEffect(() => {
    if (!activeQuote || !activeConfig || !quoteExpired) return;

    const controller = new AbortController();
    void getIndicativePrice(activeQuote.sellAmount, {
      config: activeConfig,
      signal: controller.signal,
    })
      .then((price) => {
        if (!controller.signal.aborted) {
          dispatch({ type: "QUOTE_REPRICED", quoteId: activeQuote.id, price });
        }
      })
      .catch(() => {
        // Repricing is best-effort. Expiry remains warning-only and must never
        // turn a valid deposit into an error.
      });

    return () => controller.abort();
  }, [activeConfig, activeQuote, quoteExpired]);

  const signer = address
    ? {
        address,
        signTransaction: (xdr: string) => signTransaction(xdr, address),
      }
    : null;

  function beginFlow(): AbortController | null {
    if (flowBusy.current) return null;
    flowBusy.current = true;
    flow.current?.abort();
    const controller = new AbortController();
    flow.current = controller;
    return controller;
  }

  function finishFlow(controller: AbortController) {
    if (flow.current === controller) {
      flow.current = null;
      flowBusy.current = false;
    }
  }

  async function pollUntilStopped(config: AnchorConfig, depositId: string) {
    if (!signer) return;

    polling.current?.abort();
    const controller = new AbortController();
    polling.current = controller;
    setPollWarning(null);

    try {
      for (
        let attempt = 0;
        attempt < DEPOSIT_POLL_MAX_ATTEMPTS && !controller.signal.aborted;
        attempt += 1
      ) {
        const status = await withFreshToken(
          signer,
          (token) =>
            pollDeposit(depositId, {
              config,
              token,
              signal: controller.signal,
            }),
          { config, signal: controller.signal },
        );

        if (controller.signal.aborted) return;
        dispatch({ type: "STATUS_POLLED", status });
        if (status.claimableBalanceId) {
          updateDeposit({ claimableBalanceId: status.claimableBalanceId });
        }

        if (isTerminalDepositStatus(status)) {
          if (
            status.status !== "pending_trust" &&
            !status.claimableBalanceId
          ) {
            clearDeposit();
            saved.reload();
          }
          if (status.status === "completed" && !status.claimableBalanceId) {
            onSettled?.();
          }
          return;
        }

        await wait(DEPOSIT_POLL_INTERVAL_MS, controller.signal);
      }

      if (!controller.signal.aborted) {
        setPollWarning(
          "Automatic status checks paused after five minutes. The deposit is still tracked; resume polling when you are ready.",
        );
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setPollWarning(
          `${failureMessage(error)} The deposit is still tracked; resume polling to try again.`,
        );
      }
    }
  }

  async function priceDeposit() {
    if (!address || !canTransact) return;
    const controller = beginFlow();
    if (!controller) return;

    const trimmed = amount.trim();
    if (!isPositiveTryAmount(trimmed)) {
      setAmountError("Enter a positive TRY amount with at most two decimals.");
      finishFlow(controller);
      return;
    }

    setAmountError(null);
    dispatch({ type: "START", account: address });
    try {
      const config = await discover();
      if (controller.signal.aborted) return;
      dispatch({ type: "DISCOVERED", config });
      const price = await getIndicativePrice(trimmed, {
        config,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      dispatch({ type: "PRICED", price });
    } catch (error) {
      if (!controller.signal.aborted) {
        dispatch({ type: "FAILED", error: toMachineError(error) });
      }
    } finally {
      finishFlow(controller);
    }
  }

  async function openDeposit() {
    if (!signer || !state.context.config || !state.context.price) return;
    const controller = beginFlow();
    if (!controller) return;

    const config = state.context.config;
    const trimmed = amount.trim();
    let operation: AnchorOperation = "sign_in";
    dispatch({ type: "AUTHENTICATE" });

    try {
      await withFreshToken(signer, async () => undefined, {
        config,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      dispatch({ type: "AUTHENTICATED" });

      operation = "quote";
      const quote = await withFreshToken(
        signer,
        (token) =>
          getFirmQuote({
            config,
            token,
            sellAmount: trimmed,
            signal: controller.signal,
          }),
        { config, signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      dispatch({
        type: "QUOTED",
        quote,
        nowSeconds: Math.floor(Date.now() / 1000),
      });

      operation = "deposit";
      const ticket = await withFreshToken(
        signer,
        (token) =>
          startDeposit({
            config,
            token,
            account: signer.address,
            amount: trimmed,
            quoteId: quote.id,
            signal: controller.signal,
          }),
        { config, signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      dispatch({ type: "DEPOSIT_STARTED", ticket });
      saveDeposit({
        account: signer.address,
        depositId: ticket.id,
        quoteId: quote.id,
      });
      saved.reload();
      void pollUntilStopped(config, ticket.id);
    } catch (error) {
      if (!controller.signal.aborted) {
        dispatch({
          type: "FAILED",
          error: contextualizeAnchorError(toMachineError(error), operation),
        });
      }
    } finally {
      finishFlow(controller);
    }
  }

  async function resumeDeposit(record: PersistedDeposit) {
    if (!signer || record.account !== signer.address) return;
    const controller = beginFlow();
    if (!controller) return;

    try {
      const config = await discover();
      if (controller.signal.aborted) return;
      dispatch({
        type: "RESUME",
        account: signer.address,
        config,
        depositId: record.depositId,
        claimableBalanceId: record.claimableBalanceId,
      });
      if (!record.claimableBalanceId) {
        void pollUntilStopped(config, record.depositId);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        dispatch({ type: "FAILED", error: toMachineError(error) });
      }
    } finally {
      finishFlow(controller);
    }
  }

  async function simulateTransfer() {
    if (
      !signer ||
      !state.context.config ||
      !state.context.depositId ||
      !amount.trim()
    ) {
      return;
    }
    const controller = beginFlow();
    if (!controller) return;

    try {
      await withFreshToken(
        signer,
        (token) =>
          simulateMockBankTransfer(state.context.depositId!, amount.trim(), {
            config: state.context.config!,
            token,
            signal: controller.signal,
          }),
        { config: state.context.config, signal: controller.signal },
      );
    } catch (error) {
      if (!controller.signal.aborted) {
        setPollWarning(failureMessage(error));
      }
    } finally {
      finishFlow(controller);
    }
  }

  async function claimBalance() {
    if (
      !signer ||
      !state.context.config ||
      !state.context.claimableBalanceId
    ) {
      return;
    }
    const controller = beginFlow();
    if (!controller) return;

    setRecoveryTx({ kind: "running", phase: "simulating" });
    try {
      const account = await getHorizon().loadAccount(signer.address);
      if (controller.signal.aborted) return;
      const unsigned = buildClaimWithTrustlineXdr({
        accountId: signer.address,
        sequence: account.sequenceNumber(),
        claimableBalanceId: state.context.claimableBalanceId,
        asset: state.context.config.asset,
      });
      setRecoveryTx({ kind: "running", phase: "awaiting_signature" });
      const signed = await signer.signTransaction(unsigned);
      if (controller.signal.aborted) return;
      setRecoveryTx({ kind: "running", phase: "submitting" });
      const { hash } = await submitSignedTransaction(signed);
      setRecoveryTx({
        kind: "success",
        hash,
        message: "The claimable USDC is now in your wallet.",
      });
      dispatch({ type: "CLAIMED" });
      clearDeposit();
      saved.reload();
      onSettled?.();
    } catch (error) {
      if (!controller.signal.aborted) {
        setRecoveryTx(
          txFailureState(
            error,
            "The claim transaction could not be completed. Please try again.",
          ),
        );
      }
    } finally {
      finishFlow(controller);
    }
  }

  function reset() {
    polling.current?.abort();
    flow.current?.abort();
    flowBusy.current = false;
    clearDeposit();
    saved.reload();
    setRecoveryTx({ kind: "idle" });
    setPollWarning(null);
    dispatch({ type: "RESET" });
  }

  const savedDeposit = saved.status === "ready" ? saved.data : undefined;

  return (
    <section className="glass mt-6 rounded-3xl px-5 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold tracking-tight">Add funds with TRY</h2>
        <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-amber-200">
          Testnet simulation
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-400">
        This uses the hackathon Mock Anchor on Testnet. No real money moves and
        no real KYC is performed. Funding and reserving are separate actions —
        money arriving here is not a bond being locked.
      </p>

      {/* The machine's own named states, so a long asynchronous process never
          looks like a stalled spinner. */}
      <AnchorProgress name={state.name} />

      {state.name === "IDLE" ? (
        <div className="mt-5 space-y-4">
          {savedDeposit?.account === address ? (
            <div className="rounded-2xl border border-amber-300/25 bg-amber-300/5 px-4 py-4 text-sm text-amber-100">
              <p>An unfinished deposit is saved in this browser session.</p>
              <Button
                className="mt-3"
                onClick={() => void resumeDeposit(savedDeposit)}
                size="sm"
                type="button"
                variant="warning"
              >
                Resume deposit
              </Button>
            </div>
          ) : null}
          {savedDeposit && savedDeposit.account !== address ? (
            <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-400">
              This browser session holds a deposit for another wallet. Reconnect
              that account to resume it; the record has not been deleted.
            </p>
          ) : null}
          <label className="block text-sm font-semibold text-slate-200" htmlFor="anchor-try-amount">
            TRY amount
          </label>
          <input
            className="num w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 font-mono text-white outline-none transition focus-visible:border-brand/60 focus-visible:ring-2 focus-visible:ring-brand/20"
            id="anchor-try-amount"
            inputMode="decimal"
            onChange={(event) => setAmount(event.target.value)}
            value={amount}
          />
          {amountError ? (
            <p className="text-sm text-rose-300" role="alert">
              {amountError}
            </p>
          ) : null}
          <Button
            disabled={!canTransact}
            onClick={() => void priceDeposit()}
            type="button"
            variant="outline"
          >
            Check rate
          </Button>
        </div>
      ) : null}

      {state.name === "PRICING" && state.context.price ? (
        <div className="mt-5 rounded-2xl border border-brand/20 bg-brand/5 px-4 py-4">
          <p className="text-sm text-brand-soft">
            {state.context.price.sellAmount} TRY is about {state.context.price.buyAmount} USDC at the current indicative rate.
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Continue to sign in to the Anchor and request a firm quote. This signature does not move funds.
          </p>
          <Button
            className="mt-4"
            disabled={!canTransact}
            onClick={() => void openDeposit()}
            type="button"
          >
            Continue with wallet
          </Button>
        </div>
      ) : null}

      {state.context.quote ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
          Firm quote: {state.context.quote.sellAmount} TRY for {state.context.quote.buyAmount} USDC
          {state.context.quote.fee
            ? `, including ${state.context.quote.fee.total} ${state.context.quote.fee.asset} in fees`
            : ""}.
          {state.context.quoteExpired ? (
            <div className="mt-2 text-amber-200">
              <p>{EXPIRED_QUOTE_WARNING}</p>
              {state.context.expiredQuotePrice ? (
                <p className="mt-1 text-xs">
                  Current indicative rate: {state.context.expiredQuotePrice.sellAmount} TRY is about{" "}
                  {state.context.expiredQuotePrice.buyAmount} USDC.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {state.name !== "IDLE" && state.name !== "PRICING" ? (
        <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-4">
          <p className="text-sm text-slate-200" role="status">
            {describeState(state)}
          </p>
        </div>
      ) : null}

      {/* The indeterminate bar that used to sit here said nothing the named
          state rail does not already say, and a bar that never fills reads as
          a stall. */}

      {state.context.ticket ? (
        <div className="mt-5 rounded-2xl border border-amber-300/25 bg-amber-300/5 px-4 py-4">
          <h3 className="font-bold text-amber-100">Test bank transfer instructions</h3>
          {state.context.ticket.instructions.externalTransferMemo ? (
            <div className="mt-3 rounded-xl border border-amber-200/30 bg-slate-950/40 px-3 py-3">
              <p className="text-xs font-bold uppercase tracking-wide text-amber-200">
                Required transfer reference
              </p>
              <p className="mt-1 break-all font-mono text-base text-white">
                {state.context.ticket.instructions.externalTransferMemo.value}
              </p>
            </div>
          ) : null}
          <dl className="mt-3 space-y-3 text-sm">
            {Object.entries(state.context.ticket.instructions.all).map(
              ([key, instruction]) => (
                <div key={key}>
                  <dt className="text-xs uppercase tracking-wide text-amber-100/60">
                    {key.replaceAll("_", " ")}
                  </dt>
                  <dd className="mt-1 break-all font-mono text-amber-50">
                    {instruction.value}
                  </dd>
                </div>
              ),
            )}
          </dl>
          {state.context.ticket.how ? (
            <p className="mt-4 text-sm text-amber-100/80">
              {state.context.ticket.how}
            </p>
          ) : null}
          {safeHttpUrl(state.context.ticket.moreInfoUrl) ? (
            <a
              className="mt-3 inline-block text-sm font-semibold text-amber-200 underline underline-offset-4"
              href={safeHttpUrl(state.context.ticket.moreInfoUrl)}
              rel="noreferrer noopener"
              target="_blank"
            >
              Open Anchor transaction details
            </a>
          ) : null}
          {isDemoToolsEnabled() && amount.trim() ? (
            <Button
              className="mt-4"
              onClick={() => void simulateTransfer()}
              size="sm"
              type="button"
              variant="warning"
            >
              Simulate Testnet bank transfer
            </Button>
          ) : null}
        </div>
      ) : null}

      {state.name === "TREASURY_LOW" ? (
        <p className="mt-4 rounded-2xl border border-amber-300/25 bg-amber-300/5 px-4 py-3 text-sm text-amber-100">
          The shared Testnet treasury is temporarily empty. Keep this page open
          or resume later; the deposit remains tracked.
        </p>
      ) : null}

      {pollWarning && state.context.config && state.context.depositId ? (
        <div className="mt-4 rounded-2xl border border-amber-300/25 bg-amber-300/5 px-4 py-3 text-sm text-amber-100">
          <p>{pollWarning}</p>
          <Button
            className="mt-3"
            size="sm"
            variant="outline"
            onClick={() =>
              void pollUntilStopped(
                state.context.config!,
                state.context.depositId!,
              )
            }
            type="button"
          >
            Resume status checks
          </Button>
        </div>
      ) : null}

      {state.name === "CLAIM_REQUIRED" && state.context.claimableBalanceId ? (
        <div className="mt-5 space-y-4">
          <Button
            disabled={recoveryTx.kind === "running"}
            onClick={() => void claimBalance()}
            type="button"
          >
            Enable USDC and claim funds
          </Button>
          <TxStatus state={recoveryTx} />
        </div>
      ) : null}

      {state.name === "CLAIM_REQUIRED" && !state.context.claimableBalanceId ? (
        <div className="mt-5">
          <EnableUsdcAction
            onSuccess={() => {
              if (state.context.config && state.context.depositId) {
                void pollUntilStopped(
                  state.context.config,
                  state.context.depositId,
                );
              }
            }}
          />
        </div>
      ) : null}

      {state.context.status?.stellarTransactionId ? (
        <a
          className="mt-4 inline-block break-all font-mono text-xs text-brand underline underline-offset-4"
          href={`https://stellar.expert/explorer/testnet/tx/${state.context.status.stellarTransactionId}`}
          rel="noreferrer noopener"
          target="_blank"
        >
          {state.context.status.stellarTransactionId}
        </a>
      ) : null}

      {safeHttpUrl(state.context.status?.moreInfoUrl) ? (
        <a
          className="mt-4 ml-3 inline-block text-xs font-semibold text-brand underline underline-offset-4"
          href={safeHttpUrl(state.context.status?.moreInfoUrl)}
          rel="noreferrer noopener"
          target="_blank"
        >
          Anchor details
        </a>
      ) : null}

      {state.context.status?.refunds ? (
        <p className="mt-4 rounded-2xl border border-rose-400/25 bg-rose-400/5 px-4 py-3 text-sm text-rose-100">
          Refunded: {state.context.status.refunds.amountRefunded ?? "amount not reported"}
          {state.context.status.refunds.amountFee
            ? `; fee ${state.context.status.refunds.amountFee}`
            : ""}.
        </p>
      ) : null}

      {state.name === "COMPLETED" || state.name === "ERROR" ? (
        <Button
          className="mt-5"
          onClick={reset}
          size="sm"
          type="button"
          variant="outline"
        >
          Start a new deposit
        </Button>
      ) : null}
    </section>
  );
}

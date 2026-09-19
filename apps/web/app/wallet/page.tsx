"use client";

import { useState } from "react";

import { TxStatus, type TxState } from "@/components/tx/tx-status";
import { fromStroops } from "@/lib/domain";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import {
  buildChangeTrust,
  getAccountAssets,
  submitSignedTransaction,
} from "@/lib/stellar";
import { isWalletError } from "@/lib/wallet/port";
import { useWallet } from "@/lib/wallet/provider";

type Assets = {
  exists: boolean;
  xlm: bigint;
  usdc: bigint;
  hasUsdcTrustline: boolean;
};

const FRIENDBOT = "https://friendbot.stellar.org";

const NO_ACCOUNT: Assets = {
  exists: false,
  xlm: 0n,
  usdc: 0n,
  hasUsdcTrustline: false,
};

function failureMessage(error: unknown): string {
  if (isWalletError(error)) {
    switch (error.kind) {
      case "rejected":
        return "You declined the signature. Nothing was changed and nothing was spent.";
      case "wrong_network":
        return "Freighter is not on Stellar Testnet. Switch networks and try again.";
      case "no_wallet":
        return "Freighter is not available. Install or unlock it, then try again.";
      case "not_connected":
        return "Your wallet disconnected. Reconnect and try again.";
      default:
        return "The wallet could not complete the signature. Please try again.";
    }
  }

  return error instanceof Error && error.message
    ? error.message
    : "Something went wrong. Please try again.";
}

function Balance({
  label,
  value,
  unit,
  muted,
}: {
  label: string;
  value: string;
  unit: string;
  muted?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/60 px-5 py-5">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </p>
      <p
        className={`mt-3 font-mono text-2xl font-bold ${muted ? "text-slate-500" : "text-white"}`}
      >
        {value}{" "}
        <span className="text-sm font-semibold text-slate-400">{unit}</span>
      </p>
    </div>
  );
}

export default function WalletPage() {
  const { address, canTransact, connect, signTransaction, status } = useWallet();
  const [tx, setTx] = useState<TxState>({ kind: "idle" });

  const state = useAsyncData<Assets>(
    async () => (await getAccountAssets(address!)) ?? NO_ACCOUNT,
    [address],
    { enabled: Boolean(address) },
  );

  const retry = state.reload;

  async function enableUsdc() {
    if (!address) return;

    setTx({ kind: "running", phase: "simulating" });
    try {
      const unsigned = await buildChangeTrust(address);
      setTx({ kind: "running", phase: "awaiting_signature" });
      const signed = await signTransaction(unsigned);
      setTx({ kind: "running", phase: "submitting" });
      const { hash } = await submitSignedTransaction(signed);
      setTx({
        kind: "success",
        hash,
        message: "USDC is enabled on your account.",
      });
      state.reload();
    } catch (error) {
      setTx({ kind: "failed", message: failureMessage(error) });
    }
  }

  const busy = tx.kind === "running";

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-14 sm:px-8">
      <h1 className="text-4xl font-black tracking-[-0.04em]">Your wallet</h1>
      <p className="mt-3 max-w-xl leading-7 text-slate-400">
        What you hold on Stellar Testnet, and what ShowUp needs before you can
        reserve a spot.
      </p>

      {!address ? (
        <div className="mt-10 rounded-2xl border border-dashed border-white/15 px-5 py-8 text-center">
          <p className="text-sm text-slate-300">
            Connect your Testnet wallet to see your balances.
          </p>
          <button
            className="mt-4 rounded-full bg-cyan-300 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-60"
            disabled={status === "connecting"}
            onClick={() => void connect()}
            type="button"
          >
            {status === "connecting" ? "Connecting…" : "Connect Freighter"}
          </button>
        </div>
      ) : state.status === "loading" ? (
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <div className="h-28 animate-pulse rounded-2xl bg-white/5" />
          <div className="h-28 animate-pulse rounded-2xl bg-white/5" />
        </div>
      ) : state.status === "error" ? (
        <div className="mt-10 rounded-2xl border border-rose-400/25 bg-rose-400/5 px-5 py-6">
          <p className="text-sm text-rose-100">{state.error instanceof Error ? state.error.message : "Could not read your balances."}</p>
          <button
            className="mt-4 rounded-full border border-rose-300/30 px-5 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-400/10"
            onClick={retry}
            type="button"
          >
            Try again
          </button>
        </div>
      ) : !state.data.exists ? (
        <div className="mt-10 rounded-2xl border border-amber-300/25 bg-amber-300/5 px-5 py-6">
          <p className="text-sm font-semibold text-amber-100">
            This account does not exist on Testnet yet.
          </p>
          <p className="mt-2 text-sm leading-6 text-amber-100/80">
            Stellar accounts need a small XLM reserve before they can hold
            anything. On Testnet the friendbot funds one for free.
          </p>
          <a
            className="mt-4 inline-block rounded-full bg-amber-300 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-amber-200"
            href={`${FRIENDBOT}?addr=${address}`}
            rel="noreferrer noopener"
            target="_blank"
          >
            Fund with friendbot
          </a>
          <button
            className="ml-3 mt-4 rounded-full border border-amber-300/30 px-5 py-2.5 text-sm font-semibold text-amber-100 transition hover:bg-amber-300/10"
            onClick={retry}
            type="button"
          >
            Check again
          </button>
        </div>
      ) : (
        <>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <Balance
              label="XLM"
              unit="XLM"
              value={fromStroops(state.data.xlm)}
            />
            <Balance
              label="USDC"
              muted={!state.data.hasUsdcTrustline}
              unit="USDC"
              value={
                state.data.hasUsdcTrustline
                  ? fromStroops(state.data.usdc)
                  : "—"
              }
            />
          </div>

          {!state.data.hasUsdcTrustline ? (
            <section className="mt-6 rounded-2xl border border-cyan-300/20 bg-cyan-300/5 px-5 py-6">
              <h2 className="text-base font-bold text-cyan-100">
                Enable USDC to continue
              </h2>
              <p className="mt-2 text-sm leading-6 text-cyan-100/80">
                Stellar accounts opt in to each asset they hold. This is one
                signature and it locks 0.5 XLM as a reserve — the reserve is not
                spent, and you get it back if you ever remove USDC.
              </p>
              <button
                className="mt-4 rounded-full bg-cyan-300 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!canTransact || busy}
                onClick={() => void enableUsdc()}
                type="button"
              >
                {busy ? "Working…" : "Enable USDC"}
              </button>
            </section>
          ) : null}

          <section className="mt-6 rounded-2xl border border-dashed border-white/15 px-5 py-6">
            <h2 className="text-base font-bold">Add funds with TRY</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Fund your wallet through the hackathon Mock Anchor. This is a
              Testnet simulation — no real money moves and no real KYC is
              performed.
            </p>
            <button
              className="mt-4 rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold transition disabled:opacity-50"
              disabled
              type="button"
            >
              Available at C8
            </button>
          </section>

          <div className="mt-6">
            <TxStatus state={tx} />
          </div>
        </>
      )}
    </main>
  );
}

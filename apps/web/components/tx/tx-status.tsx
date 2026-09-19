"use client";

import type { TxPhase } from "@/lib/contract";

export type TxState =
  | { kind: "idle" }
  | { kind: "running"; phase: TxPhase }
  | { kind: "success"; hash: string; message: string }
  | { kind: "failed"; message: string };

// Signing is not success and submitting is not success. Each phase says only
// what has actually happened, so the UI never claims a bond is locked before a
// ledger has confirmed it.
const PHASE_COPY: Record<TxPhase, string> = {
  simulating: "Checking the request against the contract…",
  awaiting_signature: "Waiting for you to approve in Freighter…",
  submitting: "Sending to Stellar Testnet…",
  confirming: "Waiting for ledger confirmation…",
};

export function explorerTxUrl(hash: string): string {
  return `https://stellar.expert/explorer/testnet/tx/${hash}`;
}

export function TxStatus({ state }: { state: TxState }) {
  if (state.kind === "idle") {
    return null;
  }

  if (state.kind === "running") {
    return (
      <div
        className="flex items-center gap-3 rounded-2xl border border-cyan-300/20 bg-cyan-300/5 px-4 py-3 text-sm text-cyan-100"
        role="status"
      >
        <span className="size-2 shrink-0 animate-pulse rounded-full bg-cyan-300" />
        {PHASE_COPY[state.phase]}
      </div>
    );
  }

  if (state.kind === "success") {
    return (
      <div
        className="rounded-2xl border border-emerald-300/25 bg-emerald-300/5 px-4 py-3 text-sm text-emerald-100"
        role="status"
      >
        <p className="font-semibold">{state.message}</p>
        <a
          className="mt-1 inline-block break-all font-mono text-xs text-emerald-300 underline underline-offset-4"
          href={explorerTxUrl(state.hash)}
          rel="noreferrer noopener"
          target="_blank"
        >
          {state.hash}
        </a>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border border-rose-400/25 bg-rose-400/5 px-4 py-3 text-sm text-rose-100"
      role="alert"
    >
      {state.message}
    </div>
  );
}

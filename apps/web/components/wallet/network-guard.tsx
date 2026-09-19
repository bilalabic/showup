"use client";

import { useWallet } from "@/lib/wallet/provider";

export function NetworkGuard() {
  const { refresh, status } = useWallet();

  if (status !== "wrong_network") {
    return null;
  }

  return (
    <div
      className="border-b border-amber-300/30 bg-amber-300 px-4 py-3 text-slate-950"
      role="alert"
    >
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <p className="text-sm font-semibold">
          ShowUp is Testnet-only. Switch Freighter to Stellar Testnet before
          continuing; all transaction actions are blocked.
        </p>
        <button
          className="shrink-0 rounded-full border border-slate-950/30 px-4 py-1.5 text-sm font-bold transition hover:bg-slate-950 hover:text-amber-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
          onClick={() => void refresh()}
          type="button"
        >
          Check again
        </button>
      </div>
    </div>
  );
}

"use client";

import { useWallet } from "@/lib/wallet/provider";

function shortAddress(address: string): string {
  return `${address.slice(0, 5)}…${address.slice(-5)}`;
}

function errorMessage(kind: string): string {
  switch (kind) {
    case "no_wallet":
      return "Install or unlock Freighter to connect.";
    case "not_connected":
      return "Freighter is not connected.";
    case "unknown":
      return "Wallet connection failed. Please try again.";
    default:
      return "";
  }
}

export function ConnectButton() {
  const { address, connect, disconnect, error, status } = useWallet();

  if (address) {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-2 font-mono text-xs text-slate-300 sm:inline">
          {shortAddress(address)}
        </span>
        <button
          className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:border-cyan-300/60 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
          onClick={() => void disconnect()}
          type="button"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        className="rounded-full bg-cyan-300 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-wait disabled:opacity-60"
        disabled={status === "connecting"}
        onClick={() => void connect()}
        type="button"
      >
        {status === "connecting" ? "Connecting…" : "Connect Freighter"}
      </button>
      {error && error.kind !== "rejected" && error.kind !== "wrong_network" ? (
        <span className="max-w-52 text-right text-xs text-rose-300" role="status">
          {errorMessage(error.kind)}
        </span>
      ) : null}
    </div>
  );
}

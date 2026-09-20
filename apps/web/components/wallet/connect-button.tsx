"use client";

import { Button } from "@/components/ui/button";
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
        <span className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 font-mono text-xs text-slate-300 sm:inline-flex">
          <span className="size-1.5 rounded-full bg-emerald-300 shadow-[0_0_8px_rgba(110,231,183,0.8)]" />
          {shortAddress(address)}
        </span>
        <Button
          onClick={() => void disconnect()}
          size="sm"
          type="button"
          variant="outline"
        >
          <span className="sm:hidden">Leave</span>
          <span className="hidden sm:inline">Disconnect</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        disabled={status === "connecting"}
        onClick={() => void connect()}
        type="button"
      >
        {status === "connecting" ? (
          "Connecting…"
        ) : (
          <>
            <span className="sm:hidden">Connect</span>
            <span className="hidden sm:inline">Connect Freighter</span>
          </>
        )}
      </Button>
      {error && error.kind !== "rejected" && error.kind !== "wrong_network" ? (
        <span
          className="max-w-28 text-right text-[10px] leading-4 text-rose-300 sm:max-w-52 sm:text-xs"
          role="status"
        >
          {errorMessage(error.kind)}
        </span>
      ) : null}
    </div>
  );
}

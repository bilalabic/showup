"use client";

import { useState } from "react";

import { TxStatus, type TxState } from "@/components/tx/tx-status";
import { SubmitButton } from "@/components/ui/submit-button";
import { buildChangeTrust, submitSignedTransaction } from "@/lib/stellar";
import { isWalletError } from "@/lib/wallet/port";
import { useWallet } from "@/lib/wallet/provider";

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
    : "USDC could not be enabled. Please try again.";
}

export function EnableUsdcAction({
  onSuccess,
}: {
  onSuccess?: () => void;
}) {
  const { address, canTransact, signTransaction } = useWallet();
  const [tx, setTx] = useState<TxState>({ kind: "idle" });
  const busy = tx.kind === "running";

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
      onSuccess?.();
    } catch (error) {
      setTx({ kind: "failed", message: failureMessage(error) });
    }
  }

  return (
    <section className="glass rounded-3xl border-cyan-300/25 px-5 py-6">
      <h2 className="text-lg font-black tracking-tight text-cyan-100">
        Enable USDC to continue
      </h2>
      <p className="mt-2 text-sm leading-6 text-cyan-100/80">
        Stellar accounts opt in to each asset they hold. This is one signature
        and locks 0.5 XLM as a reserve. The reserve is not spent and is released
        if the trustline is removed later.
      </p>
      <SubmitButton
        className="mt-5"
        disabled={!canTransact}
        onClick={() => void enableUsdc()}
        pending={busy}
        pendingLabel="Working…"
        type="button"
      >
        Enable USDC
      </SubmitButton>
      <div className="mt-4">
        <TxStatus state={tx} />
      </div>
    </section>
  );
}

"use client";

import { useState } from "react";

import {
  TxStatus,
  txFailureState,
  type TxState,
} from "@/components/tx/tx-status";
import { SubmitButton } from "@/components/ui/submit-button";
import { XlmFundingNotice } from "@/components/wallet/xlm-funding-notice";
import { fromStroops } from "@/lib/domain";
import {
  CHANGE_TRUST_FEE_STROOPS,
  buildChangeTrust,
  requiredForNewSubentry,
  submitSignedTransaction,
  type AccountAssets,
} from "@/lib/stellar";
import { useWallet } from "@/lib/wallet/provider";

export function EnableUsdcAction({
  assets,
  onSuccess,
}: {
  assets?: AccountAssets | null;
  onSuccess?: () => void;
}) {
  const { address, canTransact, signTransaction } = useWallet();
  const [tx, setTx] = useState<TxState>({ kind: "idle" });
  const busy = tx.kind === "running";
  const xlmRequired = assets
    ? requiredForNewSubentry(
        assets.baseReserve,
        CHANGE_TRUST_FEE_STROOPS,
      )
    : null;
  const insufficientXlm =
    assets?.exists === true &&
    !assets.hasUsdcTrustline &&
    xlmRequired !== null &&
    assets.spendableXlm < xlmRequired;

  async function enableUsdc() {
    if (!address || insufficientXlm) return;

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
      setTx(txFailureState(error, "USDC could not be enabled. Please try again."));
    }
  }

  return (
    <section className="glass rounded-3xl border-brand/25 px-5 py-6">
      <h2 className="text-lg font-bold tracking-tight text-brand-soft">
        Enable USDC to continue
      </h2>
      <p className="mt-2 text-sm leading-6 text-brand-soft/80">
        Stellar accounts opt in to each asset they hold. This is one signature
        and locks one network base reserve
        {assets?.exists
          ? ` (${fromStroops(assets.baseReserve)} XLM at the latest ledger)`
          : ""}
        . The reserve is not spent and is released if the trustline is removed
        later.
      </p>
      {insufficientXlm && address ? (
        <div className="mt-5">
          <XlmFundingNotice address={address}>
            The current Testnet reserve and transaction fee require more
            spendable XLM before this trustline can be added. Account reserves
            are locked, not spent.
          </XlmFundingNotice>
        </div>
      ) : null}
      <SubmitButton
        className="mt-5"
        disabled={!canTransact || insufficientXlm}
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

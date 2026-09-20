"use client";

import { Button } from "@/components/ui/button";
import { NumberTicker } from "@/components/ui/magic/number-ticker";
import { Skeleton } from "@/components/ui/skeleton";
import { ConnectPrompt, ErrorState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { AnchorDeposit } from "@/components/wallet/anchor-deposit";
import { EnableUsdcAction } from "@/components/wallet/enable-usdc-action";
import { XlmFundingNotice } from "@/components/wallet/xlm-funding-notice";
import { fromStroops } from "@/lib/domain";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { getAccountAssets, type AccountAssets } from "@/lib/stellar";
import { useWallet } from "@/lib/wallet/provider";

const NO_ACCOUNT: AccountAssets = {
  exists: false,
  xlm: 0n,
  baseReserve: 0n,
  minimumBalance: 0n,
  nativeSellingLiabilities: 0n,
  spendableXlm: 0n,
  usdc: 0n,
  hasUsdcTrustline: false,
};

function Balance({
  badge,
  label,
  muted,
  note,
  unit,
  value,
}: {
  badge?: React.ReactNode;
  label: string;
  muted?: boolean;
  note?: string;
  unit: string;
  value: bigint | null;
}) {
  return (
    <div className="glass rounded-3xl px-5 py-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
          {label}
        </p>
        {badge}
      </div>
      <p
        className={`mt-3 text-3xl font-bold tracking-[-0.03em] ${
          muted ? "text-slate-500" : "text-white"
        }`}
      >
        {value === null ? (
          <span className="num">—</span>
        ) : (
          <NumberTicker format={fromStroops} suffix={unit} value={value} />
        )}
        <span aria-hidden="true" className="ml-2 text-sm font-bold text-slate-400">
          {unit}
        </span>
      </p>
      {note ? <p className="mt-2 text-xs leading-5 text-slate-500">{note}</p> : null}
    </div>
  );
}

export default function WalletPage() {
  const { address } = useWallet();

  const state = useAsyncData<AccountAssets>(
    async () => (await getAccountAssets(address!)) ?? NO_ACCOUNT,
    [address],
    { enabled: Boolean(address) },
  );

  const retry = state.reload;

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-14 sm:px-8">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">
        Participant
      </p>
      <h1 className="mt-3 text-4xl font-bold tracking-[-0.04em]">
        Your wallet
      </h1>
      <p className="mt-3 max-w-xl leading-7 text-slate-400">
        What you hold on Stellar Testnet, and what ShowUp needs before you can
        reserve a spot.
      </p>

      {!address ? (
        <ConnectPrompt className="mt-10">
          Connect your Testnet wallet to see your balances. Nothing is signed on
          this page until you ask for it.
        </ConnectPrompt>
      ) : state.status === "loading" ? (
        <div aria-busy="true" className="mt-10 grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-32 rounded-3xl bg-white/[0.04]" />
          <Skeleton className="h-32 rounded-3xl bg-white/[0.04]" />
        </div>
      ) : state.status === "error" ? (
        <div className="mt-10">
          <ErrorState
            error={state.error}
            fallback="Could not read your balances."
            onRetry={retry}
            title="Could not read your balances"
          />
        </div>
      ) : !state.data.exists ? (
        <div className="mt-10 rounded-3xl border border-amber-300/25 bg-amber-300/[0.06] px-5 py-6">
          <StatusBadge tone="warning">Account not funded</StatusBadge>
          <p className="mt-4 text-sm font-semibold text-amber-100">
            This account does not exist on Testnet yet.
          </p>
          <p className="mt-2 text-sm leading-6 text-amber-100/80">
            Stellar accounts need a small XLM reserve before they can hold
            anything. On Testnet the friendbot funds one for free.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild variant="warning">
              <a
                href={`https://friendbot.stellar.org?addr=${encodeURIComponent(address)}`}
                rel="noreferrer noopener"
                target="_blank"
              >
                Fund with Friendbot
              </a>
            </Button>
            <Button onClick={retry} type="button" variant="outline">
              Check again
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <Balance
              label="Total native balance"
              note="The full XLM balance reported by Horizon."
              unit="XLM"
              value={state.data.xlm}
            />
            <Balance
              label="Spendable network balance"
              note="Available after the current minimum reserve and native selling liabilities."
              unit="XLM"
              value={state.data.spendableXlm}
            />
            <Balance
              label="Minimum account reserve"
              note={`Locked by account entries at the current ${fromStroops(state.data.baseReserve)} XLM base reserve.`}
              unit="XLM"
              value={state.data.minimumBalance}
            />
            <Balance
              badge={
                state.data.hasUsdcTrustline ? (
                  <StatusBadge tone="positive">Trustline active</StatusBadge>
                ) : (
                  <StatusBadge tone="warning">Not enabled</StatusBadge>
                )
              }
              label="Settlement asset"
              muted={!state.data.hasUsdcTrustline}
              note={
                state.data.hasUsdcTrustline
                  ? "This account can hold and receive ShowUp bonds."
                  : "Stellar accounts opt in to each asset. USDC cannot arrive yet."
              }
              unit="USDC"
              value={state.data.hasUsdcTrustline ? state.data.usdc : null}
            />
          </div>

          {state.data.spendableXlm === 0n ? (
            <div className="mt-6">
              <XlmFundingNotice address={address}>
                This account has no XLM available above its current reserve and
                native liabilities. It cannot pay for a trustline or contract
                transaction until more Testnet XLM arrives.
              </XlmFundingNotice>
            </div>
          ) : null}

          {!state.data.hasUsdcTrustline ? (
            <div className="mt-6">
              <EnableUsdcAction assets={state.data} onSuccess={state.reload} />
            </div>
          ) : null}

          <AnchorDeposit key={address} onSettled={state.reload} />
        </>
      )}
    </main>
  );
}

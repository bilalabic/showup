"use client";

import Link from "next/link";
import { m, useReducedMotion } from "motion/react";
import { use, useMemo, useState } from "react";

import { EventShare } from "@/components/events/event-share";
import {
  TxStatus,
  txFailureState,
  type TxState,
} from "@/components/tx/tx-status";
import { Button } from "@/components/ui/button";
import { CalendarLinks } from "@/components/ui/calendar-links";
import { CapacityMeter } from "@/components/ui/capacity-meter";
import { Countdown } from "@/components/ui/countdown";
import { Money } from "@/components/ui/money";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { EnableUsdcAction } from "@/components/wallet/enable-usdc-action";
import { XlmFundingNotice } from "@/components/wallet/xlm-funding-notice";
import {
  discover,
  getIndicativePriceForBuyAmount,
  type Price,
} from "@/lib/anchor";
import {
  getEvent,
  getReservation,
  reserve,
  type TxPhase,
} from "@/lib/contract";
import {
  canReserve,
  fromStroops,
  parseEventId,
  splitByBps,
  type EventView,
  type ReservationView,
} from "@/lib/domain";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import {
  getAccountAssets,
  getLedgerNow,
  type AccountAssets,
} from "@/lib/stellar";
import { useWallet } from "@/lib/wallet/provider";

type EventSnapshot = {
  event: EventView;
  ledgerNow: number;
  reservation: ReservationView | null;
  assets: AccountAssets | null;
};

function isNotFound(error: unknown): boolean {
  return (
    error instanceof Error && error.message.toLowerCase().includes("not found")
  );
}

function formatMoment(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
      <dt className="text-sm text-slate-400">{label}</dt>
      <dd className="text-sm font-semibold text-white sm:text-right">{value}</dd>
    </div>
  );
}

function TryBondEstimate({ bondAmount }: { bondAmount: bigint }) {
  const usdcAmount = fromStroops(bondAmount);
  const estimate = useAsyncData<Price | null>(
    async () => {
      try {
        const config = await discover();
        return await getIndicativePriceForBuyAmount(usdcAmount, { config });
      } catch {
        // Pricing is optional context. An unavailable Anchor must never delay
        // or disable the independent on-chain reservation flow.
        return null;
      }
    },
    [usdcAmount],
  );

  if (estimate.status === "loading") {
    return (
      <p className="mt-2 text-sm text-slate-500" aria-live="polite">
        Checking the current TRY estimate…
      </p>
    );
  }

  if (estimate.status !== "ready" || estimate.data === null) {
    return (
      <p className="mt-2 text-sm text-slate-500">
        TRY estimate temporarily unavailable. Reserving with USDC is unaffected.
      </p>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-brand/15 bg-brand/[0.04] px-3 py-2">
      <p className="text-sm font-semibold text-brand-soft">
        About <span className="num">{estimate.data.sellAmount}</span> TRY
      </p>
      <p className="mt-1 text-xs leading-5 text-slate-400">
        Public indicative Anchor estimate for exactly {estimate.data.buyAmount}{" "}
        USDC. This is not a firm quote; the final rate may change.
      </p>
    </div>
  );
}

/**
 * The next deadline that still matters, so the countdown always points at
 * something actionable rather than at whichever date happens to be first.
 * It is cosmetic: `canReserve` still decides what the page offers, from the
 * ledger clock.
 */
function nextDeadline(
  event: EventView,
  ledgerNow: number,
): { at: number; label: string } | null {
  if (ledgerNow < event.cancellationDeadline) {
    return { at: event.cancellationDeadline, label: "Free cancellation closes in" };
  }
  if (ledgerNow < event.checkinStart) {
    return { at: event.checkinStart, label: "Check-in opens in" };
  }
  if (ledgerNow < event.checkinDeadline) {
    return { at: event.checkinDeadline, label: "Check-in closes in" };
  }
  return null;
}

/**
 * The no-show split, shown as the two amounts it actually becomes rather than
 * as two percentages the participant has to multiply themselves. The arithmetic
 * is `lib/domain`'s `splitByBps`, which is the contract's arithmetic.
 */
function SplitPreview({ event }: { event: EventView }) {
  const reduceMotion = useReducedMotion();
  const split = splitByBps(event.bondAmount, event.organizerBps);
  const organizerShare = event.organizerBps / 100;

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-5">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
        If you do not attend
      </p>
      {/* The track carries the community colour and the organizer leg is laid
          over it at a fixed width, so only a `scaleX` animates and the bar
          never reflows. */}
      <div
        aria-hidden="true"
        className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-status-community/75"
      >
        <m.span
          animate={{ scaleX: 1 }}
          className="block h-full origin-left bg-brand/80"
          initial={reduceMotion ? false : { scaleX: 0 }}
          style={{ width: `${organizerShare}%` }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 130, damping: 22 }
          }
        />
      </div>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="flex items-center gap-2 text-slate-400">
            <span className="size-2 rounded-full bg-brand/80" />
            Organizer ({organizerShare}%)
          </dt>
          <dd className="font-semibold text-white">
            <Money stroops={split.organizer} />
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="flex items-center gap-2 text-slate-400">
            <span className="size-2 rounded-full bg-status-community/80" />
            Community pool ({event.communityBps / 100}%)
          </dt>
          <dd className="font-semibold text-white">
            <Money stroops={split.community} />
          </dd>
        </div>
      </dl>
    </div>
  );
}

export default function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { address, canTransact, connect, signTransaction, status } = useWallet();
  const [confirming, setConfirming] = useState(false);
  const [tx, setTx] = useState<TxState>({ kind: "idle" });

  const eventId = useMemo(() => parseEventId(id), [id]);

  const state = useAsyncData<EventSnapshot>(
    // Eligibility is always judged against the ledger clock, never the
    // browser's. A wrong local clock must not change what the page claims.
    async () => {
      const [event, ledgerNow, reservation, assets] = await Promise.all([
        getEvent(eventId!),
        getLedgerNow(),
        address ? getReservation(eventId!, address) : Promise.resolve(null),
        address
          ? getAccountAssets(address).catch(() => null)
          : Promise.resolve(null),
      ]);
      return { event, ledgerNow, reservation, assets };
    },
    [eventId, address],
    { enabled: eventId !== null },
  );

  const retry = state.reload;

  if (eventId === null || (state.status === "error" && isNotFound(state.error))) {
    return (
      <main className="mx-auto w-full max-w-3xl px-5 py-20 sm:px-8">
        <h1 className="text-3xl font-bold tracking-tight">No such event</h1>
        <p className="mt-3 text-slate-400">
          Event {id} does not exist on this contract.
        </p>
        <Button asChild className="mt-8" variant="outline">
          <Link href="/">Back to home</Link>
        </Button>
      </main>
    );
  }

  if (state.status === "loading") {
    return (
      <main
        aria-busy="true"
        className="mx-auto w-full max-w-3xl px-5 py-14 sm:px-8"
      >
        {/* The skeleton mirrors the real layout, so the page does not jump
            when the contract reads land. */}
        <Skeleton className="h-7 w-32 rounded-full bg-white/8" />
        <Skeleton className="mt-6 h-12 w-3/4 rounded-2xl bg-white/8" />
        <Skeleton className="mt-4 h-6 w-48 rounded-xl bg-white/5" />
        <Skeleton className="mt-10 h-24 w-full rounded-3xl bg-white/5" />
        <Skeleton className="mt-4 h-80 w-full rounded-3xl bg-white/5" />
        <Skeleton className="mt-8 h-12 w-56 rounded-full bg-white/8" />
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className="mx-auto w-full max-w-3xl px-5 py-20 sm:px-8">
        <ErrorState
          error={state.error}
          fallback="Could not load this event."
          onRetry={retry}
          title="Could not load the event"
        />
      </main>
    );
  }

  const { event, ledgerNow, reservation, assets } = state.data;
  const seatsLeft = event.capacity - event.reservedCount;
  const cancelled = event.status === "cancelled";
  const reservationOpen = canReserve(event, reservation, ledgerNow);
  const busy = tx.kind === "running";
  const deadline = nextDeadline(event, ledgerNow);

  async function onReserve() {
    if (!address || !canTransact) return;

    setTx({ kind: "running", phase: "simulating" });
    try {
      const { hash } = await reserve(
        event.id,
        { address, signTransaction },
        (phase: TxPhase) => setTx({ kind: "running", phase }),
      );
      setConfirming(false);
      setTx({
        kind: "success",
        hash,
        amountStroops: event.bondAmount,
        amountCaption: "locked by the contract",
        message: `Your bond is held by the ShowUp contract until you check in, cancel, or the check-in window closes.`,
      });
      retry();
    } catch (error) {
      setTx(
        txFailureState(
          error,
          "The reservation could not be completed. Refresh and try again.",
        ),
      );
      retry();
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-14 sm:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <span className="num rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-xs text-slate-400">
          Event #{event.id.toString()}
        </span>
        {cancelled ? (
          <StatusBadge tone="neutral">Cancelled by organizer</StatusBadge>
        ) : seatsLeft > 0 ? (
          <StatusBadge tone="positive">{`${seatsLeft} of ${event.capacity} left`}</StatusBadge>
        ) : (
          <StatusBadge tone="warning">Full</StatusBadge>
        )}
      </div>

      <h1 className="mt-6 text-4xl font-bold leading-tight tracking-[-0.045em] [overflow-wrap:anywhere] sm:text-5xl">
        {event.title}
      </h1>
      <p className="mt-3 text-lg text-slate-400 [overflow-wrap:anywhere]">
        {event.venue}
      </p>
      <EventShare
        className="mt-5"
        eventId={event.id.toString()}
        title={event.title}
      />

      <section className="glass mt-10 grid gap-6 rounded-3xl p-6 sm:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
            Refundable bond
          </p>
          <p className="mt-2 text-4xl font-bold tracking-[-0.04em] text-white">
            <span className="num">{fromStroops(event.bondAmount)}</span>
            <span className="ml-2 text-lg font-bold text-brand">USDC</span>
          </p>
          <p className="mt-2 text-sm text-slate-400">
            Returned in full when you check in.
          </p>
          <TryBondEstimate bondAmount={event.bondAmount} />
        </div>
        <div className="flex flex-col justify-between gap-5">
          <CapacityMeter
            capacity={event.capacity}
            reserved={event.reservedCount}
          />
          {deadline ? (
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                {deadline.label}
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-brand-soft">
                <Countdown
                  deadlineSeconds={deadline.at}
                  ledgerNowSeconds={ledgerNow}
                />
              </p>
            </div>
          ) : null}
        </div>
      </section>

      {/* The specification is explicit: a participant must never discover the
          no-show rule after funding. The whole policy sits above the action. */}
      <section className="mt-4 rounded-3xl border border-white/10 bg-slate-900/40 px-6 py-2">
        <dl className="divide-y divide-white/10">
          <Row label="Event starts" value={formatMoment(event.startTime)} />
          <Row
            label="Check-in window"
            value={`${formatMoment(event.checkinStart)} — ${formatMoment(event.checkinDeadline)}`}
          />
          <Row
            label="Free cancellation until"
            value={formatMoment(event.cancellationDeadline)}
          />
        </dl>
        <div className="pb-6 pt-2">
          <SplitPreview event={event} />
        </div>
      </section>

      <div className="mt-8">
        {reservation ? (
          <div className="rounded-3xl border border-emerald-300/25 bg-emerald-300/[0.06] px-5 py-5 text-sm text-emerald-100">
            <p>
              You already hold this reservation. Bond status:{" "}
              {reservation.status.replaceAll("_", " ")}.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild size="sm" variant="secondary">
                <Link href={`/reservations/${event.id.toString()}`}>
                  Open reservation pass
                </Link>
              </Button>
              {reservation.status === "locked" && event.status === "active" ? (
                <CalendarLinks event={event} />
              ) : null}
            </div>
          </div>
        ) : cancelled ? (
          <p className="rounded-3xl border border-rose-400/25 bg-rose-400/[0.06] px-5 py-5 text-sm leading-6 text-rose-100">
            This event was cancelled. Anyone holding a bond for it can claim a
            full refund.
          </p>
        ) : reservationOpen && !canTransact ? (
          <div className="rounded-3xl border border-dashed border-white/15 px-5 py-6">
            <p className="text-sm leading-6 text-slate-300">
              Connect your Testnet wallet to reserve. The contract will first
              simulate the request, then ask for one signature to lock the bond.
            </p>
            <Button
              className="mt-4"
              disabled={status === "connecting"}
              onClick={() => void connect()}
              type="button"
            >
              {status === "connecting" ? "Connecting…" : "Connect wallet"}
            </Button>
          </div>
        ) : reservationOpen && assets !== null && !assets.exists ? (
          address ? (
            <XlmFundingNotice
              address={address}
              title="Fund this Testnet account"
            >
              This account does not exist on Testnet yet. Friendbot can create
              and fund it before you reserve a spot.
            </XlmFundingNotice>
          ) : null
        ) : reservationOpen && assets !== null && !assets.hasUsdcTrustline ? (
          <EnableUsdcAction assets={assets} onSuccess={retry} />
        ) : reservationOpen &&
          assets !== null &&
          assets.spendableXlm === 0n &&
          address ? (
          <XlmFundingNotice address={address}>
            This account has no XLM available above its current reserve and
            native liabilities, so it cannot pay for the reservation
            transaction. The bond remains untouched.
          </XlmFundingNotice>
        ) : reservationOpen &&
          assets !== null &&
          assets.usdc < event.bondAmount ? (
          <div className="rounded-3xl border border-amber-300/25 bg-amber-300/[0.06] px-5 py-5 text-sm leading-6 text-amber-100">
            <p>
              This wallet has <Money stroops={assets.usdc} />; the bond needs{" "}
              <Money stroops={event.bondAmount} />. No reservation transaction
              has been started.
            </p>
            <Button asChild className="mt-4" size="sm" variant="warning">
              <Link href="/wallet">Add funds</Link>
            </Button>
          </div>
        ) : reservationOpen && confirming ? (
          <m.div
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-3xl border-brand/25 p-6"
            initial={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
          >
            <h2 className="text-lg font-bold text-brand-soft">
              Confirm the bond policy
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              You will lock <Money stroops={event.bondAmount} />. Check in
              between {formatMoment(event.checkinStart)} and{" "}
              {formatMoment(event.checkinDeadline)} for a full refund, or cancel
              by {formatMoment(event.cancellationDeadline)}. A no-show sends{" "}
              {event.organizerBps / 100}% to the organizer and{" "}
              {event.communityBps / 100}% to the community pool.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <SubmitButton
                onClick={() => void onReserve()}
                pending={busy}
                pendingLabel="Reserving…"
                type="button"
              >
                Lock bond and reserve
              </SubmitButton>
              <Button
                disabled={busy}
                onClick={() => setConfirming(false)}
                type="button"
                variant="outline"
              >
                Not yet
              </Button>
            </div>
          </m.div>
        ) : reservationOpen ? (
          <Button
            onClick={() => {
              setTx({ kind: "idle" });
              setConfirming(true);
            }}
            size="lg"
            type="button"
          >
            Reserve your spot
          </Button>
        ) : (
          <p className="rounded-3xl border border-white/10 bg-white/5 px-5 py-5 text-sm text-slate-300">
            {seatsLeft <= 0
              ? "Every seat is taken."
              : "Reservations for this event have closed."}
          </p>
        )}
      </div>

      <div className="mt-4">
        <TxStatus state={tx} />
      </div>

      <details className="mt-12 rounded-2xl border border-white/10 bg-slate-950/60 px-5 py-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-300">
          Contract policy data
        </summary>
        <dl className="mt-4 space-y-2 font-mono text-xs text-slate-400">
          <div className="flex flex-wrap justify-between gap-2">
            <dt>Organizer</dt>
            <dd className="break-all">{event.organizer}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt>Verifier</dt>
            <dd className="break-all">{event.verifier}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Bond (stroops)</dt>
            <dd className="num">{event.bondAmount.toString()}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Ledger time</dt>
            <dd className="num">{ledgerNow}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Network</dt>
            <dd>Testnet</dd>
          </div>
        </dl>
      </details>
    </main>
  );
}

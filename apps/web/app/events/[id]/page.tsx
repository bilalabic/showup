"use client";

import Link from "next/link";
import { use, useMemo } from "react";

import { getEvent } from "@/lib/contract";
import { fromStroops, type EventView } from "@/lib/domain";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { getLedgerNow } from "@/lib/stellar";

type EventSnapshot = { event: EventView; ledgerNow: number };

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
    <div className="flex items-baseline justify-between gap-6 py-4">
      <dt className="text-sm text-slate-400">{label}</dt>
      <dd className="text-right text-sm font-semibold text-white">{value}</dd>
    </div>
  );
}

export default function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const eventId = useMemo(() => {
    try {
      return BigInt(id);
    } catch {
      return null;
    }
  }, [id]);

  const state = useAsyncData<EventSnapshot>(
    // Eligibility is always judged against the ledger clock, never the
    // browser's. A wrong local clock must not change what the page claims.
    async () => {
      const [event, ledgerNow] = await Promise.all([
        getEvent(eventId!),
        getLedgerNow(),
      ]);
      return { event, ledgerNow };
    },
    [eventId],
    { enabled: eventId !== null },
  );

  const retry = state.reload;

  if (eventId === null || (state.status === "error" && isNotFound(state.error))) {
    return (
      <main className="mx-auto w-full max-w-3xl px-5 py-20 sm:px-8">
        <h1 className="text-3xl font-black tracking-tight">No such event</h1>
        <p className="mt-3 text-slate-400">
          Event {id} does not exist on this contract.
        </p>
        <Link
          className="mt-8 inline-block rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold transition hover:border-cyan-300/60"
          href="/"
        >
          Back to home
        </Link>
      </main>
    );
  }

  if (state.status === "loading") {
    return (
      <main className="mx-auto w-full max-w-3xl px-5 py-14 sm:px-8">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-white/10" />
        <div className="mt-4 h-5 w-80 animate-pulse rounded-lg bg-white/5" />
        <div className="mt-10 h-72 animate-pulse rounded-3xl bg-white/5" />
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className="mx-auto w-full max-w-3xl px-5 py-20 sm:px-8">
        <h1 className="text-3xl font-black tracking-tight">
          Could not load the event
        </h1>
        <p className="mt-3 text-slate-400">{state.error instanceof Error ? state.error.message : "Could not load this event."}</p>
        <button
          className="mt-8 rounded-full bg-cyan-300 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-200"
          onClick={retry}
          type="button"
        >
          Try again
        </button>
      </main>
    );
  }

  const { event, ledgerNow } = state.data;
  const seatsLeft = event.capacity - event.reservedCount;
  const cancelled = event.status === "cancelled";
  const reservationOpen =
    !cancelled && ledgerNow < event.checkinDeadline && seatsLeft > 0;

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-14 sm:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-xs text-slate-400">
          Event #{event.id.toString()}
        </span>
        {cancelled ? (
          <span className="rounded-full bg-rose-400/10 px-3 py-1 text-xs font-bold text-rose-300">
            Cancelled by organizer
          </span>
        ) : (
          <span className="rounded-full bg-emerald-300/10 px-3 py-1 text-xs font-bold text-emerald-300">
            {seatsLeft > 0 ? `${seatsLeft} of ${event.capacity} left` : "Full"}
          </span>
        )}
      </div>

      <h1 className="mt-6 text-4xl font-black leading-tight tracking-[-0.045em] sm:text-5xl">
        {event.title}
      </h1>
      <p className="mt-3 text-lg text-slate-400">{event.venue}</p>

      {/* The specification is explicit: a participant must never discover the
          no-show rule after funding. The whole policy sits above the action. */}
      <section className="mt-10 rounded-3xl border border-white/10 bg-slate-900/60 px-6 py-2">
        <dl className="divide-y divide-white/10">
          <Row
            label="Refundable bond"
            value={
              <span className="font-mono text-base">
                {fromStroops(event.bondAmount)} USDC
              </span>
            }
          />
          <Row label="Event starts" value={formatMoment(event.startTime)} />
          <Row
            label="Check-in window"
            value={`${formatMoment(event.checkinStart)} — ${formatMoment(event.checkinDeadline)}`}
          />
          <Row
            label="Free cancellation until"
            value={formatMoment(event.cancellationDeadline)}
          />
          <Row
            label="If you do not attend"
            value={`${event.organizerBps / 100}% organizer · ${event.communityBps / 100}% community pool`}
          />
        </dl>
      </section>

      <div className="mt-8">
        {cancelled ? (
          <p className="rounded-2xl border border-rose-400/25 bg-rose-400/5 px-5 py-4 text-sm text-rose-100">
            This event was cancelled. Anyone holding a bond for it can claim a
            full refund.
          </p>
        ) : reservationOpen ? (
          <button
            className="rounded-full bg-cyan-300 px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-50"
            disabled
            type="button"
          >
            Reserve your spot — available at C7
          </button>
        ) : (
          <p className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-slate-300">
            {seatsLeft <= 0
              ? "Every seat is taken."
              : "Reservations for this event have closed."}
          </p>
        )}
      </div>

      <details className="mt-12 rounded-2xl border border-white/10 bg-slate-950/60 px-5 py-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-300">
          Technical details
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
            <dd>{event.bondAmount.toString()}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Ledger time</dt>
            <dd>{ledgerNow}</dd>
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

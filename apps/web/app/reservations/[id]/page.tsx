"use client";

import Link from "next/link";
import { use, useMemo } from "react";

import { QrPass } from "@/components/qr/qr-pass";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { getEvent, getReservation } from "@/lib/contract";
import type { EventView, ReservationView } from "@/lib/domain";
import { reservationBucket } from "@/lib/domain/reservation-buckets";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { encodePass } from "@/lib/qr";
import { getLedgerNow } from "@/lib/stellar";
import { useWallet } from "@/lib/wallet/provider";

type ReservationSnapshot = {
  event: EventView;
  ledgerNow: number;
  reservation: ReservationView | null;
};

const MAX_U64 = (1n << 64n) - 1n;

function parseEventId(raw: string): bigint | null {
  if (!/^\d+$/.test(raw)) return null;
  try {
    const value = BigInt(raw);
    return value > 0n && value <= MAX_U64 ? value : null;
  } catch {
    return null;
  }
}

function formatMoment(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function displayStatus(
  event: EventView,
  reservation: ReservationView,
  ledgerNow: number,
): string {
  if (reservation.status === "attended") return "Attended · bond returned";
  if (reservation.status === "cancelled") {
    return "Reservation cancelled · bond returned";
  }
  if (reservation.status === "refunded") {
    return "Event cancelled · refund claimed";
  }
  if (reservation.status === "no_show_settled") {
    return "No-show settlement completed";
  }
  if (event.status === "cancelled") {
    return "Event cancelled · refund available";
  }
  if (reservationBucket(event, reservation, ledgerNow) === "no_show") {
    return "Check-in closed · awaiting no-show settlement";
  }
  if (ledgerNow < event.checkinStart) return "Bond locked · check-in has not opened";
  return "Bond locked · check-in is open";
}

/** The tone follows the money: green when a bond came back, amber when it did not. */
function statusTone(
  event: EventView,
  reservation: ReservationView,
): StatusTone {
  if (reservation.status === "attended") return "positive";
  if (reservation.status === "cancelled") return "neutral";
  if (reservation.status === "refunded") return "neutral";
  if (reservation.status === "no_show_settled") return "warning";
  if (event.status === "cancelled") return "critical";
  return "accent";
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-4">
      <dt className="text-sm text-slate-400">{label}</dt>
      <dd className="text-right text-sm font-semibold text-white">{value}</dd>
    </div>
  );
}

export default function ReservationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { address, connect, status } = useWallet();
  const eventId = useMemo(() => parseEventId(id), [id]);

  const state = useAsyncData<ReservationSnapshot>(
    async () => {
      const [event, ledgerNow, reservation] = await Promise.all([
        getEvent(eventId!),
        getLedgerNow(),
        getReservation(eventId!, address!),
      ]);
      return { event, ledgerNow, reservation };
    },
    [eventId, address],
    { enabled: eventId !== null && Boolean(address) },
  );

  if (eventId === null) {
    return (
      <main className="mx-auto w-full max-w-3xl px-5 py-20 sm:px-8">
        <h1 className="text-3xl font-black tracking-tight">
          Invalid reservation link
        </h1>
        <p className="mt-3 text-slate-400">
          Event identifiers are positive whole numbers.
        </p>
        <Button asChild className="mt-8" variant="outline">
          <Link href="/reservations">Back to reservations</Link>
        </Button>
      </main>
    );
  }

  if (!address) {
    return (
      <main className="mx-auto w-full max-w-3xl px-5 py-20 sm:px-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">
          Reservation #{eventId.toString()}
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight">
          Connect your participant wallet
        </h1>
        <p className="mt-3 max-w-xl leading-7 text-slate-400">
          The reservation and QR pass are read for the connected Testnet
          address. No signature is requested on this page.
        </p>
        <Button
          className="mt-8"
          disabled={status === "connecting"}
          onClick={() => void connect()}
          type="button"
        >
          {status === "connecting" ? "Connecting…" : "Connect Freighter"}
        </Button>
      </main>
    );
  }

  if (state.status === "loading") {
    return (
      <main
        className="mx-auto w-full max-w-3xl px-5 py-14 sm:px-8"
        aria-label="Loading reservation"
      >
        <Skeleton className="h-8 w-56 rounded-xl bg-white/8" />
        <Skeleton className="mt-4 h-5 w-80 rounded-lg bg-white/5" />
        <Skeleton className="mt-10 h-72 rounded-3xl bg-white/5" />
        <Skeleton className="mt-4 h-80 rounded-3xl bg-white/5" />
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className="mx-auto w-full max-w-3xl px-5 py-20 sm:px-8">
        <ErrorState
          error={state.error}
          fallback="Could not read this reservation from the contract."
          onRetry={state.reload}
          title="Could not load the reservation"
        />
      </main>
    );
  }

  const { event, ledgerNow, reservation } = state.data;

  if (!reservation) {
    return (
      <main className="mx-auto w-full max-w-3xl px-5 py-20 sm:px-8">
        <h1 className="text-3xl font-black tracking-tight">
          No reservation for this wallet
        </h1>
        <p className="mt-3 text-slate-400">
          The connected address has no reservation for {event.title}.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild>
            <Link href={`/events/${event.id}`}>View event</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/reservations">All reservations</Link>
          </Button>
        </div>
      </main>
    );
  }

  const hasActivePass =
    event.status === "active" && reservation.status === "locked";
  let qrPayload: string | null = null;
  if (hasActivePass) {
    try {
      qrPayload = encodePass({
        eventId: event.id,
        participant: reservation.participant,
        issuedAt: ledgerNow,
      });
    } catch {
      qrPayload = null;
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-14 sm:px-8">
      <Link
        className="text-sm font-semibold text-slate-400 transition hover:text-cyan-300"
        href="/reservations"
      >
        ← Your reservations
      </Link>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <span className="num rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-xs text-slate-400">
          Event #{event.id.toString()}
        </span>
        <StatusBadge
          pulse={reservation.status === "locked" && event.status === "active"}
          tone={statusTone(event, reservation)}
        >
          {displayStatus(event, reservation, ledgerNow)}
        </StatusBadge>
      </div>

      <h1 className="mt-6 text-4xl font-black leading-tight tracking-[-0.045em] sm:text-5xl">
        {event.title}
      </h1>
      <p className="mt-3 text-lg text-slate-400">{event.venue}</p>

      <section className="glass mt-10 rounded-3xl px-6 py-2">
        <dl className="divide-y divide-white/10">
          <Row label="Bond" value={<Money stroops={reservation.amount} />} />
          <Row label="Reserved" value={formatMoment(reservation.reservedAt)} />
          <Row label="Event starts" value={formatMoment(event.startTime)} />
          <Row
            label="Check-in window"
            value={`${formatMoment(event.checkinStart)} — ${formatMoment(event.checkinDeadline)}`}
          />
          <Row
            label="On-chain status"
            value={reservation.status.replaceAll("_", " ")}
          />
        </dl>
      </section>

      {hasActivePass && qrPayload ? (
        <section className="glass mt-8 rounded-3xl border-cyan-300/25 p-6 sm:p-8">
          <div className="grid items-center gap-8 sm:grid-cols-[280px_1fr]">
            <QrPass payload={qrPayload} />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">
                Check-in pass
              </p>
              <h2 className="mt-3 text-2xl font-black">
                Show this to the organizer
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                This QR only identifies your reservation. It cannot release the
                bond by itself; the event verifier must inspect it and sign the
                check-in transaction with their wallet.
              </p>
              <p className="mt-4 break-all font-mono text-xs text-slate-500">
                {reservation.participant}
              </p>
            </div>
          </div>
        </section>
      ) : hasActivePass ? (
        <p className="mt-8 rounded-2xl border border-amber-300/25 bg-amber-300/5 px-5 py-4 text-sm text-amber-100">
          This event identifier cannot be represented safely in a QR pass.
        </p>
      ) : (
        <p className="mt-8 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm leading-6 text-slate-300">
          This reservation no longer has an active QR pass. Its final state is
          recorded above directly from the contract.
        </p>
      )}

      <details className="mt-12 rounded-2xl border border-white/10 bg-slate-950/60 px-5 py-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-300">
          Technical details
        </summary>
        <dl className="mt-4 space-y-3 font-mono text-xs text-slate-400">
          <div className="flex flex-wrap justify-between gap-2">
            <dt>Participant</dt>
            <dd className="break-all">{reservation.participant}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Amount (stroops)</dt>
            <dd className="num">{reservation.amount.toString()}</dd>
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

"use client";

import Link from "next/link";
import { use, useMemo, useRef, useState } from "react";

import { QrPass } from "@/components/qr/qr-pass";
import {
  TxStatus,
  txFailureState,
  type TxState,
} from "@/components/tx/tx-status";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { EnableUsdcAction } from "@/components/wallet/enable-usdc-action";
import {
  cancelReservation,
  claimCancelledRefund,
  getEvent,
  getReservation,
  type TxPhase,
} from "@/lib/contract";
import {
  canCancelReservation,
  canClaimCancelledRefund,
  type EventView,
  type ReservationView,
} from "@/lib/domain";
import { reservationBucket } from "@/lib/domain/reservation-buckets";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { encodePass } from "@/lib/qr";
import {
  getAccountAssets,
  getLedgerNow,
  type AccountAssets,
} from "@/lib/stellar";
import { useWallet } from "@/lib/wallet/provider";

type ReservationSnapshot = {
  event: EventView;
  ledgerNow: number;
  reservation: ReservationView | null;
  assets: AccountAssets | null;
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
  if (reservation.status === "no_show_settled") return "critical";
  if (event.status === "cancelled") return "neutral";
  return "accent";
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
      <dt className="text-sm text-slate-400">{label}</dt>
      <dd className="text-sm font-semibold text-white sm:text-right">{value}</dd>
    </div>
  );
}

export default function ReservationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { address, canTransact, connect, signTransaction, status } = useWallet();
  const eventId = useMemo(() => parseEventId(id), [id]);
  const [confirmation, setConfirmation] = useState<"cancel" | "refund" | null>(
    null,
  );
  const [tx, setTx] = useState<TxState>({ kind: "idle" });
  const actionBusy = useRef(false);

  const state = useAsyncData<ReservationSnapshot>(
    async () => {
      const [event, ledgerNow, reservation, assets] = await Promise.all([
        getEvent(eventId!),
        getLedgerNow(),
        getReservation(eventId!, address!),
        getAccountAssets(address!).catch(() => null),
      ]);
      return { event, ledgerNow, reservation, assets };
    },
    [eventId, address],
    { enabled: eventId !== null && Boolean(address) },
  );

  if (eventId === null) {
    return (
      <main className="mx-auto w-full max-w-3xl px-5 py-20 sm:px-8">
        <h1 className="text-3xl font-bold tracking-tight">
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
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">
          Reservation #{eventId.toString()}
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">
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
          {status === "connecting" ? "Connecting…" : "Connect wallet"}
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
        <Skeleton className="mt-4 h-5 w-full max-w-80 rounded-lg bg-white/5" />
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

  const { assets, event, ledgerNow, reservation } = state.data;

  if (!reservation) {
    return (
      <main className="mx-auto w-full max-w-3xl px-5 py-20 sm:px-8">
        <h1 className="text-3xl font-bold tracking-tight">
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

  const currentReservation = reservation;
  const ownsReservation = address === currentReservation.participant;
  const canReceiveUsdc = assets === null || assets.hasUsdcTrustline;

  const hasActivePass =
    event.status === "active" && currentReservation.status === "locked";
  const cancellationEligible =
    ownsReservation &&
    canCancelReservation(event, currentReservation, ledgerNow);
  const refundEligible =
    ownsReservation &&
    canClaimCancelledRefund(event, currentReservation, ledgerNow);
  const cancellationAvailable = cancellationEligible && canReceiveUsdc;
  const refundAvailable = refundEligible && canReceiveUsdc;
  let qrPayload: string | null = null;
  if (hasActivePass) {
    try {
      qrPayload = encodePass({
        eventId: event.id,
        participant: currentReservation.participant,
        issuedAt: ledgerNow,
      });
    } catch {
      qrPayload = null;
    }
  }

  async function runAction(kind: "cancel" | "refund") {
    if (!address || !canTransact || actionBusy.current) return;
    if (kind === "cancel" && !cancellationAvailable) return;
    if (kind === "refund" && !refundAvailable) return;

    actionBusy.current = true;
    setTx({ kind: "running", phase: "simulating" });
    try {
      const signer = { address, signTransaction };
      const onPhase = (phase: TxPhase) =>
        setTx({ kind: "running", phase });
      const { hash } =
        kind === "cancel"
          ? await cancelReservation(event.id, signer, onPhase)
          : await claimCancelledRefund(
              event.id,
              currentReservation.participant,
              signer,
              onPhase,
            );

      setConfirmation(null);
      setTx({
        kind: "success",
        hash,
        message:
          kind === "cancel"
            ? "Reservation cancelled. The contract returned the full bond."
            : "Cancelled-event refund claimed. The contract returned the full bond.",
        amountStroops: currentReservation.amount,
        amountCaption: "returned to the participant",
      });
      state.reload();
    } catch (error) {
      setTx(
        txFailureState(
          error,
          "The contract action could not be completed. Refresh and try again.",
        ),
      );
      state.reload();
    } finally {
      actionBusy.current = false;
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-14 sm:px-8">
      <Link
        className="text-sm font-semibold text-slate-400 transition hover:text-brand"
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

      <h1 className="mt-6 text-4xl font-bold leading-tight tracking-[-0.045em] [overflow-wrap:anywhere] sm:text-5xl">
        {event.title}
      </h1>
      <p className="mt-3 text-lg text-slate-400 [overflow-wrap:anywhere]">
        {event.venue}
      </p>

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
        <section className="glass mt-8 rounded-3xl border-brand/25 p-6 sm:p-8">
          <div className="grid items-center gap-8 sm:grid-cols-[280px_1fr]">
            <QrPass payload={qrPayload} />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">
                Check-in pass
              </p>
              <h2 className="mt-3 text-2xl font-bold">
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

      {(cancellationEligible || refundEligible) && !canReceiveUsdc ? (
        <section className="mt-8">
          <p className="mb-3 rounded-2xl border border-amber-300/25 bg-amber-300/5 px-5 py-4 text-sm leading-6 text-amber-100">
            This account no longer has the USDC trustline needed to receive the bond. Re-enable it before cancelling or claiming a refund.
          </p>
          <EnableUsdcAction assets={assets} onSuccess={state.reload} />
        </section>
      ) : cancellationAvailable || refundAvailable ? (
        <section className="glass mt-8 rounded-3xl px-6 py-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
            Bond action
          </p>
          {confirmation === null ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">
                  {refundAvailable
                    ? "Claim the cancelled-event refund"
                    : "Cancel this reservation"}
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
                  {refundAvailable
                    ? "The event is cancelled. This pull-refund returns the full locked bond to the participant."
                    : `Cancellation is available until ${formatMoment(event.cancellationDeadline)} and returns the full locked bond.`}
                </p>
              </div>
              <Button
                disabled={!canTransact || tx.kind === "running"}
                onClick={() => {
                  setTx({ kind: "idle" });
                  setConfirmation(refundAvailable ? "refund" : "cancel");
                }}
                type="button"
                variant={refundAvailable ? "default" : "destructive"}
              >
                {refundAvailable ? "Claim full refund" : "Cancel reservation"}
              </Button>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-amber-300/25 bg-amber-300/5 px-5 py-5">
              <h2 className="font-bold text-amber-100">
                {confirmation === "cancel"
                  ? "Confirm reservation cancellation"
                  : "Confirm refund claim"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                This wallet will sign one Testnet transaction. The action is
                final once confirmed on a ledger, and the contract returns {" "}
                <span className="font-mono font-bold text-white">
                  <Money stroops={reservation.amount} />
                </span>{" "}
                to {reservation.participant}.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  disabled={tx.kind === "running"}
                  onClick={() => void runAction(confirmation)}
                  type="button"
                  variant={confirmation === "cancel" ? "destructive" : "default"}
                >
                  {tx.kind === "running"
                    ? "Working…"
                    : confirmation === "cancel"
                      ? "Sign cancellation"
                      : "Sign refund claim"}
                </Button>
                <Button
                  disabled={tx.kind === "running"}
                  onClick={() => setConfirmation(null)}
                  type="button"
                  variant="outline"
                >
                  {confirmation === "cancel" ? "Keep reservation" : "Not now"}
                </Button>
              </div>
            </div>
          )}
        </section>
      ) : reservation.status === "locked" && event.status === "active" ? (
        <p className="mt-8 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm leading-6 text-slate-300">
          The free-cancellation window closed at {formatMoment(event.cancellationDeadline)}. The bond remains locked for check-in or no-show settlement.
        </p>
      ) : null}

      <div className="mt-4">
        <TxStatus state={tx} />
      </div>

      <details className="mt-12 rounded-2xl border border-white/10 bg-slate-950/60 px-5 py-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-300">
          Reservation record
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

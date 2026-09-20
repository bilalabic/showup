"use client";

import Link from "next/link";
import { use, useMemo, useRef, useState } from "react";

import {
  TxStatus,
  txFailureState,
  type TxState,
} from "@/components/tx/tx-status";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { ErrorState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  cancelEvent,
  getEvent,
  listEventReservations,
  settleNoShow,
  type EventReservationList,
  type TxPhase,
} from "@/lib/contract";
import {
  canSettleNoShow,
  splitByBps,
  type EventView,
  type ReservationView,
} from "@/lib/domain";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { getLedgerNow } from "@/lib/stellar";
import { useWallet } from "@/lib/wallet/provider";

type OrganizerSnapshot = {
  event: EventView;
  reservationList: EventReservationList | null;
  ledgerNow: number | null;
};

type PendingAction =
  | { kind: "cancel_event" }
  | { kind: "settle_no_show"; reservation: ReservationView }
  | null;

const MAX_U64 = (1n << 64n) - 1n;

export default function OrganizerEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const eventId = useMemo(() => {
    try {
      const parsed = BigInt(id);
      return parsed > 0n && parsed <= MAX_U64 ? parsed : null;
    } catch {
      return null;
    }
  }, [id]);
  const { address, canTransact, connect, signTransaction, status } = useWallet();
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [tx, setTx] = useState<TxState>({ kind: "idle" });
  const actionBusy = useRef(false);

  const state = useAsyncData<OrganizerSnapshot>(
    async () => {
      const event = await getEvent(eventId!);
      if (!address || (address !== event.organizer && address !== event.verifier)) {
        return { event, reservationList: null, ledgerNow: null };
      }
      const [reservationList, ledgerNow] = await Promise.all([
        listEventReservations(event.id),
        getLedgerNow(),
      ]);
      return { event, reservationList, ledgerNow };
    },
    [eventId, address],
    { enabled: eventId !== null },
  );

  if (eventId === null) {
    return (
      <main className="mx-auto w-full max-w-5xl px-5 py-20 sm:px-8">
        <h1 className="text-3xl font-bold">Invalid event</h1>
        <Link className="mt-6 inline-block text-brand underline" href="/organizer">
          Back to organizer events
        </Link>
      </main>
    );
  }

  if (state.status === "loading") {
    return (
      <main className="mx-auto w-full max-w-5xl px-5 py-14 sm:px-8">
        <div className="h-10 w-full max-w-72 animate-pulse rounded-xl bg-white/10" />
        <div className="mt-8 h-72 animate-pulse rounded-3xl bg-white/5" />
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className="mx-auto w-full max-w-5xl px-5 py-20 sm:px-8">
        <ErrorState
          error={state.error}
          fallback="Could not load the organizer view from the contract."
          onRetry={state.reload}
          title="Could not load organizer view"
        />
      </main>
    );
  }

  const { event, reservationList, ledgerNow } = state.data;
  const authorized =
    address === event.organizer || address === event.verifier;
  const reservations = reservationList?.reservations ?? [];
  const attended = reservations.filter((item) => item.status === "attended").length;
  const locked = reservations.filter((item) => item.status === "locked").length;
  const settled = reservations.filter(
    (item) => item.status === "no_show_settled",
  ).length;
  const cancelAvailable =
    event.status === "active" && address === event.organizer;

  async function runPendingAction() {
    if (
      !pendingAction ||
      !address ||
      !canTransact ||
      actionBusy.current
    ) {
      return;
    }

    if (pendingAction.kind === "cancel_event" && !cancelAvailable) return;
    if (
      pendingAction.kind === "settle_no_show" &&
      (ledgerNow === null ||
        !canSettleNoShow(event, pendingAction.reservation, ledgerNow))
    ) {
      return;
    }

    actionBusy.current = true;
    setTx({ kind: "running", phase: "simulating" });
    try {
      const signer = { address, signTransaction };
      const onPhase = (phase: TxPhase) =>
        setTx({ kind: "running", phase });

      if (pendingAction.kind === "cancel_event") {
        const { hash } = await cancelEvent(event.id, signer, onPhase);
        setTx({
          kind: "success",
          hash,
          message:
            "Event cancelled. Locked bonds remain in the contract until each participant claims a full refund.",
        });
      } else {
        const { reservation } = pendingAction;
        const { hash } = await settleNoShow(
          event.id,
          reservation.participant,
          signer,
          onPhase,
        );
        setTx({
          kind: "success",
          hash,
          message:
            "No-show settlement confirmed. The contract applied the published organizer/community split.",
          amountStroops: reservation.amount,
          amountCaption: "settled by the contract",
        });
      }

      setPendingAction(null);
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
    <main className="mx-auto w-full max-w-5xl px-5 py-12 sm:px-8">
      <Link
        className="text-sm font-semibold text-slate-400 transition hover:text-brand"
        href="/organizer"
      >
        ← Your events
      </Link>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-mono text-xs text-brand">EVENT #{event.id.toString()}</p>
            <StatusBadge tone={event.status === "cancelled" ? "neutral" : "positive"}>
              {event.status}
            </StatusBadge>
          </div>
          <h1 className="mt-2 text-4xl font-bold tracking-[-0.04em] [overflow-wrap:anywhere]">
            {event.title}
          </h1>
          <p className="mt-2 text-slate-400 [overflow-wrap:anywhere]">
            {event.venue}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold transition hover:border-brand/50"
            href={`/events/${event.id.toString()}`}
          >
            Public event
          </Link>
          {authorized && event.status === "active" ? (
            <Button asChild>
              <Link href={`/organizer/events/${event.id.toString()}/scan`}>
                Open scanner
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      {!address ? (
        <section className="mt-8 rounded-3xl border border-dashed border-white/15 px-6 py-8 text-center">
          <p className="text-sm text-slate-300">
            Connect the organizer wallet to view reservation addresses.
          </p>
          <button
            className="mt-4 rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
            disabled={status === "connecting"}
            onClick={() => void connect()}
            type="button"
          >
            {status === "connecting" ? "Connecting…" : "Connect wallet"}
          </button>
        </section>
      ) : !authorized ? (
        <section className="mt-8 rounded-3xl border border-rose-400/25 bg-rose-400/5 px-6 py-6">
          <h2 className="font-bold text-rose-100">Not this event&apos;s organizer</h2>
          <p className="mt-2 break-all text-sm leading-6 text-slate-300">
            Connect {event.organizer} to open the reservation list and scanner.
          </p>
        </section>
      ) : reservationList ? (
        <>
          <section className="glass mt-8 rounded-3xl px-5 py-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">Event controls</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
                  {event.status === "cancelled"
                    ? "This event is cancelled. Every locked participant can pull their full refund from the reservation page."
                    : "Cancelling is final. It does not push funds in a batch; participants claim their own full refunds."}
                </p>
              </div>
              {cancelAvailable ? (
                <Button
                  disabled={tx.kind === "running"}
                  onClick={() => {
                    setTx({ kind: "idle" });
                    setPendingAction({ kind: "cancel_event" });
                  }}
                  type="button"
                  variant="destructive"
                >
                  Cancel event
                </Button>
              ) : null}
            </div>

            {pendingAction ? (
              <div className="mt-5 rounded-2xl border border-amber-300/25 bg-amber-300/5 px-5 py-5">
                <h3 className="font-bold text-amber-100">
                  {pendingAction.kind === "cancel_event"
                    ? "Confirm event cancellation"
                    : "Confirm no-show settlement"}
                </h3>
                {pendingAction.kind === "cancel_event" ? (
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    This wallet will sign one final Testnet cancellation. No bond moves in this transaction; each locked participant must claim their refund separately.
                  </p>
                ) : (() => {
                  const split = splitByBps(
                    pendingAction.reservation.amount,
                    event.organizerBps,
                  );
                  return (
                    <div className="mt-2 text-sm leading-6 text-slate-300">
                      <p className="break-all">
                        Participant: {pendingAction.reservation.participant}
                      </p>
                      <p className="mt-2">
                        The contract will send <Money stroops={split.organizer} /> to the organizer and <Money stroops={split.community} /> to the community pool. This is final once confirmed.
                      </p>
                    </div>
                  );
                })()}
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button
                    disabled={tx.kind === "running"}
                    onClick={() => void runPendingAction()}
                    type="button"
                    variant={
                      pendingAction.kind === "cancel_event"
                        ? "destructive"
                        : "warning"
                    }
                  >
                    {tx.kind === "running"
                      ? "Working…"
                      : pendingAction.kind === "cancel_event"
                        ? "Sign event cancellation"
                        : "Sign no-show settlement"}
                  </Button>
                  <Button
                    disabled={tx.kind === "running"}
                    onClick={() => setPendingAction(null)}
                    type="button"
                    variant="outline"
                  >
                    Not now
                  </Button>
                </div>
              </div>
            ) : null}
            <div className="mt-4">
              <TxStatus state={tx} />
            </div>
          </section>

          <section className="mt-8 grid gap-3 sm:grid-cols-4">
            {[
              ["Reserved", reservations.length],
              ["Locked", locked],
              ["Attended", attended],
              ["No-show settled", settled],
            ].map(([label, value]) => (
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 px-5 py-4" key={label}>
                <p className="text-xs uppercase tracking-wider text-slate-400">{label}</p>
                <p className="mt-2 text-2xl font-bold">{value}</p>
              </div>
            ))}
          </section>

          {!reservationList.historyComplete ? (
            <p className="mt-5 rounded-2xl border border-amber-300/25 bg-amber-300/5 px-5 py-4 text-sm leading-6 text-amber-100">
              {reservationList.unreadable > 0
                ? `${reservationList.unreadable} known reservation${reservationList.unreadable === 1 ? "" : "s"} could not be read from contract storage. `
                : ""}
              The RPC retention window may also omit older participants. The rows below are current contract records, but the list is explicitly incomplete.
            </p>
          ) : null}

          <section className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
              <h2 className="text-lg font-bold">Reservations</h2>
              <span className="text-xs text-slate-400">
                {event.reservedCount} of {event.capacity} recorded on the event
              </span>
            </div>
            {reservations.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-400">
                No reservations are visible in the retained event history.
              </p>
            ) : (
              <ul className="divide-y divide-white/10">
                {reservations.map((reservation) => (
                  <li className="flex flex-wrap items-center justify-between gap-4 px-5 py-4" key={reservation.participant}>
                    <div className="min-w-0">
                      <p className="break-all font-mono text-xs text-slate-300">{reservation.participant}</p>
                      <p className="mt-1 text-sm text-slate-400">
                        <Money stroops={reservation.amount} /> · {reservation.status.replaceAll("_", " ")}
                      </p>
                    </div>
                    {ledgerNow !== null &&
                    canSettleNoShow(event, reservation, ledgerNow) ? (
                      <Button
                        disabled={tx.kind === "running"}
                        onClick={() => {
                          setTx({ kind: "idle" });
                          setPendingAction({
                            kind: "settle_no_show",
                            reservation,
                          });
                        }}
                        size="sm"
                        type="button"
                        variant="warning"
                      >
                        Settle no-show
                      </Button>
                    ) : reservation.status === "locked" &&
                      event.status === "active" ? (
                      <Link
                        className="rounded-full border border-brand/30 px-4 py-2 text-sm font-semibold text-brand-soft transition hover:bg-brand/10"
                        href={`/organizer/events/${event.id.toString()}/scan?participant=${encodeURIComponent(reservation.participant)}`}
                      >
                        Verify manually
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}

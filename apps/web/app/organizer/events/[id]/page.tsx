"use client";

import Link from "next/link";
import { use, useMemo } from "react";

import {
  getEvent,
  listEventReservations,
  type EventReservationList,
} from "@/lib/contract";
import { fromStroops, type EventView } from "@/lib/domain";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useWallet } from "@/lib/wallet/provider";

type OrganizerSnapshot = {
  event: EventView;
  reservationList: EventReservationList | null;
};

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
  const { address, connect, status } = useWallet();

  const state = useAsyncData<OrganizerSnapshot>(
    async () => {
      const event = await getEvent(eventId!);
      if (!address || (address !== event.organizer && address !== event.verifier)) {
        return { event, reservationList: null };
      }
      const reservationList = await listEventReservations(event.id);
      return { event, reservationList };
    },
    [eventId, address],
    { enabled: eventId !== null },
  );

  if (eventId === null) {
    return (
      <main className="mx-auto w-full max-w-5xl px-5 py-20 sm:px-8">
        <h1 className="text-3xl font-black">Invalid event</h1>
        <Link className="mt-6 inline-block text-cyan-300 underline" href="/organizer">
          Back to organizer events
        </Link>
      </main>
    );
  }

  if (state.status === "loading") {
    return (
      <main className="mx-auto w-full max-w-5xl px-5 py-14 sm:px-8">
        <div className="h-10 w-72 animate-pulse rounded-xl bg-white/10" />
        <div className="mt-8 h-72 animate-pulse rounded-3xl bg-white/5" />
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className="mx-auto w-full max-w-5xl px-5 py-20 sm:px-8">
        <h1 className="text-3xl font-black">Could not load organizer view</h1>
        <p className="mt-3 text-slate-400">
          {state.error instanceof Error ? state.error.message : "Try again."}
        </p>
        <button
          className="mt-6 rounded-full bg-cyan-300 px-5 py-2.5 font-bold text-slate-950"
          onClick={state.reload}
          type="button"
        >
          Try again
        </button>
      </main>
    );
  }

  const { event, reservationList } = state.data;
  const authorized =
    address === event.organizer || address === event.verifier;
  const reservations = reservationList?.reservations ?? [];
  const attended = reservations.filter((item) => item.status === "attended").length;
  const locked = reservations.filter((item) => item.status === "locked").length;
  const settled = reservations.filter(
    (item) => item.status === "no_show_settled",
  ).length;

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-12 sm:px-8">
      <Link
        className="text-sm font-semibold text-slate-400 transition hover:text-cyan-300"
        href="/organizer"
      >
        ← Your events
      </Link>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs text-cyan-300">EVENT #{event.id.toString()}</p>
          <h1 className="mt-2 text-4xl font-black tracking-[-0.04em]">{event.title}</h1>
          <p className="mt-2 text-slate-400">{event.venue}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold transition hover:border-cyan-300/50"
            href={`/events/${event.id.toString()}`}
          >
            Public event
          </Link>
          {authorized ? (
            <Link
              className="rounded-full bg-cyan-300 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-200"
              href={`/organizer/events/${event.id.toString()}/scan`}
            >
              Open scanner
            </Link>
          ) : null}
        </div>
      </div>

      {!address ? (
        <section className="mt-8 rounded-3xl border border-dashed border-white/15 px-6 py-8 text-center">
          <p className="text-sm text-slate-300">
            Connect the organizer wallet to view reservation addresses.
          </p>
          <button
            className="mt-4 rounded-full bg-cyan-300 px-5 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-50"
            disabled={status === "connecting"}
            onClick={() => void connect()}
            type="button"
          >
            {status === "connecting" ? "Connecting…" : "Connect Freighter"}
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
          <section className="mt-8 grid gap-3 sm:grid-cols-4">
            {[
              ["Reserved", reservations.length],
              ["Locked", locked],
              ["Attended", attended],
              ["No-show settled", settled],
            ].map(([label, value]) => (
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 px-5 py-4" key={label}>
                <p className="text-xs uppercase tracking-wider text-slate-400">{label}</p>
                <p className="mt-2 text-2xl font-black">{value}</p>
              </div>
            ))}
          </section>

          {!reservationList.historyComplete ? (
            <p className="mt-5 rounded-2xl border border-amber-300/25 bg-amber-300/5 px-5 py-4 text-sm leading-6 text-amber-100">
              Stellar RPC no longer retains this event&apos;s complete history. The rows below are current contract records for participants still discoverable in the retained event window; the list may be incomplete.
            </p>
          ) : null}

          <section className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
              <h2 className="text-lg font-black">Reservations</h2>
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
                        {fromStroops(reservation.amount)} USDC · {reservation.status.replaceAll("_", " ")}
                      </p>
                    </div>
                    {reservation.status === "locked" ? (
                      <Link
                        className="rounded-full border border-cyan-300/30 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-300/10"
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

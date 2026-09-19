"use client";

import Link from "next/link";

import { listEvents } from "@/lib/contract";
import { fromStroops } from "@/lib/domain";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useWallet } from "@/lib/wallet/provider";

export default function OrganizerPage() {
  const { address, connect, status } = useWallet();

  const state = useAsyncData(
    // There is no off-chain index by design, so the organizer's events are
    // found by reading the contract and filtering. Counts are small enough for
    // this to stay cheap.
    async () => {
      const all = await listEvents();
      return all.filter((event) => event.organizer === address);
    },
    [address],
    { enabled: Boolean(address) },
  );

  const retry = state.reload;

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-14 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-[-0.04em]">Your events</h1>
          <p className="mt-2 text-slate-400">
            Events you created with the connected wallet.
          </p>
        </div>
        <Link
          className="rounded-full bg-cyan-300 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-200"
          href="/organizer/events/new"
        >
          Create event
        </Link>
      </div>

      <div className="mt-10">
        {!address ? (
          <div className="rounded-2xl border border-dashed border-white/15 px-5 py-8 text-center">
            <p className="text-sm text-slate-300">
              Connect your Testnet wallet to see the events you organize.
            </p>
            <button
              className="mt-4 rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold transition hover:border-cyan-300/60"
              disabled={status === "connecting"}
              onClick={() => void connect()}
              type="button"
            >
              {status === "connecting" ? "Connecting…" : "Connect Freighter"}
            </button>
          </div>
        ) : state.status === "loading" ? (
          <div className="space-y-3">
            <div className="h-24 animate-pulse rounded-2xl bg-white/5" />
            <div className="h-24 animate-pulse rounded-2xl bg-white/5" />
          </div>
        ) : state.status === "error" ? (
          <div className="rounded-2xl border border-rose-400/25 bg-rose-400/5 px-5 py-6">
            <p className="text-sm text-rose-100">{state.error instanceof Error ? state.error.message : "Could not read events from the contract."}</p>
            <button
              className="mt-4 rounded-full border border-rose-300/30 px-5 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-400/10"
              onClick={retry}
              type="button"
            >
              Try again
            </button>
          </div>
        ) : state.data.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 px-5 py-10 text-center">
            <p className="text-sm text-slate-300">
              You have not created an event yet.
            </p>
            <Link
              className="mt-4 inline-block rounded-full bg-cyan-300 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-200"
              href="/organizer/events/new"
            >
              Create your first event
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {state.data.map((event) => (
              <li key={event.id.toString()}>
                <Link
                  className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-900/60 px-5 py-5 transition hover:border-cyan-300/40"
                  href={`/events/${event.id}`}
                >
                  <div>
                    <p className="text-lg font-bold">{event.title}</p>
                    <p className="mt-1 text-sm text-slate-400">{event.venue}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm font-bold text-cyan-300">
                      {fromStroops(event.bondAmount)} USDC
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {event.reservedCount} of {event.capacity} reserved
                      {event.status === "cancelled" ? " · cancelled" : ""}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

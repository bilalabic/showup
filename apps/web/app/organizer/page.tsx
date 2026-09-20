"use client";

import Link from "next/link";
import { m, useReducedMotion } from "motion/react";

import { Button } from "@/components/ui/button";
import { CapacityMeter } from "@/components/ui/capacity-meter";
import { Money } from "@/components/ui/money";
import { ConnectPrompt, EmptyState, ErrorState, LoadingRows } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { listEvents } from "@/lib/contract";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useWallet } from "@/lib/wallet/provider";

export default function OrganizerPage() {
  const { address } = useWallet();
  const reduceMotion = useReducedMotion();

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
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">
            Organizer
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-[-0.04em]">
            Your events
          </h1>
          <p className="mt-2 text-slate-400">
            Events you created with the connected wallet.
          </p>
        </div>
        <Button asChild>
          <Link href="/organizer/events/new">Create event</Link>
        </Button>
      </div>

      <div className="mt-10">
        {!address ? (
          <ConnectPrompt>
            Connect your Testnet wallet to see the events you organize. Your
            events are found by reading the contract, not a database.
          </ConnectPrompt>
        ) : state.status === "loading" ? (
          <LoadingRows count={2} height="h-32" />
        ) : state.status === "error" ? (
          <ErrorState
            error={state.error}
            fallback="Could not read events from the contract."
            onRetry={retry}
            title="Could not read your events"
          />
        ) : state.data.length === 0 ? (
          <EmptyState
            action={
              <Button asChild>
                <Link href="/organizer/events/new">Create your first event</Link>
              </Button>
            }
            title="No events yet"
          >
            Nothing on this contract names the connected wallet as organizer.
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {state.data.map((event, index) => (
              <m.li
                animate={{ opacity: 1, y: 0 }}
                initial={reduceMotion ? false : { opacity: 0, y: 14 }}
                key={event.id.toString()}
                transition={{
                  delay: reduceMotion ? 0 : index * 0.05,
                  duration: 0.4,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <Link
                  className="group block rounded-3xl border border-white/10 bg-white/[0.02] p-5 transition-[border-color,background-color,transform,box-shadow] duration-(--duration-component) ease-(--ease-out-soft) hover:-translate-y-0.5 hover:border-brand/40 hover:bg-white/[0.05] hover:shadow-[0_24px_50px_-32px_rgba(77,230,198,0.5)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:hover:translate-y-0"
                  href={`/organizer/events/${event.id}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-lg font-bold tracking-tight [overflow-wrap:anywhere]">
                        {event.title}
                      </p>
                      <p className="mt-1 text-sm text-slate-400 [overflow-wrap:anywhere]">
                        {event.venue}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {event.status === "cancelled" ? (
                        <StatusBadge tone="neutral">Cancelled</StatusBadge>
                      ) : event.reservedCount >= event.capacity ? (
                        <StatusBadge tone="warning">Full</StatusBadge>
                      ) : (
                        <StatusBadge tone="positive">Active</StatusBadge>
                      )}
                      <p className="text-right text-base font-bold text-brand">
                        <Money stroops={event.bondAmount} />
                      </p>
                    </div>
                  </div>
                  <div className="mt-5">
                    <CapacityMeter
                      capacity={event.capacity}
                      reserved={event.reservedCount}
                    />
                  </div>
                </Link>
              </m.li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

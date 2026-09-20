"use client";

import Link from "next/link";
import { m, useReducedMotion } from "motion/react";

import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import {
  ConnectPrompt,
  EmptyState,
  ErrorState,
  LoadingRows,
} from "@/components/ui/states";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getReservation, listEvents } from "@/lib/contract";
import {
  reservationBucket,
  type ReservationBucket,
} from "@/lib/domain/reservation-buckets";
import {
  collectReservationResults,
  type ReadableReservation,
} from "@/lib/domain/reservation-results";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { getLedgerNow } from "@/lib/stellar";
import { useWallet } from "@/lib/wallet/provider";

type ReservationItem = ReadableReservation;

type ReservationSnapshot = {
  ledgerNow: number;
  items: ReservationItem[];
  unreadable: number;
};

const BUCKETS: Array<{
  key: ReservationBucket;
  title: string;
  empty: string;
}> = [
  {
    key: "upcoming",
    title: "Upcoming",
    empty: "No active reservations are waiting for check-in.",
  },
  {
    key: "attended",
    title: "Attended",
    empty: "No attended reservations yet.",
  },
  {
    key: "cancelled",
    title: "Cancelled",
    empty: "No cancelled or refunded reservations.",
  },
  {
    key: "no_show",
    title: "No-show",
    empty: "No no-show or settlement-pending reservations.",
  },
];

function formatMoment(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function statusCopy(
  item: ReservationItem,
  bucket: ReservationBucket,
): { label: string; tone: StatusTone } {
  const { event, reservation } = item;

  if (reservation.status === "attended") {
    return { label: "Checked in · bond returned", tone: "positive" };
  }
  if (reservation.status === "cancelled") {
    return { label: "Cancelled · bond returned", tone: "neutral" };
  }
  if (reservation.status === "refunded") {
    return { label: "Event cancelled · refund claimed", tone: "neutral" };
  }
  if (reservation.status === "no_show_settled") {
    return { label: "No-show settlement confirmed", tone: "critical" };
  }
  if (event.status === "cancelled") {
    return { label: "Event cancelled · refund available", tone: "neutral" };
  }
  if (bucket === "no_show") {
    return { label: "Check-in closed · awaiting settlement", tone: "critical" };
  }
  return { label: "Bond locked · ready for check-in", tone: "accent" };
}

export default function ReservationsPage() {
  const { address } = useWallet();
  const reduceMotion = useReducedMotion();

  const state = useAsyncData<ReservationSnapshot>(
    async () => {
      const [events, ledgerNow] = await Promise.all([
        listEvents(),
        getLedgerNow(),
      ]);
      const reservations = await Promise.allSettled(
        events.map((event) => getReservation(event.id, address!)),
      );
      const { items, unreadable } = collectReservationResults(events, reservations);

      return { ledgerNow, items, unreadable };
    },
    [address],
    { enabled: Boolean(address) },
  );

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-14 sm:px-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">
          Participant
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-[-0.04em]">
          Your reservations
        </h1>
        <p className="mt-3 max-w-2xl leading-7 text-slate-400">
          Every status below is read directly from the ShowUp contract on
          Stellar Testnet.
        </p>
      </div>

      <div className="mt-10">
        {!address ? (
          <ConnectPrompt>
            Connect the Testnet wallet you used to reserve. Reservations are
            keyed to an address by the contract, not by an account on a server.
          </ConnectPrompt>
        ) : state.status === "loading" ? (
          <LoadingRows count={3} height="h-32" />
        ) : state.status === "error" ? (
          <ErrorState
            error={state.error}
            fallback="Could not read your reservations from the contract."
            onRetry={state.reload}
            title="Could not read your reservations"
          />
        ) : (
          <>
            {state.data.unreadable > 0 ? (
              <p className="mb-5 rounded-2xl border border-amber-300/25 bg-amber-300/5 px-5 py-4 text-sm leading-6 text-amber-100">
                {state.data.unreadable} event record
                {state.data.unreadable === 1 ? "" : "s"} could not be read from
                contract storage. Readable reservations are still shown below.
              </p>
            ) : null}
            {state.data.items.length === 0 ? (
              <EmptyState
                action={
                  state.data.unreadable > 0 ? (
                    <Button onClick={state.reload} type="button" variant="outline">
                      Try again
                    </Button>
                  ) : (
                    <Button asChild variant="outline">
                      <Link href="/">Back to home</Link>
                    </Button>
                  )
                }
                title={
                  state.data.unreadable > 0
                    ? "Reservations temporarily unavailable"
                    : "Nothing reserved yet"
                }
              >
                {state.data.unreadable > 0
                  ? "No reservation records were readable in this attempt."
                  : "This wallet holds no ShowUp reservation on this contract."}
              </EmptyState>
            ) : (
          <Tabs className="gap-6" defaultValue="upcoming">
            <TabsList className="h-auto w-full flex-wrap gap-1 rounded-2xl bg-white/5 p-1.5 sm:w-fit">
              {BUCKETS.map((bucket) => {
                const count = state.data.items.filter(
                  ({ event, reservation }) =>
                    reservationBucket(
                      event,
                      reservation,
                      state.data.ledgerNow,
                    ) === bucket.key,
                ).length;

                return (
                  <TabsTrigger
                    className="min-h-11 rounded-xl px-4 font-semibold data-[state=active]:bg-slate-950 data-[state=active]:text-brand-soft data-[state=active]:ring-1 data-[state=active]:ring-inset data-[state=active]:ring-brand/25"
                    key={bucket.key}
                    value={bucket.key}
                  >
                    {bucket.title}
                    <span className="num ml-1.5 rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-slate-300">
                      {count}
                    </span>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {BUCKETS.map((bucket) => {
              const items = state.data.items.filter(
                ({ event, reservation }) =>
                  reservationBucket(
                    event,
                    reservation,
                    state.data.ledgerNow,
                  ) === bucket.key,
              );

              return (
                <TabsContent key={bucket.key} value={bucket.key}>
                  {items.length === 0 ? (
                    <EmptyState title={`Nothing in ${bucket.title.toLowerCase()}`}>
                      {bucket.empty}
                    </EmptyState>
                  ) : (
                    <ul className="space-y-3">
                      {items.map((item, index) => {
                        const status = statusCopy(item, bucket.key);

                        return (
                          <m.li
                            animate={{ opacity: 1, y: 0 }}
                            initial={
                              reduceMotion ? false : { opacity: 0, y: 14 }
                            }
                            key={item.event.id.toString()}
                            transition={{
                              delay: reduceMotion ? 0 : index * 0.05,
                              duration: 0.38,
                              ease: [0.22, 1, 0.36, 1],
                            }}
                          >
                            <Link
                              className="grid gap-4 rounded-3xl border border-white/10 bg-white/[0.02] px-5 py-5 transition-[border-color,background-color,transform,box-shadow] duration-(--duration-component) ease-(--ease-out-soft) hover:-translate-y-0.5 hover:border-brand/40 hover:bg-white/[0.05] hover:shadow-[0_24px_50px_-32px_rgba(77,230,198,0.5)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:hover:translate-y-0 sm:grid-cols-[1fr_auto] sm:items-center"
                              href={`/reservations/${item.event.id}`}
                            >
                              <div className="min-w-0">
                                <p className="text-lg font-bold tracking-tight">
                                  {item.event.title}
                                </p>
                                <p className="mt-1 text-sm text-slate-400">
                                  {item.event.venue} ·{" "}
                                  {formatMoment(item.event.startTime)}
                                </p>
                                <div className="mt-3">
                                  <StatusBadge
                                    pulse={status.tone === "accent"}
                                    tone={status.tone}
                                  >
                                    {status.label}
                                  </StatusBadge>
                                </div>
                              </div>
                              <div className="sm:text-right">
                                <p className="text-lg font-bold text-white">
                                  <Money stroops={item.reservation.amount} />
                                </p>
                                <p className="num mt-1 text-xs text-slate-500">
                                  Event #{item.event.id.toString()}
                                </p>
                              </div>
                            </Link>
                          </m.li>
                        );
                      })}
                    </ul>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
            )}
          </>
        )}
      </div>
    </main>
  );
}

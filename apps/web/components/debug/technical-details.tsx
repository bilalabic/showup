"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  TECHNICAL_EVIDENCE_EVENT,
  type TechnicalEvidence,
} from "@/components/debug/evidence-events";
import { Button } from "@/components/ui/button";
import {
  CONTRACT_ID,
  NETWORK_PASSPHRASE,
  getConfig,
  getEvent,
  getReservation,
} from "@/lib/contract";
import type { EventStatus, ReservationStatus } from "@/lib/domain";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { getLedgerSnapshot, type LedgerSnapshot } from "@/lib/stellar";
import { useWallet } from "@/lib/wallet/provider";

type TechnicalSnapshot = {
  ledger: LedgerSnapshot | null;
  token: string | null;
  eventStatus: EventStatus | null;
  reservationStatus: ReservationStatus | null;
};

const EVENT_PATH = /^\/(?:events|reservations|organizer\/events)\/(\d+)(?:\/|$)/;

export function eventIdFromPath(pathname: string): bigint | null {
  const matched = EVENT_PATH.exec(pathname)?.[1];
  if (!matched) return null;
  try {
    const id = BigInt(matched);
    return id > 0n ? id : null;
  } catch {
    return null;
  }
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[11rem_1fr] sm:gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="min-w-0 break-all text-slate-300">{value}</dd>
    </div>
  );
}

export function TechnicalDetails() {
  const pathname = usePathname();
  const { address } = useWallet();
  const evidenceScope = `${pathname}|${address ?? ""}`;
  const [scopedEvidence, setScopedEvidence] = useState<{
    scope: string;
    value: TechnicalEvidence;
  }>({ scope: evidenceScope, value: {} });
  const eventId = useMemo(() => eventIdFromPath(pathname), [pathname]);

  useEffect(() => {
    function onEvidence(event: Event) {
      const update = (event as CustomEvent<TechnicalEvidence>).detail;
      setScopedEvidence((current) => ({
        scope: evidenceScope,
        value:
          current.scope === evidenceScope
            ? { ...current.value, ...update }
            : update,
      }));
    }

    window.addEventListener(TECHNICAL_EVIDENCE_EVENT, onEvidence);
    return () =>
      window.removeEventListener(TECHNICAL_EVIDENCE_EVENT, onEvidence);
  }, [evidenceScope]);

  const state = useAsyncData<TechnicalSnapshot>(
    async () => {
      const [ledgerResult, configResult, eventResult] = await Promise.allSettled([
        getLedgerSnapshot(),
        getConfig(),
        eventId ? getEvent(eventId) : Promise.resolve(null),
      ]);
      const event = eventResult.status === "fulfilled" ? eventResult.value : null;
      const reservation =
        eventId && address
          ? await getReservation(eventId, address).catch(() => null)
          : null;

      return {
        ledger: ledgerResult.status === "fulfilled" ? ledgerResult.value : null,
        token:
          configResult.status === "fulfilled" ? configResult.value.token : null,
        eventStatus: event?.status ?? null,
        reservationStatus: reservation?.status ?? null,
      };
    },
    [eventId?.toString(), address],
  );

  const snapshot = state.status === "ready" ? state.data : null;
  const evidence =
    scopedEvidence.scope === evidenceScope ? scopedEvidence.value : {};

  return (
    <aside className="mx-auto w-full max-w-6xl px-5 pb-10 pt-4 sm:px-8">
      <details className="rounded-2xl border border-white/10 bg-slate-950/60 px-5 py-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-300 marker:text-brand">
          Technical details
        </summary>
        <p className="mt-3 text-xs leading-5 text-slate-500">
          Public Testnet diagnostics only. Wallet secrets and Anchor tokens are
          never collected or rendered.
        </p>
        <dl className="mt-4 space-y-3 font-mono text-xs">
          <Field label="Network" value="Stellar Testnet" />
          <Field label="Network passphrase" value={NETWORK_PASSPHRASE} />
          <Field label="Connected address" value={address ?? "Not connected"} />
          <Field
            label="Contract"
            value={
              <a
                className="text-brand underline underline-offset-4"
                href={`https://stellar.expert/explorer/testnet/contract/${CONTRACT_ID}`}
                rel="noreferrer noopener"
                target="_blank"
              >
                {CONTRACT_ID}
              </a>
            }
          />
          <Field label="Settlement asset SAC" value={snapshot?.token ?? "Unavailable"} />
          <Field label="Latest ledger" value={snapshot?.ledger?.sequence ?? "Unavailable"} />
          <Field
            label="Ledger close time"
            value={
              snapshot?.ledger
                ? new Date(snapshot.ledger.closeTime * 1000).toISOString()
                : "Unavailable"
            }
          />
          {eventId ? <Field label="Event" value={`#${eventId.toString()}`} /> : null}
          {snapshot?.eventStatus ? (
            <Field label="Event status" value={snapshot.eventStatus} />
          ) : null}
          {snapshot?.reservationStatus ? (
            <Field label="Your reservation" value={snapshot.reservationStatus} />
          ) : null}
          {evidence.transactionHash ? (
            <Field
              label="Last transaction"
              value={
                <a
                  className="text-brand underline underline-offset-4"
                  href={`https://stellar.expert/explorer/testnet/tx/${evidence.transactionHash}`}
                  rel="noreferrer noopener"
                  target="_blank"
                >
                  {evidence.transactionHash}
                </a>
              }
            />
          ) : null}
          {evidence.quoteId ? <Field label="Anchor quote" value={evidence.quoteId} /> : null}
          {evidence.anchorTransactionId ? (
            <Field label="Anchor transaction" value={evidence.anchorTransactionId} />
          ) : null}
        </dl>
        {state.status === "error" ? (
          <p className="mt-4 text-xs text-amber-200">
            Some live diagnostics are unavailable. Product actions remain independent.
          </p>
        ) : null}
        <Button className="mt-4" onClick={state.reload} size="sm" type="button" variant="ghost">
          Refresh diagnostics
        </Button>
      </details>
    </aside>
  );
}

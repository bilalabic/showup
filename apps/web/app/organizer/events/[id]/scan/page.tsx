"use client";

import Link from "next/link";
import { use, useCallback, useMemo, useRef, useState } from "react";

import {
  TxStatus,
  txFailureState,
  type TxState,
} from "@/components/tx/tx-status";
import { ErrorState } from "@/components/ui/states";
import {
  checkIn,
  getEvent,
  getReservation,
  type TxPhase,
} from "@/lib/contract";
import {
  canCheckIn,
  fromStroops,
  type EventView,
  type ReservationView,
} from "@/lib/domain";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import {
  decodePass,
  encodePass,
  isPassStale,
  type ReservationPass,
  useScanner,
} from "@/lib/qr";
import {
  getAccountAssets,
  getLedgerNow,
  type AccountAssets,
} from "@/lib/stellar";
import { useWallet } from "@/lib/wallet/provider";

type EventSnapshot = { event: EventView; ledgerNow: number };
type Candidate = {
  pass: ReservationPass;
  reservation: ReservationView;
  ledgerNow: number;
  assets: AccountAssets | null;
};

const MAX_U64 = (1n << 64n) - 1n;

function formatMoment(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function ScanPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ participant?: string | string[] }>;
}) {
  const { id } = use(params);
  const query = use(searchParams);
  const eventId = useMemo(() => {
    try {
      const parsed = BigInt(id);
      return parsed > 0n && parsed <= MAX_U64 ? parsed : null;
    } catch {
      return null;
    }
  }, [id]);
  const { address, canTransact, connect, signTransaction, status } = useWallet();
  const videoRef = useRef<HTMLVideoElement>(null);
  const txBusyRef = useRef(false);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [candidateError, setCandidateError] = useState<string | null>(null);
  const [manualParticipant, setManualParticipant] = useState(
    typeof query.participant === "string" ? query.participant : "",
  );
  const [reading, setReading] = useState(false);
  const [tx, setTx] = useState<TxState>({ kind: "idle" });

  const state = useAsyncData<EventSnapshot>(
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

  const inspectPayload = useCallback(
    async (raw: string) => {
      if (eventId === null) return;
      setReading(true);
      setCandidate(null);
      setCandidateError(null);
      setTx({ kind: "idle" });
      let pass: ReservationPass;
      try {
        pass = decodePass(raw);
      } catch {
        setCandidateError("The pass could not be read. Ask the participant to refresh it and try again.");
        setReading(false);
        return;
      }
      if (pass.eventId !== eventId) {
        setCandidateError(
          `This pass is for event #${pass.eventId.toString()}, not event #${eventId.toString()}.`,
        );
        setReading(false);
        return;
      }
      try {
        const [reservation, ledgerNow, assets] = await Promise.all([
          getReservation(eventId, pass.participant),
          getLedgerNow(),
          getAccountAssets(pass.participant),
        ]);
        if (!reservation) {
          setCandidateError("No reservation exists for this pass on the contract.");
          return;
        }
        setCandidate({ assets, pass, reservation, ledgerNow });
      } catch {
        setCandidateError("The reservation could not be verified on-chain. Refresh and try again.");
      } finally {
        setReading(false);
      }
    },
    [eventId],
  );

  const scanner = useScanner((raw) => {
    void inspectPayload(raw);
  });

  async function inspectParticipant() {
    if (eventId === null || state.status !== "ready") return;
    try {
      const raw = encodePass({
        eventId,
        participant: manualParticipant.trim(),
        issuedAt: state.data.ledgerNow,
      });
      await inspectPayload(raw);
    } catch {
      setCandidate(null);
      setCandidateError("Enter a valid Stellar participant address.");
    }
  }

  async function confirmCheckIn() {
    if (
      !candidate ||
      !address ||
      !canTransact ||
      state.status !== "ready" ||
      candidate.pass.eventId !== state.data.event.id ||
      !candidate.assets?.exists ||
      !candidate.assets.hasUsdcTrustline ||
      txBusyRef.current
    ) {
      return;
    }

    txBusyRef.current = true;
    setTx({ kind: "running", phase: "simulating" });
    try {
      const { hash } = await checkIn(
        state.data.event.id,
        candidate.pass.participant,
        { address, signTransaction },
        (phase: TxPhase) => setTx({ kind: "running", phase }),
      );
      const [reservation, ledgerNow] = await Promise.all([
        getReservation(state.data.event.id, candidate.pass.participant),
        getLedgerNow(),
      ]);
      if (reservation) {
        setCandidate((current) =>
          current ? { ...current, reservation, ledgerNow } : current,
        );
      }
      setTx({
        kind: "success",
        hash,
        message: "Attendance confirmed. The contract refunded the participant's bond.",
      });
    } catch (error) {
      const reservation = await getReservation(
        state.data.event.id,
        candidate.pass.participant,
      ).catch(() => null);
      if (reservation) {
        setCandidate((current) =>
          current ? { ...current, reservation } : current,
        );
      }
      setTx(
        txFailureState(
          error,
          "Check-in could not be completed. Refresh and try again.",
        ),
      );
    } finally {
      txBusyRef.current = false;
    }
  }

  if (eventId === null) {
    return (
      <main className="mx-auto w-full max-w-4xl px-5 py-20 sm:px-8">
        <h1 className="text-3xl font-bold">Invalid event</h1>
        <Link className="mt-6 inline-block text-brand underline" href="/organizer">
          Back to organizer events
        </Link>
      </main>
    );
  }

  if (state.status === "loading") {
    return (
      <main className="mx-auto w-full max-w-4xl px-5 py-14 sm:px-8">
        <div className="h-10 w-full max-w-72 animate-pulse rounded-xl bg-white/10" />
        <div className="mt-8 h-96 animate-pulse rounded-3xl bg-white/5" />
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className="mx-auto w-full max-w-4xl px-5 py-20 sm:px-8">
        <ErrorState
          error={state.error}
          fallback="Could not read this event from the contract."
          onRetry={state.reload}
          title="Could not load the event"
        />
      </main>
    );
  }

  const { event } = state.data;
  const authorized = address === event.verifier;
  const checkInOpen = candidate
    ? candidate.pass.eventId === event.id &&
      canCheckIn(event, candidate.reservation, candidate.ledgerNow)
    : false;
  const passStale = candidate
    ? isPassStale(candidate.pass, candidate.ledgerNow)
    : false;
  const canReceiveRefund = candidate
    ? Boolean(candidate.assets?.exists && candidate.assets.hasUsdcTrustline)
    : false;

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-12 sm:px-8">
      <Link
        className="block text-sm font-semibold text-slate-400 transition [overflow-wrap:anywhere] hover:text-brand"
        href={`/organizer/events/${event.id.toString()}`}
      >
        ← {event.title}
      </Link>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs text-brand">EVENT #{event.id.toString()}</p>
          <h1 className="mt-2 text-4xl font-bold tracking-[-0.04em]">Check in a guest</h1>
          <p className="mt-2 text-slate-400">
            Scan a ShowUp pass, verify the on-chain reservation, then sign once.
          </p>
        </div>
      </div>

      {!address ? (
        <section className="mt-8 rounded-3xl border border-dashed border-white/15 px-6 py-8 text-center">
          <p className="text-sm text-slate-300">
            Connect the event verifier wallet before using the camera.
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
          <h2 className="font-bold text-rose-100">Wrong verifier wallet</h2>
          <p className="mt-2 break-all text-sm leading-6 text-slate-300">
            This event requires {event.verifier}. The connected account cannot scan or sign check-ins.
          </p>
        </section>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-3xl border border-white/10 bg-slate-900/60 p-5">
            <div className="overflow-hidden rounded-2xl bg-black">
              <video
                aria-label="Camera preview for QR scanning"
                autoPlay
                className="aspect-square w-full object-cover"
                muted
                playsInline
                ref={videoRef}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              {scanner.state.status === "scanning" ||
              scanner.state.status === "requesting" ? (
                <button
                  className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold"
                  onClick={scanner.stop}
                  type="button"
                >
                  {scanner.state.status === "requesting" ? "Cancel request" : "Stop camera"}
                </button>
              ) : (
                <button
                  className="rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-primary-foreground"
                  onClick={() => {
                    if (videoRef.current) void scanner.start(videoRef.current);
                  }}
                  type="button"
                >
                  Start camera
                </button>
              )}
              {scanner.state.status === "scanning" ? (
                <span className="self-center text-sm text-brand-soft">Looking for a QR code…</span>
              ) : null}
            </div>
            {scanner.state.status === "error" ? (
              <p className="mt-3 text-sm text-rose-200" role="alert">
                {scanner.state.message}
              </p>
            ) : null}

            <div className="mt-6 border-t border-white/10 pt-5">
              <p className="text-sm font-semibold">Manual fallback</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                If the camera is unavailable, paste a participant address from the event reservation list. The same contract checks apply.
              </p>
              <div className="mt-3 flex gap-2">
                <input
                  aria-label="Participant Stellar address"
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 font-mono text-xs outline-none focus:border-brand/60"
                  onChange={(event) => setManualParticipant(event.target.value)}
                  placeholder="G…"
                  value={manualParticipant}
                />
                <button
                  className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold disabled:opacity-50"
                  disabled={reading || manualParticipant.trim().length === 0}
                  onClick={() => void inspectParticipant()}
                  type="button"
                >
                  Look up
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-slate-900/60 p-6">
            <h2 className="text-xl font-bold">Contract verification</h2>
            {reading ? (
              <p className="mt-6 text-sm text-slate-300">Reading the reservation from Testnet…</p>
            ) : candidateError ? (
              <p className="mt-6 rounded-2xl border border-rose-400/25 bg-rose-400/5 px-4 py-3 text-sm text-rose-100" role="alert">
                {candidateError}
              </p>
            ) : candidate ? (
              <div className="mt-5 space-y-4">
                <dl className="space-y-3 text-sm">
                  <div>
                    <dt className="text-slate-400">Participant</dt>
                    <dd className="mt-1 break-all font-mono text-xs">{candidate.reservation.participant}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-400">Bond</dt>
                    <dd className="font-mono font-bold">{fromStroops(candidate.reservation.amount)} USDC</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-400">On-chain status</dt>
                    <dd className="font-semibold capitalize">{candidate.reservation.status.replaceAll("_", " ")}</dd>
                  </div>
                </dl>
                {passStale ? (
                  <p className="rounded-2xl border border-amber-300/25 bg-amber-300/5 px-4 py-3 text-sm leading-5 text-amber-100">
                    This pass was generated more than five minutes ago or has a future timestamp. That is only a freshness warning; the contract state above remains authoritative.
                  </p>
                ) : null}
                {candidate.reservation.status === "attended" ? (
                  <p className="rounded-2xl border border-emerald-300/25 bg-emerald-300/5 px-4 py-3 text-sm text-emerald-100">
                    Already checked in. No additional signature is needed.
                  </p>
                ) : !canReceiveRefund ? (
                  <p className="rounded-2xl border border-amber-300/25 bg-amber-300/5 px-4 py-3 text-sm leading-5 text-amber-100">
                    This participant cannot currently receive the USDC refund. They must re-enable the USDC trustline, then present the pass or be looked up again. No check-in transaction has been started.
                  </p>
                ) : !checkInOpen &&
                  candidate.ledgerNow < state.data.event.checkinStart ? (
                  <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-slate-300">
                    Check-in has not opened yet. It opens at{" "}
                    {formatMoment(state.data.event.checkinStart)}.
                  </p>
                ) : !checkInOpen &&
                  candidate.ledgerNow > state.data.event.checkinDeadline ? (
                  <p className="rounded-2xl border border-amber-300/25 bg-amber-300/5 px-4 py-3 text-sm leading-6 text-amber-100">
                    Check-in closed at{" "}
                    {formatMoment(state.data.event.checkinDeadline)}. The bond can
                    now only follow the contract&apos;s no-show settlement path.
                  </p>
                ) : !checkInOpen ? (
                  <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                    This reservation is not eligible for check-in in its current
                    on-chain state.
                  </p>
                ) : (
                  <button
                    className="w-full rounded-full bg-brand px-5 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
                    disabled={tx.kind === "running"}
                    onClick={() => void confirmCheckIn()}
                    type="button"
                  >
                    {tx.kind === "running" ? "Confirming…" : "Confirm attendance and refund bond"}
                  </button>
                )}
                <TxStatus state={tx} />
              </div>
            ) : (
              <p className="mt-6 text-sm leading-6 text-slate-400">
                No pass selected. Scanning never submits a transaction automatically.
              </p>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

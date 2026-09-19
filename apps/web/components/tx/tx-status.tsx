"use client";

import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { useEffect } from "react";

import { celebrate } from "@/components/tx/celebrate";
import { NumberTicker } from "@/components/ui/magic/number-ticker";
import { cn } from "@/components/ui/utils";
import type { TxPhase } from "@/lib/contract";
import { fromStroops } from "@/lib/domain";

export type TxState =
  | { kind: "idle" }
  | { kind: "running"; phase: TxPhase }
  | {
      kind: "success";
      hash: string;
      message: string;
      /**
       * Optional money moment. Integer stroops only — formatted at render by
       * `lib/domain/amounts`, exactly like every other amount in the product.
       */
      amountStroops?: bigint;
      amountCaption?: string;
    }
  | { kind: "failed"; message: string };

// Signing is not success and submitting is not success. Each phase says only
// what has actually happened, so the UI never claims a bond is locked before a
// ledger has confirmed it.
const PHASE_COPY: Record<TxPhase, string> = {
  simulating: "Checking the request against the contract…",
  awaiting_signature: "Waiting for you to approve in Freighter…",
  submitting: "Sending to Stellar Testnet…",
  confirming: "Waiting for ledger confirmation…",
};

/**
 * The line under each phase exists to keep the animation honest. A progress
 * rail that sweeps forward is persuasive, and it would be very easy for a user
 * to read "signed" as "done". These captions say, at every step, what has *not*
 * happened yet.
 */
const PHASE_CAVEAT: Record<TxPhase, string> = {
  simulating: "Nothing has been signed and nothing has been spent.",
  awaiting_signature: "A signature authorises the call. It does not move money.",
  submitting: "Submitted is not the same as confirmed.",
  confirming: "The result is final only once it lands in a ledger.",
};

const PHASE_ORDER: readonly TxPhase[] = [
  "simulating",
  "awaiting_signature",
  "submitting",
  "confirming",
];

const STEP_LABEL: Record<TxPhase, string> = {
  simulating: "Simulate",
  awaiting_signature: "Approve",
  submitting: "Submit",
  confirming: "Confirm",
};

export function explorerTxUrl(hash: string): string {
  return `https://stellar.expert/explorer/testnet/tx/${hash}`;
}

const SPRING = { type: "spring", stiffness: 210, damping: 28, mass: 0.7 } as const;

function CheckMark() {
  return (
    <svg
      aria-hidden="true"
      className="size-3"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="3.2"
      viewBox="0 0 24 24"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function PhaseRail({ phase }: { phase: TxPhase }) {
  const reduceMotion = useReducedMotion();
  const activeIndex = PHASE_ORDER.indexOf(phase);
  const progress =
    PHASE_ORDER.length > 1 ? activeIndex / (PHASE_ORDER.length - 1) : 0;

  return (
    <div className="relative">
      {/* The rail sits behind the dots and is inset by half a dot on each side
          so the fill starts and ends at dot centres. */}
      <div className="absolute inset-x-[1.125rem] top-[0.5625rem] h-0.5 rounded-full bg-white/10">
        <m.div
          animate={{ scaleX: progress }}
          className="h-full w-full origin-left rounded-full bg-gradient-to-r from-cyan-400 to-cyan-200"
          initial={reduceMotion ? false : { scaleX: 0 }}
          transition={reduceMotion ? { duration: 0 } : SPRING}
        />
      </div>

      <ol className="relative grid grid-cols-4 gap-2">
        {PHASE_ORDER.map((step, index) => {
          const done = index < activeIndex;
          const active = index === activeIndex;

          return (
            <li className="flex flex-col items-center gap-2" key={step}>
              <m.span
                animate={{ scale: active && !reduceMotion ? 1.12 : 1 }}
                className={cn(
                  "relative grid size-[1.125rem] place-items-center rounded-full border transition-colors duration-(--duration-component)",
                  done && "border-cyan-300 bg-cyan-300 text-slate-950",
                  active && "border-cyan-300 bg-slate-950 text-cyan-200",
                  !done && !active && "border-white/15 bg-slate-950",
                )}
                transition={reduceMotion ? { duration: 0 } : SPRING}
              >
                {done ? (
                  <CheckMark />
                ) : active ? (
                  <>
                    <span className="size-1.5 rounded-full bg-cyan-300" />
                    {reduceMotion ? null : (
                      <span className="absolute size-[1.125rem] animate-ping rounded-full bg-cyan-300/25" />
                    )}
                  </>
                ) : (
                  <span className="size-1.5 rounded-full bg-white/20" />
                )}
              </m.span>
              <span
                className={cn(
                  "text-center text-[10px] font-bold uppercase tracking-[0.12em] transition-colors duration-(--duration-component)",
                  done && "text-cyan-200/70",
                  active && "text-cyan-200",
                  !done && !active && "text-slate-500",
                )}
              >
                {STEP_LABEL[step]}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function SuccessPanel({
  amountCaption,
  amountStroops,
  hash,
  message,
}: {
  amountCaption?: string;
  amountStroops?: bigint;
  hash: string;
  message: string;
}) {
  // The burst is tied to the hash: it fires once, for one confirmed ledger
  // result, and never replays on an unrelated re-render.
  useEffect(() => {
    void celebrate();
  }, [hash]);

  return (
    <div
      className="overflow-hidden rounded-3xl border border-emerald-300/25 bg-emerald-300/[0.07] px-5 py-5"
      role="status"
    >
      <div className="flex items-center gap-2 text-emerald-200">
        <span className="grid size-5 place-items-center rounded-full bg-emerald-300 text-slate-950">
          <CheckMark />
        </span>
        <span className="text-xs font-bold uppercase tracking-[0.18em]">
          Confirmed on ledger
        </span>
      </div>

      {amountStroops === undefined ? null : (
        <p className="mt-4 text-4xl font-black tracking-[-0.04em] text-white sm:text-5xl">
          <NumberTicker format={fromStroops} suffix="USDC" value={amountStroops} />
          <span className="ml-2 text-xl font-bold text-emerald-300">USDC</span>
        </p>
      )}

      {amountCaption ? (
        <p className="mt-1 text-sm font-semibold text-emerald-200/80">
          {amountCaption}
        </p>
      ) : null}

      <p className="mt-3 text-sm leading-6 text-emerald-50">{message}</p>

      <a
        className="mt-3 inline-block break-all font-mono text-xs text-emerald-300 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
        href={explorerTxUrl(hash)}
        rel="noreferrer noopener"
        target="_blank"
      >
        {hash}
      </a>
    </div>
  );
}

export function TxStatus({ state }: { state: TxState }) {
  const reduceMotion = useReducedMotion();

  const entrance = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -6 },
        transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const },
      };

  return (
    <AnimatePresence initial={false} mode="wait">
      {state.kind === "idle" ? null : state.kind === "running" ? (
        <m.div key="running" {...entrance}>
          <div
            aria-live="polite"
            className="rounded-3xl border border-cyan-300/20 bg-cyan-300/[0.05] px-5 py-5"
            role="status"
          >
            <PhaseRail phase={state.phase} />
            <div className="mt-5 grid">
              <AnimatePresence initial={false} mode="popLayout">
                <m.div
                  animate={{ opacity: 1, y: 0 }}
                  className="col-start-1 row-start-1"
                  exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  key={state.phase}
                  transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                >
                  <p className="text-sm font-semibold text-cyan-100">
                    {PHASE_COPY[state.phase]}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-cyan-100/60">
                    {PHASE_CAVEAT[state.phase]}
                  </p>
                </m.div>
              </AnimatePresence>
            </div>
          </div>
        </m.div>
      ) : state.kind === "success" ? (
        <m.div key={`success-${state.hash}`} {...entrance}>
          <SuccessPanel
            amountCaption={state.amountCaption}
            amountStroops={state.amountStroops}
            hash={state.hash}
            message={state.message}
          />
        </m.div>
      ) : (
        <m.div key="failed" {...entrance}>
          <div
            className="rounded-3xl border border-rose-400/25 bg-rose-400/[0.06] px-5 py-5"
            role="alert"
          >
            <div className="flex items-center gap-2 text-rose-200">
              <span className="grid size-5 place-items-center rounded-full bg-rose-400 text-slate-950">
                <svg
                  aria-hidden="true"
                  className="size-3"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="3.2"
                  viewBox="0 0 24 24"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </span>
              <span className="text-xs font-bold uppercase tracking-[0.18em]">
                Not completed
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-rose-50">{state.message}</p>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
}

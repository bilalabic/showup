"use client";

import { m, useReducedMotion } from "motion/react";

import { Money } from "@/components/ui/money";
import { splitByBps } from "@/lib/domain";

/**
 * What the participant will see, shown to the organizer while they type.
 *
 * The split is computed with `splitByBps` — the same truncating integer
 * arithmetic the contract runs, with the second leg derived by subtraction —
 * so the preview cannot promise a division the contract will not perform.
 * When the form does not yet describe a valid policy the card says so rather
 * than inventing a number.
 */
export function PolicyPreview({
  bondStroops,
  capacity,
  organizerShare,
}: {
  bondStroops: bigint | null;
  capacity: number | null;
  organizerShare: number | null;
}) {
  const reduceMotion = useReducedMotion();

  const shareValid =
    organizerShare !== null &&
    Number.isInteger(organizerShare) &&
    organizerShare >= 0 &&
    organizerShare <= 100;
  const share = shareValid ? organizerShare : 0;
  const communityShare = 100 - share;

  const split =
    bondStroops !== null && bondStroops > 0n && shareValid
      ? splitByBps(bondStroops, share * 100)
      : null;

  return (
    <aside className="glass sticky top-28 rounded-3xl p-6">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">
        Published policy
      </p>
      <h2 className="mt-3 text-lg font-bold tracking-tight">
        What a participant agrees to
      </h2>

      <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/50 px-5 py-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
          Refundable bond
        </p>
        <p className="mt-1 text-3xl font-bold tracking-[-0.03em] text-white">
          {bondStroops !== null && bondStroops > 0n ? (
            <Money stroops={bondStroops} />
          ) : (
            <span className="num text-slate-600">—</span>
          )}
        </p>
        <p className="mt-2 text-xs text-slate-500">
          {capacity !== null && capacity > 0
            ? `Up to ${capacity} participants can lock this.`
            : "Set a capacity to cap reservations on chain."}
        </p>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/50 px-5 py-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
          No-show settlement
        </p>

        <div
          aria-hidden="true"
          className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-status-community/75"
        >
          {/* `scaleX` rather than `width`: the organizer drags this value
              while typing, and animating a layout property would reflow the
              card on every keystroke. */}
          <m.span
            animate={{ scaleX: share / 100 }}
            className="block h-full w-full origin-left bg-brand/80"
            initial={false}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { type: "spring", stiffness: 160, damping: 24 }
            }
          />
        </div>

        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="flex items-center gap-2 text-slate-400">
              <span className="size-2 rounded-full bg-brand/80" />
              You ({share}%)
            </dt>
            <dd className="font-semibold text-white">
              {split ? (
                <Money stroops={split.organizer} />
              ) : (
                <span className="num text-slate-600">—</span>
              )}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="flex items-center gap-2 text-slate-400">
              <span className="size-2 rounded-full bg-status-community/80" />
              Community pool ({communityShare}%)
            </dt>
            <dd className="font-semibold text-white">
              {split ? (
                <Money stroops={split.community} />
              ) : (
                <span className="num text-slate-600">—</span>
              )}
            </dd>
          </div>
        </dl>
      </div>

      <p className="mt-4 text-xs leading-5 text-slate-500">
        The contract holds every bond in its own custody and enforces these
        numbers. Once the first bond is locked the policy cannot be edited.
      </p>
    </aside>
  );
}

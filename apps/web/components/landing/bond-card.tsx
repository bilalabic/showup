"use client";

import { m, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import type { PointerEvent as ReactPointerEvent } from "react";

import { BorderBeam } from "@/components/ui/magic/border-beam";
import { NumberTicker } from "@/components/ui/magic/number-ticker";
import { StatusBadge } from "@/components/ui/status-badge";
import { fromStroops, toStroops } from "@/lib/domain";

/**
 * An illustrative bond card — not a real event, and labelled as such.
 *
 * The amount is still carried as integer stroops and formatted through
 * `lib/domain/amounts`, because a sample that formats money differently from
 * the rest of the product is a sample that will eventually be copied.
 */
const SAMPLE_BOND = toStroops("5.00");

const TILT_DEGREES = 7;

export function BondCard() {
  const reduceMotion = useReducedMotion();

  const pointerX = useMotionValue(0.5);
  const pointerY = useMotionValue(0.5);

  const springConfig = { stiffness: 180, damping: 20, mass: 0.6 };
  const rotateX = useSpring(
    useTransform(pointerY, [0, 1], [TILT_DEGREES, -TILT_DEGREES]),
    springConfig,
  );
  const rotateY = useSpring(
    useTransform(pointerX, [0, 1], [-TILT_DEGREES, TILT_DEGREES]),
    springConfig,
  );

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (reduceMotion) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    pointerX.set((event.clientX - bounds.left) / bounds.width);
    pointerY.set((event.clientY - bounds.top) / bounds.height);
  }

  function onPointerLeave() {
    pointerX.set(0.5);
    pointerY.set(0.5);
  }

  return (
    <div
      className="relative [perspective:1400px]"
      onPointerLeave={onPointerLeave}
      onPointerMove={onPointerMove}
    >
      <div
        aria-hidden="true"
        className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-brand/10 blur-2xl"
      />

      <m.div
        className="glass relative rounded-[2rem] p-6 sm:p-8"
        style={
          reduceMotion
            ? undefined
            : { rotateX, rotateY, transformStyle: "preserve-3d" }
        }
      >
        <BorderBeam />

        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">
              Commitment bond
            </p>
            <h2 className="mt-3 text-2xl font-bold">Design Meetup Istanbul</h2>
            <p className="mt-1 text-xs text-slate-500">
              Illustration — not a live event
            </p>
          </div>
          <StatusBadge tone="positive">Open</StatusBadge>
        </div>

        <div className="mt-7 rounded-2xl border border-white/10 bg-slate-950/50 px-5 py-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
            Refundable bond
          </p>
          <p className="mt-2 text-4xl font-bold tracking-[-0.04em] text-white">
            <NumberTicker
              format={fromStroops}
              suffix="USDC"
              value={SAMPLE_BOND}
            />
            <span className="ml-2 text-lg font-bold text-brand">USDC</span>
          </p>
        </div>

        <dl className="mt-4 divide-y divide-white/10 rounded-2xl border border-white/10 bg-slate-950/50 px-5">
          <div className="flex items-center justify-between gap-6 py-4">
            <dt className="text-sm text-slate-400">Network</dt>
            <dd className="text-sm font-bold text-brand">Testnet</dd>
          </div>
          <div className="flex items-center justify-between gap-6 py-4">
            <dt className="text-sm text-slate-400">Custody</dt>
            <dd className="text-sm font-bold">Contract, not organizer</dd>
          </div>
          <div className="flex items-center justify-between gap-6 py-4">
            <dt className="text-sm text-slate-400">Settlement</dt>
            <dd className="text-sm font-bold">On-chain</dd>
          </div>
        </dl>

        <p className="mt-5 rounded-2xl border border-dashed border-white/15 px-5 py-4 text-sm leading-6 text-slate-400">
          Connect Freighter above to establish a Testnet session. No wallet
          connection is requested automatically.
        </p>
      </m.div>
    </div>
  );
}

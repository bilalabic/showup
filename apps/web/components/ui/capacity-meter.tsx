"use client";

import { m, useReducedMotion } from "motion/react";

import { cn } from "@/components/ui/utils";

/**
 * How full an event is.
 *
 * The bar fills with `scaleX` from a left origin rather than by animating
 * `width`, so the browser never re-lays out the row while it moves. The track
 * is always full width, which also means the component reserves its own space
 * before the animation runs.
 */
export function CapacityMeter({
  capacity,
  className,
  reserved,
}: {
  capacity: number;
  className?: string;
  reserved: number;
}) {
  const reduceMotion = useReducedMotion();
  const safeCapacity = capacity > 0 ? capacity : 1;
  const ratio = Math.min(1, Math.max(0, reserved / safeCapacity));
  const full = reserved >= capacity;
  const left = Math.max(0, capacity - reserved);

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
          Capacity
        </span>
        <span className="num text-sm font-bold text-white">
          {reserved}
          <span className="text-slate-500"> / {capacity}</span>
        </span>
      </div>
      <div
        aria-label={`${reserved} of ${capacity} seats reserved`}
        aria-valuemax={capacity}
        aria-valuemin={0}
        aria-valuenow={reserved}
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/8"
        role="progressbar"
      >
        <m.div
          animate={{ scaleX: ratio }}
          className={cn(
            "h-full w-full origin-left rounded-full",
            full
              ? "bg-status-community"
              : "bg-brand",
          )}
          initial={reduceMotion ? false : { scaleX: 0 }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 120, damping: 22, mass: 0.7 }
          }
        />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {full ? "Every seat is taken." : `${left} still open.`}
      </p>
    </div>
  );
}

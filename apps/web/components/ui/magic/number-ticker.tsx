"use client";

import { animate, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

import { cn } from "@/components/ui/utils";

type NumberTickerProps = {
  /** The financial value, in integer stroops. Never a `number`. */
  value: bigint;
  /** Formats stroops for display. Called on every frame with a `bigint`. */
  format: (value: bigint) => string;
  className?: string;
  align?: "left" | "right";
  durationMs?: number;
  suffix?: string;
};

/** Frames are interpolated at this resolution, in parts per unit. */
const PRECISION = 10_000n;

/**
 * Counts a stroop amount up to its final value.
 *
 * The financial value never passes through `Number`. What animates is a
 * dimensionless progress scalar; each frame multiplies the target `bigint` by
 * that progress in integer arithmetic and formats the result. So the last frame
 * is exactly the contract's number, not a float that rounds to it.
 *
 * The final text is also rendered — invisibly — underneath the animated span,
 * which both reserves the layout width so neighbours never shift and gives
 * assistive technology the settled value instead of a moving one.
 */
export function NumberTicker({
  align = "left",
  className,
  durationMs = 900,
  format,
  suffix,
  value,
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduceMotion = useReducedMotion();
  const finalText = format(value);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (reduceMotion) {
      node.textContent = finalText;
      return;
    }

    const controls = animate(0, 1, {
      duration: durationMs / 1000,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (progress) => {
        const scaled = BigInt(Math.round(progress * Number(PRECISION)));
        node.textContent = format((value * scaled) / PRECISION);
      },
      onComplete: () => {
        node.textContent = finalText;
      },
    });

    return () => controls.stop();
  }, [durationMs, finalText, format, reduceMotion, value]);

  return (
    <span className={cn("relative inline-block num", className)}>
      <span className="sr-only">
        {suffix ? `${finalText} ${suffix}` : finalText}
      </span>
      <span aria-hidden="true" className="invisible">
        {finalText}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-0",
          align === "right" ? "text-right" : "text-left",
        )}
        ref={ref}
      >
        {finalText}
      </span>
    </span>
  );
}

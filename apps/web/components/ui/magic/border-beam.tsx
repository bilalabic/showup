"use client";

import { useReducedMotion } from "motion/react";

import { cn } from "@/components/ui/utils";

/**
 * A light travelling around a card's border.
 *
 * It is a conic gradient rotated with a CSS `transform`, masked to the border
 * ring, so the only animated property is a rotation. The element is decorative
 * and disappears completely under `prefers-reduced-motion`.
 */
export function BorderBeam({
  className,
  durationSeconds = 9,
}: {
  className?: string;
  durationSeconds?: number;
}) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return null;

  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]",
        "[mask:linear-gradient(#000,#000)_content-box,linear-gradient(#000,#000)]",
        "[mask-composite:exclude] p-px",
        className,
      )}
    >
      <span
        className="absolute left-1/2 top-1/2 aspect-square w-[200%] -translate-x-1/2 -translate-y-1/2 animate-[beam-spin_var(--beam-duration)_linear_infinite] bg-[conic-gradient(from_0deg,transparent_0deg,transparent_300deg,rgba(77,230,198,0.9)_345deg,rgba(255,255,255,0.95)_360deg)]"
        style={
          { "--beam-duration": `${durationSeconds}s` } as React.CSSProperties
        }
      />
    </span>
  );
}

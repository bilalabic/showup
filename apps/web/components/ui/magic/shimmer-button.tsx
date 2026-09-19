"use client";

import { useReducedMotion } from "motion/react";
import type { ComponentProps } from "react";

import { cn } from "@/components/ui/utils";

/**
 * A primary call to action with a light sweep across its surface.
 *
 * The sweep is a `transform` on a masked pseudo-layer, so it never touches
 * layout, and it is dropped entirely when the user prefers reduced motion —
 * the button then renders as a plain, fully legible accent pill.
 */
export function ShimmerButton({
  children,
  className,
  ...props
}: ComponentProps<"span">) {
  const reduceMotion = useReducedMotion();

  return (
    <span
      className={cn(
        "relative inline-flex overflow-hidden rounded-full",
        className,
      )}
      {...props}
    >
      {children}
      {reduceMotion ? null : (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -translate-x-full animate-[shimmer_2.6s_ease-in-out_infinite] bg-[linear-gradient(110deg,transparent_25%,rgba(255,255,255,0.55)_50%,transparent_75%)]"
        />
      )}
    </span>
  );
}

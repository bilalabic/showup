"use client";

import { AnimatePresence, m, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

import { cn } from "@/components/ui/utils";

export type StatusTone =
  | "neutral"
  | "accent"
  | "positive"
  | "warning"
  | "critical";

const TONE: Record<StatusTone, string> = {
  neutral: "border-status-neutral/25 bg-status-neutral/10 text-slate-300",
  accent: "border-status-locked/25 bg-status-locked/10 text-brand-soft",
  positive: "border-status-success/25 bg-status-success/10 text-emerald-200",
  warning: "border-status-community/25 bg-status-community/10 text-amber-100",
  critical: "border-status-no-show/25 bg-status-no-show/10 text-rose-200",
};

const DOT: Record<StatusTone, string> = {
  neutral: "bg-status-neutral",
  accent: "bg-status-locked",
  positive: "bg-status-success",
  warning: "bg-status-community",
  critical: "bg-status-no-show",
};

/**
 * A status pill that animates when the underlying on-chain state changes.
 *
 * The transition is keyed on the label, so a reservation moving from "Bond
 * locked" to "Attended" visibly swaps rather than silently re-rendering — the
 * change of financial state is the thing worth noticing. Only opacity and a
 * small transform animate; the pill's box never resizes mid-flight because the
 * outgoing and incoming labels share a grid cell.
 */
export function StatusBadge({
  children,
  className,
  pulse = false,
  tone = "neutral",
}: {
  children: ReactNode;
  className?: string;
  /** Use only for a genuinely in-progress state, never for a settled one. */
  pulse?: boolean;
  tone?: StatusTone;
}) {
  const reduceMotion = useReducedMotion();
  const label = typeof children === "string" ? children : "badge";

  return (
    <span
      className={cn(
        "inline-grid shrink-0 grid-cols-[auto_1fr] items-center gap-2 rounded-full border px-3 py-1.5",
        "text-xs font-bold tracking-tight",
        "transition-colors duration-(--duration-component) ease-(--ease-out-soft)",
        TONE[tone],
        className,
      )}
    >
      <span className="relative grid size-1.5 place-items-center">
        <span className={cn("size-1.5 rounded-full", DOT[tone])} />
        {pulse && !reduceMotion ? (
          <span
            className={cn(
              "absolute size-1.5 animate-ping rounded-full opacity-75",
              DOT[tone],
            )}
          />
        ) : null}
      </span>
      <span className="grid">
        <AnimatePresence initial={false} mode="popLayout">
          <m.span
            animate={{ opacity: 1, y: 0 }}
            className="col-start-1 row-start-1"
            exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            key={label}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            {children}
          </m.span>
        </AnimatePresence>
      </span>
    </span>
  );
}

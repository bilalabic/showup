"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/components/ui/utils";

function format(remainingSeconds: number): string {
  if (remainingSeconds <= 0) return "now";

  const days = Math.floor(remainingSeconds / 86_400);
  const hours = Math.floor((remainingSeconds % 86_400) / 3_600);
  const minutes = Math.floor((remainingSeconds % 3_600) / 60);
  const seconds = Math.floor(remainingSeconds % 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

/**
 * A cosmetic countdown to a ledger deadline.
 *
 * The starting point is the **ledger** timestamp that the page already fetched,
 * never `Date.now()`; the browser clock is used only to tick the display
 * forward between refreshes, which is the one job the architecture assigns it.
 * Nothing on the page is enabled or disabled by what this component shows —
 * eligibility is decided against the ledger clock by `lib/domain`, and the
 * contract decides it again.
 *
 * The value is written straight into the DOM node rather than through React
 * state: a once-a-second re-render of the whole page to move two digits is
 * waste, and it keeps every `setState` out of an effect.
 */
export function Countdown({
  className,
  deadlineSeconds,
  ledgerNowSeconds,
}: {
  className?: string;
  deadlineSeconds: number;
  ledgerNowSeconds: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const mountedAt = Date.now();

    function tick() {
      const driftSeconds = (Date.now() - mountedAt) / 1000;
      const remaining = deadlineSeconds - (ledgerNowSeconds + driftSeconds);
      if (node) node.textContent = format(remaining);
    }

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [deadlineSeconds, ledgerNowSeconds]);

  return (
    <span className={cn("num tabular-nums", className)} ref={ref}>
      {format(deadlineSeconds - ledgerNowSeconds)}
    </span>
  );
}

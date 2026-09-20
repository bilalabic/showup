"use client";

import { m, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/components/ui/utils";
import { useWallet } from "@/lib/wallet/provider";
import { userFacingError } from "@/lib/domain";

/**
 * Every route needs the same four states. They are built once here so that a
 * participant sees the same shape of answer on the wallet page, the organizer
 * dashboard and the scanner — and so a future page cannot quietly invent a
 * fifth one.
 */

const SURFACE =
  "rounded-3xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-10 text-center";

function useEntrance() {
  const reduceMotion = useReducedMotion();
  return reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] as const },
      };
}

/**
 * Wallet-not-connected is a prompt, never an error: the page around it stays
 * readable and nothing is coloured as a fault.
 */
export function ConnectPrompt({
  children,
  className,
  label = "Connect wallet",
}: {
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  const { connect, status } = useWallet();
  const entrance = useEntrance();

  return (
    <m.div className={cn(SURFACE, className)} {...entrance}>
      <p className="mx-auto max-w-md text-sm leading-6 text-slate-300">
        {children}
      </p>
      <Button
        className="mt-5"
        disabled={status === "connecting"}
        onClick={() => void connect()}
        type="button"
      >
        {status === "connecting" ? "Connecting…" : label}
      </Button>
    </m.div>
  );
}

/** An empty state says something specific about this page, never "no data". */
export function EmptyState({
  action,
  children,
  className,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  const entrance = useEntrance();

  return (
    <m.div className={cn(SURFACE, className)} {...entrance}>
      {title ? (
        <h2 className="text-lg font-bold tracking-tight text-white">
          {title}
        </h2>
      ) : null}
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
        {children}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </m.div>
  );
}

/** An error state names what failed and offers exactly one next action. */
export function ErrorState({
  error,
  fallback,
  onRetry,
  title = "Something did not load",
}: {
  error?: unknown;
  fallback: string;
  onRetry?: () => void;
  title?: string;
}) {
  const entrance = useEntrance();
  const message = userFacingError(error, fallback);

  return (
    <m.div
      className="rounded-3xl border border-rose-400/25 bg-rose-400/[0.06] px-6 py-6"
      role="alert"
      {...entrance}
    >
      <h2 className="text-base font-bold text-rose-100">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-rose-100/80">{message}</p>
      {onRetry ? (
        <Button className="mt-4" onClick={onRetry} type="button" variant="destructive">
          Try again
        </Button>
      ) : null}
    </m.div>
  );
}

/**
 * Loading is a skeleton of the shape that is coming, never a blank screen and
 * never a spinner that tells the user nothing about what they are waiting for.
 */
export function LoadingRows({
  className,
  count = 3,
  height = "h-28",
}: {
  className?: string;
  count?: number;
  height?: string;
}) {
  return (
    <div aria-hidden="true" className={cn("space-y-3", className)}>
      {Array.from({ length: count }, (_, index) => (
        <Skeleton
          className={cn("w-full rounded-3xl bg-white/[0.04]", height)}
          key={index}
        />
      ))}
    </div>
  );
}

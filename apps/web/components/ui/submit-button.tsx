"use client";

import { AnimatePresence, m, useReducedMotion } from "motion/react";
import type { ComponentProps, ReactNode } from "react";

import { Button } from "@/components/ui/button";

function Spinner() {
  return (
    <svg
      aria-hidden="true"
      className="size-4 animate-spin"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        cx="12"
        cy="12"
        opacity="0.25"
        r="9"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="3"
      />
    </svg>
  );
}

/**
 * A submit control that morphs between its label and a working state.
 *
 * Both labels occupy the same grid cell, so the button's width is whatever the
 * wider of the two needs and never changes mid-transaction — a button that
 * resizes under the cursor while a signature is pending is how a user
 * mis-clicks. Only opacity and a small y offset animate.
 *
 * `pending` means a transaction is in flight, nothing more. The button does not
 * report success; the transaction panel does, once a ledger has confirmed.
 */
export function SubmitButton({
  children,
  disabled,
  pending,
  pendingLabel,
  ...props
}: Omit<ComponentProps<typeof Button>, "children"> & {
  children: ReactNode;
  pending: boolean;
  pendingLabel: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <Button aria-busy={pending} disabled={disabled || pending} {...props}>
      <span className="grid">
        <AnimatePresence initial={false} mode="popLayout">
          <m.span
            animate={{ opacity: 1, y: 0 }}
            className="col-start-1 row-start-1 flex items-center justify-center gap-2"
            exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            key={pending ? "pending" : "idle"}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            {pending ? (
              <>
                <Spinner />
                {pendingLabel}
              </>
            ) : (
              children
            )}
          </m.span>
        </AnimatePresence>
      </span>
    </Button>
  );
}

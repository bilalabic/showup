"use client";

import { m, useReducedMotion } from "motion/react";

import { cn } from "@/components/ui/utils";
import type { DepositStateName } from "@/lib/anchor";

/**
 * The Anchor deposit machine, drawn.
 *
 * It is deliberately a *different* component from the transaction stepper. The
 * two processes fail differently and last for different lengths of time, and
 * the architecture is explicit that funds arriving from the Anchor and a bond
 * being locked are separate events. Merging the two visuals would be the first
 * step towards implying they are one transaction. They are not.
 *
 * The machine's own state name is printed verbatim next to the rail, so what
 * the UI shows and what `lib/anchor` is actually in can always be compared.
 */
const STAGES: ReadonlyArray<{
  covers: readonly DepositStateName[];
  label: string;
}> = [
  { covers: ["DISCOVERING", "PRICING"], label: "Price" },
  { covers: ["AUTHENTICATING"], label: "Sign in" },
  { covers: ["QUOTING"], label: "Quote" },
  {
    covers: ["DEPOSIT_STARTED", "AWAITING_BANK_TRANSFER"],
    label: "Transfer",
  },
  {
    covers: ["ANCHOR_PROCESSING", "TREASURY_LOW", "CLAIM_REQUIRED", "COMPLETED"],
    label: "Deliver",
  },
];

/** States that mean the flow stopped rather than progressed. */
const HALTED: ReadonlyArray<DepositStateName> = ["ERROR"];
const WAITING: ReadonlyArray<DepositStateName> = ["TREASURY_LOW"];

function stageIndex(name: DepositStateName): number {
  return STAGES.findIndex((stage) =>
    (stage.covers as readonly string[]).includes(name),
  );
}

export function AnchorProgress({ name }: { name: DepositStateName }) {
  const reduceMotion = useReducedMotion();

  if (name === "IDLE") return null;

  const halted = HALTED.includes(name);
  const waiting = WAITING.includes(name);
  const complete = name === "COMPLETED";
  const active = stageIndex(name);
  const reached = complete ? STAGES.length - 1 : Math.max(active, 0);
  const progress =
    STAGES.length > 1 ? reached / (STAGES.length - 1) : 0;

  const railColour = halted
    ? "bg-status-no-show"
    : waiting
      ? "bg-status-community"
      : "bg-brand";

  return (
    <div className="mt-5">
      <div className="relative">
        <div className="absolute inset-x-[1.125rem] top-[0.5625rem] h-0.5 rounded-full bg-white/10">
          <m.div
            animate={{ scaleX: progress }}
            className={cn(
              "h-full w-full origin-left rounded-full",
              railColour,
            )}
            initial={reduceMotion ? false : { scaleX: 0 }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { type: "spring", stiffness: 190, damping: 26 }
            }
          />
        </div>

        <ol className="relative grid grid-cols-5 gap-1">
          {STAGES.map((stage, index) => {
            const done = complete || index < reached;
            const current = !complete && index === reached;

            return (
              <li className="flex flex-col items-center gap-2" key={stage.label}>
                <span
                  className={cn(
                    "relative grid size-[1.125rem] place-items-center rounded-full border transition-colors duration-(--duration-component)",
                    done && !halted && "border-brand bg-brand",
                    current && halted && "border-rose-400 bg-rose-400/20",
                    current && waiting && "border-amber-300 bg-amber-300/20",
                    current &&
                      !halted &&
                      !waiting &&
                      "border-brand bg-slate-950",
                    !done && !current && "border-white/15 bg-slate-950",
                  )}
                >
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      done && !halted && "bg-slate-950",
                      current && halted && "bg-rose-300",
                      current && waiting && "bg-amber-300",
                      current && !halted && !waiting && "bg-brand",
                      !done && !current && "bg-white/20",
                    )}
                  />
                  {current && !halted && !reduceMotion ? (
                    <span
                      className={cn(
                        "absolute size-[1.125rem] animate-ping rounded-full",
                        waiting ? "bg-amber-300/25" : "bg-brand/25",
                      )}
                    />
                  ) : null}
                </span>
                <span
                  className={cn(
                    "text-center text-[10px] font-bold uppercase tracking-[0.1em] transition-colors",
                    done && "text-brand-soft/70",
                    current && "text-brand-soft",
                    !done && !current && "text-slate-500",
                  )}
                >
                  {stage.label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <p className="mt-4 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-slate-500">
        state: {name}
      </p>
    </div>
  );
}

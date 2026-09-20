"use client";

import { m, useReducedMotion } from "motion/react";
import { useId } from "react";

import { cn } from "@/components/ui/utils";

type LogoVariant = "lockup" | "mark" | "mono";

type LogoProps = {
  animated?: boolean;
  className?: string;
  gradient?: boolean;
  size?: number;
  variant?: LogoVariant;
};

function ConstellationMark({
  animated,
  gradient,
  mono,
  size,
}: {
  animated: boolean;
  gradient: boolean;
  mono: boolean;
  size: number;
}) {
  const reduceMotion = useReducedMotion();
  const gradientId = useId().replaceAll(":", "");
  const shouldAnimate = animated && !reduceMotion;
  const stroke = gradient ? `url(#${gradientId})` : mono ? "currentColor" : "#4DE6C6";

  return (
    <svg
      aria-hidden="true"
      className="shrink-0 overflow-visible"
      fill="none"
      height={size}
      viewBox="0 0 40 40"
      width={size}
    >
      {gradient ? (
        <defs>
          <linearGradient id={gradientId} x1="8" x2="34" y1="10" y2="31">
            <stop stopColor="#4DE6C6" />
            <stop offset="1" stopColor="#FFB454" />
          </linearGradient>
        </defs>
      ) : null}
      <m.path
        animate={{ pathLength: 1, opacity: 1 }}
        d="M7.5 19.5 15 27l18-18"
        initial={shouldAnimate ? { pathLength: 0, opacity: 0.35 } : false}
        stroke={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3.25"
        transition={{ duration: 0.58, ease: [0.22, 1, 0.36, 1] }}
      />
      {[
        [7.5, 19.5],
        [15, 27],
        [24, 18],
        [33, 9],
      ].map(([cx, cy], index) => (
        <m.circle
          animate={{ opacity: 1, scale: 1 }}
          className="origin-center transition-[filter] duration-(--duration-micro) group-hover:drop-shadow-[0_0_5px_rgba(77,230,198,0.9)]"
          cx={cx}
          cy={cy}
          fill={stroke}
          initial={shouldAnimate ? { opacity: 0, scale: 0.4 } : false}
          key={`${cx}-${cy}`}
          r={index === 3 ? 3.25 : 2.75}
          transition={{ delay: shouldAnimate ? 0.24 + index * 0.07 : 0, duration: 0.24 }}
        />
      ))}
    </svg>
  );
}

/** Secondary identity concept: presence arriving through an open boundary. */
export function ArrivalRingMark({ size = 40 }: { size?: number }) {
  return (
    <svg aria-hidden="true" fill="none" height={size} viewBox="0 0 40 40" width={size}>
      <path d="M29.5 31.5A15 15 0 1 1 31 10" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
      <circle cx="31" cy="10" fill="currentColor" r="3.5" />
      <path d="m27.5 14.5 3.5-4.5 4 3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

/** ShowUp's Constellation Check: network participation resolved into presence. */
export function Logo({
  animated = false,
  className,
  gradient = false,
  size = 40,
  variant = "lockup",
}: LogoProps) {
  const mono = variant === "mono";

  return (
    <span
      aria-label={variant === "lockup" ? "ShowUp" : undefined}
      className={cn(
        "group inline-flex items-center text-white",
        variant === "lockup" && "gap-2.5",
        className,
      )}
      role={variant === "lockup" ? "img" : undefined}
    >
      <ConstellationMark
        animated={animated}
        gradient={gradient}
        mono={mono}
        size={size}
      />
      {variant === "lockup" ? (
        <span className="font-headline text-[1.05rem] font-bold tracking-[-0.035em]">
          ShowUp
        </span>
      ) : null}
    </span>
  );
}

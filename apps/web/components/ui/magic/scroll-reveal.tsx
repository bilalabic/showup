"use client";

import { m, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

/**
 * Reveals a block the first time it scrolls into view.
 *
 * Only `opacity` and `transform` animate, and the element starts at `opacity:
 * 0` inside its normal flow position — the space it occupies is reserved before
 * the animation runs, so nothing below it moves. With reduced motion the
 * initial and animate states are identical, so the content is simply there.
 */
export function ScrollReveal({
  children,
  className,
  delaySeconds = 0,
}: {
  children: ReactNode;
  className?: string;
  delaySeconds?: number;
}) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <m.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      transition={{
        delay: delaySeconds,
        duration: 0.5,
        ease: [0.22, 1, 0.36, 1],
      }}
      viewport={{ amount: 0.3, once: true }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      {children}
    </m.div>
  );
}

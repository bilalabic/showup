"use client";

import { domAnimation, LazyMotion, MotionConfig } from "motion/react";
import type { ReactNode } from "react";

/**
 * One motion runtime for the whole app.
 *
 * `LazyMotion` with the `domAnimation` feature set keeps the animation engine
 * out of the initial bundle and loads it once, which is why every animated
 * component in this codebase uses `m.*` rather than `motion.*`.
 *
 * `reducedMotion="user"` makes the operating-system preference authoritative:
 * transform and opacity animations resolve instantly to their target value
 * instead of playing, so nothing moves for a user who asked for no movement.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}

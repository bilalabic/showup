"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

import { cn } from "@/components/ui/utils";

type Star = {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  vx: number;
  vy: number;
};

const STAR_COUNT = 90;
const LINK_DISTANCE = 130;

/**
 * A Stellar constellation drifting behind the landing hero.
 *
 * It is a single `<canvas>` painted on `requestAnimationFrame`, so it costs one
 * compositor layer rather than ninety DOM nodes, and it is used on the landing
 * page only. Under `prefers-reduced-motion` the field is painted exactly once
 * and the loop never starts, so the page still has its texture without motion.
 *
 * The canvas is decorative and carries no information the page does not state
 * in text.
 */
export function Particles({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let stars: Star[] = [];
    let frame = 0;

    function seed() {
      const parent = canvas!.parentElement;
      width = parent?.clientWidth ?? window.innerWidth;
      height = parent?.clientHeight ?? window.innerHeight;
      canvas!.width = Math.floor(width * dpr);
      canvas!.height = Math.floor(height * dpr);
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      context!.setTransform(dpr, 0, 0, dpr, 0, 0);

      stars = Array.from({ length: STAR_COUNT }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 1.4 + 0.4,
        alpha: Math.random() * 0.5 + 0.25,
        vx: (Math.random() - 0.5) * 0.14,
        vy: (Math.random() - 0.5) * 0.14,
      }));
    }

    function paint() {
      context!.clearRect(0, 0, width, height);

      for (let i = 0; i < stars.length; i += 1) {
        const star = stars[i]!;
        for (let j = i + 1; j < stars.length; j += 1) {
          const other = stars[j]!;
          const dx = star.x - other.x;
          const dy = star.y - other.y;
          const distance = Math.hypot(dx, dy);
          if (distance > LINK_DISTANCE) continue;
          context!.strokeStyle = `rgba(103, 232, 249, ${
            0.16 * (1 - distance / LINK_DISTANCE)
          })`;
          context!.lineWidth = 1;
          context!.beginPath();
          context!.moveTo(star.x, star.y);
          context!.lineTo(other.x, other.y);
          context!.stroke();
        }
      }

      for (const star of stars) {
        context!.fillStyle = `rgba(226, 232, 240, ${star.alpha})`;
        context!.beginPath();
        context!.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        context!.fill();
      }
    }

    function step() {
      for (const star of stars) {
        star.x += star.vx;
        star.y += star.vy;
        if (star.x < -20) star.x = width + 20;
        if (star.x > width + 20) star.x = -20;
        if (star.y < -20) star.y = height + 20;
        if (star.y > height + 20) star.y = -20;
      }
      paint();
      frame = window.requestAnimationFrame(step);
    }

    seed();
    paint();
    if (!reduceMotion) frame = window.requestAnimationFrame(step);

    const observer = new ResizeObserver(() => {
      seed();
      paint();
    });
    if (canvas.parentElement) observer.observe(canvas.parentElement);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [reduceMotion]);

  return (
    <canvas
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0", className)}
      ref={canvasRef}
    />
  );
}

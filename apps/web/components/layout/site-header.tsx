"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { m, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

import { ConnectButton } from "@/components/wallet/connect-button";
import { cn } from "@/components/ui/utils";

const NAV = [
  { compact: true, href: "/wallet", label: "Wallet" },
  { compact: false, href: "/reservations", label: "Reservations" },
  { compact: true, href: "/organizer", label: "Organizer" },
] as const;

/**
 * A sticky glass header.
 *
 * The elevation change on scroll is written as a `data-scrolled` attribute
 * straight onto the element rather than through React state: the header is
 * above every page in the tree, and re-rendering it on every scroll frame would
 * re-render the whole app. The header is `sticky`, so it occupies its own space
 * in flow and pinning it shifts nothing.
 */
export function SiteHeader() {
  const ref = useRef<HTMLElement>(null);
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    function sync() {
      node?.setAttribute("data-scrolled", window.scrollY > 8 ? "true" : "false");
    }

    sync();
    window.addEventListener("scroll", sync, { passive: true });
    return () => window.removeEventListener("scroll", sync);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-white/8",
        "bg-slate-950/70 backdrop-blur-xl backdrop-saturate-150",
        "transition-[background-color,border-color,box-shadow] duration-(--duration-component) ease-(--ease-out-soft)",
        "data-[scrolled=true]:border-white/12 data-[scrolled=true]:bg-slate-950/85",
        "data-[scrolled=true]:shadow-[0_18px_40px_-28px_rgba(0,0,0,0.95)]",
      )}
      ref={ref}
    >
      {/* A 1px inner highlight — the detail that separates glass from a plain
          translucent panel. Purely decorative and out of the layout. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent"
      />

      <div className="mx-auto flex min-h-20 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
        <Link
          className="group flex items-center gap-3 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300"
          href="/"
        >
          <m.span
            className="grid size-10 place-items-center rounded-xl bg-cyan-300 font-mono text-sm font-black text-slate-950 shadow-[0_0_28px_rgba(103,232,249,0.2)]"
            transition={{ type: "spring", stiffness: 380, damping: 18 }}
            whileHover={reduceMotion ? undefined : { rotate: -6, scale: 1.05 }}
          >
            SU
          </m.span>
          <span>
            <span className="block text-base font-black tracking-tight">
              ShowUp
            </span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              Stellar Testnet
            </span>
          </span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          {NAV.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                className={cn(
                  "relative min-h-11 items-center rounded-full px-3 text-sm font-semibold transition-colors duration-(--duration-micro) sm:px-3.5",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300",
                  // The full set needs room; the least-used link drops first on
                  // a narrow viewport rather than every link shrinking.
                  item.compact ? "inline-flex" : "hidden sm:inline-flex",
                  active ? "text-cyan-200" : "text-slate-300 hover:text-cyan-200",
                )}
                href={item.href}
                key={item.href}
              >
                {/* The active pill fades and scales in rather than sliding
                    between links: a shared-layout transition needs Motion's
                    full feature set, and the provider deliberately loads only
                    `domAnimation` to keep the bundle small. */}
                {active ? (
                  <m.span
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute inset-0 -z-10 rounded-full bg-cyan-300/10 ring-1 ring-inset ring-cyan-300/20"
                    initial={reduceMotion ? false : { opacity: 0, scale: 0.9 }}
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 340, damping: 30 }
                    }
                  />
                ) : null}
                {item.label}
              </Link>
            );
          })}
          <span className="ml-1 sm:ml-3">
            <ConnectButton />
          </span>
        </nav>
      </div>
    </header>
  );
}

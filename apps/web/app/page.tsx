import Link from "next/link";

import { BondCard } from "@/components/landing/bond-card";
import { Lifecycle } from "@/components/landing/lifecycle";
import { Button } from "@/components/ui/button";
import { ShimmerButton } from "@/components/ui/magic/shimmer-button";
import { Particles } from "@/components/ui/magic/particles";

const CHIPS = ["Non-custodial", "Contract-enforced", "Testnet only"] as const;

export default function Home() {
  return (
    <main className="relative isolate flex-1 overflow-hidden">
      {/* Layered background. All of it is decorative, pointer-transparent and
          behind the content, and the heavy pieces live on this page only. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[46rem]">
        <div className="hero-grid absolute inset-0 opacity-35" />
        <Particles className="opacity-80" />
        <div className="hero-glow absolute left-1/2 top-12 size-96 -translate-x-1/2 rounded-full blur-3xl" />
        <div className="absolute left-[12%] top-[22rem] size-72 rounded-full bg-indigo-500/10 blur-3xl" />
      </div>

      <section className="mx-auto grid max-w-6xl items-center gap-16 px-5 py-20 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:py-28">
        <div>
          {/* The reveal is a CSS animation, not a JavaScript one: the headline
              has to be readable before — and without — the motion runtime. */}
          <div
            className="reveal mb-8 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/5 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-cyan-200"
            style={{ animationDelay: "40ms" }}
          >
            <span className="size-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.9)]" />
            Live on Stellar Testnet
          </div>

          <h1 className="max-w-3xl text-5xl font-black leading-[0.94] tracking-[-0.055em] text-white sm:text-7xl lg:text-[5.25rem]">
            <span
              className="reveal block"
              style={{ animationDelay: "120ms" }}
            >
              Commit to
            </span>
            <span
              className="reveal block"
              style={{ animationDelay: "200ms" }}
            >
              showing up.
            </span>
            <span
              className="reveal mt-2 block bg-gradient-to-br from-cyan-200 via-cyan-300 to-cyan-500 bg-clip-text text-transparent"
              style={{ animationDelay: "280ms" }}
            >
              Get your bond back.
            </span>
          </h1>

          <p
            className="reveal mt-8 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl"
            style={{ animationDelay: "360ms" }}
          >
            ShowUp turns event attendance into a transparent commitment.
            Reserve with Testnet USDC, check in, and the contract returns your
            bond automatically.
          </p>

          <div
            className="reveal mt-10 flex flex-wrap gap-3 text-sm font-semibold text-slate-300"
            style={{ animationDelay: "420ms" }}
          >
            {CHIPS.map((chip) => (
              <span
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2"
                key={chip}
              >
                {chip}
              </span>
            ))}
          </div>

          <div
            className="reveal mt-10 flex flex-wrap gap-3"
            style={{ animationDelay: "480ms" }}
          >
            <ShimmerButton>
              <Button asChild size="lg">
                <Link href="/organizer/events/new">Create an event</Link>
              </Button>
            </ShimmerButton>
            <Button asChild size="lg" variant="outline">
              <Link href="/organizer">Your events</Link>
            </Button>
          </div>
        </div>

        <div className="reveal" style={{ animationDelay: "320ms" }}>
          <BondCard />
        </div>
      </section>

      <Lifecycle />
    </main>
  );
}

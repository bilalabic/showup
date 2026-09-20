"use client";

import { ScrollReveal } from "@/components/ui/magic/scroll-reveal";
import { Logo } from "@/components/brand/logo";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";

type Step = {
  call: string;
  detail: string;
  state: string;
  title: string;
  tone: StatusTone;
  who: string;
};

/**
 * The bond lifecycle, named the way the contract names it.
 *
 * Every state and every entry point below is the real one from
 * `contracts/showup-bond`, so a visitor who later reads the contract finds the
 * same four words. Marketing synonyms would make the diagram easier to write
 * and the product harder to verify.
 */
const STEPS: readonly Step[] = [
  {
    call: "reserve()",
    detail:
      "The bond leaves your wallet and enters the contract's own custody. Not the organizer's account — the contract's.",
    state: "Locked",
    title: "Commit",
    tone: "accent",
    who: "Participant signs",
  },
  {
    call: "check_in()",
    detail:
      "The verifier scans your pass and signs once. The contract returns the full bond in that same transaction.",
    state: "Attended",
    title: "Show up",
    tone: "positive",
    who: "Verifier signs",
  },
  {
    call: "cancel_reservation()",
    detail:
      "Plans change. Cancel before the cancellation deadline and the contract refunds everything, no questions and no fee.",
    state: "Cancelled",
    title: "Change of plans",
    tone: "neutral",
    who: "Participant signs",
  },
  {
    call: "settle_no_show()",
    detail:
      "After the check-in deadline anyone can settle an unclaimed bond. It splits by the basis points published before you reserved.",
    state: "No-show settled",
    title: "Do not show up",
    tone: "critical",
    who: "Permissionless",
  },
];

export function Lifecycle() {
  return (
    <section className="mx-auto w-full max-w-6xl px-5 pb-28 sm:px-8">
      <ScrollReveal>
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand">
          How it works
        </p>
        <h2 className="mt-4 max-w-2xl text-3xl font-bold leading-tight tracking-[-0.04em] sm:text-4xl">
          One bond, four ways it can end — and the contract decides every one of
          them.
        </h2>
        <p className="mt-4 max-w-2xl leading-7 text-slate-400">
          These are the contract&apos;s own entry points and its own reservation
          states. Nothing here is decided by ShowUp&apos;s servers, because
          ShowUp has none.
        </p>
      </ScrollReveal>

      <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, index) => (
          <ScrollReveal delaySeconds={index * 0.08} key={step.state}>
            <li className="group relative flex h-full flex-col rounded-3xl border border-white/10 bg-white/[0.02] p-6 transition-colors duration-(--duration-component) hover:border-brand/30 hover:bg-white/[0.04]">
              <span className="num text-xs font-bold text-slate-600">
                0{index + 1}
              </span>
              <h3 className="mt-3 text-xl font-bold tracking-tight">
                {step.title}
              </h3>
              <p className="mt-3 flex-1 text-sm leading-6 text-slate-400">
                {step.detail}
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-2">
                <StatusBadge tone={step.tone}>{step.state}</StatusBadge>
              </div>
              <p className="mt-3 font-mono text-[11px] text-slate-500">
                {step.call} · {step.who}
              </p>
            </li>
          </ScrollReveal>
        ))}
      </ol>

      <ScrollReveal delaySeconds={0.1}>
        <p className="mt-10 rounded-3xl border border-white/10 bg-white/[0.02] px-6 py-5 text-sm leading-6 text-slate-400">
          ShowUp runs on Stellar <strong className="text-slate-200">Testnet</strong>{" "}
          with a mock USDC asset and a mock anchor. No real money, no real
          identity check, and funding an account is a separate, non-atomic step
          from locking a bond.
        </p>
      </ScrollReveal>

      <footer className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-8 text-sm text-slate-500">
        <Logo className="text-slate-300" size={24} variant="lockup" />
        <p>Contract-enforced attendance bonds on Stellar Testnet.</p>
      </footer>
    </section>
  );
}

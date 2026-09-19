export default function Home() {
  return (
    <main className="relative isolate flex-1 overflow-hidden">
      <div className="hero-grid absolute inset-0 -z-10 opacity-35" />
      <div className="hero-glow absolute left-1/2 top-12 -z-10 h-96 w-96 -translate-x-1/2 rounded-full blur-3xl" />

      <section className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-16 px-5 py-20 sm:px-8 lg:grid-cols-[1.2fr_0.8fr] lg:py-28">
        <div>
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/5 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">
            <span className="size-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.9)]" />
            Live on Stellar Testnet
          </div>
          <h1 className="max-w-3xl text-5xl font-black leading-[0.96] tracking-[-0.055em] text-white sm:text-7xl">
            Commit to showing up.
            <span className="mt-2 block text-cyan-300">Get your bond back.</span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
            ShowUp turns event attendance into a transparent commitment.
            Reserve with Testnet USDC, check in, and the contract returns your
            bond automatically.
          </p>
          <div className="mt-10 flex flex-wrap gap-3 text-sm font-semibold text-slate-300">
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
              Non-custodial
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
              Contract-enforced
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
              Testnet only
            </span>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-cyan-300/10 blur-2xl" />
          <div className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-black/40 backdrop-blur sm:p-8">
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">
                  Commitment bond
                </p>
                <h2 className="mt-3 text-2xl font-bold">Design Meetup Istanbul</h2>
              </div>
              <span className="rounded-full bg-emerald-300/10 px-3 py-1 text-xs font-bold text-emerald-300">
                Open
              </span>
            </div>

            <dl className="mt-8 divide-y divide-white/10 rounded-2xl border border-white/10 bg-slate-950/50 px-5">
              <div className="flex items-center justify-between gap-6 py-4">
                <dt className="text-sm text-slate-400">Bond</dt>
                <dd className="font-mono text-lg font-bold text-white">
                  5.00 USDC
                </dd>
              </div>
              <div className="flex items-center justify-between gap-6 py-4">
                <dt className="text-sm text-slate-400">Network</dt>
                <dd className="text-sm font-bold text-cyan-300">Testnet</dd>
              </div>
              <div className="flex items-center justify-between gap-6 py-4">
                <dt className="text-sm text-slate-400">Settlement</dt>
                <dd className="text-sm font-bold">On-chain</dd>
              </div>
            </dl>

            <div className="mt-6 rounded-2xl border border-dashed border-white/15 px-5 py-4 text-sm leading-6 text-slate-400">
              Connect Freighter above to establish a Testnet session. No wallet
              connection is requested automatically.
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

/**
 * The celebration that fires when a bond actually settles.
 *
 * It is deliberately short — a single burst, well under a second — and it is
 * only ever called from a confirmed-on-ledger state. A celebration on signature
 * or on submission would be a lie about what the network has done.
 *
 * The library is imported lazily so it never reaches a server bundle and never
 * costs anything on a page that does not settle a bond.
 */
export async function celebrate(): Promise<void> {
  if (typeof window === "undefined") return;

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  if (prefersReducedMotion) return;

  try {
    const { default: confetti } = await import("canvas-confetti");
    void confetti({
      colors: ["#67e8f9", "#a5f3fc", "#6ee7b7", "#f8fafc"],
      disableForReducedMotion: true,
      gravity: 1.15,
      origin: { x: 0.5, y: 0.62 },
      particleCount: 90,
      scalar: 0.9,
      spread: 74,
      startVelocity: 34,
      ticks: 120,
    });
  } catch {
    // A missing celebration is never worth surfacing to the user.
  }
}

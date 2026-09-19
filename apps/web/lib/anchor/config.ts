import {
  TESTNET_NETWORK_PASSPHRASE,
  USDC_CODE,
  USDC_ISSUER,
} from "../stellar";

/**
 * Static configuration for the Anchor integration.
 *
 * The integration handoff is two values: a home domain and an asset code.
 * Everything else — endpoints, signing key, issuer — is DISCOVERED from
 * `stellar.toml` at runtime by `discover()`. Nothing here is a substitute for
 * that; these are defaults and guidance copy only.
 */

/**
 * Testnet, and only Testnet.
 *
 * Re-exported from `lib/stellar` rather than restated. `lib/anchor` is allowed
 * to depend on `lib/stellar` (SYSTEM.md section 4), and one literal defined in
 * two places is one literal that can drift.
 */
export { TESTNET_NETWORK_PASSPHRASE };

/** Default home domain. Host name only — SEP-10 signs over exactly this. */
export const DEFAULT_ANCHOR_HOME_DOMAIN = "tr-mock-anchor.fly.dev";

/** The asset the Anchor ramps TRY into. */
export const ANCHOR_ASSET_CODE = USDC_CODE;

/** The exact Testnet issuer pinned by the contract and wallet data layer. */
export const ANCHOR_ASSET_ISSUER = USDC_ISSUER;

/** The fiat side, as a SEP-38 asset identifier. */
export const FIAT_ASSET_ID = "iso4217:TRY";

/** The Anchor's only delivery method. */
export const DELIVERY_METHOD = "bank_account";

/**
 * SEP-6 funding method.
 *
 * `funding_method` — NOT the deprecated `type=`. The hackathon `SKILL.md`
 * teaches `type`; the Anchor's own `/guide` documents `funding_method`.
 */
export const FUNDING_METHOD = "bank_account";

/** SEP-38 pricing context for an on-ramp through SEP-6. */
export const QUOTE_CONTEXT = "sep6";

/**
 * Poll interval for `GET /sep6/transaction`.
 *
 * The Anchor settles on-ramps every ~3 s and advertises `eta: 5`, so 3 s is
 * right-sized: faster is wasted requests, slower makes the demo look slow.
 */
export const DEPOSIT_POLL_INTERVAL_MS = 3_000;

/** Default ceiling on a single poll loop. 5 minutes of 3 s polls. */
export const DEPOSIT_POLL_MAX_ATTEMPTS = 100;

/** Network timeout for a single Anchor request. */
export const ANCHOR_REQUEST_TIMEOUT_MS = 15_000;

/**
 * Seconds of headroom applied to the SEP-10 token's own `exp`.
 *
 * The JWT lifetime is UNDOCUMENTED, so this client reads `exp` from the token
 * rather than assuming one, and treats a token as spent slightly early so a
 * request in flight cannot expire mid-call.
 */
export const JWT_EXPIRY_SKEW_SECONDS = 30;

/**
 * Guidance-only limits, read from `GET /health` on 2026-09-19.
 *
 * The Anchor's two endpoints CONTRADICT each other — `/health` reported
 * 50–3,000 TRY while `/sep6/info` reported 0.5–300 — and on a later probe
 * `/health` reported every limit as `null`. Neither is hard-coded anywhere in
 * this module. These numbers exist for helper text and nothing else; the
 * authority on whether an amount is acceptable is the Anchor's own rejection,
 * which is surfaced verbatim.
 */
export const GUIDANCE_ONLY_TRY_RANGE = {
  min: "50",
  max: "3000",
  note: "Guidance only. The Anchor's own endpoints disagree about limits, so the server's rejection message is authoritative.",
} as const;

/** The home domain in use, overridable for a self-hosted Anchor. */
export function getAnchorHomeDomain(): string {
  const configured = process.env.NEXT_PUBLIC_ANCHOR_HOME_DOMAIN;
  const trimmed = typeof configured === "string" ? configured.trim() : "";
  return trimmed.length > 0 ? normalizeHomeDomain(trimmed) : DEFAULT_ANCHOR_HOME_DOMAIN;
}

/**
 * Reduce anything domain-ish to a bare host name.
 *
 * `StellarToml.Resolver.resolve()` throws on a scheme or a trailing slash, and
 * SEP-10's ManageData key is the bare host, so both callers need this.
 */
export function normalizeHomeDomain(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, "");
  const withoutScheme = trimmed.replace(/^https?:\/\//i, "");
  return withoutScheme.split("/")[0]!.toLowerCase();
}

/**
 * Whether the Mock-Anchor-only demo endpoints may be called.
 *
 * `simulateMockBankTransfer()` is gated on this. It is a sandbox convenience
 * endpoint, not a banking API and not part of SEP-6.
 */
export function isDemoToolsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_DEMO_TOOLS === "true";
}

/**
 * The claimable-balance recovery transaction.
 *
 * This is the highest-value recovery path in the product. When the destination
 * has no USDC trustline the Anchor does NOT stall on `pending_trust` — it
 * issues a claimable balance with the participant as sole unconditional
 * claimant, and the deposit still reaches `completed` with a
 * `claimable_balance_id`. Recovering the funds is one transaction containing
 * BOTH `changeTrust` and `claimClaimableBalance`, in that order: the trustline
 * must exist before the claim executes, and splitting them into two
 * transactions doubles the signature prompts for no benefit.
 *
 * Transaction assembly lives in `lib/stellar`; this module only interprets the
 * Anchor status that decides whether recovery is needed.
 */
import type { DepositStatus } from "./types";

/**
 * Whether a deposit needs the recovery transaction.
 *
 * Two triggers, one action: a `completed` deposit carrying a
 * `claimable_balance_id` (the real path), and the legacy `pending_trust`
 * status, kept as a defensive extra case because it appears in `SKILL.md` and
 * in `llms-full.txt` but not in the Anchor's authoritative status table.
 */
export function needsClaim(status: DepositStatus): boolean {
  if (status.status === "pending_trust") {
    return true;
  }
  return (
    status.status === "completed" &&
    typeof status.claimableBalanceId === "string" &&
    status.claimableBalanceId.length > 0
  );
}

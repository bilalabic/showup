export const TECHNICAL_EVIDENCE_EVENT = "showup:technical-evidence";

export type TechnicalEvidence = {
  transactionHash?: string | null;
  anchorTransactionId?: string | null;
  quoteId?: string | null;
};

const HASH = /^[0-9a-f]{64}$/i;
const PUBLIC_REFERENCE = /^[A-Za-z0-9._:-]{1,160}$/;

/**
 * Reduce an arbitrary update to the three public identifiers the panel permits.
 * Tokens, headers, environment objects and unknown properties are discarded.
 */
export function sanitizeTechnicalEvidence(
  value: Record<string, unknown>,
): TechnicalEvidence {
  const evidence: TechnicalEvidence = {};

  if (value.transactionHash === null) evidence.transactionHash = null;
  if (
    typeof value.transactionHash === "string" &&
    HASH.test(value.transactionHash)
  ) {
    evidence.transactionHash = value.transactionHash.toLowerCase();
  }
  if (value.anchorTransactionId === null) evidence.anchorTransactionId = null;
  if (
    typeof value.anchorTransactionId === "string" &&
    PUBLIC_REFERENCE.test(value.anchorTransactionId)
  ) {
    evidence.anchorTransactionId = value.anchorTransactionId;
  }
  if (value.quoteId === null) evidence.quoteId = null;
  if (
    typeof value.quoteId === "string" &&
    PUBLIC_REFERENCE.test(value.quoteId)
  ) {
    evidence.quoteId = value.quoteId;
  }

  return evidence;
}

export function publishTechnicalEvidence(
  update: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  const evidence = sanitizeTechnicalEvidence(update);
  if (Object.keys(evidence).length === 0) return;

  window.dispatchEvent(
    new CustomEvent<TechnicalEvidence>(TECHNICAL_EVIDENCE_EVENT, {
      detail: evidence,
    }),
  );
}

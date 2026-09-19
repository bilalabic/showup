/**
 * Application-shaped types for the TR Mock Anchor integration.
 *
 * No raw SEP response object escapes `lib/anchor`. Callers see the types below
 * and nothing else. Every amount is a decimal STRING exactly as the Anchor sent
 * it — never a `number` — because a financial value parsed through IEEE-754 is
 * a rounding bug waiting to happen. `lib/domain/amounts` converts when integer
 * math is actually needed.
 */

/** SEP-1 discovery result, reduced to the fields this product uses. */
export type AnchorConfig = {
  /** Host name only, no scheme. This is what SEP-10 signs over. */
  homeDomain: string;
  /** From `stellar.toml`. Asserted to be Testnet before anything else runs. */
  networkPassphrase: string;
  /** `SIGNING_KEY` — the account that signs SEP-10 challenges. */
  signingKey: string;
  /** `WEB_AUTH_ENDPOINT` (SEP-10). */
  webAuthEndpoint: string;
  /** `TRANSFER_SERVER` (SEP-6). */
  transferServer: string;
  /** `ANCHOR_QUOTE_SERVER` (SEP-38). */
  quoteServer: string;
  /** `KYC_SERVER` (SEP-12). Recorded for completeness; P0 never calls it. */
  kycServer?: string;
  /** The settlement asset the Anchor ramps into. */
  asset: { code: string; issuer: string };
};

/** SEP-38 asset identifier, e.g. `iso4217:TRY`. */
export type AssetId = string;

/** A fee leg as SEP-38 reports it. */
export type AnchorFee = {
  total: string;
  asset: AssetId;
  details?: ReadonlyArray<{
    name: string;
    description?: string;
    amount: string;
  }>;
};

/**
 * An INDICATIVE price from SEP-38 `GET /price`. Public — no Bearer token.
 *
 * This is what lets an event page show "200 TRY is about 4.08 USDC" before the
 * wallet is even connected. It is not binding on the Anchor.
 */
export type Price = {
  /** What the user pays, in the sell asset. */
  sellAmount: string;
  /** What the user receives, in the buy asset. */
  buyAmount: string;
  /** Rate excluding fees. */
  price: string;
  /** Rate including fees. `sellAmount = buyAmount * totalPrice`. */
  totalPrice: string;
  sellAsset: AssetId;
  buyAsset: AssetId;
  fee?: AnchorFee;
};

/**
 * A FIRM quote from SEP-38 `POST /quote`. Requires the SEP-10 token.
 *
 * Single-use and bound to the authenticated account. 15 minutes by default.
 * An expired quote does NOT fail a deposit — see {@link isQuoteExpired}.
 */
export type Quote = Price & {
  id: string;
  /** Unix seconds, parsed from the Anchor's ISO-8601 `expires_at`. */
  expiresAt: number;
};

/**
 * One SEP-9 instruction field, as the Anchor returns it inside
 * `instructions`. `description` is the Anchor's own copy and is shown verbatim.
 */
export type InstructionField = {
  value: string;
  description?: string;
};

/**
 * The bank details a participant needs in order to send TRY.
 *
 * `externalTransferMemo` is the transfer-description reference — the single most important
 * value on the screen, because a transfer without it is not matched.
 */
export type BankInstructions = {
  bankName?: InstructionField;
  bankAccountNumber?: InstructionField;
  accountHolder?: InstructionField;
  externalTransferMemo?: InstructionField;
  /** Every field the Anchor sent, including ones this type does not name. */
  all: Readonly<Record<string, InstructionField>>;
};

/** What `startDeposit()` hands back: an id to poll and instructions to display. */
export type DepositTicket = {
  id: string;
  instructions: BankInstructions;
  /** The Anchor's own prose explanation. Displayed, never parsed. */
  how?: string;
  /** Seconds the Anchor expects settlement to take. Advertised as 5. */
  eta?: number;
  feePercent?: number;
  /** Human page for this transaction, including the simulate button. */
  moreInfoUrl?: string;
  extraInfoMessage?: string;
};

/**
 * SEP-6 transaction statuses this client understands.
 *
 * `pending_stellar` and `pending_trust` are both real and both absent from the
 * hackathon `SKILL.md`. Anything unrecognised is preserved as-is rather than
 * being coerced, so a new Anchor status surfaces as "unknown" instead of being
 * silently mapped onto the wrong state.
 */
export type DepositStatusCode =
  | "incomplete"
  | "pending_user_transfer_start"
  | "pending_user_transfer_complete"
  | "pending_external"
  | "pending_anchor"
  | "pending_stellar"
  | "pending_trust"
  | "pending_customer_info_update"
  | "completed"
  | "refunded"
  | "expired"
  | "error";

/** A refund leg reported on a failed deposit. */
export type DepositRefunds = {
  amountRefunded?: string;
  amountFee?: string;
  payments?: ReadonlyArray<Record<string, unknown>>;
};

/**
 * A polled SEP-6 deposit.
 *
 * Note `treasuryLow`: the Anchor reports `pending_reason: "treasury_low"` when
 * the shared sandbox treasury is empty. The deposit WAITS — it does not fail —
 * and this flag exists so the UI can say so instead of showing a spinner that
 * looks like a bug.
 */
export type DepositStatus = {
  id: string;
  status: DepositStatusCode | "unknown";
  /** The literal status string, even when it is not one this client knows. */
  rawStatus: string;
  /** `pending_reason`, undocumented in `SKILL.md`. */
  pendingReason?: string;
  /** `pending_reason === "treasury_low"`. Waits, never fails. */
  treasuryLow: boolean;
  /**
   * Present when the Anchor issued a claimable balance because the destination
   * had no USDC trustline. The deposit still reached `completed`.
   */
  claimableBalanceId?: string;
  stellarTransactionId?: string;
  externalTransactionId?: string;
  amountIn?: string;
  amountInAsset?: AssetId;
  amountOut?: string;
  amountOutAsset?: AssetId;
  amountFee?: string;
  /** The Anchor's own message. Shown verbatim; never rewritten. */
  message?: string;
  moreInfoUrl?: string;
  refunds?: DepositRefunds;
  startedAt?: string;
  completedAt?: string;
};

/**
 * Anything that can sign a challenge transaction.
 *
 * Deliberately structural, not `lib/wallet`'s `Wallet`: `lib/anchor` must not
 * depend on the wallet layer, and a plain object makes every test offline.
 */
export type ChallengeSigner = {
  address: string;
  signTransaction: (xdr: string) => Promise<string>;
};

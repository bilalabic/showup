/**
 * RECORDED Anchor responses.
 *
 * Provenance, all captured on 2026-09-19 against
 * `https://tr-mock-anchor.fly.dev` with GET probes only:
 *  - `STELLAR_TOML_*`, `SEP38_PRICE_RESPONSE`, `AUTH_REQUIRED_403_BODY` and
 *    `LIVE_CHALLENGE_RESPONSE` are verbatim live responses.
 *  - The SEP-6 deposit and transaction payloads are authenticated endpoints, so
 *    they are reproduced from the Anchor's own `/guide` documented shapes plus
 *    its published status table. No JWT was ever obtained and nothing was POSTed.
 *
 * No test in this directory touches the network.
 */

import type { StellarToml } from "@stellar/stellar-sdk";

export const ANCHOR_HOME_DOMAIN = "tr-mock-anchor.fly.dev";
export const ANCHOR_SIGNING_KEY =
  "GDXYO6FJCNXZEWGXD54GT76FGFYLOLSOGSOJLNQ6WGHCGEQPO7NTE73M";
export const USDC_ISSUER =
  "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
export const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";

/** `GET /.well-known/stellar.toml`, as `StellarToml.Resolver` parses it. */
export const STELLAR_TOML: StellarToml.Api.StellarToml = {
  VERSION: "2.7.0",
  NETWORK_PASSPHRASE: TESTNET_PASSPHRASE as StellarToml.Api.StellarToml["NETWORK_PASSPHRASE"],
  SIGNING_KEY: ANCHOR_SIGNING_KEY,
  WEB_AUTH_ENDPOINT: "https://tr-mock-anchor.fly.dev/auth",
  TRANSFER_SERVER: "https://tr-mock-anchor.fly.dev/sep6",
  KYC_SERVER: "https://tr-mock-anchor.fly.dev/sep12",
  ANCHOR_QUOTE_SERVER: "https://tr-mock-anchor.fly.dev/sep38",
  ACCOUNTS: [
    "GCLCZEQZ2THTEDAOFI66LACNPLY4OBKN7VKLEZFMBIHYKYQOW2W7T3Z6",
    ANCHOR_SIGNING_KEY,
  ],
  CURRENCIES: [
    {
      code: "USDC",
      issuer: USDC_ISSUER,
      status: "test",
      display_decimals: 2,
      is_asset_anchored: true,
      anchor_asset_type: "fiat",
      anchor_asset: "TRY",
    },
  ],
};

/**
 * A REAL `GET /auth?account=…` response, captured 2026-09-19 18:44:36 UTC.
 *
 * Its 900-second window is long gone, which is precisely what makes it useful:
 * it proves the validator enforces timebounds on a genuine Anchor challenge
 * rather than only on synthetic ones.
 */
export const LIVE_CHALLENGE_RESPONSE = {
  transaction:
    "AAAAAgAAAADvh3ipE2+SWNcfeGn/xTFwty5ONJyVth6xjiMSD3fbMgAAAMgAAAAAAAAAAAAAAAEAAAAAaq7YFAAAAABqrtuYAAAAAAAAAAIAAAABAAAAABYShHAADLUtQoDP8TVKBoH6T6B4Gx18rDCbm9J1UXTtAAAACgAAABt0ci1tb2NrLWFuY2hvci5mbHkuZGV2IGF1dGgAAAAAAQAAAEArc3YyWVNaZE9taThVUEZEa2ZPOVVabWl1S0lWRng1dDZycmFUb0VrVC9scXIvOFBtZnU2aTFML291QzhuMk9VAAAAAQAAAADvh3ipE2+SWNcfeGn/xTFwty5ONJyVth6xjiMSD3fbMgAAAAoAAAAPd2ViX2F1dGhfZG9tYWluAAAAAAEAAAAWdHItbW9jay1hbmNob3IuZmx5LmRldgAAAAAAAAAAAAEPd9syAAAAQJvsjhJmdgo4Crq4IH5NGejG0eHrgPdLU23wbp5txEduk03rO8a0FM5lFkYosM+Is5SxUYQLFkrNLY47E6bI2gs=",
  network_passphrase: TESTNET_PASSPHRASE,
} as const;

/** The account the recorded challenge above was issued for. */
export const LIVE_CHALLENGE_ACCOUNT =
  "GALBFBDQAAGLKLKCQDH7CNKKA2A7UT5APANR27FMGCNZXUTVKF2O253G";

/**
 * VERBATIM body of an unauthenticated `GET /sep6/deposit`, HTTP **403**.
 *
 * `SKILL.md` says 401. The live probe says 403, with this `type`.
 */
export const AUTH_REQUIRED_403_BODY = {
  type: "authentication_required",
  error: "missing or invalid SEP-10 token",
} as const;

/**
 * VERBATIM `GET /sep38/price?...&sell_amount=200`, captured 2026-09-19.
 * This endpoint is PUBLIC — the probe sent no Authorization header.
 */
export const SEP38_PRICE_RESPONSE = {
  total_price: "49.0290039",
  price: "48.785078",
  sell_amount: "200.00",
  buy_amount: "4.0792181",
  fee: {
    total: "1.00",
    asset: "iso4217:TRY",
    details: [
      {
        name: "spread",
        description: "50 bps from the USD/TRY mid rate",
        amount: "1.00",
      },
    ],
  },
} as const;

/** `POST /sep38/quote`, documented shape. Expiry is 15 minutes by default. */
export const SEP38_QUOTE_RESPONSE = {
  id: "quote_01M2XFN0DWPFYD87313QP7JY15",
  expires_at: "2026-09-19T19:00:00.000Z",
  total_price: "49.0290039",
  price: "48.785078",
  sell_asset: "iso4217:TRY",
  sell_amount: "200.00",
  buy_asset: `stellar:USDC:${USDC_ISSUER}`,
  buy_amount: "4.0792181",
  fee: { total: "1.00", asset: "iso4217:TRY" },
} as const;

/** Unix seconds for `SEP38_QUOTE_RESPONSE.expires_at`. */
export const QUOTE_EXPIRES_AT_SECONDS = Math.floor(
  Date.parse(SEP38_QUOTE_RESPONSE.expires_at) / 1000,
);

/** `GET /sep6/deposit?...&funding_method=bank_account`. */
export const SEP6_DEPOSIT_RESPONSE = {
  id: "sep_01M2XFR3YY2KMQE9ZB7S8DD4K7",
  instructions: {
    bank_name: {
      value: "TR Mock Bank A.Ş.",
      description: "Bank to send the TRY transfer to",
    },
    bank_account_number: {
      value: "TR050001000000000000000001",
      description: "IBAN to send TRY to",
    },
    external_transfer_memo: {
      value: "TRMA-7K2M-Q9XZ",
      description: "Write this reference in the transfer description",
    },
  },
  how: "Send TRY to the IBAN above with the reference in the description.",
  eta: 5,
  fee_percent: 0.5,
  more_info_url:
    "https://tr-mock-anchor.fly.dev/sep6/tx/sep_01M2XFR3YY2KMQE9ZB7S8DD4K7",
  extra_info: {
    message:
      "This is a sandbox. Simulate the transfer at https://tr-mock-anchor.fly.dev/sep6/tx/sep_01M2XFR3YY2KMQE9ZB7S8DD4K7",
  },
} as const;

const DEPOSIT_ID = SEP6_DEPOSIT_RESPONSE.id;

/**
 * `GET /sep6/transaction?id=…` responses, one per status.
 *
 * Note the WRAPPER: the status lives at `transaction.status`. Reading it off
 * the top level yields `undefined` and makes every deposit look stuck.
 */
export const TX_AWAITING_TRANSFER = {
  transaction: {
    id: DEPOSIT_ID,
    kind: "deposit",
    status: "pending_user_transfer_start",
    more_info_url: SEP6_DEPOSIT_RESPONSE.more_info_url,
    started_at: "2026-09-19T18:44:40.000Z",
    amount_in_asset: "iso4217:TRY",
    amount_out_asset: `stellar:USDC:${USDC_ISSUER}`,
  },
} as const;

export const TX_PENDING_ANCHOR = {
  transaction: {
    id: DEPOSIT_ID,
    kind: "deposit",
    status: "pending_anchor",
    amount_in: "200.00",
    amount_in_asset: "iso4217:TRY",
    amount_fee: "1.00",
    started_at: "2026-09-19T18:44:40.000Z",
  },
} as const;

/**
 * The shared sandbox treasury is empty.
 *
 * `pending_reason` is undocumented in `SKILL.md`. The deposit WAITS here — it
 * does not fail — and a silent spinner would look like a broken demo.
 */
export const TX_TREASURY_LOW = {
  transaction: {
    id: DEPOSIT_ID,
    kind: "deposit",
    status: "pending_anchor",
    pending_reason: "treasury_low",
    amount_in: "200.00",
    amount_in_asset: "iso4217:TRY",
    message: "The sandbox treasury is being refilled; your deposit will settle.",
  },
} as const;

/** Submission being retried. Also absent from `SKILL.md`. */
export const TX_PENDING_STELLAR = {
  transaction: {
    id: DEPOSIT_ID,
    kind: "deposit",
    status: "pending_stellar",
    amount_in: "200.00",
    amount_out: "4.0792181",
  },
} as const;

/** The happy path: a plain payment into an account that already had a trustline. */
export const TX_COMPLETED_PAYMENT = {
  transaction: {
    id: DEPOSIT_ID,
    kind: "deposit",
    status: "completed",
    amount_in: "200.00",
    amount_in_asset: "iso4217:TRY",
    amount_out: "4.0792181",
    amount_out_asset: `stellar:USDC:${USDC_ISSUER}`,
    amount_fee: "1.00",
    stellar_transaction_id:
      "3389e9f0f1a54f9f4e9ad2dbc9a5bb7a1cb6f1a6a0d1a5c4b3e2f1908172635a",
    completed_at: "2026-09-19T18:45:01.000Z",
  },
} as const;

/**
 * The claimable-balance path: `completed`, but the USDC has NOT landed in the
 * wallet yet. The destination had no USDC trustline, so the Anchor created a
 * claimable balance with the participant as sole unconditional claimant.
 */
export const TX_COMPLETED_CLAIMABLE = {
  transaction: {
    id: DEPOSIT_ID,
    kind: "deposit",
    status: "completed",
    amount_in: "200.00",
    amount_out: "4.0792181",
    stellar_transaction_id:
      "9f1c4a2b8d3e5f6071829304a5b6c7d8e9f0a1b2c3d4e5f60718293a4b5c6d7e",
    // 72 hex characters: an 8-character type discriminant plus a 64-character hash.
    claimable_balance_id:
      "000000009f1c4a2b8d3e5f6071829304a5b6c7d8e9f0a1b2c3d4e5f60718293a4b5c6d7e",
    completed_at: "2026-09-19T18:45:03.000Z",
  },
} as const;

/** Legacy defensive case: the wallet did not opt into claimable balances. */
export const TX_PENDING_TRUST = {
  transaction: {
    id: DEPOSIT_ID,
    kind: "deposit",
    status: "pending_trust",
    amount_in: "200.00",
    amount_out: "4.0792181",
    message: "Waiting for a USDC trustline on the destination account.",
  },
} as const;

/** Terminal failure. `refunds` shows the TRY returned to the sandbox balance. */
export const TX_ERROR_WITH_REFUND = {
  transaction: {
    id: DEPOSIT_ID,
    kind: "deposit",
    status: "error",
    message: "Stellar submission failed permanently; the TRY has been refunded.",
    amount_in: "200.00",
    refunds: {
      amount_refunded: "200.00",
      amount_fee: "0.00",
      payments: [{ id: "1", id_type: "external", amount: "200.00", fee: "0.00" }],
    },
  },
} as const;

/** A status this client has never seen. It must degrade, not crash. */
export const TX_UNKNOWN_STATUS = {
  transaction: {
    id: DEPOSIT_ID,
    kind: "deposit",
    status: "pending_something_new",
  },
} as const;

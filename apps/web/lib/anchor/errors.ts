/**
 * One error type for every Anchor failure, with a named recovery action.
 *
 * SYSTEM.md section 17 requires that every failure row has a next action. That
 * is encoded here as `kind` plus `recovery`, so the UI switches on a union
 * instead of matching on message strings.
 */

/** The distinguishable ways an Anchor call can fail. */
export type AnchorErrorKind =
  /** Network never reached the Anchor. Funding is degraded, not broken. */
  | "unreachable"
  /** HTTP 403 `{"type":"authentication_required"}`. NOT 401. */
  | "authentication_required"
  /** The Anchor answered with a 4xx/5xx and its own message. */
  | "server_rejected"
  /** The Anchor answered, but not in a shape this client can use. */
  | "protocol"
  /** A SEP-10 challenge failed validation. Never sign one of these. */
  | "challenge_invalid"
  /** The caller asked for a demo-only endpoint while demo tools are off. */
  | "demo_tools_disabled";

/** The next action a user or the app can take, per SYSTEM.md section 17. */
export type AnchorRecovery =
  | "retry"
  | "reauthenticate"
  | "reprice"
  | "wait"
  | "start_fresh_deposit"
  | "none";

const DEFAULT_RECOVERY: Readonly<Record<AnchorErrorKind, AnchorRecovery>> = {
  unreachable: "retry",
  authentication_required: "reauthenticate",
  server_rejected: "retry",
  protocol: "retry",
  challenge_invalid: "none",
  demo_tools_disabled: "none",
};

export type AnchorErrorOptions = {
  /** HTTP status, when there was one. */
  status?: number;
  /**
   * The Anchor's own error text, UNCHANGED.
   *
   * The Anchor's `/health` and `/sep6/info` disagree about deposit limits, so
   * this client hard-codes no bound and shows the server's rejection verbatim.
   */
  serverMessage?: string;
  /** The `type` discriminator some Anchor errors carry. */
  serverType?: string;
  /** The endpoint that failed, for the debug panel. Never includes a token. */
  endpoint?: string;
  recovery?: AnchorRecovery;
  cause?: unknown;
};

/** Every failure this module raises. */
export class AnchorError extends Error {
  readonly kind: AnchorErrorKind;
  readonly status?: number;
  readonly serverMessage?: string;
  readonly serverType?: string;
  readonly endpoint?: string;
  readonly recovery: AnchorRecovery;

  constructor(
    kind: AnchorErrorKind,
    message: string,
    options: AnchorErrorOptions = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "AnchorError";
    this.kind = kind;
    this.status = options.status;
    this.serverMessage = options.serverMessage;
    this.serverType = options.serverType;
    this.endpoint = options.endpoint;
    this.recovery = options.recovery ?? DEFAULT_RECOVERY[kind];
  }

  /**
   * What to put on screen.
   *
   * The Anchor's own words win whenever it supplied any, because it is the only
   * party that knows its current limits.
   */
  get userMessage(): string {
    if (this.serverMessage && this.serverMessage.trim().length > 0) {
      return this.serverMessage;
    }
    return this.message;
  }
}

export function isAnchorError(value: unknown): value is AnchorError {
  return value instanceof AnchorError;
}

/** True when a failure means "get a fresh SEP-10 token and try once more". */
export function isAuthenticationRequired(value: unknown): boolean {
  return isAnchorError(value) && value.kind === "authentication_required";
}

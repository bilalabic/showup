import { z } from "zod";

const stellarAccountPattern = /^G[A-Z2-7]{55}$/;

const passSchema = z
  .object({
    v: z.literal(1),
    eventId: z.number().int().positive().safe(),
    participant: z.string().regex(stellarAccountPattern),
    issuedAt: z.number().int().nonnegative().safe(),
  })
  .strict();

export const MAX_PASS_BYTES = 512;
export const PASS_STALE_AFTER_SECONDS = 5 * 60;

export type ReservationPass = {
  v: 1;
  eventId: bigint;
  participant: string;
  issuedAt: number;
};

export type QrPayloadErrorKind = "too_large" | "malformed" | "invalid";

export class QrPayloadError extends Error {
  constructor(
    readonly kind: QrPayloadErrorKind,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "QrPayloadError";
  }
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export function encodePass(
  pass: Omit<ReservationPass, "v">,
): string {
  const eventId = Number(pass.eventId);
  const parsed = passSchema.safeParse({
    v: 1,
    eventId,
    participant: pass.participant,
    issuedAt: pass.issuedAt,
  });

  if (!parsed.success || BigInt(eventId) !== pass.eventId) {
    throw new QrPayloadError("invalid", "The reservation pass is invalid.");
  }

  const encoded = JSON.stringify(parsed.data);
  if (byteLength(encoded) > MAX_PASS_BYTES) {
    throw new QrPayloadError("too_large", "The reservation pass is too large.");
  }

  return encoded;
}

export function decodePass(raw: string): ReservationPass {
  if (raw.length > MAX_PASS_BYTES || byteLength(raw) > MAX_PASS_BYTES) {
    throw new QrPayloadError("too_large", "The QR payload is too large.");
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch (cause) {
    throw new QrPayloadError("malformed", "The QR code is not valid JSON.", {
      cause,
    });
  }

  const parsed = passSchema.safeParse(decoded);
  if (!parsed.success) {
    throw new QrPayloadError(
      "invalid",
      "The QR code is not a ShowUp reservation pass.",
      { cause: parsed.error },
    );
  }

  return {
    ...parsed.data,
    eventId: BigInt(parsed.data.eventId),
  };
}

/** A display-only freshness hint. It never grants or blocks check-in. */
export function isPassStale(
  pass: ReservationPass,
  nowSeconds: number,
  maxAgeSeconds = PASS_STALE_AFTER_SECONDS,
): boolean {
  return pass.issuedAt > nowSeconds || nowSeconds - pass.issuedAt > maxAgeSeconds;
}

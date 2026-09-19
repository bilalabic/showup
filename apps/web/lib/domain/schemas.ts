/**
 * Zod schemas for the create-event form.
 *
 * These mirror, one for one, the preconditions `create_event` enforces on
 * chain (SYSTEM.md section 7). The contract remains authoritative — these
 * schemas exist so the user is told what is wrong before a signature is spent,
 * not so the app can decide whether the call is allowed.
 *
 * The length bounds are the contract's own `MAX_TITLE_LENGTH` /
 * `MAX_VENUE_LENGTH` from `contracts/showup-bond/src/types.rs`, measured in
 * UTF-8 bytes because that is what Soroban's `String::len()` returns.
 */

import { z } from "zod";

import { TOTAL_BPS, toStroops } from "./amounts";
import type { CreateEventInput } from "./types";

/** `MAX_TITLE_LENGTH` in contracts/showup-bond/src/types.rs. */
export const MAX_TITLE_LENGTH = 96;

/** `MAX_VENUE_LENGTH` in contracts/showup-bond/src/types.rs. */
export const MAX_VENUE_LENGTH = 160;

const STELLAR_ACCOUNT_PATTERN = /^G[A-Z2-7]{55}$/;

const utf8Encoder = new TextEncoder();

/** UTF-8 byte length, which is what the contract's length check measures. */
export function utf8ByteLength(value: string): number {
  return utf8Encoder.encode(value).length;
}

function boundedText(label: string, maxBytes: number) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .refine(
      (value) => utf8ByteLength(value) <= maxBytes,
      `${label} must be at most ${maxBytes} bytes long.`,
    );
}

const organizerAddress = z
  .string()
  .trim()
  .regex(STELLAR_ACCOUNT_PATTERN, "Organizer must be a Stellar account (G...).");

const unixSeconds = z
  .number()
  .int("Timestamps must be whole seconds.")
  .nonnegative("Timestamps must not be negative.");

const basisPoints = z
  .number()
  .int("Basis points must be a whole number.")
  .min(0, "Basis points must be between 0 and 10000.")
  .max(TOTAL_BPS, "Basis points must be between 0 and 10000.");

/**
 * The authoritative schema over the application-shaped `CreateEventInput`.
 *
 * Enforces every `create_event` precondition: positive bond, positive capacity,
 * `organizer_bps + community_bps == 10_000`,
 * `cancellation_deadline <= checkin_start <= checkin_deadline` and
 * `checkin_start <= start_time <= checkin_deadline`, plus the title and venue
 * length bounds.
 */
export const createEventInputSchema = z
  .object({
    organizer: organizerAddress,
    title: boundedText("Title", MAX_TITLE_LENGTH),
    venue: boundedText("Venue", MAX_VENUE_LENGTH),
    bondAmount: z.bigint(),
    capacity: z.number().int("Capacity must be a whole number."),
    startTime: unixSeconds,
    checkinStart: unixSeconds,
    checkinDeadline: unixSeconds,
    cancellationDeadline: unixSeconds,
    organizerBps: basisPoints,
    communityBps: basisPoints,
  })
  .superRefine((value, ctx) => {
    if (value.bondAmount <= 0n) {
      ctx.addIssue({
        code: "custom",
        path: ["bondAmount"],
        message: "Bond must be greater than zero.",
      });
    }

    if (value.capacity <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["capacity"],
        message: "Capacity must be greater than zero.",
      });
    }

    if (value.organizerBps + value.communityBps !== TOTAL_BPS) {
      ctx.addIssue({
        code: "custom",
        path: ["communityBps"],
        message: "Organizer and community shares must add up to exactly 10000 bps.",
      });
    }

    if (value.cancellationDeadline > value.checkinStart) {
      ctx.addIssue({
        code: "custom",
        path: ["cancellationDeadline"],
        message: "Cancellation deadline must not be after check-in opens.",
      });
    }

    if (value.checkinStart > value.checkinDeadline) {
      ctx.addIssue({
        code: "custom",
        path: ["checkinDeadline"],
        message: "Check-in must open before it closes.",
      });
    }

    if (
      value.startTime < value.checkinStart ||
      value.startTime > value.checkinDeadline
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["startTime"],
        message: "Start time must fall inside the check-in window.",
      });
    }
  });

const displayAmountField = z
  .string()
  .trim()
  .refine((value) => {
    try {
      toStroops(value);
      return true;
    } catch {
      return false;
    }
  }, "Enter an amount with at most 7 decimal places, for example 25.")
  .transform((value) => toStroops(value));

const wholeNumberField = (label: string) =>
  z
    .string()
    .trim()
    .regex(/^\d+$/, `${label} must be a whole number.`)
    .transform((value) => Number(value));

const isoDateTimeField = (label: string) =>
  z
    .string()
    .trim()
    .refine(
      (value) => Number.isFinite(Date.parse(value)),
      `${label} must be a valid date and time.`,
    )
    .transform((value) => Math.floor(Date.parse(value) / 1000));

/**
 * Schema for the raw create-event form, where amounts and counts arrive as
 * strings and datetimes as ISO strings. It parses into the same
 * `CreateEventInput` and then runs every rule in `createEventInputSchema`.
 */
export const createEventFormSchema = z
  .object({
    organizer: organizerAddress,
    title: boundedText("Title", MAX_TITLE_LENGTH),
    venue: boundedText("Venue", MAX_VENUE_LENGTH),
    bondAmount: displayAmountField,
    capacity: wholeNumberField("Capacity"),
    startTime: isoDateTimeField("Start time"),
    checkinStart: isoDateTimeField("Check-in start"),
    checkinDeadline: isoDateTimeField("Check-in deadline"),
    cancellationDeadline: isoDateTimeField("Cancellation deadline"),
    organizerBps: wholeNumberField("Organizer share"),
    communityBps: wholeNumberField("Community share"),
  })
  .pipe(createEventInputSchema);

/** Raw shape the create-event form collects, before parsing. */
export type CreateEventFormValues = z.input<typeof createEventFormSchema>;

/** Parsed output of {@link createEventInputSchema}; structurally a `CreateEventInput`. */
export type CreateEventParsed = CreateEventInput &
  z.output<typeof createEventInputSchema>;

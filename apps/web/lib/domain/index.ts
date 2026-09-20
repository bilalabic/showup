/**
 * `lib/domain` — layer 0.
 *
 * Types and pure functions shared by every other module. This module imports
 * NOTHING from any other `lib/*` module, which is what keeps the dependency
 * graph acyclic. No network calls, no `Date.now()`, no React, no Stellar SDK.
 */

export type {
  ContractConfig,
  CreateEventInput,
  EventStatus,
  EventView,
  ReservationStatus,
  ReservationView,
} from "./types";

export {
  AMOUNT_DECIMALS,
  ONE_UNIT_IN_STROOPS,
  TOTAL_BPS,
  fromStroops,
  splitByBps,
  toStroops,
} from "./amounts";

export {
  canCancelReservation,
  canCheckIn,
  canClaimCancelledRefund,
  canReserve,
  canSettleNoShow,
} from "./eligibility";

export {
  ContractErrorCode,
  contractErrorMessage,
  contractErrorName,
  isContractErrorCode,
  transactionHashFromError,
  userFacingError,
} from "./errors";

export {
  MAX_TITLE_LENGTH,
  MAX_VENUE_LENGTH,
  createEventFormSchema,
  createEventInputSchema,
  utf8ByteLength,
} from "./schemas";

export type { CreateEventFormValues, CreateEventParsed } from "./schemas";

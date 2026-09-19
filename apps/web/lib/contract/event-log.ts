/**
 * Contract-event indexing for the organizer view.
 *
 * RPC events are a bounded index, not financial truth. They identify the
 * participants whose reservations must be read back from contract storage.
 * No SDK or XDR type crosses this module's public boundary.
 */

import { rpc } from "@stellar/stellar-sdk";

import type { ReservationView } from "../domain";
import { getRpc } from "../stellar";
import { CONTRACT_ID, getReadClient } from "./client";
import { translateContractError } from "./errors";
import { toReservationView } from "./mappers";

const EVENT_PAGE_SIZE = 100;

type EventLogMetadata = {
  id: string;
  ledger: number;
  ledgerClosedAt: string;
  transactionIndex: number;
  operationIndex: number;
  txHash: string;
};

export type ShowUpContractEvent =
  | (EventLogMetadata & {
      kind: "event_created";
      eventId: bigint;
      organizer: string;
      bondAmount: bigint;
      capacity: number;
    })
  | (EventLogMetadata & {
      kind:
        | "bond_locked"
        | "reservation_cancelled"
        | "checked_in"
        | "refund_claimed";
      eventId: bigint;
      participant: string;
      amount: bigint;
    })
  | (EventLogMetadata & {
      kind: "event_cancelled";
      eventId: bigint;
      organizer: string;
    })
  | (EventLogMetadata & {
      kind: "no_show_settled";
      eventId: bigint;
      participant: string;
      organizerAmount: bigint;
      communityAmount: bigint;
    });

export type EventLogRetention = {
  oldestLedger: number;
  latestLedger: number;
  oldestLedgerCloseTime: string;
  latestLedgerCloseTime: string;
};

export type EventLogSnapshot = {
  entries: ShowUpContractEvent[];
  /**
   * True only when EventCreated is still present in the provider's retained
   * history. False means earlier BondLocked events may also be unavailable.
   */
  historyComplete: boolean;
  retention: EventLogRetention;
};

export type EventReservationList = {
  reservations: ReservationView[];
  /**
   * False when the list may be missing rows — either the RPC event window no
   * longer reaches this event's creation, or a known participant's reservation
   * could not be read back.
   */
  historyComplete: boolean;
  /** How many known participants could not be read from contract storage. */
  unreadable: number;
  retention: EventLogRetention;
};

type ParsedEvent = {
  name: string;
  data: Record<string, unknown>;
};

function requireBigInt(data: Record<string, unknown>, field: string): bigint {
  const value = data[field];
  if (typeof value !== "bigint") {
    throw new Error(`Contract event field ${field} is not a bigint.`);
  }
  return value;
}

function requireNumber(data: Record<string, unknown>, field: string): number {
  const value = data[field];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Contract event field ${field} is not a finite number.`);
  }
  return value;
}

function requireString(data: Record<string, unknown>, field: string): string {
  const value = data[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Contract event field ${field} is not a non-empty string.`);
  }
  return value;
}

function toMetadata(event: rpc.Api.EventResponse): EventLogMetadata {
  return {
    id: event.id,
    ledger: event.ledger,
    ledgerClosedAt: event.ledgerClosedAt,
    transactionIndex: event.transactionIndex,
    operationIndex: event.operationIndex,
    txHash: event.txHash,
  };
}

function mapEvent(
  event: rpc.Api.EventResponse,
  parsed: ParsedEvent,
): ShowUpContractEvent | null {
  const data = parsed.data;
  const metadata = toMetadata(event);

  switch (parsed.name) {
    case "EventCreated":
      return {
        ...metadata,
        kind: "event_created",
        eventId: requireBigInt(data, "event_id"),
        organizer: requireString(data, "organizer"),
        bondAmount: requireBigInt(data, "bond_amount"),
        capacity: requireNumber(data, "capacity"),
      };
    case "BondLocked":
      return {
        ...metadata,
        kind: "bond_locked",
        eventId: requireBigInt(data, "event_id"),
        participant: requireString(data, "participant"),
        amount: requireBigInt(data, "amount"),
      };
    case "ReservationCancelled":
      return {
        ...metadata,
        kind: "reservation_cancelled",
        eventId: requireBigInt(data, "event_id"),
        participant: requireString(data, "participant"),
        amount: requireBigInt(data, "amount"),
      };
    case "CheckedIn":
      return {
        ...metadata,
        kind: "checked_in",
        eventId: requireBigInt(data, "event_id"),
        participant: requireString(data, "participant"),
        amount: requireBigInt(data, "amount"),
      };
    case "EventCancelled":
      return {
        ...metadata,
        kind: "event_cancelled",
        eventId: requireBigInt(data, "event_id"),
        organizer: requireString(data, "organizer"),
      };
    case "RefundClaimed":
      return {
        ...metadata,
        kind: "refund_claimed",
        eventId: requireBigInt(data, "event_id"),
        participant: requireString(data, "participant"),
        amount: requireBigInt(data, "amount"),
      };
    case "NoShowSettled":
      return {
        ...metadata,
        kind: "no_show_settled",
        eventId: requireBigInt(data, "event_id"),
        participant: requireString(data, "participant"),
        organizerAmount: requireBigInt(data, "organizer_amount"),
        communityAmount: requireBigInt(data, "community_amount"),
      };
    default:
      // A future contract version may add events that this UI does not know.
      return null;
  }
}

function eventIdTopic(eventId: bigint): string {
  const filter = getReadClient().spec.eventTopicFilter("BondLocked", {
    event_id: eventId,
  });
  const encodedEventId = filter[1];

  if (typeof encodedEventId !== "string" || encodedEventId === "*") {
    throw new Error("The generated contract spec did not encode event_id.");
  }
  return encodedEventId;
}

/**
 * Read the complete retained event history for one event.
 *
 * Every ShowUp event currently has three topics in the stable form
 * `[event name, event_id, address]`. A wildcard name avoids exceeding the RPC
 * limit of five topic alternatives while the encoded id keeps the query
 * server-side and event-specific.
 */
export async function readEventLog(eventId: bigint): Promise<EventLogSnapshot> {
  const server = getRpc();
  const health = await server.getHealth();
  const topics = [["*", eventIdTopic(eventId), "*"]];
  const filters: rpc.Api.EventFilter[] = [
    { type: "contract", contractIds: [CONTRACT_ID], topics },
  ];

  const rawEvents: rpc.Api.EventResponse[] = [];
  let cursor: string | undefined;
  let retention: EventLogRetention | undefined;

  while (true) {
    const response = cursor
      ? await server.getEvents({ filters, cursor, limit: EVENT_PAGE_SIZE })
      : await server.getEvents({
          filters,
          startLedger: health.oldestLedger,
          limit: EVENT_PAGE_SIZE,
        });

    retention = {
      oldestLedger: response.oldestLedger,
      latestLedger: response.latestLedger,
      oldestLedgerCloseTime: response.oldestLedgerCloseTime,
      latestLedgerCloseTime: response.latestLedgerCloseTime,
    };
    rawEvents.push(...response.events);

    if (response.events.length < EVENT_PAGE_SIZE) {
      break;
    }
    if (response.cursor === cursor) {
      throw new Error("Stellar RPC returned the same event cursor twice.");
    }
    cursor = response.cursor;
  }

  if (!retention) {
    throw new Error("Stellar RPC returned no event-log response.");
  }

  const spec = getReadClient().spec;
  const entries: ShowUpContractEvent[] = [];
  for (const rawEvent of rawEvents) {
    if (!rawEvent.inSuccessfulContractCall) {
      continue;
    }
    const parsed = spec.parseEvent(rawEvent.topic, rawEvent.value);
    if (!parsed) {
      continue;
    }
    const mapped = mapEvent(rawEvent, parsed);
    if (mapped && mapped.eventId === eventId) {
      entries.push(mapped);
    }
  }

  return {
    entries,
    historyComplete: entries.some((entry) => entry.kind === "event_created"),
    retention,
  };
}

async function readCurrentReservation(
  eventId: bigint,
  participant: string,
): Promise<ReservationView | null> {
  try {
    const tx = await getReadClient().get_reservation({
      event_id: eventId,
      participant,
    });
    const simulation = tx.simulation;

    if (!simulation) {
      throw new Error("The reservation read was not simulated.");
    }
    if (rpc.Api.isSimulationError(simulation)) {
      throw new Error(`Contract simulation failed: ${simulation.error}`);
    }
    if (rpc.Api.isSimulationRestore(simulation)) {
      throw new Error(
        "This reservation has expired on-chain and must be restored before it can be used.",
      );
    }

    return tx.result ? toReservationView(tx.result) : null;
  } catch (error) {
    throw translateContractError(error);
  }
}

/**
 * Enumerate an event's known participants from BondLocked, then re-read every
 * reservation so contract storage, rather than historical events, supplies the
 * current status.
 */
export async function listEventReservations(
  eventId: bigint,
): Promise<EventReservationList> {
  const log = await readEventLog(eventId);
  const participants = new Set<string>();

  for (const entry of log.entries) {
    if (entry.kind === "bond_locked") {
      participants.add(entry.participant);
    }
  }

  // One unreadable participant must not cost the organizer the whole list. A
  // reservation can be absent or need restoring for reasons that say nothing
  // about the others, and `historyComplete` already exists to report a partial
  // view honestly rather than failing the page.
  const settled = await Promise.allSettled(
    Array.from(participants, (participant) =>
      readCurrentReservation(eventId, participant),
    ),
  );

  const reservations: ReservationView[] = [];
  let unreadable = 0;

  for (const outcome of settled) {
    if (outcome.status === "fulfilled" && outcome.value) {
      reservations.push(outcome.value);
    } else {
      unreadable += 1;
    }
  }

  return {
    reservations,
    historyComplete: log.historyComplete && unreadable === 0,
    unreadable,
    retention: log.retention,
  };
}

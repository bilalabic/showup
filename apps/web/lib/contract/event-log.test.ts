import type { rpc } from "@stellar/stellar-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getRpc } from "../stellar";
import { getReadClient } from "./client";
import { listEventReservations, readEventLog } from "./event-log";

vi.mock("../stellar", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../stellar")>()),
  getRpc: vi.fn(),
}));

vi.mock("./client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./client")>()),
  getReadClient: vi.fn(),
}));

const ORGANIZER =
  "GD6UTIMTKBSAP7JULBUUOWT2G4CQBG6TU5FV24OXD5H4X5GJBCZTCK6E";
const PARTICIPANT_A =
  "GALBFBDQAAGLKLKCQDH7CNKKA2A7UT5APANR27FMGCNZXUTVKF2O253G";
const PARTICIPANT_B =
  "GBOU4JVHFA4RDE6HJKUIJ3TT2K4RXODATBUQZG2VKXEKWYRS7YGF3HOP";

type ParsedMarker = {
  name: string;
  data: Record<string, unknown>;
};

function rawEvent(
  parsed: ParsedMarker | undefined,
  overrides: Partial<rpc.Api.EventResponse> = {},
): rpc.Api.EventResponse {
  return {
    id: overrides.id ?? "0000000000000000001-0000000000",
    type: "contract",
    ledger: overrides.ledger ?? 150,
    ledgerClosedAt: overrides.ledgerClosedAt ?? "2026-09-19T20:00:00Z",
    transactionIndex: overrides.transactionIndex ?? 1,
    operationIndex: overrides.operationIndex ?? 0,
    inSuccessfulContractCall: overrides.inSuccessfulContractCall ?? true,
    txHash: overrides.txHash ?? "ab".repeat(32),
    topic: [],
    value: { parsed } as unknown as rpc.Api.EventResponse["value"],
  };
}

function eventsResponse(
  events: rpc.Api.EventResponse[],
  cursor = "cursor-final",
): rpc.Api.GetEventsResponse {
  return {
    events,
    cursor,
    oldestLedger: 100,
    latestLedger: 200,
    oldestLedgerCloseTime: "2026-09-19T19:00:00Z",
    latestLedgerCloseTime: "2026-09-19T21:00:00Z",
  };
}

function setup(options?: {
  pages?: rpc.Api.GetEventsResponse[];
  reservationFor?: (participant: string) => unknown;
}) {
  const eventTopicFilter = vi.fn(() => [
    "encoded-bond-locked",
    "encoded-event-id",
    "*",
  ]);
  const parseEvent = vi.fn(
    (_topics: unknown, value: unknown) =>
      (value as { parsed?: ParsedMarker }).parsed,
  );
  const getReservation = vi.fn(async ({ participant }: { participant: string }) => ({
    simulation: {},
    result: options?.reservationFor?.(participant) ?? null,
  }));
  const readClient = {
    spec: { eventTopicFilter, parseEvent },
    get_reservation: getReservation,
  };
  vi.mocked(getReadClient).mockReturnValue(
    readClient as unknown as ReturnType<typeof getReadClient>,
  );

  const pages = options?.pages ?? [eventsResponse([])];
  const getEvents = vi.fn();
  for (const page of pages) {
    getEvents.mockResolvedValueOnce(page);
  }
  const getHealth = vi.fn(async () => ({
    status: "healthy" as const,
    oldestLedger: 100,
    latestLedger: 200,
    ledgerRetentionWindow: 101,
  }));
  vi.mocked(getRpc).mockReturnValue({
    getHealth,
    getEvents,
  } as unknown as ReturnType<typeof getRpc>);

  return { eventTopicFilter, getEvents, getHealth, getReservation, parseEvent };
}

describe("readEventLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses one wildcard topic row and maps every declared contract event", async () => {
    const events = [
      rawEvent({
        name: "EventCreated",
        data: {
          event_id: 7n,
          organizer: ORGANIZER,
          bond_amount: 25_000_000n,
          capacity: 20,
        },
      }),
      rawEvent({
        name: "BondLocked",
        data: { event_id: 7n, participant: PARTICIPANT_A, amount: 25_000_000n },
      }),
      rawEvent({
        name: "ReservationCancelled",
        data: { event_id: 7n, participant: PARTICIPANT_A, amount: 25_000_000n },
      }),
      rawEvent({
        name: "CheckedIn",
        data: { event_id: 7n, participant: PARTICIPANT_A, amount: 25_000_000n },
      }),
      rawEvent({
        name: "EventCancelled",
        data: { event_id: 7n, organizer: ORGANIZER },
      }),
      rawEvent({
        name: "RefundClaimed",
        data: { event_id: 7n, participant: PARTICIPANT_A, amount: 25_000_000n },
      }),
      rawEvent({
        name: "NoShowSettled",
        data: {
          event_id: 7n,
          participant: PARTICIPANT_B,
          organizer_amount: 20_000_000n,
          community_amount: 5_000_000n,
        },
      }),
    ];
    const { eventTopicFilter, getEvents } = setup({
      pages: [eventsResponse(events)],
    });

    const result = await readEventLog(7n);

    expect(eventTopicFilter).toHaveBeenCalledWith("BondLocked", {
      event_id: 7n,
    });
    expect(getEvents).toHaveBeenCalledWith({
      filters: [
        expect.objectContaining({
          type: "contract",
          topics: [["*", "encoded-event-id", "*"]],
        }),
      ],
      startLedger: 100,
      limit: 100,
    });
    expect(result.entries.map((entry) => entry.kind)).toEqual([
      "event_created",
      "bond_locked",
      "reservation_cancelled",
      "checked_in",
      "event_cancelled",
      "refund_claimed",
      "no_show_settled",
    ]);
    expect(result.entries[0]).toMatchObject({
      eventId: 7n,
      bondAmount: 25_000_000n,
      capacity: 20,
      txHash: "ab".repeat(32),
    });
    expect(result.entries[6]).toMatchObject({
      organizerAmount: 20_000_000n,
      communityAmount: 5_000_000n,
    });
    expect(result.historyComplete).toBe(true);
    expect(result.retention).toEqual({
      oldestLedger: 100,
      latestLedger: 200,
      oldestLedgerCloseTime: "2026-09-19T19:00:00Z",
      latestLedgerCloseTime: "2026-09-19T21:00:00Z",
    });
  });

  it("continues full pages with only the response cursor", async () => {
    const fullPage = Array.from({ length: 100 }, (_, index) =>
      rawEvent(undefined, { id: `unknown-${index}` }),
    );
    const finalEvent = rawEvent({
      name: "BondLocked",
      data: { event_id: 3n, participant: PARTICIPANT_A, amount: 10_000_000n },
    });
    const { getEvents } = setup({
      pages: [
        eventsResponse(fullPage, "cursor-page-1"),
        eventsResponse([finalEvent], "cursor-page-2"),
      ],
    });

    const result = await readEventLog(3n);

    expect(getEvents).toHaveBeenCalledTimes(2);
    expect(getEvents.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({ cursor: "cursor-page-1", limit: 100 }),
    );
    expect(getEvents.mock.calls[1]?.[0]).not.toHaveProperty("startLedger");
    expect(result.entries).toHaveLength(1);
    expect(result.historyComplete).toBe(false);
  });

  it("ignores failed calls, unknown events and mismatched event ids", async () => {
    const failed = rawEvent(
      {
        name: "EventCreated",
        data: {
          event_id: 4n,
          organizer: ORGANIZER,
          bond_amount: 1n,
          capacity: 1,
        },
      },
      { inSuccessfulContractCall: false },
    );
    const unknown = rawEvent({ name: "FutureEvent", data: { event_id: 4n } });
    const wrongId = rawEvent({
      name: "BondLocked",
      data: { event_id: 99n, participant: PARTICIPANT_A, amount: 1n },
    });
    setup({ pages: [eventsResponse([failed, unknown, wrongId])] });

    await expect(readEventLog(4n)).resolves.toMatchObject({
      entries: [],
      historyComplete: false,
    });
  });

  it("rejects a known event whose decoded fields have the wrong type", async () => {
    setup({
      pages: [
        eventsResponse([
          rawEvent({
            name: "BondLocked",
            data: { event_id: 5n, participant: PARTICIPANT_A, amount: 25 },
          }),
        ]),
      ],
    });

    await expect(readEventLog(5n)).rejects.toThrow(/amount.*bigint/i);
  });
});

describe("listEventReservations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deduplicates BondLocked participants and re-fetches current state", async () => {
    const eventCreated = rawEvent({
      name: "EventCreated",
      data: {
        event_id: 8n,
        organizer: ORGANIZER,
        bond_amount: 25_000_000n,
        capacity: 20,
      },
    });
    const lockA = rawEvent({
      name: "BondLocked",
      data: { event_id: 8n, participant: PARTICIPANT_A, amount: 25_000_000n },
    });
    const lockB = rawEvent({
      name: "BondLocked",
      data: { event_id: 8n, participant: PARTICIPANT_B, amount: 25_000_000n },
    });
    const checkedIn = rawEvent({
      name: "CheckedIn",
      data: { event_id: 8n, participant: PARTICIPANT_A, amount: 25_000_000n },
    });
    const { getReservation } = setup({
      pages: [eventsResponse([eventCreated, lockA, lockA, lockB, checkedIn])],
      reservationFor: (participant) => ({
        event_id: 8n,
        participant,
        amount: 25_000_000n,
        reserved_at: 1_800_000_000n,
        status:
          participant === PARTICIPANT_A
            ? { tag: "Attended", values: undefined }
            : { tag: "Locked", values: undefined },
      }),
    });

    const result = await listEventReservations(8n);

    expect(getReservation).toHaveBeenCalledTimes(2);
    expect(getReservation).toHaveBeenNthCalledWith(1, {
      event_id: 8n,
      participant: PARTICIPANT_A,
    });
    expect(getReservation).toHaveBeenNthCalledWith(2, {
      event_id: 8n,
      participant: PARTICIPANT_B,
    });
    expect(result.reservations.map((reservation) => reservation.status)).toEqual([
      "attended",
      "locked",
    ]);
    expect(result.historyComplete).toBe(true);
  });

  // A reservation that cannot be read back must never vanish without a trace —
  // but it must not cost the organizer the rest of the list either. It is
  // reported through `unreadable` and by clearing `historyComplete`.
  it("reports a BondLocked reservation missing from storage instead of dropping it", async () => {
    setup({
      pages: [
        eventsResponse([
          rawEvent({
            name: "BondLocked",
            data: { event_id: 9n, participant: PARTICIPANT_A, amount: 1n },
          }),
        ]),
      ],
      reservationFor: () => null,
    });

    const result = await listEventReservations(9n);

    expect(result.reservations).toEqual([]);
    expect(result.unreadable).toBe(1);
    expect(result.historyComplete).toBe(false);
  });

  it("keeps readable reservations when one participant cannot be read", async () => {
    setup({
      pages: [
        eventsResponse([
          rawEvent({
            name: "BondLocked",
            data: { event_id: 9n, participant: PARTICIPANT_A, amount: 1n },
          }),
          rawEvent({
            name: "BondLocked",
            data: { event_id: 9n, participant: PARTICIPANT_B, amount: 1n },
          }),
        ]),
      ],
      reservationFor: (participant) =>
        participant === PARTICIPANT_A
          ? {
              event_id: 9n,
              participant,
              amount: 1n,
              reserved_at: 1_800_000_000n,
              status: { tag: "Locked", values: undefined },
            }
          : null,
    });

    const result = await listEventReservations(9n);

    expect(result.reservations).toHaveLength(1);
    expect(result.reservations[0]?.participant).toBe(PARTICIPANT_A);
    expect(result.unreadable).toBe(1);
    expect(result.historyComplete).toBe(false);
  });
});

/**
 * `lib/contract` — layer 3. The typed facade over `showup-bond`.
 *
 * Wraps the generated bindings, supplies the contract id, and converts between
 * contract scalars and `lib/domain` types. Reads are simulation-only and need
 * no signer. Writes take a `Signer` as a parameter, so nothing here imports the
 * Wallets Kit or `lib/wallet`.
 *
 * This module may SURFACE a contract error but never pre-judges a financial
 * rule the contract owns. Contract errors are mapped by code, never by string.
 */

import { rpc, xdr } from "@stellar/stellar-sdk";
import type { AssembledTransaction, Result } from "@stellar/stellar-sdk/contract";

import type {
  ContractConfig,
  CreateEventInput,
  EventView,
  ReservationView,
} from "../domain";
import { extractContractErrorCode } from "../stellar";
import { getReadClient, getWriteClient } from "./client";
import { ContractError, translateContractError } from "./errors";
import {
  toContractConfig,
  toCreateEventArgs,
  toEventView,
  toReservationView,
} from "./mappers";

/**
 * The on-chain transaction machine (SYSTEM.md section 16).
 *
 * `simulating` is a distinct phase, not an implementation detail: it is where
 * deadline and capacity errors are caught BEFORE the user is asked to sign.
 * Signing is not success and submission is not success — only `confirming`
 * resolving does the write count.
 */
export type TxPhase =
  | "simulating"
  | "awaiting_signature"
  | "submitting"
  | "confirming";

export type { Signer } from "./client";
export { CONTRACT_ID, NETWORK_PASSPHRASE } from "./client";
export { ContractError } from "./errors";
export type { CreateEventInput } from "../domain";
export { listEventReservations, readEventLog } from "./event-log";
export type {
  EventLogRetention,
  EventLogSnapshot,
  EventReservationList,
  ShowUpContractEvent,
} from "./event-log";

import type { Signer } from "./client";

const NOT_SIMULATED =
  "The contract call was never simulated, so there is nothing to read.";

const RESTORE_REQUIRED =
  "This contract entry has expired on-chain and must be restored before it can be used.";

/**
 * Read the simulated value off an assembled transaction.
 *
 * The check order is `isSimulationError` -> `isSimulationRestore` -> success,
 * and it must stay that way: in `@stellar/stellar-sdk` 17.x
 * `isSimulationSuccess` returns `true` for a restore response, because
 * `SimulateTransactionRestoreResponse extends SimulateTransactionSuccessResponse`.
 */
function readSimulation<T>(tx: AssembledTransaction<T>): T {
  const simulation = tx.simulation;

  if (!simulation) {
    throw new Error(NOT_SIMULATED);
  }

  if (rpc.Api.isSimulationError(simulation)) {
    const code = extractContractErrorCode(simulation.error);
    if (code !== null) {
      throw new ContractError(code, { cause: simulation.error });
    }
    throw new Error(`Contract simulation failed: ${simulation.error}`);
  }

  if (rpc.Api.isSimulationRestore(simulation)) {
    throw new Error(RESTORE_REQUIRED);
  }

  return tx.result;
}

/** Lowercase hex, for a transaction hash the SDK hands back as raw bytes. */
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

// The SDK builds its own error table from the contract spec rather than from
// the bindings' `Errors` export, so the value it hands back is never identity-
// equal to one of those objects. The real signal is the base64 ScError the spec
// decoder puts in `message`.
function contractCodeFromResultError(error: unknown): number | null {
  const message = (error as { message?: unknown } | null)?.message;
  if (typeof message !== "string") return null;

  try {
    const parsed = xdr.ScError.fromXDR(message, "base64");
    return parsed.type === "sceContract" ? parsed.contractCode : null;
  } catch {
    return null;
  }
}

/** Unwrap a Rust `Result` returned by the bindings without losing its code. */
function unwrapResult<T>(result: Result<T>): T {
  if (result.isOk()) {
    return result.unwrap();
  }

  const returned = result.unwrapErr();
  const code = contractCodeFromResultError(returned);
  if (code !== null) {
    throw new ContractError(code, { cause: returned });
  }

  throw new Error(`The contract returned an error: ${returned.message}`);
}

function isNotFound(error: unknown): boolean {
  return error instanceof ContractError && error.code === 1;
}

async function executeVoidWrite(
  build: () => Promise<AssembledTransaction<Result<void>>>,
  onPhase?: (phase: TxPhase) => void,
): Promise<{ hash: string }> {
  onPhase?.("simulating");

  let tx: AssembledTransaction<Result<void>>;
  try {
    tx = await build();
    unwrapResult(readSimulation(tx));
  } catch (error) {
    throw translateContractError(error);
  }

  try {
    onPhase?.("awaiting_signature");
    await tx.sign();

    onPhase?.("submitting");
    const sent = await tx.send({
      onSubmitted: () => onPhase?.("confirming"),
    });
    unwrapResult(sent.result);

    const hash =
      sent.sendTransactionResponse?.hash ??
      (tx.signed ? toHex(tx.signed.hash()) : "");
    if (!hash) {
      throw new Error("The transaction was confirmed without a transaction hash.");
    }
    return { hash };
  } catch (error) {
    throw translateContractError(error);
  }
}

/** The pinned settlement token and community pool, from instance storage. */
export async function getConfig(): Promise<ContractConfig> {
  try {
    const tx = await getReadClient().get_config();
    return toContractConfig(readSimulation(tx));
  } catch (error) {
    throw translateContractError(error);
  }
}

/**
 * The monotonic event id counter — and, because there is no off-chain index by
 * design, the frontend's enumeration bound.
 */
export async function getEventCount(): Promise<number> {
  try {
    const tx = await getReadClient().get_event_count();
    return Number(readSimulation(tx));
  } catch (error) {
    throw translateContractError(error);
  }
}

/** A single event. Rejects with a `ContractError` (code 1) when it does not exist. */
export async function getEvent(eventId: bigint): Promise<EventView> {
  try {
    const tx = await getReadClient().get_event({ event_id: eventId });
    return toEventView(unwrapResult(readSimulation(tx)));
  } catch (error) {
    throw translateContractError(error);
  }
}

/**
 * Every event the contract knows about, newest first.
 *
 * There is no database and no off-chain index — by design — so this enumerates
 * ids `1..get_event_count()`. Ids that no longer read back (archived or
 * missing) are skipped rather than failing the whole list.
 */
export async function listEvents(opts?: {
  limit?: number;
}): Promise<EventView[]> {
  const count = await getEventCount();
  if (count <= 0) {
    return [];
  }

  const limit = opts?.limit;
  const take =
    typeof limit === "number" && Number.isFinite(limit)
      ? Math.max(0, Math.min(Math.floor(limit), count))
      : count;

  if (take === 0) {
    return [];
  }

  // Newest first: ids are assigned in ascending order by `create_event`.
  const ids: bigint[] = [];
  for (let id = count; id > count - take; id -= 1) {
    ids.push(BigInt(id));
  }

  const settled = await Promise.all(
    ids.map(async (id) => {
      try {
        return await getEvent(id);
      } catch (error) {
        if (isNotFound(error)) {
          return null;
        }
        throw error;
      }
    }),
  );

  return settled.filter((event): event is EventView => event !== null);
}

/** A participant's reservation for an event, or `null` when there is none. */
export async function getReservation(
  eventId: bigint,
  participant: string,
): Promise<ReservationView | null> {
  try {
    const tx = await getReadClient().get_reservation({
      event_id: eventId,
      participant,
    });
    const reservation = readSimulation(tx);
    return reservation ? toReservationView(reservation) : null;
  } catch (error) {
    throw translateContractError(error);
  }
}

/**
 * Create an event.
 *
 * Simulates first so a rejected schedule, bond or basis-point split costs no
 * signature; then signs, submits, and polls until the transaction appears in a
 * ledger. The returned `eventId` is the contract's own return value, read back
 * from the confirmed transaction — never guessed from the local event count.
 */
export async function createEvent(
  input: CreateEventInput,
  signer: Signer,
  onPhase?: (phase: TxPhase) => void,
): Promise<{ eventId: bigint; hash: string }> {
  onPhase?.("simulating");

  let tx: AssembledTransaction<Result<bigint>>;
  try {
    tx = await getWriteClient(signer).create_event(toCreateEventArgs(input));
    // Surfaces a contract rejection before the wallet is ever opened.
    unwrapResult(readSimulation(tx));
  } catch (error) {
    throw translateContractError(error);
  }

  try {
    onPhase?.("awaiting_signature");
    await tx.sign();

    onPhase?.("submitting");
    const sent = await tx.send({
      onSubmitted: () => onPhase?.("confirming"),
    });

    const hash =
      sent.sendTransactionResponse?.hash ??
      (tx.signed ? toHex(tx.signed.hash()) : "");

    if (!hash) {
      throw new Error("The transaction was confirmed without a transaction hash.");
    }

    return { eventId: unwrapResult(sent.result), hash };
  } catch (error) {
    throw translateContractError(error);
  }
}

/**
 * Lock the event's exact bond amount for one participant.
 *
 * The contract remains authoritative for capacity, deadlines, duplicate
 * reservations and the token transfer. Simulation runs before the wallet is
 * opened, so a contract rejection cannot cost the user a signature.
 */
export async function reserve(
  eventId: bigint,
  signer: Signer,
  onPhase?: (phase: TxPhase) => void,
): Promise<{ hash: string }> {
  return executeVoidWrite(
    () =>
      getWriteClient(signer).reserve({
        event_id: eventId,
        participant: signer.address,
      }),
    onPhase,
  );
}

/** Cancel the connected participant's locked reservation. */
export async function cancelReservation(
  eventId: bigint,
  signer: Signer,
  onPhase?: (phase: TxPhase) => void,
): Promise<{ hash: string }> {
  return executeVoidWrite(
    () =>
      getWriteClient(signer).cancel_reservation({
        event_id: eventId,
        participant: signer.address,
      }),
    onPhase,
  );
}

/** Check a participant in; the connected signer must be the event verifier. */
export async function checkIn(
  eventId: bigint,
  participant: string,
  signer: Signer,
  onPhase?: (phase: TxPhase) => void,
): Promise<{ hash: string }> {
  return executeVoidWrite(
    () =>
      getWriteClient(signer).check_in({
        event_id: eventId,
        participant,
      }),
    onPhase,
  );
}

/** Cancel an event; the connected signer must be its organizer. */
export async function cancelEvent(
  eventId: bigint,
  signer: Signer,
  onPhase?: (phase: TxPhase) => void,
): Promise<{ hash: string }> {
  return executeVoidWrite(
    () => getWriteClient(signer).cancel_event({ event_id: eventId }),
    onPhase,
  );
}

/** Permissionless pull-refund for one locked reservation on a cancelled event. */
export async function claimCancelledRefund(
  eventId: bigint,
  participant: string,
  signer: Signer,
  onPhase?: (phase: TxPhase) => void,
): Promise<{ hash: string }> {
  return executeVoidWrite(
    () =>
      getWriteClient(signer).claim_cancelled_event_refund({
        event_id: eventId,
        participant,
      }),
    onPhase,
  );
}

/** Permissionless no-show settlement for one locked reservation. */
export async function settleNoShow(
  eventId: bigint,
  participant: string,
  signer: Signer,
  onPhase?: (phase: TxPhase) => void,
): Promise<{ hash: string }> {
  return executeVoidWrite(
    () =>
      getWriteClient(signer).settle_no_show({
        event_id: eventId,
        participant,
      }),
    onPhase,
  );
}

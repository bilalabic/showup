import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CCCDFM2MGKO5PEBS565O7FO2OL4CZYUFFRTQLUPPIIIL2JNCPUSUIRHM",
  }
} as const

export const Errors = {
  1: {message:"NotFound"},
  2: {message:"NotActive"},
  3: {message:"AlreadyReserved"},
  4: {message:"EventFull"},
  5: {message:"NotLocked"},
  6: {message:"CheckInNotOpen"},
  7: {message:"CheckInWindowClosed"},
  8: {message:"CancellationDeadlinePassed"},
  9: {message:"SettlementTooEarly"},
  10: {message:"InvalidBasisPoints"},
  11: {message:"InvalidSchedule"},
  12: {message:"InvalidAmount"},
  13: {message:"Overflow"},
  /**
   * The event is still Active, so there is nothing to claim a refund from.
   * Distinct from `NotActive`, which means the opposite — that an event has
   * already been cancelled. Sharing one code for both would leave the
   * frontend unable to render a correct message for either.
   */
  14: {message:"EventNotCancelled"}
}


export interface Event {
  bond_amount: i128;
  cancellation_deadline: u64;
  capacity: u32;
  checkin_deadline: u64;
  checkin_start: u64;
  community_bps: u32;
  id: u64;
  organizer: string;
  organizer_bps: u32;
  reserved_count: u32;
  start_time: u64;
  status: EventStatus;
  title: string;
  venue: string;
  verifier: string;
}


export interface Config {
  community_pool: string;
  token: string;
}

export type EventStatus = {tag: "Active", values: void} | {tag: "Cancelled", values: void};


export interface Reservation {
  amount: i128;
  event_id: u64;
  participant: string;
  reserved_at: u64;
  status: ReservationStatus;
}

export type ReservationStatus = {tag: "Locked", values: void} | {tag: "Attended", values: void} | {tag: "Cancelled", values: void} | {tag: "Refunded", values: void} | {tag: "NoShowSettled", values: void};








export interface Client {
  /**
   * Construct and simulate a reserve transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  reserve: ({event_id, participant}: {event_id: u64, participant: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a check_in transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  check_in: ({event_id, participant}: {event_id: u64, participant: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_event transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_event: ({event_id}: {event_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<Event>>>

  /**
   * Construct and simulate a get_config transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_config: (options?: MethodOptions) => Promise<AssembledTransaction<Config>>

  /**
   * Construct and simulate a cancel_event transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  cancel_event: ({event_id}: {event_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a create_event transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  create_event: ({organizer, title, venue, bond_amount, capacity, start_time, checkin_start, checkin_deadline, cancellation_deadline, organizer_bps, community_bps}: {organizer: string, title: string, venue: string, bond_amount: i128, capacity: u32, start_time: u64, checkin_start: u64, checkin_deadline: u64, cancellation_deadline: u64, organizer_bps: u32, community_bps: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u64>>>

  /**
   * Construct and simulate a settle_no_show transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  settle_no_show: ({event_id, participant}: {event_id: u64, participant: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_event_count transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_event_count: (options?: MethodOptions) => Promise<AssembledTransaction<u64>>

  /**
   * Construct and simulate a get_reservation transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_reservation: ({event_id, participant}: {event_id: u64, participant: string}, options?: MethodOptions) => Promise<AssembledTransaction<Option<Reservation>>>

  /**
   * Construct and simulate a cancel_reservation transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  cancel_reservation: ({event_id, participant}: {event_id: u64, participant: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a claim_cancelled_event_refund transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  claim_cancelled_event_refund: ({event_id, participant}: {event_id: u64, participant: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {token, community_pool}: {token: string, community_pool: string},
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy({token, community_pool}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAAAAAAAAAAAHcmVzZXJ2ZQAAAAACAAAAAAAAAAhldmVudF9pZAAAAAYAAAAAAAAAC3BhcnRpY2lwYW50AAAAABMAAAABAAAD6QAAAAIAAAAD",
        "AAAAAAAAAAAAAAAIY2hlY2tfaW4AAAACAAAAAAAAAAhldmVudF9pZAAAAAYAAAAAAAAAC3BhcnRpY2lwYW50AAAAABMAAAABAAAD6QAAAAIAAAAD",
        "AAAAAAAAAAAAAAAJZ2V0X2V2ZW50AAAAAAAAAQAAAAAAAAAIZXZlbnRfaWQAAAAGAAAAAQAAA+kAAAfQAAAABUV2ZW50AAAAAAAAAw==",
        "AAAAAAAAAAAAAAAKZ2V0X2NvbmZpZwAAAAAAAAAAAAEAAAfQAAAABkNvbmZpZwAA",
        "AAAAAAAAAAAAAAAMY2FuY2VsX2V2ZW50AAAAAQAAAAAAAAAIZXZlbnRfaWQAAAAGAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAAAAAAAAMY3JlYXRlX2V2ZW50AAAACwAAAAAAAAAJb3JnYW5pemVyAAAAAAAAEwAAAAAAAAAFdGl0bGUAAAAAAAAQAAAAAAAAAAV2ZW51ZQAAAAAAABAAAAAAAAAAC2JvbmRfYW1vdW50AAAAAAsAAAAAAAAACGNhcGFjaXR5AAAABAAAAAAAAAAKc3RhcnRfdGltZQAAAAAABgAAAAAAAAANY2hlY2tpbl9zdGFydAAAAAAAAAYAAAAAAAAAEGNoZWNraW5fZGVhZGxpbmUAAAAGAAAAAAAAABVjYW5jZWxsYXRpb25fZGVhZGxpbmUAAAAAAAAGAAAAAAAAAA1vcmdhbml6ZXJfYnBzAAAAAAAABAAAAAAAAAANY29tbXVuaXR5X2JwcwAAAAAAAAQAAAABAAAD6QAAAAYAAAAD",
        "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAIAAAAAAAAABXRva2VuAAAAAAAAEwAAAAAAAAAOY29tbXVuaXR5X3Bvb2wAAAAAABMAAAAA",
        "AAAAAAAAAAAAAAAOc2V0dGxlX25vX3Nob3cAAAAAAAIAAAAAAAAACGV2ZW50X2lkAAAABgAAAAAAAAALcGFydGljaXBhbnQAAAAAEwAAAAEAAAPpAAAAAgAAAAM=",
        "AAAAAAAAAAAAAAAPZ2V0X2V2ZW50X2NvdW50AAAAAAAAAAABAAAABg==",
        "AAAAAAAAAAAAAAAPZ2V0X3Jlc2VydmF0aW9uAAAAAAIAAAAAAAAACGV2ZW50X2lkAAAABgAAAAAAAAALcGFydGljaXBhbnQAAAAAEwAAAAEAAAPoAAAH0AAAAAtSZXNlcnZhdGlvbgA=",
        "AAAAAAAAAAAAAAASY2FuY2VsX3Jlc2VydmF0aW9uAAAAAAACAAAAAAAAAAhldmVudF9pZAAAAAYAAAAAAAAAC3BhcnRpY2lwYW50AAAAABMAAAABAAAD6QAAAAIAAAAD",
        "AAAAAAAAAAAAAAAcY2xhaW1fY2FuY2VsbGVkX2V2ZW50X3JlZnVuZAAAAAIAAAAAAAAACGV2ZW50X2lkAAAABgAAAAAAAAALcGFydGljaXBhbnQAAAAAEwAAAAEAAAPpAAAAAgAAAAM=",
        "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAADgAAAAAAAAAITm90Rm91bmQAAAABAAAAAAAAAAlOb3RBY3RpdmUAAAAAAAACAAAAAAAAAA9BbHJlYWR5UmVzZXJ2ZWQAAAAAAwAAAAAAAAAJRXZlbnRGdWxsAAAAAAAABAAAAAAAAAAJTm90TG9ja2VkAAAAAAAABQAAAAAAAAAOQ2hlY2tJbk5vdE9wZW4AAAAAAAYAAAAAAAAAE0NoZWNrSW5XaW5kb3dDbG9zZWQAAAAABwAAAAAAAAAaQ2FuY2VsbGF0aW9uRGVhZGxpbmVQYXNzZWQAAAAAAAgAAAAAAAAAElNldHRsZW1lbnRUb29FYXJseQAAAAAACQAAAAAAAAASSW52YWxpZEJhc2lzUG9pbnRzAAAAAAAKAAAAAAAAAA9JbnZhbGlkU2NoZWR1bGUAAAAACwAAAAAAAAANSW52YWxpZEFtb3VudAAAAAAAAAwAAAAAAAAACE92ZXJmbG93AAAADQAAAQpUaGUgZXZlbnQgaXMgc3RpbGwgQWN0aXZlLCBzbyB0aGVyZSBpcyBub3RoaW5nIHRvIGNsYWltIGEgcmVmdW5kIGZyb20uCkRpc3RpbmN0IGZyb20gYE5vdEFjdGl2ZWAsIHdoaWNoIG1lYW5zIHRoZSBvcHBvc2l0ZSDigJQgdGhhdCBhbiBldmVudCBoYXMKYWxyZWFkeSBiZWVuIGNhbmNlbGxlZC4gU2hhcmluZyBvbmUgY29kZSBmb3IgYm90aCB3b3VsZCBsZWF2ZSB0aGUKZnJvbnRlbmQgdW5hYmxlIHRvIHJlbmRlciBhIGNvcnJlY3QgbWVzc2FnZSBmb3IgZWl0aGVyLgAAAAAAEUV2ZW50Tm90Q2FuY2VsbGVkAAAAAAAADg==",
        "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" ]),
      options
    )
  }
  public readonly fromJSON = {
    reserve: this.txFromJSON<Result<void>>,
        check_in: this.txFromJSON<Result<void>>,
        get_event: this.txFromJSON<Result<Event>>,
        get_config: this.txFromJSON<Config>,
        cancel_event: this.txFromJSON<Result<void>>,
        create_event: this.txFromJSON<Result<u64>>,
        settle_no_show: this.txFromJSON<Result<void>>,
        get_event_count: this.txFromJSON<u64>,
        get_reservation: this.txFromJSON<Option<Reservation>>,
        cancel_reservation: this.txFromJSON<Result<void>>,
        claim_cancelled_event_refund: this.txFromJSON<Result<void>>
  }
}
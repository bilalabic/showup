import { Ok } from "@stellar/stellar-sdk/contract";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getWriteClient } from "./client";
import {
  cancelEvent,
  cancelReservation,
  claimCancelledRefund,
  settleNoShow,
  type Signer,
} from "./index";

vi.mock("./client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./client")>()),
  getWriteClient: vi.fn(),
}));

const ORGANIZER = "GBN4VYCAM6SQWTZV54AQ5IQP5FDGQ7SYTHMU7T5QKRAHJWZSNDKNAVD4";
const PARTICIPANT = "GALBFBDQAAGLKLKCQDH7CNKKA2A7UT5APANR27FMGCNZXUTVKF2O253G";
const HASH = "ef".repeat(32);
const signer: Signer = {
  address: ORGANIZER,
  signTransaction: vi.fn(),
};

function makeTransaction() {
  const result = new Ok(undefined);
  return {
    simulation: {},
    result,
    sign: vi.fn(async () => undefined),
    send: vi.fn(async (options?: { onSubmitted?: () => void }) => {
      options?.onSubmitted?.();
      return { result, sendTransactionResponse: { hash: HASH } };
    }),
    signed: undefined,
  };
}

describe("settlement action facade", () => {
  beforeEach(() => vi.clearAllMocks());

  it("binds reservation cancellation to the signer", async () => {
    const tx = makeTransaction();
    const method = vi.fn(async () => tx);
    vi.mocked(getWriteClient).mockReturnValue({
      cancel_reservation: method,
    } as unknown as ReturnType<typeof getWriteClient>);

    await expect(cancelReservation(9n, signer)).resolves.toEqual({ hash: HASH });
    expect(method).toHaveBeenCalledWith({
      event_id: 9n,
      participant: ORGANIZER,
    });
  });

  it("passes only the event id when the organizer cancels an event", async () => {
    const tx = makeTransaction();
    const method = vi.fn(async () => tx);
    vi.mocked(getWriteClient).mockReturnValue({
      cancel_event: method,
    } as unknown as ReturnType<typeof getWriteClient>);

    await expect(cancelEvent(9n, signer)).resolves.toEqual({ hash: HASH });
    expect(method).toHaveBeenCalledWith({ event_id: 9n });
  });

  it("keeps the refund participant independent from the permissionless signer", async () => {
    const tx = makeTransaction();
    const method = vi.fn(async () => tx);
    vi.mocked(getWriteClient).mockReturnValue({
      claim_cancelled_event_refund: method,
    } as unknown as ReturnType<typeof getWriteClient>);

    await expect(
      claimCancelledRefund(9n, PARTICIPANT, signer),
    ).resolves.toEqual({ hash: HASH });
    expect(method).toHaveBeenCalledWith({
      event_id: 9n,
      participant: PARTICIPANT,
    });
  });

  it("settles the selected participant without changing the signer", async () => {
    const tx = makeTransaction();
    const method = vi.fn(async () => tx);
    vi.mocked(getWriteClient).mockReturnValue({
      settle_no_show: method,
    } as unknown as ReturnType<typeof getWriteClient>);

    await expect(settleNoShow(9n, PARTICIPANT, signer)).resolves.toEqual({
      hash: HASH,
    });
    expect(getWriteClient).toHaveBeenCalledWith(signer);
    expect(method).toHaveBeenCalledWith({
      event_id: 9n,
      participant: PARTICIPANT,
    });
  });
});

import { Ok } from "@stellar/stellar-sdk/contract";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getWriteClient } from "./client";
import { checkIn, type Signer, type TxPhase } from "./index";

vi.mock("./client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./client")>()),
  getWriteClient: vi.fn(),
}));

const VERIFIER = "GBN4VYCAM6SQWTZV54AQ5IQP5FDGQ7SYTHMU7T5QKRAHJWZSNDKNAVD4";
const PARTICIPANT = "GALBFBDQAAGLKLKCQDH7CNKKA2A7UT5APANR27FMGCNZXUTVKF2O253G";
const HASH = "cd".repeat(32);

describe("checkIn", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the scanned participant while the verifier signs", async () => {
    const result = new Ok(undefined);
    const sign = vi.fn(async () => undefined);
    const send = vi.fn(async (options?: { onSubmitted?: () => void }) => {
      options?.onSubmitted?.();
      return { result, sendTransactionResponse: { hash: HASH } };
    });
    const tx = { simulation: {}, result, sign, send, signed: undefined };
    const checkInMethod = vi.fn(async () => tx);
    vi.mocked(getWriteClient).mockReturnValue({
      check_in: checkInMethod,
    } as unknown as ReturnType<typeof getWriteClient>);
    const signer: Signer = {
      address: VERIFIER,
      signTransaction: vi.fn(),
    };
    const phases: TxPhase[] = [];

    await expect(
      checkIn(7n, PARTICIPANT, signer, (phase) => phases.push(phase)),
    ).resolves.toEqual({ hash: HASH });

    expect(getWriteClient).toHaveBeenCalledWith(signer);
    expect(checkInMethod).toHaveBeenCalledWith({
      event_id: 7n,
      participant: PARTICIPANT,
    });
    expect(phases).toEqual([
      "simulating",
      "awaiting_signature",
      "submitting",
      "confirming",
    ]);
  });
});

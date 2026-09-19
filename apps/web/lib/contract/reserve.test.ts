import { xdr } from "@stellar/stellar-sdk";
import { Err, Ok } from "@stellar/stellar-sdk/contract";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getWriteClient } from "./client";
import { ContractError, reserve, type Signer, type TxPhase } from "./index";

vi.mock("./client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./client")>()),
  getWriteClient: vi.fn(),
}));

const PARTICIPANT =
  "GALBFBDQAAGLKLKCQDH7CNKKA2A7UT5APANR27FMGCNZXUTVKF2O253G";
const HASH = "ab".repeat(32);
const signer: Signer = {
  address: PARTICIPANT,
  signTransaction: vi.fn(),
};

function makeTransaction(result: Ok<void> | Err<{ message: string }>) {
  const sign = vi.fn(async () => undefined);
  const send = vi.fn(async (options?: { onSubmitted?: () => void }) => {
    options?.onSubmitted?.();
    return {
      result,
      sendTransactionResponse: { hash: HASH },
    };
  });

  return {
    simulation: {},
    result,
    sign,
    send,
    signed: undefined,
  };
}

describe("reserve", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("binds the participant to the signer and reports every confirmed phase", async () => {
    const tx = makeTransaction(new Ok(undefined));
    const reserveMethod = vi.fn(async () => tx);
    vi.mocked(getWriteClient).mockReturnValue({
      reserve: reserveMethod,
    } as unknown as ReturnType<typeof getWriteClient>);
    const phases: TxPhase[] = [];

    await expect(reserve(2n, signer, (phase) => phases.push(phase))).resolves.toEqual(
      { hash: HASH },
    );

    expect(reserveMethod).toHaveBeenCalledWith({
      event_id: 2n,
      participant: PARTICIPANT,
    });
    expect(tx.sign).toHaveBeenCalledOnce();
    expect(tx.send).toHaveBeenCalledOnce();
    expect(phases).toEqual([
      "simulating",
      "awaiting_signature",
      "submitting",
      "confirming",
    ]);
  });

  it("maps a successful-simulation Result error by numeric code before signing", async () => {
    const encoded = new xdr.ScErrorContract(4).toXDR("base64");
    const tx = makeTransaction(new Err({ message: encoded }));
    vi.mocked(getWriteClient).mockReturnValue({
      reserve: vi.fn(async () => tx),
    } as unknown as ReturnType<typeof getWriteClient>);

    const outcome = reserve(2n, signer).catch((error: unknown) => error);

    await expect(outcome).resolves.toMatchObject<Partial<ContractError>>({
      code: 4,
      reason: "EventFull",
    });
    expect(tx.sign).not.toHaveBeenCalled();
    expect(tx.send).not.toHaveBeenCalled();
  });

  it("translates a simulation rejection and never opens the wallet", async () => {
    const reserveMethod = vi.fn(async () => {
      throw new Error("HostError: Error(Contract, #4)");
    });
    vi.mocked(getWriteClient).mockReturnValue({
      reserve: reserveMethod,
    } as unknown as ReturnType<typeof getWriteClient>);

    const outcome = reserve(2n, signer).catch((error: unknown) => error);

    await expect(outcome).resolves.toMatchObject<Partial<ContractError>>({
      code: 4,
      reason: "EventFull",
    });
    expect(signer.signTransaction).not.toHaveBeenCalled();
  });
});

import { describe, expect, it } from "vitest";

import { ContractError, contractErrorFrom, translateContractError } from "./errors";

describe("ContractError", () => {
  it("carries the numeric code, the variant name and user-facing copy", () => {
    const error = new ContractError(4);

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("ContractError");
    expect(error.code).toBe(4);
    expect(error.reason).toBe("EventFull");
    expect(error.message).toMatch(/last seat/i);
  });

  it("maps every declared code to its own message", () => {
    const codes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
    const messages = codes.map((code) => new ContractError(code).message);
    expect(new Set(messages).size).toBe(codes.length);
  });

  it("distinguishes NotActive (2) from EventNotCancelled (14)", () => {
    expect(new ContractError(2).reason).toBe("NotActive");
    expect(new ContractError(14).reason).toBe("EventNotCancelled");
    expect(new ContractError(2).message).not.toBe(new ContractError(14).message);
  });

  it("still produces something readable for an undeclared code", () => {
    const error = new ContractError(99);
    expect(error.code).toBe(99);
    expect(error.reason).toBe("Unknown");
    expect(error.message).toContain("99");
  });
});

describe("contractErrorFrom", () => {
  it("maps an SDK error by code, not by message", () => {
    const error = contractErrorFrom(
      new Error('Transaction simulation failed: "HostError: Error(Contract, #9)"'),
    );

    expect(error).toBeInstanceOf(ContractError);
    expect(error?.code).toBe(9);
    expect(error?.reason).toBe("SettlementTooEarly");
  });

  it("keeps the original error as the cause", () => {
    const cause = new Error("Error(Contract, #5)");
    expect(contractErrorFrom(cause)?.cause).toBe(cause);
  });

  it("passes an existing ContractError straight through", () => {
    const original = new ContractError(1);
    expect(contractErrorFrom(original)).toBe(original);
  });

  it("returns null for anything without a contract code", () => {
    expect(contractErrorFrom(new Error("Network request failed"))).toBeNull();
    expect(contractErrorFrom("timeout")).toBeNull();
  });
});

describe("translateContractError", () => {
  it("replaces a mappable error and leaves anything else untouched", () => {
    const mappable = new Error("Error(Contract, #3)");
    const translated = translateContractError(mappable);
    expect(translated).toBeInstanceOf(ContractError);
    expect((translated as ContractError).reason).toBe("AlreadyReserved");

    const network = new Error("ECONNRESET");
    expect(translateContractError(network)).toBe(network);
  });
});

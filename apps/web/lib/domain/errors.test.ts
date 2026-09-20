import { describe, expect, it } from "vitest";

import {
  ContractErrorCode,
  contractErrorMessage,
  contractErrorName,
  isContractErrorCode,
  transactionHashFromError,
  userFacingError,
} from "./errors";

const ALL_CODES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

describe("ContractErrorCode", () => {
  it("matches the contract's numeric ABI", () => {
    expect(ContractErrorCode.NotFound).toBe(1);
    expect(ContractErrorCode.NotActive).toBe(2);
    expect(ContractErrorCode.AlreadyReserved).toBe(3);
    expect(ContractErrorCode.EventFull).toBe(4);
    expect(ContractErrorCode.NotLocked).toBe(5);
    expect(ContractErrorCode.CheckInNotOpen).toBe(6);
    expect(ContractErrorCode.CheckInWindowClosed).toBe(7);
    expect(ContractErrorCode.CancellationDeadlinePassed).toBe(8);
    expect(ContractErrorCode.SettlementTooEarly).toBe(9);
    expect(ContractErrorCode.InvalidBasisPoints).toBe(10);
    expect(ContractErrorCode.InvalidSchedule).toBe(11);
    expect(ContractErrorCode.InvalidAmount).toBe(12);
    expect(ContractErrorCode.Overflow).toBe(13);
    expect(ContractErrorCode.EventNotCancelled).toBe(14);
  });

  it("recognises exactly codes 1 through 14", () => {
    for (const code of ALL_CODES) {
      expect(isContractErrorCode(code)).toBe(true);
    }
    for (const code of [0, 15, -1, 1.5]) {
      expect(isContractErrorCode(code)).toBe(false);
    }
  });
});

describe("userFacingError", () => {
  it("never exposes an unknown raw SDK message", () => {
    const raw = new Error(
      "tx_bad_auth: AAAA...XDR https://rpc.example.invalid/private",
    );
    expect(userFacingError(raw, "Please retry.")).toBe("Please retry.");
  });

  it("provides actionable wallet and timeout recovery", () => {
    expect(userFacingError({ kind: "rejected" })).toMatch(/declined/i);
    expect(userFacingError({ kind: "account_changed" })).toMatch(
      /different account/i,
    );
    expect(userFacingError({ kind: "timeout" })).toMatch(/transaction link/i);
  });

  it("keeps numeric contract error mapping exact", () => {
    expect(userFacingError({ name: "ContractError", code: 4 })).toBe(
      contractErrorMessage(4),
    );
  });
});

describe("transactionHashFromError", () => {
  it("finds a validated hash without accepting arbitrary text", () => {
    const hash = "a1".repeat(32);
    expect(transactionHashFromError({ cause: { hash } })).toBe(hash);
    expect(transactionHashFromError({ hash: "not-a-hash" })).toBeUndefined();
  });
});

describe("contractErrorName", () => {
  it("names every declared code", () => {
    expect(contractErrorName(1)).toBe("NotFound");
    expect(contractErrorName(5)).toBe("NotLocked");
    expect(contractErrorName(14)).toBe("EventNotCancelled");
  });

  it("falls back for an unknown code", () => {
    expect(contractErrorName(99)).toBe("Unknown");
  });
});

describe("contractErrorMessage", () => {
  it("returns distinct, non-empty English copy for all 14 codes", () => {
    const messages = ALL_CODES.map(contractErrorMessage);
    for (const message of messages) {
      expect(message.length).toBeGreaterThan(10);
    }
    expect(new Set(messages).size).toBe(ALL_CODES.length);
  });

  it("reads differently for NotActive and EventNotCancelled, which are opposites", () => {
    const notActive = contractErrorMessage(ContractErrorCode.NotActive);
    const notCancelled = contractErrorMessage(
      ContractErrorCode.EventNotCancelled,
    );

    expect(notActive).not.toBe(notCancelled);
    expect(notActive).toMatch(/cancelled/i);
    expect(notCancelled).toMatch(/still active/i);
  });

  it("says 'not found' for code 1 so the UI can show its empty state", () => {
    expect(contractErrorMessage(ContractErrorCode.NotFound)).toContain(
      "not found",
    );
  });

  it("stays readable for an unknown code", () => {
    expect(contractErrorMessage(99)).toContain("99");
  });
});

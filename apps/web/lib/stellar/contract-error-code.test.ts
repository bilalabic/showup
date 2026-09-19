import { describe, expect, it } from "vitest";

import { extractContractErrorCode } from "./contract-error-code";

describe("extractContractErrorCode", () => {
  it("recovers the code from the SDK's simulation error string", () => {
    expect(
      extractContractErrorCode(
        "host invocation failed\n\nCaused by:\n    HostError: Error(Contract, #4)",
      ),
    ).toBe(4);
  });

  it("recovers the code from a thrown Error", () => {
    expect(
      extractContractErrorCode(
        new Error('Transaction simulation failed: "Error(Contract, #14)"'),
      ),
    ).toBe(14);
  });

  it("tolerates the spacing variants the SDK emits", () => {
    expect(extractContractErrorCode("Error(Contract,#1)")).toBe(1);
    expect(extractContractErrorCode("Error(Contract,   #13)")).toBe(13);
  });

  it("returns null when no contract code is present", () => {
    expect(extractContractErrorCode("ECONNREFUSED")).toBeNull();
    expect(extractContractErrorCode(new Error("User rejected"))).toBeNull();
    expect(extractContractErrorCode(null)).toBeNull();
    expect(extractContractErrorCode(undefined)).toBeNull();
    expect(extractContractErrorCode({ status: 500 })).toBeNull();
  });

  it("does not match a WASM VM error, which is not a contract error", () => {
    expect(extractContractErrorCode("Error(WasmVm, #3)")).toBeNull();
  });
});

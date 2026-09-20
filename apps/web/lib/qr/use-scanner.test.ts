import { describe, expect, it } from "vitest";

import NotFoundException from "@zxing/library/esm/core/NotFoundException";

import { isExpectedFrameMiss } from "./use-scanner";

describe("isExpectedFrameMiss", () => {
  it("recognises a real ZXing NotFoundException", () => {
    expect(isExpectedFrameMiss(new NotFoundException())).toBe(true);
  });

  /**
   * The regression this guards. `ts-custom-error` sets `name` from the
   * constructor's function name, so a minified production build reports `"t"`
   * instead of `"NotFoundException"`. Matching on `name` made every ordinary
   * empty frame look like a camera failure, and the scanner stopped the stream
   * the instant it started.
   */
  it("still recognises a frame miss when the class name is minified", () => {
    class t extends Error {
      static kind = "NotFoundException";
      getKind() {
        return (this.constructor as typeof t).kind;
      }
    }

    const minified = new t();
    expect(minified.name).not.toBe("NotFoundException");
    expect(isExpectedFrameMiss(minified)).toBe(true);
  });

  it("recognises the other decode-level misses", () => {
    for (const kind of ["ChecksumException", "FormatException"]) {
      expect(isExpectedFrameMiss({ getKind: () => kind })).toBe(true);
    }
  });

  it("does not swallow a real camera failure", () => {
    const denied = new Error("Permission denied");
    denied.name = "NotAllowedError";

    expect(isExpectedFrameMiss(denied)).toBe(false);
    expect(isExpectedFrameMiss({ getKind: () => "ChecksumError" })).toBe(false);
    expect(isExpectedFrameMiss(null)).toBe(false);
    expect(isExpectedFrameMiss("NotFoundException")).toBe(false);
  });
});

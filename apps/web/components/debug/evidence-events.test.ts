import { describe, expect, it } from "vitest";

import { sanitizeTechnicalEvidence } from "./evidence-events";

describe("sanitizeTechnicalEvidence", () => {
  it("keeps only valid public references", () => {
    expect(
      sanitizeTechnicalEvidence({
        transactionHash: "A".repeat(64),
        anchorTransactionId: "sep_6:deposit-42",
        quoteId: "quote_42",
      }),
    ).toEqual({
      transactionHash: "a".repeat(64),
      anchorTransactionId: "sep_6:deposit-42",
      quoteId: "quote_42",
    });
  });

  it("drops secrets, unknown fields and malformed identifiers", () => {
    expect(
      sanitizeTechnicalEvidence({
        transactionHash: "not-a-hash",
        anchorTransactionId: "contains whitespace",
        token: "eyJ.secret.jwt",
        authorization: "Bearer secret",
        environment: { SECRET: "value" },
      }),
    ).toEqual({});
  });

  it("keeps explicit clears for public references", () => {
    expect(
      sanitizeTechnicalEvidence({
        transactionHash: null,
        anchorTransactionId: null,
        quoteId: null,
      }),
    ).toEqual({
      transactionHash: null,
      anchorTransactionId: null,
      quoteId: null,
    });
  });
});

import { describe, expect, it } from "vitest";

import { validateClaimLine, validateClaimRequest } from "./validation";

const line = {
  id: "line-1",
  expenseDate: "2026-11-27",
  supplier: "Vendor",
  details: "Workshop materials",
  receiptFileName: "receipt.pdf",
  receiptMimeType: "application/pdf",
  receiptFileSize: 100,
  accountType: "600-005 PROJECT CONSUMABLES",
  division: "V-KARISMA-YH",
  amount: 50,
  from: "",
  to: "",
  kilometers: 0,
};

describe("Claims validation", () => {
  it("accepts a complete expense line", () => {
    expect(validateClaimLine("EXPENSE", line, false)).toEqual({});
  });

  it("uses Project Name wording for the backward-compatible division field", () => {
    const errors = validateClaimLine(
      "MILEAGE",
      { ...line, division: "", from: "Office", to: "School", kilometers: 10 },
      false,
    );
    expect(errors.division).toBe("Project name is required.");
  });

  it("requires the request declaration", () => {
    const errors = validateClaimRequest({
      claimDate: "2026-11-27",
      contact: "0123456789",
      directorId: "director-1",
      requesterId: "staff-1",
      claimType: "EXPENSE",
      techExtended: false,
      lines: [line],
      context: { medicalUsedThisYear: 0 },
      confirmed: false,
    });
    expect(errors.confirmed).toBeTruthy();
  });
});

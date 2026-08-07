import { describe, expect, it } from "vitest";
import { getSalesSheetColumnIndexes } from "@/lib/sales-sheet-columns";
import { getLiveSalesReadErrors } from "@/lib/sales-sheet-health";

describe("Sales Impact live Sheet selection", () => {
  it("accepts a structurally valid live read regardless of its historical size", () => {
    expect(
      getLiveSalesReadErrors({
        rowCount: 24,
        paidRowCount: 8,
        latestSalesDate: new Date("2026-08-07T12:00:00.000Z"),
      }),
    ).toEqual([]);
  });

  it("rejects an empty read so the availability snapshot can be used", () => {
    expect(
      getLiveSalesReadErrors({ rowCount: 0, paidRowCount: 0, latestSalesDate: null }),
    ).toContain("The live read returned zero valid sales rows.");
  });

  it("rejects rows with no paid sales evidence", () => {
    expect(
      getLiveSalesReadErrors({
        rowCount: 10,
        paidRowCount: 0,
        latestSalesDate: new Date("2026-08-07T12:00:00.000Z"),
      }),
    ).toContain("The live read returned zero paid sales rows.");
  });
});

describe("Sales Impact Sheet headers", () => {
  const commonHeaders = [
    "Date",
    "Payment Status",
    "Amount",
    "Sales Rep",
    "Show Name",
    "Contract Signed",
  ];

  it("accepts the current live Payment Type header", () => {
    const headers = [...commonHeaders, "Payment Type (New/Recurring/Initial Remaining)"];
    expect(getSalesSheetColumnIndexes(headers).paymentType).toBe(6);
  });

  it("continues to accept the historical Payment Type header", () => {
    const headers = [...commonHeaders, "Payment Type (New/Recurring)"];
    expect(getSalesSheetColumnIndexes(headers).paymentType).toBe(6);
  });

  it("still fails closed when the Payment Type column is genuinely missing", () => {
    expect(() => getSalesSheetColumnIndexes(commonHeaders)).toThrow(
      "Missing required sales sheet column",
    );
  });
});

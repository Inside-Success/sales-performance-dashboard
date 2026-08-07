import { describe, expect, it } from "vitest";
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

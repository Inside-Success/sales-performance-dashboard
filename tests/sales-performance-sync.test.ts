import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ save: vi.fn(), latest: vi.fn(), usage: vi.fn() }));
vi.mock("@/lib/db", () => ({ saveSalesPerformanceSnapshot: db.save, getLatestSalesPerformanceSnapshot: db.latest, getSalesCorrelationUsageData: db.usage }));
import { POST } from "@/app/api/sales-performance/sync/route";
import { getSalesRows, prepareSalesSync } from "@/lib/sales-correlation";
import { SALES_SYNC_SHEET_ID, SALES_SYNC_MAX_AGE_MS, syncedSalesStatus } from "@/lib/sales-sheet-sync";
function payload() {
  const data = [
    ["A", "Date", "10/08/2026", "10/07/2026"],
    ["C", "Payment Status", "Paid", "Paid"],
    ["D", "Payment Type (New/Recurring/Initial Remaining)", "New", "Recurring"],
    ["H", "Amount", "$1,500.00", "$300.00"],
    ["I", "Sales Rep", "Test Rep", "Test Rep"],
    ["J", "Show Name", "Example, Show", "Example, Show"],
    ["K", "Contract Signed", "TRUE", "FALSE"],
  ];
  return { spreadsheetId: SALES_SYNC_SHEET_ID, valueRanges: data.map(([column, ...values]) => ({ range: `Main!${column}1:${column}3`, majorDimension: "ROWS", values: values.map((v) => [v]) })) };
}
function request(body: unknown, token = "test-secret") {
  return new Request("https://example.test/api/sales-performance/sync", { method: "POST", headers: { authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
}
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("SALES_PERFORMANCE_SYNC_SECRET", "test-secret"); });
describe("read-only sales sync", () => {
  it("preserves existing payment/date parsing and separates new from recurring", () => {
    const result = prepareSalesSync(payload());
    expect(result.row_count).toBe(2); expect(result.paid_row_count).toBe(2); expect(result.new_paid_row_count).toBe(1);
    expect(result.rows[0]).toMatchObject({ amount: 1500, dateKey: "2026-10-08", showName: "Example, Show", contractSigned: true });
    expect(result.rows[1].contractSigned).toBe(false);
  });
  it("keeps sparse cells aligned and uses range identities rather than order", () => {
    const body = payload(); body.valueRanges.reverse(); body.valueRanges.find((r) => r.range.startsWith("Main!J"))!.values[1] = [];
    expect(prepareSalesSync(body).rows.map((row) => row.showName)).toEqual(["", "Example, Show"]);
  });
  it("rejects wrong sheet, missing/duplicate columns, missing required headers and zero paid reads", () => {
    expect(() => prepareSalesSync({ ...payload(), spreadsheetId: "wrong" })).toThrow();
    const duplicate = payload(); duplicate.valueRanges[6] = duplicate.valueRanges[0]; expect(() => prepareSalesSync(duplicate)).toThrow();
    const missing = payload(); missing.valueRanges.pop(); expect(() => prepareSalesSync(missing)).toThrow();
    const header = payload(); header.valueRanges[0].values[0] = ["wrong"]; expect(() => prepareSalesSync(header)).toThrow();
    const noPaid = payload(); noPaid.valueRanges[1].values = [["Payment Status"], ["Unpaid"], ["Unpaid"]]; expect(() => prepareSalesSync(noPaid)).toThrow();
  });
  it("fails closed without secret or with invalid authorization before writing", async () => {
    expect((await POST(request(payload(), "wrong"))).status).toBe(401);
    expect((await POST(request(payload(), "é".repeat(11)))).status).toBe(401);
    vi.stubEnv("SALES_PERFORMANCE_SYNC_SECRET", ""); expect((await POST(request(payload()))).status).toBe(503);
    expect(db.save).not.toHaveBeenCalled();
  });
  it("rejects invalid data while preserving previous snapshot", async () => {
    expect((await POST(request({}))).status).toBe(400); expect(db.save).not.toHaveBeenCalled();
  });
  it("returns a real failure if persistence fails", async () => {
    db.save.mockResolvedValue(null); expect((await POST(request(payload()))).status).toBe(503);
  });
  it("returns only refresh statistics on successful persistence", async () => {
    db.save.mockResolvedValue({ id: 1, created_at: "2026-10-08", row_count: 2, paid_row_count: 2, new_paid_row_count: 1, latest_sales_date: "2026-10-08" });
    const response = await POST(request(payload())); expect(response.status).toBe(200);
    const body = await response.json(); expect(body.ok).toBe(true); expect(body).not.toHaveProperty("rows"); expect(db.save).toHaveBeenCalledOnce();
  });
  it("uses authenticated data without repeating the unauthenticated CSV request", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    const prepared = prepareSalesSync(payload());
    db.latest.mockResolvedValue({ ...prepared, created_at: new Date().toISOString() });
    const result = await getSalesRows();
    expect(result.dataSource).toBe("synced_sheet"); expect(result.rows).toHaveLength(2);
    expect(fetchMock).not.toHaveBeenCalled(); vi.unstubAllGlobals();
  });
  it("retains stale authenticated data and its timestamp with an explicit warning", async () => {
    const prepared = prepareSalesSync(payload());
    const createdAt = new Date(Date.now() - SALES_SYNC_MAX_AGE_MS - 60000).toISOString();
    db.latest.mockResolvedValue({ ...prepared, created_at: createdAt });
    const result = await getSalesRows();
    expect(result.dataSource).toBe("cached_snapshot"); expect(result.snapshotCreatedAt).toBe(createdAt);
    expect(result.rows).toHaveLength(2); expect(result.snapshotWarning).toContain("refresh is delayed");
    expect(db.save).not.toHaveBeenCalled();
  });
  it("warns after two hours without changing last-good freshness", () => {
    const now = Date.parse("2026-10-08T15:00:00Z");
    expect(syncedSalesStatus(new Date(now - 3600000).toISOString(), now)).toBe("synced_sheet");
    expect(syncedSalesStatus(new Date(now - SALES_SYNC_MAX_AGE_MS - 1).toISOString(), now)).toBe("cached_snapshot");
    expect(syncedSalesStatus("invalid", now)).toBe("cached_snapshot");
  });
});

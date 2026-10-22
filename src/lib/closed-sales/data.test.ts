import { beforeEach, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  guard: vi.fn(),
  neon: vi.fn(),
  query: vi.fn(),
}));
vi.mock("@/lib/rep-scoring/access", () => ({
  requireRepScoringAdmin: mocks.guard,
}));
vi.mock("@neondatabase/serverless", () => ({ neon: mocks.neon }));
import { getClosedSales } from "./data";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.guard.mockResolvedValue({});
  mocks.neon.mockReturnValue(mocks.query);
  mocks.query.mockResolvedValue([]);
  process.env.DATABASE_URL = "postgres://test";
});
it("rejects unauthorized access before opening storage", async () => {
  mocks.guard.mockRejectedValue(new Error("denied"));
  await expect(getClosedSales({})).rejects.toThrow("denied");
  expect(mocks.neon).not.toHaveBeenCalled();
});
it("reads only its isolated snapshot without source or database writes", async () => {
  expect(await getClosedSales({})).toBeNull();
  const [template] = mocks.query.mock.calls[0];
  expect(template.join("")).toContain("closed_sales_library_snapshots");
  expect(template.join("").toLowerCase()).not.toMatch(
    /insert|update|delete|create|performance_calls/,
  );
});
it("paginates after filtering and never returns unrelated records", async () => {
  const sale = {
    id: "one",
    client: "Jane",
    rep: "Alex",
    show: "Legacy Makers",
    category: "Documentary",
    package: "Standard",
    date: "2026-10-01",
    sources: ["https://istvoffical.slack.com/archives/C07TQKSJ5J8/p1"],
    recordings: [],
    reports: [],
    reviewNote: "Source",
  };
  mocks.query.mockResolvedValue([
    {
      payload: {
        version: 1,
        capturedAt: "2026-10-22T12:00:00Z",
        from: "2026-04-22",
        through: "2026-10-22",
        sourceEntries: 30,
        reviewedThreads: 0,
        sales: Array.from({ length: 30 }, (_, i) => ({
          ...sale,
          id: String(i),
          client: i === 29 ? "Unique" : "Jane",
        })),
      },
    },
  ]);
  const data = await getClosedSales({ q: "Unique", page: "9999" });
  expect(data?.rows).toHaveLength(1);
  expect(data?.rows[0].id).toBe("29");
  expect(data?.filters.page).toBe(1);
});

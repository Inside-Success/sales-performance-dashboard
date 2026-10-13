import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  query: vi.fn().mockResolvedValue([]),
  sales: vi.fn(),
}));
vi.mock("@neondatabase/serverless", () => ({
  neon: () => ({ query: mocks.query }),
}));
vi.mock("../src/lib/sales-correlation", () => ({ getSalesRows: mocks.sales }));
import { getSalesImpactAnalytics } from "../src/lib/sales-impact-data";
beforeEach(() => {
  mocks.query.mockResolvedValue([]);
});
it("reads the existing snapshot and SELECTs only, with mapped own official opens", async () => {
  vi.stubEnv("DATABASE_URL", "test-only");
  mocks.sales.mockResolvedValue({
    configured: true,
    rows: [],
    dataSource: "authenticated_sync",
    snapshotCreatedAt: "2026-10-13",
    snapshotWarning: null,
  });
  const data = await getSalesImpactAnalytics();
  expect(data.analysis.opened).toBe(0);
  for (const [query] of mocks.query.mock.calls)
    expect(query).toMatch(/^select /i);
  expect(mocks.query.mock.calls[1][0]).toContain("e.source='official_report'");
  expect(mocks.query.mock.calls[1][0]).toContain(
    "e.viewer_rep_slug=c.rep_slug",
  );
  vi.unstubAllEnvs();
});
it("rejects unavailable source data rather than substituting zero", async () => {
  vi.stubEnv("DATABASE_URL", "test-only");
  mocks.sales.mockResolvedValue({
    configured: false,
    rows: [],
    error: "failed",
  });
  await expect(getSalesImpactAnalytics()).rejects.toThrow(
    "missing sales are not shown as zero",
  );
  vi.unstubAllEnvs();
});

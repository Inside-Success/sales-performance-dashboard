import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), analytics: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/rep-no-show", () => ({
  getRepNoShowAnalytics: mocks.analytics,
}));
import { NextRequest } from "next/server";
import { GET } from "@/app/api/admin/rep-no-show/history/route";
beforeEach(() => vi.clearAllMocks());
describe("attendance history authorization", () => {
  it("does not fetch history for unsigned or ordinary rep accounts", async () => {
    for (const session of [
      null,
      { user: { email: "ordinary@insidesuccess.com" } },
    ]) {
      mocks.auth.mockResolvedValue(session);
      expect([401, 403]).toContain(
        (
          await GET(
            new NextRequest(
              "https://example.test/api/admin/rep-no-show/history",
            ),
          )
        ).status,
      );
    }
    expect(mocks.analytics).not.toHaveBeenCalled();
  });
  it("returns unavailable rather than a successful empty history after a read failure", async () => {
    mocks.auth.mockResolvedValue({
      user: { email: "syed.haider@insidesuccess.com" },
    });
    mocks.analytics.mockResolvedValue({ summary: { error: "timeout" } });
    expect(
      (
        await GET(
          new NextRequest("https://example.test/api/admin/rep-no-show/history"),
        )
      ).status,
    ).toBe(503);
  });
});

it("routes daily evidence through the daily reader, with the same admin gate", async () => {
  mocks.auth.mockResolvedValue({
    user: { email: "syed.haider@insidesuccess.com" },
  });
  mocks.analytics.mockResolvedValue({
    summary: { generatedAt: "2026-10-17T12:00:00Z" },
    noShowLog: [],
  });
  const response = await GET(
    new NextRequest(
      "https://example.test/api/admin/rep-no-show/history?day=yesterday",
    ),
  );
  expect(response.status).toBe(200);
  expect(mocks.analytics).toHaveBeenCalledWith(7, false, "yesterday");
  expect((await response.json()).calls).toEqual([]);
});

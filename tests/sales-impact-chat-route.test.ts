import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), data: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/sales-impact-data", () => ({
  getSalesImpactAnalytics: mocks.data,
}));
import { POST } from "../src/app/api/sales-analytics-chat/route";
beforeEach(() => {
  vi.clearAllMocks();
});
it("rejects unsigned requests before reading data or calling a provider", async () => {
  mocks.auth.mockResolvedValue(null);
  const fetch = vi.spyOn(globalThis, "fetch");
  const r = await POST(
    new NextRequest("https://example.com/api/sales-analytics-chat", {
      method: "POST",
      body: JSON.stringify({ messages: [{ role: "user", content: "Hi" }] }),
    }),
  );
  expect(r.status).toBe(401);
  expect(mocks.data).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});
it("returns source failure as unavailable rather than a fabricated answer", async () => {
  mocks.auth.mockResolvedValue({ user: { email: "manager@example.com" } });
  mocks.data.mockRejectedValue(new Error("unavailable"));
  vi.stubEnv("DEEPSEEK_API_KEY", "test-only");
  const fetch = vi.spyOn(globalThis, "fetch");
  const r = await POST(
    new NextRequest("https://example.com/api/sales-analytics-chat", {
      method: "POST",
      body: JSON.stringify({ messages: [{ role: "user", content: "Hi" }] }),
    }),
  );
  expect(r.status).toBe(503);
  expect(fetch).not.toHaveBeenCalled();
  vi.unstubAllEnvs();
});

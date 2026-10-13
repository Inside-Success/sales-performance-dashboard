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
it("uses the current open-based snapshot and visible-answer mode for a signed-in question", async () => {
  const { analyzeSalesImpact } = await import(
    "../src/lib/sales-impact-analysis"
  );
  const analysis = analyzeSalesImpact(
    [],
    [],
    [],
    30,
    new Date("2026-10-14T16:00:00Z"),
  );
  mocks.auth.mockResolvedValue({ user: { email: "manager@example.com" } });
  mocks.data.mockResolvedValue({ analysis });
  vi.stubEnv("DEEPSEEK_API_KEY", "test-only");
  const provider = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(
      JSON.stringify({
        choices: [{ message: { content: "No complete comparisons yet." } }],
      }),
      { status: 200 },
    ),
  );
  const r = await POST(
    new NextRequest("https://example.com/api/sales-analytics-chat", {
      method: "POST",
      body: JSON.stringify({
        periodDays: 30,
        messages: [{ role: "user", content: "Explain the page comparison limits." }],
      }),
    }),
  );
  expect(r.status).toBe(200);
  expect((await r.json()).answer).toBe("No complete comparisons yet.");
  const body = JSON.parse(String(provider.mock.calls[0][1]?.body));
  expect(body.thinking).toEqual({ type: "disabled" });
  expect(body.max_tokens).toBe(900);
  expect(body.messages[0].content).toContain(
    "without a ten-second requirement",
  );
  expect(body.messages[1].content).toContain("repColumns");
  expect(mocks.data).toHaveBeenCalledWith(30);
  vi.unstubAllEnvs();
});
it("answers preset numerical summaries from verified facts without a provider call", async () => {
  const { analyzeSalesImpact } = await import(
    "../src/lib/sales-impact-analysis"
  );
  const analysis = analyzeSalesImpact(
    [],
    [],
    [],
    30,
    new Date("2026-10-14T16:00:00Z"),
  );
  mocks.auth.mockResolvedValue({ user: { email: "manager@example.com" } });
  mocks.data.mockResolvedValue({ analysis });
  const provider = vi.spyOn(globalThis, "fetch");
  const r = await POST(
    new NextRequest("https://example.com/api/sales-analytics-chat", {
      method: "POST",
      body: JSON.stringify({
        messages: [{ role: "user", content: "Summarize this page." }],
      }),
    }),
  );
  const d = await r.json();
  expect(d.model).toBe("verified-page-data");
  expect(d.answer).toContain("No complete matched");
  expect(provider).not.toHaveBeenCalled();
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getPerformanceCall: vi.fn(),
  fetchTranscriptText: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({
  getPerformanceCall: mocks.getPerformanceCall,
  getManualFeedbackReport: vi.fn(),
}));
vi.mock("@/lib/report-chat", () => ({
  COACHING_REPORT_CHAT_MODEL: "gpt-6-luna",
  isReportChatEnabledForCall: () => true,
  isReportChatEnabledForManualReport: () => true,
  fetchTranscriptText: mocks.fetchTranscriptText,
  fetchManualTranscriptText: vi.fn(),
  buildReportChatMessages: () => [
    { role: "system", content: "Answer from this report only." },
    { role: "user", content: "Report and transcript context" },
    { role: "user", content: "What should I fix first?" },
  ],
  buildManualReportChatMessages: vi.fn(),
}));

import { POST } from "@/app/api/report-chat/route";

function request() {
  return new NextRequest("https://example.com/api/report-chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      reportType: "official",
      reportId: 6540,
      messages: [{ role: "user", content: "What should I fix first?" }],
    }),
  });
}

beforeEach(() => {
  process.env.OPENAI_API_KEY = "test-key";
  mocks.auth.mockResolvedValue({ user: { email: "rep@example.com" } });
  mocks.getPerformanceCall.mockResolvedValue({ id: 6540, rep_slug: "rep" });
  mocks.fetchTranscriptText.mockResolvedValue({ text: "Transcript", source: "test" });
});

describe("coaching report chat", () => {
  it("requires a signed-in session before reading a report", async () => {
    mocks.auth.mockResolvedValue(null);
    const fetchMock = vi.spyOn(globalThis, "fetch");

    const response = await POST(request());

    expect(response.status).toBe(401);
    expect(mocks.getPerformanceCall).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends report context to Luna and returns its text answer", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        output: [{ type: "message", content: [{ type: "output_text", text: "Focus on the direct answer first." }] }],
      }), { status: 200 }),
    );

    const response = await POST(request());
    const body = await response.json();
    const [url, options] = fetchMock.mock.calls[0];
    const providerRequest = JSON.parse(String(options?.body));

    expect(response.status).toBe(200);
    expect(body).toEqual({ answer: "Focus on the direct answer first.", model: "gpt-6-luna" });
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect(providerRequest).toMatchObject({
      model: "gpt-6-luna",
      store: false,
    });
    expect(providerRequest.input).toEqual([
      { role: "system", content: "Answer from this report only." },
      { role: "user", content: "Report and transcript context" },
      { role: "user", content: "What should I fix first?" },
    ]);
  });

  it("reports an empty model result as an error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ output: [{ type: "reasoning" }] }), { status: 200 }),
    );

    const response = await POST(request());

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "Magic Mike returned an empty answer." });
  });
});

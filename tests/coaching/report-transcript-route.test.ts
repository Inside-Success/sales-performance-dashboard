import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getPerformanceCall: vi.fn(),
  getManualFeedbackReport: vi.fn(),
  fetchTranscriptText: vi.fn(),
  fetchManualTranscriptText: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({
  getPerformanceCall: mocks.getPerformanceCall,
  getManualFeedbackReport: mocks.getManualFeedbackReport,
}));
vi.mock("@/lib/manual-reports", () => ({ resolveManualReportStatus: (report: unknown) => report }));
vi.mock("@/lib/report-chat", () => ({
  fetchTranscriptText: mocks.fetchTranscriptText,
  fetchManualTranscriptText: mocks.fetchManualTranscriptText,
}));

import { GET } from "@/app/api/report-transcript/route";

function request(reportType: string, reportId: string) {
  const params = new URLSearchParams({ reportType, reportId });
  return new NextRequest(`https://example.com/api/report-transcript?${params}`);
}

beforeEach(() => {
  mocks.auth.mockResolvedValue({ user: { email: "rep@example.com" } });
  mocks.getPerformanceCall.mockResolvedValue({ id: 6540 });
  mocks.getManualFeedbackReport.mockResolvedValue({ public_id: "manual-1", status: "completed" });
  mocks.fetchTranscriptText.mockResolvedValue({ text: "[00:01:00.000] Rep: Hello", source: "source_payload" });
  mocks.fetchManualTranscriptText.mockResolvedValue({ text: "[00:02:00.000] Buyer: Yes", source: "source_payload" });
});

describe("report transcript read endpoint", () => {
  it("denies unsigned requests before reading report data", async () => {
    mocks.auth.mockResolvedValue(null);
    const response = await GET(request("official", "6540"));
    expect(response.status).toBe(401);
    expect(mocks.getPerformanceCall).not.toHaveBeenCalled();
  });

  it("loads official transcript without caching it", async () => {
    const response = await GET(request("official", "6540"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ transcript: "[00:01:00.000] Rep: Hello" });
    expect(mocks.fetchTranscriptText).toHaveBeenCalledWith({ id: 6540 });
  });

  it("loads only completed self-submitted reports", async () => {
    const response = await GET(request("manual", "manual-1"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ transcript: "[00:02:00.000] Buyer: Yes" });
    expect(mocks.fetchManualTranscriptText).toHaveBeenCalledOnce();

    mocks.getManualFeedbackReport.mockResolvedValue({ public_id: "manual-2", status: "pending" });
    const pending = await GET(request("manual", "manual-2"));
    expect(pending.status).toBe(404);
    expect(mocks.fetchManualTranscriptText).toHaveBeenCalledOnce();
  });

  it("rejects unsupported report types", async () => {
    const response = await GET(request("other", "6540"));
    expect(response.status).toBe(400);
    expect(mocks.getPerformanceCall).not.toHaveBeenCalled();
  });
});

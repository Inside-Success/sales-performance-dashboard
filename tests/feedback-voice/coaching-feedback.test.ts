import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), report: vi.fn(), save: vi.fn(), mark: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ getPerformanceCall: mocks.report, getManualFeedbackReport: mocks.report }));
vi.mock("@/lib/report-version", () => ({ isEnhancedReport: () => true }));
vi.mock("@/lib/feedback-store", () => ({ saveCoachingFeedback: mocks.save, markCoachingFeedbackForward: mocks.mark }));
import { POST } from "@/app/api/report-feedback/route";
const request = (rating = "negative") => new Request("https://dashboard.test/api/report-feedback", { method: "POST", body: JSON.stringify({ submission_id: "45be34d1-3228-44a8-a428-7f0c8bb3464a", rating, report_type: "official", report_id: "123", respondent_name: "Rep", comment: "=plain text, not a formula" }) });
describe("coaching feedback durable save", () => {
  beforeEach(() => {
    vi.clearAllMocks(); vi.stubEnv("REPORT_FEEDBACK_WEBHOOK_URL", "https://collector.test");
    mocks.auth.mockResolvedValue({ user: { email: "rep@insidesuccess.com" } });
    mocks.report.mockResolvedValue({ source_payload: {}, rep_name: "Rep", client_name: "Buyer" });
    mocks.save.mockResolvedValue({ conflict: false, fresh: true }); mocks.mark.mockResolvedValue(undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}")));
  });
  it("saves the original text before forwarding formula-safe plain text", async () => {
    expect((await POST(request())).status).toBe(200);
    expect(mocks.save).toHaveBeenCalledWith(expect.any(String), "rep@insidesuccess.com", expect.any(String), expect.objectContaining({ comment: "=plain text, not a formula" }));
    expect(mocks.save.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(fetch).mock.invocationCallOrder[0]);
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body)).comment).toBe("'=plain text, not a formula");
  });
  it("returns saved success when the Sheet forwarding times out; preserves an uncertain receipt", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("timeout")); expect(await (await POST(request())).json()).toEqual({ ok: true });
    expect(mocks.mark).toHaveBeenCalledWith(expect.any(String), "uncertain");
  });
  it("does not blindly append twice after a saved submission is retried", async () => {
    mocks.save.mockResolvedValue({ conflict: false, fresh: false }); expect((await POST(request())).status).toBe(200); expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects a conflicting replay or database failure before forwarding", async () => {
    mocks.save.mockResolvedValue({ conflict: true, fresh: false }); expect((await POST(request())).status).toBe(409); expect(fetch).not.toHaveBeenCalled();
    mocks.save.mockRejectedValue(new Error("database unavailable")); expect((await POST(request())).status).toBe(502); expect(fetch).not.toHaveBeenCalled();
  });
  it("keeps thumbs-up anonymous in the payload and does not add a negative record", async () => {
    expect((await POST(request("positive"))).status).toBe(200); expect(mocks.save).not.toHaveBeenCalled();
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))).toEqual(expect.objectContaining({ respondent_name: null, comment: null }));
  });
});

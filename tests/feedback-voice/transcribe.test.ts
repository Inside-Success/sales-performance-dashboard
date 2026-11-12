import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), report: vi.fn(), manual: vi.fn(), context: vi.fn(), reserve: vi.fn(), finish: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ getPerformanceCall: mocks.report, getManualFeedbackReport: mocks.manual, getAskSalesFaqFeedbackContext: mocks.context }));
vi.mock("@/lib/report-version", () => ({ isEnhancedReport: (v: string) => v === "enhanced" }));
vi.mock("@/lib/feedback-store", () => ({ reserveVoiceRequest: mocks.reserve, finishVoiceRequest: mocks.finish }));
import { POST } from "@/app/api/feedback/transcribe/route";
import { appendVoiceText, VOICE_MAX_BYTES } from "@/lib/feedback-voice";
const context = { kind: "coaching", reportType: "official", reportId: "123" };
function request(overrides: Record<string, unknown> = {}, bytes = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0])) {
  const form = new FormData();
  form.set("context", JSON.stringify(context)); form.set("requestId", "45be34d1-3228-44a8-a428-7f0c8bb3464a"); form.set("seconds", "5");
  form.set("audio", new File([bytes], "voice.webm", { type: "audio/webm" }));
  for (const [key, value] of Object.entries(overrides)) form.set(key, value instanceof Blob ? value : String(value));
  return new Request("https://dashboard.test/api/feedback/transcribe", { method: "POST", body: form });
}
describe("dedicated feedback transcription boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks(); vi.stubEnv("FEEDBACK_VOICE_ENABLED", "true"); vi.stubEnv("FEEDBACK_TRANSCRIPTION_OPENAI_API_KEY", "dedicated-feedback-key"); vi.stubEnv("OPENAI_API_KEY", "unrelated-key"); vi.stubEnv("ASK_SALES_FAQ_ENABLED", "true");
    mocks.auth.mockResolvedValue({ user: { email: "rep@insidesuccess.com" } });
    mocks.report.mockResolvedValue({ source_payload: { coaching_version: "enhanced" } }); mocks.manual.mockImplementation(mocks.report);
    mocks.context.mockResolvedValue({ messageId: "answer" }); mocks.reserve.mockResolvedValue({ state: "new" }); mocks.finish.mockResolvedValue(undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ text: "I did not refuse payment.", usage: { seconds: 5 } }), { headers: { "x-request-id": "provider-receipt" } })));
  });
  it("uses only the dedicated key and fixed transcription model, not the report or FAQ model", async () => {
    const result = await POST(request()); expect(result.status).toBe(200);
    const [, options] = vi.mocked(fetch).mock.calls[0];
    expect(options?.headers).toEqual({ Authorization: "Bearer dedicated-feedback-key" });
    expect((options?.body as FormData).get("model")).toBe("gpt-transcribe");
    expect(mocks.finish).toHaveBeenCalledWith(expect.any(String), "complete", "I did not refuse payment.", "provider-receipt", expect.anything(), expect.any(Number));
  });
  it("fails closed without its key and never falls back to OPENAI_API_KEY", async () => {
    vi.stubEnv("FEEDBACK_TRANSCRIPTION_OPENAI_API_KEY", ""); expect((await POST(request())).status).toBe(503); expect(fetch).not.toHaveBeenCalled();
  });
  it("requires an authorized signed-in account and rejects cross-origin requests", async () => {
    mocks.auth.mockResolvedValue(null); expect((await POST(request())).status).toBe(401);
    mocks.auth.mockResolvedValue({ user: { email: "other@gmail.com" } }); expect((await POST(request())).status).toBe(401);
    mocks.auth.mockResolvedValue({ user: { email: "rep@insidesuccess.com" } }); const req = request(); req.headers.set("origin", "https://other.test"); expect((await POST(req)).status).toBe(403); expect(fetch).not.toHaveBeenCalled();
  });
  it("checks FAQ ownership and feature access before paid work", async () => {
    const faq = JSON.stringify({ kind: "faq", conversationId: "chat", messageId: "answer" });
    mocks.context.mockResolvedValue(null); expect((await POST(request({ context: faq }))).status).toBe(404);
    expect(mocks.context).toHaveBeenCalledWith(expect.objectContaining({ viewerEmail: "rep@insidesuccess.com", messageId: "answer" })); expect(mocks.reserve).not.toHaveBeenCalled();
    vi.stubEnv("ASK_SALES_FAQ_ENABLED", "false"); expect((await POST(request({ context: faq }))).status).toBe(403); expect(fetch).not.toHaveBeenCalled();
  });
  it("supports owned FAQ answers and manual coaching reports without saving feedback", async () => {
    expect((await POST(request({ context: JSON.stringify({ kind: "faq", conversationId: "chat", messageId: "answer" }) }))).status).toBe(200);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ text: "Manual feedback." }))));
    expect((await POST(request({ context: JSON.stringify({ kind: "coaching", reportType: "manual", reportId: "public-id" }) }))).status).toBe(200); expect(mocks.manual).toHaveBeenCalledWith("public-id");
  });
  it("rejects legacy/missing reports before reservation", async () => {
    mocks.report.mockResolvedValue({ source_payload: { coaching_version: "legacy" } }); expect((await POST(request())).status).toBe(404); expect(mocks.reserve).not.toHaveBeenCalled();
  });
  it.each([{ seconds: "0" }, { seconds: "180" }, { requestId: "bad" }, { context: "not-json" }, { audio: new File([], "empty.webm", { type: "audio/webm" }) }])("rejects invalid input %j before charging", async (override) => {
    expect((await POST(request(override))).status).toBe(400); expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects oversized, false-container and unsupported files", async () => {
    expect((await POST(request({}, new Uint8Array(VOICE_MAX_BYTES + 1)))).status).toBe(413);
    expect((await POST(request({}, new Uint8Array([0, 0, 0, 0])))).status).toBe(400);
    expect((await POST(request({ audio: new File(["text"], "audio.txt", { type: "text/plain" }) }))).status).toBe(415); expect(fetch).not.toHaveBeenCalled();
  });
  it("reuses a completed receipt and never replays held, conflicting or rate-limited requests", async () => {
    mocks.reserve.mockResolvedValue({ state: "complete", text: "Saved words." }); expect(await (await POST(request())).json()).toEqual({ text: "Saved words." });
    for (const [state, code] of [["held", 409], ["conflict", 409], ["limited", 429]] as const) { mocks.reserve.mockResolvedValue({ state }); expect((await POST(request())).status).toBe(code); }
    expect(fetch).not.toHaveBeenCalled();
  });
  it("retains an uncertain outcome on timeout instead of automatically repeating paid work", async () => {
    vi.mocked(fetch).mockRejectedValue(new DOMException("timeout", "TimeoutError")); expect((await POST(request())).status).toBe(502);
    expect(fetch).toHaveBeenCalledOnce(); expect(mocks.finish).toHaveBeenCalledWith(expect.any(String), "uncertain", null, null, null, expect.any(Number));
  });
  it("handles provider errors and no-speech/oversized transcripts without fabricated text", async () => {
    for (const [body, status, expected] of [[{ error: "down" }, 503, 502], [{ text: "" }, 200, 422], [{ text: "a".repeat(4001) }, 200, 422]] as const) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }))); expect((await POST(request())).status).toBe(expected);
    }
  });
  it("appends words to the latest written comment without changing either meaning", () => {
    expect(appendVoiceText("Typed while transcribing.", " I did not refuse. ")).toBe("Typed while transcribing.\n\nI did not refuse.");
  });
});

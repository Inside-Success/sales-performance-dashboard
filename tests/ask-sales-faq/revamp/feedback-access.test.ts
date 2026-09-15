import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ save: vi.fn(), context: vi.fn(), sync: vi.fn() }));
vi.mock("@/auth", () => ({ auth: async () => ({ user: { email: "rep@example.invalid" } }) }));
vi.mock("@/lib/ask-sales-faq/access", () => ({ getAskSalesFaqAccess: () => ({ ok: true, viewerEmail: "rep@example.invalid", viewerName: "Rep" }) }));
vi.mock("@/lib/db", () => ({ saveAskSalesFaqFeedback: mocks.save, getAskSalesFaqFeedbackContext: mocks.context }));
vi.mock("@/lib/ask-sales-faq/feedback-sync", () => ({ syncAskSalesFaqFeedbackToSheet: mocks.sync }));
import { POST } from "@/app/api/ask-sales-faq/feedback/route";

const request = () => new NextRequest("https://preview.example.invalid/api/ask-sales-faq/feedback", {
  method: "POST", body: JSON.stringify({ messageId: "answer", conversationId: "chat", rating: "up" }),
});
describe("feedback ownership boundary", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it("does not look up or transmit feedback rejected by the storage ownership check", async () => {
    mocks.save.mockResolvedValue(false);
    const response = await POST(request());
    expect(response.status).toBe(404);
    expect(mocks.context).not.toHaveBeenCalled();
    expect(mocks.sync).not.toHaveBeenCalled();
  });
  it("keeps ordinary feedback working after an ownership match", async () => {
    mocks.save.mockResolvedValue(true);
    mocks.context.mockResolvedValue({ messageId: "answer" });
    mocks.sync.mockResolvedValue({ status: "skipped", reason: "not_configured" });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ viewerEmail: "rep@example.invalid" }));
    expect(mocks.sync).toHaveBeenCalledOnce();
  });
});

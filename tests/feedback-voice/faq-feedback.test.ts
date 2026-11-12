import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ once: vi.fn(), save: vi.fn(), context: vi.fn(), sync: vi.fn() }));
vi.mock("@/auth", () => ({ auth: async () => ({ user: { email: "rep@inside.test" } }) }));
vi.mock("@/lib/ask-sales-faq/access", () => ({ getAskSalesFaqAccess: () => ({ ok:true,viewerEmail:"rep@inside.test" }) }));
vi.mock("@/lib/feedback-store", () => ({ saveFaqDislikeOnce: mocks.once }));
vi.mock("@/lib/db", () => ({ saveAskSalesFaqFeedback: mocks.save, getAskSalesFaqFeedbackContext:mocks.context }));
vi.mock("@/lib/ask-sales-faq/feedback-sync", () => ({ syncAskSalesFaqFeedbackToSheet: mocks.sync }));
import { POST } from "@/app/api/ask-sales-faq/feedback/route";
const request = (rating="down") => new NextRequest("https://dashboard.test/api/ask-sales-faq/feedback",{method:"POST",body:JSON.stringify({submissionId:"45be34d1-3228-44a8-a428-7f0c8bb3464a",conversationId:"chat",messageId:"answer",rating,comment:"Feedback text"})});
beforeEach(() => { vi.clearAllMocks(); mocks.once.mockResolvedValue({found:true,fresh:true});mocks.save.mockResolvedValue(true);mocks.context.mockResolvedValue({});mocks.sync.mockResolvedValue({status:"sent"}); });
describe("FAQ dislike submission receipt", () => {
  it("saves once and only forwards a new owned dislike",async()=>{expect((await POST(request())).status).toBe(200);expect(mocks.once).toHaveBeenCalledWith("faq_feedback_45be34d1-3228-44a8-a428-7f0c8bb3464a","rep@inside.test","chat","answer","Feedback text");expect(mocks.sync).toHaveBeenCalledOnce();expect(mocks.save).not.toHaveBeenCalled();});
  it("does not repeat a Sheet forward on an exact retry",async()=>{mocks.once.mockResolvedValue({found:true,fresh:false});expect((await POST(request())).status).toBe(200);expect(mocks.sync).not.toHaveBeenCalled();});
  it("rejects context or payload mismatches before reading or sending feedback",async()=>{mocks.once.mockResolvedValue({found:false,fresh:false});expect((await POST(request())).status).toBe(404);expect(mocks.context).not.toHaveBeenCalled();expect(mocks.sync).not.toHaveBeenCalled();});
  it("leaves likes on the existing one-click save path",async()=>{expect((await POST(request("up"))).status).toBe(200);expect(mocks.save).toHaveBeenCalledOnce();expect(mocks.once).not.toHaveBeenCalled();});
});

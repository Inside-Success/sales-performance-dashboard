import { describe, expect, it } from "vitest";
import { resolveCoachingOfferFamily } from "@/lib/coaching-offer-context.cjs";
import { buildManualReportChatMessages, buildReportChatMessages } from "@/lib/report-chat";
import type { ManualFeedbackReport, PerformanceCall } from "@/lib/types";

describe("coaching offer routing", () => {
  it("recognizes the launch reality shows without applying their terms to existing shows", () => {
    expect(resolveCoachingOfferFamily({ showName: "Entrepreneurs Island" }).family).toBe("reality");
    expect(resolveCoachingOfferFamily({ meetingTitle: "Flipping for Fortune - Casting Call" }).family).toBe("reality");
    expect(resolveCoachingOfferFamily({ showName: "Women In Power" }).family).toBe("main_istv");
    expect(resolveCoachingOfferFamily({ showName: "Daymond John - Next Level CEO" }).family).toBe("next_level_ceo");
  });

  it("can identify a future reality format from multiple call cues", () => {
    const transcriptText = "This is our new reality show. Cast members compete in challenges. The reality show films on location.";
    expect(resolveCoachingOfferFamily({ meetingTitle: "Future Format - Casting Call", transcriptText }).family).toBe("reality");
    expect(resolveCoachingOfferFamily({ meetingTitle: "Future Format - Casting Call", transcriptText: "I saw a reality show once." }).family).toBe("unknown");
  });

  it("keeps an explicitly identified existing show even if another show is mentioned", () => {
    const transcriptText = "We also talked about Entrepreneurs Island, a reality show, and its cast challenges. That reality show is separate.";
    expect(resolveCoachingOfferFamily({ showName: "Legacy Makers", transcriptText }).family).toBe("main_istv");
  });

  it("gives both report chats current reality context only for reality calls", () => {
    const transcriptText = "This reality show has cast challenges. The reality show films on location.";
    const official = buildReportChatMessages({ id: 1, rep_slug: "rep", source_payload: { show_name: "Entrepreneurs Island" } } as unknown as PerformanceCall, transcriptText, []);
    const manual = buildManualReportChatMessages({ public_id: "report", rep_name: "Rep", status: "completed", source_payload: {} } as ManualFeedbackReport, transcriptText, []);
    const standard = buildReportChatMessages({ id: 2, rep_slug: "rep", source_payload: { show_name: "Women In Power" } } as unknown as PerformanceCall, transcriptText, []);
    expect(official[0].content).toContain("Reality Standard is $20,000");
    expect(manual[0].content).toContain("Reality Standard is $20,000");
    expect(standard[0].content).not.toContain("REALITY OFFER CONTEXT");
  });
});

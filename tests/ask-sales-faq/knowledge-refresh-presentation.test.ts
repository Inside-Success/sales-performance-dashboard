import { describe, expect, it } from "vitest";

import {
  getDailyRefreshHealth,
  getKnowledgeRefreshNextStep,
} from "@/lib/ask-sales-faq/knowledge-refresh-presentation";

describe("knowledge refresh admin presentation", () => {
  it("never reports a partially failed source run as fully successful", () => {
    expect(getDailyRefreshHealth({ hasRun: true, unavailableSources: 2, totalSources: 43 })).toEqual({
      tone: "warning",
      title: "Refresh completed with warnings",
      description: "2 of 43 sources were unavailable. Available sources were processed, failed sources remain visible, and no source was silently skipped.",
    });
  });

  it("reports a clean run only when every source was available", () => {
    expect(getDailyRefreshHealth({ hasRun: true, unavailableSources: 0, totalSources: 43 }).tone).toBe("good");
  });

  it("prioritizes a final publish decision over lower-priority review work", () => {
    expect(getKnowledgeRefreshNextStep({
      needsReview: 5,
      needsOwner: 2,
      approvedReady: 3,
      awaitingReleasePreparation: 1,
      readyToPublish: 1,
      publishing: 0,
    })).toMatchObject({ title: "A protected release is ready for your final decision", href: "#release-status" });
  });

  it("prioritizes an in-progress publication over every pending action", () => {
    expect(getKnowledgeRefreshNextStep({
      needsReview: 5,
      needsOwner: 2,
      approvedReady: 3,
      awaitingReleasePreparation: 1,
      readyToPublish: 1,
      publishing: 1,
    })).toMatchObject({ title: "Publication verification is running", href: "#release-status" });
  });

  it("shows a quiet state when no owner action is required", () => {
    expect(getKnowledgeRefreshNextStep({
      needsReview: 0,
      needsOwner: 0,
      approvedReady: 0,
      awaitingReleasePreparation: 0,
      readyToPublish: 0,
      publishing: 0,
    })).toMatchObject({ title: "Nothing needs your attention", href: null });
  });
});

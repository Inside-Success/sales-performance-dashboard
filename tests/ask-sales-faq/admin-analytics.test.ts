import { describe, expect, it } from "vitest";
import {
  classifyAskSalesFaqReview,
  normalizeAskSalesFaqAnalyticsDays,
  percentOf,
  shouldCreateAskSalesFaqMiss,
} from "@/lib/ask-sales-faq/admin-analytics";

describe("Ask Sales admin analytics", () => {
  it("does not treat successful V3 evidence answers as misses", () => {
    expect(
      shouldCreateAskSalesFaqMiss({
        outcome: "answer_from_evidence",
        needsRoute: false,
        errorClass: null,
      }),
    ).toBe(false);
  });

  it("keeps safe routes and runtime failures in the review queue", () => {
    expect(
      shouldCreateAskSalesFaqMiss({
        outcome: "route_from_evidence",
        needsRoute: true,
        errorClass: null,
      }),
    ).toBe(true);
    expect(
      shouldCreateAskSalesFaqMiss({
        outcome: "safe_fallback",
        needsRoute: false,
        errorClass: "provider_timeout",
      }),
    ).toBe(true);
  });

  it("classifies actual runtime state instead of question keywords", () => {
    expect(classifyAskSalesFaqReview({ rating: "down", outcome: "answer_from_evidence" }).category).toBe(
      "Negative feedback",
    );
    expect(classifyAskSalesFaqReview({ outcome: "abstain_unapproved" }).category).toBe("Coverage boundary");
    expect(classifyAskSalesFaqReview({ outcome: "answer_from_evidence" }).category).toBe("Answer audit");
  });

  it("normalizes supported windows and bounded percentages", () => {
    expect(normalizeAskSalesFaqAnalyticsDays("30", 7)).toBe(30);
    expect(normalizeAskSalesFaqAnalyticsDays("365", 7)).toBe(7);
    expect(percentOf(3, 4)).toBe(75);
    expect(percentOf(1, 0)).toBe(0);
  });
});

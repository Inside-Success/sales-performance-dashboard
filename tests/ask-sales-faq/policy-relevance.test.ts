import { describe, expect, it } from "vitest";
import {
  classifyPolicyDecisionRelation,
  policyDecisionProfile,
} from "@/lib/ask-sales-faq/policy-relevance";

describe("Ask Sales precision-first policy relevance", () => {
  it("does not match a dial-out SOP proposal to onboarding progress reporting", () => {
    const result = classifyPolicyDecisionRelation(
      policyDecisionProfile({
        text: "20% dial-out list: reps must follow the exact SOP linked in the daily dial-out post.",
        productScopes: ["product_agnostic"],
        domains: ["lead_ownership"],
        actions: ["contact"],
        entities: ["20 percent dial out", "SOP"],
      }),
      policyDecisionProfile({
        text: "Where should new reps post daily onboarding updates?",
        productScopes: ["product_agnostic"],
        domains: ["onboarding"],
        actions: ["onboard", "report"],
        entities: ["onboarding", "progress updates", "trainees"],
      }),
    );
    expect(result.relation).toBe("unrelated");
    expect(result.scopeCompatible).toBe(true);
  });

  it("recognizes two statements that answer the same episode-delivery decision", () => {
    const result = classifyPolicyDecisionRelation(
      policyDecisionProfile({
        text: "Episodes are normally delivered four to six months after filming.",
        domains: ["production"],
        actions: ["produce"],
        entities: ["episode delivery", "filming"],
      }),
      policyDecisionProfile({
        text: "How long after filming does a cast member receive the completed episode?",
        domains: ["production"],
        actions: ["produce"],
        entities: ["episode delivery", "filming"],
      }),
    );
    expect(result.relation).toBe("same_decision");
  });

  it("does not treat a generic product scope as relevance evidence", () => {
    const result = classifyPolicyDecisionRelation(
      policyDecisionProfile({
        text: "Daily finance drop-in call schedule and Zoom link",
        productScopes: ["product_agnostic"],
      }),
      policyDecisionProfile({
        text: "Daily onboarding progress updates",
        productScopes: ["product_agnostic"],
        domains: ["onboarding"],
        actions: ["report"],
        entities: ["onboarding progress"],
      }),
    );
    expect(result.relation).toBe("unrelated");
    expect(result.sharedSubjects).toEqual([]);
  });

  it("requires compatible product scopes for a same-decision match", () => {
    const result = classifyPolicyDecisionRelation(
      policyDecisionProfile({
        text: "Current package price",
        decisionKey: "current-package-price",
        productScopes: ["main_istv"],
      }),
      policyDecisionProfile({
        text: "Current package price",
        decisionKey: "current-package-price",
        productScopes: ["dj_nlceo"],
      }),
    );
    expect(result.relation).toBe("unrelated");
    expect(result.scopeCompatible).toBe(false);
  });

  it("does not treat broad show wording as the same decision without a matching action", () => {
    const result = classifyPolicyDecisionRelation(
      policyDecisionProfile({
        text: "Fit check for two doctors for America's Best Doctors. Neither has a commercial angle.",
      }),
      policyDecisionProfile({
        text: "Use the latest approved show list to verify which shows are currently available.",
        domains: ["shows_offers"],
        actions: ["verify"],
        entities: ["approved show list", "current shows"],
      }),
    );
    expect(result.relation).not.toBe("same_decision");
  });

  it("uses a matching action and numeric anchor for a specific discount decision", () => {
    const result = classifyPolicyDecisionRelation(
      policyDecisionProfile({
        text: "When can I offer the 20% discount?",
      }),
      policyDecisionProfile({
        text: "The 20% same-day discount is available only under the approved conditions.",
        domains: ["pricing"],
        actions: ["discount"],
        entities: ["20 percent discount", "same day"],
      }),
    );
    expect(result.relation).toBe("same_decision");
  });
});

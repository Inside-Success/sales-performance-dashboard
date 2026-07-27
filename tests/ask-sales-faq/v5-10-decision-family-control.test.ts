import { describe, expect, it } from "vitest";

import { resolveV4SystemicTurn } from "@/lib/ask-sales-faq/v4/systemic/turn";
import type { V4SystemicNeed, V4SystemicNeedDecision, V4SystemicQueryPlan } from "@/lib/ask-sales-faq/v4/systemic/types";
import { retrieveV510Policies, v510DecisionFamilyForNeed } from "@/lib/ask-sales-faq/v5-10/retrieval";
import { preferredV510ExactEvidenceSentence, resolveV510RouteKey } from "@/lib/ask-sales-faq/v5-10/runtime";

function need(text: string, overrides: Partial<V4SystemicNeed> = {}): V4SystemicNeed {
  return {
    id: "N1",
    text,
    authorityText: text,
    originalRequestText: text,
    retrievalQueries: [text],
    productScope: "unknown",
    domains: [],
    actions: [],
    entities: [],
    relation: "other",
    requestKind: "knowledge",
    ambiguity: "none",
    clarificationQuestion: "",
    ...overrides,
  };
}

function retrievalFor(question: string, item = need(question)) {
  const plan: V4SystemicQueryPlan = { needs: [item], conversationIntent: "answer", reasoningSummary: "V5.10 fixture." };
  return retrieveV510Policies(resolveV4SystemicTurn(question, []), plan);
}

function selectedForN1(question: string, item = need(question)) {
  return retrievalFor(question, item).candidates.filter((candidate) => candidate.needScores?.N1);
}

describe("Ask Sales V5.10 decision-family evidence controls", () => {
  it("keeps a blank application as a policy question and selects the missing-intake rule", () => {
    const question = "The applicant booked Call 1 but left the Typeform information incomplete. Do I cancel the audition?";
    const item = need(question, { relation: "procedure", entities: ["Call 1", "Typeform", "missing information"] });
    expect(v510DecisionFamilyForNeed(item)).toBe("missing_intake_call1");
    const candidates = selectedForN1(question, item);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].policy.decision).toMatch(/ask the right questions/i);
    expect(candidates[0].policy.decision).not.toMatch(/double[- ]book/i);
  });

  it("uses the authoritative 90-day no-show rule instead of a scheduling-conflict exception", () => {
    const question = "They no-showed the second call and booked another appointment tomorrow. Can we keep it?";
    const item = need(question, { relation: "permission", entities: ["Call 2", "no-show", "new appointment"] });
    expect(v510DecisionFamilyForNeed(item)).toBe("missed_call2_reapplication");
    const candidates = selectedForN1(question, item);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].policy.decision).toMatch(/90 days/i);
    expect(candidates[0].policy.source.approved_by.join(" ")).toMatch(/Rich/i);
    expect(candidates[0].policy.decision).not.toMatch(/ordinary scheduling conflicts/i);
    const retrieval = retrievalFor(question, item);
    const plan: V4SystemicQueryPlan = { needs: [item], conversationIntent: "answer", reasoningSummary: "Fixture." };
    expect(preferredV510ExactEvidenceSentence(item, plan, retrieval, [candidates[0].policy.id])?.text)
      .toMatch(/^No\. The prospect must reapply in 90 days/i);
  });

  it("does not convert a non-English owner into an English-capable applicant", () => {
    const question = "May we cast an owner who cannot speak English because the closer is bilingual?";
    const item = need(question, { relation: "eligibility", entities: ["owner", "non-English", "bilingual rep"] });
    expect(v510DecisionFamilyForNeed(item)).toBe("non_english_casting");
    const candidates = selectedForN1(question, item);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].policy.decision).toMatch(/cannot accommodate other languages/i);
    expect(candidates[0].policy.decision).toMatch(/part owner/i);
    expect(candidates[0].policy.decision).not.toMatch(/not automatically disqualified if they can comfortably/i);
  });

  it("preserves the clip/full-episode distinction in a YouTube follow-up", () => {
    const question = "We established that chopped reels are allowed on their own social accounts. Can they also upload the whole episode to YouTube?";
    const item = need(question, { relation: "permission", entities: ["clips", "full episode", "YouTube"] });
    expect(v510DecisionFamilyForNeed(item)).toBe("content_reuse_boundary");
    const candidates = selectedForN1(question, item);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].policy.decision).toMatch(/clips?/i);
    expect(candidates[0].policy.decision).toMatch(/full episode/i);
    expect(candidates[0].policy.decision).toMatch(/YouTube/i);
  });

  it("routes an unanswered passive FAQ to Sales Policy, never a live-action owner", () => {
    const question = "A lead's form is blank. Should I cancel Call 1?";
    const item = need(question, { requestKind: "knowledge" });
    const retrieval = retrievalFor(question, item);
    const decision: V4SystemicNeedDecision = {
      needId: "N1",
      lane: "route",
      evidenceRefs: [],
      answerSentences: [],
      routeKey: null,
      clarificationQuestion: "",
      confidence: 0,
      reason: "No exact answer.",
    };
    expect(resolveV510RouteKey(item, decision, retrieval)).toBe("sales_policy");
  });
});

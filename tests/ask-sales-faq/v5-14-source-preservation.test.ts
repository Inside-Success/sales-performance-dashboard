import { describe, expect, it } from "vitest";

import type { V4SystemicSourcePlan } from "@/lib/ask-sales-faq/v4/systemic/runtime";
import type { V4SystemicCandidate, V4SystemicNeed, V4SystemicPolicy, V4SystemicQueryPlan, V4SystemicRetrieval } from "@/lib/ask-sales-faq/v4/systemic/types";
import { V513_CURRENT_STUDIO_ADDRESS_POLICY } from "@/lib/ask-sales-faq/v5-13/knowledge";
import { recoverV514QuoteVerifiedAnswers, v514QuoteProjectable } from "@/lib/ask-sales-faq/v5-14/entailment";
import { retrieveV514Policies } from "@/lib/ask-sales-faq/v5-14/retrieval";
import { resolveV512Turn } from "@/lib/ask-sales-faq/v5-12/runtime";

function need(text: string, relation: V4SystemicNeed["relation"] = "other"): V4SystemicNeed {
  return {
    id: "N1", text, authorityText: text, originalRequestText: text, retrievalQueries: [text],
    productScope: "unknown", domains: [], actions: [], entities: [], relation,
    requestKind: "knowledge", ambiguity: "none", clarificationQuestion: "",
  };
}

function policy(id: string, answerability: V4SystemicPolicy["answerability"], decision: string): V4SystemicPolicy {
  return {
    ...V513_CURRENT_STUDIO_ADDRESS_POLICY,
    id, policy_key: id, decision_key: id, decision, answerability,
    title: id, question_families: [id], domains: [], actions: [], entities: [], search_text: decision,
    systemic: { ...V513_CURRENT_STUDIO_ADDRESS_POLICY.systemic, temporalRisk: "stable", sourceClass: "authoritative_operational_qna" },
  };
}

function retrieval(item: V4SystemicNeed, policies: V4SystemicPolicy[]): V4SystemicRetrieval {
  const candidates: V4SystemicCandidate[] = policies.map((entry, index) => ({
    policy: entry, rank: index + 1, score: 100, matchedQueries: [item.text], matchedTerms: [],
    lexicalScore: 100, familyScore: 0, characterScore: 0, structuredScore: 0,
    authorityScore: 3, relationScore: 24, semanticVectorScore: 0,
    matchedDecisionId: entry.id, matchedDecisionText: entry.decision,
    needScores: { [item.id]: {
      score: 100, rank: index + 1, lexicalScore: 100, familyScore: 0, characterScore: 0,
      structuredScore: 0, semanticVectorScore: 0, relationScore: 24,
      matchedDecisionId: entry.id, matchedDecisionText: entry.decision,
    } },
  }));
  return { query: item.text, turn: resolveV512Turn(item.text), corpusSize: policies.length, candidates, blockedTopicIds: [], blockedMatches: [], stageTimings: {} };
}

function routePlan(item: V4SystemicNeed): V4SystemicSourcePlan {
  return { needs: [{ needId: item.id, lane: "route", directPolicyIds: [], preferredPolicyIds: [], excludedConflictPolicyIds: [], reason: "conservative gate" }], reasoningSummary: "test" };
}

describe("Ask Sales V5.14 governed source preservation", () => {
  it("restores a governed VIP-benefits record that V5.13 pruned behind the platform boundary", () => {
    const item = need("What else does VIP include besides Amazon Prime submission?", "inclusion");
    const plan: V4SystemicQueryPlan = { needs: [item], conversationIntent: "answer", reasoningSummary: "test" };
    const turn = resolveV512Turn(item.text, [
      { role: "user", content: "Is VIP submitted just to Amazon Prime or all three Tier-1 platforms?" },
      { role: "assistant", content: "VIP includes submission to one Tier-1 platform." },
    ]);
    const result = retrieveV514Policies(turn, plan);
    const ids = result.candidates.filter((candidate) => candidate.needScores?.N1).map((candidate) => candidate.policy.id);
    expect(ids).toContain("claim_c9e50172a4cd057b");
    expect(ids).toContain("v511src-vip-platform-submission-boundary");
  });

  it("does not preserve an Amazon duration record for a publication-timing question", () => {
    const item = need("How long until the episode goes live on Amazon Prime?", "timing_start");
    const plan: V4SystemicQueryPlan = { needs: [item], conversationIntent: "answer", reasoningSummary: "test" };
    const result = retrieveV514Policies(resolveV512Turn(item.text), plan);
    const ids = result.candidates.filter((candidate) => candidate.needScores?.N1).map((candidate) => candidate.policy.id);
    expect(ids).not.toContain("claim_bada3f487526efb3");
  });

  it.each([
    ["What are reps allowed to say about ROI?", ["v514src-roi-claims-boundary"]],
    ["What is the SOP when I join Call 1 and the client is not there yet?", ["v3src_no_show_attempts_and_late_join"]],
    ["Do clients still receive six months of weekly social media support calls?", ["v514src-weekly-support-discontinued"]],
    ["Is VIP the highest main ISTV package?", ["claim_c9e50172a4cd057b"]],
    ["What email or SMS communication do I send when someone books from outbound dialing?", ["claim_3585b16e8ef643a9"]],
    ["Is the Mastermind for networking or learning marketing?", ["operational_c034c7d5961ca0e6"]],
  ])("binds the exact material family for %s", (question, expectedIds) => {
    const item = need(question, "procedure");
    const result = retrieveV514Policies(resolveV512Turn(item.text), { needs: [item], conversationIntent: "answer", reasoningSummary: "test" });
    expect(result.candidates.filter((candidate) => candidate.needScores?.N1).map((candidate) => candidate.policy.id).sort()).toEqual([...expectedIds].sort());
  });

  it("admits a complete exact governed family even when the model conservatively routes it", () => {
    const item = need("What are reps allowed to say about ROI?", "requirement");
    const plan: V4SystemicQueryPlan = { needs: [item], conversationIntent: "answer", reasoningSummary: "test" };
    const found = retrieveV514Policies(resolveV512Turn(item.text), plan);
    const recovered = recoverV514QuoteVerifiedAnswers(routePlan(item), plan, found, {});
    expect(recovered.sourcePlan.needs[0].lane).toBe("answer");
    expect(recovered.sourcePlan.needs[0].preferredPolicyIds).toEqual(["v514src-roi-claims-boundary"]);
  });

  it("does not force a vague price objection into unrelated scam guidance", () => {
    const item = need("price objection", "procedure");
    const result = retrieveV514Policies(resolveV512Turn(item.text), { needs: [item], conversationIntent: "answer", reasoningSummary: "test" });
    const ids = result.candidates.filter((candidate) => candidate.needScores?.N1).map((candidate) => candidate.policy.id);
    expect(ids).not.toEqual(expect.arrayContaining([
      "claim_1a9f0b652349f6de__a1",
      "claim_1a9f0b652349f6de__a2",
      "claim_1a9f0b652349f6de__a3",
      "claim_1a9f0b652349f6de__a4",
    ]));
  });

  it("does not let the discontinued broad training rule override a specific Money Mondays correction", () => {
    const item = need("The team confirmed Money Mondays is still active even though the old six-month training program ended.", "status");
    const result = retrieveV514Policies(resolveV512Turn(item.text), { needs: [item], conversationIntent: "answer", reasoningSummary: "test" });
    expect(result.candidates.filter((candidate) => candidate.needScores?.N1).map((candidate) => candidate.policy.id)).not.toEqual([
      "v514src-weekly-support-discontinued",
    ]);
  });

  it("admits one stable quote-verified authoritative support record without projecting the whole record", () => {
    const item = need("Which major streaming platforms are we on?", "inclusion");
    const support = policy("support", "route_or_support", "A broad record containing several unrelated statements.");
    const record = {
      policyId: support.id, verdict: "direct_answer", confidence: 0.95,
      supportingQuote: "Inside Success is available on Apple TV, Roku, Amazon Prime, and Tubi.",
      supportingQuoteVerified: true, supportingQuoteShapeVerified: true, uncoveredRequestElements: [],
    };
    expect(v514QuoteProjectable(item, retrieval(item, [support]), record)).toBe(true);
    const recovered = recoverV514QuoteVerifiedAnswers(routePlan(item), { needs: [item], conversationIntent: "answer", reasoningSummary: "test" }, retrieval(item, [support]), {
      needs: [{ needId: item.id, disposition: "answer", coverageMode: "single", preferredPolicyIds: [support.id], uncoveredRequestElements: [], materialConflict: false, records: [record] }],
    });
    expect(recovered.sourcePlan.needs[0]).toMatchObject({ lane: "answer", preferredPolicyIds: [support.id] });
  });

  it("keeps live-only and materially conflicting support records routed", () => {
    const item = need("How long until the episode goes live on Amazon Prime?", "timing_start");
    const support = {
      ...policy("duration", "route_or_support", "The episode remains on Amazon Prime for a minimum of three years."),
      systemic: { ...V513_CURRENT_STUDIO_ADDRESS_POLICY.systemic, temporalRisk: "live_only" as const, sourceClass: "authoritative_operational_qna" as const },
    };
    const record = {
      policyId: support.id, verdict: "direct_answer", confidence: 0.99,
      supportingQuote: support.decision, supportingQuoteVerified: true, supportingQuoteShapeVerified: true, uncoveredRequestElements: [],
    };
    expect(v514QuoteProjectable(item, retrieval(item, [support]), record)).toBe(false);
  });

  it("blocks a model-selected show-live snapshot even when legacy metadata called it stable answer evidence", () => {
    const item = need("Is America's Authors live now?", "status");
    const support = policy("show-status", "answer_evidence", "America's Authors was not yet live at the time of the source thread.");
    const selected: V4SystemicSourcePlan = {
      needs: [{ needId: item.id, lane: "answer", directPolicyIds: [support.id], preferredPolicyIds: [support.id], excludedConflictPolicyIds: [], reason: "model selected" }],
      reasoningSummary: "test",
    };
    const recovered = recoverV514QuoteVerifiedAnswers(selected, { needs: [item], conversationIntent: "answer", reasoningSummary: "test" }, retrieval(item, [support]), {});
    expect(recovered.sourcePlan.needs[0].lane).toBe("route");
    expect(recovered.unsafeTemporalSelectionsBlocked).toBe(1);
  });
});

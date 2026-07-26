import { describe, expect, it } from "vitest";

import type { V3Provider } from "@/lib/ask-sales-faq/v3/types";
import type { V4SystemicSourcePlan } from "@/lib/ask-sales-faq/v4/systemic/runtime";
import { resolveV4SystemicTurn } from "@/lib/ask-sales-faq/v4/systemic/turn";
import type { V4SystemicNeed, V4SystemicQueryPlan } from "@/lib/ask-sales-faq/v4/systemic/types";
import { getV5KnowledgeSnapshot } from "@/lib/ask-sales-faq/v5/knowledge";
import { retrieveV5Policies } from "@/lib/ask-sales-faq/v5/retrieval";
import { refineV55SourcePlanWithRawEntailment } from "@/lib/ask-sales-faq/v5-5/entailment";
import { findV55PublishCollisions } from "@/lib/ask-sales-faq/v5-5/publisher-collisions";
import { retrieveV55Policies } from "@/lib/ask-sales-faq/v5-5/retrieval";
import { refineV55QueryPlan } from "@/lib/ask-sales-faq/v5-5/runtime";

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

function planFor(item: V4SystemicNeed): V4SystemicQueryPlan {
  return { needs: [item], conversationIntent: "answer", reasoningSummary: "V5.5 raw entailment fixture" };
}

function deferredSourcePlan(): V4SystemicSourcePlan {
  return {
    needs: [{
      needId: "N1",
      lane: "route",
      directPolicyIds: [],
      preferredPolicyIds: [],
      excludedConflictPolicyIds: [],
      reason: "Deferred to raw entailment.",
    }],
    reasoningSummary: "Deferred.",
  };
}

function providerFor(verdict: "direct_answer" | "partial_or_conditional" | "different_question", conflict = false, validQuote = true): V3Provider {
  return async (input) => {
    const payload = JSON.parse(input.user) as { needs: Array<{ need_id: string; records: Array<{ ref: string; raw_approved_record: string }> }> };
    const ref = payload.needs[0]?.records[0]?.ref || null;
    const quote = validQuote ? payload.needs[0]?.records[0]?.raw_approved_record.slice(0, 120) : "This sentence is not in the approved record.";
    return {
      output: input.parse(JSON.stringify({
        needs: [{
          need_id: "N1",
          disposition: verdict === "direct_answer" && !conflict ? "answer" : "route",
          preferred_ref: verdict === "direct_answer" && !conflict ? ref : null,
          material_conflict: conflict,
          records: ref ? [{
            ref,
            verdict,
            confidence: 0.97,
            supporting_quote: quote,
            uncovered_request_elements: verdict === "direct_answer" ? [] : ["the exact requested decision"],
            specific_difference: verdict === "direct_answer" ? "The raw record directly answers the raw question." : "The record answers a neighboring decision.",
          }] : [],
          reason: conflict ? "Direct records conflict." : "Raw comparison completed.",
        }],
        reasoning_summary: "Raw question and record were compared directly.",
      })),
      provider: "deepseek",
      model: "test-model",
      attempts: [],
    };
  };
}

describe("Ask Sales V5.5 raw-record entailment and publish-time collisions", () => {
  it("admits one raw record only when the model says it directly answers the exact raw question", async () => {
    const text = "Can a rep edit the approved contract to add custom terms requested by a prospect?";
    const item = need(text, {
      relation: "permission",
      requestKind: "operational_action",
      domains: ["contract"],
      actions: ["edit", "add custom terms"],
      entities: ["approved contract", "custom terms"],
    });
    const plan = planFor(item);
    const turn = resolveV4SystemicTurn(text, []);
    const retrieval = retrieveV5Policies(turn, plan);
    const result = await refineV55SourcePlanWithRawEntailment({
      turn,
      plan,
      retrieval,
      sourcePlan: deferredSourcePlan(),
      provider: providerFor("direct_answer"),
    });
    expect(result.sourcePlan.needs[0]).toMatchObject({
      lane: "answer",
      preferredPolicyIds: [expect.any(String)],
      modelDisposition: "answer",
    });
    expect(result.metadata).toMatchObject({ status: "complete", answeredNeedCount: 1 });
  }, 10_000);

  it("routes a topic neighbor or material conflict even when retrieval proposed it", async () => {
    const text = "Can a rep edit the approved contract to add custom terms requested by a prospect?";
    const item = need(text, { relation: "permission", domains: ["contract"], actions: ["edit"], entities: ["contract"] });
    const plan = planFor(item);
    const turn = resolveV4SystemicTurn(text, []);
    const retrieval = retrieveV5Policies(turn, plan);
    for (const provider of [providerFor("different_question"), providerFor("direct_answer", true)]) {
      const result = await refineV55SourcePlanWithRawEntailment({
        turn,
        plan,
        retrieval,
        sourcePlan: deferredSourcePlan(),
        provider,
      });
      expect(result.sourcePlan.needs[0]).toMatchObject({ lane: "route", preferredPolicyIds: [] });
    }
  });

  it("rejects a direct verdict whose claimed supporting quote is absent from the selected raw record", async () => {
    const text = "Can a rep edit the approved contract to add custom terms requested by a prospect?";
    const item = need(text, { relation: "permission", domains: ["contract"], actions: ["edit"], entities: ["contract"] });
    const plan = planFor(item);
    const turn = resolveV4SystemicTurn(text, []);
    const result = await refineV55SourcePlanWithRawEntailment({
      turn,
      plan,
      retrieval: retrieveV5Policies(turn, plan),
      sourcePlan: deferredSourcePlan(),
      provider: providerFor("direct_answer", false, false),
    });
    expect(result.sourcePlan.needs[0]).toMatchObject({ lane: "route", preferredPolicyIds: [] });
    expect(result.metadata.needs?.[0]?.records[0]).toMatchObject({
      verdict: "partial_or_conditional",
      supportingQuoteVerified: false,
    });
  });

  it("does not treat installment amounts as proof of a package or PIF price", async () => {
    const text = "What are the current ISTV prices?";
    const item = need(text, { productScope: "main_istv", domains: ["pricing"] });
    const plan = planFor(item);
    const turn = resolveV4SystemicTurn(text, []);
    const retrieval = retrieveV55Policies(turn, plan);
    const sourceCandidate = retrieval.candidates.find((candidate) => candidate.policy.answerability === "answer_evidence" && candidate.needScores?.N1);
    expect(sourceCandidate).toBeTruthy();
    const paymentPlanDecision = "Main ISTV listed payment plans: Lite is 4 x $3,000, Standard is 4 x $5,000, and VIP is 4 x $7,500.";
    const fixtureCandidate = { ...sourceCandidate!, policy: { ...sourceCandidate!.policy, decision: paymentPlanDecision } };
    const fixtureRetrieval = { ...retrieval, candidates: [fixtureCandidate] };
    const provider: V3Provider = async (input) => ({
      output: input.parse(JSON.stringify({
        needs: [{
          need_id: "N1",
          disposition: "answer",
          preferred_ref: fixtureCandidate.policy.id,
          material_conflict: false,
          records: [{
            ref: fixtureCandidate.policy.id,
            verdict: "direct_answer",
            confidence: 0.99,
            supporting_quote: paymentPlanDecision,
            uncovered_request_elements: [],
            specific_difference: "The model incorrectly called installment amounts package prices.",
          }],
          reason: "Incorrect fact-type claim fixture.",
        }],
        reasoning_summary: "Fixture.",
      })),
      provider: "deepseek",
      model: "test-model",
      attempts: [],
    });
    const result = await refineV55SourcePlanWithRawEntailment({
      turn,
      plan,
      retrieval: fixtureRetrieval,
      sourcePlan: deferredSourcePlan(),
      provider,
    });
    expect(result.sourcePlan.needs[0]).toMatchObject({ lane: "route", preferredPolicyIds: [] });
    expect(result.metadata).toMatchObject({ status: "no_candidate_records", candidateCount: 0 });
  });

  it("does not treat a show catalog as proof of which awards exist", async () => {
    const text = "What awards are presented at the award show?";
    const item = need(text, { relation: "inclusion", domains: ["awards"], entities: ["award show"] });
    const plan = planFor(item);
    const turn = resolveV4SystemicTurn(text, []);
    const retrieval = retrieveV55Policies(turn, plan);
    const sourceCandidate = retrieval.candidates.find((candidate) => candidate.needScores?.N1);
    expect(sourceCandidate).toBeTruthy();
    const showCatalog = "The available shows are Inside Success TV, America's Real Deal, and Next Level CEO.";
    const fixtureCandidate = { ...sourceCandidate!, policy: { ...sourceCandidate!.policy, decision: showCatalog } };
    const result = await refineV55SourcePlanWithRawEntailment({
      turn,
      plan,
      retrieval: { ...retrieval, candidates: [fixtureCandidate] },
      sourcePlan: deferredSourcePlan(),
      provider: providerFor("direct_answer"),
    });
    expect(result.sourcePlan.needs[0]).toMatchObject({ lane: "route", preferredPolicyIds: [] });
    expect(result.metadata).toMatchObject({ status: "no_candidate_records", candidateCount: 0 });
  });

  it("does not confuse Amazon being limited to VIP with VIP being limited to Amazon", async () => {
    const text = "Is VIP submitted to just Amazon or all three platforms?";
    const item = need(text, { relation: "inclusion", domains: ["production"], entities: ["VIP", "Amazon", "platforms"] });
    const plan = planFor(item);
    const turn = resolveV4SystemicTurn(text, []);
    const retrieval = retrieveV55Policies(turn, plan);
    const sourceCandidate = retrieval.candidates.find((candidate) => candidate.needScores?.N1);
    expect(sourceCandidate).toBeTruthy();
    const reversedRelationship = "Amazon placement is only for VIP licenses and is not guaranteed.";
    const fixtureCandidate = { ...sourceCandidate!, policy: { ...sourceCandidate!.policy, decision: reversedRelationship } };
    const result = await refineV55SourcePlanWithRawEntailment({
      turn,
      plan,
      retrieval: { ...retrieval, candidates: [fixtureCandidate] },
      sourcePlan: deferredSourcePlan(),
      provider: providerFor("direct_answer"),
    });
    expect(result.sourcePlan.needs[0]).toMatchObject({ lane: "route", preferredPolicyIds: [] });
    expect(result.metadata).toMatchObject({ status: "no_candidate_records", candidateCount: 0 });
  });

  it("does not publish a statement explicitly limited to right now as durable policy", async () => {
    const text = "Are VIP episodes submitted only to Amazon or to any one of the approved platforms?";
    const item = need(text, { relation: "inclusion", domains: ["production"], entities: ["VIP", "platform"] });
    const plan = planFor(item);
    const turn = resolveV4SystemicTurn(text, []);
    const retrieval = retrieveV55Policies(turn, plan);
    const sourceCandidate = retrieval.candidates.find((candidate) => candidate.needScores?.N1);
    expect(sourceCandidate).toBeTruthy();
    const fixtureCandidate = {
      ...sourceCandidate!,
      policy: { ...sourceCandidate!.policy, decision: 'VIP was only Amazon "right now."' },
    };
    let providerCalls = 0;
    const provider: V3Provider = async (input) => {
      providerCalls += 1;
      return providerFor("direct_answer")(input);
    };
    const result = await refineV55SourcePlanWithRawEntailment({
      turn,
      plan,
      retrieval: { ...retrieval, candidates: [fixtureCandidate] },
      sourcePlan: deferredSourcePlan(),
      provider,
    });
    expect(providerCalls).toBe(0);
    expect(result.sourcePlan.needs[0]).toMatchObject({ lane: "route", preferredPolicyIds: [] });
  });

  it("does not apply a generic criminal-history rule to an unspecified prison scenario", async () => {
    const text = "Should I disqualify someone who says they have been in prison?";
    const item = need(text, { relation: "eligibility", domains: ["casting"], entities: ["prison"] });
    const plan = planFor(item);
    const turn = resolveV4SystemicTurn(text, []);
    const retrieval = retrieveV55Policies(turn, plan);
    const sourceCandidate = retrieval.candidates.find((candidate) => candidate.needScores?.N1);
    expect(sourceCandidate).toBeTruthy();
    const genericHistoryRule = "A candidate with a criminal past may proceed if a sales rep believes they should be featured.";
    const fixtureCandidate = { ...sourceCandidate!, policy: { ...sourceCandidate!.policy, decision: genericHistoryRule } };
    const result = await refineV55SourcePlanWithRawEntailment({
      turn,
      plan,
      retrieval: { ...retrieval, candidates: [fixtureCandidate] },
      sourcePlan: deferredSourcePlan(),
      provider: providerFor("direct_answer"),
    });
    expect(result.sourcePlan.needs[0]).toMatchObject({ lane: "route", preferredPolicyIds: [] });
    expect(result.metadata).toMatchObject({ status: "no_candidate_records", candidateCount: 0 });
  });

  it("does not invoke the entailment model for a live owner action", async () => {
    const text = "Can someone trace this prospect's pending ACH transaction?";
    const item = need(text, { requestKind: "operational_action", forcedRouteKey: "finance" });
    const plan = planFor(item);
    const turn = resolveV4SystemicTurn(text, []);
    const baseProvider = providerFor("direct_answer");
    let providerCalls = 0;
    const provider: V3Provider = async (input) => {
      providerCalls += 1;
      return baseProvider(input);
    };
    const result = await refineV55SourcePlanWithRawEntailment({
      turn,
      plan,
      retrieval: retrieveV5Policies(turn, plan),
      sourcePlan: deferredSourcePlan(),
      provider,
    });
    expect(providerCalls).toBe(0);
    expect(result.sourcePlan.needs[0]).toMatchObject({ lane: "route", preferredPolicyIds: [] });
  });

  it("allows a bounded non-conflicting record set only for a genuine SOP overview", async () => {
    const text = "What is the approved guidance for the 20 Percent Dial-Out SOP?";
    const item = need(text, { relation: "procedure", domains: ["compliance"], entities: ["20 Percent Dial-Out SOP"] });
    const plan = planFor(item);
    const turn = resolveV4SystemicTurn(text, []);
    const retrieval = retrieveV55Policies(turn, plan);
    const provider: V3Provider = async (input) => {
      const payload = JSON.parse(input.user) as { needs: Array<{ records: Array<{ ref: string; raw_approved_record: string }> }> };
      const records = payload.needs[0].records.slice(0, 2);
      return {
        output: input.parse(JSON.stringify({
          needs: [{
            need_id: "N1",
            disposition: "answer",
            coverage_mode: "collective",
            preferred_refs: records.map((record) => record.ref),
            uncovered_request_elements: [],
            material_conflict: false,
            records: records.map((record) => ({
              ref: record.ref,
              verdict: "partial_or_conditional",
              confidence: 0.95,
              supporting_quote: record.raw_approved_record.slice(0, 180),
              uncovered_request_elements: ["other approved SOP rules"],
              specific_difference: "This record contributes one independently supported SOP rule.",
            })),
            reason: "The bounded set supplies non-conflicting parts of the requested SOP overview.",
          }],
          reasoning_summary: "Collective overview fixture.",
        })),
        provider: "deepseek",
        model: "test-model",
        attempts: [],
      };
    };
    const result = await refineV55SourcePlanWithRawEntailment({
      turn,
      plan,
      retrieval,
      sourcePlan: deferredSourcePlan(),
      provider,
    });
    expect(result.sourcePlan.needs[0]).toMatchObject({
      lane: "answer",
      preferredPolicyIds: [expect.any(String), expect.any(String)],
    });
    expect(result.metadata.needs?.[0]).toMatchObject({ coverageMode: "collective" });
  });

  it("recovers a genuine overview when verified atomic rules are rejected only for lacking one monolithic document", async () => {
    const text = "What is the approved guidance for the 20 Percent Dial-Out SOP?";
    const item = need(text, { relation: "procedure", domains: ["compliance"], entities: ["20 Percent Dial-Out SOP"] });
    const plan = planFor(item);
    const turn = resolveV4SystemicTurn(text, []);
    const retrieval = retrieveV55Policies(turn, plan);
    const provider: V3Provider = async (input) => {
      const payload = JSON.parse(input.user) as { needs: Array<{ records: Array<{ ref: string; raw_approved_record: string }> }> };
      const records = payload.needs[0].records.slice(0, 2);
      return {
        output: input.parse(JSON.stringify({
          needs: [{
            need_id: "N1",
            disposition: "route",
            coverage_mode: "none",
            preferred_refs: [],
            uncovered_request_elements: ["No single record contains the complete SOP document."],
            material_conflict: false,
            records: records.map((record) => ({
              ref: record.ref,
              verdict: "partial_or_conditional",
              supporting_quote: record.raw_approved_record.slice(0, 180),
              uncovered_request_elements: ["This is one atomic rule, not a complete SOP document."],
              specific_difference: "The record contributes one verified part of the approved overview.",
            })),
            reason: "No single record contains the comprehensive SOP as a whole.",
          }],
          reasoning_summary: "The records are separately relevant but not monolithic.",
        })),
        provider: "deepseek",
        model: "test-model",
        attempts: [],
      };
    };
    const result = await refineV55SourcePlanWithRawEntailment({
      turn,
      plan,
      retrieval,
      sourcePlan: deferredSourcePlan(),
      provider,
    });
    expect(result.sourcePlan.needs[0]).toMatchObject({
      lane: "answer",
      preferredPolicyIds: [expect.any(String), expect.any(String)],
      reason: expect.stringContaining("verified"),
    });
  });

  it("expands one selected atomic rule to its canonical publisher siblings for an approved overview", async () => {
    const text = "What is the approved guidance for the 20 Percent Dial-Out SOP?";
    const item = need(text, { relation: "procedure", domains: ["compliance"], entities: ["20 Percent Dial-Out SOP"] });
    const plan = planFor(item);
    const turn = resolveV4SystemicTurn(text, []);
    const retrieval = retrieveV55Policies(turn, plan);
    const result = await refineV55SourcePlanWithRawEntailment({
      turn,
      plan,
      retrieval,
      sourcePlan: deferredSourcePlan(),
      provider: providerFor("direct_answer"),
    });
    expect(result.sourcePlan.needs[0]?.lane).toBe("answer");
    expect(result.sourcePlan.needs[0]?.preferredPolicyIds.length).toBeGreaterThan(1);
    expect(result.sourcePlan.needs[0]?.reason).toContain("publisher siblings");
  });

  it("registers incompatible same-key records for publisher review instead of runtime authority choice", () => {
    const base = getV5KnowledgeSnapshot().policies.find((policy) => policy.answerability === "answer_evidence")!;
    const policies = [
      { ...base, id: "collision_a", decision_key: "test.same-key", decision: "Reps may offer this option.", answerability: "answer_evidence" as const },
      { ...base, id: "collision_b", decision_key: "test.same-key", decision: "Reps must not offer this option.", answerability: "route_or_support" as const },
    ];
    expect(findV55PublishCollisions(policies)).toEqual([expect.objectContaining({
      decisionKey: "test.same-key",
      policyIds: ["collision_a", "collision_b"],
      answerEvidencePolicyIds: ["collision_a"],
    })]);
  });

  it("keeps distinct atomic siblings from one governed article available to separate needs", () => {
    const question = "What are the current ISTV prices and payment plans?";
    const turn = resolveV4SystemicTurn(question, []);
    const plan: V4SystemicQueryPlan = {
      conversationIntent: "answer",
      reasoningSummary: "Composite governed reference fixture.",
      needs: [
        need("What are the current ISTV prices?", { id: "N1", productScope: "main_istv", domains: ["pricing"] }),
        need("What are the current ISTV payment plans?", { id: "N2", productScope: "main_istv", domains: ["payments"] }),
      ],
    };
    const retrieval = retrieveV55Policies(turn, plan);
    const priceRecord = retrieval.candidates.find((candidate) => /\| Lite \| \$12,000 \|/.test(candidate.policy.decision));
    const planRecord = retrieval.candidates.find((candidate) => /Lite \| 4 x \$3,000/.test(candidate.policy.decision));
    expect(priceRecord?.needScores?.N1).toBeTruthy();
    expect(planRecord?.needScores?.N2).toBeTruthy();
    expect(retrieval.stageTimings.v55PublisherSiblingExpansionCount).toBeGreaterThan(0);
  });

  it("recovers literal raw-record recall when the older duration matcher misses a boundary answer", () => {
    const question = "How long does a client have to upgrade their package?";
    const turn = resolveV4SystemicTurn(question, []);
    const plan = planFor(need(question, { relation: "duration", domains: ["upgrade"], actions: ["upgrade"], entities: ["package"] }));
    const retrieval = retrieveV55Policies(turn, plan);
    const upgradeDecisions = retrieval.candidates
      .filter((candidate) => candidate.needScores?.N1 && /upgrade/i.test(candidate.policy.decision))
      .map((candidate) => candidate.policy.decision);
    expect(upgradeDecisions.some((decision) =>
      /clients? can upgrade (?:their package )?(?:up )?until filming/i.test(decision) ||
      /may upgrade to vip at any time before filming/i.test(decision),
    )).toBe(true);
    expect(retrieval.stageTimings.v55RawLexicalRecallCount).toBeGreaterThan(0);
  });

  it("retrieves with the resolved subject instead of a pronoun-only follow-up", () => {
    const turn = resolveV4SystemicTurn("What else does it include?", [
      { role: "user", content: "Is VIP submitted to only Amazon or all three platforms?" },
      { role: "assistant", content: "VIP is submitted to one approved Tier-1 platform." },
    ]);
    expect(turn.usedImmediateContext).toBe(true);
    const retrieval = retrieveV55Policies(turn, planFor(need(
      "What else is included in the VIP program beyond its Tier-1 platform submission?",
      {
        authorityText: "What else does it include?",
        originalRequestText: "What else does it include?",
        relation: "inclusion",
        productScope: "main_istv",
        domains: ["offers"],
        entities: ["VIP"],
      },
    )));
    expect(retrieval.candidates.find((candidate) => candidate.policy.id === "claim_c9e50172a4cd057b")?.needScores?.N1).toBeTruthy();
  });

  it("lets trusted authoritative support records reach raw entailment without promoting them globally", () => {
    const sectionQuestion = "Does Section 9 stop a client from creating future personal-brand or YouTube content?";
    const sectionTurn = resolveV4SystemicTurn(sectionQuestion, []);
    const sectionRetrieval = retrieveV55Policies(sectionTurn, planFor(need(sectionQuestion, {
      relation: "permission",
      domains: ["contract"],
      entities: ["Section 9"],
    })));
    expect(sectionRetrieval.candidates.find((candidate) => candidate.policy.id === "operational_5a56ac50eb2233fc")?.needScores?.N1).toBeTruthy();
    expect(sectionRetrieval.candidates.find((candidate) => candidate.policy.id === "operational_5a56ac50eb2233fc")?.policy.answerability).toBe("route_or_support");

    const internationalQuestion = "Do cast members have to live in the United States to qualify?";
    const internationalTurn = resolveV4SystemicTurn(internationalQuestion, []);
    const internationalRetrieval = retrieveV55Policies(internationalTurn, planFor(need(internationalQuestion, {
      relation: "requirement",
      domains: ["eligibility"],
      entities: ["cast members", "United States"],
    })));
    expect(internationalRetrieval.candidates.find((candidate) => candidate.policy.id === "operational_d5ba32a6d0936b0b")?.needScores?.N1).toBeTruthy();
  }, 10_000);

  it("keeps reusable unscoped Slack rules visible to a product-scoped exact question", () => {
    const voiceQuestion = "Does a prospect's prior appearance on The Voice automatically create an FTC or network conflict for ISTV?";
    const voiceTurn = resolveV4SystemicTurn(voiceQuestion, []);
    const voiceRetrieval = retrieveV55Policies(voiceTurn, planFor(need(voiceQuestion, {
      productScope: "main_istv",
      relation: "requirement",
      domains: ["legal"],
      entities: ["The Voice", "FTC", "network conflict"],
    })));
    expect(voiceRetrieval.candidates.find((candidate) => candidate.policy.id === "operational_ec3c61f817651dc4")?.needScores?.N1).toBeTruthy();

  });

  it("normalizes outside-the-US wording to authoritative international eligibility evidence", () => {
    const question = "Determine whether individuals located outside the U.S. are eligible to be cast.";
    const turn = resolveV4SystemicTurn(question, []);
    const retrieval = retrieveV55Policies(turn, planFor(need(question, {
      relation: "permission",
      domains: ["casting"],
      entities: ["someone outside the U.S."],
    })));
    expect(retrieval.candidates.find((candidate) => candidate.policy.id === "operational_d5ba32a6d0936b0b")?.needScores?.N1).toBeTruthy();
  });

  it("keeps stable custom-plan and rescheduling permission questions out of live Finance routing", () => {
    const question = "Can I create a cheaper custom plan, or can the applicant reschedule?";
    const turn = resolveV4SystemicTurn(question, []);
    const plan: V4SystemicQueryPlan = {
      conversationIntent: "answer",
      reasoningSummary: "Permission fixture.",
      needs: [
        need("Can I create a cheaper custom plan?", { id: "N1", relation: "payment_option", requestKind: "operational_action", forcedRouteKey: "finance" }),
        need("Can the applicant reschedule?", { id: "N2", relation: "permission", requestKind: "operational_action", forcedRouteKey: "finance" }),
      ],
    };
    expect(refineV55QueryPlan(plan, turn).needs).toEqual([
      expect.objectContaining({ id: "N1", requestKind: "knowledge", forcedRouteKey: null }),
      expect.objectContaining({ id: "N2", requestKind: "knowledge", forcedRouteKey: null }),
    ]);
  });

  it("keeps the authoritative Sunday dial-out boundary publishable for broad outbound guidance", () => {
    expect(getV5KnowledgeSnapshot().policies.find((policy) => policy.id === "claim_bcb347d7f470a180")).toMatchObject({
      answerability: "answer_evidence",
      decision_key: "sunday-dial-out",
    });
    const question = "What is the approved guidance for the 20 Percent Dial-Out SOP?";
    const turn = resolveV4SystemicTurn(question, []);
    const retrieval = retrieveV55Policies(turn, planFor(need(question, {
      relation: "procedure",
      domains: ["compliance"],
      entities: ["20 Percent Dial-Out SOP"],
    })));
    expect(retrieval.candidates.find((candidate) => candidate.policy.id === "claim_bcb347d7f470a180")?.needScores?.N1).toBeTruthy();
  });
});

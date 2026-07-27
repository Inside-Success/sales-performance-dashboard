import { describe, expect, it } from "vitest";

import { resolveV4SystemicTurn } from "@/lib/ask-sales-faq/v4/systemic/turn";
import type { V4SystemicNeed, V4SystemicQueryPlan } from "@/lib/ask-sales-faq/v4/systemic/types";
import { rawEntailmentCandidateExclusionReasons } from "@/lib/ask-sales-faq/v5-5/entailment";
import { refineV59SourcePlanWithRawEntailment } from "@/lib/ask-sales-faq/v5-9/entailment";
import { retrieveV59Policies } from "@/lib/ask-sales-faq/v5-9/retrieval";
import { refineV59QueryPlan } from "@/lib/ask-sales-faq/v5-9/runtime";
import { resolveV59Turn } from "@/lib/ask-sales-faq/v5-9/turn";

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
  return { needs: [item], conversationIntent: "answer", reasoningSummary: "V5.9 fixture." };
}

describe("Ask Sales V5.9 full-record and conversational context controls", () => {
  it("keeps a failed-link ownership policy answerable but routes an explicit CRM transfer to Sales Tech", () => {
    const policyQuestion = "My reschedule link failed, so the applicant booked with another casting manager. Should I move the appointment back to my calendar?";
    const mistakenAction = need(policyQuestion, { requestKind: "operational_action", forcedRouteKey: "sales_tech" });
    expect(refineV59QueryPlan(planFor(mistakenAction), resolveV4SystemicTurn(policyQuestion, [])).needs[0]).toMatchObject({
      requestKind: "knowledge",
      forcedRouteKey: null,
    });

    const transfer = "Can you transfer my Keap leads into HubSpot and tell me when the training is scheduled?";
    expect(refineV59QueryPlan(planFor(need(transfer)), resolveV4SystemicTurn(transfer, [])).needs[0]).toMatchObject({
      requestKind: "operational_action",
      forcedRouteKey: "sales_tech",
    });
  });

  it("resolves short it/they follow-ups only against the immediate prior user question", () => {
    const question = "So can I approve it based only on what they told me?";
    const history = [
      { role: "user" as const, content: "A genuine family emergency means my prospect cannot complete Call 2 before the cohort closes. Is an extension possible?" },
      { role: "assistant" as const, content: "An exception may be possible with evidence." },
      { role: "user" as const, content: question },
    ];
    const resolved = resolveV59Turn(question, history);
    expect(resolved).toMatchObject({ kind: "follow_up", usedImmediateContext: true });
    expect(resolved.standaloneQuestion).toContain("genuine family emergency");

    const switched = resolveV59Turn("Different question: can I approve it?", history);
    expect(switched.usedImmediateContext).toBe(false);
  });

  it("recalls the exact driving decision from its title and complete approved record", () => {
    const question = "My prospect will be driving during our scheduled call because of a child's doctor appointment. Should I keep the call or rebook it?";
    const item = need("Determine whether company policy permits or advises against conducting a scheduled call while the prospect is driving.", {
      authorityText: question,
      originalRequestText: question,
      relation: "requirement",
      domains: ["sales", "safety"],
      actions: ["conduct call", "rebook call"],
      entities: ["prospect", "scheduled call", "driving"],
    });
    const plan = planFor(item);
    const retrieval = retrieveV59Policies(resolveV4SystemicTurn(question, []), plan);
    const exact = retrieval.candidates.find((candidate) => candidate.policy.id === "operational_90091842d5c4a4a1")!;
    expect(exact?.needScores?.N1).toBeDefined();
    const exclusionReasons = rawEntailmentCandidateExclusionReasons(exact, item, plan, retrieval, {
      applyAuthorityResolutions: true,
      exactQualifierBoundaries: true,
      exactRelationshipContexts: true,
      exactEntitySubtypes: true,
      enforceControllingAuthorityWhenAvailable: true,
      enforceRequiredAuthorityComposition: true,
      admitClaimScopedControllingSupport: true,
      recoverCompleteRawRecordShape: true,
      recoverModelConfirmedRawRecord: true,
      scopeQualifiersToEligibility: true,
      admitExactCaseSpecificSupport: true,
      normalizeActionMorphology: true,
    });
    expect(exclusionReasons).toEqual([]);
    expect(retrieval.candidates.find((candidate) => candidate.policy.id === "operational_59d74978d4b58531")?.needScores?.N1)
      .toBeUndefined();
  });

  it("does not treat a VIP deadline default as the same scenario as a genuine emergency exception", () => {
    const question = "A genuine family emergency means my prospect cannot complete Call 2 before the cohort closes. Is an extension possible?";
    const item = need(question, { relation: "permission", entities: ["family emergency", "Call 2", "cohort deadline"] });
    const retrieval = retrieveV59Policies(resolveV4SystemicTurn(question, []), planFor(item));
    expect(retrieval.candidates.some((candidate) => candidate.needScores?.N1 && /genuine emergencies/i.test(candidate.policy.decision)))
      .toBe(true);
    expect(retrieval.candidates.find((candidate) => candidate.policy.id === "operational_adf5e79eeb942d4d")?.needScores?.N1)
      .toBeUndefined();
  });

  it("recalls the newer conditional contract record from the raw user wording", () => {
    const question = "A prospect explicitly asks me to email the contract before deciding. Am I allowed to send it?";
    const item = need("Is the rep allowed to email the contract to a prospect before the prospect has decided?", {
      authorityText: question,
      originalRequestText: question,
      relation: "permission",
      domains: ["sales", "contracts"],
      actions: ["email", "send"],
      entities: ["contract", "prospect"],
    });
    const plan = planFor(item);
    const retrieval = retrieveV59Policies(resolveV4SystemicTurn(question, []), plan);
    const exact = retrieval.candidates.find((candidate) => candidate.policy.id === "operational_bb933d76b00226c0")!;
    expect(exact?.needScores?.N1).toBeDefined();
    const exclusionReasons = rawEntailmentCandidateExclusionReasons(exact, item, plan, retrieval, {
      applyAuthorityResolutions: true,
      exactRelationshipContexts: true,
      exactEntitySubtypes: true,
      enforceControllingAuthorityWhenAvailable: true,
      admitClaimScopedControllingSupport: true,
      normalizeActionMorphology: true,
      admitNewerSameAuthoritySupport: true,
    });
    expect(exclusionReasons).toEqual([]);
  });

  it("admits only a rank-one trusted case-specific record for exact high-risk support", () => {
    const question = "A prospect is currently indicted for wire fraud and embezzlement. Should I greenlight them because they have not been convicted yet?";
    const item = need(question, { relation: "eligibility", entities: ["wire fraud", "embezzlement", "current indictment"] });
    const plan = planFor(item);
    const retrieval = retrieveV59Policies(resolveV4SystemicTurn(question, []), plan);
    const exact = retrieval.candidates.find((candidate) => candidate.policy.id === "operational_e2032d7f60e3e298")!;
    expect(exact).toBeDefined();
    expect(rawEntailmentCandidateExclusionReasons(exact, item, plan, retrieval, {
      exactRelationshipContexts: true,
      exactEntitySubtypes: true,
      admitExactCaseSpecificSupport: true,
    })).not.toContain("not_eligible_raw_evidence");

    const demoted = { ...exact, needScores: { N1: { ...exact.needScores!.N1, rank: 2 } } };
    expect(rawEntailmentCandidateExclusionReasons(demoted, item, plan, retrieval, {
      exactRelationshipContexts: true,
      exactEntitySubtypes: true,
      admitExactCaseSpecificSupport: true,
    })).toContain("not_eligible_raw_evidence");
  });

  it("recovers the complete approved record when the model selects an exact but shortened qualifier quote", async () => {
    const question = "A real-estate employee does not own the brokerage, but she independently started a nonprofit helping veterans and elderly people. Can that nonprofit make her eligible?";
    const item = need(question, {
      relation: "eligibility",
      entities: ["real-estate employee", "nonprofit", "veterans", "elderly people"],
    });
    const plan = planFor(item);
    const turn = resolveV4SystemicTurn(question, []);
    const retrieval = retrieveV59Policies(turn, plan);
    const result = await refineV59SourcePlanWithRawEntailment({
      turn,
      plan,
      retrieval,
      sourcePlan: {
        needs: [{ needId: "N1", lane: "route", directPolicyIds: [], preferredPolicyIds: [], excludedConflictPolicyIds: [], reason: "Deferred." }],
        reasoningSummary: "Deferred.",
      },
      provider: async (input) => {
        const payload = JSON.parse(input.user) as { needs: Array<{ records: Array<{ ref: string; raw_approved_record: string }> }> };
        const exact = payload.needs[0].records.find((record) => record.ref === "operational_428fa0e8ecaa3b2a");
        expect(exact).toBeDefined();
        return {
          output: input.parse(JSON.stringify({
            needs: [{
              need_id: "N1",
              disposition: "route",
              coverage_mode: "single",
              preferred_refs: [exact!.ref],
              uncovered_request_elements: [],
              material_conflict: false,
              records: [{
                ref: exact!.ref,
                verdict: "partial_or_conditional",
                confidence: 1,
                supporting_quote: "Yes, the person can be considered because of the nonprofit side project.",
                uncovered_request_elements: [],
                specific_difference: "This record directly answers the exact eligibility scenario.",
              }],
              reason: "The exact approved record answers the question.",
            }],
            reasoning_summary: "Exact full-record recovery.",
          })),
          provider: "deepseek",
          model: "test-model",
          attempts: [],
        };
      },
    });
    expect(result.sourcePlan.needs[0]).toMatchObject({
      lane: "answer",
      preferredPolicyIds: ["operational_428fa0e8ecaa3b2a"],
    });
    const metadata = result.metadata.needs!.find((entry) => entry.needId === "N1")!;
    expect(metadata.records.find((record) => record.policyId === "operational_428fa0e8ecaa3b2a")).toMatchObject({
      verdict: "direct_answer",
      supportingQuoteShapeVerified: true,
    });
  });

  it("answers a negated prerequisite question from an explicit proof requirement", async () => {
    const question = "So can I approve it based only on what they told me?";
    const turn = resolveV59Turn(question, [
      { role: "user", content: "A genuine family emergency means my prospect cannot complete Call 2 before the cohort closes. Is an extension possible?" },
      { role: "assistant", content: "An exception may be possible with proof." },
      { role: "user", content: question },
    ]);
    const item = need(turn.standaloneQuestion, { relation: "permission", entities: ["family emergency", "proof", "extension"] });
    const plan = planFor(item);
    const retrieval = retrieveV59Policies(turn, plan);
    let chosenRef = "";
    const result = await refineV59SourcePlanWithRawEntailment({
      turn,
      plan,
      retrieval,
      sourcePlan: {
        needs: [{ needId: "N1", lane: "route", directPolicyIds: [], preferredPolicyIds: [], excludedConflictPolicyIds: [], reason: "Deferred." }],
        reasoningSummary: "Deferred.",
      },
      provider: async (input) => {
        const payload = JSON.parse(input.user) as { needs: Array<{ records: Array<{ ref: string; raw_approved_record: string }> }> };
        const exact = payload.needs[0].records.find((record) => /proof/i.test(record.raw_approved_record))!;
        expect(exact).toBeDefined();
        chosenRef = exact.ref;
        return {
          output: input.parse(JSON.stringify({
            needs: [{
              need_id: "N1",
              disposition: "route",
              coverage_mode: "none",
              preferred_refs: [],
              uncovered_request_elements: ["Whether verbal confirmation alone is enough"],
              material_conflict: false,
              records: [{
                ref: exact.ref,
                verdict: "partial_or_conditional",
                confidence: 0.95,
                supporting_quote: exact.raw_approved_record,
                uncovered_request_elements: ["Whether verbal confirmation alone is enough"],
                specific_difference: "The record requires proof and says not to approve the exception yourself; the question asks to approve based only on a verbal claim.",
              }],
              reason: "The approved record requires proof.",
            }],
            reasoning_summary: "Negated prerequisite.",
          })),
          provider: "deepseek",
          model: "test-model",
          attempts: [],
        };
      },
    });
    expect(result.sourcePlan.needs[0]).toMatchObject({
      lane: "answer",
      preferredPolicyIds: [chosenRef],
    });
  });
});

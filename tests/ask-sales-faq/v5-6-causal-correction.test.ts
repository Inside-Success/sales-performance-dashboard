import { describe, expect, it } from "vitest";

import type { V3Provider } from "@/lib/ask-sales-faq/v3/types";
import type { V4SystemicSourcePlan } from "@/lib/ask-sales-faq/v4/systemic/runtime";
import { resolveV4SystemicTurn } from "@/lib/ask-sales-faq/v4/systemic/turn";
import type { V4SystemicNeed, V4SystemicQueryPlan } from "@/lib/ask-sales-faq/v4/systemic/types";
import { v4SystemicResolutionPolicyDisposition } from "@/lib/ask-sales-faq/v4/systemic/authority-resolutions";
import { getV5KnowledgeSnapshot } from "@/lib/ask-sales-faq/v5/knowledge";
import { rawEntailmentCandidateExclusionReasons, requestedQualificationQualifiers } from "@/lib/ask-sales-faq/v5-5/entailment";
import { refineV56SourcePlanWithRawEntailment } from "@/lib/ask-sales-faq/v5-6/entailment";
import { V56_OWNER_CONFIRMED_POLICIES } from "@/lib/ask-sales-faq/v5-6/knowledge";
import { retrieveV56Policies } from "@/lib/ask-sales-faq/v5-6/retrieval";
import { preferredV56ExactEvidenceSentence, refineV56QueryPlan } from "@/lib/ask-sales-faq/v5-6/runtime";
import { resolveV56Turn } from "@/lib/ask-sales-faq/v5-6/turn";

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
  return { needs: [item], conversationIntent: "answer", reasoningSummary: "V5.6 causal fixture." };
}

function deferredSourcePlan(): V4SystemicSourcePlan {
  return {
    needs: [{
      needId: "N1",
      lane: "route",
      directPolicyIds: [],
      preferredPolicyIds: [],
      excludedConflictPolicyIds: [],
      reason: "Deferred to bounded raw entailment.",
    }],
    reasoningSummary: "Deferred.",
  };
}

function directFirstRecordProvider(inspect?: (input: Parameters<V3Provider>[0], payload: Record<string, unknown>) => void): V3Provider {
  return async (input) => {
    const payload = JSON.parse(input.user) as {
      needs: Array<{ need_id: string; records: Array<{ ref: string; raw_approved_record: string }> }>;
    };
    inspect?.(input, payload as unknown as Record<string, unknown>);
    const record = payload.needs[0]?.records[0];
    return {
      output: input.parse(JSON.stringify({
        needs: [{
          need_id: "N1",
          disposition: record ? "answer" : "route",
          coverage_mode: record ? "single" : "none",
          preferred_refs: record ? [record.ref] : [],
          uncovered_request_elements: record ? [] : ["No record"],
          material_conflict: false,
          records: record ? [{
            ref: record.ref,
            verdict: "direct_answer",
            confidence: 0.98,
            supporting_quote: record.raw_approved_record,
            uncovered_request_elements: [],
            specific_difference: "The raw record directly answers the raw question.",
          }] : [],
          reason: record ? "Direct raw evidence." : "No evidence.",
        }],
        reasoning_summary: "Bounded causal fixture.",
      })),
      provider: "deepseek",
      model: "test-model",
      attempts: [],
    };
  };
}

describe("Ask Sales V5.6 bounded causal correction", () => {
  it("reopens clear duration FAQs while preserving explicit live owner work", () => {
    const informational = "How long does editing take after onboarding?";
    const informationalPlan = planFor(need(informational, {
      relation: "duration",
      requestKind: "operational_action",
      forcedRouteKey: "fulfillment",
      domains: ["editing", "onboarding"],
    }));
    expect(refineV56QueryPlan(informationalPlan, resolveV4SystemicTurn(informational, [])).needs[0]).toMatchObject({
      requestKind: "knowledge",
      forcedRouteKey: null,
    });

    const action = "Please reschedule this client's onboarding call today.";
    const actionPlan = planFor(need(action, {
      relation: "procedure",
      requestKind: "operational_action",
      forcedRouteKey: "fulfillment",
      domains: ["onboarding"],
      actions: ["reschedule"],
    }));
    expect(refineV56QueryPlan(actionPlan, resolveV4SystemicTurn(action, [])).needs[0]).toMatchObject({
      requestKind: "operational_action",
      forcedRouteKey: "fulfillment",
    });
  });

  it("keeps an unchanged signed-plan link permission in knowledge while preserving payment mutations as Finance actions", () => {
    const permission = "A bank transfer failed, but the client already signed for four $2,500 payments. Can I send the official link for that same contracted plan?";
    const permissionPlan = planFor(need(permission, {
      relation: "permission",
      requestKind: "operational_action",
      forcedRouteKey: "finance",
      domains: ["payment processing"],
      actions: ["send link"],
      entities: ["official link", "signed contract"],
    }));
    expect(refineV56QueryPlan(permissionPlan, resolveV4SystemicTurn(permission, [])).needs[0]).toMatchObject({
      requestKind: "knowledge",
      forcedRouteKey: null,
    });
    const splitPermission: V4SystemicQueryPlan = {
      conversationIntent: "answer",
      reasoningSummary: "Condition-dropping planner fixture.",
      needs: [
        need("Can I send the official link for the contracted plan?", {
          id: "N1",
          relation: "permission",
          requestKind: "operational_action",
          forcedRouteKey: "finance",
          actions: ["send link"],
          entities: ["official link", "contracted plan"],
        }),
        need("Does the failed transfer change whether the link may be sent?", {
          id: "N2",
          relation: "exception",
          requestKind: "operational_action",
          forcedRouteKey: "finance",
          entities: ["failed bank transfer", "signed payments"],
        }),
      ],
    };
    const preservedPermission = refineV56QueryPlan(splitPermission, resolveV4SystemicTurn(permission, []));
    expect(preservedPermission.needs).toHaveLength(1);
    expect(preservedPermission.needs[0]).toMatchObject({
      text: permission,
      authorityText: permission,
      originalRequestText: permission,
      relation: "permission",
      requestKind: "knowledge",
      forcedRouteKey: null,
    });

    const mutation = "Can I create a new custom payment link and change this client's signed plan?";
    const mutationPlan = planFor(need(mutation, {
      relation: "permission",
      requestKind: "operational_action",
      forcedRouteKey: "finance",
      domains: ["payment processing"],
      actions: ["create link", "change plan"],
    }));
    const preservedMutation = refineV56QueryPlan(mutationPlan, resolveV4SystemicTurn(mutation, [])).needs[0];
    expect(preservedMutation.requestKind).toBe("operational_action");
    expect(preservedMutation.forcedRouteKey).not.toBeNull();
  });

  it("keeps one concrete Call 1-to-Call 2 scheduling decision atomic", () => {
    const question = "A prospect finished Call 1 but wants Call 2 two weeks later because their investors are traveling. Can I schedule it then?";
    const plan: V4SystemicQueryPlan = {
      conversationIntent: "answer",
      reasoningSummary: "Over-decomposed fixture.",
      needs: [
        need("Is there a required waiting period between Call 1 and Call 2?", { id: "N1", relation: "requirement" }),
        need("Is there a maximum allowed delay between Call 1 and Call 2?", { id: "N2", relation: "limit" }),
        need("Can Call 2 be scheduled exactly two weeks after Call 1?", { id: "N3", relation: "permission" }),
      ],
    };
    const refined = refineV56QueryPlan(plan, resolveV4SystemicTurn(question, []));
    expect(refined.needs).toHaveLength(1);
    expect(refined.needs[0]).toMatchObject({
      id: "N1",
      text: question,
      authorityText: question,
      relation: "permission",
      requestKind: "knowledge",
      forcedRouteKey: null,
    });
  });

  it("does not confuse the word authorized with the qualification author", () => {
    expect(requestedQualificationQualifiers("Are reps authorized to discuss pricing on Call 1?", true)).not.toContain("author");
    expect(requestedQualificationQualifiers("Does an author qualify for the show?", true)).toContain("author");
  });

  it("treats a what-about question with a new concrete object as a follow-up, not a rewrite", () => {
    const messages = [
      { role: "user" as const, content: "Can a cast member post the full episode on social media?" },
      { role: "assistant" as const, content: "Do not post the full episode." },
    ];
    const turn = resolveV56Turn("What about shorter reels chopped from the episode?", messages);
    expect(turn).toMatchObject({ kind: "follow_up", usedImmediateContext: true });
    expect(turn.standaloneQuestion).toContain("shorter reels chopped from the episode");

    const rewrite = resolveV56Turn("Can you make that answer shorter?", messages);
    expect(rewrite.kind).toBe("rewrite");
  });

  it("makes the owner-confirmed Call 2 package sequence available as isolated answer evidence", async () => {
    const question = "On Call 2, should I show all three main ISTV package prices and ask the prospect to choose?";
    const item = need(question, {
      productScope: "main_istv",
      relation: "procedure",
      domains: ["pricing", "packages"],
      actions: ["present package"],
      entities: ["Call 2", "main ISTV packages"],
    });
    const plan = planFor(item);
    const turn = resolveV4SystemicTurn(question, []);
    const retrieval = retrieveV56Policies(turn, plan);
    const overlayId = V56_OWNER_CONFIRMED_POLICIES[0].id;
    const overlayCandidate = retrieval.candidates.find((candidate) => candidate.policy.id === overlayId)!;
    expect(overlayCandidate?.needScores?.N1).toBeTruthy();
    expect(rawEntailmentCandidateExclusionReasons(overlayCandidate, item, plan, retrieval, {
      applyAuthorityResolutions: true,
      exactQualifierBoundaries: true,
      exactRelationshipContexts: true,
      maxCandidatesPerNeed: 20,
    })).toEqual([]);
    expect(retrieval.stageTimings.v56OwnerConfirmedOverlayMatchCount).toBe(1);

    const provider: V3Provider = async (input) => {
      const payload = JSON.parse(input.user) as {
        needs: Array<{ records: Array<{ ref: string; raw_approved_record: string }> }>;
      };
      expect(payload.needs[0].records.length).toBeLessThanOrEqual(20);
      const suppliedIds = payload.needs[0].records.map((record) => record.ref);
      expect(suppliedIds, suppliedIds.join(", ")).toContain(overlayId);
      const record = payload.needs[0].records.find((candidate) => candidate.ref === overlayId)!;
      return {
        output: input.parse(JSON.stringify({
          needs: [{
            need_id: "N1",
            disposition: "answer",
            coverage_mode: "single",
            preferred_refs: [overlayId],
            uncovered_request_elements: [],
            material_conflict: false,
            records: [{
              ref: overlayId,
              verdict: "direct_answer",
              confidence: 0.99,
              supporting_quote: record.raw_approved_record,
              uncovered_request_elements: [],
              specific_difference: "The verified procedure directly answers the presentation-sequence question.",
            }],
            reason: "Owner-confirmed sequence directly answers the question.",
          }],
          reasoning_summary: "Direct owner-confirmed evidence.",
        })),
        provider: "deepseek",
        model: "test-model",
        attempts: [],
      };
    };
    const result = await refineV56SourcePlanWithRawEntailment({
      turn,
      plan,
      retrieval,
      sourcePlan: deferredSourcePlan(),
      provider,
    });
    expect(result.sourcePlan.needs[0]).toMatchObject({ lane: "answer", preferredPolicyIds: [overlayId] });
    expect(result.metadata).toMatchObject({
      maxCandidatesPerNeed: 20,
      authorityResolutionsApplied: true,
      exactQualifierBoundaries: true,
      exactRelationshipContexts: true,
      compactDifferentQuestionRecords: true,
      enforceControllingAuthorityWhenAvailable: true,
    });

    const complete = preferredV56ExactEvidenceSentence(item, plan, retrieval, [overlayId], result.metadata);
    expect(complete?.text).toContain("$20,000 Standard");
    expect(complete?.text).toContain("$30,000 VIP");
    expect(complete?.text).toContain("$12,000 Lite");
  });

  it("applies bounded authority resolutions to Call 1 cost wording and the current editing timeline", () => {
    const call1 = need("If a prospect asks about cost during Call 1, should I tell them the $10K minimum?", {
      relation: "requirement",
      productScope: "unknown",
      actions: ["disclose"],
      entities: ["$10K minimum cost", "Call 1", "prospect"],
    });
    expect(v4SystemicResolutionPolicyDisposition(call1, "curated_32981b3dcba667da")).toBe("controlling");
    expect(v4SystemicResolutionPolicyDisposition(call1, "operational_fa65ec318eacfff9")).toBe("controlling");
    const call1Plan = planFor(call1);
    const call1Retrieval = retrieveV56Policies(resolveV4SystemicTurn(call1.originalRequestText!, []), call1Plan);
    const completeBoundary = call1Retrieval.candidates.find((candidate) =>
      candidate.policy.id === "owner-call1-pricing-complete-boundary")!;
    expect(completeBoundary).toBeTruthy();
    expect(rawEntailmentCandidateExclusionReasons(completeBoundary, call1, call1Plan, call1Retrieval, {
      applyAuthorityResolutions: true,
      exactQualifierBoundaries: true,
      exactRelationshipContexts: true,
      enforceControllingAuthorityWhenAvailable: true,
    })).toEqual([]);

    const persistent = need("What is the policy when a prospect keeps pushing for an exact breakdown of cost during Call 1?", {
      relation: "definition",
      productScope: "unknown",
      actions: ["handle objection", "disclose pricing"],
      entities: ["prospect", "Call 1", "cost breakdown"],
    });
    const persistentRetrieval = retrieveV56Policies(
      resolveV4SystemicTurn(persistent.originalRequestText!, []),
      planFor(persistent),
    );
    expect(persistentRetrieval.candidates.some((candidate) =>
      candidate.policy.id === "owner-call1-pricing-complete-boundary" && candidate.needScores?.N1)).toBe(false);
    expect(persistentRetrieval.candidates.some((candidate) =>
      candidate.policy.id === "operational_fa65ec318eacfff9" && candidate.needScores?.N1)).toBe(true);

    const editing = need("After filming, how long does it usually take for a client's episode to be ready?", {
      relation: "duration",
      productScope: "unknown",
      domains: ["production", "post-production"],
      actions: ["ready", "deliver"],
      entities: ["episode", "client"],
    });
    expect(v4SystemicResolutionPolicyDisposition(editing, "operational_23c63c3fb61fe96d")).toBe("controlling");
    expect(v4SystemicResolutionPolicyDisposition(editing, "operational_fffb1b838f94f059")).toBe("excluded");

    const roi = need("A prospect wants me to explain what ROI the episode will generate. What can I promise?", {
      relation: "permission",
      domains: ["ROI"],
      actions: ["promise"],
      entities: ["episode"],
    });
    const roiPlan = planFor(roi);
    const roiRetrieval = retrieveV56Policies(resolveV4SystemicTurn(roi.originalRequestText!, []), roiPlan);
    const roiRule = roiRetrieval.candidates.find((candidate) => candidate.policy.id === "claim_a0511589517176d3__a4")!;
    const broaderPurpose = roiRetrieval.candidates.find((candidate) => candidate.policy.id === "owner-podcast-purpose-and-current-format")!;
    expect(v4SystemicResolutionPolicyDisposition(roi, roiRule.policy.id)).toBe("controlling");
    expect(rawEntailmentCandidateExclusionReasons(roiRule, roi, roiPlan, roiRetrieval, {
      applyAuthorityResolutions: true,
      exactRelationshipContexts: true,
      enforceControllingAuthorityWhenAvailable: true,
    })).toEqual([]);
    expect(rawEntailmentCandidateExclusionReasons(broaderPurpose, roi, roiPlan, roiRetrieval, {
      applyAuthorityResolutions: true,
      exactRelationshipContexts: true,
      enforceControllingAuthorityWhenAvailable: true,
    })).toContain("superseded_by_available_controlling_authority");
  }, 15_000);

  it("composes every required step of a source-resolved multi-record upgrade procedure", async () => {
    const question = "What is the current process when a client has paid and wants to upgrade their package?";
    const item = need(question, {
      relation: "procedure",
      productScope: "main_istv",
      domains: ["upgrade", "contract", "payment"],
      actions: ["upgrade package"],
      entities: ["paid client", "package"],
    });
    const plan = planFor(item);
    const turn = resolveV4SystemicTurn(question, []);
    const retrieval = retrieveV56Policies(turn, plan);
    const oldProcessId = "claim_d4765c6b8aa3730e";
    const formId = "curated_af3fa1d5bbe01125";
    const provider: V3Provider = async (input) => {
      const payload = JSON.parse(input.user) as {
        needs: Array<{ records: Array<{ ref: string; raw_approved_record: string }> }>;
      };
      const oldProcess = payload.needs[0].records.find((record) => record.ref === oldProcessId)!;
      expect(oldProcess).toBeTruthy();
      expect(payload.needs[0].records.some((record) => record.ref === formId)).toBe(true);
      return {
        output: input.parse(JSON.stringify({
          needs: [{
            need_id: "N1",
            disposition: "answer",
            coverage_mode: "single",
            preferred_refs: [oldProcessId],
            uncovered_request_elements: [],
            material_conflict: false,
            records: [{
              ref: oldProcessId,
              verdict: "direct_answer",
              confidence: 0.98,
              supporting_quote: oldProcess.raw_approved_record,
              uncovered_request_elements: [],
              specific_difference: "The older process record looks individually complete.",
            }],
            reason: "Selected only the older process wording.",
          }],
          reasoning_summary: "Single-record model fixture.",
        })),
        provider: "deepseek",
        model: "test-model",
        attempts: [],
      };
    };
    const result = await refineV56SourcePlanWithRawEntailment({
      turn,
      plan,
      retrieval,
      sourcePlan: deferredSourcePlan(),
      provider,
    });
    expect(result.sourcePlan.needs[0]).toMatchObject({
      lane: "answer",
      preferredPolicyIds: [formId, oldProcessId],
    });
    expect(result.sourcePlan.needs[0].reason).toContain("source-reviewed required records");
    expect(result.metadata).toMatchObject({ enforceRequiredAuthorityComposition: true });
  }, 15_000);

  it("does not mistake a Call 1 price-objection response for a package-price lookup", async () => {
    const currentQuestion = "What if they keep pushing me for an exact breakdown?";
    const turn = resolveV56Turn(currentQuestion, [
      { role: "user", content: "If a prospect asks about cost during Call 1, should I tell them the $10K minimum?" },
      { role: "assistant", content: "Do not quote a minimum on Call 1; pricing is covered on Call 2 after greenlight." },
    ]);
    const item = need("Determine the policy for when a prospect keeps pushing for an exact breakdown of cost during Call 1, given the general rule to defer pricing to Call 2 and the narrow exception for disqualification.", {
      authorityText: currentQuestion,
      originalRequestText: currentQuestion,
      relation: "limit",
      domains: ["sales process"],
      actions: ["handle prospect pushback"],
      entities: ["cost breakdown", "Call 1", "prospect"],
    });
    const plan = refineV56QueryPlan(planFor(item), turn);
    expect(plan.needs).toHaveLength(1);
    expect(plan.needs.some((candidate) => candidate.id.endsWith("__case_review"))).toBe(false);
    const retrieval = retrieveV56Policies(turn, plan);
    const policyId = "operational_fa65ec318eacfff9";
    const record = retrieval.candidates.find((candidate) => candidate.policy.id === policyId)?.policy.decision;
    expect(record).toBeTruthy();
    const provider: V3Provider = async (input) => ({
      output: input.parse(JSON.stringify({
        needs: [{
          need_id: "N1",
          disposition: "answer",
          coverage_mode: "single",
          preferred_refs: [policyId],
          uncovered_request_elements: [],
          material_conflict: false,
          records: [{
            ref: policyId,
            verdict: "direct_answer",
            confidence: 0.98,
            supporting_quote: record,
            uncovered_request_elements: [],
            specific_difference: "The record directly addresses persistent requests for a cost breakdown.",
          }],
          reason: "Direct persistent-question evidence.",
        }],
        reasoning_summary: "Bounded exact relationship fixture.",
      })),
      provider: "deepseek",
      model: "test-model",
      attempts: [],
    });
    const result = await refineV56SourcePlanWithRawEntailment({
      turn,
      plan,
      retrieval,
      sourcePlan: deferredSourcePlan(),
      provider,
    });
    expect(result.sourcePlan.needs[0]).toMatchObject({ lane: "answer", preferredPolicyIds: [policyId] });
  });

  it("removes a claim-scoped superseded doctor record before raw entailment", async () => {
    const question = "For America's Best Doctors, can a doctor who works at a hospital qualify without owning a practice?";
    const item = need(question, {
      productScope: "main_istv",
      relation: "eligibility",
      domains: ["casting", "qualification"],
      entities: ["America's Best Doctors", "doctor", "hospital", "practice ownership"],
    });
    const plan = planFor(item);
    const turn = resolveV4SystemicTurn(question, []);
    const retrieval = retrieveV56Policies(turn, plan);
    let inspected = false;
    const provider = directFirstRecordProvider((input) => {
      inspected = true;
      expect(input.purpose).toBe("v5_6_bounded_raw_record_entailment_validation");
      expect(input.maxTokens).toBe(5200);
      const payload = JSON.parse(input.user) as { needs: Array<{ records: Array<{ ref: string }> }> };
      const ids = payload.needs[0].records.map((record) => record.ref);
      expect(ids).not.toContain("operational_c4d65012f8c4c11d");
      expect(ids.some((id) => [
        "owner-hospital-employed-doctor-qualification",
        "claim_54e4d8f4163f0486__a1",
        "claim_025c646cfb2def32__a1",
        "curated_9848cdfb2da72c0a",
      ].includes(id))).toBe(true);
    });
    await refineV56SourcePlanWithRawEntailment({
      turn,
      plan,
      retrieval,
      sourcePlan: deferredSourcePlan(),
      provider,
    });
    expect(inspected).toBe(true);
  }, 10_000);

  it("keeps the same-week Call 2 rule inside the bounded entailment packet", async () => {
    const question = "A prospect finished Call 1 but wants Call 2 two weeks later because their investors are traveling. Can I schedule it then?";
    const item = need(question, {
      productScope: "main_istv",
      relation: "permission",
      domains: ["scheduling", "Call 2"],
      actions: ["schedule Call 2"],
      entities: ["Call 1", "Call 2", "investor travel"],
    });
    const plan = planFor(item);
    const turn = resolveV4SystemicTurn(question, []);
    const baseRetrieval = retrieveV56Policies(turn, plan);
    const expectedPolicyId = "operational_77537b341aeac5ce";
    const expectedPolicy = getV5KnowledgeSnapshot().policies.find((policy) => policy.id === expectedPolicyId)!;
    const template = baseRetrieval.candidates.find((candidate) => candidate.needScores?.N1)!;
    expect(expectedPolicy).toBeTruthy();
    expect(template).toBeTruthy();
    const expectedCandidate = {
      ...template,
      policy: expectedPolicy,
      rank: 6,
      matchedTerms: ["call", "schedule", "week"],
      matchedDecisionId: `${expectedPolicyId}::bounded-rank-six-fixture`,
      matchedDecisionText: expectedPolicy.decision,
      needScores: {
        N1: {
          ...template.needScores!.N1,
          rank: 6,
          score: 90,
          matchedDecisionId: `${expectedPolicyId}::bounded-rank-six-fixture`,
          matchedDecisionText: expectedPolicy.decision,
        },
      },
    };
    const rankedOthers = baseRetrieval.candidates
      .filter((candidate) => candidate.policy.id !== expectedPolicyId && candidate.needScores?.N1)
      .slice(0, 19)
      .map((candidate, index) => ({
        ...candidate,
        rank: index < 5 ? index + 1 : index + 2,
        needScores: {
          ...(candidate.needScores || {}),
          N1: { ...candidate.needScores!.N1, rank: index < 5 ? index + 1 : index + 2 },
        },
      }));
    const retrieval = {
      ...baseRetrieval,
      candidates: [...rankedOthers, expectedCandidate],
    };
    expect(rawEntailmentCandidateExclusionReasons(expectedCandidate, item, plan, retrieval, {
      applyAuthorityResolutions: true,
      exactQualifierBoundaries: true,
      exactRelationshipContexts: true,
      maxCandidatesPerNeed: 20,
    })).toEqual([]);
    let inspected = false;
    const provider: V3Provider = async (input) => {
      inspected = true;
      const payload = JSON.parse(input.user) as {
        needs: Array<{ records: Array<{ ref: string; raw_approved_record: string }> }>;
      };
      expect(payload.needs[0].records.length).toBeLessThanOrEqual(20);
      const record = payload.needs[0].records.find((candidate) => candidate.ref === expectedPolicyId);
      expect(record).toBeTruthy();
      return {
        output: input.parse(JSON.stringify({
          needs: [{
            need_id: "N1",
            disposition: "answer",
            coverage_mode: "single",
            preferred_refs: [expectedPolicyId],
            uncovered_request_elements: [],
            material_conflict: false,
            records: [{
              ref: expectedPolicyId,
              verdict: "direct_answer",
              confidence: 0.99,
              supporting_quote: record!.raw_approved_record,
              uncovered_request_elements: [],
              specific_difference: "The same-week rule and limited emergency exceptions directly answer the scenario.",
            }],
            reason: "The exact scheduling rule is present.",
          }],
          reasoning_summary: "Bounded direct evidence.",
        })),
        provider: "deepseek",
        model: "test-model",
        attempts: [],
      };
    };
    const result = await refineV56SourcePlanWithRawEntailment({
      turn,
      plan,
      retrieval,
      sourcePlan: deferredSourcePlan(),
      provider,
    });
    expect(inspected).toBe(true);
    expect(result.sourcePlan.needs[0]).toMatchObject({ lane: "answer", preferredPolicyIds: [expectedPolicyId] });
  }, 10_000);

  it("keeps the approved chopped-reels rule reachable after contextual turn resolution", () => {
    const turn = resolveV56Turn("What about shorter reels chopped from the episode?", [
      { role: "user", content: "Can a cast member post the full episode on social media?" },
      { role: "assistant", content: "Do not post the full episode." },
    ]);
    const item = need("May a cast member post shorter reels chopped from the episode?", {
      relation: "permission",
      domains: ["content rights", "social media"],
      actions: ["post chopped reels"],
      entities: ["cast member", "shorter reels", "episode"],
    });
    const retrieval = retrieveV56Policies(turn, planFor(item));
    expect(retrieval.candidates.find((candidate) => candidate.policy.id === "operational_2af848428b606ff5")?.needScores?.N1).toBeTruthy();
  });
});

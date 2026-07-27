import { describe, expect, it } from "vitest";

import { resolveV4SystemicTurn } from "@/lib/ask-sales-faq/v4/systemic/turn";
import type { V4SystemicNeed, V4SystemicQueryPlan } from "@/lib/ask-sales-faq/v4/systemic/types";
import { rawEntailmentCandidateExclusionReasons } from "@/lib/ask-sales-faq/v5-5/entailment";
import { refineV57SourcePlanWithRawEntailment } from "@/lib/ask-sales-faq/v5-7/entailment";
import { retrieveV57Policies } from "@/lib/ask-sales-faq/v5-7/retrieval";
import {
  naturalizeV57Decision,
  refineV57QueryPlan,
  resolveV57RouteKey,
} from "@/lib/ask-sales-faq/v5-7/runtime";
import { matchingV57SourceResolutions } from "@/lib/ask-sales-faq/v5-7/source-resolutions";
import { resolveV57Turn } from "@/lib/ask-sales-faq/v5-7/turn";

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
    relation: "permission",
    requestKind: "knowledge",
    ambiguity: "none",
    clarificationQuestion: "",
    ...overrides,
  };
}

function planFor(item: V4SystemicNeed): V4SystemicQueryPlan {
  return { needs: [item], conversationIntent: "answer", reasoningSummary: "V5.7 fixture." };
}

describe("Ask Sales V5.7 claim-scoped source resolution", () => {
  it.each([
    ["A spouse wants the investment range before Call 2. Should I tell them the minimum?", "operational_2aa0381baee79196"],
    ["Can two 11-year-old children continue the audition with their mother present?", "v57src-minor-call-with-guardian"],
    ["May I send the license-options document so they can compare the packages?", "operational_78f77231bab08f9a"],
    ["Can we film an episode in Spanish right now?", "operational_af4f8f85e3cfde7b"],
  ])("promotes the exact source-reviewed policy for %s", (question, policyId) => {
    const item = need(question);
    const resolutions = matchingV57SourceResolutions(item);
    expect(resolutions.flatMap((resolution) => resolution.controllingPolicyIds)).toContain(policyId);
    const retrieval = retrieveV57Policies(resolveV4SystemicTurn(question, []), planFor(item));
    const candidate = retrieval.candidates.find((entry) => entry.policy.id === policyId);
    expect(candidate?.needScores?.N1?.rank).toBe(0.25);
  });

  it("uses the newer same-authority filming rule and removes the obsolete contradiction", () => {
    const question = "Must someone on a payment plan be paid in full before filming?";
    const item = need(question, { entities: ["payment plan", "filming"], relation: "requirement" });
    const retrieval = retrieveV57Policies(resolveV4SystemicTurn(question, []), planFor(item));
    const ids = retrieval.candidates.filter((entry) => entry.needScores?.N1).map((entry) => entry.policy.id);
    expect(ids).toContain("operational_09864438bb225c32");
    expect(ids).not.toContain("operational_ac919fb89d05a670");
    expect(ids).not.toContain("operational_7fc7abe4206048fe");
  });

  it("keeps next-day discount expiration separate from upgrade carry-forward", () => {
    const question = "Does the $2,000 discount carry over to tomorrow?";
    const turn = resolveV4SystemicTurn(question, []);
    const refined = refineV57QueryPlan(planFor(need(question, { relation: "other", forcedRouteKey: "sales_policy" })), turn);
    expect(refined.needs[0]).toMatchObject({ relation: "deadline", requestKind: "knowledge", forcedRouteKey: null });
    const retrieval = retrieveV57Policies(turn, refined);
    const ids = retrieval.candidates.filter((entry) => entry.needScores?.N1).map((entry) => entry.policy.id);
    expect(ids).toContain("operational_0c97b61cb3fa71c2");
    expect(ids).not.toContain("claim_028cf371215a8cc5__a5");
    expect(ids).not.toContain("operational_7b181f9ffd6300c7");
  });

  it("lets a V5.7 source resolution outrank a different owner-overlay relationship", () => {
    const question = "A spouse wants the investment range before Call 2. Should I quote the minimum price?";
    const item = need(question, { relation: "permission" });
    const plan = planFor(item);
    const retrieval = retrieveV57Policies(resolveV4SystemicTurn(question, []), plan);
    const exact = retrieval.candidates.find((entry) => entry.policy.id === "operational_2aa0381baee79196")!;
    const overlay = retrieval.candidates.find((entry) => entry.policy.id === "owner-call2-baseline-package-sequence")!;
    const options = {
      applyAuthorityResolutions: true,
      exactRelationshipContexts: true,
      enforceControllingAuthorityWhenAvailable: true,
      admitClaimScopedControllingSupport: true,
    };
    expect(rawEntailmentCandidateExclusionReasons(exact, item, plan, retrieval, options)).toEqual([]);
    expect(rawEntailmentCandidateExclusionReasons(overlay, item, plan, retrieval, options))
      .toContain("superseded_by_claim_scoped_source_resolution");
  });

  it("reopens stable FAQ permissions but preserves live execution", () => {
    const permission = "May I send the license-options document after the call?";
    const permissionNeed = need(permission, { requestKind: "current_lookup", forcedRouteKey: "sales_policy" });
    expect(refineV57QueryPlan(planFor(permissionNeed), resolveV4SystemicTurn(permission, [])).needs[0]).toMatchObject({
      requestKind: "knowledge",
      forcedRouteKey: null,
    });

    const live = "Can you check whether my specific client's signed contract was received?";
    const liveNeed = need(live, { requestKind: "current_lookup", forcedRouteKey: "sales_policy" });
    expect(refineV57QueryPlan(planFor(liveNeed), resolveV4SystemicTurn(live, [])).needs[0]).toMatchObject({
      requestKind: "current_lookup",
      forcedRouteKey: "fulfillment",
    });
  });

  it("routes a specific contract receipt check to Fulfillment", () => {
    const question = "Can you check whether my specific client's signed contract was received?";
    const item = need(question, { requestKind: "current_lookup", forcedRouteKey: "fulfillment" });
    const retrieval = retrieveV57Policies(resolveV4SystemicTurn(question, []), planFor(item));
    expect(resolveV57RouteKey(item, {
      needId: "N1",
      lane: "route",
      evidenceRefs: [],
      answerSentences: [],
      reason: "Live lookup.",
      routeKey: null,
      clarificationQuestion: "",
      confidence: 1,
    }, retrieval)).toBe("fulfillment");
  });

  it("admits a claim-scoped controlling support record to raw entailment", async () => {
    const question = "The old six months of weekly training was discontinued. What support should I describe instead?";
    const item = need(question, {
      relation: "requirement",
      domains: ["training", "support"],
      actions: ["describe", "replace"],
      entities: ["six months of weekly training", "support"],
    });
    const plan = planFor(item);
    const turn = resolveV4SystemicTurn(question, []);
    const retrieval = retrieveV57Policies(turn, plan);
    const result = await refineV57SourcePlanWithRawEntailment({
      turn,
      plan,
      retrieval,
      sourcePlan: {
        needs: [{ needId: "N1", lane: "route", directPolicyIds: [], preferredPolicyIds: [], excludedConflictPolicyIds: [], reason: "Deferred." }],
        reasoningSummary: "Deferred.",
      },
      provider: async (input) => {
        const payload = JSON.parse(input.user) as { needs: Array<{ records: Array<{ ref: string; raw_approved_record: string }> }> };
        const controlling = payload.needs[0].records.find((record) => record.ref === "owner-six-month-training-discontinued");
        expect(controlling).toBeDefined();
        return {
          output: input.parse(JSON.stringify({
            needs: [{
              need_id: "N1",
              disposition: "answer",
              coverage_mode: "single",
              preferred_refs: [controlling!.ref],
              uncovered_request_elements: [],
              material_conflict: false,
              records: [{
                ref: controlling!.ref,
                verdict: "direct_answer",
                confidence: 0.99,
                supporting_quote: controlling!.raw_approved_record,
                uncovered_request_elements: [],
                specific_difference: "Direct replacement guidance.",
              }],
              reason: "Direct.",
            }],
            reasoning_summary: "Direct.",
          })),
          provider: "deepseek",
          model: "test-model",
          attempts: [],
        };
      },
    });
    expect(result.sourcePlan.needs[0]).toMatchObject({ lane: "answer", preferredPolicyIds: ["owner-six-month-training-discontinued"] });
  });

  it("turns source fields into natural user-facing prose", () => {
    expect(naturalizeV57Decision("No. Conditions: The client is current. Boundaries: Does not cover delinquent accounts."))
      .toBe("No. This applies when the client is current. It does not cover delinquent accounts.");
    expect(naturalizeV57Decision("No. Conditions: When using the approved channel. Boundaries: Does not allow overrides.; Does not change the owner."))
      .toBe("No. This applies when using the approved channel. It does not allow overrides. It does not change the owner.");
  });

  it("recovers explicit pronoun-dependent follow-ups from the immediate user turn", () => {
    const question = "Do I need to do anything else with her information?";
    const turn = resolveV57Turn(question, [
      { role: "user", content: "She replied STOP to the reminder and then no-showed. Can I still try calling her?" },
      { role: "assistant", content: "Please use the approved guidance." },
      { role: "user", content: question },
    ]);
    expect(turn).toMatchObject({ kind: "follow_up", usedImmediateContext: true });
    expect(turn.standaloneQuestion).toContain("replied STOP");
  });
});

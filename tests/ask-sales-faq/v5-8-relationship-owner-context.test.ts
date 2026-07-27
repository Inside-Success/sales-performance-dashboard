import { describe, expect, it } from "vitest";

import { resolveV4SystemicTurn } from "@/lib/ask-sales-faq/v4/systemic/turn";
import type { V4SystemicNeed, V4SystemicQueryPlan } from "@/lib/ask-sales-faq/v4/systemic/types";
import { rawEntailmentCandidateExclusionReasons } from "@/lib/ask-sales-faq/v5-5/entailment";
import { retrieveV58Policies } from "@/lib/ask-sales-faq/v5-8/retrieval";
import { refineV58QueryPlan, resolveV58RouteKey } from "@/lib/ask-sales-faq/v5-8/runtime";
import { resolveV58Turn } from "@/lib/ask-sales-faq/v5-8/turn";

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
  return { needs: [item], conversationIntent: "answer", reasoningSummary: "V5.8 fixture." };
}

describe("Ask Sales V5.8 relationship, owner, and context controls", () => {
  it("keeps reporting definitions answerable instead of turning them into Sales Tech actions", () => {
    const question = "I made several calls from the 20% dial-out list. Should those count as scheduled calls in my daily stats?";
    const item = need(question, {
      requestKind: "operational_action",
      forcedRouteKey: "sales_tech",
      actions: ["update daily stats"],
      entities: ["20% dial-out calls", "scheduled calls"],
    });
    expect(refineV58QueryPlan(planFor(item), resolveV4SystemicTurn(question, [])).needs[0]).toMatchObject({
      relation: "definition",
      requestKind: "knowledge",
      forcedRouteKey: null,
    });
    const refined = refineV58QueryPlan(planFor(item), resolveV4SystemicTurn(question, []));
    const retrieval = retrieveV58Policies(resolveV4SystemicTurn(question, []), refined);
    const exact = retrieval.candidates.find((candidate) => candidate.policy.id === "operational_219aafb9f6e5d2b6")!;
    expect(rawEntailmentCandidateExclusionReasons(exact, refined.needs[0], refined, retrieval, {
      applyAuthorityResolutions: true,
      exactEntitySubtypes: true,
      enforceControllingAuthorityWhenAvailable: true,
    })).not.toContain("superseded_by_available_controlling_authority");
  });

  it("does not mistake a general booking cap for a live calendar mutation", () => {
    const question = "How many total bookings should a prospect be allowed before I stop rescheduling them?";
    const item = need(question, { relation: "limit", requestKind: "operational_action", forcedRouteKey: "sales_tech" });
    expect(refineV58QueryPlan(planFor(item), resolveV4SystemicTurn(question, [])).needs[0]).toMatchObject({
      requestKind: "knowledge",
      forcedRouteKey: null,
    });
  });

  it("keeps stable navigation as knowledge but preserves a live contract lookup", () => {
    const navigation = "Where should I confirm that an ISTV client's payment and signed contract were received?";
    const navigationNeed = need(navigation, { requestKind: "current_lookup", forcedRouteKey: "fulfillment" });
    expect(refineV58QueryPlan(planFor(navigationNeed), resolveV4SystemicTurn(navigation, [])).needs[0]).toMatchObject({
      requestKind: "knowledge",
      forcedRouteKey: null,
    });

    const lookup = "Can you check whether this specific client's signed contract was received?";
    const lookupNeed = need(lookup, { requestKind: "current_lookup", forcedRouteKey: "sales_policy" });
    expect(refineV58QueryPlan(planFor(lookupNeed), resolveV4SystemicTurn(lookup, [])).needs[0]).toMatchObject({
      requestKind: "operational_action",
      forcedRouteKey: "fulfillment",
    });
  });

  it("assigns live CRM/calendar changes and post-sale event checks to their real owners", () => {
    const duplicate = "The same prospect is duplicated on two reps' calendars. Can the chatbot combine the leads and replace the duplicate appointment?";
    expect(refineV58QueryPlan(planFor(need(duplicate)), resolveV4SystemicTurn(duplicate, [])).needs[0]).toMatchObject({
      requestKind: "operational_action",
      forcedRouteKey: "sales_tech",
    });

    const event = "A cast member asks whether spaces remain for the two-day marketing event, but the registration link is expired. Can the chatbot check or fix this?";
    expect(refineV58QueryPlan(planFor(need(event)), resolveV4SystemicTurn(event, [])).needs[0]).toMatchObject({
      requestKind: "operational_action",
      forcedRouteKey: "fulfillment",
    });
  });

  it("rejects podcast statistics for an episode-statistics question while retaining episode evidence", () => {
    const question = "Can I share performance numbers from earlier TV episodes with a prospect?";
    const item = need(question, { relation: "permission", entities: ["TV episodes", "performance numbers"] });
    const plan = planFor(item);
    const retrieval = retrieveV58Policies(resolveV4SystemicTurn(question, []), plan);
    const ids = retrieval.candidates.filter((candidate) => candidate.needScores?.N1).map((candidate) => candidate.policy.id);
    expect(ids).toContain("operational_4eab610f3effa67d");
    expect(ids).not.toContain("operational_eef854a24abf5bd5");

    const wrong = retrieval.candidates.find((candidate) => candidate.policy.id === "operational_eef854a24abf5bd5");
    if (wrong) {
      expect(rawEntailmentCandidateExclusionReasons(wrong, item, plan, retrieval, {
        exactRelationshipContexts: true,
        exactEntitySubtypes: true,
      })).toContain("missing_need_score");
    }
  });

  it("recalls an exact raw question family that bounded retrieval omitted", () => {
    const question = "A prospect says weak authority is making them lose customers. May I ask what that is costing them?";
    const item = need(question, { relation: "permission", actions: ["ask"], entities: ["weak authority", "lost customers"] });
    const retrieval = retrieveV58Policies(resolveV4SystemicTurn(question, []), planFor(item));
    expect(retrieval.candidates.find((candidate) => candidate.policy.id === "operational_4308fa14b14b5502")?.needScores?.N1?.rank)
      .toBe(0.9);
  });

  it("keeps a post-booking communication correction atomic", () => {
    const question = "I booked a prospect but forgot to mention the studio location. Should I wait until the call or follow up now?";
    const split: V4SystemicQueryPlan = {
      conversationIntent: "answer",
      reasoningSummary: "Over-decomposed fixture.",
      needs: [
        need("What is the studio location?", { id: "N1", relation: "location" }),
        need("When should the studio location be mentioned?", { id: "N2", relation: "timing_start" }),
      ],
    };
    const refined = refineV58QueryPlan(split, resolveV4SystemicTurn(question, []));
    expect(refined.needs).toHaveLength(1);
    expect(refined.needs[0]).toMatchObject({
      text: question,
      relation: "procedure",
      requestKind: "knowledge",
      forcedRouteKey: null,
    });
  });

  it("recovers a bounded 'that applicant' follow-up without carrying context across a topic switch", () => {
    const question = "Who should handle that applicant?";
    const history = [
      { role: "user" as const, content: "An applicant booked both the Daymond John and ISTV shows." },
      { role: "assistant" as const, content: "Use the assigned-show rules." },
      { role: "user" as const, content: question },
    ];
    const resolved = resolveV58Turn(question, history);
    expect(resolved).toMatchObject({ kind: "follow_up", usedImmediateContext: true });
    expect(resolved.standaloneQuestion).toContain("booked both");

    const switched = resolveV58Turn("New question: who should handle that applicant?", history);
    expect(switched.usedImmediateContext).toBe(false);
  });

  it("uses the exact route-bearing source when the planner did not set an owner", () => {
    const question = "How do I combine duplicate leads for the same customer?";
    const item = need(question, { requestKind: "operational_action" });
    const retrieval = retrieveV58Policies(resolveV4SystemicTurn(question, []), planFor(item));
    expect(resolveV58RouteKey(item, {
      needId: "N1",
      lane: "route",
      evidenceRefs: [],
      answerSentences: [],
      routeKey: null,
      clarificationQuestion: "",
      confidence: 1,
      reason: "Live mutation.",
    }, retrieval)).toBe("sales_tech");
  });
});

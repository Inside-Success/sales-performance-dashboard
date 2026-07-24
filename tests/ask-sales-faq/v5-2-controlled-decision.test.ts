import { describe, expect, it } from "vitest";

import type { V4SystemicSourcePlan } from "@/lib/ask-sales-faq/v4/systemic/runtime";
import { resolveV4SystemicTurn } from "@/lib/ask-sales-faq/v4/systemic/turn";
import type {
  V4SystemicCandidate,
  V4SystemicNeed,
  V4SystemicQueryPlan,
} from "@/lib/ask-sales-faq/v4/systemic/types";
import {
  evaluateV52DecisionIdentity,
  v52OperationalEffectErrors,
} from "@/lib/ask-sales-faq/v5/decision-contract";
import {
  deterministicV52ActionOwner,
  refineV52QueryPlan,
} from "@/lib/ask-sales-faq/v5/decision-routing";
import {
  classifyV52StableOperationalRule,
  getV5KnowledgeSnapshot,
} from "@/lib/ask-sales-faq/v5/knowledge";
import { retrieveV5Policies } from "@/lib/ask-sales-faq/v5/retrieval";
import {
  chooseV52ContextualAuthority,
  refineV52SourcePlan,
} from "@/lib/ask-sales-faq/v5/source-control";

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
    relation: "procedure",
    requestKind: "knowledge",
    ambiguity: "none",
    clarificationQuestion: "",
    ...overrides,
  };
}

function planFor(item: V4SystemicNeed): V4SystemicQueryPlan {
  return { needs: [item], conversationIntent: "answer", reasoningSummary: "V5.2 contract test" };
}

describe("Ask Sales V5.2 controlled decision architecture", () => {
  it("compiles a reusable approved Slack procedure without promoting volatile records", () => {
    const snapshot = getV5KnowledgeSnapshot();
    const stable = snapshot.policies.find((policy) => policy.id === "operational_df5148bacd51d4c2");
    expect(stable).toBeDefined();
    expect(stable).toMatchObject({
      answerability: "answer_evidence",
      quality_tier: "trusted_evidence",
      systemic: { temporalRisk: "stable" },
    });
    expect(stable!.quality_flags).toContain("v52_stable_rule_compiled");

    const volatile = snapshot.policies.find((policy) =>
      policy.systemic.sourceClass === "authoritative_operational_qna" &&
      policy.answerability === "route_or_support" &&
      /\b(?:current|latest|status|availability)\b/i.test([policy.title, policy.decision].join(" ")),
    );
    expect(volatile).toBeDefined();
    expect(classifyV52StableOperationalRule(volatile!).eligible).toBe(false);
    expect(volatile!.quality_flags).not.toContain("v52_stable_rule_compiled");

    for (const id of [
      "operational_53285c35b2153975", // dated conference
      "operational_5535888bf6454b57", // changing numeric limits
      "operational_9749944bc86afc27", // cohort deadline conflict risk
      "operational_5f19c865e4984e0c", // case-sensitive disqualification
    ]) {
      const policy = snapshot.policies.find((candidate) => candidate.id === id);
      expect(policy, id).toBeDefined();
      expect(policy!.quality_flags, id).not.toContain("v52_stable_rule_compiled");
    }
  });

  it("rejects generic relationship overlap and accepts the exact back-to-back time-management decision", () => {
    const question = "How should a rep keep the first of two back-to-back Call 1 appointments from overrunning?";
    const item = need(question, {
      domains: ["scheduling", "call management"],
      actions: ["prevent overrun"],
      entities: ["Call 1 appointment", "back-to-back appointments"],
    });
    const snapshot = getV5KnowledgeSnapshot();
    const correct = snapshot.policies.find((policy) => policy.id === "operational_df5148bacd51d4c2");
    const wrong = snapshot.policies.find((policy) => policy.id === "v3src_previously_claimed_twenty_percent_lead");
    expect(correct).toBeDefined();
    expect(wrong).toBeDefined();
    expect(evaluateV52DecisionIdentity(item, correct!).exact).toBe(true);
    expect(evaluateV52DecisionIdentity(item, wrong!).exact).toBe(false);
  });

  it("does not let deterministic recovery replace a model abstention with a nearby decision", () => {
    const question = "How should a rep keep the first of two back-to-back Call 1 appointments from overrunning?";
    const item = need(question, {
      domains: ["scheduling", "call management"],
      actions: ["prevent overrun"],
      entities: ["Call 1 appointment", "back-to-back appointments"],
    });
    const queryPlan = planFor(item);
    const retrieval = retrieveV5Policies(resolveV4SystemicTurn(question, []), queryPlan);
    const correctId = "operational_df5148bacd51d4c2";
    const wrongId = "v3src_previously_claimed_twenty_percent_lead";
    expect(retrieval.candidates.map((candidate) => candidate.policy.id)).toContain(correctId);
    expect(retrieval.candidates.map((candidate) => candidate.policy.id)).not.toContain(wrongId);

    const unsafe: V4SystemicSourcePlan = {
      needs: [{
        needId: "N1",
        lane: "answer",
        directPolicyIds: [wrongId],
        preferredPolicyIds: [wrongId],
        excludedConflictPolicyIds: [],
        reason: "Generic procedure fallback.",
        modelDisposition: "route",
        modelDirectPolicyIds: [],
        deterministicPolicyIds: [wrongId],
      }],
      reasoningSummary: "The exact source was support-only; route.",
    };
    expect(refineV52SourcePlan(unsafe, queryPlan, retrieval).needs[0]).toMatchObject({
      lane: "route",
      preferredPolicyIds: [],
    });

    const safe: V4SystemicSourcePlan = {
      ...unsafe,
      needs: [{
        ...unsafe.needs[0],
        directPolicyIds: [correctId],
        preferredPolicyIds: [correctId],
        deterministicPolicyIds: [correctId],
      }],
    };
    expect(refineV52SourcePlan(safe, queryPlan, retrieval).needs[0]).toMatchObject({
      lane: "answer",
      preferredPolicyIds: [correctId],
    });
  }, 15_000);

  it("binds clear live actions before a model can label them as knowledge", () => {
    expect(deterministicV52ActionOwner("My Keap login is not working. Who can help me right now?")).toBe("sales_tech");
    expect(deterministicV52ActionOwner("The onboarding team is on vacation and this client needs help today. Where should I ask?")).toBe("fulfillment");
    expect(deterministicV52ActionOwner("This client's refund is still pending. Can someone trace it?")).toBe("finance");
    expect(deterministicV52ActionOwner("Can someone send this prospect's Greenlight letter today?")).toBe("greenlight");
    expect(deterministicV52ActionOwner("What is the policy for Keap access?")).toBeNull();

    const question = "My Keap login is not working. Who can help me right now?";
    const refined = refineV52QueryPlan(planFor(need(question, { requestKind: "knowledge" })), resolveV4SystemicTurn(question, []));
    expect(refined.needs[0]).toMatchObject({ requestKind: "operational_action", forcedRouteKey: "sales_tech" });
  });

  it("uses role, recency, and specificity together instead of a fixed Rich override", () => {
    const base = getV5KnowledgeSnapshot().policies.find((policy) => policy.id === "operational_df5148bacd51d4c2")!;
    const item = need("How should reps manage time on back-to-back calls?", {
      domains: ["call management"],
      actions: ["manage time"],
      entities: ["back-to-back calls"],
    });
    const makeCandidate = (id: string, approver: string, effectiveAt: string, familyScore: number): V4SystemicCandidate => ({
      policy: {
        ...base,
        id,
        effective_at: effectiveAt,
        last_reviewed: effectiveAt.slice(0, 10),
        source: { ...base.source, ids: [`slack:test:${id}`], approved_by: [approver] },
      },
      rank: 1,
      score: 90,
      matchedQueries: [item.text],
      matchedTerms: ["back", "time", "manage"],
      lexicalScore: 10,
      familyScore,
      characterScore: 0,
      structuredScore: 8,
      authorityScore: 3,
      relationScore: 14,
      matchedDecisionText: base.decision,
      needScores: {
        N1: {
          score: 90,
          rank: 1,
          lexicalScore: 10,
          familyScore,
          characterScore: 0,
          structuredScore: 8,
          semanticVectorScore: 0.8,
          relationScore: 14,
          matchedDecisionId: `${id}::a1`,
          matchedDecisionText: base.decision,
        },
      },
    });
    const oldRich = makeCandidate("old-rich", "Rich", "2024-01-01T00:00:00.000Z", 3);
    const newMadeline = makeCandidate("new-madeline", "Madeline", "2026-07-20T00:00:00.000Z", 8);
    expect(chooseV52ContextualAuthority(item, [oldRich, newMadeline]).winner?.policy.id).toBe("new-madeline");

    const recentRich = makeCandidate("recent-rich", "Rich", "2026-07-22T00:00:00.000Z", 8);
    const olderMadeline = makeCandidate("older-madeline", "Madeline", "2025-01-01T00:00:00.000Z", 4);
    expect(chooseV52ContextualAuthority(item, [recentRich, olderMadeline]).winner?.policy.id).toBe("recent-rich");

    const closeRich = makeCandidate("close-rich", "Rich", "2026-07-20T00:00:00.000Z", 6);
    const closeMadeline = makeCandidate("close-madeline", "Madeline", "2026-07-21T00:00:00.000Z", 8);
    expect(chooseV52ContextualAuthority(item, [closeRich, closeMadeline]).winner).toBeNull();
  });

  it("withholds a permissive answer that drops a material caution", () => {
    const item = need("Can a rep send the contract before Call 2?", { relation: "permission" });
    const evidence = "The rep can send the contract before Call 2, but it is not advised as the default.";
    expect(v52OperationalEffectErrors(item, "Yes, the rep can send it before Call 2.", evidence)).toContain(
      "the answer omits a material evidence boundary: not advised",
    );
    expect(v52OperationalEffectErrors(item, "Yes, the rep can send it before Call 2, but it is not advised as the default.", evidence)).not.toContain(
      "the answer omits a material evidence boundary: not advised",
    );
  });
});

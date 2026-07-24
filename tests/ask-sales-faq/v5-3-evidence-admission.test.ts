import { describe, expect, it } from "vitest";

import type { V4SystemicNeed } from "@/lib/ask-sales-faq/v4/systemic/types";
import { resolveV4SystemicTurn } from "@/lib/ask-sales-faq/v4/systemic/turn";
import { v52OperationalEffectErrors } from "@/lib/ask-sales-faq/v5/decision-contract";
import {
  deterministicV53ActionOwner,
  refineV53QueryPlan,
} from "@/lib/ask-sales-faq/v5/decision-routing";
import { getV5KnowledgeSnapshot } from "@/lib/ask-sales-faq/v5/knowledge";
import { retrieveV5Policies } from "@/lib/ask-sales-faq/v5/retrieval";
import { refineV53SourcePlan } from "@/lib/ask-sales-faq/v5/source-control";

function need(text: string): V4SystemicNeed {
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
  };
}

describe("Ask Sales V5.3 evidence admission and ownership", () => {
  it("admits only dated, source-attributed active rules and retains volatile context as non-answering", () => {
    const snapshot = getV5KnowledgeSnapshot();
    expect(snapshot.activeScopedOperationalPromotionCount).toBeGreaterThan(0);
    expect(snapshot.activeScopedOperationalPromotionCount).toBeLessThan(25);

    const promoted = snapshot.policies.filter((policy) => policy.quality_flags.includes("v53_active_scoped_rule_compiled"));
    expect(promoted).toHaveLength(snapshot.activeScopedOperationalPromotionCount);
    for (const policy of promoted) {
      expect(policy.answerability).toBe("answer_evidence");
      expect(policy.decision).toMatch(/^As of \d{4}-\d{2}-\d{2},/);
      expect(policy.source.ids.some((id) => id.startsWith("slack:"))).toBe(true);
      expect(policy.quality_flags.some((flag) => /^v53_effective_date:\d{4}-\d{2}-\d{2}$/.test(flag))).toBe(true);
    }

    for (const id of [
      "operational_0bc666fd22fe1825", // current no-show rate
      "operational_87b09f796fd9f47e", // owner-review timezone
      "operational_9d539d49184d4594", // rep-specific double-booking assignment
      "operational_6b11a6e77a6454a7", // one-off Greenlight exception
      "operational_4bf27f7d6179fbb7", // currently paused offer
      "operational_4c69cb42cce29392", // future CRM expectation
      "operational_0116cf89a3be99fd", // volatile Daymond meeting offer
    ]) {
      const policy = snapshot.policies.find((candidate) => candidate.id === id);
      expect(policy, id).toBeDefined();
      expect(policy!.quality_flags, id).not.toContain("v53_active_scoped_rule_compiled");
      expect(policy!.answerability, id).not.toBe("answer_evidence");
    }
  });

  it("requires the effective date to survive in an active-scoped answer", () => {
    const policy = getV5KnowledgeSnapshot().policies.find((candidate) =>
      candidate.quality_flags.includes("v53_active_scoped_rule_compiled"),
    );
    expect(policy).toBeDefined();
    const item = need(policy!.question_families[0] || policy!.title);
    const withoutDate = policy!.decision.replace(/^As of \d{4}-\d{2}-\d{2},\s*/i, "");
    expect(v52OperationalEffectErrors(item, withoutDate, policy!.decision).some((error) => error.includes("effective date"))).toBe(true);
    expect(v52OperationalEffectErrors(item, policy!.decision, policy!.decision).some((error) => error.includes("effective date"))).toBe(false);
  });

  it("routes explicit live work to the correct one of five owners without stealing stable FAQ questions", () => {
    expect(deterministicV53ActionOwner("When will this client's refund arrive under Net 30?")).toBe("finance");
    expect(deterministicV53ActionOwner("When is this client's episode expected to be delivered after filming?")).toBe("fulfillment");
    expect(deterministicV53ActionOwner("Can someone send this prospect's Greenlight letter today?")).toBe("greenlight");
    expect(deterministicV53ActionOwner("My Keap login is not working. Who can fix it?")).toBe("sales_tech");
    expect(deterministicV53ActionOwner("This lead is not a fit for the current show. Can we move them to another program?")).toBe("sales_policy");
    expect(deterministicV53ActionOwner("May an ISTV applicant be moved to Next Level CEO during the audition process?")).toBeNull();
  });

  it("corrects script-selection relationship errors before retrieval", () => {
    const text = "Should Built for More reps use the Next Level CEO script with the show name changed?";
    const plan = { needs: [need(text)], conversationIntent: "answer" as const, reasoningSummary: "model plan" };
    const turn = resolveV4SystemicTurn(text, []);
    expect(refineV53QueryPlan(plan, turn).needs[0]).toMatchObject({
      relation: "requirement",
      requestKind: "knowledge",
      forcedRouteKey: null,
    });
  });

  it("recovers agreeing direct evidence from a false conflict without overriding model abstention", () => {
    const text = "If a Call 1 prospect wants acting work and has no business, should the rep end the call and send a rejection?";
    const item = {
      ...need(text),
      domains: ["qualification"],
      actions: ["end call", "send rejection"],
      entities: ["acting-only prospect", "no business", "rejection"],
      relation: "procedure" as const,
    };
    const plan = { needs: [item], conversationIntent: "answer" as const, reasoningSummary: "one qualification decision" };
    const retrieval = retrieveV5Policies(resolveV4SystemicTurn(text, []), plan);
    const direct = [
      "claim_a5c125b11f9d657d",
      "operational_6319f88d138ba725",
      "operational_d10b4c2257d9126c",
    ].filter((id) => retrieval.candidates.some((candidate) => candidate.policy.id === id));
    expect(direct.length).toBeGreaterThanOrEqual(2);

    const falseConflict = {
      needs: [{
        needId: "N1",
        lane: "route" as const,
        directPolicyIds: [],
        preferredPolicyIds: [],
        excludedConflictPolicyIds: direct,
        reason: "Model grouped compatible rejection procedures as conflicting.",
        modelDisposition: "answer" as const,
        modelDirectPolicyIds: direct,
        deterministicPolicyIds: [],
      }],
      reasoningSummary: "False conflict fixture.",
    };
    expect(refineV53SourcePlan(falseConflict, plan, retrieval).needs[0]).toMatchObject({
      lane: "answer",
      preferredPolicyIds: expect.arrayContaining(direct.slice(0, 1)),
    });

    const abstained = {
      ...falseConflict,
      needs: [{ ...falseConflict.needs[0], modelDisposition: "route" as const }],
    };
    expect(refineV53SourcePlan(abstained, plan, retrieval).needs[0]).toMatchObject({
      lane: "route",
      preferredPolicyIds: [],
    });
  });
});

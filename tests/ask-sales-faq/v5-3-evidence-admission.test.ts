import { describe, expect, it } from "vitest";

import type { V4SystemicNeed } from "@/lib/ask-sales-faq/v4/systemic/types";
import { v4SystemicPolicyBoundaryErrors } from "@/lib/ask-sales-faq/v4/systemic/runtime";
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
    expect(deterministicV53ActionOwner("May a rep honor a same-day discount later if the payment links failed and the prospect provides proof?")).toBeNull();
    expect(deterministicV53ActionOwner("Can someone trace this prospect's failed card payment?")).toBe("finance");
    expect(deterministicV53ActionOwner("A client's internet dropped after I greenlit him. Should I wait until tomorrow's follow-up?")).toBe("greenlight");
    expect(deterministicV53ActionOwner("What is the general policy after an internet interruption during a greenlight call?")).toBeNull();
  });

  it("keeps a bank-closure exception request separate from a neighboring Monday rejection-letter schedule", () => {
    const text = "If a prospect cannot complete payment because the bank is closed and misses the deadline, can we make an exception for Monday?";
    const planned = { ...need(text), relation: "deadline" as const, domains: ["payment"], actions: ["make exception"], entities: ["payment deadline", "bank closure", "Monday"] };
    const retrieval = retrieveV5Policies(resolveV4SystemicTurn(text, []), {
      needs: [planned],
      conversationIntent: "answer",
      reasoningSummary: "deadline exception boundary",
    });
    expect(retrieval.candidates.map((candidate) => candidate.policy.id)).not.toContain("claim_9641a42c26cca91a");
  });

  it("lets a matching source-reviewed resolution recover Rich's controlling three-month rule", () => {
    const text = "A prospect was passed last week and is booked again. How long is the normal reapplication wait?";
    const planned = { ...need(text), relation: "duration" as const, domains: ["reapplication"], actions: ["waiting period"], entities: ["prospect"] };
    const retrieval = retrieveV5Policies(resolveV4SystemicTurn(text, []), {
      needs: [planned],
      conversationIntent: "answer",
      reasoningSummary: "source-reviewed authority resolution",
    });
    expect(retrieval.candidates[0]?.policy.id).toBe("curated_v43_rich_main_reapply_three_months");
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

    const scriptPolicy = getV5KnowledgeSnapshot().policies.find((policy) => policy.id === "operational_909930f8fcb963cf");
    expect(scriptPolicy).toBeDefined();
    expect(v4SystemicPolicyBoundaryErrors(scriptPolicy!, turn)).not.toContain(
      "requested approval workflow stage is not established by the evidence",
    );
  });

  it("keeps a reusable qualification answer separate from case-specific approval", () => {
    const text = "May a Daymond John prospect whose business is relaunching after illness proceed to Call 2?";
    const plan = { needs: [{ ...need(text), relation: "permission" as const }], conversationIntent: "answer" as const, reasoningSummary: "model plan" };
    const refined = refineV53QueryPlan(plan, resolveV4SystemicTurn(text, []));
    expect(refined.needs).toHaveLength(2);
    expect(refined.needs[0]).toMatchObject({ requestKind: "knowledge", forcedRouteKey: null });
    expect(refined.needs[1]).toMatchObject({
      id: "N1__case_review",
      relation: "owner",
      requestKind: "operational_action",
      forcedRouteKey: "sales_policy",
    });
  });

  it("anchors direct retrieval to the user's atomic wording instead of a model paraphrase", () => {
    const question = "Does the applicable package submit an episode to one Tier 1 platform or to all three listed platforms?";
    const item = {
      ...need(question),
      text: "Determine whether the applicable package submits an episode to one Tier 1 platform or to all three listed platforms.",
      retrievalQueries: ["content distribution submission count"],
      domains: ["content distribution"],
      actions: ["submit"],
      entities: ["episode", "Tier 1 platform"],
    };
    const plan = { needs: [item], conversationIntent: "answer" as const, reasoningSummary: "model paraphrase" };
    const retrieval = retrieveV5Policies(resolveV4SystemicTurn(question, []), plan);
    expect(retrieval.candidates[0]?.policy.id).toBe("operational_3cfb0025a6454374");
  });

  it("does not confuse moving a lead between programs with moving a deal forward", () => {
    const question = "Can an ISTV applicant be moved to Next Level CEO during the audition process?";
    const item = {
      ...need(question),
      domains: ["audition", "application"],
      actions: ["move", "transfer"],
      entities: ["ISTV applicant", "Next Level CEO"],
      relation: "permission" as const,
      productScope: "dj_nlceo" as const,
    };
    const retrieval = retrieveV5Policies(resolveV4SystemicTurn(question, []), {
      needs: [item],
      conversationIntent: "answer" as const,
      reasoningSummary: "cross-program transfer",
    });
    const ids = retrieval.candidates.map((candidate) => candidate.policy.id);
    expect(ids).toContain("operational_f32e012fa97b5b52");
    expect(ids).not.toContain("claim_028cf371215a8cc5__a6");

    const policy = getV5KnowledgeSnapshot().policies.find((candidate) => candidate.id === "operational_f32e012fa97b5b52");
    expect(policy).toBeDefined();
    expect(v52OperationalEffectErrors(
      item,
      "Reps should not pass clients back and forth from ISTV to DJ; cast only for the side you are assigned to.",
      policy!.decision,
    )).not.toContain("the answer reverses the permission polarity in the evidence");
  });

  it("does not mistake a condition such as not owning a business for a dropped safety caution", () => {
    const item = {
      ...need("If a Call 1 prospect wants acting work and has no business, should the rep end the call and send a rejection?"),
      relation: "procedure" as const,
    };
    const evidence = "If they do not own a business and are only looking for acting work, they are not a fit; record the disqualification and send the rejection letter. Boundaries: This does not apply to prospects who own a business but are not fit for other reasons.";
    const sentence = "If a Call 1 prospect only wants acting work and has no business, end the call, record the disqualification, and send the rejection letter.";
    expect(v52OperationalEffectErrors(item, sentence, evidence)).toEqual([]);

    const guardedEvidence = "The rep can send the contract before Call 2, but it is not advised as the default.";
    expect(v52OperationalEffectErrors(item, "The rep can send the contract before Call 2.", guardedEvidence)).toContain(
      "the answer omits a material evidence boundary: not advised",
    );
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

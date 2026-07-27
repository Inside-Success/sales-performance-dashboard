import { describe, expect, it } from "vitest";

import type { V3Provider } from "@/lib/ask-sales-faq/v3/types";
import { resolveV4SystemicTurn } from "@/lib/ask-sales-faq/v4/systemic/turn";
import type { V4SystemicNeed, V4SystemicQueryPlan } from "@/lib/ask-sales-faq/v4/systemic/types";
import { resolveV4Turn } from "@/lib/ask-sales-faq/v4/turn";
import {
  v54DecisionsFormConsensus,
  v54MaterialEffectsConflict,
} from "@/lib/ask-sales-faq/v5/consensus";
import {
  deterministicV54ActionOwner,
  refineV54QueryPlan,
} from "@/lib/ask-sales-faq/v5/decision-routing";
import { getV5KnowledgeSnapshot } from "@/lib/ask-sales-faq/v5/knowledge";
import { retrieveV5Policies } from "@/lib/ask-sales-faq/v5/retrieval";
import { runAskSalesFaqV5 } from "@/lib/ask-sales-faq/v5/runtime";
import {
  chooseV54DominantExactAnswer,
  refineV54SourcePlan,
  v54ExactSourceFallbackSentence,
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
    relation: "other",
    requestKind: "knowledge",
    ambiguity: "none",
    clarificationQuestion: "",
    ...overrides,
  };
}

function planFor(item: V4SystemicNeed): V4SystemicQueryPlan {
  return { needs: [item], conversationIntent: "answer", reasoningSummary: "V5.4 systemic boundary fixture" };
}

describe("Ask Sales V5.4 coverage, consensus, routing, and conversation boundaries", () => {
  it("handles natural greetings, acknowledgments, rewrites, follow-ups, and out-of-scope requests without policy routing", async () => {
    expect(resolveV4Turn("Hello, can you quickly help me with some sales questions?").kind).toBe("social");
    expect(resolveV4Turn("Hi there — can you help me with a quick sales question?").kind).toBe("social");
    expect(resolveV4Turn("Understood, thanks.").kind).toBe("social");
    expect(resolveV4Turn("Give me a one-sentence way to say that", [
      { role: "user", content: "What is the rule?" },
      { role: "assistant", content: "Use only the approved rule and keep it concise." },
    ]).kind).toBe("rewrite");
    expect(resolveV4Turn("So that means it is automatically approved?", [
      { role: "user", content: "Does the general qualification rule apply?" },
      { role: "assistant", content: "The general rule applies, but a live exception still needs review." },
    ]).kind).toBe("clarification");
    expect(resolveV4Turn("Can you recommend a restaurant nearby?").kind).toBe("topic_intro");
    expect(resolveV4Turn("Can you recommend a good steak and seafood restaurant in Miami for my client?").kind).toBe("topic_intro");

    let providerCalls = 0;
    const unavailableProvider: V3Provider = async () => {
      providerCalls += 1;
      throw new Error("Conversation-only turns must not invoke a provider");
    };
    const outOfScope = await runAskSalesFaqV5("Can you recommend a restaurant nearby?", [], {
      provider: unavailableProvider,
      validatorProvider: unavailableProvider,
    });
    expect(outOfScope.lane).toBe("conversation");
    expect(outOfScope.answer).toMatch(/focused on Inside Success sales guidance/i);
    expect(outOfScope.answer).not.toMatch(/sales-questions-requests/i);
    const confirmation = await runAskSalesFaqV5("So that means it is automatically approved, right?", [
      { role: "user", content: "Can an international nonprofit be considered for a show?" },
      { role: "assistant", content: "An international nonprofit can be considered for a show." },
    ], { provider: unavailableProvider, validatorProvider: unavailableProvider });
    expect(confirmation.lane).toBe("conversation");
    expect(confirmation.answer).toMatch(/not automatically/i);
    expect(providerCalls).toBe(0);
  });

  it("routes live work by object and workflow stage while preserving stable FAQ questions", () => {
    expect(deterministicV54ActionOwner("Where should I report a payment link that is not prompting the contract?")).toBe("sales_tech");
    expect(deterministicV54ActionOwner("The payment links are no longer prompting clients to sign the contract. Where should this live system issue be reported?")).toBe("sales_tech");
    expect(deterministicV54ActionOwner("Who should update the live twenty percent outreach sheet?")).toBe("sales_tech");
    expect(deterministicV54ActionOwner("I booked leads from the 20-percent list and need them kept off tomorrow's sheet. Where should that update be requested?")).toBe("sales_tech");
    expect(deterministicV54ActionOwner("A paid client needs their onboarding moved. Which channel handles the reschedule?")).toBe("fulfillment");
    expect(deterministicV54ActionOwner("Where should a paid client request Mastermind event registration help?")).toBe("fulfillment");
    expect(deterministicV54ActionOwner("Who can trace this prospect's pending ACH transaction?")).toBe("finance");
    expect(deterministicV54ActionOwner("Which channel should receive a request for a missing Greenlight letter?")).toBe("greenlight");
    expect(deterministicV54ActionOwner("A rep needs a same-day Greenlight letter. Should the chatbot approve or generate it?")).toBe("greenlight");
    expect(deterministicV54ActionOwner("Should a rep approve a prospect with a criminal conviction?")).toBe("sales_policy");
    expect(deterministicV54ActionOwner("A client wants to pay in full using half credit card and half debit card. Can the rep arrange that?")).toBe("sales_tech");
    expect(deterministicV54ActionOwner("Can I build a custom payment link myself?")).toBe("sales_tech");
    expect(deterministicV54ActionOwner("What are the current ISTV prices and payment plans?")).toBeNull();
    expect(deterministicV54ActionOwner("What is the approved policy for payment plans?")).toBeNull();

    const question = "Where should I report a payment link that is not prompting the contract?";
    expect(refineV54QueryPlan(planFor(need(question)), resolveV4SystemicTurn(question, [])).needs[0]).toMatchObject({
      requestKind: "operational_action",
      forcedRouteKey: "sales_tech",
    });

    const refundQuestion = "Does DJ still have a three-day refund window?";
    expect(refineV54QueryPlan(planFor(need(refundQuestion)), resolveV4SystemicTurn(refundQuestion, [])).needs[0]).toMatchObject({
      requestKind: "knowledge",
      forcedRouteKey: null,
    });
    expect(refineV54QueryPlan(planFor(need("What about main ISTV?")), {
      ...resolveV4SystemicTurn("What about main ISTV?", []),
      standaloneQuestion: "Immediate prior subject: Does DJ still have a three-day refund window? Current request about that subject: What about main ISTV?",
    }).needs[0]).toMatchObject({ requestKind: "knowledge", forcedRouteKey: null });
  });

  it("distinguishes supporting records from real policy conflicts", () => {
    expect(v54DecisionsFormConsensus([
      "Reps must not edit the approved contract.",
      "The contract cannot be changed to add custom terms.",
    ])).toBe(true);
    expect(v54MaterialEffectsConflict(
      "Reps may edit the approved contract.",
      "Reps must not edit the approved contract.",
    )).toBe(true);
    expect(v54MaterialEffectsConflict(
      "The normal wait is three months.",
      "The normal wait is six months.",
    )).toBe(true);
  });

  it("expands reusable governed Slack coverage without admitting volatile or case-specific records", () => {
    const snapshot = getV5KnowledgeSnapshot();
    expect(snapshot.governedOperationalPromotionCount).toBeGreaterThan(0);
    const promoted = snapshot.policies.filter((policy) => policy.quality_flags.includes("v54_governed_consensus_rule"));
    expect(promoted).toHaveLength(snapshot.governedOperationalPromotionCount);
    for (const policy of promoted) {
      expect(policy.answerability).toBe("answer_evidence");
      expect(policy.source.ids.some((id) => id.startsWith("slack:"))).toBe(true);
      expect(policy.decision).toMatch(/^As of \d{4}-\d{2}-\d{2},/);
      expect(policy.systemic.scopeRisk).not.toBe("case_specific");
      expect(policy.systemic.temporalRisk).not.toBe("live_only");
    }
  });

  it("resolves an aligned exact contract source set before false-conflict adjudication", () => {
    const text = "Can a rep edit the contract to add custom terms requested by a prospect?";
    const item = need(text, {
      relation: "permission",
      domains: ["contract"],
      actions: ["edit", "add custom terms"],
      entities: ["approved contract", "custom terms"],
    });
    const plan = planFor(item);
    const retrieval = retrieveV5Policies(resolveV4SystemicTurn(text, []), plan);
    const alignedIds = [
      "transcript-contract-link-no-edits",
      "claim_63be35f9e8f670e2",
      "operational_aea0ef95d79bbb97",
    ].filter((id) => retrieval.candidates.some((candidate) => candidate.policy.id === id));
    expect(alignedIds.length).toBeGreaterThanOrEqual(2);

    const sourcePlan = {
      needs: [{
        needId: "N1",
        lane: "route" as const,
        directPolicyIds: [],
        preferredPolicyIds: [],
        excludedConflictPolicyIds: alignedIds,
        reason: "Aligned no-edit sources were grouped as conflicts.",
        modelDisposition: "answer" as const,
        modelDirectPolicyIds: alignedIds.slice(0, 1),
        deterministicPolicyIds: [],
      }],
      reasoningSummary: "False conflict fixture.",
    };
    expect(refineV54SourcePlan(sourcePlan, plan, retrieval).needs[0]).toMatchObject({
      lane: "answer",
      preferredPolicyIds: expect.arrayContaining(alignedIds.slice(0, 1)),
    });
    const routeRecovery = refineV54SourcePlan({
      ...sourcePlan,
      needs: [{ ...sourcePlan.needs[0], modelDisposition: "route", modelDirectPolicyIds: [] }],
    }, plan, retrieval).needs[0];
    expect(routeRecovery).toMatchObject({
      lane: "answer",
      preferredPolicyIds: [expect.any(String)],
    });
    expect(routeRecovery.preferredPolicyIds.every((id) => retrieval.candidates.some((candidate) => candidate.policy.id === id))).toBe(true);
    const noisyAlignedIds = [
      "transcript-contract-link-no-edits",
      "claim_63be35f9e8f670e2",
      "claim_6b3311cee0cd4b18__a4",
      "operational_f03229e0a7a3af2b",
      "operational_aea0ef95d79bbb97",
    ].filter((id) => retrieval.candidates.some((candidate) => candidate.policy.id === id));
    expect(refineV54SourcePlan({
      ...sourcePlan,
      needs: [{
        ...sourcePlan.needs[0],
        excludedConflictPolicyIds: noisyAlignedIds,
        modelDisposition: "route",
        modelDirectPolicyIds: [],
      }],
    }, plan, retrieval).needs[0]).toMatchObject({ lane: "answer" });
    expect(v54ExactSourceFallbackSentence(item, plan, retrieval, ["transcript-contract-link-no-edits"])).toMatchObject({
      policyId: "transcript-contract-link-no-edits",
      text: expect.stringMatching(/do not make or promise changes/i),
    });

    const structuralAbstention = {
      needs: [{
        ...sourcePlan.needs[0],
        excludedConflictPolicyIds: [],
        modelDisposition: "route" as const,
        modelDirectPolicyIds: [],
        reason: "The exact source was marked conflict-review-only rather than answer-eligible.",
      }],
      reasoningSummary: "Structural admission mismatch fixture.",
    };
    const dominance = chooseV54DominantExactAnswer(item, retrieval);
    expect(dominance, JSON.stringify(dominance)).toMatchObject({
      winner: { policy: { id: dominance.candidateIds[0] } },
      rank: 1,
    });
    expect(refineV54SourcePlan(structuralAbstention, plan, retrieval).needs[0]).toMatchObject({
      lane: "answer",
      preferredPolicyIds: [dominance.candidateIds[0]],
    });
  });

  it("keeps unknown named decisions empty instead of borrowing a nearby V3 answer", () => {
    const text = "What is the QZ-778 lunar casting override?";
    const item = need(text, {
      relation: "definition",
      domains: ["unknown"],
      actions: ["confirm"],
      entities: ["QZ-778 lunar casting override"],
    });
    const retrieval = retrieveV5Policies(resolveV4SystemicTurn(text, []), planFor(item));
    expect(retrieval.candidates).toHaveLength(0);
  });

  it("recovers a complete dated decision instead of an incomplete atomic fragment", () => {
    const text = "What should a rep say when a prospect demands exact episode views, ROI, or performance case-study numbers?";
    const item = need(text, {
      relation: "requirement",
      domains: ["sales", "communication"],
      actions: ["respond", "handle objection"],
      entities: ["prospect", "episode views", "ROI", "performance case-study numbers"],
    });
    const plan = planFor(item);
    const retrieval = retrieveV5Policies(resolveV4SystemicTurn(text, []), plan);
    expect(v54ExactSourceFallbackSentence(item, plan, retrieval, ["operational_79a0b7756a0faf31"])).toMatchObject({
      policyId: "operational_79a0b7756a0faf31",
      text: expect.stringMatching(/as of 2026-06-23.*stats are not shared/i),
    });
  }, 15_000);
});

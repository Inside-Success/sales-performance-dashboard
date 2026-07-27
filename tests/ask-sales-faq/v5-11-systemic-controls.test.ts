import { describe, expect, it } from "vitest";

import type { AskSalesFaqChatMessage } from "@/lib/ask-sales-faq/types";
import type { V4SystemicNeed, V4SystemicQueryPlan } from "@/lib/ask-sales-faq/v4/systemic/types";
import { refineV511QueryPlan } from "@/lib/ask-sales-faq/v5-11/runtime";
import { retrieveV511Policies, v511DecisionFamilyForNeed } from "@/lib/ask-sales-faq/v5-11/retrieval";
import { resolveV511Turn } from "@/lib/ask-sales-faq/v5-11/turn";

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

function selected(question: string, item = need(question)) {
  const turn = resolveV511Turn(question, []);
  const plan: V4SystemicQueryPlan = { needs: [item], conversationIntent: "answer", reasoningSummary: "fixture" };
  return retrieveV511Policies(turn, plan).candidates.filter((candidate) => candidate.needScores?.N1);
}

describe("Ask Sales V5.11 bounded systemic controls", () => {
  it("selects the standard payment-first synthesis for a next-day payment question", () => {
    const question = "The client will pay tomorrow. Can they sign the agreement tonight?";
    const item = need(question, { relation: "requirement", domains: ["payment", "contract"] });
    expect(v511DecisionFamilyForNeed(item)).toBe("standard_payment_before_contract");
    const candidates = selected(question, item);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].policy.id).toBe("v511src-standard-payment-before-contract");
    expect(candidates[0].policy.decision).toMatch(/payment first/i);
  });

  it("keeps one reviewed synthesis attached to every planner-split need it answers", () => {
    const question = "The client pays tomorrow. Can they sign tonight, and what is the correct payment-contract order?";
    const first = need("Can the client sign tonight before payment tomorrow?", { id: "N1", relation: "requirement", entities: ["contract", "payment"] });
    const second = need("What is the payment and contract order?", { id: "N2", relation: "requirement", entities: ["contract", "payment"] });
    const plan: V4SystemicQueryPlan = { needs: [first, second], conversationIntent: "answer", reasoningSummary: "fixture" };
    const retrieval = retrieveV511Policies(resolveV511Turn(question, []), plan);
    const reviewed = retrieval.candidates.find((candidate) => candidate.policy.id === "v511src-standard-payment-before-contract");
    expect(reviewed?.needScores?.N1).toBeDefined();
    expect(reviewed?.needScores?.N2).toBeDefined();
  }, 15_000);

  it("does not force the standard sequence over an explicitly named wire workflow", () => {
    const question = "For an approved same-call wire close, do we sign before confirming the wire?";
    expect(v511DecisionFamilyForNeed(need(question))).toBeNull();
  });

  it("reconciles separate Apple TV submission with the non-guaranteed VIP placement boundary", () => {
    const question = "Does VIP put the episode on several platforms, and can Apple TV submission be purchased?";
    const candidates = selected(question, need(question, { productScope: "main_istv", relation: "inclusion" }));
    expect(candidates).toHaveLength(1);
    expect(candidates[0].policy.id).toBe("v511src-vip-platform-submission-boundary");
    expect(candidates[0].policy.decision).toMatch(/Apple TV submission may be purchased separately/i);
    expect(candidates[0].policy.decision).toMatch(/never guarantees Apple TV placement/i);
  });

  it("selects the approved PDF last-resort synthesis instead of a neighboring reuse-license document", () => {
    const question = "The prospect insists on something to show the team. Can I email the approved PDF instead of the sales slide deck?";
    const candidates = selected(question, need(question, { relation: "permission" }));
    expect(candidates).toHaveLength(1);
    expect(candidates[0].policy.id).toBe("v511src-license-pdf-email-last-resort");
    expect(candidates[0].policy.decision).toMatch(/approved PDF may be emailed as a last resort/i);
    expect(candidates[0].policy.decision).toMatch(/slide deck remains prohibited/i);
  });

  it("selects the already-scheduled Keap email-opt-out exception", () => {
    const question = "Keap says opted out, but Call 1 is already scheduled today. Should I cancel?";
    const candidates = selected(question, need(question, { relation: "procedure" }));
    expect(candidates).toHaveLength(1);
    expect(candidates[0].policy.id).toBe("v511src-scheduled-keap-email-optout-call");
    expect(candidates[0].policy.decision).toMatch(/do not cancel solely/i);
  });

  it("does not apply the Keap status exception after an explicit STOP request", () => {
    const question = "They explicitly texted STOP and Keap says opted out, but Call 1 is scheduled today. Should I call?";
    expect(v511DecisionFamilyForNeed(need(question))).toBeNull();
  });

  it("routes an explicit Zoom-link generation action to Sales Tech", () => {
    const question = "Can you generate the Zoom link for my applicant's sales call?";
    const turn = resolveV511Turn(question, []);
    const plan: V4SystemicQueryPlan = {
      conversationIntent: "answer",
      reasoningSummary: "fixture",
      needs: [need(question, { relation: "permission", actions: ["generate"], entities: ["Zoom link"] })],
    };
    const refined = refineV511QueryPlan(plan, turn);
    expect(refined.needs[0].requestKind).toBe("operational_action");
    expect(refined.needs[0].forcedRouteKey).toBe("sales_tech");
  });

  it("does not turn a passive Zoom policy question into a live action", () => {
    const question = "Where should I request a Zoom link?";
    const turn = resolveV511Turn(question, []);
    const plan: V4SystemicQueryPlan = {
      conversationIntent: "answer",
      reasoningSummary: "fixture",
      needs: [need(question, { relation: "procedure", entities: ["Zoom link"] })],
    };
    const refined = refineV511QueryPlan(plan, turn);
    expect(refined.needs[0].forcedRouteKey).toBeFalsy();
    expect(refined.needs[0].requestKind).toBe("knowledge");
  });

  it("keeps a general self-generated-lead difference question as one overview need", () => {
    const question = "Is there anything different I should make sure happens because I generated the lead myself?";
    const turn = resolveV511Turn(question, []);
    const plan: V4SystemicQueryPlan = {
      conversationIntent: "answer",
      reasoningSummary: "fixture",
      needs: [
        need("Are there onboarding differences?", { id: "N1", relation: "procedure" }),
        need("How is commission entered?", { id: "N2", relation: "procedure" }),
      ],
    };
    const refined = refineV511QueryPlan(plan, turn);
    expect(refined.needs).toHaveLength(1);
    expect(refined.needs[0].text).toBe(question);
  });

  it("carries an omitted PDF referent only from the immediate prior governed-artifact question", () => {
    const messages: AskSalesFaqChatMessage[] = [
      { role: "user", content: "Can I email the slide deck, or should I use the approved PDF?" },
      { role: "assistant", content: "Do not email the slides. Prefer screen sharing the approved PDF." },
      { role: "user", content: "What if they insist that I email something they can show the team?" },
    ];
    const turn = resolveV511Turn(messages[2].content, messages);
    expect(turn.usedImmediateContext).toBe(true);
    expect(turn.standaloneQuestion).toMatch(/approved PDF/i);
    expect(turn.standaloneQuestion).toMatch(/email something/i);
  });

  it("does not contaminate an unrelated email question with the previous topic", () => {
    const messages: AskSalesFaqChatMessage[] = [
      { role: "user", content: "Can I email the approved PDF?" },
      { role: "assistant", content: "Only as a last resort." },
      { role: "user", content: "New question: can I email a testimonial to a prospect?" },
    ];
    const turn = resolveV511Turn(messages[2].content, messages);
    expect(turn.usedImmediateContext).toBe(false);
  });
});

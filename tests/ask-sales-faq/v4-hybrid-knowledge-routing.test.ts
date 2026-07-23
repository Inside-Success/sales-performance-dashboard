import { describe, expect, it } from "vitest";

import {
  getV4AtomicDecisionLedger,
  getV4AtomicDecisionLedgerVersion,
} from "@/lib/ask-sales-faq/v4/systemic/decision-ledger";
import { getV4SystemicCorpus } from "@/lib/ask-sales-faq/v4/systemic/corpus";
import {
  inferV4SystemicRelation,
  inferV4SystemicRequestKind,
} from "@/lib/ask-sales-faq/v4/systemic/relations";
import { retrieveV4SystemicPolicies } from "@/lib/ask-sales-faq/v4/systemic/retrieval";
import { applyV4SystemicDeterministicQueryGuards } from "@/lib/ask-sales-faq/v4/systemic/runtime";
import { resolveV4SystemicTurn } from "@/lib/ask-sales-faq/v4/systemic/turn";
import type { V4SystemicNeed, V4SystemicQueryPlan } from "@/lib/ask-sales-faq/v4/systemic/types";

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
    relation: inferV4SystemicRelation(text),
    requestKind: inferV4SystemicRequestKind(text),
    ambiguity: "none",
    clarificationQuestion: "",
    ...overrides,
  };
}

function retrieve(question: string, overrides: Partial<V4SystemicNeed> = {}) {
  const plannedNeed = need(question, overrides);
  const plan: V4SystemicQueryPlan = {
    needs: [plannedNeed],
    conversationIntent: "answer",
    reasoningSummary: "V4.4 generalized regression",
  };
  return retrieveV4SystemicPolicies(resolveV4SystemicTurn(question, []), plan);
}

describe("Ask Sales V4.4 hybrid knowledge and routing", () => {
  it("compiles every source policy into traceable atomic decisions", () => {
    const corpus = getV4SystemicCorpus();
    const ledger = getV4AtomicDecisionLedger();
    expect(new Set(ledger.map((item) => item.parentPolicyId)).size).toBe(corpus.length);
    expect(ledger.length).toBeGreaterThan(corpus.length);
    expect(ledger.every((item) => item.statement && item.sourceIds.length && item.relations.length)).toBe(true);
    expect(getV4AtomicDecisionLedgerVersion()).toMatch(/^ask-sales-v4\.4-atomic:[a-f0-9]{16}$/);
  });

  it("binds relationship and request kind to the original user clause, not a model paraphrase", () => {
    const question = "May I text a prospect the approved news article before the call?";
    expect(inferV4SystemicRelation(question)).toBe("permission");
    const guarded = applyV4SystemicDeterministicQueryGuards({
      needs: [need("Determine whether prospects are included in receiving an article", {
        authorityText: undefined,
        originalRequestText: undefined,
        relation: "inclusion",
        requestKind: "knowledge",
        retrievalQueries: ["approved article inclusion"],
      })],
      conversationIntent: "answer",
      reasoningSummary: "model paraphrase",
    }, resolveV4SystemicTurn(question, []));
    expect(guarded.needs[0]).toMatchObject({
      authorityText: question,
      relation: "permission",
      requestKind: "knowledge",
    });
  });

  it("recognizes owner verification and SOP sequence relationships", () => {
    expect(inferV4SystemicRelation("Who should verify a signed contract?")).toBe("owner");
    expect(inferV4SystemicRelation("What is the official text, email, and call sequence?")).toBe("procedure");
  });

  it("retrieves the exact Built for More script decision rather than a generic artifact card", () => {
    const retrieval = retrieve("Which script should I use for DJ Built for More?", {
      productScope: "dj_nlceo",
      relation: "artifact_identity",
      domains: ["sales scripts"],
      actions: ["use existing script"],
      entities: ["Built for More", "NLCEO script"],
    });
    const matching = retrieval.candidates.find((candidate) => /use the nlceo script and swap out the show name/i.test(candidate.matchedDecisionText || ""));
    expect(matching).toBeDefined();
    expect(matching?.needScores?.N1.rank).toBeLessThanOrEqual(5);
  });

  it("retrieves the current five-year placement rule above stale two-year wording", () => {
    const retrieval = retrieve("Is the current ISTV placement guarantee two years or five years?", {
      productScope: "main_istv",
      relation: "duration",
      domains: ["content rights"],
      entities: ["ISTV", "placement guarantee"],
    });
    const current = retrieval.candidates.find((candidate) => /(?:now|current).{0,80}5 years|5 years, not 2 years/i.test(candidate.matchedDecisionText || ""));
    expect(current).toBeDefined();
    expect(current?.needScores?.N1.rank).toBeLessThanOrEqual(5);
  });

  it("does not create broad conflicts from generic cast-member, payment, or Keap terms", () => {
    const ownership = retrieve("A 20 percent lead is already booked with another rep. What should I note in Keap?", {
      relation: "procedure",
      domains: ["lead ownership", "sales tech"],
      entities: ["20 percent lead", "Keap"],
    });
    expect(ownership.blockedTopicIds).toEqual([]);

    const testimonial = retrieve("May a past cast member share a publicly approved testimonial?", {
      relation: "permission",
      domains: ["communications", "compliance"],
      entities: ["past cast member", "approved testimonial"],
    });
    expect(testimonial.blockedTopicIds).toEqual([]);
  });

  it("assigns each live action in a compound request to its actual owner", () => {
    const question = "Please pause this client's next ACH payment and reschedule their filming delivery call.";
    const guarded = applyV4SystemicDeterministicQueryGuards({
      needs: [
        need("Pause this client's next ACH payment", { id: "N1", requestKind: "operational_action" }),
        need("Reschedule their filming delivery call", { id: "N2", requestKind: "operational_action" }),
      ],
      conversationIntent: "answer",
      reasoningSummary: "compound action",
    }, resolveV4SystemicTurn(question, []));
    expect(guarded.needs.map((item) => item.forcedRouteKey)).toEqual(["finance", "fulfillment"]);
  });

  it("keeps knowledge questions in policy even when they mention finance", () => {
    const question = "Are reps allowed to offer a custom payment split?";
    const guarded = applyV4SystemicDeterministicQueryGuards({
      needs: [need(question, { relation: "payment_option", requestKind: "knowledge" })],
      conversationIntent: "answer",
      reasoningSummary: "knowledge route",
    }, resolveV4SystemicTurn(question, []));
    expect(guarded.needs[0].requestKind).toBe("knowledge");
    expect(guarded.needs[0].forcedRouteKey).toBeNull();
  });
});

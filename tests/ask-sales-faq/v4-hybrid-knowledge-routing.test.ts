import { describe, expect, it } from "vitest";

import {
  getV4AtomicDecisionLedger,
  getV4AtomicDecisionLedgerVersion,
} from "@/lib/ask-sales-faq/v4/systemic/decision-ledger";
import { getV4SystemicCorpus } from "@/lib/ask-sales-faq/v4/systemic/corpus";
import {
  inferV4SystemicRelation,
  inferV4SystemicRequestKind,
  v4SystemicDecisionObjectErrors,
} from "@/lib/ask-sales-faq/v4/systemic/relations";
import { retrieveV4SystemicPolicies } from "@/lib/ask-sales-faq/v4/systemic/retrieval";
import {
  applyV4SystemicDeterministicQueryGuards,
  parseV4SystemicSourcePlan,
} from "@/lib/ask-sales-faq/v4/systemic/runtime";
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
    expect(inferV4SystemicRelation("For ISTV, is the placement guarantee two years or five?")).toBe("duration");
    expect(inferV4SystemicRelation("Does a franchise owner need approval from the brand?")).toBe("requirement");
    expect(inferV4SystemicRelation("Who exactly must approve it?")).toBe("owner");
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

    const alreadyBooked = retrieve("A 20% dial-list lead says another rep already booked her, but Keap does not show that rep. What should I record?", {
      relation: "requirement",
      domains: ["lead ownership"],
      actions: ["record"],
      entities: ["20% dial-list lead", "Keap", "another rep"],
    });
    expect(alreadyBooked.blockedTopicIds).not.toContain("blocked_1350b414e9d4ba38");
    expect(v4SystemicDecisionObjectErrors(
      "A 20% lead is already booked with another rep; what should I record in Keap?",
      "For 20% post-call notes, report in both the spreadsheet and Keap.",
    )).toContain("the evidence governs a different decision object than the request");
  });

  it("does not treat two compiled cards from the same Slack thread as a conflict", () => {
    const text = "Can I share our viewer demographic data during Call 2?";
    const plannedNeed = need(text, { relation: "permission" });
    const plan: V4SystemicQueryPlan = { needs: [plannedNeed], conversationIntent: "answer", reasoningSummary: "duplicate lineage" };
    const retrieval = retrieveV4SystemicPolicies(resolveV4SystemicTurn(text, []), plan);
    const duplicates = retrieval.candidates.filter((candidate) =>
      candidate.policy.systemic.sourceIds.some((sourceId) => sourceId.endsWith("1780607943.627119")),
    ).slice(0, 2);
    expect(duplicates).toHaveLength(2);
    const sourcePlan = parseV4SystemicSourcePlan(JSON.stringify({
      needs: [{
        need_id: "N1",
        direct_refs: duplicates.map((candidate) => candidate.policy.id),
        conflicts: [{
          positions: duplicates.map((candidate) => ({ refs: [candidate.policy.id] })),
        }],
        preferred_refs: [],
        disposition: "route",
      }],
    }), plan, retrieval);
    expect(sourcePlan.needs[0].lane).toBe("answer");
    expect(sourcePlan.needs[0].preferredPolicyIds).toHaveLength(1);
  });

  it("preserves one exact stable support boundary when an owner action is still required", () => {
    const text = "This lead's phone looks fake and they ignored calls, texts, and email. Can I cancel their booked call now?";
    const plannedNeed = need(text, { relation: "permission" });
    const plan: V4SystemicQueryPlan = { needs: [plannedNeed], conversationIntent: "answer", reasoningSummary: "bounded support" };
    const retrieval = retrieveV4SystemicPolicies(resolveV4SystemicTurn(text, []), plan);
    const exact = retrieval.candidates.find((candidate) => /requires one-by-one approval from rich/i.test(candidate.policy.decision));
    expect(exact).toBeDefined();
    const sourcePlan = parseV4SystemicSourcePlan(JSON.stringify({
      needs: [{
        need_id: "N1",
        direct_refs: [exact!.policy.id],
        preferred_refs: [],
        conflicts: [],
        disposition: "route",
      }],
    }), plan, retrieval);
    expect(sourcePlan.needs[0]).toMatchObject({
      lane: "answer",
      preferredPolicyIds: [exact!.policy.id],
    });
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

    const currentArtifactQuestion = "A cast member wants future payments stopped and I also need the current onboarding recording. Where do those two requests go?";
    const currentArtifactPlan = applyV4SystemicDeterministicQueryGuards({
      needs: [
        need("Where does a request to stop future payments for a cast member go?", {
          id: "N1",
          requestKind: "operational_action",
          relation: "routing",
          domains: ["payments"],
          actions: ["stop"],
          entities: ["future payments"],
        }),
        need("Where is the current onboarding recording located?", {
          id: "N2",
          requestKind: "artifact_request",
          relation: "artifact_location",
          domains: ["onboarding"],
          actions: ["locate"],
          entities: ["onboarding recording"],
        }),
      ],
      conversationIntent: "answer",
      reasoningSummary: "current artifact compound action",
    }, resolveV4SystemicTurn(currentArtifactQuestion, []));
    expect(currentArtifactPlan.needs.map((item) => item.forcedRouteKey)).toEqual(["finance", "fulfillment"]);
    expect(currentArtifactPlan.needs[0]).toMatchObject({ relation: "routing", requestKind: "operational_action" });

    const downstreamDeliveryPlan = applyV4SystemicDeterministicQueryGuards({
      needs: [need("How should the delivery schedule be updated after pausing payments?", {
        requestKind: "operational_action",
        relation: "procedure",
        domains: ["delivery"],
        actions: ["update schedule"],
        entities: ["delivery schedule"],
      })],
      conversationIntent: "answer",
      reasoningSummary: "downstream owner",
    }, resolveV4SystemicTurn("Please pause payments and update the delivery schedule.", []));
    expect(downstreamDeliveryPlan.needs[0].forcedRouteKey).toBe("fulfillment");
  });

  it("routes live ownership verification to Sales Tech but current notification ownership to Sales Policy", () => {
    const ownershipQuestion = "A 20% lead was already booked to another closer and contacted again. Who should verify the ownership credit before anyone changes it?";
    const ownership = applyV4SystemicDeterministicQueryGuards({
      needs: [need("Who should verify the ownership credit before anyone changes it?", {
        relation: "owner",
        requestKind: "knowledge",
        domains: ["lead ownership"],
        actions: ["verify ownership credit"],
        entities: ["20% lead", "ownership credit"],
      })],
      conversationIntent: "answer",
      reasoningSummary: "live ownership verification",
    }, resolveV4SystemicTurn(ownershipQuestion, []));
    expect(ownership.needs[0]).toMatchObject({ requestKind: "current_lookup", forcedRouteKey: "sales_tech" });

    const notificationQuestion = "I changed OnceHub for an appointment today. Who is the current manager I must notify about the reduced availability?";
    const notification = applyV4SystemicDeterministicQueryGuards({
      needs: [need(notificationQuestion, {
        relation: "owner",
        requestKind: "current_lookup",
        domains: ["availability"],
        actions: ["notify manager"],
        entities: ["current manager", "OnceHub"],
      })],
      conversationIntent: "answer",
      reasoningSummary: "notification owner",
    }, resolveV4SystemicTurn(notificationQuestion, []));
    expect(notification.needs[0].forcedRouteKey).toBe("sales_policy");
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

import { describe, expect, it } from "vitest";

import { matchingV4SystemicAuthorityResolutions } from "@/lib/ask-sales-faq/v4/systemic/authority-resolutions";
import {
  inferV4SystemicRelation,
  inferV4SystemicRequestKind,
  v4SystemicNeedPolicyRelationErrors,
} from "@/lib/ask-sales-faq/v4/systemic/relations";
import { v4SystemicNeedRelationErrors } from "@/lib/ask-sales-faq/v4/systemic/runtime";
import { resolveV4SystemicTurn } from "@/lib/ask-sales-faq/v4/systemic/turn";
import type {
  V4SystemicNeed,
  V4SystemicNeedDecision,
  V4SystemicQueryPlan,
  V4SystemicRetrieval,
} from "@/lib/ask-sales-faq/v4/systemic/types";
import { evaluateV51DecisionContract, v51OperationalEffectErrors } from "@/lib/ask-sales-faq/v5/decision-contract";
import { refineV51QueryPlan, resolveV51RouteKey } from "@/lib/ask-sales-faq/v5/decision-routing";
import { getV5KnowledgeSnapshot } from "@/lib/ask-sales-faq/v5/knowledge";
import { retrieveV5Policies } from "@/lib/ask-sales-faq/v5/retrieval";

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

function refine(text: string, overrides: Partial<V4SystemicNeed> = {}) {
  const turn = resolveV4SystemicTurn(text, []);
  const plan: V4SystemicQueryPlan = {
    needs: [need(text, overrides)],
    conversationIntent: "answer",
    reasoningSummary: "test",
  };
  return refineV51QueryPlan(plan, turn).needs[0];
}

function emptyDecision(routeKey: V4SystemicNeedDecision["routeKey"] = null): V4SystemicNeedDecision {
  return {
    needId: "N1",
    lane: "route",
    evidenceRefs: [],
    answerSentences: [],
    routeKey,
    clarificationQuestion: "",
    confidence: 0,
    reason: "test",
  };
}

const emptyRetrieval = { candidates: [] } as unknown as V4SystemicRetrieval;

describe("Ask Sales V5.1 decision contract and owner binding", () => {
  it("keeps reusable navigation and existing-resource permission in the knowledge lane", () => {
    const link = refine("Can the client share the same onboarding link with a family member?", {
      requestKind: "artifact_request",
      relation: "artifact_identity",
    });
    expect(link).toMatchObject({ requestKind: "knowledge", relation: "permission", forcedRouteKey: null });

    const destination = refine("Where should I send supporting documents from a lead for greenlight approval?", {
      requestKind: "operational_action",
      relation: "routing",
    });
    expect(destination).toMatchObject({ requestKind: "knowledge", relation: "routing", forcedRouteKey: null });
  });

  it("binds true live work to the action owner before topic-based hints", () => {
    const automation = refine("A payment succeeded but the contract redirect failed. Can someone fix the automation?", {
      requestKind: "operational_action",
    });
    expect(automation).toMatchObject({ requestKind: "operational_action", forcedRouteKey: "sales_tech" });
    expect(resolveV51RouteKey(automation, emptyDecision("finance"), emptyRetrieval)).toBe("sales_tech");

    const card = refine("The client's Amex is failing right now. Can you confirm why it failed?", {
      requestKind: "knowledge",
    });
    expect(card).toMatchObject({ requestKind: "current_lookup", forcedRouteKey: "finance" });
    expect(resolveV51RouteKey(card, emptyDecision("sales_policy"), emptyRetrieval)).toBe("finance");

    const support = refine("Where should I send a lead's supporting documents for greenlight approval?", {
      requestKind: "operational_action",
      relation: "routing",
    });
    expect(resolveV51RouteKey(support, emptyDecision("greenlight"), emptyRetrieval)).toBe("fulfillment");
  });

  it("turns a named person's personal action into an owner relationship", () => {
    expect(refine("Does the featured partner personally interview clients in the studio?", {
      relation: "other",
    })).toMatchObject({ requestKind: "knowledge", relation: "owner" });
  });

  it("keeps a generic rep requirement as a requirement rather than actor ownership", () => {
    expect(refine("If a client's payment arrangement changes, does the rep need to send a new contract?", {
      relation: "owner",
      domains: ["contracts", "controlled artifact"],
      actions: ["send", "locate current artifact"],
    })).toMatchObject({
      requestKind: "knowledge",
      relation: "requirement",
      domains: ["contracts"],
      actions: ["send"],
    });
  });

  it("repairs lexical relation traps without changing the requested decision", () => {
    expect(refine("What does the SEO benefit mean for the client?", { relation: "inclusion" })).toMatchObject({
      requestKind: "knowledge",
      relation: "definition",
    });
    expect(refine("What are the social promo assets in this offer?", { relation: "discount" })).toMatchObject({
      requestKind: "knowledge",
      relation: "definition",
    });
  });

  it("routes governed operational owners consistently across paraphrases", () => {
    const referral = refine("For a self-generated referral, do I enter the lead or have them apply before greenlight?", {
      requestKind: "knowledge",
    });
    expect(referral.forcedRouteKey).toBe("sales_tech");
    expect(resolveV51RouteKey(referral, emptyDecision("sales_policy"), emptyRetrieval)).toBe("sales_tech");

    const upgrade = refine("Can you give me the current package upgrade link?", { requestKind: "artifact_request" });
    expect(resolveV51RouteKey(upgrade, emptyDecision("sales_policy"), emptyRetrieval)).toBe("sales_tech");

    const contract = refine("The client switched from wire to a card and signed a second agreement. Can you void the first contract?", {
      requestKind: "operational_action",
    });
    expect(resolveV51RouteKey(contract, emptyDecision("sales_policy"), emptyRetrieval)).toBe("finance");
  });

  it("routes a review request when the referenced content is not supplied", () => {
    expect(refine("Can someone review this prospect's message and tell me whether to reject him?", {
      requestKind: "knowledge",
    })).toMatchObject({ requestKind: "current_lookup", forcedRouteKey: "sales_policy" });

    expect(refine('Review this message: "I own a dental practice and want to discuss the show."', {
      requestKind: "current_lookup",
    }).forcedRouteKey).not.toBe("sales_policy");
  });

  it("binds a greenlit contract-status lookup to Greenlight across paraphrases", () => {
    const status = refine("Where should a rep confirm whether a greenlit prospect's contract was sent?", {
      requestKind: "knowledge",
      relation: "artifact_location",
    });
    expect(status).toMatchObject({ requestKind: "current_lookup", relation: "status", forcedRouteKey: "greenlight" });
    expect(resolveV51RouteKey(status, emptyDecision("sales_policy"), emptyRetrieval)).toBe("greenlight");
  });

  it("rejects a nearby professional-eligibility answer for a program-format question", () => {
    const snapshot = getV5KnowledgeSnapshot();
    const question = "Do we offer reality-TV casting opportunities for real-estate professionals?";
    const plannedNeed = need(question, { relation: "inclusion" });
    const format = snapshot.policies.find((policy) => policy.id === "curated_v43_documentary_not_reality_tv");
    const realtor = snapshot.policies.find((policy) => /realtor can be approved/i.test(policy.decision));
    expect(format).toBeDefined();
    expect(realtor).toBeDefined();
    expect(evaluateV51DecisionContract(plannedNeed, format!).disposition).not.toBe("rejected");
    expect(evaluateV51DecisionContract(plannedNeed, realtor!).errors).toContain(
      "the evidence does not govern the requested program format decision object",
    );
  });

  it("retrieves the exact relationship while excluding the observed wrong neighbor", () => {
    const question = "Do we offer reality-TV casting opportunities for real-estate professionals?";
    const plannedNeed = need(question, { relation: "inclusion" });
    const result = retrieveV5Policies(resolveV4SystemicTurn(question, []), {
      needs: [plannedNeed],
      conversationIntent: "answer",
      reasoningSummary: "program format",
    });
    expect(result.candidates.map((candidate) => candidate.policy.id)).toContain("curated_v43_documentary_not_reality_tv");
    expect(result.candidates.some((candidate) => /realtor can be approved/i.test(candidate.policy.decision))).toBe(false);
    expect(result.diagnostics?.needs[0].evidenceState).toBe("exact_evidence_found");
  });

  it("admits exact governed relationships that an authority resolution explicitly controls", () => {
    const cases = [
      {
        question: "Where should I post a correction for an incorrect daily-stats submission?",
        relation: "routing" as const,
        policyId: "curated_v43_daily_stats_workflow",
      },
      {
        question: "What does Daymond John personally create for the client's episode?",
        relation: "owner" as const,
        policyId: "curated_v43_daymond_intro_interview_boundary",
        productScope: "dj_nlceo" as const,
      },
      {
        question: "Can three partners from the same business appear together in one episode?",
        relation: "permission" as const,
        policyId: "curated_v43_multiple_partners_one_episode",
      },
      {
        question: "Can a client's parent use the same onboarding link?",
        relation: "permission" as const,
        policyId: "curated_v43_same_onboarding_link",
        domains: ["onboarding"],
        actions: ["share link"],
        entities: ["onboarding link", "mother", "client"],
      },
    ];
    for (const item of cases) {
      const plannedNeed = need(item.question, {
        relation: item.relation,
        productScope: item.productScope || "unknown",
        domains: item.domains || [],
        actions: item.actions || [],
        entities: item.entities || [],
      });
      const policy = getV5KnowledgeSnapshot().policies.find((candidate) => candidate.id === item.policyId);
      expect(policy, item.policyId).toBeDefined();
      expect(evaluateV51DecisionContract(plannedNeed, policy!).errors, item.policyId).toEqual([]);
      const retrieval = retrieveV5Policies(resolveV4SystemicTurn(item.question, []), {
        needs: [plannedNeed],
        conversationIntent: "answer",
        reasoningSummary: "exact authority",
      });
      expect(retrieval.candidates.map((candidate) => candidate.policy.id), item.policyId).toContain(item.policyId);
      if (item.policyId === "curated_v43_multiple_partners_one_episode") {
        expect(retrieval.candidates.map((candidate) => candidate.policy.id)).not.toContain("operational_653b93b28eee7fab");
      }
    }
  });

  it("admits exact definition and obligation evidence while preserving exact-list boundaries", () => {
    const snapshot = getV5KnowledgeSnapshot();
    const cases = [
      {
        question: "What does the SEO benefit from PR exposure mean for a Next Level CEO client?",
        policyId: "curated_v43_seo_definition",
        productScope: "dj_nlceo" as const,
        domains: ["SEO", "PR"],
        actions: ["explain"],
        entities: ["SEO benefit", "PR exposure", "Next Level CEO client"],
      },
      {
        question: "What are the social promo assets included for a Next Level CEO client?",
        policyId: "curated_v43_social_promo_assets_definition",
        productScope: "dj_nlceo" as const,
        domains: ["marketing", "social media"],
        actions: ["include"],
        entities: ["social promo assets", "Next Level CEO"],
      },
      {
        question: "What does the contract mean by cooperating with promotional activities and sharing trailers or social posts?",
        policyId: "operational_70c95085c7e192fb",
        productScope: "unknown" as const,
        domains: ["contract"],
        actions: ["cooperate", "share"],
        entities: ["promotional activities", "trailers", "social posts"],
      },
    ];
    for (const item of cases) {
      const plannedNeed = refine(item.question, {
        relation: "definition",
        requestKind: "knowledge",
        productScope: item.productScope,
        domains: item.domains,
        actions: item.actions,
        entities: item.entities,
      });
      const policy = snapshot.policies.find((candidate) => candidate.id === item.policyId);
      expect(policy, item.policyId).toBeDefined();
      expect(evaluateV51DecisionContract(plannedNeed, policy!).errors, item.policyId).toEqual([]);
      const retrieval = retrieveV5Policies(resolveV4SystemicTurn(item.question, []), {
        needs: [plannedNeed],
        conversationIntent: "answer",
        reasoningSummary: "exact definition",
      });
      expect(retrieval.candidates.map((candidate) => candidate.policy.id), item.policyId).toContain(item.policyId);
    }

    expect(refine("What are the current exact social promo assets included in the selected package?", {
      relation: "inclusion",
    }).text).toContain("current exact");
    expect(refine("What are social promo assets included for a client?", {
      relation: "inclusion",
    })).toMatchObject({
      text: "Define social promotional assets and explain their purpose in the offer.",
      relation: "definition",
    });
  });

  it("retrieves newly verified authoritative decisions without admitting their known neighbors", () => {
    const cases = [
      {
        question: "A client's bank flags the standard Whop link. May I use the emergency payment link listed in the spreadsheet?",
        policyId: "curated_v51_emergency_payment_link_exception",
        relation: "permission" as const,
        productScope: "unknown" as const,
      },
      {
        question: "If an existing client's payment arrangement changes, does the rep need to send a new contract?",
        policyId: "curated_v51_payment_change_new_contract",
        relation: "requirement" as const,
        productScope: "unknown" as const,
      },
      {
        question: "A business owner wants a nine-episode docuseries. What should the rep recommend first?",
        policyId: "curated_v51_docuseries_one_episode_first",
        relation: "procedure" as const,
        productScope: "main_istv" as const,
      },
      {
        question: "How long does a Next Level CEO client have to film, and where should a rep ask about exact studio availability?",
        policyId: "curated_v51_nlceo_filming_window",
        relation: "deadline" as const,
        productScope: "dj_nlceo" as const,
      },
    ];
    for (const item of cases) {
      const plannedNeed = refine(item.question, {
        relation: item.relation,
        requestKind: "knowledge",
        productScope: item.productScope,
      });
      const policy = getV5KnowledgeSnapshot().policies.find((candidate) => candidate.id === item.policyId);
      expect(policy, item.policyId).toBeDefined();
      expect(evaluateV51DecisionContract(plannedNeed, policy!).errors, item.policyId).toEqual([]);
      const retrieval = retrieveV5Policies(resolveV4SystemicTurn(item.question, []), {
        needs: [plannedNeed],
        conversationIntent: "answer",
        reasoningSummary: "verified authority",
      });
      expect(retrieval.candidates.map((candidate) => candidate.policy.id), item.policyId).toContain(item.policyId);
    }
  });

  it("preserves each atomic definition in a compound request", () => {
    const original = "For Next Level CEO, what do the SEO benefit, social promo assets, and swag package mean?";
    const plan: V4SystemicQueryPlan = {
      needs: [
        need("Define the SEO benefit.", { id: "N1", originalRequestText: original, entities: ["SEO benefit"], relation: "definition" }),
        need("Define social promo assets.", { id: "N2", originalRequestText: original, entities: ["social promo assets"], relation: "definition" }),
        need("Define the swag package.", { id: "N3", originalRequestText: original, entities: ["swag package"], relation: "definition" }),
      ],
      conversationIntent: "answer",
      reasoningSummary: "compound definition",
    };
    const refined = refineV51QueryPlan(plan, resolveV4SystemicTurn(original, []));
    expect(refined.needs.map((item) => item.text)).toEqual([
      "Define the SEO benefit.",
      "Define social promotional assets and explain their purpose in the offer.",
      "Define the swag package.",
    ]);

    const expectedPolicies = [
      "curated_v43_seo_definition",
      "curated_v43_social_promo_assets_definition",
      "curated_v43_swag_definition",
    ];
    refined.needs.forEach((atomicNeed, index) => {
      const policy = getV5KnowledgeSnapshot().policies.find((candidate) => candidate.id === expectedPolicies[index]);
      expect(policy, expectedPolicies[index]).toBeDefined();
      expect(evaluateV51DecisionContract(atomicNeed, policy!).errors, expectedPolicies[index]).toEqual([]);
    });
  });

  it("retrieves the second-call classification separately from the EOD correction in a compound request", () => {
    const original = "How are Call 2 appointments counted in end-of-day stats, and how should a rep correct stats they already submitted?";
    const atomic = need("How are Call 2 appointments counted in end-of-day stats?", {
      authorityText: "How are Call 2 appointments counted in end-of-day stats?",
      originalRequestText: original,
      relation: "definition",
      domains: ["reporting", "appointments"],
      actions: ["counting"],
      entities: ["Call 2 appointments", "end-of-day stats"],
    });
    const policy = getV5KnowledgeSnapshot().policies.find((candidate) => candidate.id === "curated_v43_daily_stats_workflow");
    expect(policy).toBeDefined();
    expect(evaluateV51DecisionContract(atomic, policy!).errors).toEqual([]);
    const retrieval = retrieveV5Policies(resolveV4SystemicTurn(original, []), {
      needs: [atomic],
      conversationIntent: "answer",
      reasoningSummary: "atomic compound need",
    });
    expect(retrieval.candidates.map((candidate) => candidate.policy.id)).toContain("curated_v43_daily_stats_workflow");
  });

  it("blocks internal metadata, wrong destinations, and reversed permissions before model judgment", () => {
    const routingNeed = need("Where should I send the supporting documents for greenlight approval?", { relation: "routing" });
    expect(v51OperationalEffectErrors(
      routingNeed,
      "Policy context: send it in #greenlight-requests.",
      "Send the supporting documents to the fulfillment hotline.",
    )).toEqual(expect.arrayContaining([
      "internal evidence metadata cannot be rendered as a user-facing answer",
      "the greenlight destination is not supported by the cited evidence",
    ]));

    const permissionNeed = need("Can a guest use the same onboarding link?", { relation: "permission" });
    expect(v51OperationalEffectErrors(
      permissionNeed,
      "No, the guest cannot use the same link.",
      "Yes. An additional attendee may use the same onboarding link.",
    )).toContain("the answer reverses the permission polarity in the evidence");
  });

  it("lets a direct explanation answer a contract-clause meaning without repeating the artifact name", () => {
    const question = "What does the contract mean by cooperating with promotional activities and sharing trailers or social posts?";
    const answer = "Cooperating with promotional activities means posting the social assets provided in the onboarding email on social media to announce the feature and spread buzz about ISTV.";
    expect(v4SystemicNeedRelationErrors(question, answer)).toEqual([]);
    const policy = getV5KnowledgeSnapshot().policies.find((candidate) => candidate.id === "operational_70c95085c7e192fb");
    expect(policy).toBeDefined();
    expect(v4SystemicNeedPolicyRelationErrors(refine(question, { relation: "definition" }), policy!)).toEqual([]);
  });

  it("keeps an incidental payment method from changing the governed contract-sharing permission", () => {
    const question = "Can I email the contract link if the client wants to review it and is paying by wire?";
    const plannedNeed = refine(question, {
      relation: "permission",
      requestKind: "knowledge",
      domains: ["contract", "payment"],
      actions: ["email", "review", "pay"],
      entities: ["contract link", "client", "wire"],
    });
    const policy = getV5KnowledgeSnapshot().policies.find((candidate) => candidate.id === "operational_95ddcec72a090d31");
    expect(policy).toBeDefined();
    expect(matchingV4SystemicAuthorityResolutions(plannedNeed).map((resolution) => resolution.id)).toContain("contract-email-review-permission");
    expect(evaluateV51DecisionContract(plannedNeed, policy!).errors).toEqual([]);
    const retrieval = retrieveV5Policies(resolveV4SystemicTurn(question, []), {
      needs: [plannedNeed],
      conversationIntent: "answer",
      reasoningSummary: "contract sharing permission",
    });
    expect(retrieval.candidates.map((candidate) => candidate.policy.id)).toContain("operational_95ddcec72a090d31");
  });
});

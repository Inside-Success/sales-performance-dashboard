import { describe, expect, it } from "vitest";

import {
  matchingV4SystemicAuthorityResolutions,
  validateV4SystemicAuthorityResolutions,
  v4SystemicResolutionPolicyDisposition,
} from "@/lib/ask-sales-faq/v4/systemic/authority-resolutions";
import { getV4SystemicBlockedTopics, getV4SystemicCorpus } from "@/lib/ask-sales-faq/v4/systemic/corpus";
import {
  inferV4SystemicRelation,
  inferV4SystemicPolicyRelations,
  inferV4SystemicRequestKind,
  v4SystemicMaterialQuestionClauses,
  v4SystemicNeedPolicyRelationErrors,
} from "@/lib/ask-sales-faq/v4/systemic/relations";
import { retrieveV4SystemicPolicies } from "@/lib/ask-sales-faq/v4/systemic/retrieval";
import {
  applyV4SystemicDeterministicQueryGuards,
  parseV4SystemicSourcePlan,
  v4SystemicExactControllingEvidenceSupports,
  v4SystemicExactDirectFallbackSentence,
  v4SystemicNeedRelationErrors,
  v4SystemicNeedRequiresCurrentArtifact,
  v4SystemicPolicyBoundaryErrors,
  v4SystemicUnconditionalControllingEvidenceSupports,
} from "@/lib/ask-sales-faq/v4/systemic/runtime";
import type {
  V4SystemicCandidate,
  V4SystemicNeed,
  V4SystemicPolicy,
  V4SystemicQueryPlan,
  V4SystemicRetrieval,
} from "@/lib/ask-sales-faq/v4/systemic/types";
import { resolveV4SystemicTurn } from "@/lib/ask-sales-faq/v4/systemic/turn";

function need(text: string, overrides: Partial<V4SystemicNeed> = {}): V4SystemicNeed {
  return {
    id: "N1",
    text,
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

describe("V4.1 claim relations and authority controls", () => {
  it("keeps an either-or applicant qualification choice in the eligibility relationship", () => {
    expect(inferV4SystemicRelation(
      "For Operation CEO, must the applicant own an LLC, or can the owner of a nonprofit qualify?",
    )).toBe("eligibility");
  });

  it("keeps every claim-resolution reference valid against the effective corpus", () => {
    expect(validateV4SystemicAuthorityResolutions(
      getV4SystemicCorpus(),
      getV4SystemicBlockedTopics().map((topic) => topic.id),
    )).toEqual([]);
  });

  it("types eligibility and action ownership from the requested relationship", () => {
    expect(inferV4SystemicRelation("Should I tell this early-stage lead they are not a fit?")).toBe("eligibility");
    expect(inferV4SystemicRelation("Can I cancel an audition for someone I recently disqualified?")).toBe("permission");
    expect(inferV4SystemicRelation("Who sends recurring invoices to the client?")).toBe("owner");
    expect(inferV4SystemicRelation("Do reps send recurring invoices, or is that automated?")).toBe("owner");
    expect(inferV4SystemicRelation("Determine whether the sending of invoices for recurring client payments is automated.")).toBe("owner");
    const recurringInvoicePolicy = getV4SystemicCorpus().find((policy) => policy.id === "claim_754c01ed0089dc82");
    expect(recurringInvoicePolicy).toBeDefined();
    expect(inferV4SystemicPolicyRelations(recurringInvoicePolicy!)).toContain("owner");
  });

  it("types a sendable live episode as a current artifact rather than person ownership", () => {
    const question = "Do we have a live episode on the network featuring someone who owns a nonprofit that I can send to a prospect?";
    expect(inferV4SystemicRequestKind(question)).toBe("artifact_request");
    expect(inferV4SystemicRelation(question)).toBe("artifact_identity");

    const guarded = applyV4SystemicDeterministicQueryGuards({
      needs: [need("Determine whether a live episode exists featuring someone who owns a nonprofit.", {
        relation: "owner",
        requestKind: "knowledge",
      })],
      conversationIntent: "answer",
      reasoningSummary: "planner confused the featured person's ownership with the requested media artifact",
    }, resolveV4SystemicTurn(question, []));
    expect(guarded.needs[0]).toMatchObject({
      relation: "artifact_identity",
      requestKind: "artifact_request",
    });
    expect(guarded.needs[0].domains).toContain("controlled artifact");
  });

  it("keeps a signed-contract ACH wait question in the reusable policy lane", () => {
    const question = "I have the signed contract, but the client paid by ACH. Do I need to wait for the payment to clear before signing them up for onboarding?";
    expect(inferV4SystemicRequestKind(question)).toBe("knowledge");
    expect(inferV4SystemicRelation(question)).toBe("requirement");

    const plannerNeed = need(
      "Apply the rule for whether onboarding should wait while ACH remains pending even though the signed contract was received.",
      { relation: "status", requestKind: "current_lookup" },
    );
    const guarded = applyV4SystemicDeterministicQueryGuards({
      needs: [plannerNeed],
      conversationIntent: "answer",
      reasoningSummary: "planner used incidental status words",
    }, resolveV4SystemicTurn(question, []));
    expect(guarded.needs).toHaveLength(1);
    expect(guarded.needs[0]).toMatchObject({ relation: "requirement", requestKind: "knowledge" });
  });

  it("keeps recommendation order out of the release-timing relationship", () => {
    const question = "If a prospect is budget-sensitive, may I start by recommending Lite, or must I present the higher package first?";
    expect(inferV4SystemicRelation("May I start by recommending Lite for a budget-sensitive prospect?")).toBe("permission");
    const guarded = applyV4SystemicDeterministicQueryGuards({
      needs: [
        need("May I start by recommending Lite for a budget-sensitive prospect?", { relation: "timing_start" }),
        need("Must I present the higher package first?", { relation: "requirement" }),
      ],
      conversationIntent: "answer",
      reasoningSummary: "planner split two sides of one policy decision",
    }, resolveV4SystemicTurn(question, []));
    expect(guarded.needs).toHaveLength(1);
    expect(guarded.needs[0]).toMatchObject({ relation: "requirement", requestKind: "knowledge" });
  });

  it("forces financial transaction confirmation to its live action owner", () => {
    const plannedNeed = need("How should I confirm a third-party payment for this cast member?", {
      domains: ["payments"],
      actions: ["confirm transaction"],
      entities: ["third-party payment"],
      relation: "procedure",
      requestKind: "knowledge",
    });
    const plan: V4SystemicQueryPlan = {
      needs: [plannedNeed],
      conversationIntent: "answer",
      reasoningSummary: "finance action",
    };
    const retrieval = retrieveV4SystemicPolicies(resolveV4SystemicTurn(plannedNeed.text, []), plan);
    const sourcePlan = parseV4SystemicSourcePlan(JSON.stringify({ needs: [] }), plan, retrieval);
    expect(sourcePlan.needs[0]).toMatchObject({ lane: "route", preferredPolicyIds: [] });
    expect(sourcePlan.needs[0].reason).toMatch(/Finance action owner/i);

    const contractNeed = need("How should I get the contract signed if it does not populate automatically?", {
      retrievalQueries: [plannedNeed.text, "failed contract automation"],
      domains: ["contracts"],
      actions: ["recover failed automation"],
      entities: ["contract"],
      relation: "procedure",
      requestKind: "knowledge",
    });
    const compoundPlan = { ...plan, needs: [plannedNeed, contractNeed] };
    const compoundRetrieval = retrieveV4SystemicPolicies(resolveV4SystemicTurn(`${plannedNeed.text} ${contractNeed.text}`, []), compoundPlan);
    const compoundSourcePlan = parseV4SystemicSourcePlan(JSON.stringify({ needs: [] }), compoundPlan, compoundRetrieval);
    expect(compoundSourcePlan.needs[0].reason).toMatch(/Finance action owner/i);
    expect(compoundSourcePlan.needs[1].reason).not.toMatch(/Finance action owner/i);
  });

  it("applies the ABD ownership correction only to the exact qualification claim", () => {
    const exactNeed = need("Can a hospital-employed doctor who does not own a practice qualify for America's Best Doctors?", {
      productScope: "main_istv",
    });
    expect(matchingV4SystemicAuthorityResolutions(exactNeed).map((resolution) => resolution.id)).toContain("abd-practice-ownership");
    expect(v4SystemicResolutionPolicyDisposition(exactNeed, "operational_c4d65012f8c4c11d")).toBe("excluded");
    expect(v4SystemicResolutionPolicyDisposition(exactNeed, "curated_9848cdfb2da72c0a")).toBe("controlling");

    const unrelatedNeed = need("Can a nurse practitioner qualify for a different show?", { productScope: "main_istv" });
    expect(matchingV4SystemicAuthorityResolutions(unrelatedNeed).map((resolution) => resolution.id)).not.toContain("abd-practice-ownership");
    expect(v4SystemicResolutionPolicyDisposition(unrelatedNeed, "operational_c4d65012f8c4c11d")).toBe("unresolved");

    const employedDoctorNeed = need("Can an employed doctor qualify for America's Best Doctors?", {
      productScope: "main_istv",
      domains: ["greenlight", "fit", "qualification"],
      actions: ["assess qualification", "greenlight"],
      entities: ["America's Best Doctors", "doctor", "medical practice", "hospital"],
    });
    const employedDoctorRetrieval = retrieveV4SystemicPolicies(
      resolveV4SystemicTurn(employedDoctorNeed.text, []),
      { needs: [employedDoctorNeed], conversationIntent: "answer", reasoningSummary: "bounded ABD retrieval" },
    );
    expect(employedDoctorRetrieval.blockedMatches).toEqual([]);
  });

  it("retires the unsupported contract prohibition without treating recency alone as authority", () => {
    const plannedNeed = need("Can I email the contract for the client to review?", {
      domains: ["contract"],
      actions: ["email", "review"],
      entities: ["contract"],
      relation: "permission",
    });
    expect(matchingV4SystemicAuthorityResolutions(plannedNeed).map((resolution) => resolution.id)).toContain(
      "contract-email-review-permission",
    );
    expect(v4SystemicResolutionPolicyDisposition(plannedNeed, "operational_6034269702586108")).toBe("excluded");
    expect(v4SystemicResolutionPolicyDisposition(plannedNeed, "operational_95ddcec72a090d31")).toBe("controlling");
    const retrieval = retrieveV4SystemicPolicies(resolveV4SystemicTurn(plannedNeed.text, []), {
      needs: [plannedNeed],
      conversationIntent: "answer",
      reasoningSummary: "contract source-fidelity test",
    });
    expect(retrieval.candidates.map((candidate) => candidate.policy.id)).not.toContain("operational_6034269702586108");
    expect(retrieval.candidates.map((candidate) => candidate.policy.id)).toContain("operational_95ddcec72a090d31");
    const sourcePlan = parseV4SystemicSourcePlan(JSON.stringify({
      needs: [{
        need_id: "N1",
        direct_refs: ["claim_582e2ccc60704621", "operational_95ddcec72a090d31"],
        preferred_refs: ["claim_582e2ccc60704621"],
        conflicts: [],
        disposition: "answer",
      }],
    }), {
      needs: [plannedNeed],
      conversationIntent: "answer",
      reasoningSummary: "contract source-fidelity test",
    }, retrieval);
    expect(sourcePlan.needs[0].preferredPolicyIds).toEqual(["operational_95ddcec72a090d31"]);
    const controllingPolicy = getV4SystemicCorpus().find((policy) => policy.id === "operational_95ddcec72a090d31");
    expect(controllingPolicy).toBeDefined();
    expect(v4SystemicUnconditionalControllingEvidenceSupports(
      plannedNeed,
      "Yes, you are allowed to share the contract via email before the client signs.",
      controllingPolicy!,
    )).toBe(true);
    const compoundNeed = need(
      "Is it permissible to email the contract link when the client wants to review it and is paying by wire?",
      {
        relation: "permission",
        domains: ["contract", "payment"],
        actions: ["email", "review", "pay"],
        entities: ["contract link", "wire payment"],
      },
    );
    expect(matchingV4SystemicAuthorityResolutions(compoundNeed).map((resolution) => resolution.id)).toContain(
      "contract-email-review-permission",
    );
    const compoundRetrieval = retrieveV4SystemicPolicies(resolveV4SystemicTurn(compoundNeed.text, []), {
      needs: [compoundNeed],
      conversationIntent: "answer",
      reasoningSummary: "compound contract condition",
    });
    const compoundSourcePlan = parseV4SystemicSourcePlan(JSON.stringify({
      needs: [{
        need_id: "N1",
        direct_refs: ["operational_95ddcec72a090d31", "operational_bb933d76b00226c0"],
        preferred_refs: ["operational_95ddcec72a090d31", "operational_bb933d76b00226c0"],
        conflicts: [],
        disposition: "answer",
      }],
    }), {
      needs: [compoundNeed],
      conversationIntent: "answer",
      reasoningSummary: "compound contract condition",
    }, compoundRetrieval);
    expect(compoundSourcePlan.needs[0].preferredPolicyIds).toEqual(["operational_95ddcec72a090d31"]);
  });

  it("matches authority phrases on token boundaries instead of accidental substrings", () => {
    const unrelatedNeed = need("How should we adjust the cohort reschedule policy?", {
      relation: "procedure",
    });
    expect(matchingV4SystemicAuthorityResolutions(unrelatedNeed).map((resolution) => resolution.id)).not.toContain("dj-no-cohort");
  });

  it("uses the later owner-approved current offer for CEO Day availability and payment without asserting turnaround", () => {
    const paymentTerms = need("What payment terms apply to the $5,000 CEO Day upgrade for Next Level CEO?", {
      relation: "payment_option",
      productScope: "dj_nlceo",
      domains: ["upsells", "billing"],
      entities: ["CEO Day upgrade", "Next Level CEO"],
    });
    expect(matchingV4SystemicAuthorityResolutions(paymentTerms).map((resolution) => resolution.id)).toContain(
      "dj-ceo-day-upgrade-current-offer",
    );
    expect(v4SystemicResolutionPolicyDisposition(paymentTerms, "owner-dj-nlceo-current-offer-overview")).toBe("controlling");

    const availability = need("Is the $5,000 CEO Day upgrade currently available for Next Level CEO?", {
      relation: "status",
      productScope: "dj_nlceo",
    });
    expect(matchingV4SystemicAuthorityResolutions(availability).map((resolution) => resolution.id)).toContain(
      "dj-ceo-day-upgrade-current-offer",
    );
    expect(v4SystemicResolutionPolicyDisposition(availability, "owner-dj-nlceo-current-offer-overview")).toBe("controlling");
  });

  it("does not turn a correct no-cohort fact into permission to edit controlled wording", () => {
    const noCohortPolicy = getV4SystemicCorpus().find((policy) => policy.id === "claim_0de0110a15158df9__a5");
    expect(noCohortPolicy).toBeDefined();
    const wordingNeed = need(
      "Can I change the morning confirmation text myself, or should I leave it unchanged?",
      {
        relation: "requirement",
        productScope: "dj_nlceo",
        domains: ["messaging", "permissions"],
        actions: ["edit", "change", "leave unchanged"],
        entities: ["morning confirmation text"],
      },
    );
    expect(v4SystemicNeedPolicyRelationErrors(wordingNeed, noCohortPolicy!)).toContain(
      "the cited policy fact does not authorize modifying the controlled wording",
    );
  });

  it("matches ordinary plural forms without weakening exact claim scope", () => {
    const pluralNeed = need("Should freelancers move to Call 2, or do they need an established business to qualify?", {
      relation: "eligibility",
      domains: ["qualification"],
      actions: ["qualify", "move to Call 2"],
      entities: ["freelancers", "business"],
    });
    expect(matchingV4SystemicAuthorityResolutions(pluralNeed).map((resolution) => resolution.id)).toContain(
      "freelancer-business-qualification",
    );
    expect(v4SystemicResolutionPolicyDisposition(pluralNeed, "claim_59be9c344b9359a4")).toBe("controlling");
    const freelancerPlan: V4SystemicQueryPlan = {
      needs: [pluralNeed],
      conversationIntent: "answer",
      reasoningSummary: "freelancer exact-source fallback",
    };
    const freelancerRetrieval = retrieveV4SystemicPolicies(resolveV4SystemicTurn(pluralNeed.text, []), freelancerPlan);
    expect(v4SystemicExactDirectFallbackSentence(
      pluralNeed,
      freelancerPlan,
      freelancerRetrieval,
      ["claim_59be9c344b9359a4"],
    )?.text).toMatch(/genuine business, offer, ownership, and broader fit/i);

    const unrelatedNeed = need("Are there freelance camera resources for Call 2?", {
      relation: "artifact_identity",
    });
    expect(matchingV4SystemicAuthorityResolutions(unrelatedNeed).map((resolution) => resolution.id)).not.toContain(
      "freelancer-business-qualification",
    );
  });

  it("does not use Keap-only lead ownership evidence for a Keap-to-HubSpot workflow", () => {
    const keapOwnership = getV4SystemicCorpus().find((policy) => policy.id === "claim_44284fbaae3d3309__a4");
    expect(keapOwnership).toBeDefined();
    const crossSystemNeed = need(
      "Is there approved training for transferring or managing leads between Keap and HubSpot?",
      {
        relation: "procedure",
        domains: ["CRM workflow"],
        actions: ["transfer leads"],
        entities: ["Keap", "HubSpot"],
      },
    );
    expect(v4SystemicNeedPolicyRelationErrors(crossSystemNeed, keapOwnership!)).toContain(
      "single-system evidence does not establish the requested Keap-to-HubSpot workflow",
    );
  });

  it("does not let a model retrieval expansion invent an unrelated open conflict", () => {
    const question = "Can reps create a custom payment plan for a client?";
    const customPlanNeed = need(question, {
      relation: "payment_option",
      domains: ["payment"],
      actions: ["create"],
      entities: ["custom payment plan", "client"],
      retrievalQueries: [
        question,
        "Do clients have to pay in full before booking or filming Miami studio time?",
      ],
    });
    const retrieval = retrieveV4SystemicPolicies(resolveV4SystemicTurn(question, []), {
      needs: [customPlanNeed],
      conversationIntent: "answer",
      reasoningSummary: "adversarial retrieval expansion",
    });
    expect(retrieval.blockedTopicIds).not.toContain("blocked_6dc994230a3978d4");
    expect(matchingV4SystemicAuthorityResolutions(customPlanNeed).map((resolution) => resolution.id)).toContain(
      "custom-payment-plan-boundary",
    );
  });

  it("does not treat an artifact-access warning as an artifact-location answer", () => {
    const question = "Where can I find the recording of a phone call?";
    const locationNeed = need(question, {
      relation: "artifact_location",
      requestKind: "artifact_request",
      domains: ["phone calls", "recordings"],
      actions: ["find", "access"],
      entities: ["recording", "phone call"],
    });
    const accessBoundary = getV4SystemicCorpus().find((policy) => policy.id === "claim_32e99f86ea68be37__a3");
    expect(accessBoundary).toBeDefined();
    expect(inferV4SystemicPolicyRelations(accessBoundary!)).toContain("permission");
    expect(v4SystemicNeedPolicyRelationErrors(locationNeed, accessBoundary!)).toContain(
      "an artifact-access permission boundary does not establish the requested artifact location",
    );

    const retrieval = retrieveV4SystemicPolicies(resolveV4SystemicTurn(question, []), {
      needs: [locationNeed],
      conversationIntent: "answer",
      reasoningSummary: "phone recording location relationship test",
    });
    expect(retrieval.candidates[0]?.policy.id).toBe("operational_f5e7e1c8abccdb06");
    const sourcePlan = parseV4SystemicSourcePlan(JSON.stringify({
      needs: [{
        need_id: "N1",
        direct_refs: ["claim_32e99f86ea68be37__a3"],
        preferred_refs: ["claim_32e99f86ea68be37__a3"],
        conflicts: [],
        disposition: "answer",
      }],
    }), {
      needs: [locationNeed],
      conversationIntent: "answer",
      reasoningSummary: "phone recording location relationship test",
    }, retrieval);
    expect(sourcePlan.needs[0]).toMatchObject({ lane: "route", preferredPolicyIds: [] });
  });

  it("forces controlling claim evidence and removes the retired ABD position before model selection", () => {
    const question = "Can a hospital-employed doctor who does not own a practice qualify for America's Best Doctors?";
    const turn = resolveV4SystemicTurn(question, []);
    const plannedNeed = need(question, {
      productScope: "main_istv",
      domains: ["qualification"],
      actions: ["qualify"],
      entities: ["hospital-employed doctor", "practice ownership"],
    });
    const plan: V4SystemicQueryPlan = { needs: [plannedNeed], conversationIntent: "answer", reasoningSummary: "test" };
    const retrieval = retrieveV4SystemicPolicies(turn, plan, 120);
    expect(retrieval.candidates.map((candidate) => candidate.policy.id)).not.toContain("operational_c4d65012f8c4c11d");
    expect(retrieval.candidates.map((candidate) => candidate.policy.id)).toContain("curated_9848cdfb2da72c0a");
    const sourcePlan = parseV4SystemicSourcePlan(JSON.stringify({
      needs: [{
        need_id: "N1",
        direct_refs: ["operational_c4d65012f8c4c11d", "curated_9848cdfb2da72c0a", "operational_332070a5ba42a56d"],
        preferred_refs: ["operational_c4d65012f8c4c11d"],
        conflicts: [{ positions: [
          { refs: ["operational_c4d65012f8c4c11d", "operational_332070a5ba42a56d"], position: "practice ownership required" },
          { refs: ["curated_9848cdfb2da72c0a"], position: "practice ownership not required" },
        ] }],
        disposition: "answer",
      }],
    }), plan, retrieval);
    expect(sourcePlan.needs[0].lane).toBe("answer");
    expect(sourcePlan.needs[0].preferredPolicyIds).toContain("curated_9848cdfb2da72c0a");
    expect(sourcePlan.needs[0].preferredPolicyIds).not.toContain("operational_c4d65012f8c4c11d");
    expect(sourcePlan.needs[0].preferredPolicyIds).not.toContain("operational_332070a5ba42a56d");
    expect(sourcePlan.needs[0].directPolicyIds).not.toContain("operational_c4d65012f8c4c11d");
  });

  it("uses the approved ownership-window duration to answer an anchored expiration question", () => {
    const question = "If I logged a real contact in Keap today, when does my 30-day lead ownership expire?";
    const plannedNeed = need(question, {
      relation: "deadline",
      domains: ["lead ownership"],
      actions: ["log documented contact"],
      entities: ["Keap", "30-day ownership window"],
    });
    expect(matchingV4SystemicAuthorityResolutions(plannedNeed).map((resolution) => resolution.id)).toContain(
      "lead-ownership-thirty-day-window",
    );
    const turn = resolveV4SystemicTurn(question, []);
    const plan: V4SystemicQueryPlan = {
      needs: [plannedNeed],
      conversationIntent: "answer",
      reasoningSummary: "ownership deadline test",
    };
    const retrieval = retrieveV4SystemicPolicies(turn, plan);
    const controlling = "curated_78f9823829434d41";
    expect(retrieval.candidates.map((candidate) => candidate.policy.id)).toContain(controlling);
    const sourcePlan = parseV4SystemicSourcePlan(JSON.stringify({
      needs: [{
        need_id: "N1",
        direct_refs: [controlling],
        preferred_refs: [controlling],
        conflicts: [],
        disposition: "answer",
      }],
    }), plan, retrieval);
    expect(sourcePlan.needs[0]).toMatchObject({ lane: "answer" });
    const controllingIds = new Set(matchingV4SystemicAuthorityResolutions(plannedNeed)
      .flatMap((resolution) => resolution.controlling_policy_ids));
    expect(sourcePlan.needs[0].preferredPolicyIds.some((id) => controllingIds.has(id))).toBe(true);
  });

  it("retires the older same-day onboarding notification instruction at the exact claim scope", () => {
    const question = "Do I need to notify anyone separately for a same-day onboarding booking after all post-sale steps are complete?";
    const plannedNeed = need(question, {
      productScope: "main_istv",
      domains: ["onboarding"],
      actions: ["notify"],
      entities: ["same-day onboarding", "post-sale steps"],
    });
    const matching = matchingV4SystemicAuthorityResolutions(plannedNeed).map((resolution) => resolution.id);
    expect(matching).toContain("same-day-onboarding-notification");
    expect(v4SystemicResolutionPolicyDisposition(plannedNeed, "operational_99c259c37a3816ff")).toBe("excluded");
    expect(v4SystemicResolutionPolicyDisposition(plannedNeed, "curated_d6b8616db00c16df")).toBe("controlling");

    const turn = resolveV4SystemicTurn(question, []);
    const retrieval = retrieveV4SystemicPolicies(turn, {
      needs: [plannedNeed],
      conversationIntent: "answer",
      reasoningSummary: "same-day onboarding resolution test",
    });
    expect(retrieval.candidates.map((candidate) => candidate.policy.id)).not.toContain("operational_99c259c37a3816ff");
    expect(retrieval.candidates.map((candidate) => candidate.policy.id)).toContain("curated_d6b8616db00c16df");

    const naturalQuestion = "I booked an onboarding slot for later today after completing every post-sale step. Do I need to notify anyone separately?";
    const naturalNeed = need(naturalQuestion, {
      productScope: "main_istv",
      domains: ["onboarding", "post-sale"],
      actions: ["notify"],
      entities: ["onboarding slot for later today"],
      relation: "requirement",
    });
    expect(matchingV4SystemicAuthorityResolutions(naturalNeed).map((resolution) => resolution.id)).toContain(
      "same-day-onboarding-notification",
    );
    const naturalRetrieval = retrieveV4SystemicPolicies(resolveV4SystemicTurn(naturalQuestion, []), {
      needs: [naturalNeed],
      conversationIntent: "answer",
      reasoningSummary: "natural same-day phrasing test",
    });
    expect(naturalRetrieval.blockedMatches.map((match) => match.topicId)).not.toEqual(expect.arrayContaining([
      "blocked_47d122ca36beff50",
      "blocked_3ae983b020485f8d",
      "blocked_6522ba21e9d254b6",
    ]));

    const paraphraseGuard = applyV4SystemicDeterministicQueryGuards({
      needs: [need("After completing the sale and onboarding email, do I need to notify anyone separately?", {
        relation: "requirement",
      })],
      conversationIntent: "answer",
      reasoningSummary: "planner omitted the same-day qualifier",
    }, resolveV4SystemicTurn(naturalQuestion, []));
    expect(paraphraseGuard.needs[0].retrievalQueries).toContain(naturalQuestion);
    expect(matchingV4SystemicAuthorityResolutions(paraphraseGuard.needs[0]).map((resolution) => resolution.id)).toContain(
      "same-day-onboarding-notification",
    );
  });

  it("uses the owner-approved weekly-training replacement instead of the older inclusion claim", () => {
    const question = "Does the Lite plan still include access to the Weekly Marketing Training?";
    const plannedNeed = need(question, {
      productScope: "main_istv",
      domains: ["training", "package inclusion"],
      actions: ["confirm inclusion"],
      entities: ["Lite plan", "Weekly Marketing Training"],
      relation: "inclusion",
    });
    expect(matchingV4SystemicAuthorityResolutions(plannedNeed).map((resolution) => resolution.id)).toContain(
      "weekly-marketing-training-discontinued",
    );
    expect(v4SystemicResolutionPolicyDisposition(plannedNeed, "operational_5389822b467bab54")).toBe("excluded");
    expect(v4SystemicResolutionPolicyDisposition(plannedNeed, "owner-six-month-training-discontinued")).toBe("controlling");

    const turn = resolveV4SystemicTurn(question, []);
    const plan: V4SystemicQueryPlan = {
      needs: [plannedNeed],
      conversationIntent: "answer",
      reasoningSummary: "weekly training replacement test",
    };
    const retrieval = retrieveV4SystemicPolicies(turn, plan);
    expect(retrieval.candidates.map((candidate) => candidate.policy.id)).not.toContain("operational_5389822b467bab54");
    expect(retrieval.candidates.map((candidate) => candidate.policy.id)).toContain("owner-six-month-training-discontinued");
    const sourcePlan = parseV4SystemicSourcePlan(JSON.stringify({
      needs: [{
        need_id: "N1",
        direct_refs: ["owner-six-month-training-discontinued"],
        preferred_refs: ["owner-six-month-training-discontinued"],
        conflicts: [],
        disposition: "answer",
      }],
    }), plan, retrieval);
    expect(sourcePlan.needs[0]).toMatchObject({
      lane: "answer",
      preferredPolicyIds: ["owner-six-month-training-discontinued"],
    });

    const materialNeed = need("Do we have any additional material that explains the six-month training program?", {
      relation: "artifact_identity",
      requestKind: "artifact_request",
    });
    expect(matchingV4SystemicAuthorityResolutions(materialNeed).map((resolution) => resolution.id)).toContain(
      "weekly-marketing-training-discontinued",
    );

    const differentlyWordedNeed = need(
      "Are there other in-person training and networking programs throughout the year besides Mastermind?",
      { relation: "inclusion" },
    );
    expect(matchingV4SystemicAuthorityResolutions(differentlyWordedNeed).map((resolution) => resolution.id)).not.toContain(
      "weekly-marketing-training-discontinued",
    );
    expect(v4SystemicResolutionPolicyDisposition(differentlyWordedNeed, "operational_5389822b467bab54")).toBe("excluded");
  });

  it("records exact source resolutions for newer scheduling and ownership decisions", () => {
    const fridayNeed = need(
      "When Call 1 happens Friday, should Call 2 be before Sunday or may it be scheduled Monday?",
      { productScope: "main_istv", relation: "permission" },
    );
    expect(matchingV4SystemicAuthorityResolutions(fridayNeed).map((resolution) => resolution.id)).toContain(
      "friday-call-one-weekend-scheduling",
    );
    expect(v4SystemicResolutionPolicyDisposition(fridayNeed, "curated_8a9c0c6ea1953a5a")).toBe("controlling");
    expect(v4SystemicResolutionPolicyDisposition(fridayNeed, "operational_f71ab703a9e563ed")).toBe("excluded");
    expect(v4SystemicResolutionPolicyDisposition(fridayNeed, "v3src_weekend_call_choice")).toBe("excluded");
    expect(v4SystemicResolutionPolicyDisposition(fridayNeed, "claim_ecc77594f73a2c9e")).toBe("excluded");

    const calendarNeed = need("If a client books calls with two different reps, which rep owns the client?", {
      relation: "owner",
    });
    expect(matchingV4SystemicAuthorityResolutions(calendarNeed).map((resolution) => resolution.id)).toContain(
      "two-calendar-ownership-resolution",
    );
    expect(v4SystemicResolutionPolicyDisposition(calendarNeed, "v3src_two_calendar_engagement")).toBe("controlling");
  });

  it("keeps a single Friday-versus-Monday scheduling choice atomic", () => {
    const question = "When Call 1 happens on a Friday, are we supposed to schedule Call 2 for Monday, or should it happen before the Sunday cohort closes?";
    const guarded = applyV4SystemicDeterministicQueryGuards({
      needs: [
        need("Schedule Call 2 for Monday after a Friday Call 1.", { id: "N1", relation: "timing_start" }),
        need("Call 2 should happen before the Sunday cohort closes.", { id: "N2", relation: "requirement" }),
      ],
      conversationIntent: "answer",
      reasoningSummary: "planner split two branches of one scheduling decision",
    }, resolveV4SystemicTurn(question, []));
    expect(guarded.needs).toHaveLength(1);
    expect(guarded.needs[0].text).toBe(question);
    expect(guarded.reasoningSummary).toMatch(/one atomic decision/i);
  });

  it("uses the later no-launch decision only for the exact early-stage boundary", () => {
    const question = "A lead says their website, social media, and company have not launched yet and they are in the very early stages. Should I conduct Call 1 or tell them they are not a fit?";
    const plannedNeed = need(question, {
      relation: "eligibility",
      domains: ["lead qualification"],
      actions: ["assess fit", "conduct Call 1"],
      entities: ["early-stage lead", "website", "social media", "company"],
    });
    expect(matchingV4SystemicAuthorityResolutions(plannedNeed).map((resolution) => resolution.id)).toContain(
      "early-stage-no-launch-reapply",
    );
    expect(v4SystemicResolutionPolicyDisposition(plannedNeed, "operational_7888fa50e96a3ede")).toBe("controlling");
    expect(v4SystemicResolutionPolicyDisposition(plannedNeed, "claim_aa93466af64a3cdd")).toBe("excluded");

    const plan: V4SystemicQueryPlan = {
      needs: [plannedNeed],
      conversationIntent: "answer",
      reasoningSummary: "exact no-launch qualification boundary",
    };
    const retrieval = retrieveV4SystemicPolicies(resolveV4SystemicTurn(question, []), plan);
    const sourcePlan = parseV4SystemicSourcePlan(JSON.stringify({
      needs: [{ need_id: "N1", direct_refs: [], preferred_refs: [], conflicts: [], disposition: "route" }],
    }), plan, retrieval);
    expect(sourcePlan.needs[0]).toMatchObject({
      lane: "answer",
      preferredPolicyIds: ["operational_7888fa50e96a3ede"],
    });

    const futureLaunch = need(
      "Can a Next Level CEO applicant qualify if the business launches in three months but already has a website, strong story, and the ability to invest?",
      { productScope: "dj_nlceo", relation: "eligibility" },
    );
    expect(matchingV4SystemicAuthorityResolutions(futureLaunch).map((resolution) => resolution.id)).not.toContain(
      "early-stage-no-launch-reapply",
    );
  });

  it("merges a planner-split early-stage either-or decision before applying exact authority", () => {
    const question = "A lead says their website, social media, and company have not launched yet and they are in the very early stages. Should I conduct Call 1 or tell them they are not a fit?";
    const guarded = applyV4SystemicDeterministicQueryGuards({
      needs: [
        need("Conduct Call 1 for the early-stage lead.", {
          id: "N1",
          relation: "procedure",
          domains: ["lead qualification"],
          actions: ["conduct Call 1"],
          entities: ["early-stage lead"],
        }),
        need("Determine whether the lead is not a fit because the business has not launched.", {
          id: "N2",
          relation: "eligibility",
          domains: ["lead qualification"],
          actions: ["assess fit", "disqualify"],
          entities: ["early-stage lead", "website", "social media", "company"],
        }),
      ],
      conversationIntent: "answer",
      reasoningSummary: "planner split the two branches of one eligibility decision",
    }, resolveV4SystemicTurn(question, []));

    expect(guarded.needs).toHaveLength(1);
    expect(guarded.needs[0]).toMatchObject({
      text: question,
      authorityText: question,
      relation: "eligibility",
    });
    expect(matchingV4SystemicAuthorityResolutions(guarded.needs[0]).map((resolution) => resolution.id)).toContain(
      "early-stage-no-launch-reapply",
    );

    const retrieval = retrieveV4SystemicPolicies(resolveV4SystemicTurn(question, []), guarded);
    const sourcePlan = parseV4SystemicSourcePlan(JSON.stringify({
      needs: [{ need_id: "N1", direct_refs: [], preferred_refs: [], conflicts: [], disposition: "route" }],
    }), guarded, retrieval);
    expect(sourcePlan.needs[0]).toMatchObject({
      lane: "answer",
      preferredPolicyIds: ["operational_7888fa50e96a3ede"],
    });
  });

  it("requires contacting the original rep before acting on a previously claimed no-show lead", () => {
    const claimedLead = need(
      "A dial-out lead no-showed another rep and has now booked my calendar. Can I run the call, or do I need to contact the original rep first?",
      { relation: "procedure" },
    );
    expect(matchingV4SystemicAuthorityResolutions(claimedLead).map((resolution) => resolution.id)).toContain(
      "previously-claimed-lead-contact-first",
    );
    expect(v4SystemicResolutionPolicyDisposition(claimedLead, "v3src_previously_claimed_twenty_percent_lead")).toBe("controlling");
    expect(v4SystemicResolutionPolicyDisposition(claimedLead, "operational_49a3fe2589bb8c18")).toBe("controlling");

    const claimedPlan: V4SystemicQueryPlan = {
      needs: [claimedLead],
      conversationIntent: "answer",
      reasoningSummary: "exact claimed-lead resolution",
    };
    const claimedRetrieval = retrieveV4SystemicPolicies(resolveV4SystemicTurn(claimedLead.text, []), claimedPlan);
    expect(claimedRetrieval.blockedMatches.map((match) => match.topicId)).not.toContain("blocked_6522ba21e9d254b6");
    const claimedSourcePlan = parseV4SystemicSourcePlan(JSON.stringify({
      needs: [{ need_id: "N1", direct_refs: [], preferred_refs: [], conflicts: [], disposition: "route" }],
    }), claimedPlan, claimedRetrieval);
    expect(claimedSourcePlan.needs[0]).toMatchObject({
      lane: "answer",
      preferredPolicyIds: expect.arrayContaining([
        "v3src_previously_claimed_twenty_percent_lead",
        "operational_49a3fe2589bb8c18",
      ]),
    });

    const ordinaryNoShow = need("A new lead missed my Call 1. What should I do next?", { relation: "procedure" });
    expect(matchingV4SystemicAuthorityResolutions(ordinaryNoShow).map((resolution) => resolution.id)).not.toContain(
      "previously-claimed-lead-contact-first",
    );
  });

  it("distinguishes an earliest SMS time from an unrelated latest-time cutoff", () => {
    const earliestNeed = need("What is the earliest time I can send a day-of SMS reminder?");
    const corpus = getV4SystemicCorpus();
    const earliest = corpus.find((policy) => /Earliest time for day-of SMS reminder/i.test(policy.title));
    const cutoff = corpus.find((policy) => /SMS cutoff time is 9 PM/i.test(policy.title));
    expect(earliest).toBeDefined();
    expect(cutoff).toBeDefined();
    expect(earliestNeed.relation).toBe("timing_start");
    expect(v4SystemicNeedPolicyRelationErrors(earliestNeed, earliest!)).toEqual([]);
    expect(v4SystemicNeedPolicyRelationErrors(earliestNeed, cutoff!)).toContain(
      "the evidence answers deadline rather than the requested timing_start relationship",
    );
  });

  it("does not treat a Zoom recording location as evidence for a phone recording request", () => {
    const phoneNeed = need("Where can I find a phone call recording?");
    const zoomPolicy = getV4SystemicCorpus().find((policy) => policy.id === "operational_96f9c2c30f505fc4");
    expect(zoomPolicy).toBeDefined();
    expect(v4SystemicNeedPolicyRelationErrors(phoneNeed, zoomPolicy!)).toContain(
      "requested phone modality is not established by the evidence",
    );
  });

  it("does not use generic payment-link advice for a different UI control or backup-link failure", () => {
    const sameDeviceAdvice = getV4SystemicCorpus().find((policy) => policy.id === "operational_aa1e38c7389ea0d3");
    expect(sameDeviceAdvice).toBeDefined();
    expect(v4SystemicNeedPolicyRelationErrors(need(
      "The agree-to-terms button on the payment page will not respond.",
      { relation: "procedure", entities: ["agree-to-terms button", "payment page"] },
    ), sameDeviceAdvice!)).toContain("the requested agree-to-terms control failure is not established by the evidence");
    expect(v4SystemicNeedPolicyRelationErrors(need(
      "The backup payment link also fails.",
      { relation: "procedure", entities: ["backup payment link"] },
    ), sameDeviceAdvice!)).toContain("the requested backup payment link failure is not established by the evidence");
  });

  it("does not use a general signed-contract requirement as the recovery process for failed contract automation", () => {
    expect(inferV4SystemicRelation("Where can I find the signed agreement after an ACH payment?")).toBe("artifact_location");
    const failedAutomationNeed = need(
      "How do I get the contract signed when it does not populate automatically after a third-party payment?",
      {
        relation: "procedure",
        requestKind: "artifact_request",
        domains: ["contract"],
        actions: ["sign contract"],
        entities: ["contract", "failed automation", "third-party payment"],
      },
    );
    const generalClose = getV4SystemicCorpus().find((policy) => policy.id === "transcript-payme-after-confirmed-payment");
    const jotformRecovery = getV4SystemicCorpus().find((policy) => policy.id === "operational_fd8af741c6707d6d");
    expect(generalClose).toBeDefined();
    expect(jotformRecovery).toBeDefined();
    expect(v4SystemicNeedPolicyRelationErrors(failedAutomationNeed, generalClose!)).toContain(
      "a general contract-signing requirement does not establish the requested recovery process when contract automation fails",
    );
    expect(matchingV4SystemicAuthorityResolutions(failedAutomationNeed).map((resolution) => resolution.id)).toContain(
      "failed-contract-automation-jotform-recovery",
    );
    expect(v4SystemicResolutionPolicyDisposition(failedAutomationNeed, "operational_fd8af741c6707d6d")).toBe("controlling");
    expect(v4SystemicResolutionPolicyDisposition(failedAutomationNeed, "operational_26b9360616d8b7fe")).toBe("excluded");

    const completedAgreementLocation = need(
      "The contract did not appear after ACH, so I sent it separately and the client signed it. Where can I see the signed agreement?",
      {
        relation: "artifact_location",
        requestKind: "artifact_request",
        domains: ["contract management"],
        actions: ["view signed agreement"],
        entities: ["signed agreement"],
      },
    );
    expect(v4SystemicNeedPolicyRelationErrors(completedAgreementLocation, jotformRecovery!)).toContain(
      "a missing-contract recovery link does not establish where the completed signed agreement is stored",
    );

    const plan: V4SystemicQueryPlan = {
      needs: [failedAutomationNeed],
      conversationIntent: "answer",
      reasoningSummary: "failed contract automation",
    };
    const retrieval = retrieveV4SystemicPolicies(resolveV4SystemicTurn(failedAutomationNeed.text, []), plan);
    expect(v4SystemicPolicyBoundaryErrors(
      jotformRecovery!,
      resolveV4SystemicTurn(failedAutomationNeed.text, []),
    )).toEqual([]);
    expect(v4SystemicExactDirectFallbackSentence(
      failedAutomationNeed,
      plan,
      retrieval,
      [jotformRecovery!.id],
    )).toMatchObject({ policyId: jotformRecovery!.id });
    const sourcePlan = parseV4SystemicSourcePlan(JSON.stringify({
      needs: [{ need_id: "N1", direct_refs: [], preferred_refs: [], conflicts: [] }],
    }), plan, retrieval);
    expect(sourcePlan.needs[0].preferredPolicyIds).toEqual(["operational_fd8af741c6707d6d"]);
  });

  it("requires a lock-in amount to be covered instead of borrowing a generic upgrade process", () => {
    const lockInNeed = need("A client paid a $2,500 lock-in. What are the exact steps to move them to Standard?", {
      relation: "procedure",
    });
    const genericUpgrade = getV4SystemicCorpus().find((policy) => policy.id === "claim_76379365f9be1cfd");
    expect(genericUpgrade).toBeDefined();
    expect(v4SystemicNeedPolicyRelationErrors(lockInNeed, genericUpgrade!)).toEqual(expect.arrayContaining([
      "a lock-in payment is not established as the license or payment state covered by the evidence",
      "the request's material payment amount is not covered by the evidence",
    ]));
  });

  it("normalizes equivalent k-form and comma-form payment amounts without weakening amount coverage", () => {
    const paymentNeed = need("A client wants Standard but can only pay a $2.5k deposit. What should we do?", {
      relation: "procedure",
    });
    const exactDepositPolicy = getV4SystemicCorpus().find((policy) => policy.id === "operational_78f8bc02eb387377");
    const genericUpgrade = getV4SystemicCorpus().find((policy) => policy.id === "claim_76379365f9be1cfd");
    expect(exactDepositPolicy).toBeDefined();
    expect(genericUpgrade).toBeDefined();
    expect(v4SystemicNeedPolicyRelationErrors(paymentNeed, exactDepositPolicy!)).not.toContain(
      "the request's material payment amount is not covered by the evidence",
    );
    expect(v4SystemicNeedPolicyRelationErrors(paymentNeed, genericUpgrade!)).toContain(
      "the request's material payment amount is not covered by the evidence",
    );
  });

  it("applies an explicit all-unlisted-splits boundary without repeating arbitrary proposed amounts", () => {
    const customSplitNeed = need(
      "Which contract should they sign for a $20K license with $3K now and the remaining $17K in three weeks?",
      { relation: "payment_option" },
    );
    const boundary = getV4SystemicCorpus().find((policy) => policy.id === "owner-unlisted-payment-split-boundary");
    expect(boundary).toBeDefined();
    expect(v4SystemicNeedPolicyRelationErrors(customSplitNeed, boundary!)).not.toContain(
      "the request's material payment amount is not covered by the evidence",
    );
    const plan: V4SystemicQueryPlan = {
      needs: [customSplitNeed],
      conversationIntent: "answer",
      reasoningSummary: "exact owner boundary",
    };
    const retrieval = retrieveV4SystemicPolicies(resolveV4SystemicTurn(customSplitNeed.text, []), plan);
    expect(v4SystemicExactDirectFallbackSentence(
      customSplitNeed,
      plan,
      retrieval,
      [boundary!.id],
    )).toMatchObject({
      policyId: boundary!.id,
      text: boundary!.decision,
    });

    const unrelatedNeed = need(
      "If a business partner who is not in Keap pays for the cast member, how should I confirm the payment and get the missing contract signed?",
      {
        relation: "procedure",
        domains: ["payments", "contracts"],
        actions: ["confirm payment", "sign contract"],
        entities: ["business partner", "cast member", "Keap", "missing contract"],
      },
    );
    const unrelatedPlan: V4SystemicQueryPlan = {
      needs: [unrelatedNeed],
      conversationIntent: "answer",
      reasoningSummary: "unrelated owner-override regression",
    };
    const unrelatedRetrieval = retrieveV4SystemicPolicies(resolveV4SystemicTurn(unrelatedNeed.text, []), unrelatedPlan);
    expect(v4SystemicExactDirectFallbackSentence(
      unrelatedNeed,
      unrelatedPlan,
      unrelatedRetrieval,
      [boundary!.id],
    )).toBeNull();
  });

  it("promotes the exact Madeline-approved ACH onboarding rule after source review", () => {
    const question = "I have the signed contract, but the client paid by ACH. Do I need to wait for the payment to clear before signing them up for onboarding?";
    const plannedNeed = need(question, {
      relation: "requirement",
      domains: ["onboarding", "payment"],
      actions: ["wait", "sign up"],
      entities: ["ACH payment", "signed contract", "onboarding"],
    });
    expect(matchingV4SystemicAuthorityResolutions(plannedNeed).map((resolution) => resolution.id)).toContain(
      "ach-clearance-before-onboarding",
    );
    expect(v4SystemicResolutionPolicyDisposition(plannedNeed, "operational_8822431e281b23ac")).toBe("controlling");
    expect(v4SystemicResolutionPolicyDisposition(plannedNeed, "operational_218f15b0a75fa20f")).toBe("excluded");
    const controlling = getV4SystemicCorpus().find((policy) => policy.id === "operational_8822431e281b23ac");
    expect(controlling).toBeDefined();
    expect(v4SystemicNeedPolicyRelationErrors(plannedNeed, controlling!)).toEqual([]);
    const plan: V4SystemicQueryPlan = { needs: [plannedNeed], conversationIntent: "answer", reasoningSummary: "ACH rule" };
    const retrieval = retrieveV4SystemicPolicies(resolveV4SystemicTurn(question, []), plan);
    expect(retrieval.candidates.map((candidate) => candidate.policy.id)).toContain("operational_8822431e281b23ac");
    const sourcePlan = parseV4SystemicSourcePlan(JSON.stringify({
      needs: [{ need_id: "N1", direct_refs: [], preferred_refs: [], conflicts: [], disposition: "route" }],
    }), plan, retrieval);
    expect(sourcePlan.needs[0]).toMatchObject({
      lane: "answer",
      preferredPolicyIds: ["operational_8822431e281b23ac"],
    });
  });

  it("uses the recurring-invoice authority for both client invoice ownership and ledger handling", () => {
    const question = "Do reps send invoices for recurring client payments, or is that automated? Should those payments appear in the sales ledger?";
    const invoiceNeed = need("Determine whether recurring client invoices are automated or sent by reps.", {
      id: "N1",
      relation: "owner",
      domains: ["payments", "commissions"],
      actions: ["send invoice"],
      entities: ["recurring client invoices", "reps"],
    });
    const ledgerNeed = need("Determine whether recurring payments should appear in the sales ledger.", {
      id: "N2",
      relation: "requirement",
      domains: ["payments", "commissions"],
      actions: ["track payment"],
      entities: ["recurring payments", "sales ledger"],
    });
    const plan: V4SystemicQueryPlan = {
      needs: [invoiceNeed, ledgerNeed],
      conversationIntent: "answer",
      reasoningSummary: "recurring invoice and ledger relations",
    };
    const retrieval = retrieveV4SystemicPolicies(resolveV4SystemicTurn(question, []), plan);
    const policy = retrieval.candidates.find((candidate) => candidate.policy.id === "claim_754c01ed0089dc82");
    expect(policy).toBeDefined();
    expect(policy!.relationScore).toBeGreaterThan(0);
    const sourcePlan = parseV4SystemicSourcePlan(JSON.stringify({
      needs: [
        { need_id: "N1", direct_refs: [policy!.policy.id], preferred_refs: [policy!.policy.id], conflicts: [], disposition: "answer" },
        { need_id: "N2", direct_refs: [policy!.policy.id], preferred_refs: [policy!.policy.id], conflicts: [], disposition: "answer" },
      ],
    }), plan, retrieval);
    expect(sourcePlan.needs.map((item) => item.lane)).toEqual(["answer", "answer"]);
    expect(sourcePlan.needs.every((item) => item.preferredPolicyIds.includes("claim_754c01ed0089dc82"))).toBe(true);
  });

  it("uses source-resolved slide-photo instructions without borrowing package presentation policy", () => {
    const question = "What should I do if a prospect starts taking photos of the Call 1 presentation slides during the call?";
    const plannedNeed = need(question, {
      relation: "procedure",
      domains: ["compliance", "sales"],
      actions: ["taking photos"],
      entities: ["prospect", "Call 1 presentation slides"],
    });
    expect(matchingV4SystemicAuthorityResolutions(plannedNeed).map((resolution) => resolution.id)).toContain(
      "confidential-slide-photo-response",
    );
    const plan: V4SystemicQueryPlan = { needs: [plannedNeed], conversationIntent: "answer", reasoningSummary: "photo rule" };
    const retrieval = retrieveV4SystemicPolicies(resolveV4SystemicTurn(question, []), plan);
    const sourcePlan = parseV4SystemicSourcePlan(JSON.stringify({
      needs: [{ need_id: "N1", direct_refs: [], preferred_refs: [], conflicts: [], disposition: "route" }],
    }), plan, retrieval);
    expect(sourcePlan.needs[0].preferredPolicyIds).toContain("claim_d8f7bb6d2647ddd3");
    expect(sourcePlan.needs[0].directPolicyIds).not.toContain("owner-package-presentation-high-to-low");
  });

  it("applies the internal-statistics prohibition only to sensitive statistics screenshots", () => {
    const statsScreenshot = need("Can I send a screenshot of the internal statistics slide showing social reach?", {
      relation: "permission",
      domains: ["internal statistics"],
      actions: ["send screenshot"],
      entities: ["statistics slide", "social reach"],
    });
    expect(matchingV4SystemicAuthorityResolutions(statsScreenshot).map((resolution) => resolution.id)).toContain(
      "internal-statistics-screenshot-prohibition",
    );
    expect(v4SystemicResolutionPolicyDisposition(statsScreenshot, "operational_eef854a24abf5bd5")).toBe("controlling");
    expect(v4SystemicResolutionPolicyDisposition(statsScreenshot, "operational_cd78979d3c4a3551")).toBe("excluded");

    const ordinaryDeck = need("Can I send the standard slide deck PDF?", {
      relation: "permission",
      domains: ["sales deck"],
      actions: ["send PDF"],
      entities: ["slide deck"],
    });
    expect(matchingV4SystemicAuthorityResolutions(ordinaryDeck).map((resolution) => resolution.id)).not.toContain(
      "internal-statistics-screenshot-prohibition",
    );

    const referenceOnly = need("Should I reference only the approved information in a message?", {
      relation: "requirement",
      domains: ["data sharing"],
      actions: ["reference information"],
      entities: ["internal statistics", "message wording"],
      retrievalQueries: ["Can I send an internal statistics screenshot, or should I reference approved wording?"],
    });
    expect(matchingV4SystemicAuthorityResolutions(referenceOnly).map((resolution) => resolution.id)).not.toContain(
      "internal-statistics-screenshot-prohibition",
    );
  });

  it("keeps the repeated-applicant exception bounded from ordinary reapplication handling", () => {
    const repeated = need("Can I cancel an audition for someone I recently disqualified who keeps applying again?", {
      relation: "permission",
    });
    expect(matchingV4SystemicAuthorityResolutions(repeated).map((resolution) => resolution.id)).toContain(
      "repeated-disqualified-applicant-cancel-block",
    );
    expect(v4SystemicResolutionPolicyDisposition(repeated, "curated_6385430e3a079b63")).toBe("controlling");
    expect(v4SystemicResolutionPolicyDisposition(repeated, "operational_be17543c50abcfd0")).toBe("excluded");

    const ordinary = need("Someone was passed last week and booked another meeting. What should I do?", {
      relation: "procedure",
    });
    expect(matchingV4SystemicAuthorityResolutions(ordinary).map((resolution) => resolution.id)).not.toContain(
      "repeated-disqualified-applicant-cancel-block",
    );
  });

  it("does not import a conditional reapply wait into a generic existing-customer question", () => {
    const genericQuestion = "If someone is already an ISTV customer but applies for a different ISTV show, should I proceed with the new application or skip the call?";
    const guarded = applyV4SystemicDeterministicQueryGuards({
      needs: [need("Determine whether an existing ISTV customer applying for a different ISTV show should proceed with the new application or skip the call.", {
        relation: "requirement",
        productScope: "main_istv",
        retrievalQueries: [
          "An applicant canceled Call 2 because they could not make the investment and must wait three months.",
        ],
      })],
      conversationIntent: "answer",
      reasoningSummary: "planner expansion invented a cancellation trigger",
    }, resolveV4SystemicTurn(genericQuestion, []));
    const waitPolicy = getV4SystemicCorpus().find((policy) => policy.id === "owner-main-istv-cross-show-reapply-wait");
    const existingClientPolicy = getV4SystemicCorpus().find((policy) => policy.id === "claim_606e9d59e3cd964f");
    expect(waitPolicy).toBeDefined();
    expect(existingClientPolicy).toBeDefined();
    expect(guarded.needs[0]).toMatchObject({
      authorityText: genericQuestion,
      originalRequestText: genericQuestion,
      productScope: "main_istv",
      relation: "requirement",
    });
    expect(v4SystemicNeedPolicyRelationErrors(guarded.needs[0], waitPolicy!)).toEqual(expect.arrayContaining([
      expect.stringMatching(/requires an unstated trigger/i),
    ]));
    expect(v4SystemicNeedPolicyRelationErrors(guarded.needs[0], existingClientPolicy!)).toEqual([]);
    expect(matchingV4SystemicAuthorityResolutions(guarded.needs[0]).map((resolution) => resolution.id)).toContain(
      "existing-client-new-show-application",
    );
    const retrieval = retrieveV4SystemicPolicies(resolveV4SystemicTurn(genericQuestion, []), {
      needs: guarded.needs,
      conversationIntent: "answer",
      reasoningSummary: "existing customer exact source",
    });
    expect(retrieval.candidates.map((candidate) => candidate.policy.id)).toContain(existingClientPolicy!.id);
    const sourcePlan = parseV4SystemicSourcePlan(JSON.stringify({
      needs: [{
        need_id: "N1",
        direct_refs: [existingClientPolicy!.id],
        preferred_refs: [existingClientPolicy!.id],
        conflicts: [],
        disposition: "answer",
      }],
    }), {
      needs: guarded.needs,
      conversationIntent: "answer",
      reasoningSummary: "existing customer exact source",
    }, retrieval);
    expect(sourcePlan.needs[0]).toMatchObject({
      lane: "answer",
      preferredPolicyIds: [existingClientPolicy!.id],
    });
    expect(v4SystemicNeedRelationErrors(
      guarded.needs[0].text,
      "An existing ISTV client may purchase another show; do not automatically skip the call.",
    )).toContain("an existing-client cross-show decision must preserve the original-rep assignment check");
    const existingClientFallback = v4SystemicExactDirectFallbackSentence(
      guarded.needs[0],
      { needs: guarded.needs, conversationIntent: "answer", reasoningSummary: "existing customer exact source" },
      retrieval,
      [existingClientPolicy!.id],
    )?.text || "";
    expect(existingClientFallback).toMatch(/may purchase another show|do not automatically skip/i);
    expect(existingClientFallback).toMatch(/Keap scheduled appointments.*original assignment/i);
    expect(existingClientFallback).toMatch(/original rep is inactive.*current rep may take/i);

    const exactTriggeredQuestion = "A main ISTV applicant canceled Call 2 because they could not make the investment. Must they wait three months before applying to a different show?";
    const triggeredNeed = need(exactTriggeredQuestion, {
      authorityText: exactTriggeredQuestion,
      productScope: "main_istv",
      relation: "requirement",
    });
    expect(v4SystemicNeedPolicyRelationErrors(triggeredNeed, waitPolicy!)).toEqual([]);
  });

  it("allows a time-sensitive answer card to state a stable current-navigation procedure", () => {
    const question = "How do I verify that a Next Level CEO contract has been signed?";
    const plannedNeed = need(question, { productScope: "dj_nlceo", relation: "procedure" });
    const plan: V4SystemicQueryPlan = { needs: [plannedNeed], conversationIntent: "answer", reasoningSummary: "contract route" };
    const retrieval = retrieveV4SystemicPolicies(resolveV4SystemicTurn(question, []), plan);
    expect(retrieval.candidates.map((candidate) => candidate.policy.id)).toContain("claim_6232701406d4ef3e");
    const sourcePlan = parseV4SystemicSourcePlan(JSON.stringify({
      needs: [{
        need_id: "N1",
        direct_refs: ["claim_6232701406d4ef3e"],
        preferred_refs: ["claim_6232701406d4ef3e"],
        conflicts: [],
        disposition: "answer",
      }],
    }), plan, retrieval);
    expect(sourcePlan.needs[0]).toMatchObject({
      lane: "answer",
      preferredPolicyIds: ["claim_6232701406d4ef3e"],
    });
  });

  it("requires an exact high-risk relationship instead of accepting generic topical evidence", () => {
    const priceNeed = need("What is the price amount for the Standard package?", { relation: "price_amount" });
    const genericUpgrade = getV4SystemicCorpus().find((policy) => policy.id === "claim_76379365f9be1cfd");
    expect(genericUpgrade).toBeDefined();
    expect(v4SystemicNeedPolicyRelationErrors(priceNeed, genericUpgrade!)).toContain(
      "the evidence does not establish the requested price_amount relationship",
    );
  });

  it("does not substitute a generic no-show rule for a Zoom-difficulty scenario", () => {
    const zoomDifficultyNeed = need("The applicant is using Zoom for the first time and is having difficulty joining. How should I help?", {
      relation: "procedure",
    });
    const genericNoShow = getV4SystemicCorpus().find((policy) => policy.id === "v3src_no_show_attempts_and_late_join");
    const exactScenario = getV4SystemicCorpus().find((policy) => policy.id === "operational_9018f1f66efea283");
    const curatedInstruction = getV4SystemicCorpus().find((policy) => policy.id === "curated_57cb23fd1f148047");
    expect(genericNoShow).toBeDefined();
    expect(exactScenario).toBeDefined();
    expect(curatedInstruction).toBeDefined();
    expect(v4SystemicNeedPolicyRelationErrors(zoomDifficultyNeed, genericNoShow!)).toContain(
      "the requested Zoom-difficulty scenario is not established by the evidence",
    );
    expect(v4SystemicNeedPolicyRelationErrors(zoomDifficultyNeed, exactScenario!)).not.toContain(
      "the requested Zoom-difficulty scenario is not established by the evidence",
    );
    expect(v4SystemicNeedPolicyRelationErrors(zoomDifficultyNeed, curatedInstruction!)).toEqual([]);
    const question = zoomDifficultyNeed.text;
    const retrieval = retrieveV4SystemicPolicies(resolveV4SystemicTurn(question, []), {
      needs: [zoomDifficultyNeed],
      conversationIntent: "answer",
      reasoningSummary: "zoom assistance test",
    });
    expect(retrieval.candidates.map((candidate) => candidate.policy.id)).toContain(curatedInstruction!.id);
  });

  it("preserves independent clauses and separates policy questions from live actions", () => {
    expect(v4SystemicMaterialQuestionClauses(
      "Can they reapply, and how long must they wait, and what should the rep tell them?",
    )).toHaveLength(3);
    expect(v4SystemicMaterialQuestionClauses(
      "Can I email the contract link if the client wants to review it and is paying by wire?",
    )).toEqual([
      "Can I email the contract link if the client wants to review it and is paying by wire?",
    ]);
    expect(v4SystemicMaterialQuestionClauses(
      "If the client asks for the contract and is paying by wire, can I email it, and should I screen-share it first?",
    )).toHaveLength(2);
    expect(inferV4SystemicRequestKind("Can reps offer a custom payment plan?")).toBe("knowledge");
    expect(inferV4SystemicRequestKind("Confirm whether this ACH cleared")).toBe("current_lookup");
    expect(inferV4SystemicRequestKind("How do I verify that a contract was signed?")).toBe("knowledge");
    expect(inferV4SystemicRequestKind("I need the current green light letter")).toBe("artifact_request");
    expect(inferV4SystemicRelation("I need the current green light letter")).toBe("artifact_identity");
    expect(inferV4SystemicRelation("Which contract applies to a $3K first payment and $17K remaining balance?")).toBe("payment_option");
    expect(inferV4SystemicRelation("What is the correct outbound booking process if the lead is available next week?")).toBe("procedure");
    expect(inferV4SystemicRelation("Should event access details be explained during Call 2 or during onboarding?")).toBe("procedure");
    expect(inferV4SystemicRelation("Does the greenlight call need to include the walkthrough?")).toBe("requirement");
    expect(inferV4SystemicRelation("Can this applicant qualify for the show?")).toBe("eligibility");
    const eventAccess = getV4SystemicCorpus().find((policy) => policy.id === "operational_285778124bfd39c6")!;
    expect(v4SystemicNeedPolicyRelationErrors(
      need("Should event access details be explained during Call 2 or during onboarding?", { relation: "procedure" }),
      eventAccess,
    )).toEqual([]);
  });

  it("removes planner-created background fragments and anaphoric restatements without dropping independent outputs", () => {
    const contractQuestion = "Can I send this contract link in an email if the client wants to look over it and is sending the payment over a wire?";
    const contractPlan: V4SystemicQueryPlan = {
      needs: [
        need("Can I send this contract link in an email?"),
        need("if the client wants to look over it"),
        need("and is sending the payment over a wire"),
      ],
      conversationIntent: "answer",
      reasoningSummary: "planner output",
    };
    const contractGuarded = applyV4SystemicDeterministicQueryGuards(
      contractPlan,
      resolveV4SystemicTurn(contractQuestion, []),
    );
    expect(contractGuarded.needs.map((item) => ({ text: item.text, relation: item.relation }))).toEqual([
      { text: "Can I send this contract link in an email?", relation: "permission" },
    ]);

    const consequenceQuestion = "What happens if a prospect without a strong story is approved and pays? Do they get denied on the production side or how does that work?";
    const consequencePlan: V4SystemicQueryPlan = {
      needs: [
        need("Determine the consequence when a prospect without a strong story is approved and pays", { relation: "consequence" }),
        need("Do they get denied on the production side or how does that work?", { relation: "procedure" }),
      ],
      conversationIntent: "answer",
      reasoningSummary: "planner output",
    };
    expect(applyV4SystemicDeterministicQueryGuards(
      consequencePlan,
      resolveV4SystemicTurn(consequenceQuestion, []),
    ).needs).toHaveLength(1);
    expect(applyV4SystemicDeterministicQueryGuards({
      ...consequencePlan,
      needs: [
        consequencePlan.needs[0],
        need("Do they get denied on the production side?", { relation: "status" }),
      ],
    }, resolveV4SystemicTurn(consequenceQuestion, [])).needs).toHaveLength(1);
    expect(applyV4SystemicDeterministicQueryGuards({
      ...consequencePlan,
      needs: [
        need("Determine if a prospect without a strong story who is approved and pays can be denied on the production side.", {
          relation: "eligibility",
        }),
        need("Determine the process or mechanism by which a denial on the production side occurs after approval and payment.", {
          relation: "procedure",
        }),
      ],
    }, resolveV4SystemicTurn(consequenceQuestion, [])).needs).toHaveLength(1);

    const reapplyQuestion = "Can they reapply, and how long must they wait, and what should the rep tell them?";
    const reapplyGuarded = applyV4SystemicDeterministicQueryGuards({
      needs: [need("Can they reapply?")],
      conversationIntent: "answer",
      reasoningSummary: "planner output",
    }, resolveV4SystemicTurn(reapplyQuestion, []));
    expect(reapplyGuarded.needs).toHaveLength(3);

    const alternativeQuestion = "If a prospect is budget-sensitive, may I start with Lite, or must I present the higher package first?";
    const alternativeGuarded = applyV4SystemicDeterministicQueryGuards({
      needs: [
        need("May I start with Lite for a budget-sensitive prospect?", { relation: "permission" }),
        need("Must I present the higher package first?", { relation: "requirement" }),
      ],
      conversationIntent: "answer",
      reasoningSummary: "planner output",
    }, resolveV4SystemicTurn(alternativeQuestion, []));
    expect(alternativeGuarded.needs).toHaveLength(1);
    expect(alternativeGuarded.needs[0]).toMatchObject({
      text: alternativeQuestion,
      relation: "requirement",
      requestKind: "knowledge",
    });

    const attachmentQuestion = "A prospect asked about our internal statistics. Can I send a screenshot, or should I only reference the information in a message?";
    const attachmentGuarded = applyV4SystemicDeterministicQueryGuards({
      needs: [need(attachmentQuestion, {
        domains: ["internal statistics"],
        actions: ["send", "reference"],
        entities: ["screenshot", "message"],
        relation: "permission",
      })],
      conversationIntent: "answer",
      reasoningSummary: "planner output",
    }, resolveV4SystemicTurn(attachmentQuestion, []));
    expect(attachmentGuarded.needs).toHaveLength(2);
    expect(attachmentGuarded.needs.map((item) => item.text)).toEqual([
      "Can I send a screenshot?",
      "should I only reference the information in a message?",
    ]);
    expect(attachmentGuarded.reasoningSummary).toMatch(/attachment sharing from reference-only wording/i);

    const repeatBookingQuestion = "Can I cancel an audition for someone I recently disqualified who keeps applying again, and how should I stop repeat bookings?";
    const repeatBookingGuarded = applyV4SystemicDeterministicQueryGuards({
      needs: [
        need("Can the rep cancel an audition for a previously disqualified person who reapplies?", { relation: "permission" }),
        need("What is the procedure to stop repeat bookings from a disqualified person?", { relation: "procedure" }),
      ],
      conversationIntent: "answer",
      reasoningSummary: "planner output",
    }, resolveV4SystemicTurn(repeatBookingQuestion, []));
    expect(repeatBookingGuarded.needs).toHaveLength(2);
    expect(repeatBookingGuarded.needs[0]).toMatchObject({ relation: "permission" });
    expect(repeatBookingGuarded.needs[1].originalRequestText).toBe(repeatBookingQuestion);
    expect(matchingV4SystemicAuthorityResolutions(repeatBookingGuarded.needs[0]).map((resolution) => resolution.id)).toContain(
      "repeated-disqualified-applicant-cancel-block",
    );
    expect(v4SystemicNeedPolicyRelationErrors(
      repeatBookingGuarded.needs[1],
      getV4SystemicCorpus().find((policy) => policy.id === "curated_6385430e3a079b63")!,
    )).toEqual([]);
    expect(v4SystemicResolutionPolicyDisposition(repeatBookingGuarded.needs[0], "owner-main-istv-cross-show-reapply-wait")).toBe("excluded");

    const insistingTurn = resolveV4SystemicTurn("What if the client keeps insisting?", [
      { role: "user", content: "Can reps create a custom payment plan for a client?" },
      { role: "assistant", content: "No. Only approved listed plans may be used." },
    ]);
    const insistingGuarded = applyV4SystemicDeterministicQueryGuards({
      needs: [need("What is the escalation or exception process for a custom payment plan?", {
        retrievalQueries: ["custom payment plan escalation"],
        actions: ["escalate", "handle exception"],
        relation: "exception",
      })],
      conversationIntent: "answer",
      reasoningSummary: "planner output",
    }, insistingTurn);
    expect(insistingGuarded.needs).toHaveLength(1);
    expect(insistingGuarded.needs[0].text).toContain("Can reps create a custom payment plan");
    expect(insistingGuarded.needs[0].text).toContain("keeps insisting");
    expect(insistingGuarded.needs[0].text).not.toMatch(/escalat|exception process/i);
    expect(insistingGuarded.needs[0]).toMatchObject({ relation: "payment_option", requestKind: "knowledge" });

    const paymentQuestion = "My lead wants the $20K license but wants to make a $3K first payment now and pay the remaining $17K in three weeks. Which contract should they sign?";
    const paymentGuarded = applyV4SystemicDeterministicQueryGuards({
      needs: [need("Determine which contract template the lead should sign.", {
        relation: "artifact_identity",
        requestKind: "artifact_request",
      })],
      conversationIntent: "answer",
      reasoningSummary: "planner output",
    }, resolveV4SystemicTurn(paymentQuestion, []));
    expect(paymentGuarded.needs).toHaveLength(1);
    expect(paymentGuarded.needs[0]).toMatchObject({
      relation: "payment_option",
      requestKind: "knowledge",
    });
    expect(paymentGuarded.needs[0].retrievalQueries).toContain(paymentQuestion);
  });

  it("treats current letters as controlled artifacts even when the request says need rather than send", () => {
    const question = "I need the current green light letter";
    const guarded = applyV4SystemicDeterministicQueryGuards({
      needs: [need(question)],
      conversationIntent: "answer",
      reasoningSummary: "planner output",
    }, resolveV4SystemicTurn(question, []));
    expect(guarded.needs[0].domains).toContain("controlled artifact");
    expect(v4SystemicNeedRequiresCurrentArtifact(guarded.needs[0])).toBe(true);
  });

  it("uses non-answerable but reviewed same-claim cards to detect a conflict without allowing them as preferred evidence", () => {
    const question = "Can reps promise the pilot episode release date?";
    const plannedNeed = need(question, { relation: "permission" });
    const plan: V4SystemicQueryPlan = {
      needs: [plannedNeed],
      conversationIntent: "answer",
      reasoningSummary: "conflict review test",
    };
    const base = getV4SystemicCorpus().find((policy) =>
      policy.answerability === "answer_evidence" &&
      policy.systemic.temporalRisk === "stable" &&
      !policy.systemic.ownerReviewRequired,
    )!;
    const current: V4SystemicPolicy = {
      ...base,
      id: "synthetic-current-release-permission",
      decision_key: "synthetic-current-release-permission",
      title: "Pilot release-date promise is allowed",
      question_families: [question],
      decision: "Reps may promise the pilot episode release date.",
      product_scopes: ["unknown"],
      domains: ["release timing"],
      actions: ["promise release date"],
      entities: ["pilot episode"],
      answerability: "answer_evidence" as const,
      systemic: { ...base.systemic, temporalRisk: "stable" as const, ownerReviewRequired: false },
    };
    const reviewedConflict: V4SystemicPolicy = {
      ...current,
      id: "synthetic-reviewed-release-conflict",
      decision_key: "synthetic-reviewed-release-conflict",
      title: "Pilot release-date promise is not allowed",
      decision: "Reps may not promise the pilot episode release date.",
      answerability: "route_or_support" as const,
      systemic: { ...current.systemic, temporalRisk: "time_sensitive" as const },
    };
    const candidate = (policy: V4SystemicPolicy, rank: number): V4SystemicCandidate => ({
      policy,
      rank,
      score: 20 - rank,
      matchedQueries: [question],
      matchedTerms: ["promise", "pilot", "release"],
      lexicalScore: 5,
      familyScore: 5,
      characterScore: 1,
      structuredScore: 3,
      authorityScore: 2,
      relationScore: 8,
    });
    const retrieval: V4SystemicRetrieval = {
      query: question,
      turn: resolveV4SystemicTurn(question, []),
      corpusSize: 2,
      candidates: [candidate(current, 1), candidate(reviewedConflict, 2)],
      blockedTopicIds: [],
      blockedMatches: [],
      stageTimings: {},
    };
    const sourcePlan = parseV4SystemicSourcePlan(JSON.stringify({
      needs: [{
        need_id: "N1",
        direct_refs: [current.id],
        preferred_refs: [current.id],
        conflicts: [{ positions: [
          { refs: [current.id], position: "promise allowed" },
          { refs: [reviewedConflict.id], position: "promise prohibited" },
        ] }],
        disposition: "answer",
      }],
    }), plan, retrieval);
    expect(sourcePlan.needs[0]).toMatchObject({ lane: "route", preferredPolicyIds: [] });
    expect(sourcePlan.needs[0].excludedConflictPolicyIds).toEqual(expect.arrayContaining([
      current.id,
      reviewedConflict.id,
    ]));
  });

  it("does not manufacture a policy conflict from pure owner or channel navigation", () => {
    const question = "Can I send an internal statistics screenshot to a prospect?";
    const plannedNeed = need(question, {
      relation: "permission",
      domains: ["internal statistics"],
      actions: ["send screenshot"],
      entities: ["prospect", "screenshot"],
    });
    const plan: V4SystemicQueryPlan = {
      needs: [plannedNeed],
      conversationIntent: "answer",
      reasoningSummary: "route-only conflict regression",
    };
    const retrieval = retrieveV4SystemicPolicies(resolveV4SystemicTurn(question, []), plan);
    expect(retrieval.candidates.map((candidate) => candidate.policy.id)).toEqual(expect.arrayContaining([
      "operational_eef854a24abf5bd5",
      "claim_9a12d8eaefcf143a__a8",
    ]));
    const sourcePlan = parseV4SystemicSourcePlan(JSON.stringify({
      needs: [{
        need_id: "N1",
        direct_refs: ["operational_eef854a24abf5bd5"],
        preferred_refs: ["operational_eef854a24abf5bd5"],
        conflicts: [{ positions: [
          { refs: ["operational_eef854a24abf5bd5"], position: "do not share internal statistics" },
          { refs: ["claim_9a12d8eaefcf143a__a8"], position: "route to the approved proof owner" },
        ] }],
        disposition: "route",
      }],
    }), plan, retrieval);
    expect(sourcePlan.needs[0].lane).toBe("answer");
    expect(sourcePlan.needs[0].preferredPolicyIds.length).toBeGreaterThan(0);
    expect(sourcePlan.needs[0].preferredPolicyIds.every((id) =>
      retrieval.candidates.find((candidate) => candidate.policy.id === id)?.policy.answerability === "answer_evidence",
    )).toBe(true);
    expect(sourcePlan.needs[0].excludedConflictPolicyIds).not.toContain("claim_9a12d8eaefcf143a__a8");
  });

  it("promotes one uniquely dominant exact source when the model routes or prefers broad topic cards", () => {
    const calendarQuestion = "If my public calendar only allows bookings within two days but an outbound lead is available next week, what is the correct booking process?";
    const calendarNeed = need(calendarQuestion, { relation: "procedure" });
    const calendarPlan: V4SystemicQueryPlan = {
      needs: [calendarNeed],
      conversationIntent: "answer",
      reasoningSummary: "exact-source route regression",
    };
    const calendarRetrieval = retrieveV4SystemicPolicies(resolveV4SystemicTurn(calendarQuestion, []), calendarPlan);
    expect(matchingV4SystemicAuthorityResolutions(calendarNeed).map((resolution) => resolution.id)).toContain(
      "oncehub-public-window-google-calendar-fallback",
    );
    const calendarSourcePlan = parseV4SystemicSourcePlan(JSON.stringify({
      needs: [{
        need_id: "N1",
        direct_refs: ["claim_d9e7c2f5a04fc7ae", "operational_448f8c2704df8e55"],
        preferred_refs: ["claim_d9e7c2f5a04fc7ae", "operational_448f8c2704df8e55"],
        conflicts: [],
        disposition: "answer",
      }],
    }), calendarPlan, calendarRetrieval);
    expect(calendarSourcePlan.needs[0]).toMatchObject({
      lane: "answer",
      preferredPolicyIds: expect.arrayContaining([
        "claim_d93982445e426907",
        "claim_5af708598311071c",
      ]),
    });
    expect(calendarSourcePlan.needs[0].directPolicyIds).not.toEqual(expect.arrayContaining([
      "claim_d9e7c2f5a04fc7ae",
      "operational_448f8c2704df8e55",
    ]));
    expect(calendarSourcePlan.needs[0].reason).toMatch(/claim-scoped authority resolution/i);
    const masterCalendarPolicy = getV4SystemicCorpus().find((policy) => policy.id === "claim_5af708598311071c");
    expect(masterCalendarPolicy).toBeDefined();
    expect(v4SystemicExactControllingEvidenceSupports(
      calendarNeed,
      "Scheduling second calls and reschedules is up to the rep through public or personal calendar hours, but do not overlap or touch the master calendar.",
      masterCalendarPolicy!,
    )).toBe(true);
    expect(v4SystemicExactDirectFallbackSentence(
      calendarNeed,
      calendarPlan,
      calendarRetrieval,
      ["claim_d93982445e426907"],
    )).toMatchObject({
      text: "Use Google Calendar when OnceHub cannot provide the needed outbound-call time.",
      policyId: "claim_d93982445e426907",
    });

    const podcastQuestion = "How is the podcast episode structure intelligently designed?";
    const podcastNeed = need(podcastQuestion, {
      relation: "definition",
      domains: ["podcast"],
      actions: ["design"],
      entities: ["podcast episode structure"],
    });
    const podcastPlan: V4SystemicQueryPlan = {
      needs: [podcastNeed],
      conversationIntent: "answer",
      reasoningSummary: "same-artifact fallback regression",
    };
    const podcastRetrieval = retrieveV4SystemicPolicies(resolveV4SystemicTurn(podcastQuestion, []), podcastPlan);
    const podcastFallback = v4SystemicExactDirectFallbackSentence(
      podcastNeed,
      podcastPlan,
      podcastRetrieval,
      ["owner-podcast-purpose-and-current-format"],
      ["documentary-only style evidence cannot define the podcast structure"],
    );
    expect(podcastFallback?.text).toMatch(/podcast is designed around exposure, authority, credibility/i);
    expect(podcastFallback?.text).not.toMatch(/documentary|Hollywood/i);

    const eventQuestion = "Should details about event access be explained during Call 2 or during onboarding after the sale?";
    const eventNeed = need(eventQuestion, { relation: "procedure" });
    const eventPlan: V4SystemicQueryPlan = {
      needs: [eventNeed],
      conversationIntent: "answer",
      reasoningSummary: "broad-preference regression",
    };
    const eventRetrieval = retrieveV4SystemicPolicies(resolveV4SystemicTurn(eventQuestion, []), eventPlan);
    const eventSourcePlan = parseV4SystemicSourcePlan(JSON.stringify({
      needs: [{
        need_id: "N1",
        direct_refs: ["claim_01062dc691d79f7f__a3", "operational_769b14594944011a"],
        preferred_refs: ["claim_01062dc691d79f7f__a3", "operational_769b14594944011a"],
        conflicts: [],
        disposition: "answer",
      }],
    }), eventPlan, eventRetrieval);
    expect(eventSourcePlan.needs[0]).toMatchObject({
      lane: "answer",
      preferredPolicyIds: ["operational_285778124bfd39c6"],
    });
  });

  it("lets one directly matching owner-approved override retire an opposing lower-authority position", () => {
    const question = "If a prospect is early-stage and budget-sensitive, may I start with Lite, or must I present the higher package first?";
    const plannedNeed = need(question, { relation: "requirement" });
    const plan: V4SystemicQueryPlan = {
      needs: [plannedNeed],
      conversationIntent: "answer",
      reasoningSummary: "owner override test",
    };
    const owner = getV4SystemicCorpus().find((policy) => policy.id === "owner-package-presentation-high-to-low")!;
    const lower: V4SystemicPolicy = {
      ...owner,
      id: "synthetic-lower-lite-first-requirement",
      decision_key: "synthetic-lower-lite-first-requirement",
      policy_key: "synthetic-lower-lite-first-requirement",
      title: "Start with Lite first",
      question_families: [question],
      decision: "Reps must start with Lite first for a budget-sensitive prospect.",
      source: { kind: "authoritative_slack_operational_qna", article_id: null, ids: ["test:lower"], approved_by: ["Test"] },
      systemic: { ...owner.systemic, sourceClass: "authoritative_operational_qna" },
    };
    const candidate = (policy: V4SystemicPolicy, rank: number): V4SystemicCandidate => ({
      policy,
      rank,
      score: 20 - rank,
      matchedQueries: [question],
      matchedTerms: ["lite", "budget", "package"],
      lexicalScore: 5,
      familyScore: 10,
      characterScore: 1,
      structuredScore: 3,
      authorityScore: 2,
      relationScore: 8,
    });
    const retrieval: V4SystemicRetrieval = {
      query: question,
      turn: resolveV4SystemicTurn(question, []),
      corpusSize: 2,
      candidates: [candidate(owner, 1), candidate(lower, 2)],
      blockedTopicIds: [],
      blockedMatches: [],
      stageTimings: {},
    };
    const sourcePlan = parseV4SystemicSourcePlan(JSON.stringify({
      needs: [{
        need_id: "N1",
        direct_refs: [owner.id, lower.id],
        preferred_refs: [lower.id],
        conflicts: [{ positions: [
          { refs: [owner.id], position: "present high to low" },
          { refs: [lower.id], position: "start with Lite" },
        ] }],
        disposition: "route",
      }],
    }), plan, retrieval);
    expect(sourcePlan.needs[0]).toMatchObject({
      lane: "answer",
      preferredPolicyIds: ["owner-package-presentation-high-to-low"],
    });
    expect(sourcePlan.needs[0].excludedConflictPolicyIds).toContain(lower.id);
  });

  it("fails closed when different directly matching owner overrides occupy opposing positions", () => {
    const question = "May reps promise the pilot release date?";
    const plannedNeed = need(question, { relation: "permission" });
    const plan: V4SystemicQueryPlan = {
      needs: [plannedNeed],
      conversationIntent: "answer",
      reasoningSummary: "multiple owner override test",
    };
    const base = getV4SystemicCorpus().find((policy) =>
      policy.answerability === "answer_evidence" && policy.systemic.temporalRisk === "stable",
    )!;
    const makeOwner = (id: string, decision: string): V4SystemicPolicy => ({
      ...base,
      id,
      decision_key: id,
      policy_key: id,
      title: "Pilot release-date promise",
      question_families: [question, "Pilot release date promise"],
      decision,
      product_scopes: ["unknown"],
      answerability: "answer_evidence",
      source: { kind: "owner_approved_override", article_id: null, ids: [`test:${id}`], approved_by: ["Rich Allen"] },
      systemic: { ...base.systemic, temporalRisk: "stable", ownerReviewRequired: false },
    });
    const allowed = makeOwner("synthetic-owner-pilot-allowed", "Reps may promise the pilot release date.");
    const prohibited = makeOwner("synthetic-owner-pilot-prohibited", "Reps may not promise the pilot release date.");
    const candidate = (policy: V4SystemicPolicy, rank: number): V4SystemicCandidate => ({
      policy,
      rank,
      score: 20 - rank,
      matchedQueries: [question],
      matchedTerms: ["pilot", "release", "date"],
      lexicalScore: 5,
      familyScore: 10,
      characterScore: 1,
      structuredScore: 3,
      authorityScore: 2,
      relationScore: 8,
    });
    const retrieval: V4SystemicRetrieval = {
      query: question,
      turn: resolveV4SystemicTurn(question, []),
      corpusSize: 2,
      candidates: [candidate(allowed, 1), candidate(prohibited, 2)],
      blockedTopicIds: [],
      blockedMatches: [],
      stageTimings: {},
    };
    const sourcePlan = parseV4SystemicSourcePlan(JSON.stringify({
      needs: [{
        need_id: "N1",
        direct_refs: [allowed.id, prohibited.id],
        preferred_refs: [allowed.id],
        conflicts: [{ positions: [
          { refs: [allowed.id], position: "allowed" },
          { refs: [prohibited.id], position: "prohibited" },
        ] }],
        disposition: "answer",
      }],
    }), plan, retrieval);
    expect(sourcePlan.needs[0]).toMatchObject({ lane: "route", preferredPolicyIds: [] });
  });

  it("fails closed on a directly matching unresolved criminal-history conflict", () => {
    const question = "Can a well-qualified applicant with a non-violent criminal history from 10 years ago be approved?";
    const turn = resolveV4SystemicTurn(question, []);
    const plannedNeed = need(question, {
      domains: ["qualification"],
      actions: ["qualify"],
      entities: ["criminal history"],
    });
    const plan: V4SystemicQueryPlan = {
      needs: [plannedNeed],
      conversationIntent: "answer",
      reasoningSummary: "test",
    };
    const retrieval = retrieveV4SystemicPolicies(turn, plan);
    expect(retrieval.blockedMatches.map((match) => match.topicId)).toContain("blocked_40de2be4a3e0795e");
    const sourcePlan = parseV4SystemicSourcePlan(JSON.stringify({
      needs: [{ need_id: "N1", direct_refs: ["C1"], preferred_refs: ["C1"], conflicts: [], disposition: "answer" }],
    }), plan, retrieval);
    expect(sourcePlan.needs[0]).toMatchObject({ lane: "route", preferredPolicyIds: [] });
    expect(sourcePlan.needs[0].reason).toMatch(/conflict remains unresolved/i);
  });

  it("does not apply a broad open-conflict card from two generic topic words", () => {
    const question = "Can this applicant qualify?";
    const turn = resolveV4SystemicTurn(question, []);
    const plannedNeed = need(question, {
      domains: ["qualification"],
      actions: ["qualify"],
      entities: ["applicant"],
    });
    const retrieval = retrieveV4SystemicPolicies(turn, {
      needs: [plannedNeed],
      conversationIntent: "answer",
      reasoningSummary: "negative broad-conflict test",
    });
    expect(retrieval.blockedMatches.map((match) => match.topicId)).not.toContain("blocked_65d2e70d14703b7e");
  });

  it("requires an open conflict's distinctive question signature", () => {
    const earlyStageQuestion = "The lead has a website and social media but is still early-stage. Should I conduct Call 1?";
    const earlyStageNeed = need(earlyStageQuestion, {
      relation: "permission",
      domains: ["qualification"],
      actions: ["conduct call"],
      entities: ["lead", "website", "social media"],
    });
    const earlyStageRetrieval = retrieveV4SystemicPolicies(resolveV4SystemicTurn(earlyStageQuestion, []), {
      needs: [earlyStageNeed],
      conversationIntent: "answer",
      reasoningSummary: "media-pack false-positive regression",
    });
    expect(earlyStageRetrieval.blockedMatches.map((match) => match.topicId)).not.toContain("blocked_c709bc9eb8678e91");

    const achQuestion = "The client signed the contract and is paying by ACH. Can onboarding proceed?";
    const achNeed = need(achQuestion, {
      relation: "permission",
      domains: ["payments", "onboarding"],
      actions: ["sign", "onboard"],
      entities: ["ACH payment", "signed contract"],
    });
    const achRetrieval = retrieveV4SystemicPolicies(resolveV4SystemicTurn(achQuestion, []), {
      needs: [achNeed],
      conversationIntent: "answer",
      reasoningSummary: "mastermind false-positive regression",
    });
    expect(achRetrieval.blockedMatches.map((match) => match.topicId)).not.toContain("blocked_8c5012cfa1551073");
  });

  it("does not attach an unrelated open conflict to a custom payment permission question", () => {
    const question = "Can I make up a custom payment split if the client asks for one?";
    const turn = resolveV4SystemicTurn(question, []);
    const plannedNeed = need("Determine if a representative is permitted to create a custom payment split upon client request.", {
      retrievalQueries: [question, "Is creating a custom payment split allowed?"],
      domains: ["payment"],
      actions: ["create"],
      entities: ["custom payment split"],
      relation: "permission",
      requestKind: "knowledge",
    });
    const retrieval = retrieveV4SystemicPolicies(turn, {
      needs: [plannedNeed],
      conversationIntent: "answer",
      reasoningSummary: "negative cross-topic conflict test",
    });
    expect(retrieval.blockedMatches.map((match) => match.topicId)).not.toContain("blocked_0b56158b1d22eb99");
    expect(matchingV4SystemicAuthorityResolutions(plannedNeed).map((resolution) => resolution.id)).toContain(
      "custom-payment-plan-boundary",
    );
  });

  it("never uses stable policy evidence as proof of a live payment status", () => {
    const question = "Can you confirm whether this client's ACH payment cleared?";
    const plannedNeed = need("Confirm whether the client's ACH payment cleared.", {
      domains: ["payments"],
      actions: ["confirm"],
      entities: ["ACH payment"],
      relation: "status",
      requestKind: "current_lookup",
    });
    const turn = resolveV4SystemicTurn(question, []);
    const plan: V4SystemicQueryPlan = {
      needs: [plannedNeed],
      conversationIntent: "answer",
      reasoningSummary: "current lookup boundary test",
    };
    const retrieval = retrieveV4SystemicPolicies(turn, plan);
    const sourcePlan = parseV4SystemicSourcePlan(JSON.stringify({
      needs: [{ need_id: "N1", direct_refs: ["C1"], preferred_refs: ["C1"], conflicts: [], disposition: "answer" }],
    }), plan, retrieval);
    expect(sourcePlan.needs[0]).toMatchObject({ lane: "route", preferredPolicyIds: [] });
    expect(sourcePlan.needs[0].reason).toMatch(/live owner lookup/i);
  });

  it("recognizes every canonical open-conflict question without broad topic-only matching", () => {
    for (const topic of getV4SystemicBlockedTopics()) {
      if (!topic?.question_families?.[0]) continue;
      const question = topic.question_families[0];
      const turn = resolveV4SystemicTurn(question, []);
      const firstProductScope = topic.product_scopes?.[0];
      const productScope = firstProductScope === "main_istv" || firstProductScope === "dj_nlceo"
        ? firstProductScope
        : "unknown";
      const plannedNeed = need(question, {
        productScope,
        retrievalQueries: topic.question_families,
        domains: topic.domains,
        actions: topic.actions,
        entities: topic.entities,
      });
      const retrieval = retrieveV4SystemicPolicies(turn, {
        needs: [plannedNeed],
        conversationIntent: "answer",
        reasoningSummary: "canonical open-conflict coverage",
      });
      expect(retrieval.blockedMatches.map((match) => match.topicId), topic.id).toContain(topic.id);
    }
  }, 30_000);
});

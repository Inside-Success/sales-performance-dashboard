import { describe, expect, it } from "vitest";

import type { V3Provider } from "@/lib/ask-sales-faq/v3/types";
import { getV4SystemicCorpus } from "@/lib/ask-sales-faq/v4/systemic/corpus";
import {
  applyV4SystemicDeterministicQueryGuards,
  evaluateV4SystemicChampionSafety,
  runAskSalesFaqV4Systemic,
  selectV4SystemicChampion,
  v4SystemicGenericRouteKey,
  v4SystemicNeedRelationErrors,
  v4SystemicNeedRequiresCurrentArtifact,
  v4SystemicPolicyBoundaryErrors,
} from "@/lib/ask-sales-faq/v4/systemic/runtime";
import type { V4SystemicNeedDecision, V4SystemicQueryPlan, V4SystemicRetrieval } from "@/lib/ask-sales-faq/v4/systemic/types";
import { resolveV4SystemicTurn } from "@/lib/ask-sales-faq/v4/systemic/turn";
import type { AskSalesFaqV4Result } from "@/lib/ask-sales-faq/v4/types";

const operationalPolicy = getV4SystemicCorpus().find((policy) =>
  policy.id.startsWith("operational_") &&
  policy.systemic.sourceClass === "authoritative_operational_qna" &&
  policy.source.kind === "authoritative_slack_operational_qna" &&
  policy.answerability === "answer_evidence" &&
  policy.question_families[0],
);
const generalUnscopedOperationalPolicy = getV4SystemicCorpus().find((policy) =>
  policy.systemic.sourceClass === "authoritative_operational_qna" &&
  policy.systemic.scopeRisk === "general" &&
  policy.product_scopes.includes("unknown") &&
  policy.answerability === "answer_evidence" &&
  policy.question_families[0],
);
const curatedAuthorityPolicy = getV4SystemicCorpus().find((policy) =>
  policy.id === "curated_9848cdfb2da72c0a",
);
const completeAuthorityPolicy = getV4SystemicCorpus().find((policy) =>
  policy.id === "curated_v43_phone_onboarding_zoom_recording",
);

function providerFor(handler: (input: { purpose: string; payload: Record<string, unknown> }) => Record<string, unknown>): V3Provider {
  return async <T>(input: Parameters<V3Provider>[0]) => {
    const payload = JSON.parse(input.user) as Record<string, unknown>;
    const raw = handler({ purpose: input.purpose, payload });
    return {
      output: input.parse(JSON.stringify(raw)),
      provider: "deepseek",
      model: "v4-systemic-test-model",
      attempts: [{ provider: "deepseek", model: "v4-systemic-test-model", purpose: input.purpose, status: "success", latencyMs: 1 }],
    } as Awaited<ReturnType<V3Provider>> & { output: T };
  };
}

function operationalAnswerProvider(
  compound = false,
  policy = operationalPolicy!,
  productScope = policy.product_scopes[0] || "unknown",
  validationStatus: "supported" | "unsupported" = "supported",
  validatorOverclaimsAllNeeds = false,
  falseAbstainOnFirstDraft = false,
  validatorReturnsNoAnsweredNeeds = false,
  emptyAnswerSentences = false,
  draftSentenceOverride = "",
) {
  let ref = "";
  return providerFor(({ purpose, payload }) => {
    if (purpose === "v4_systemic_query_plan") {
      return {
        needs: [
          {
            text: policy.question_families[0],
            retrieval_queries: policy.question_families,
            product_scope: productScope,
            domains: policy.domains,
            actions: policy.actions,
            entities: policy.entities,
            ambiguity: "none",
            clarification_question: "",
          },
          ...(compound ? [{
            text: "Where is the exact current controlled link?",
            retrieval_queries: ["current controlled link"],
            product_scope: "unknown",
            domains: ["artifact"],
            actions: ["locate"],
            entities: ["link"],
            ambiguity: "none",
            clarification_question: "",
          }] : []),
        ],
        reasoning_summary: "Atomic source request.",
      };
    }
    if (purpose === "v4_systemic_source_plan") {
      const cards = payload.candidateCards as Array<{ ref: string; id: string }>;
      const card = cards.find((candidate) => candidate.id === policy.id);
      expect(card).toBeDefined();
      return {
        needs: [
          {
            need_id: "N1",
            direct_refs: [card!.ref],
            conflicts: [],
            preferred_refs: [card!.ref],
            disposition: "answer",
            reason: "One direct, eligible source applies.",
          },
          ...(compound ? [{
            need_id: "N2",
            direct_refs: [],
            conflicts: [],
            preferred_refs: [],
            disposition: "route",
            reason: "No stable source contains the current artifact.",
          }] : []),
        ],
        reasoning_summary: "Selected the direct source after timeline review.",
      };
    }
    if (purpose === "v4_systemic_evidence_answer" || purpose === "v4_systemic_evidence_answer_retry") {
      const cards = payload.candidateCards as Array<{
        ref: string;
        id: string;
        decision: string;
        authority_class: string;
        product_applicability: string;
        source_effective_at: string;
        authority?: number;
      }>;
      const card = cards.find((candidate) => candidate.id === policy.id);
      expect(card).toBeDefined();
      expect(card).not.toHaveProperty("authority");
      expect(card).toMatchObject({
        authority_class: policy.systemic.sourceClass === "authoritative_operational_qna"
          ? "direct_company_authority"
          : "governed_approved",
      });
      expect(["all_products_unless_stated", "explicit_product_scopes"]).toContain(card!.product_applicability);
      expect(card!.source_effective_at).toBeTruthy();
      ref = card!.ref;
      if (falseAbstainOnFirstDraft && purpose === "v4_systemic_evidence_answer") return {
        needs: [
          {
            need_id: "N1",
            lane: "route",
            evidence_refs: [],
            answer_sentences: [],
            route_key: "sales_policy",
            clarification_question: "",
            confidence: 0.4,
            reason: "Incorrectly abstained despite a sourcePlan answer.",
          },
        ],
        natural_answer: "",
        reasoning_summary: "Initial false abstention.",
      };
      return {
        needs: [
          {
            need_id: "N1",
            lane: "answer",
            evidence_refs: [ref],
            answer_sentences: emptyAnswerSentences ? [] : [{ text: draftSentenceOverride || card!.decision, evidence_refs: [ref] }],
            route_key: null,
            clarification_question: "",
            confidence: 0.96,
            reason: "Direct eligible source.",
          },
          ...(compound ? [{
            need_id: "N2",
            lane: "artifact",
            evidence_refs: [],
            answer_sentences: [],
            route_key: "sales_tech",
            clarification_question: "",
            confidence: 0.2,
            reason: "A current controlled artifact is not contained in stable evidence.",
          }] : []),
        ],
        natural_answer: "",
        reasoning_summary: "Selected only direct eligible evidence.",
      };
    }
    const sentences = payload.sentences as Array<{ sentence_id: string; need_id: string; evidence_refs: string[] }>;
    const allNeedIds = (payload.needs as Array<{ id: string }>).map((need) => need.id);
    return {
      checks: sentences.map((sentence) => ({
        sentence_id: sentence.sentence_id,
        status: validationStatus,
        evidence_refs: sentence.evidence_refs,
        answered_need_ids: validationStatus === "supported"
          ? validatorReturnsNoAnsweredNeeds ? [] : validatorOverclaimsAllNeeds ? allNeedIds : [sentence.need_id]
          : [],
        reason: validationStatus === "supported" ? "The sentence is exact evidence." : "The sentence was not validated.",
      })),
    };
  });
}

const unavailableProvider: V3Provider = async () => {
  throw new Error("model unavailable in test");
};

describe("Ask Sales V4 systemic runtime", () => {
  it("shortens the systemic route format on a natural rewrite follow-up", async () => {
    const unavailableProvider: V3Provider = async () => {
      throw new Error("Conversation rewrite must not call the provider");
    };
    const previous = "Check #sales-questions-requests before replying about Is the Mastermind event held only once a year. Check #sales-questions-requests before replying about Are there other in-person training and networking programs throughout the year.";
    const result = await runAskSalesFaqV4Systemic("Thanks—can you make that last answer shorter?", [
      { role: "user", content: "Is the Mastermind only once a year, and are there other in-person programs?" },
      { role: "assistant", content: previous },
    ], {
      provider: unavailableProvider,
      validatorProvider: unavailableProvider,
      skipChampionComparison: true,
    });
    expect(result.lane).toBe("conversation");
    expect(result.answer).toBe("Mastermind frequency and other in-person programs: check #sales-questions-requests.");
    expect(result.answer.length).toBeLessThan(previous.length);
  });

  it("answers from independently verified operational evidence through the generalized path", async () => {
    expect(operationalPolicy).toBeDefined();
    const result = await runAskSalesFaqV4Systemic(operationalPolicy!.question_families[0], [], {
      provider: operationalAnswerProvider(),
      skipChampionComparison: true,
    });

    expect(result.lane).toBe("answer");
    expect(result.selectedPolicyIds).toContain(operationalPolicy!.id);
    expect(result.citations).toEqual(expect.arrayContaining([
      expect.objectContaining({ policyId: operationalPolicy!.id, sourceKind: "authoritative_slack_operational_qna" }),
    ]));
    expect(result.runtimeMetadata).toMatchObject({
      pipelineVersion: "v4-systemic",
      isolation: { productionSelectorChanged: false, databaseWrites: false, historyPersistence: false },
      executionMode: { planning: "systemic_model", composition: "model", validation: "model_and_deterministic" },
    });
  });

  it("preserves every material condition from a completeness-locked authority source", async () => {
    expect(completeAuthorityPolicy).toBeDefined();
    const result = await runAskSalesFaqV4Systemic(completeAuthorityPolicy!.question_families[0], [], {
      provider: operationalAnswerProvider(
        false,
        completeAuthorityPolicy!,
        completeAuthorityPolicy!.product_scopes[0] || "unknown",
        "supported",
        false,
        false,
        false,
        false,
        "When a client has no internet, payment may be collected by phone.",
      ),
      skipChampionComparison: true,
    });

    expect(result.lane).toBe("answer");
    expect(result.answer).toMatch(/keep the interaction on Zoom video/i);
    expect(result.answer).toMatch(/Zoom records the conversation/i);
    expect(result.selectedPolicyIds).toContain(completeAuthorityPolicy!.id);
  });

  it("retries a model false abstention when the enforced source plan already resolved the need", async () => {
    const result = await runAskSalesFaqV4Systemic(operationalPolicy!.question_families[0], [], {
      provider: operationalAnswerProvider(false, operationalPolicy!, operationalPolicy!.product_scopes[0] || "unknown", "supported", false, true),
      skipChampionComparison: true,
    });

    expect(result.lane).toBe("answer");
    expect(result.selectedPolicyIds).toContain(operationalPolicy!.id);
    expect(result.runtimeMetadata.providerAttempts.map((attempt) => attempt.purpose)).toContain("v4_systemic_evidence_answer_retry");
  });

  it("answers from curated Mike and Rich evidence through the generalized path", async () => {
    expect(curatedAuthorityPolicy).toBeDefined();
    const result = await runAskSalesFaqV4Systemic(curatedAuthorityPolicy!.question_families[0], [], {
      provider: operationalAnswerProvider(false, curatedAuthorityPolicy!, "main_istv"),
      skipChampionComparison: true,
    });

    expect(result.lane).toBe("answer");
    expect(result.selectedPolicyIds).toContain(curatedAuthorityPolicy!.id);
    expect(result.citations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        policyId: curatedAuthorityPolicy!.id,
        sourceKind: "authoritative_meeting_decision",
        approvedBy: expect.arrayContaining(["Mike", "Rich"]),
      }),
    ]));
  });

  it("preserves the supported need and routes only an unresolved live artifact", async () => {
    const result = await runAskSalesFaqV4Systemic(
      `${operationalPolicy!.question_families[0]} Also, where is the exact current controlled link?`,
      [],
      { provider: operationalAnswerProvider(true), skipChampionComparison: true },
    );

    expect(result.lane).toBe("partial");
    expect(result.selectedPolicyIds).toContain(operationalPolicy!.id);
    expect(result.needsRoute).toBe(true);
    expect(result.routeChannels).toEqual(expect.arrayContaining([expect.any(String)]));
    expect(result.answer).toContain("current approved resource");
    expect(result.answer).not.toMatch(/unresolved|determine whether|before replying about/i);
    expect(result.runtimeMetadata.validation.unresolvedNeedIds).toContain("N2");
    expect(result.runtimeMetadata.validation.unresolvedNeedIds).not.toContain("N1");
  });

  it("does not let semantic validation mark a forced artifact need as answered", async () => {
    const result = await runAskSalesFaqV4Systemic(
      `${operationalPolicy!.question_families[0]} Also, where is the exact current controlled link?`,
      [],
      { provider: operationalAnswerProvider(true, operationalPolicy!, operationalPolicy!.product_scopes[0] || "unknown", "supported", true), skipChampionComparison: true },
    );

    expect(result.lane).toBe("partial");
    expect(result.runtimeMetadata.validation.unresolvedNeedIds).toContain("N2");
    expect(result.answer).toContain("current approved resource");
    expect(result.answer).not.toMatch(/unresolved|determine whether|before replying about/i);
  });

  it("allows a verified general operational rule to answer a named product without weakening scoped boundaries", async () => {
    expect(generalUnscopedOperationalPolicy).toBeDefined();
    const question = `${generalUnscopedOperationalPolicy!.question_families[0]} This is for main ISTV.`;
    const result = await runAskSalesFaqV4Systemic(question, [], {
      provider: operationalAnswerProvider(false, generalUnscopedOperationalPolicy!, "main_istv"),
      skipChampionComparison: true,
    });
    expect(result.lane).toBe("answer");
    expect(result.selectedPolicyIds).toContain(generalUnscopedOperationalPolicy!.id);
  });

  it("rejects a monetary conclusion when its explicit numeric prerequisite is absent", () => {
    const conditionalPricePolicy = getV4SystemicCorpus().find((policy) =>
      /\bif\b[^.]{0,120}\$\s*10,?000/i.test(policy.decision) &&
      /\$\s*18,?000/i.test(policy.decision),
    );
    expect(conditionalPricePolicy).toBeDefined();
    const turn = resolveV4SystemicTurn("How do I upgrade from Lite with $2.5k down to VIP?", []);
    expect(v4SystemicPolicyBoundaryErrors(conditionalPricePolicy!, turn)).toContain(
      "numeric prerequisite from the evidence is not established by the request",
    );
  });

  it("requires a quoted conditional trigger instead of treating a broader status as equivalent", () => {
    const stopPolicy = getV4SystemicCorpus().find((policy) =>
      /replied (?:with )?["'“”‘’]stop["'“”‘’]/i.test(policy.decision),
    );
    expect(stopPolicy).toBeDefined();
    expect(v4SystemicPolicyBoundaryErrors(stopPolicy!, resolveV4SystemicTurn(
      "The client opted out of texts. Can I still email them?",
      [],
    ))).toContain("literal prerequisite from the evidence is not established by the request");
    expect(v4SystemicPolicyBoundaryErrors(stopPolicy!, resolveV4SystemicTurn(
      "The client replied STOP. Can I still email them?",
      [],
    ))).not.toContain("literal prerequisite from the evidence is not established by the request");
  });

  it("preserves both prerequisites and the narrow purpose in Rich's Call 1 pricing rule", () => {
    const policy = getV4SystemicCorpus().find((item) => item.id === "curated_32981b3dcba667da");
    expect(policy).toBeDefined();
    expect(policy!.decision).toMatch(/does not have a business/i);
    expect(policy!.decision).toMatch(/not financially qualified/i);
    expect(policy!.decision).toMatch(/purpose of disqualifying/i);
    expect(policy!.decision).toMatch(/both/i);
    expect(policy!.quality_flags).toContain("all_prerequisites_required");
  });

  it("forces clarification before applying a monetary license-change rule across products", () => {
    const turn = resolveV4SystemicTurn("How do I upgrade from Lite with $2.5k down to VIP?", []);
    const plan: V4SystemicQueryPlan = {
      needs: [{
        id: "N1",
        text: "Determine the upgrade process and amount",
        retrievalQueries: ["Lite to VIP upgrade"],
        productScope: "unknown",
        domains: ["license"],
        actions: ["upgrade"],
        entities: ["Lite", "VIP"],
        relation: "procedure",
        requestKind: "knowledge",
        ambiguity: "none",
        clarificationQuestion: "",
      }],
      conversationIntent: "answer",
      reasoningSummary: "test",
    };
    const guarded = applyV4SystemicDeterministicQueryGuards(plan, turn);
    expect(guarded.needs[0]).toMatchObject({
      ambiguity: "material",
      productScope: "unknown",
      clarificationQuestion: "Is this for main ISTV or Next Level CEO, and has filming already happened?",
    });
  });

  it("does not let model-only ambiguity hide an exact named resource", () => {
    const turn = resolveV4SystemicTurn("script for Built for More", []);
    const plan: V4SystemicQueryPlan = {
      needs: [{
        id: "N1",
        text: "Retrieve the Built for More script",
        retrievalQueries: ["Built for More script"],
        productScope: "unknown",
        domains: ["script"],
        actions: ["retrieve"],
        entities: ["Built for More"],
        relation: "artifact_location",
        requestKind: "artifact_request",
        ambiguity: "material",
        clarificationQuestion: "Which campaign?",
      }],
      conversationIntent: "answer",
      reasoningSummary: "test",
    };
    expect(applyV4SystemicDeterministicQueryGuards(plan, turn).needs[0]).toMatchObject({
      ambiguity: "none",
      clarificationQuestion: "",
    });
  });

  it("keeps a short unexplained acronym behind deterministic clarification", () => {
    const turn = resolveV4SystemicTurn("what's the roe", []);
    const plan: V4SystemicQueryPlan = {
      needs: [{
        id: "N1",
        text: "Define ROE",
        retrievalQueries: ["ROE"],
        productScope: "unknown",
        domains: [],
        actions: [],
        entities: ["ROE"],
        relation: "definition",
        requestKind: "knowledge",
        ambiguity: "none",
        clarificationQuestion: "",
      }],
      conversationIntent: "answer",
      reasoningSummary: "test",
    };
    expect(applyV4SystemicDeterministicQueryGuards(plan, turn).needs[0]).toMatchObject({
      ambiguity: "material",
      clarificationQuestion: "What does ROE refer to in this sales context?",
    });
  });

  it("routes a named current artifact instead of inventing product ambiguity", () => {
    const turn = resolveV4SystemicTurn("Send me a preview video of the new studio", []);
    const plan: V4SystemicQueryPlan = {
      needs: [{
        id: "N1",
        text: "Locate a preview video of the new studio",
        retrievalQueries: ["new studio preview video"],
        productScope: "unknown",
        domains: ["studio"],
        actions: ["send"],
        entities: ["preview video"],
        relation: "artifact_identity",
        requestKind: "artifact_request",
        ambiguity: "material",
        clarificationQuestion: "Which product?",
      }],
      conversationIntent: "answer",
      reasoningSummary: "test",
    };
    const guarded = applyV4SystemicDeterministicQueryGuards(plan, turn);
    expect(guarded.needs[0]).toMatchObject({ ambiguity: "none", clarificationQuestion: "" });
    expect(guarded.needs[0].domains).toContain("controlled artifact");
    expect(v4SystemicNeedRequiresCurrentArtifact(guarded.needs[0])).toBe(true);
  });

  it("treats a current exact address as a live controlled artifact", () => {
    const turn = resolveV4SystemicTurn("What is the current studio address?", []);
    const plan: V4SystemicQueryPlan = {
      needs: [{
        id: "N1",
        text: "Find the current studio address",
        retrievalQueries: ["current studio address"],
        productScope: "main_istv",
        domains: ["studio"],
        actions: ["locate"],
        entities: ["studio address"],
        relation: "location",
        requestKind: "current_lookup",
        ambiguity: "none",
        clarificationQuestion: "",
      }],
      conversationIntent: "answer",
      reasoningSummary: "test",
    };
    const guarded = applyV4SystemicDeterministicQueryGuards(plan, turn);
    expect(guarded.needs[0].domains).toContain("controlled artifact");
    expect(v4SystemicNeedRequiresCurrentArtifact(guarded.needs[0])).toBe(true);
  });

  it("overrides a generic model route with deterministic finance and contract-automation destinations", () => {
    const retrieval = { candidates: [] } as unknown as V4SystemicRetrieval;
    const baseDecision: V4SystemicNeedDecision = {
      needId: "N1",
      lane: "route",
      evidenceRefs: [],
      answerSentences: [],
      routeKey: "sales_policy",
      clarificationQuestion: "",
      confidence: 0.5,
      reason: "model route",
    };
    const baseNeed = {
      id: "N1",
      retrievalQueries: [],
      productScope: "unknown" as const,
      domains: [],
      actions: [],
      entities: [],
      relation: "procedure" as const,
      requestKind: "operational_action" as const,
      ambiguity: "none" as const,
      clarificationQuestion: "",
    };
    expect(v4SystemicGenericRouteKey({ ...baseNeed, text: "Confirm a third-party payment for the client" }, baseDecision, retrieval)).toBe("finance");
    expect(v4SystemicGenericRouteKey({ ...baseNeed, text: "The contract did not populate automatically after payment" }, baseDecision, retrieval)).toBe("sales_tech");
  });

  it("routes unresolved policy questions separately from operational action ownership", () => {
    const retrieval = { candidates: [] } as unknown as V4SystemicRetrieval;
    const decision: V4SystemicNeedDecision = {
      needId: "N1",
      lane: "route",
      evidenceRefs: [],
      answerSentences: [],
      routeKey: "greenlight",
      clarificationQuestion: "",
      confidence: 0.5,
      reason: "model route",
    };
    const makeNeed = (text: string, requestKind: "knowledge" | "operational_action" | "current_lookup" | "artifact_request") => ({
      id: "N1",
      text,
      retrievalQueries: [text],
      productScope: "unknown" as const,
      domains: [],
      actions: [],
      entities: [],
      relation: "procedure" as const,
      requestKind,
      ambiguity: "none" as const,
      clarificationQuestion: "",
    });
    expect(v4SystemicGenericRouteKey(makeNeed("Can reps offer a custom payment plan?", "knowledge"), decision, retrieval)).toBe("sales_policy");
    expect(v4SystemicGenericRouteKey(makeNeed("How should I confirm a third-party payment?", "knowledge"), decision, retrieval)).toBe("finance");
    expect(v4SystemicGenericRouteKey(makeNeed("Confirm whether this ACH cleared", "current_lookup"), decision, retrieval)).toBe("finance");
    expect(v4SystemicGenericRouteKey(makeNeed("What qualifies a doctor for the show?", "knowledge"), decision, retrieval)).toBe("sales_policy");
    expect(v4SystemicGenericRouteKey(makeNeed("Send the current greenlight letter", "artifact_request"), decision, retrieval)).toBe("greenlight");
    expect(v4SystemicGenericRouteKey(makeNeed("Who can send an approval PDF?", "artifact_request"), decision, retrieval)).toBe("greenlight");
    expect(v4SystemicGenericRouteKey(makeNeed("Are greenlight PDFs sent automatically?", "knowledge"), decision, retrieval)).toBe("greenlight");
    expect(v4SystemicGenericRouteKey(makeNeed("Find the phone call recording", "artifact_request"), decision, retrieval)).toBe("sales_tech");
    expect(v4SystemicGenericRouteKey(makeNeed("Which channel handles finance requests?", "operational_action"), decision, retrieval)).toBe("finance");
    expect(v4SystemicGenericRouteKey(makeNeed("Which channel handles green light letter requests?", "operational_action"), decision, retrieval)).toBe("greenlight");

    const financeDecision: V4SystemicNeedDecision = { ...decision, routeKey: "finance" };
    const techDecision: V4SystemicNeedDecision = { ...decision, routeKey: "sales_tech" };
    expect(v4SystemicGenericRouteKey(makeNeed("Will future ACH installments draft automatically?", "knowledge"), financeDecision, retrieval)).toBe("sales_policy");
    expect(v4SystemicGenericRouteKey(makeNeed("Where can I find the signed agreement record?", "knowledge"), techDecision, retrieval)).toBe("sales_tech");
    expect(v4SystemicGenericRouteKey(makeNeed("How do I verify that a main ISTV contract has been signed?", "knowledge"), decision, retrieval)).toBe("sales_tech");
    expect(v4SystemicGenericRouteKey({
      ...makeNeed("Where can I find the signed agreement after the ACH payment?", "knowledge"),
      domains: ["contracts", "payments"],
      actions: ["locate signed agreement"],
      entities: ["signed agreement", "ACH payment"],
      relation: "artifact_location" as const,
    }, financeDecision, retrieval)).toBe("sales_tech");
    expect(v4SystemicGenericRouteKey(makeNeed("How is a self-sourced lead attribution recorded?", "knowledge"), techDecision, retrieval)).toBe("sales_tech");
    expect(v4SystemicGenericRouteKey(makeNeed("Determine if a paid client can request contract redlining", "operational_action"), financeDecision, retrieval)).toBe("sales_policy");
    expect(v4SystemicGenericRouteKey(makeNeed("The payment page button will not work on the client's phone", "knowledge"), decision, retrieval)).toBe("sales_tech");
    expect(v4SystemicGenericRouteKey({
      ...makeNeed("Determine the troubleshooting steps when the backup link also fails", "knowledge"),
      domains: ["payment", "technical support"],
      entities: ["backup link", "payment page"],
    }, decision, retrieval)).toBe("sales_tech");
    expect(v4SystemicGenericRouteKey(makeNeed("Is there training for moving leads between Keap and HubSpot?", "knowledge"), decision, retrieval)).toBe("sales_tech");
    expect(v4SystemicGenericRouteKey(makeNeed("What should the rep do if a prospect photographs Call 1 slides?", "knowledge"), decision, retrieval)).toBe("sales_policy");
    expect(v4SystemicGenericRouteKey(makeNeed("Can reps offer a custom payment plan?", "knowledge"), decision, retrieval)).toBe("sales_policy");
  });

  it("preserves a missing workflow-resource access gap beside the policy question", () => {
    const question = "How do I greenlight? I was told to use daily stats, but I don't have such a group on my list.";
    const turn = resolveV4SystemicTurn(question, []);
    const plan: V4SystemicQueryPlan = {
      needs: [{
        id: "N1",
        text: "How do I greenlight?",
        retrievalQueries: ["greenlight process"],
        productScope: "main_istv",
        domains: ["greenlight"],
        actions: ["submit greenlight"],
        entities: ["greenlight request"],
        relation: "procedure",
        requestKind: "knowledge",
        ambiguity: "none",
        clarificationQuestion: "",
      }],
      conversationIntent: "answer",
      reasoningSummary: "test",
    };
    const guarded = applyV4SystemicDeterministicQueryGuards(plan, turn);
    expect(guarded.needs).toHaveLength(2);
    expect(guarded.needs[1].requestKind).toBe("current_lookup");
    expect(guarded.needs[1].actions).toContain("locate or restore access");
    const decision: V4SystemicNeedDecision = {
      needId: "N2",
      lane: "route",
      evidenceRefs: [],
      answerSentences: [],
      routeKey: null,
      clarificationQuestion: "",
      confidence: 0.5,
      reason: "test",
    };
    expect(v4SystemicGenericRouteKey(guarded.needs[1], decision, { candidates: [] } as unknown as V4SystemicRetrieval)).toBe("greenlight");
  });

  it("keeps a stable search path distinct from identifying the exact current artifact", () => {
    const base = {
      id: "N1",
      retrievalQueries: ["current upgrade form"],
      productScope: "unknown" as const,
      domains: ["controlled artifact"],
      actions: ["locate current artifact"],
      entities: ["upgrade form"],
      relation: "artifact_location" as const,
      requestKind: "artifact_request" as const,
      ambiguity: "none" as const,
      clarificationQuestion: "",
    };
    expect(v4SystemicNeedRequiresCurrentArtifact({ ...base, text: "Where can I find the upgrade form?" })).toBe(false);
    expect(v4SystemicNeedRequiresCurrentArtifact({
      ...base,
      text: "Where can I find the upgrade form?",
      authorityText: "Where can I find the current upgrade sheet?",
      originalRequestText: "Where can I find the current upgrade sheet?",
      retrievalQueries: ["identify the correct current upgrade form"],
    })).toBe(false);
    expect(v4SystemicNeedRequiresCurrentArtifact({ ...base, text: "How do I identify the correct current upgrade form?" })).toBe(true);
  });

  it("deterministically splits artifact navigation from exact current-form identification", () => {
    const turn = resolveV4SystemicTurn("Where can I find the current upgrade sheet and how do I identify the right form?", []);
    const plan: V4SystemicQueryPlan = {
      needs: [{
        id: "N1",
        text: "Where can I find the current upgrade sheet and how do I identify the right form?",
        retrievalQueries: ["current upgrade sheet and right form"],
        productScope: "unknown",
        domains: ["upgrade"],
        actions: ["locate"],
        entities: ["upgrade sheet", "form"],
        relation: "artifact_location",
        requestKind: "artifact_request",
        ambiguity: "none",
        clarificationQuestion: "",
      }],
      conversationIntent: "answer",
      reasoningSummary: "test",
    };
    const guarded = applyV4SystemicDeterministicQueryGuards(plan, turn);
    expect(guarded.needs).toHaveLength(2);
    expect(v4SystemicNeedRequiresCurrentArtifact(guarded.needs[0])).toBe(false);
    expect(v4SystemicNeedRequiresCurrentArtifact(guarded.needs[1])).toBe(true);
  });

  it("does not substitute onboarding or outreach evidence for an approval workflow", () => {
    const referralPolicy = getV4SystemicCorpus().find((policy) =>
      /self-generated leads/i.test(policy.decision) &&
      /onboarding process/i.test(policy.decision),
    );
    expect(referralPolicy).toBeDefined();
    const turn = resolveV4SystemicTurn(
      "What is the approval process for a self-generated referral that has not applied through formal channels?",
      [],
    );
    expect(v4SystemicPolicyBoundaryErrors(referralPolicy!, turn)).toContain(
      "requested approval workflow stage is not established by the evidence",
    );
  });

  it("routes a declarative current-status conflict instead of negating the user's claim", () => {
    const discontinued = getV4SystemicCorpus().find((policy) =>
      /6-month training has been discontinued/i.test(policy.decision),
    );
    expect(discontinued).toBeDefined();
    const turn = resolveV4SystemicTurn("The Call 2 videos still include them.", []);
    expect(v4SystemicPolicyBoundaryErrors(discontinued!, turn)).toContain(
      "the user's asserted current status conflicts with the evidence and requires current confirmation",
    );
  });

  it("does not treat an availability duration as the requested release timing", () => {
    expect(v4SystemicNeedRelationErrors(
      "When should the episode appear on the ISTV platform?",
      "The episode is hosted on the ISTV platform for 5 years.",
    )).toContain("an availability duration or hosting term does not establish the requested release timing");
    expect(v4SystemicNeedRelationErrors(
      "When should the episode appear on the ISTV platform?",
      "The current release timeline is not approved, so verify it with the policy owner.",
    )).toEqual([]);
  });

  it("does not answer an exclusive-platform question with package quantity alone", () => {
    expect(v4SystemicNeedRelationErrors(
      "Are promotional views included in the $20K package for Facebook only?",
      "The $20K Standard package includes 100,000 pre-promo views.",
    )).toContain("package inclusion alone does not answer whether delivery is limited to Facebook");
    expect(v4SystemicNeedRelationErrors(
      "Are promotional views included in the $20K package for Facebook only?",
      "The package includes the promotional views, but the approved source does not establish that delivery is limited to Facebook.",
    )).toEqual([]);
  });

  it("requires the requested controlled-wording decision and a concrete included-asset list", () => {
    expect(v4SystemicNeedRelationErrors(
      "Can I change the morning confirmation text myself, or should I leave it unchanged?",
      "The morning confirmation text is incorrect.",
    )).toContain("identifying incorrect wording does not answer whether the rep may modify the controlled message");
    expect(v4SystemicNeedRelationErrors(
      "What social promotional assets are included in the package?",
      "The package includes some social promotional assets.",
    )).toContain("a generic statement that some assets exist does not identify the requested included assets");
    expect(v4SystemicNeedRelationErrors(
      "What social promotional assets are included in the package?",
      "The package includes a trailer clip and one promotional graphic.",
    )).toEqual([]);
  });

  it("requires material assignment and broader-fit conditions in qualification decisions", () => {
    const existingClientQuestion = "If someone is already an ISTV customer but applies for a different ISTV show, should I proceed with the new application or skip the call?";
    expect(v4SystemicNeedRelationErrors(
      existingClientQuestion,
      "An existing ISTV client may purchase another show; do not automatically skip the call.",
    )).toContain("an existing-client cross-show decision must preserve the original-rep assignment check");
    expect(v4SystemicNeedRelationErrors(
      existingClientQuestion,
      "Yes. Check Keap scheduled appointments for original assignment; if the original rep is inactive, the current rep can take it.",
    )).toEqual([]);

    const freelancerQuestion = "Should freelancers move to Call 2, or do they need an established business to qualify?";
    expect(v4SystemicNeedRelationErrors(
      freelancerQuestion,
      "Freelancing alone is not treated as entrepreneurship for qualification.",
    )).toContain("a freelancer qualification decision must preserve the business, offer, ownership, and broader-fit factors");
    expect(v4SystemicNeedRelationErrors(
      freelancerQuestion,
      "Freelancing alone is not treated as entrepreneurship. Evaluate the person's business, offer, ownership, and broader fit.",
    )).toEqual([]);

    expect(v4SystemicNeedRelationErrors(
      "How is the podcast episode structure intelligently designed?",
      "The documentary episode uses a Hollywood-documentary style focused on emotional storytelling and trust.",
    )).toContain("documentary-only evidence does not answer a podcast-only need");
  });

  it("rejects a generic ownership policy for a requested CRM record mutation", () => {
    const ownershipPolicy = getV4SystemicCorpus().find((policy) => policy.id === "v3src_two_calendar_engagement");
    expect(ownershipPolicy).toBeDefined();
    const turn = resolveV4SystemicTurn(
      "The duplicate records must be combined and the later appointment replaced. Where should this be handled?",
      [],
    );
    expect(v4SystemicPolicyBoundaryErrors(ownershipPolicy!, turn)).toContain(
      "requested technical mutation is not established by the evidence",
    );
  });

  it("recovers an exact uniquely dominant source sentence after a false semantic rejection", async () => {
    const result = await runAskSalesFaqV4Systemic(operationalPolicy!.question_families[0], [], {
      provider: operationalAnswerProvider(false, operationalPolicy!, operationalPolicy!.product_scopes[0] || "unknown", "unsupported"),
      skipChampionComparison: true,
    });

    expect(result.lane).toBe("answer");
    expect(result.selectedPolicyIds).toEqual([operationalPolicy!.id]);
    expect(result.runtimeMetadata.executionMode.planning).toBe("systemic_model");
    expect(result.runtimeMetadata.plan.reasoning_summary).not.toContain("Frozen V4 supplied the non-regression fallback");
    expect(result.runtimeMetadata.validation.removedSentences).toHaveLength(0);
  });

  it("recovers the exact controlling sentence when a source-resolved model draft is empty", async () => {
    const result = await runAskSalesFaqV4Systemic(operationalPolicy!.question_families[0], [], {
      provider: operationalAnswerProvider(
        false,
        operationalPolicy!,
        operationalPolicy!.product_scopes[0] || "unknown",
        "supported",
        false,
        false,
        false,
        true,
      ),
      skipChampionComparison: true,
    });

    expect(result.lane).toBe("answer");
    expect(result.selectedPolicyIds).toEqual([operationalPolicy!.id]);
    expect(result.answer).toContain(operationalPolicy!.decision.split(/(?<=[.!?])\s+/)[0]);
    expect(result.runtimeMetadata.plan.reasoning_summary).toContain("Exact-source recovery filled empty source-resolved drafts");
  });

  it("replaces a deterministically invalid paraphrase with its one exact controlling decision", async () => {
    const trainingPolicy = getV4SystemicCorpus().find((policy) => policy.id === "owner-six-month-training-discontinued");
    expect(trainingPolicy).toBeDefined();
    const result = await runAskSalesFaqV4Systemic(trainingPolicy!.question_families[0], [], {
      provider: operationalAnswerProvider(
        false,
        trainingPolicy!,
        trainingPolicy!.product_scopes[0] || "unknown",
        "unsupported",
        false,
        false,
        false,
        false,
        "No additional explanatory material is available.",
      ),
      skipChampionComparison: true,
    });

    expect(result.lane).toBe("answer");
    expect(result.selectedPolicyIds).toEqual([trainingPolicy!.id]);
    expect(result.answer).toContain("Rudy's call videos");
    expect(result.answer).toContain("Media Kit assets");
    expect(result.answer).not.toContain("No additional explanatory material is available");
  });

  it("still withholds a rejected sentence that lacks the tightly bounded exact-source fallback", async () => {
    const result = await runAskSalesFaqV4Systemic(
      `${operationalPolicy!.question_families[0]} Also, where is the exact current controlled link?`,
      [],
      {
        provider: operationalAnswerProvider(true, operationalPolicy!, operationalPolicy!.product_scopes[0] || "unknown", "unsupported"),
        skipChampionComparison: true,
      },
    );

    expect(result.lane).toBe("artifact");
    expect(result.selectedPolicyIds).toEqual([]);
    expect(result.runtimeMetadata.validation.removedSentences).not.toHaveLength(0);
  });

  it("does not mark a need answered when validation supports wording but assigns it to no need", async () => {
    const result = await runAskSalesFaqV4Systemic(operationalPolicy!.question_families[0], [], {
      provider: operationalAnswerProvider(
        false,
        operationalPolicy!,
        operationalPolicy!.product_scopes[0] || "unknown",
        "supported",
        false,
        false,
        true,
      ),
      skipChampionComparison: true,
    });

    expect(result.lane).toBe("partial");
    expect(result.runtimeMetadata.validation.unresolvedNeedIds).toEqual(["N1"]);
    expect(result.needsRoute).toBe(true);
  });

  it("falls back to frozen V4 instead of emitting a new degraded response when systemic models fail", async () => {
    const result = await runAskSalesFaqV4Systemic("What is the policy for an entirely unknown hypothetical?", [], {
      provider: unavailableProvider,
      validatorProvider: unavailableProvider,
      skipChampionComparison: true,
    });

    expect(result.ok).toBe(true);
    expect(result.runtimeMetadata.pipelineVersion).toBe("v4-systemic");
    expect(result.runtimeMetadata.executionMode.planning).toBe("systemic_fallback");
    expect(result.runtimeMetadata.plan.reasoning_summary).toContain("Frozen V4 supplied the non-regression fallback");
  });

  it("preserves Frozen V4 whenever it already provides answered help", () => {
    expect(selectV4SystemicChampion({ lane: "answer", answer: "new" }, { lane: "answer", answer: "old" }).selected).toBe("current_v4");
    expect(selectV4SystemicChampion({ lane: "answer", answer: "new" }, { lane: "partial", answer: "old" }).selected).toBe("current_v4");
  });

  it("uses the systemic candidate only after high-confidence evidence arbitration", () => {
    expect(selectV4SystemicChampion(
      { lane: "answer", answer: "new" },
      { lane: "route", answer: "route" },
      { selected: "systemic_expansion", confidence: 0.92, reason: "New direct evidence applies." },
    ).selected).toBe("systemic_expansion");
    expect(selectV4SystemicChampion(
      { lane: "answer", answer: "new" },
      { lane: "route", answer: "route" },
      { selected: "systemic_expansion", confidence: 0.8, reason: "Not certain enough." },
    ).selected).toBe("current_v4");
    expect(selectV4SystemicChampion({ lane: "route", answer: "route" }, { lane: "route", answer: "route" }).selected).toBe("current_v4");
    expect(selectV4SystemicChampion(
      { lane: "route", answer: "Check #sales-tech-requests before changing the records." },
      { lane: "partial", answer: "Merge the records yourself, then check #sales-questions-requests." },
      { selected: "systemic_expansion", confidence: 0.96, reason: "The champion instruction is unsupported and the candidate routes correctly." },
    ).selected).toBe("systemic_expansion");
    expect(selectV4SystemicChampion(
      { lane: "answer", answer: "Only approved listed plans may be used." },
      { lane: "clarify", answer: "Which product?" },
      undefined,
      {
        championUnsafe: false,
        systemicSafe: true,
        systemicAuthorityResolved: true,
        reason: "Explicit claim resolution applies.",
      },
    )).toMatchObject({ selected: "systemic_expansion", selectionMode: "safety_veto" });
  });

  it("deterministically vetoes a Frozen V4 answer that cites the wrong relationship", () => {
    const question = "What is the earliest time I can send a day-of SMS reminder?";
    const turn = resolveV4SystemicTurn(question, []);
    const cutoff = getV4SystemicCorpus().find((policy) => /SMS cutoff time is 9 PM/i.test(policy.title));
    expect(cutoff).toBeDefined();
    const result = (lane: "route" | "answer", answer: string, selectedPolicyIds: string[], relation: "timing_start" | "deadline") => ({
      lane,
      answer,
      selectedPolicyIds,
      runtimeMetadata: {
        turn,
        plan: {
          needs: [{
            id: "N1",
            text: question,
            relation,
            request_kind: "knowledge",
            product_scope: "unknown",
            domains: ["communications"],
            actions: ["send SMS"],
            entities: ["day-of SMS reminder"],
            lane,
            evidence_refs: selectedPolicyIds,
            supported_claim: answer,
            reason: "test",
            route_key: lane === "route" ? "sales_policy" : null,
            clarification_question: "",
          }],
          overall_lane: lane,
          confidence_score: lane === "answer" ? 90 : 35,
          reasoning_summary: "test",
        },
        sourcePlan: lane === "route" ? {
          needs: [{ needId: "N1", lane: "route", directPolicyIds: [], preferredPolicyIds: [], excludedConflictPolicyIds: [], reason: "No exact timing-start evidence was selected." }],
          reasoningSummary: "test",
        } : undefined,
      },
    }) as unknown as AskSalesFaqV4Result;
    const systemic = result("route", "Check #sales-questions-requests.", [], "timing_start");
    const champion = result("answer", "The cutoff is 9 PM EST.", [cutoff!.id], "deadline");
    const safety = evaluateV4SystemicChampionSafety(systemic, champion);
    expect(safety).toMatchObject({ championUnsafe: true, systemicSafe: true });
    expect(selectV4SystemicChampion(systemic, champion, undefined, safety)).toMatchObject({
      selected: "systemic_expansion",
      selectionMode: "safety_veto",
    });
  });

  it("deterministically preserves policy routing instead of misrouting a knowledge gap to tech", () => {
    const question = "What is the earliest time I can send a day-of SMS reminder?";
    const turn = resolveV4SystemicTurn(question, []);
    const result = (channel: string, routeKey: "sales_policy" | "sales_tech") => ({
      lane: "route",
      answer: `Check ${channel}.`,
      needsRoute: true,
      routeChannels: [channel],
      selectedPolicyIds: [],
      runtimeMetadata: {
        turn,
        plan: {
          needs: [{
            id: "N1",
            text: question,
            relation: "timing_start",
            request_kind: "knowledge",
            product_scope: "unknown",
            domains: ["communications"],
            actions: ["send SMS"],
            entities: ["day-of SMS reminder"],
            lane: "route",
            evidence_refs: [],
            supported_claim: "",
            reason: "No exact timing-start evidence was selected.",
            route_key: routeKey,
            clarification_question: "",
          }],
          overall_lane: "route",
          confidence_score: 35,
          reasoning_summary: "test",
        },
        sourcePlan: {
          needs: [{ needId: "N1", lane: "route", directPolicyIds: [], preferredPolicyIds: [], excludedConflictPolicyIds: [], reason: "No exact timing-start evidence was selected." }],
          reasoningSummary: "test",
        },
      },
    }) as unknown as AskSalesFaqV4Result;
    const systemic = result("#sales-questions-requests", "sales_policy");
    const champion = result("#sales-tech-requests", "sales_tech");
    const safety = evaluateV4SystemicChampionSafety(systemic, champion);
    expect(safety).toMatchObject({ championUnsafe: true, systemicSafe: true });
    expect(selectV4SystemicChampion(systemic, champion, undefined, safety)).toMatchObject({
      selected: "systemic_expansion",
      selectionMode: "safety_veto",
    });
  });

  it("does not let Frozen V4 turn an asserted condition into a fake unresolved lookup", () => {
    const question = "Can I email the contract link if the client wants to review it and is paying by wire?";
    const turn = resolveV4SystemicTurn(question, []);
    const contractPolicyId = "operational_95ddcec72a090d31";
    const answerNeed = {
      id: "N1",
      text: question,
      relation: "permission" as const,
      request_kind: "knowledge" as const,
      product_scope: "unknown" as const,
      domains: ["contract"],
      actions: ["email"],
      entities: ["contract link"],
      lane: "answer" as const,
      evidence_refs: [contractPolicyId],
      supported_claim: "A requested contract may be sent by email.",
      reason: "Exact claim resolution.",
      route_key: null,
      clarification_question: "",
    };
    const systemic = {
      lane: "answer",
      answer: "A requested contract may be sent by email.",
      routeChannels: [],
      selectedPolicyIds: [contractPolicyId],
      runtimeMetadata: {
        turn,
        plan: { needs: [answerNeed], overall_lane: "answer", confidence_score: 95, reasoning_summary: "test" },
        sourcePlan: {
          needs: [{ needId: "N1", lane: "answer", directPolicyIds: [contractPolicyId], preferredPolicyIds: [contractPolicyId], excludedConflictPolicyIds: ["operational_6034269702586108"], reason: "Exact source-fidelity resolution." }],
          reasoningSummary: "test",
        },
      },
    } as unknown as AskSalesFaqV4Result;
    const champion = {
      ...systemic,
      lane: "partial",
      answer: "You can send the contract. Check Finance to see whether the client is paying by wire.",
      routeChannels: ["#sales-finance-requests"],
      runtimeMetadata: {
        ...systemic.runtimeMetadata,
        plan: {
          ...systemic.runtimeMetadata.plan,
          overall_lane: "partial",
          needs: [
            answerNeed,
            {
              ...answerNeed,
              id: "N2",
              text: "Is the client paying by wire?",
              relation: "status",
              request_kind: "current_lookup",
              lane: "route",
              evidence_refs: [],
              supported_claim: "",
              route_key: "finance",
            },
          ],
        },
      },
    } as unknown as AskSalesFaqV4Result;
    const safety = evaluateV4SystemicChampionSafety(systemic, champion);
    expect(safety).toMatchObject({ championUnsafe: true, systemicSafe: true, systemicAuthorityResolved: true });
    expect(selectV4SystemicChampion(systemic, champion, undefined, safety)).toMatchObject({
      selected: "systemic_expansion",
      selectionMode: "safety_veto",
    });
  });
});

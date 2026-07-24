import { expect, it } from "vitest";

import {
  inferV4SystemicRelation,
  inferV4SystemicRequestKind,
} from "@/lib/ask-sales-faq/v4/systemic/relations";
import { resolveV4SystemicTurn } from "@/lib/ask-sales-faq/v4/systemic/turn";
import type { V4SystemicNeed, V4SystemicQueryPlan } from "@/lib/ask-sales-faq/v4/systemic/types";
import { getV5KnowledgeSnapshot } from "@/lib/ask-sales-faq/v5/knowledge";
import { retrieveV5Policies } from "@/lib/ask-sales-faq/v5/retrieval";

function retrieve(question: string, overrides: Partial<V4SystemicNeed> = {}) {
  const plannedNeed: V4SystemicNeed = {
    id: "N1",
    text: question,
    authorityText: question,
    originalRequestText: question,
    retrievalQueries: [question],
    productScope: "unknown",
    domains: [],
    actions: [],
    entities: [],
    relation: inferV4SystemicRelation(question),
    requestKind: inferV4SystemicRequestKind(question),
    ambiguity: "none",
    clarificationQuestion: "",
    ...overrides,
  };
  const plan: V4SystemicQueryPlan = {
    needs: [plannedNeed],
    conversationIntent: "answer",
    reasoningSummary: "V5 bounded retrieval regression",
  };
  return retrieveV5Policies(resolveV4SystemicTurn(question, []), plan);
}

it("preserves direct authoritative question-family recall without a broad candidate window (chunk 0)", () => {
  const sample = getV5KnowledgeSnapshot().policies
    .filter((policy) => policy.answerability === "answer_evidence" && policy.question_families[0])
    .filter((_policy, index) => index % 37 === 0)
    .slice(0, 24);
  expect(sample.length).toBeGreaterThan(0);
  let found = 0;
  for (const policy of sample) {
    const question = policy.question_families[0];
    const result = retrieve(question, {
      productScope: policy.product_scopes.includes("main_istv") ? "main_istv"
        : policy.product_scopes.includes("dj_nlceo") ? "dj_nlceo" : "unknown",
      domains: policy.domains,
      actions: policy.actions,
      entities: policy.entities,
      relation: inferV4SystemicRelation(question),
    });
    if (result.candidates.some((candidate) => candidate.policy.id === policy.id)) found += 1;
  }
  expect(found / sample.length).toBeGreaterThanOrEqual(0.8);
}, 45_000);

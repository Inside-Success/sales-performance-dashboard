import { describe, expect, it } from "vitest";

import { getV4SystemicBlockedTopics } from "@/lib/ask-sales-faq/v4/systemic/corpus";
import { inferV4SystemicRelation, inferV4SystemicRequestKind } from "@/lib/ask-sales-faq/v4/systemic/relations";
import { retrieveV4SystemicPolicies } from "@/lib/ask-sales-faq/v4/systemic/retrieval";
import { resolveV4SystemicTurn } from "@/lib/ask-sales-faq/v4/systemic/turn";
import type { V4SystemicNeed } from "@/lib/ask-sales-faq/v4/systemic/types";

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

const canonicalOpenConflictTopics = getV4SystemicBlockedTopics().filter((topic) => topic?.question_families?.[0]);
const canonicalOpenConflictChunks = Array.from({ length: 4 }, (_, index) => {
  const chunkSize = Math.ceil(canonicalOpenConflictTopics.length / 4);
  return canonicalOpenConflictTopics.slice(index * chunkSize, (index + 1) * chunkSize);
}).filter((topics) => topics.length).map((topics) => [topics] as const);

describe("V4 systemic open-conflict coverage", () => {
  it.each(canonicalOpenConflictChunks)("recognizes every canonical open-conflict question without broad topic-only matching (chunk %#)", (topics) => {
    for (const topic of topics) {
      const question = topic.question_families![0];
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

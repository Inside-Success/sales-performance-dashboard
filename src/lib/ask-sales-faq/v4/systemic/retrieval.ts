import {
  getV4SystemicBlockedTopics,
  getV4SystemicCorpus,
  v4SystemicPolicyText,
} from "@/lib/ask-sales-faq/v4/systemic/corpus";
import type {
  V4SystemicCandidate,
  V4SystemicNeed,
  V4SystemicQueryPlan,
  V4SystemicRetrieval,
} from "@/lib/ask-sales-faq/v4/systemic/types";
import type { V3ProductScope, V3TurnResolution } from "@/lib/ask-sales-faq/v3/types";

const corpus = getV4SystemicCorpus();

type SourceStratum = "governed_answer" | "operational_answer" | "governed_support" | "operational_support";

function sourceStratum(policy: V4SystemicCandidate["policy"]): SourceStratum {
  const operational = policy.systemic.sourceClass === "authoritative_operational_qna";
  const answer = policy.answerability === "answer_evidence";
  if (operational && answer) return "operational_answer";
  if (operational) return "operational_support";
  if (answer) return "governed_answer";
  return "governed_support";
}

function balancedBySource<T extends { policy: V4SystemicCandidate["policy"]; score: number }>(
  candidates: T[],
  limits: Record<SourceStratum, number>,
  totalLimit: number,
) {
  const order: SourceStratum[] = [
    "governed_answer", "operational_answer", "governed_answer", "operational_answer",
    "governed_support", "operational_support",
  ];
  const buckets = Object.fromEntries(([
    "governed_answer", "operational_answer", "governed_support", "operational_support",
  ] as SourceStratum[]).map((stratum) => [
    stratum,
    candidates.filter((candidate) => sourceStratum(candidate.policy) === stratum).slice(0, limits[stratum]),
  ])) as Record<SourceStratum, T[]>;
  const cursors: Record<SourceStratum, number> = {
    governed_answer: 0,
    operational_answer: 0,
    governed_support: 0,
    operational_support: 0,
  };
  const selected: T[] = [];
  const selectedIds = new Set<string>();
  if (candidates[0]) {
    selected.push(candidates[0]);
    selectedIds.add(candidates[0].policy.id);
  }
  while (selected.length < totalLimit && order.some((stratum) => cursors[stratum] < buckets[stratum].length)) {
    for (const stratum of order) {
      const candidate = buckets[stratum][cursors[stratum]];
      if (!candidate) continue;
      cursors[stratum] += 1;
      if (selectedIds.has(candidate.policy.id)) continue;
      selected.push(candidate);
      selectedIds.add(candidate.policy.id);
      if (selected.length >= totalLimit) break;
    }
  }
  for (const candidate of candidates) {
    if (selected.length >= totalLimit) break;
    if (selectedIds.has(candidate.policy.id)) continue;
    selected.push(candidate);
    selectedIds.add(candidate.policy.id);
  }
  return selected;
}

const GENERIC_EQUIVALENTS: Record<string, string[]> = {
  buy: ["purchase", "pay"],
  purchase: ["buy", "payment"],
  cost: ["price", "pricing", "fee"],
  price: ["cost", "pricing", "fee"],
  pay: ["payment", "billing"],
  payment: ["pay", "billing"],
  contract: ["agreement", "license"],
  call: ["meeting", "appointment"],
  meeting: ["call", "appointment"],
  reschedule: ["rebook", "move"],
  client: ["prospect", "cast", "customer"],
  prospect: ["client", "applicant", "lead"],
  show: ["program", "episode"],
  watch: ["view", "stream"],
  tech: ["technical", "system", "tool"],
  current: ["latest", "active"],
  latest: ["current", "active"],
  include: ["included", "cover", "benefit"],
};

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9$%]+/g, " ").replace(/\s+/g, " ").trim();
}

function stem(value: string) {
  if (value.length <= 4) return value;
  return value
    .replace(/(?:ies)$/i, "y")
    .replace(/(?:ing|ers|er|ed|es|s)$/i, "");
}

function tokens(value: string) {
  return normalize(value).split(" ").map(stem).filter((token) => token.length >= 2);
}

function expandedTokens(value: string) {
  const base = tokens(value);
  return [...new Set(base.flatMap((token) => [token, ...(GENERIC_EQUIVALENTS[token] || []).map(stem)]))];
}

function trigrams(value: string) {
  const compact = normalize(value).replace(/\s+/g, " ");
  const result = new Set<string>();
  for (let index = 0; index <= compact.length - 3; index += 1) result.add(compact.slice(index, index + 3));
  return result;
}

function jaccard(left: Set<string>, right: Set<string>) {
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const value of left) if (right.has(value)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

function overlap(query: string[], document: string[]) {
  if (!query.length || !document.length) return 0;
  const set = new Set(document);
  return query.filter((token) => set.has(token)).length / new Set(query).size;
}

const documents = corpus.map((policy) => {
  const text = v4SystemicPolicyText(policy);
  return {
    policy,
    text,
    tokens: tokens(text),
    familyTokens: policy.question_families.map((family) => tokens(family)),
    trigrams: trigrams(text),
    structured: new Set([
      ...policy.domains,
      ...policy.actions,
      ...policy.entities,
    ].flatMap(tokens)),
  };
});

const documentFrequency = new Map<string, number>();
for (const document of documents) {
  for (const token of new Set(document.tokens)) documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1);
}
const averageDocumentLength = documents.reduce((total, document) => total + document.tokens.length, 0) / Math.max(1, documents.length);

function bm25(query: string[], document: string[]) {
  if (!query.length || !document.length) return 0;
  const frequencies = new Map<string, number>();
  for (const token of document) frequencies.set(token, (frequencies.get(token) || 0) + 1);
  const k1 = 1.2;
  const b = 0.75;
  let score = 0;
  for (const token of new Set(query)) {
    const frequency = frequencies.get(token) || 0;
    if (!frequency) continue;
    const df = documentFrequency.get(token) || 0;
    const idf = Math.log(1 + (documents.length - df + 0.5) / (df + 0.5));
    const denominator = frequency + k1 * (1 - b + b * document.length / Math.max(1, averageDocumentLength));
    score += idf * (frequency * (k1 + 1)) / denominator;
  }
  return score;
}

function scopeCompatibility(policy: V4SystemicCandidate["policy"], scope: V3ProductScope, turn: V3TurnResolution) {
  if (turn.excludedScopes.some((excluded) => policy.product_scopes.includes(excluded))) return -20;
  if (scope === "unknown" || scope === "comparison") return policy.product_scopes.includes("comparison") ? 1 : 0;
  if (policy.product_scopes.includes(scope)) return 4;
  if (policy.product_scopes.includes("product_agnostic")) return 3;
  if (
    policy.systemic.sourceClass === "authoritative_operational_qna" &&
    policy.systemic.scopeRisk === "general" &&
    policy.product_scopes.includes("unknown")
  ) return 2.5;
  if (policy.product_scopes.includes("comparison") || policy.product_scopes.includes("unknown")) return 0;
  return -8;
}

function structuredNeedTerms(need: V4SystemicNeed) {
  return [...need.domains, ...need.actions, ...need.entities].flatMap(tokens);
}

function qualityScore(candidate: typeof documents[number]) {
  const policy = candidate.policy;
  const quality = policy.quality_tier === "canonical"
    ? 3
    : policy.quality_tier === "supporting"
      ? 2
      : policy.quality_tier === "trusted_evidence"
        ? 1.5
        : 0.5;
  const answerability = policy.answerability === "answer_evidence" ? 2 : policy.answerability === "route_or_support" ? 0.5 : -6;
  return quality + answerability + Math.min(2, policy.authority / 5);
}

function queryScore(document: typeof documents[number], query: string, need: V4SystemicNeed, turn: V3TurnResolution) {
  const queryTokens = expandedTokens(query);
  const lexicalScore = bm25(queryTokens, document.tokens);
  const familyScore = Math.max(0, ...document.familyTokens.map((family) => overlap(queryTokens, family))) * 10;
  const characterScore = jaccard(trigrams(query), document.trigrams) * 5;
  const structured = structuredNeedTerms(need);
  const structuredScore = overlap(structured, [...document.structured]) * 8;
  const scopeScore = scopeCompatibility(document.policy, need.productScope === "unknown" ? turn.productScope : need.productScope, turn);
  const total = lexicalScore + familyScore + characterScore + structuredScore + scopeScore + qualityScore(document);
  return { total, lexicalScore, familyScore, characterScore, structuredScore };
}

function rankForNeed(need: V4SystemicNeed, turn: V3TurnResolution) {
  const queries = [...new Set([need.text, ...need.retrievalQueries, turn.standaloneQuestion].map(normalize).filter(Boolean))];
  const ranked = documents
    .map((document) => {
      const scored = queries.map((query) => ({ query, ...queryScore(document, query, need, turn) }))
        .sort((left, right) => right.total - left.total);
      const best = scored[0];
      return {
        document,
        score: best?.total || 0,
        lexicalScore: best?.lexicalScore || 0,
        familyScore: best?.familyScore || 0,
        characterScore: best?.characterScore || 0,
        structuredScore: best?.structuredScore || 0,
        matchedQueries: scored.filter((item) => item.total >= Math.max(3, (best?.total || 0) * 0.75)).map((item) => item.query),
        matchedTerms: [...new Set(expandedTokens(best?.query || "").filter((token) => document.tokens.includes(token)))],
      };
    })
    .filter((candidate) => candidate.score > 1)
    .sort((left, right) => right.score - left.score || right.document.policy.authority - left.document.policy.authority)
    .map((candidate) => ({ ...candidate, policy: candidate.document.policy }));
  return balancedBySource(ranked, {
    governed_answer: 70,
    operational_answer: 70,
    governed_support: 35,
    operational_support: 35,
  }, 210).map((candidate) => {
    const { policy, ...rankedCandidate } = candidate;
    void policy;
    return rankedCandidate;
  });
}

function blockedTopicIds(plan: V4SystemicQueryPlan) {
  const queryTerms = new Set(plan.needs.flatMap((need) => [need.text, ...need.retrievalQueries].flatMap(tokens)));
  return getV4SystemicBlockedTopics()
    .map((topic) => {
      const topicTerms = new Set([
        topic.resolution || "",
        ...(topic.question_families || []),
        ...(topic.domains || []),
        ...(topic.actions || []),
        ...(topic.entities || []),
      ].flatMap(tokens));
      return { id: topic.id, score: jaccard(queryTerms, topicTerms) };
    })
    .filter((topic) => topic.score >= 0.16)
    .sort((left, right) => right.score - left.score)
    .slice(0, 8)
    .map((topic) => topic.id);
}

export function retrieveV4SystemicPolicies(
  turn: V3TurnResolution,
  plan: V4SystemicQueryPlan,
  limit = 60,
): V4SystemicRetrieval {
  const startedAt = Date.now();
  const fused = new Map<string, Omit<V4SystemicCandidate, "rank"> & { reciprocal: number }>();
  for (const need of plan.needs) {
    const ranked = rankForNeed(need, turn);
    ranked.forEach((candidate, index) => {
      const id = candidate.document.policy.id;
      const reciprocal = 1 / (50 + index + 1);
      const existing = fused.get(id);
      const next = {
        policy: candidate.document.policy,
        score: Math.max(existing?.score || 0, candidate.score) + (existing?.reciprocal || 0) + reciprocal,
        matchedQueries: [...new Set([...(existing?.matchedQueries || []), ...candidate.matchedQueries])],
        matchedTerms: [...new Set([...(existing?.matchedTerms || []), ...candidate.matchedTerms])],
        lexicalScore: Math.max(existing?.lexicalScore || 0, candidate.lexicalScore),
        familyScore: Math.max(existing?.familyScore || 0, candidate.familyScore),
        characterScore: Math.max(existing?.characterScore || 0, candidate.characterScore),
        structuredScore: Math.max(existing?.structuredScore || 0, candidate.structuredScore),
        authorityScore: Math.min(2, candidate.document.policy.authority / 5),
        reciprocal: (existing?.reciprocal || 0) + reciprocal,
      };
      fused.set(id, next);
    });
  }

  const perDecision = new Map<string, number>();
  const deduplicated = [...fused.values()]
    .sort((left, right) => right.score - left.score || right.policy.authority - left.policy.authority)
    .filter((candidate) => {
      const count = perDecision.get(candidate.policy.decision_key) || 0;
      if (count >= 3) return false;
      perDecision.set(candidate.policy.decision_key, count + 1);
      return true;
    });
  const balanced = balancedBySource(deduplicated, {
    governed_answer: Math.ceil(limit * 0.4),
    operational_answer: Math.ceil(limit * 0.3),
    governed_support: Math.ceil(limit / 6),
    operational_support: Math.ceil(limit / 7.5),
  }, limit);
  const candidates = balanced
    .map((candidate, index): V4SystemicCandidate => {
      const { reciprocal, ...rankedCandidate } = candidate;
      void reciprocal;
      return {
        ...rankedCandidate,
        rank: index + 1,
      };
    });

  return {
    query: turn.standaloneQuestion,
    turn,
    corpusSize: corpus.length,
    candidates,
    blockedTopicIds: blockedTopicIds(plan),
    stageTimings: { systemicRetrievalMs: Date.now() - startedAt },
  };
}

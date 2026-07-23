import {
  getV4SystemicBlockedTopics,
  getV4SystemicCorpus,
} from "@/lib/ask-sales-faq/v4/systemic/corpus";
import { matchingV4SystemicAuthorityResolutions } from "@/lib/ask-sales-faq/v4/systemic/authority-resolutions";
import {
  getV4AtomicDecisionLedger,
  v4AtomicDecisionEvidence,
  v4AtomicTerms,
} from "@/lib/ask-sales-faq/v4/systemic/decision-ledger";
import {
  inferV4SystemicPolicyRelations,
  inferV4SystemicRelation,
  v4SystemicDecisionObjectErrors,
  v4SystemicDecisionObjectScore,
  v4SystemicMaterialQualifierErrors,
  v4SystemicRelationCompatibility,
} from "@/lib/ask-sales-faq/v4/systemic/relations";
import type {
  V4SystemicCandidate,
  V4SystemicNeed,
  V4SystemicQueryPlan,
  V4SystemicRetrieval,
} from "@/lib/ask-sales-faq/v4/systemic/types";
import type { V3ProductScope, V3TurnResolution } from "@/lib/ask-sales-faq/v3/types";

const corpus = getV4SystemicCorpus();
const policyById = new Map(corpus.map((policy) => [policy.id, policy]));

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

const documents = getV4AtomicDecisionLedger().flatMap((decision) => {
  const policy = policyById.get(decision.parentPolicyId);
  if (!policy) return [];
  const text = [
    policy.title,
    ...policy.question_families,
    v4AtomicDecisionEvidence(decision),
    ...policy.product_scopes,
    ...policy.domains,
    ...policy.actions,
    ...policy.entities,
  ].join(" ");
  return [{
    policy,
    decision,
    text,
    tokens: tokens(text),
    familyTokens: policy.question_families.map((family) => tokens(family)),
    trigrams: trigrams(text),
    structured: new Set([
      ...policy.domains,
      ...policy.actions,
      ...policy.entities,
    ].flatMap(tokens)),
    relations: decision.relations.length ? decision.relations : inferV4SystemicPolicyRelations(policy),
  }];
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

function sparseVector(value: string) {
  const vector = new Map<string, number>();
  for (const token of v4AtomicTerms(value)) vector.set(token, (vector.get(token) || 0) + 1);
  return vector;
}

function cosineSimilarity(left: Map<string, number>, right: Map<string, number>) {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (const value of left.values()) leftNorm += value * value;
  for (const value of right.values()) rightNorm += value * value;
  for (const [key, value] of left) dot += value * (right.get(key) || 0);
  return leftNorm && rightNorm ? dot / Math.sqrt(leftNorm * rightNorm) : 0;
}

const documentVectors = new Map(documents.map((document) => [document.decision.id, sparseVector(document.text)]));

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

const GENERIC_BLOCKED_MATCH_TERMS = new Set([
  "a", "after", "already", "an", "and", "are", "be", "before", "do", "does", "did", "for", "from", "had", "has", "have", "if", "in", "into", "is", "it", "need", "needs", "of", "on", "one", "or", "the", "to", "with",
  "agreement", "allow", "allowed", "applicant", "answer", "ask", "can", "client", "contract", "could", "create", "current", "determine", "eligible", "explain", "general", "handle", "make", "may", "pay", "permitted",
  "business", "call", "cast", "member", "person", "people", "how", "lead", "media", "must", "payment", "policy", "price", "process", "prospect", "qualify", "qualification", "sign", "up",
  "onboard", "post", "question", "rep", "reps", "request", "required", "rule", "sale", "sales", "send", "should", "show", "status", "tell", "that", "this",
  "use", "verify", "what", "when", "where", "which", "who", "will", "would",
].flatMap((term) => [term, stem(term)]));

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

type ResolutionPolicySets = { controlling: Set<string>; excluded: Set<string> };

function resolutionPolicySets(need: V4SystemicNeed): ResolutionPolicySets {
  const matching = matchingV4SystemicAuthorityResolutions(need);
  return {
    controlling: new Set(matching.flatMap((resolution) => resolution.controlling_policy_ids)),
    excluded: new Set(matching.flatMap((resolution) => resolution.excluded_policy_ids)),
  };
}

function queryScore(
  document: typeof documents[number],
  query: string,
  need: V4SystemicNeed,
  turn: V3TurnResolution,
  resolution: ResolutionPolicySets,
) {
  const queryTokens = expandedTokens(query);
  const lexicalScore = bm25(queryTokens, document.tokens);
  const familyScore = Math.max(0, ...document.familyTokens.map((family) => overlap(queryTokens, family))) * 10;
  const characterScore = jaccard(trigrams(query), document.trigrams) * 5;
  const structured = structuredNeedTerms(need);
  const structuredScore = overlap(structured, [...document.structured]) * 8;
  const semanticVectorScore = cosineSimilarity(sparseVector(query), documentVectors.get(document.decision.id) || new Map()) * 12;
  const relationCompatibility = v4SystemicRelationCompatibility(need.relation, document.relations);
  const resolutionControlsPolicy = resolution.controlling.has(document.policy.id);
  const relationScore = resolutionControlsPolicy
    ? 8
    : relationCompatibility === "exact"
    ? 8
    : relationCompatibility === "compatible"
      ? 3
      : relationCompatibility === "incompatible"
        ? -18
        : 0;
  const decisionObjectText = need.originalRequestText || need.authorityText || need.text;
  const decisionObjectScore = v4SystemicDecisionObjectScore(decisionObjectText, document.text);
  const resolutionDisposition = resolution.excluded.has(document.policy.id)
    ? "excluded"
    : resolution.controlling.has(document.policy.id)
      ? "controlling"
      : "unresolved";
  const resolutionScore = resolutionDisposition === "controlling" ? 18 : resolutionDisposition === "excluded" ? -100 : 0;
  const qualifierPenalty = (!resolutionControlsPolicy && relationCompatibility === "incompatible") || v4SystemicMaterialQualifierErrors(need, document.policy).length
    ? -18
    : 0;
  const scopeScore = scopeCompatibility(document.policy, need.productScope === "unknown" ? turn.productScope : need.productScope, turn);
  const total = lexicalScore + familyScore + characterScore + structuredScore + semanticVectorScore + relationScore + decisionObjectScore + resolutionScore + qualifierPenalty + scopeScore + qualityScore(document);
  return { total, lexicalScore, familyScore, characterScore, structuredScore, semanticVectorScore, relationScore };
}

function rankForNeed(need: V4SystemicNeed, turn: V3TurnResolution) {
  const queries = [...new Set([need.text, ...need.retrievalQueries, turn.standaloneQuestion].map(normalize).filter(Boolean))];
  const resolution = resolutionPolicySets(need);
  const ranked = documents
    .filter((document) => !resolution.excluded.has(document.policy.id))
    .map((document) => {
      const scored = queries.map((query) => ({ query, ...queryScore(document, query, need, turn, resolution) }))
        .sort((left, right) => right.total - left.total);
      const best = scored[0];
      return {
        document,
        score: best?.total || 0,
        lexicalScore: best?.lexicalScore || 0,
        familyScore: best?.familyScore || 0,
        characterScore: best?.characterScore || 0,
        structuredScore: best?.structuredScore || 0,
        semanticVectorScore: best?.semanticVectorScore || 0,
        relationScore: best?.relationScore || 0,
        matchedQueries: scored.filter((item) => item.total >= Math.max(3, (best?.total || 0) * 0.75)).map((item) => item.query),
        matchedTerms: [...new Set(expandedTokens(best?.query || "").filter((token) => document.tokens.includes(token)))],
      };
    })
    .filter((candidate) => candidate.score > 1)
    .sort((left, right) => right.score - left.score || right.document.policy.authority - left.document.policy.authority || left.document.decision.id.localeCompare(right.document.decision.id))
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

function blockedMatches(plan: V4SystemicQueryPlan) {
  return plan.needs.flatMap((need) => {
    // A model-generated retrieval expansion may improve document recall, but it
    // must never create a governance conflict that the user's actual need did
    // not ask about. Open-conflict matching therefore uses only the atomic need
    // text. This keeps a search expansion such as "PIF before Miami filming"
    // from blocking an unrelated custom-payment-plan decision.
    const queryTerms = [...new Set(tokens(need.text))];
    const structured = structuredNeedTerms(need);
    return getV4SystemicBlockedTopics()
      .flatMap((topic) => {
        const families = topic.question_families || [];
        const topicText = [
          ...families,
          ...(topic.domains || []),
          ...(topic.actions || []),
          ...(topic.entities || []),
        ].join(" ");
        if (v4SystemicDecisionObjectErrors(need.authorityText || need.originalRequestText || need.text, topicText).length) return [];
        const topicRelations = [...new Set(families.map(inferV4SystemicRelation).filter((relation) => relation !== "other"))];
        if (topicRelations.length && need.relation !== "other") {
          const compatibility = v4SystemicRelationCompatibility(need.relation, topicRelations);
          if (compatibility !== "exact" && compatibility !== "compatible") return [];
        }
        if (
          need.productScope !== "unknown" &&
          need.productScope !== "comparison" &&
          !(topic.product_scopes || []).some((scope) =>
            scope === need.productScope || scope === "product_agnostic" || scope === "unknown",
          )
        ) return [];
        const familyTokens = families.map((family) => tokens(family));
        const familyScore = Math.max(0, ...familyTokens.map((family) => Math.max(overlap(queryTerms, family), overlap(family, queryTerms))));
        const topicStructured = [
          ...(topic.domains || []),
          ...(topic.actions || []),
          ...(topic.entities || []),
        ].flatMap(tokens);
        const structuredScore = Math.max(overlap(structured, topicStructured), overlap(topicStructured, structured));
        const topicTerms = [...new Set([
          ...families,
          ...(topic.domains || []),
          ...(topic.actions || []),
          ...(topic.entities || []),
        ].flatMap(tokens))];
        const matchedTerms = queryTerms.filter((term) => topicTerms.includes(term));
        const distinctiveMatchedTerms = matchedTerms.filter((term) => !GENERIC_BLOCKED_MATCH_TERMS.has(term));
        // Open conflicts need a match to the conflict's actual question
        // signature, not only generic entities/actions copied into its index.
        // This prevents "social media" from matching "Media Pack review" and
        // an ACH/sign-up sentence from matching a Mastermind fee conflict.
        const signatureTerms = [...new Set(families.flatMap(tokens)
          .filter((term) => !GENERIC_BLOCKED_MATCH_TERMS.has(term)))];
        const signatureMatchedTerms = queryTerms.filter((term) => signatureTerms.includes(term));
        const score = familyScore * 0.75 + structuredScore * 0.25;
        const exactEnough = matchedTerms.length >= 2 && distinctiveMatchedTerms.length >= 1 && (
          (signatureMatchedTerms.length >= 2 && familyScore >= 0.35) ||
          (signatureMatchedTerms.length >= 1 && familyScore >= 0.7) ||
          (familyScore >= 0.92 && structuredScore >= 0.5)
        );
        return exactEnough ? [{ needId: need.id, topicId: topic.id, score, matchedTerms }] : [];
      })
      .sort((left, right) => right.score - left.score)
      .slice(0, 4);
  });
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
      const existingNeedScore = existing?.needScores?.[need.id];
      const candidateIsBestAtom = !existingNeedScore || candidate.score > existingNeedScore.score;
      const next = {
        policy: candidate.document.policy,
        score: Math.max(existing?.score || 0, candidate.score) + (existing?.reciprocal || 0) + reciprocal,
        matchedQueries: [...new Set([...(existing?.matchedQueries || []), ...candidate.matchedQueries])],
        matchedTerms: [...new Set([...(existing?.matchedTerms || []), ...candidate.matchedTerms])],
        lexicalScore: Math.max(existing?.lexicalScore || 0, candidate.lexicalScore),
        familyScore: Math.max(existing?.familyScore || 0, candidate.familyScore),
        characterScore: Math.max(existing?.characterScore || 0, candidate.characterScore),
        structuredScore: Math.max(existing?.structuredScore || 0, candidate.structuredScore),
        semanticVectorScore: Math.max(existing?.semanticVectorScore || 0, candidate.semanticVectorScore),
        authorityScore: Math.min(2, candidate.document.policy.authority / 5),
        relationScore: Math.max(existing?.relationScore ?? Number.NEGATIVE_INFINITY, candidate.relationScore),
        matchedDecisionId: candidateIsBestAtom ? candidate.document.decision.id : existing?.matchedDecisionId,
        matchedDecisionText: candidateIsBestAtom ? v4AtomicDecisionEvidence(candidate.document.decision) : existing?.matchedDecisionText,
        needScores: {
          ...(existing?.needScores || {}),
          ...(candidateIsBestAtom ? { [need.id]: {
            score: candidate.score,
            rank: index + 1,
            lexicalScore: candidate.lexicalScore,
            familyScore: candidate.familyScore,
            characterScore: candidate.characterScore,
            structuredScore: candidate.structuredScore,
            semanticVectorScore: candidate.semanticVectorScore,
            relationScore: candidate.relationScore,
            matchedDecisionId: candidate.document.decision.id,
            matchedDecisionText: v4AtomicDecisionEvidence(candidate.document.decision),
          } } : {}),
        },
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
  // A matching claim-scoped authority resolution is an enforced source
  // contract. Its controlling cards must survive the global source-balance
  // cap even when a broad topic produces many higher lexical scores. Without
  // this guarantee, one half of a multi-source decision can disappear before
  // source adjudication despite the authority register explicitly requiring
  // it.
  const controllingPolicyIds = new Set(plan.needs.flatMap((need) =>
    matchingV4SystemicAuthorityResolutions(need).flatMap((resolution) => resolution.controlling_policy_ids),
  ));
  const forcedControlling = deduplicated
    .filter((candidate) => controllingPolicyIds.has(candidate.policy.id))
    .sort((left, right) => right.score - left.score || right.policy.authority - left.policy.authority);
  const forcedIds = new Set(forcedControlling.map((candidate) => candidate.policy.id));
  const selected = [
    ...forcedControlling,
    ...balanced.filter((candidate) => !forcedIds.has(candidate.policy.id)),
  ].slice(0, Math.max(limit, forcedControlling.length));
  const candidates = selected
    .map((candidate, index): V4SystemicCandidate => {
      const { reciprocal, ...rankedCandidate } = candidate;
      void reciprocal;
      return {
        ...rankedCandidate,
        rank: index + 1,
      };
    });

  const perNeedBlockedMatches = blockedMatches(plan);
  return {
    query: turn.standaloneQuestion,
    turn,
    corpusSize: corpus.length,
    candidates,
    blockedTopicIds: [...new Set(perNeedBlockedMatches.map((match) => match.topicId))],
    blockedMatches: perNeedBlockedMatches,
    stageTimings: { systemicRetrievalMs: Date.now() - startedAt },
  };
}

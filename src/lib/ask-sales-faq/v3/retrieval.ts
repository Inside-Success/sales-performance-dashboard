import registryJson from "@/lib/ask-sales-faq/generated/v3-policy-registry.json";
import type {
  V3BlockedMatch,
  V3Policy,
  V3PolicyMatch,
  V3PolicyRegistry,
  V3RetrievalResult,
  V3TurnResolution,
} from "@/lib/ask-sales-faq/v3/types";

const registry = registryJson as V3PolicyRegistry;
const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "but", "by", "can", "could", "do", "does", "for", "from",
  "had", "has", "have", "how", "i", "if", "in", "is", "it", "me", "my", "of", "on", "or", "our", "should", "that",
  "the", "their", "them", "then", "this", "to", "was", "we", "were", "what", "when", "where", "which", "who", "will",
  "with", "would", "you", "your",
]);
const QUALITY_WEIGHT: Record<V3Policy["quality_tier"], number> = {
  canonical: 1.18,
  supporting: 1.08,
  trusted_evidence: 1,
  contextual_evidence: 0.82,
  discovery_only: 0,
};

function normalize(value: string) {
  return value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9#$]+/g, " ").replace(/\s+/g, " ").trim();
}

function stem(token: string) {
  if (token.length > 5 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.length > 5 && /(?:ches|shes|xes|zes|ses)$/.test(token)) return token.slice(0, -2);
  if (token.length > 5 && token.endsWith("ing")) return token.slice(0, -3);
  if (token.length > 4 && token.endsWith("ed")) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith("s") && !/(?:ss|us|is)$/.test(token)) return token.slice(0, -1);
  return token;
}

function tokens(value: string) {
  return normalize(value).split(" ").filter((token) => token.length > 1 && !STOPWORDS.has(token)).map(stem);
}

function trigrams(value: string) {
  const compact = `  ${normalize(value)}  `;
  const result = new Set<string>();
  for (let index = 0; index <= compact.length - 3; index += 1) result.add(compact.slice(index, index + 3));
  return result;
}

type IndexedPolicy = {
  policy: V3Policy;
  tokenCounts: Map<string, number>;
  length: number;
  trigrams: Set<string>;
  normalizedFamilies: string[];
};

const indexedPolicies: IndexedPolicy[] = registry.policies.map((policy) => {
  const policyTokens = tokens(policy.search_text);
  const tokenCounts = new Map<string, number>();
  for (const token of policyTokens) tokenCounts.set(token, (tokenCounts.get(token) || 0) + 1);
  return {
    policy,
    tokenCounts,
    length: Math.max(1, policyTokens.length),
    trigrams: trigrams(`${policy.title} ${policy.question_families.join(" ")}`),
    normalizedFamilies: policy.question_families.map(normalize).filter(Boolean),
  };
});

const documentFrequency = new Map<string, number>();
for (const indexed of indexedPolicies) {
  for (const token of indexed.tokenCounts.keys()) documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1);
}
const averageLength = indexedPolicies.reduce((total, indexed) => total + indexed.length, 0) / Math.max(1, indexedPolicies.length);

function bm25(queryTokens: string[], indexed: IndexedPolicy) {
  let score = 0;
  const k1 = 1.25;
  const b = 0.72;
  for (const token of new Set(queryTokens)) {
    const frequency = indexed.tokenCounts.get(token) || 0;
    if (!frequency) continue;
    const df = documentFrequency.get(token) || 0;
    const idf = Math.log(1 + (indexedPolicies.length - df + 0.5) / (df + 0.5));
    score += idf * ((frequency * (k1 + 1)) / (frequency + k1 * (1 - b + b * (indexed.length / averageLength))));
  }
  return score;
}

function trigramSimilarity(query: Set<string>, target: Set<string>) {
  if (!query.size || !target.size) return 0;
  let overlap = 0;
  for (const gram of query) if (target.has(gram)) overlap += 1;
  return overlap / Math.max(1, Math.min(query.size, target.size));
}

function phraseScore(query: string, indexed: IndexedPolicy) {
  const normalizedQuery = normalize(query);
  let best = 0;
  for (const family of indexed.normalizedFamilies) {
    if (!family) continue;
    if (normalizedQuery.includes(family) || family.includes(normalizedQuery)) best = Math.max(best, 12);
    const familyTokens = new Set(tokens(family));
    const queryTokens = new Set(tokens(normalizedQuery));
    let overlap = 0;
    for (const token of queryTokens) if (familyTokens.has(token)) overlap += 1;
    best = Math.max(best, (overlap / Math.max(1, Math.min(queryTokens.size, familyTokens.size))) * 8);
  }
  return best;
}

function scopeScore(policy: V3Policy, turn: V3TurnResolution) {
  const scopes = policy.product_scopes || ["product_agnostic"];
  if (turn.excludedScopes.some((scope) => scopes.includes(scope))) return -100;
  if (turn.productScope === "comparison") return scopes.includes("main_istv") || scopes.includes("dj_nlceo") ? 4 : 1;
  if (turn.productScope === "main_istv") {
    if (scopes.includes("dj_nlceo") && !scopes.includes("main_istv")) return -100;
    return scopes.includes("main_istv") ? 6 : scopes.includes("product_agnostic") ? 1 : 0;
  }
  if (turn.productScope === "dj_nlceo") {
    if (scopes.includes("main_istv") && !scopes.includes("dj_nlceo")) return -100;
    return scopes.includes("dj_nlceo") ? 6 : scopes.includes("product_agnostic") ? 1 : 0;
  }
  return scopes.includes("product_agnostic") ? 1 : 0;
}

function queryForRetrieval(turn: V3TurnResolution) {
  if (turn.kind !== "follow_up") return turn.standaloneQuestion;
  // The current follow-up is repeated so it remains the dominant signal while
  // the immediate antecedent supplies the missing referent.
  return `${turn.currentQuestion}\n${turn.currentQuestion}\n${turn.standaloneQuestion}`;
}

function mentionedEntities(question: string, turn?: V3TurnResolution) {
  const normalizedQuestion = normalize(question);
  return registry.entity_catalog.filter((entity) => {
    if (!normalizedQuestion.includes(normalize(entity))) return false;
    if (turn?.excludedScopes.includes("dj_nlceo") && ["next level ceo", "daymond john"].includes(entity)) return false;
    return true;
  });
}

function retrieveBlocked(query: string, queryTokens: string[], turn: V3TurnResolution): V3BlockedMatch[] {
  const querySet = new Set(queryTokens);
  return registry.blocked_topics
    .map((topic) => {
      const searchable = normalize([
        topic.id,
        topic.resolution,
        ...(topic.blocked_topic_ids || []),
        ...(topic.question_families || []),
        ...(topic.domains || []),
        ...(topic.actions || []),
        ...(topic.entities || []),
      ].filter(Boolean).join(" "));
      const topicTokens = new Set(tokens(searchable));
      const matchedTerms = Array.from(querySet).filter((token) => topicTokens.has(token));
      const scopeMismatch = turn.excludedScopes.some((scope) => topic.product_scopes?.includes(scope));
      const score = scopeMismatch ? 0 : matchedTerms.reduce((total, token) => total + (token.length >= 7 ? 2 : 1), 0);
      return { topic, score, matchedTerms };
    })
    .filter((match) => match.matchedTerms.length >= 2 && match.score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

export function retrieveV3Policies(turn: V3TurnResolution, limit = 12): V3RetrievalResult {
  const startedAt = Date.now();
  const query = queryForRetrieval(turn);
  const queryTokens = tokens(query);
  const queryTrigrams = trigrams(turn.currentQuestion);
  const requiredEntities = mentionedEntities(turn.currentQuestion, turn);
  const matches: V3PolicyMatch[] = [];

  for (const indexed of indexedPolicies) {
    if (indexed.policy.quality_tier === "discovery_only" || indexed.policy.answerability === "discovery_only") continue;
    const candidateEntities = mentionedEntities(indexed.policy.search_text);
    if (requiredEntities.length && candidateEntities.length && !requiredEntities.some((entity) => candidateEntities.includes(entity))) continue;
    const scoped = scopeScore(indexed.policy, turn);
    if (scoped <= -100) continue;
    const lexical = bm25(queryTokens, indexed);
    const phrase = phraseScore(turn.currentQuestion, indexed);
    const trigram = trigramSimilarity(queryTrigrams, indexed.trigrams) * 7;
    const matchedTerms = Array.from(new Set(queryTokens)).filter((token) => indexed.tokenCounts.has(token));
    const rareMatches = matchedTerms.filter((token) => token.length >= 5 && (documentFrequency.get(token) || 0) <= 12);
    if (matchedTerms.length < 2 && rareMatches.length === 0 && phrase < 5 && trigram < 2.6) continue;
    const authority = Math.min(6, indexed.policy.authority / 20);
    const answerabilityBonus = indexed.policy.answerability === "answer_evidence" ? 2 : 0;
    const rareIntentBonus = rareMatches.length * 18;
    const raw = lexical * 3.2 + phrase + trigram + scoped + authority + answerabilityBonus + rareIntentBonus;
    const score = raw * QUALITY_WEIGHT[indexed.policy.quality_tier];
    matches.push({
      policy: indexed.policy,
      score: Math.round(score * 100) / 100,
      lexicalScore: Math.round(lexical * 100) / 100,
      phraseScore: Math.round(phrase * 100) / 100,
      trigramScore: Math.round(trigram * 100) / 100,
      scopeScore: scoped,
      matchedTerms: matchedTerms.slice(0, 16),
    });
  }

  matches.sort((a, b) => b.score - a.score || b.policy.authority - a.policy.authority || a.policy.id.localeCompare(b.policy.id));
  const deduped: V3PolicyMatch[] = [];
  const policyKeys = new Set<string>();
  for (const match of matches) {
    const key = `${match.policy.policy_key}:${match.policy.product_scopes.join(",")}`;
    if (policyKeys.has(key)) continue;
    policyKeys.add(key);
    deduped.push(match);
    if (deduped.length >= limit) break;
  }

  return {
    query,
    candidates: deduped,
    blocked: retrieveBlocked(query, queryTokens, turn),
    queryTokens,
    stageTimings: { retrievalMs: Date.now() - startedAt },
  };
}

export function getV3Registry() {
  return registry;
}

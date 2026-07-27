import type { V3TurnResolution } from "@/lib/ask-sales-faq/v3/types";
import type {
  V4SystemicCandidate,
  V4SystemicNeed,
  V4SystemicPolicy,
  V4SystemicQueryPlan,
  V4SystemicRetrieval,
} from "@/lib/ask-sales-faq/v4/systemic/types";
import { getV5KnowledgeSnapshot } from "@/lib/ask-sales-faq/v5/knowledge";
import { V57_SOURCE_REVIEWED_POLICIES } from "@/lib/ask-sales-faq/v5-7/knowledge";
import { retrieveV57Policies } from "@/lib/ask-sales-faq/v5-7/retrieval";

const MEDIA_SUBTYPES = [
  { id: "episode", pattern: /\b(?:episodes?|tv\s+shows?|television\s+shows?)\b/i },
  { id: "podcast", pattern: /\b(?:podcasts?|spotify|apple\s+podcasts?)\b/i },
  { id: "social", pattern: /\b(?:social\s+media|instagram|facebook|reels?|social\s+post)\b/i },
  { id: "twenty_percent_calls", pattern: /\b(?:20\s*%|20\s+percent|twenty\s+percent|dial[- ]out\s+list)\b/i },
  { id: "call_two", pattern: /\b(?:call\s*2|call\s+two|second\s+calls?)\b/i },
  { id: "rescheduled_call", pattern: /\b(?:rescheduled?|rebooked?)\s+calls?\b/i },
  { id: "double_booking", pattern: /\b(?:double[- ]book(?:ed|ing)?|duplicate\s+bookings?)\b/i },
] as const;

const policyById = new Map([
  ...getV5KnowledgeSnapshot().policies,
  ...V57_SOURCE_REVIEWED_POLICIES,
].map((policy) => [policy.id, policy]));

const FAMILY_STOPWORDS = new Set(["a", "an", "and", "are", "as", "at", "be", "but", "by", "can", "do", "does", "for", "from", "how", "i", "if", "in", "is", "it", "may", "of", "on", "or", "should", "that", "the", "their", "them", "they", "this", "to", "what", "when", "where", "which", "with"]);

function normalizedWords(value: string, keepStops = false) {
  return value.toLowerCase().replace(/[^a-z0-9%]+/g, " ").split(/\s+/).filter((token) =>
    token.length >= 2 && (keepStops || !FAMILY_STOPWORDS.has(token)));
}

function bigrams(value: string) {
  const words = normalizedWords(value, true);
  return new Set(words.slice(1).map((word, index) => `${words[index]} ${word}`));
}

function familyRecallScore(question: string, policy: V4SystemicPolicy) {
  const queryWords = new Set(normalizedWords(question));
  const queryBigrams = bigrams(question);
  return Math.max(0, ...policy.question_families.map((family) => {
    const familyWords = new Set(normalizedWords(family));
    const contentOverlap = [...familyWords].filter((token) => queryWords.has(token)).length;
    const sharedBigrams = [...bigrams(family)].filter((pair) => queryBigrams.has(pair)).length;
    if (sharedBigrams < 2 && (contentOverlap < 3 || contentOverlap / Math.max(1, Math.min(queryWords.size, familyWords.size)) < 0.35)) return 0;
    return sharedBigrams * 20 + contentOverlap * 6;
  }));
}

function familyRecallCandidate(policy: V4SystemicPolicy, need: V4SystemicNeed, score: number, globalRank: number): V4SystemicCandidate {
  const needScore = {
    score: 180 + score,
    rank: 0.9,
    lexicalScore: score,
    familyScore: score,
    characterScore: 0,
    structuredScore: 8,
    semanticVectorScore: 0,
    relationScore: 8,
    matchedDecisionId: `${policy.id}::v58-question-family-recall`,
    matchedDecisionText: policy.decision,
  };
  return {
    policy,
    rank: globalRank,
    score: needScore.score,
    matchedQueries: [need.authorityText || need.text],
    matchedTerms: policy.question_families,
    lexicalScore: needScore.lexicalScore,
    familyScore: needScore.familyScore,
    characterScore: 0,
    structuredScore: needScore.structuredScore,
    authorityScore: Math.min(3, policy.authority / 4),
    relationScore: needScore.relationScore,
    semanticVectorScore: 0,
    matchedDecisionId: needScore.matchedDecisionId,
    matchedDecisionText: policy.decision,
    needScores: { [need.id]: needScore },
  };
}

function needText(need: V4SystemicNeed) {
  return [need.authorityText, need.originalRequestText, need.text, ...need.retrievalQueries, ...need.entities]
    .filter(Boolean)
    .join(" ");
}

function policyText(policy: V4SystemicPolicy) {
  return [policy.title, policy.decision, policy.search_text, ...policy.question_families, ...policy.entities]
    .filter(Boolean)
    .join(" ");
}

export function hasV58EntitySubtypeMismatch(need: V4SystemicNeed, policy: V4SystemicPolicy) {
  const requested = MEDIA_SUBTYPES.filter((facet) => facet.pattern.test(needText(need))).map((facet) => facet.id);
  const evidenced = MEDIA_SUBTYPES.filter((facet) => facet.pattern.test(policyText(policy))).map((facet) => facet.id);
  return requested.length > 0 && evidenced.length > 0 && !requested.some((facet) => evidenced.includes(facet));
}

/**
 * V5.8 preserves V5.7 recall but removes need-level matches whose explicit
 * content subtype conflicts with the question. This is a relationship guard,
 * not a topic or policy-ID patch.
 */
export function retrieveV58Policies(
  turn: V3TurnResolution,
  plan: V4SystemicQueryPlan,
): V4SystemicRetrieval {
  const base = retrieveV57Policies(turn, plan);
  const byId = new Map(base.candidates.map((candidate) => [candidate.policy.id, candidate]));
  let familyRecallMatches = 0;
  for (const need of plan.needs) {
    const question = need.authorityText || need.originalRequestText || need.text;
    const matches = [...policyById.values()]
      .map((policy) => ({ policy, score: familyRecallScore(question, policy) }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score || right.policy.authority - left.policy.authority)
      .slice(0, 8);
    for (const match of matches) {
      const recalled = familyRecallCandidate(match.policy, need, match.score, base.candidates.length + familyRecallMatches + 1);
      const existing = byId.get(match.policy.id);
      byId.set(match.policy.id, existing ? {
        ...existing,
        matchedQueries: [...new Set([...existing.matchedQueries, ...recalled.matchedQueries])],
        needScores: { ...(existing.needScores || {}), ...recalled.needScores },
      } : recalled);
      familyRecallMatches += 1;
    }
  }
  let excludedEntitySubtypeMatches = 0;
  const candidates = [...byId.values()].flatMap((candidate) => {
    const needScores = { ...(candidate.needScores || {}) };
    for (const need of plan.needs) {
      if (!needScores[need.id] || !hasV58EntitySubtypeMismatch(need, candidate.policy)) continue;
      delete needScores[need.id];
      excludedEntitySubtypeMatches += 1;
    }
    return Object.keys(needScores).length ? [{ ...candidate, needScores }] : [];
  });

  return {
    ...base,
    candidates,
    diagnostics: base.diagnostics ? {
      ...base.diagnostics,
      snapshotVersion: `${base.diagnostics.snapshotVersion}+v58-entity-subtype`,
      needs: base.diagnostics.needs.map((diagnostic) => ({
        ...diagnostic,
        selectedPolicyIds: candidates
          .filter((candidate) => candidate.needScores?.[diagnostic.needId])
          .map((candidate) => candidate.policy.id),
      })),
    } : base.diagnostics,
    stageTimings: {
      ...base.stageTimings,
      v58EntitySubtypeExclusions: excludedEntitySubtypeMatches,
      v58QuestionFamilyRecallMatches: familyRecallMatches,
    },
  };
}

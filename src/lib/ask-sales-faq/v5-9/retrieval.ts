import type { V3TurnResolution } from "@/lib/ask-sales-faq/v3/types";
import type {
  V4SystemicCandidate,
  V4SystemicNeed,
  V4SystemicPolicy,
  V4SystemicQueryPlan,
  V4SystemicRetrieval,
} from "@/lib/ask-sales-faq/v4/systemic/types";
import { getV4SystemicCorpus } from "@/lib/ask-sales-faq/v4/systemic/corpus";
import { getV5KnowledgeSnapshot } from "@/lib/ask-sales-faq/v5/knowledge";
import { v54MaterialEffectsConflict } from "@/lib/ask-sales-faq/v5/consensus";
import { V57_SOURCE_REVIEWED_POLICIES } from "@/lib/ask-sales-faq/v5-7/knowledge";
import { hasV58EntitySubtypeMismatch, retrieveV58Policies } from "@/lib/ask-sales-faq/v5-8/retrieval";

const STOPWORDS = new Set([
  "about", "after", "also", "and", "are", "because", "before", "but", "can", "could", "does", "for", "from", "have",
  "into", "just", "may", "should", "that", "the", "their", "them", "they", "this", "what", "when", "where", "which", "with", "would",
]);

const SCENARIO_SUBTYPES = [
  { id: "emergency", pattern: /\b(?:emergenc(?:y|ies)|catastroph(?:e|ic)|car\s+crash|death\s+in\s+the\s+family|hospitali[sz]ed|er\s+visit|serious\s+(?:illness|injury))\b/i },
  { id: "vip_value", pattern: /\b(?:vip|high[- ]value|top\s+prospect|celebrity)\b/i },
  { id: "technical_error", pattern: /\b(?:technical\s+(?:error|issue)|link\s+(?:failed|broken|expired)|system\s+(?:error|issue)|double[- ]book(?:ed|ing))\b/i },
  { id: "fund_access", pattern: /\b(?:access(?:ing)?\s+(?:their\s+)?funds?|funds?\s+(?:access|availability)|cash[- ]flow|money\s+transfer)\b/i },
] as const;

const policyById = new Map([
  ...getV4SystemicCorpus(),
  ...getV5KnowledgeSnapshot().policies,
  ...V57_SOURCE_REVIEWED_POLICIES,
].map((policy) => [policy.id, policy]));

function stem(token: string) {
  if (token.length > 6 && token.endsWith("ing")) return token.slice(0, -3);
  if (token.length > 5 && token.endsWith("ed")) return token.slice(0, -2);
  if (token.length > 4 && token.endsWith("s")) return token.slice(0, -1);
  return token;
}

function words(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9%]+/g, " ").split(/\s+/)
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token))
    .map(stem);
}

function recallScore(question: string, policy: V4SystemicPolicy) {
  const query = new Set(words(question));
  const policyTokens = new Set(words([policy.title, ...policy.question_families, policy.decision].join(" ")));
  const overlap = [...query].filter((token) => policyTokens.has(token));
  const ratio = overlap.length / Math.max(1, Math.min(query.size, policyTokens.size));
  if (overlap.length < 3 || ratio < 0.3) return 0;
  return overlap.length * 10 + Math.round(ratio * 20);
}

function needRecallScore(need: V4SystemicNeed, policy: V4SystemicPolicy) {
  const questions = [...new Set([need.authorityText, need.originalRequestText, need.text]
    .filter((question): question is string => Boolean(question)))];
  return Math.max(0, ...questions.map((question) => recallScore(question, policy)));
}

function scenarioSubtypeMismatch(need: V4SystemicNeed, policy: V4SystemicPolicy) {
  const needText = [need.authorityText, need.originalRequestText, need.text, ...need.retrievalQueries].filter(Boolean).join(" ");
  const policyText = [policy.title, ...policy.question_families, policy.decision].join(" ");
  const requested = SCENARIO_SUBTYPES.filter((facet) => facet.pattern.test(needText)).map((facet) => facet.id);
  const evidenced = SCENARIO_SUBTYPES.filter((facet) => facet.pattern.test(policyText)).map((facet) => facet.id);
  return requested.length > 0 && evidenced.length > 0 && !requested.some((facet) => evidenced.includes(facet));
}

function authorityTier(policy: V4SystemicPolicy) {
  const names = policy.source.approved_by.join(" ").toLowerCase();
  if (/\b(?:rich|mike|rudy)\b/.test(names)) return 3;
  if (/\braul\b/.test(names)) return 2;
  if (/\bmadeline\b/.test(names)) return 1;
  return 0;
}

function effectiveTime(policy: V4SystemicPolicy) {
  const value = Date.parse(policy.effective_at || policy.last_reviewed || "");
  return Number.isFinite(value) ? value : 0;
}

function sameDecisionArea(left: V4SystemicPolicy, right: V4SystemicPolicy) {
  const leftWords = new Set(words([left.title, ...left.question_families, left.decision].join(" ")));
  const rightWords = new Set(words([right.title, ...right.question_families, right.decision].join(" ")));
  const overlap = [...leftWords].filter((token) => rightWords.has(token)).length;
  return overlap >= 3 && overlap / Math.max(1, Math.min(leftWords.size, rightWords.size)) >= 0.2;
}

function directActionConflict(left: V4SystemicPolicy, right: V4SystemicPolicy) {
  if (v54MaterialEffectsConflict(left.decision, right.decision)) return true;
  const positiveReschedule = /\b(?:rebook|reschedul)\w*\b[\s\S]{0,70}\b(?:correct|should|required|must|yes)\b|\b(?:yes|should|must)\b[\s\S]{0,70}\b(?:rebook|reschedul)\w*\b/i;
  const negativeReschedule = /\b(?:conduct|keep)\b[\s\S]{0,50}\bcall\b[\s\S]{0,30}\bas\s+is\b|\b(?:rebook|reschedul)\w*\b[\s\S]{0,35}\b(?:not\s+necessary|do\s+not|don't|should\s+not)\b/i;
  return (positiveReschedule.test(left.decision) && negativeReschedule.test(right.decision)) ||
    (positiveReschedule.test(right.decision) && negativeReschedule.test(left.decision));
}

function dominatedConflictIds(candidates: V4SystemicCandidate[], need: V4SystemicNeed) {
  const relevant = candidates
    .filter((candidate) => candidate.needScores?.[need.id] && candidate.needScores![need.id].rank <= 1)
    .sort((left, right) => right.needScores![need.id].score - left.needScores![need.id].score)
    .slice(0, 20);
  const dominated = new Set<string>();
  for (const winner of relevant) {
    for (const loser of relevant) {
      if (winner.policy.id === loser.policy.id || dominated.has(loser.policy.id)) continue;
      if (!sameDecisionArea(winner.policy, loser.policy) || !directActionConflict(winner.policy, loser.policy)) continue;
      if (authorityTier(winner.policy) <= authorityTier(loser.policy)) continue;
      if (effectiveTime(winner.policy) < effectiveTime(loser.policy)) continue;
      if (needRecallScore(need, winner.policy) < needRecallScore(need, loser.policy)) continue;
      dominated.add(loser.policy.id);
    }
  }
  return dominated;
}

function recalledCandidate(policy: V4SystemicPolicy, need: V4SystemicNeed, score: number, rank: number): V4SystemicCandidate {
  const needScore = {
    score: 200 + score,
    rank: 0.85,
    lexicalScore: score,
    familyScore: score,
    characterScore: 0,
    structuredScore: 8,
    semanticVectorScore: 0,
    relationScore: 8,
    matchedDecisionId: `${policy.id}::v59-title-record-recall`,
    matchedDecisionText: policy.decision,
  };
  return {
    policy,
    rank,
    score: needScore.score,
    matchedQueries: [need.authorityText || need.text],
    matchedTerms: [policy.title, ...policy.question_families],
    lexicalScore: score,
    familyScore: score,
    characterScore: 0,
    structuredScore: 8,
    authorityScore: Math.min(3, policy.authority / 4),
    relationScore: 8,
    semanticVectorScore: 0,
    matchedDecisionId: needScore.matchedDecisionId,
    matchedDecisionText: policy.decision,
    needScores: { [need.id]: needScore },
  };
}

export function retrieveV59Policies(
  turn: V3TurnResolution,
  plan: V4SystemicQueryPlan,
): V4SystemicRetrieval {
  const base = retrieveV58Policies(turn, plan);
  const byId = new Map(base.candidates.map((candidate) => [candidate.policy.id, candidate]));
  let recallMatches = 0;
  for (const need of plan.needs) {
    const matches = [...policyById.values()]
      .filter((policy) => !hasV58EntitySubtypeMismatch(need, policy))
      .map((policy) => ({ policy, score: needRecallScore(need, policy) }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score || right.policy.authority - left.policy.authority)
      .slice(0, 16);
    for (const match of matches) {
      const recalled = recalledCandidate(match.policy, need, match.score, base.candidates.length + recallMatches + 1);
      const existing = byId.get(match.policy.id);
      byId.set(match.policy.id, existing ? {
        ...existing,
        matchedQueries: [...new Set([...existing.matchedQueries, ...recalled.matchedQueries])],
        needScores: { ...(existing.needScores || {}), ...recalled.needScores },
      } : recalled);
      recallMatches += 1;
    }
  }
  let excludedScenarioSubtypeMatches = 0;
  const dominatedByNeed = new Map(plan.needs.map((need) => [need.id, dominatedConflictIds([...byId.values()], need)]));
  let excludedAuthorityConflictMatches = 0;
  const candidates = [...byId.values()].flatMap((candidate) => {
    const needScores = { ...(candidate.needScores || {}) };
    for (const need of plan.needs) {
      if (!needScores[need.id] || !scenarioSubtypeMismatch(need, candidate.policy)) continue;
      delete needScores[need.id];
      excludedScenarioSubtypeMatches += 1;
    }
    for (const need of plan.needs) {
      if (!needScores[need.id] || !dominatedByNeed.get(need.id)?.has(candidate.policy.id)) continue;
      delete needScores[need.id];
      excludedAuthorityConflictMatches += 1;
    }
    return Object.keys(needScores).length ? [{ ...candidate, needScores }] : [];
  });
  return {
    ...base,
    candidates,
    diagnostics: base.diagnostics ? {
      ...base.diagnostics,
      snapshotVersion: `${base.diagnostics.snapshotVersion}+v59-title-record-recall`,
      needs: base.diagnostics.needs.map((diagnostic) => ({
        ...diagnostic,
        selectedPolicyIds: candidates.filter((candidate) => candidate.needScores?.[diagnostic.needId]).map((candidate) => candidate.policy.id),
      })),
    } : base.diagnostics,
    stageTimings: {
      ...base.stageTimings,
      v59TitleRecordRecallMatches: recallMatches,
      v59ScenarioSubtypeExclusions: excludedScenarioSubtypeMatches,
      v59AuthorityConflictExclusions: excludedAuthorityConflictMatches,
    },
  };
}

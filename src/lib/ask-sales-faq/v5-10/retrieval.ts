import { getV4SystemicCorpus } from "@/lib/ask-sales-faq/v4/systemic/corpus";
import type {
  V4SystemicCandidate,
  V4SystemicNeed,
  V4SystemicPolicy,
  V4SystemicQueryPlan,
  V4SystemicRetrieval,
} from "@/lib/ask-sales-faq/v4/systemic/types";
import type { V3TurnResolution } from "@/lib/ask-sales-faq/v3/types";
import { getV5KnowledgeSnapshot } from "@/lib/ask-sales-faq/v5/knowledge";
import { V57_SOURCE_REVIEWED_POLICIES } from "@/lib/ask-sales-faq/v5-7/knowledge";
import { retrieveV59Policies } from "@/lib/ask-sales-faq/v5-9/retrieval";

export type V510DecisionFamily =
  | "missing_intake_call1"
  | "missed_call2_reapplication"
  | "non_english_casting"
  | "content_reuse_boundary";

const corpus = [...new Map([
  ...getV4SystemicCorpus(),
  ...getV5KnowledgeSnapshot().policies,
  ...V57_SOURCE_REVIEWED_POLICIES,
].map((policy) => [policy.id, policy])).values()];

const STOPWORDS = new Set([
  "about", "after", "again", "also", "and", "are", "because", "before", "but", "can", "could", "does", "for",
  "from", "have", "into", "just", "may", "should", "that", "the", "their", "them", "they", "this", "what",
  "when", "where", "which", "with", "would",
]);

function words(value: string) {
  return [...new Set(value.toLowerCase().replace(/[^a-z0-9%]+/g, " ").split(/\s+/)
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token)))];
}

function completeNeedText(need: V4SystemicNeed) {
  return [need.authorityText, need.originalRequestText, need.text, ...need.retrievalQueries, ...need.domains, ...need.actions, ...need.entities]
    .filter(Boolean)
    .join(" ");
}

function policyText(policy: V4SystemicPolicy) {
  return [policy.title, ...policy.question_families, policy.decision, policy.search_text, ...policy.actions, ...policy.entities]
    .filter(Boolean)
    .join(" ");
}

/**
 * These are stable business-decision families, not benchmark-question matches.
 * Each family is activated only when the immutable user request supplies all
 * material facts needed to distinguish it from a commonly confused sibling.
 */
export function v510DecisionFamilyForNeed(need: V4SystemicNeed): V510DecisionFamily | null {
  const text = completeNeedText(need);
  const missingIntake = /\b(?:blank|missing|incomplete|not\s+filled|didn['’]?t\s+fill)\b[\s\S]{0,90}\b(?:application|applicant\s+(?:details|info)|details|information|type\s*form|typeform)\b|\b(?:application|details|information|type\s*form|typeform)\b[\s\S]{0,90}\b(?:blank|missing|incomplete|not\s+filled)\b/i.test(text);
  if (missingIntake && /\bcall\s*1\b|\bfirst\s+(?:call|audition)\b/i.test(text) && /\b(?:cancel|proceed|keep|run|conduct)\b/i.test(text)) {
    return "missing_intake_call1";
  }

  const missed = /\b(?:miss(?:ed|ing)|no[- ]?show(?:ed|ing)?)\b/i.test(text);
  if (missed && /\bcall\s*2\b|\bsecond\s+call\b/i.test(text) && /\b(?:appointment|rebook|reschedul|reapply|keep|next\s+day|tomorrow)\b/i.test(text)) {
    return "missed_call2_reapplication";
  }

  const cannotSpeakEnglish = /\b(?:does\s+not|doesn['’]?t|cannot|can['’]?t|unable\s+to)\s+speak\s+english\b|\bnon[- ]english[- ]speaking\b/i.test(text);
  if (cannotSpeakEnglish && /\b(?:audition|cast|casting|eligible|qualif)\w*\b/i.test(text)) {
    return "non_english_casting";
  }

  const clips = /\b(?:clips?|reels?|chopped|social\s+(?:assets?|accounts?|media))\b/i.test(text);
  const fullEpisode = /\b(?:full|whole|entire)\s+episode\b/i.test(text);
  if (clips && fullEpisode && /\byoutube\b/i.test(text)) return "content_reuse_boundary";

  return null;
}

function policyMatchesFamily(family: V510DecisionFamily, policy: V4SystemicPolicy) {
  // Admission is based on the approved decision itself. Titles and question
  // families are recall aids and must not make a partial atomic rule look as
  // though it contains conditions that exist only in a sibling record.
  const text = policy.decision;
  if (family === "missing_intake_call1") {
    return /\b(?:missing|blank|incomplete|not\s+fill)\w*\b[\s\S]{0,120}\b(?:information|details|type\s*form|typeform|application)\b|\b(?:type\s*form|typeform|application|information|details)\b[\s\S]{0,120}\b(?:missing|blank|incomplete|not\s+fill)\w*\b/i.test(text) &&
      /\b(?:ask\b[\s\S]{0,60}\bquestions?|proceed|continue|does\s+not\s+require\s+(?:reschedul|disqual)|do\s+not\s+cancel)\b/i.test(text);
  }
  if (family === "missed_call2_reapplication") {
    return /\b(?:no[- ]?show(?:ed)?|missed\s+(?:their|a|the)?\s*(?:scheduled\s+)?call)\b/i.test(text) &&
      /\b(?:90\s+days?|three\s+months?|3\s+months?)\b/i.test(text) &&
      /\breappl(?:y|ication)\b/i.test(text) &&
      !/\bonboarding\b|\bmissed\s+(?:their|a|the)?\s*(?:first|call\s*1)\b/i.test(text);
  }
  if (family === "non_english_casting") {
    return /\b(?:cannot|can['’]?t|do\s+not|does\s+not|not)\b[\s\S]{0,80}\b(?:accommodate|cast|audition)\b[\s\S]{0,100}\b(?:other\s+languages?|non[- ]english|spanish)|\b(?:other\s+languages?|non[- ]english|spanish)\b[\s\S]{0,100}\b(?:cannot|can['’]?t|do\s+not|does\s+not|not\s+automatically)\b/i.test(text) &&
      /\b(?:owner|partner|bilingual\s+(?:sales\s+)?rep|directly|employees?)\b/i.test(text) &&
      !/\bnot\s+automatically\s+disqualified\b[\s\S]{0,100}\bcomfortably\b[\s\S]{0,60}\benglish\b/i.test(text);
  }
  const positiveClipPermission = /\b(?:can|may|allowed|permitted)\b[\s\S]{0,80}\b(?:clips?|reels?)\b|\b(?:clips?|reels?)\b[\s\S]{0,80}\b(?:can|may|allowed|permitted)\b/i.test(text) &&
    !/\bdoes\s+not\s+address\b[\s\S]{0,60}\b(?:clips?|reels?)\b/i.test(text);
  return positiveClipPermission && /\b(?:full|whole|entire)\s+episode\b/i.test(text) && /\byoutube\b/i.test(text) &&
    /\b(?:cannot|can['’]?t|not|does\s+not\s+permit)\b[\s\S]{0,100}\b(?:full|whole|entire)\s+episode\b|\b(?:full|whole|entire)\s+episode\b[\s\S]{0,100}\b(?:cannot|can['’]?t|not|does\s+not\s+permit)\b/i.test(text);
}

function authorityTier(policy: V4SystemicPolicy) {
  const approvers = policy.source.approved_by.join(" ").toLowerCase();
  if (/\b(?:rich|mike|rudy)\b/.test(approvers)) return 3;
  if (/\braul\b/.test(approvers)) return 2;
  if (/\bmadeline\b/.test(approvers)) return 1;
  return 0;
}

function overlapScore(question: string, policy: V4SystemicPolicy) {
  const questionWords = new Set(words(question));
  return words(policyText(policy)).filter((token) => questionWords.has(token)).length;
}

function familyPolicyScore(question: string, policy: V4SystemicPolicy) {
  const effective = Date.parse(policy.effective_at || policy.last_reviewed || "");
  const recency = Number.isFinite(effective) ? Math.max(0, Math.min(30, Math.floor(effective / 86_400_000) % 31)) : 0;
  return 500 + authorityTier(policy) * 35 + overlapScore(question, policy) * 8 + Math.min(30, policy.specificity_priority || 0) + recency / 100;
}

function familyCandidate(policy: V4SystemicPolicy, need: V4SystemicNeed, score: number): V4SystemicCandidate {
  const needScore = {
    score,
    rank: 0.1,
    lexicalScore: score,
    familyScore: score,
    characterScore: 0,
    structuredScore: 20,
    semanticVectorScore: 0,
    relationScore: 20,
    matchedDecisionId: `${policy.id}::v510-decision-family`,
    matchedDecisionText: policy.decision,
  };
  return {
    policy,
    rank: 0.1,
    score,
    matchedQueries: [need.authorityText || need.text],
    matchedTerms: [policy.title, ...policy.question_families],
    lexicalScore: score,
    familyScore: score,
    characterScore: 0,
    structuredScore: 20,
    authorityScore: Math.min(3, policy.authority / 4),
    relationScore: 20,
    semanticVectorScore: 0,
    matchedDecisionId: needScore.matchedDecisionId,
    matchedDecisionText: policy.decision,
    needScores: { [need.id]: needScore },
  };
}

export function retrieveV510Policies(turn: V3TurnResolution, plan: V4SystemicQueryPlan): V4SystemicRetrieval {
  const base = retrieveV59Policies(turn, plan);
  const byId = new Map(base.candidates.map((candidate) => [candidate.policy.id, candidate]));
  const selectedByNeed = new Map<string, string>();

  for (const need of plan.needs) {
    const family = v510DecisionFamilyForNeed(need);
    if (!family) continue;
    const question = completeNeedText(need);
    const winner = corpus
      .filter((policy) => policy.answerability === "answer_evidence" && policyMatchesFamily(family, policy))
      .map((policy) => ({ policy, score: familyPolicyScore(question, policy) }))
      .sort((left, right) => right.score - left.score || left.policy.id.localeCompare(right.policy.id))[0];
    if (!winner) continue;
    selectedByNeed.set(need.id, winner.policy.id);
    const injected = familyCandidate(winner.policy, need, winner.score);
    const existing = byId.get(winner.policy.id);
    byId.set(winner.policy.id, existing ? {
      ...existing,
      rank: Math.min(existing.rank, injected.rank),
      score: Math.max(existing.score, injected.score),
      matchedQueries: [...new Set([...existing.matchedQueries, ...injected.matchedQueries])],
      needScores: { ...(existing.needScores || {}), ...injected.needScores },
    } : injected);
  }

  let strictExclusions = 0;
  const candidates = [...byId.values()].flatMap((candidate) => {
    const needScores = { ...(candidate.needScores || {}) };
    for (const [needId, winnerId] of selectedByNeed) {
      if (!needScores[needId] || candidate.policy.id === winnerId) continue;
      delete needScores[needId];
      strictExclusions += 1;
    }
    return Object.keys(needScores).length ? [{ ...candidate, needScores }] : [];
  });

  return {
    ...base,
    candidates,
    diagnostics: base.diagnostics ? {
      ...base.diagnostics,
      snapshotVersion: `${base.diagnostics.snapshotVersion}+v510-decision-family-control`,
      needs: base.diagnostics.needs.map((diagnostic) => ({
        ...diagnostic,
        selectedPolicyIds: candidates.filter((candidate) => candidate.needScores?.[diagnostic.needId]).map((candidate) => candidate.policy.id),
      })),
    } : base.diagnostics,
    stageTimings: {
      ...base.stageTimings,
      v510DecisionFamilyMatches: selectedByNeed.size,
      v510DecisionFamilyExclusions: strictExclusions,
    },
  };
}

import type { V3TurnResolution } from "@/lib/ask-sales-faq/v3/types";
import type {
  V4SystemicCandidate,
  V4SystemicNeed,
  V4SystemicPolicy,
  V4SystemicQueryPlan,
  V4SystemicRetrieval,
} from "@/lib/ask-sales-faq/v4/systemic/types";
import { getV5KnowledgeSnapshot } from "@/lib/ask-sales-faq/v5/knowledge";
import { retrieveV55Policies } from "@/lib/ask-sales-faq/v5-5/retrieval";
import { V56_OWNER_CONFIRMED_POLICIES } from "@/lib/ask-sales-faq/v5-6/knowledge";

const v5PolicyById = new Map(getV5KnowledgeSnapshot().policies.map((policy) => [policy.id, policy]));

function needText(need: V4SystemicNeed) {
  return [
    need.authorityText,
    need.originalRequestText,
    need.text,
    ...need.retrievalQueries,
    ...need.domains,
    ...need.actions,
    ...need.entities,
  ].filter(Boolean).join(" ");
}

function matchesCall2PackageSequence(need: V4SystemicNeed) {
  const text = needText(need);
  return /\b(?:call\s*2|call\s*two|second\s+call)\b/i.test(text) &&
    /\b(?:package|pricing|prices?|quote|standard|vip|lite|upsell|downsell)\b/i.test(text) &&
    /\b(?:present|show|offer|quote|start|lead|choose|choice|upsell|downsell|all\s+three|which\s+package|package\s+first)\b/i.test(text);
}

function matchesCall1PricingBoundary(need: V4SystemicNeed) {
  const text = needText(need);
  return /\b(?:call\s*1|call\s*one|first\s+call)\b/i.test(text) &&
    /\b(?:cost|price|pricing|minimum|investment|fee)\b/i.test(text) &&
    /\b(?:tell|quote|mention|discuss|disclose|share|ask|asks)\b/i.test(text) &&
    !/\b(?:keep\s+pushing|keeps?\s+pushing|exact\s+breakdown|line[- ]items?|break\s+down)\b/i.test(text);
}

function matchesPersistentCall1PricingQuestion(need: V4SystemicNeed) {
  const text = needText(need);
  return /\b(?:call\s*1|call\s*one|first\s+call)\b/i.test(text) &&
    /\b(?:cost|price|pricing|minimum|investment|fee|breakdown)\b/i.test(text) &&
    /\b(?:keep\s+pushing|keeps?\s+pushing|exact\s+breakdown|line[- ]items?|break\s+down|persists?|insists?)\b/i.test(text);
}

function matchesOverlay(policyId: string, need: V4SystemicNeed) {
  if (policyId === "owner-call2-baseline-package-sequence") return matchesCall2PackageSequence(need);
  if (policyId === "owner-call1-pricing-complete-boundary") return matchesCall1PricingBoundary(need);
  return false;
}

function overlayCandidate(policy: V4SystemicPolicy, need: V4SystemicNeed, globalRank: number): V4SystemicCandidate {
  const matchedTerms = policy.id === "owner-call2-baseline-package-sequence"
    ? ["call 2", "package", "price", "present"]
    : ["call 1", "price", "cost", "quote"];
  const needScore = {
    score: 98,
    rank: 0.5,
    lexicalScore: 9.8,
    familyScore: 10,
    characterScore: 4,
    structuredScore: 10,
    semanticVectorScore: 0,
    relationScore: 10,
    matchedDecisionId: `${policy.id}::owner-confirmed-overlay`,
    matchedDecisionText: policy.decision,
  };
  return {
    policy,
    rank: globalRank,
    score: needScore.score,
    matchedQueries: [need.text],
    matchedTerms,
    lexicalScore: needScore.lexicalScore,
    familyScore: needScore.familyScore,
    characterScore: needScore.characterScore,
    structuredScore: needScore.structuredScore,
    authorityScore: 3,
    relationScore: needScore.relationScore,
    semanticVectorScore: 0,
    matchedDecisionId: needScore.matchedDecisionId,
    matchedDecisionText: policy.decision,
    needScores: { [need.id]: needScore },
  };
}

export function retrieveV56Policies(
  turn: V3TurnResolution,
  plan: V4SystemicQueryPlan,
): V4SystemicRetrieval {
  const base = retrieveV55Policies(turn, plan);
  const byId = new Map(base.candidates.map((candidate) => [candidate.policy.id, candidate]));
  let overlayMatchCount = 0;
  const matchedPolicyIdsByNeed = new Map<string, string[]>();

  for (const need of plan.needs) {
    for (const policy of V56_OWNER_CONFIRMED_POLICIES) {
      if (!matchesOverlay(policy.id, need)) continue;
      const candidate = overlayCandidate(policy, need, base.candidates.length + overlayMatchCount + 1);
      const existing = byId.get(candidate.policy.id);
      byId.set(candidate.policy.id, existing
        ? { ...existing, needScores: { ...(existing.needScores || {}), ...candidate.needScores } }
        : candidate);
      matchedPolicyIdsByNeed.set(need.id, [...(matchedPolicyIdsByNeed.get(need.id) || []), policy.id]);
      overlayMatchCount += 1;
    }
    if (matchesPersistentCall1PricingQuestion(need)) {
      const policy = v5PolicyById.get("operational_fa65ec318eacfff9");
      if (policy) {
        const candidate = overlayCandidate(policy, need, base.candidates.length + overlayMatchCount + 1);
        const existing = byId.get(candidate.policy.id);
        byId.set(candidate.policy.id, existing
          ? { ...existing, needScores: { ...(existing.needScores || {}), ...candidate.needScores } }
          : candidate);
        matchedPolicyIdsByNeed.set(need.id, [...(matchedPolicyIdsByNeed.get(need.id) || []), policy.id]);
        overlayMatchCount += 1;
      }
    }
  }

  const candidates = [...byId.values()];
  return {
    ...base,
    corpusSize: base.corpusSize + V56_OWNER_CONFIRMED_POLICIES.length,
    candidates,
    diagnostics: base.diagnostics ? {
      ...base.diagnostics,
      snapshotVersion: `${base.diagnostics.snapshotVersion}+v56-owner-overlay`,
      needs: base.diagnostics.needs.map((diagnostic) => ({
        ...diagnostic,
        selectedPolicyIds: matchedPolicyIdsByNeed.has(diagnostic.needId)
          ? [...new Set([...diagnostic.selectedPolicyIds, ...(matchedPolicyIdsByNeed.get(diagnostic.needId) || [])])]
          : diagnostic.selectedPolicyIds,
      })),
    } : base.diagnostics,
    stageTimings: {
      ...base.stageTimings,
      v56OwnerConfirmedOverlayMatchCount: overlayMatchCount,
    },
  };
}

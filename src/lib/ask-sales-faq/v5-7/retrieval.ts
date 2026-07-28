import type { V3TurnResolution } from "@/lib/ask-sales-faq/v3/types";
import type {
  V4SystemicCandidate,
  V4SystemicNeed,
  V4SystemicPolicy,
  V4SystemicQueryPlan,
  V4SystemicRetrieval,
} from "@/lib/ask-sales-faq/v4/systemic/types";
import { getV5KnowledgeSnapshot } from "@/lib/ask-sales-faq/v5/knowledge";
import { retrieveV56Policies } from "@/lib/ask-sales-faq/v5-6/retrieval";
import { V57_SOURCE_REVIEWED_POLICIES } from "@/lib/ask-sales-faq/v5-7/knowledge";
import {
  v57ControllingPolicyIds,
  v57ExcludedPolicyIds,
  v57SourceResolutionTrace,
} from "@/lib/ask-sales-faq/v5-7/source-resolutions";

const policyById = new Map([
  ...getV5KnowledgeSnapshot().policies,
  ...V57_SOURCE_REVIEWED_POLICIES,
].map((policy) => [policy.id, policy]));

function isDifferentRelationshipSibling(need: V4SystemicNeed, policy: V4SystemicPolicy) {
  const hasDiscountExpirationResolution = v57SourceResolutionTrace(need)
    .some((resolution) => resolution.id === "same-day-discount-versus-upgrade-carry-forward");
  if (!hasDiscountExpirationResolution) return false;
  return /\bupgrade\b/i.test([
    policy.title,
    policy.decision,
    policy.search_text,
    ...policy.question_families,
  ].join(" "));
}

function resolutionCandidate(policy: V4SystemicPolicy, need: V4SystemicNeed, globalRank: number): V4SystemicCandidate {
  const score = {
    score: 320,
    rank: 0.25,
    lexicalScore: 10,
    familyScore: 10,
    characterScore: 4,
    structuredScore: 10,
    semanticVectorScore: 0,
    relationScore: 16,
    matchedDecisionId: `${policy.id}::v57-source-resolution`,
    matchedDecisionText: policy.decision,
  };
  return {
    policy,
    rank: globalRank,
    score: score.score,
    matchedQueries: [need.authorityText || need.text],
    matchedTerms: policy.entities,
    lexicalScore: score.lexicalScore,
    familyScore: score.familyScore,
    characterScore: score.characterScore,
    structuredScore: score.structuredScore,
    authorityScore: Math.min(3, policy.authority / 4),
    relationScore: score.relationScore,
    semanticVectorScore: 0,
    matchedDecisionId: score.matchedDecisionId,
    matchedDecisionText: policy.decision,
    needScores: { [need.id]: score },
  };
}

export function retrieveV57Policies(
  turn: V3TurnResolution,
  plan: V4SystemicQueryPlan,
): V4SystemicRetrieval {
  const base = retrieveV56Policies(turn, plan);
  const byId = new Map(base.candidates.map((candidate) => [candidate.policy.id, candidate]));
  let promotedCount = 0;
  let excludedNeedScoreCount = 0;

  for (const need of plan.needs) {
    const excluded = v57ExcludedPolicyIds(need);
    for (const candidate of byId.values()) {
      if (isDifferentRelationshipSibling(need, candidate.policy)) excluded.add(candidate.policy.id);
    }
    for (const id of excluded) {
      const existing = byId.get(id);
      if (!existing?.needScores?.[need.id]) continue;
      const needScores = { ...existing.needScores };
      delete needScores[need.id];
      excludedNeedScoreCount += 1;
      if (Object.keys(needScores).length) byId.set(id, { ...existing, needScores });
      else byId.delete(id);
    }

    for (const id of v57ControllingPolicyIds(need)) {
      const policy = byId.get(id)?.policy || policyById.get(id);
      if (!policy) continue;
      const promoted = resolutionCandidate(policy, need, base.candidates.length + promotedCount + 1);
      const existing = byId.get(id);
      byId.set(id, existing ? {
        ...existing,
        matchedQueries: [...new Set([...existing.matchedQueries, ...promoted.matchedQueries])],
        matchedTerms: [...new Set([...existing.matchedTerms, ...promoted.matchedTerms])],
        needScores: { ...(existing.needScores || {}), ...promoted.needScores },
      } : promoted);
      promotedCount += 1;
    }
  }

  const candidates = [...byId.values()];
  return {
    ...base,
    corpusSize: base.corpusSize + V57_SOURCE_REVIEWED_POLICIES.length,
    candidates,
    diagnostics: base.diagnostics ? {
      ...base.diagnostics,
      snapshotVersion: `${base.diagnostics.snapshotVersion}+v57-source-resolution`,
      needs: base.diagnostics.needs.map((diagnostic) => {
        const need = plan.needs.find((item) => item.id === diagnostic.needId)!;
        return {
          ...diagnostic,
          selectedPolicyIds: candidates
            .filter((candidate) => candidate.needScores?.[diagnostic.needId])
            .map((candidate) => candidate.policy.id),
          v57SourceResolutions: v57SourceResolutionTrace(need),
        };
      }),
    } : base.diagnostics,
    stageTimings: {
      ...base.stageTimings,
      v57SourceResolutionPromotions: promotedCount,
      v57SourceResolutionExclusions: excludedNeedScoreCount,
    },
  };
}

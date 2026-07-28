import type { V3Provider, V3TurnResolution } from "@/lib/ask-sales-faq/v3/types";
import type { V4SystemicSourcePlan } from "@/lib/ask-sales-faq/v4/systemic/runtime";
import { v4SystemicNeedPolicyRelationErrors } from "@/lib/ask-sales-faq/v4/systemic/relations";
import type { V4SystemicCandidate, V4SystemicNeed, V4SystemicQueryPlan, V4SystemicRetrieval } from "@/lib/ask-sales-faq/v4/systemic/types";
import { refineV511SourcePlanWithRawEntailment } from "@/lib/ask-sales-faq/v5-11/entailment";
import { v512ReviewedPoliciesForNeed } from "@/lib/ask-sales-faq/v5-12/retrieval";

const SENIOR_AUTHORITY = /\b(?:rich|mike|rudy)\b/i;
const TENTATIVE_ESTIMATE = /\b(?:typically|approximately|estimate|estimated|roughly|maybe|might|could take|few\s+(?:days|weeks|months)|up to\s+\d+\s+(?:days|weeks|months))\b/i;
const FINAL_OWNER_DEFERRAL = /\b(?:confirm|verify|final answer|has the final answer|hotline|fulfillment|post[- ]sale team|production team)\b/i;
const NON_RESOLVING_DECISION = /\b(?:does not resolve|route (?:it|those|this|before)|case[- ]by[- ]case)\b/i;
const STOP_WORDS = new Set([
  "about", "after", "again", "also", "and", "are", "before", "both", "can", "could", "does", "for", "from", "have", "how", "into", "may", "must", "not", "one", "only", "or", "should", "that", "the", "their", "them", "they", "this", "through", "to", "what", "when", "where", "which", "who", "will", "with", "would", "you",
]);

function normalizedTokens(value: string) {
  return [...new Set(value.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(/\s+/)
    .map((token) => token.replace(/(?:ing|ied|ed|es|s)$/i, (suffix) => suffix === "ied" ? "y" : ""))
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token)))];
}

function policyText(candidate: V4SystemicCandidate) {
  return [
    candidate.policy.title,
    ...candidate.policy.question_families,
    candidate.policy.decision,
    ...candidate.policy.domains,
    ...candidate.policy.actions,
    ...candidate.policy.entities,
  ].join(" ");
}

function needText(need: V4SystemicNeed) {
  return [need.originalRequestText, need.authorityText, need.text, ...need.actions, ...need.entities].filter(Boolean).join(" ");
}

export function v512UnsafeDelegatedEstimate(candidate: V4SystemicCandidate) {
  const decision = candidate.policy.decision;
  return TENTATIVE_ESTIMATE.test(decision) && FINAL_OWNER_DEFERRAL.test(decision);
}

function overlapScore(need: V4SystemicNeed, candidate: V4SystemicCandidate) {
  const requested = normalizedTokens(needText(need));
  const evidence = new Set(normalizedTokens(policyText(candidate)));
  const shared = requested.filter((token) => evidence.has(token));
  return {
    shared: shared.length,
    coverage: shared.length / Math.max(1, requested.length),
  };
}

function seniorExactCandidates(need: V4SystemicNeed, retrieval: V4SystemicRetrieval) {
  return retrieval.candidates.flatMap((candidate) => {
    const score = candidate.needScores?.[need.id];
    if (!score || score.rank > 0.9 || score.relationScore < 8 || score.score < 230) return [];
    if (candidate.policy.answerability !== "answer_evidence") return [];
    if (NON_RESOLVING_DECISION.test(candidate.policy.decision)) return [];
    if (candidate.policy.systemic.ownerReviewRequired || candidate.policy.systemic.temporalRisk === "live_only") return [];
    if (!SENIOR_AUTHORITY.test(candidate.policy.source.approved_by.join(" "))) return [];
    if (v512UnsafeDelegatedEstimate(candidate)) return [];
    if (v4SystemicNeedPolicyRelationErrors(need, candidate.policy).length) return [];
    const overlap = overlapScore(need, candidate);
    if (overlap.shared < 4 || overlap.coverage < 0.24) return [];
    return [{ candidate, score, overlap, specificity: candidate.policy.specificity_priority ?? 0 }];
  }).sort((left, right) =>
    right.overlap.coverage - left.overlap.coverage ||
    right.overlap.shared - left.overlap.shared ||
    right.specificity - left.specificity ||
    right.score.relationScore - left.score.relationScore ||
    right.score.score - left.score.score ||
    left.score.rank - right.score.rank,
  );
}

/**
 * Recover only a uniquely more specific senior-authority record. A general
 * rule cannot beat an exact conditional answer merely because both have the
 * same retrieval rank, while close competing records still fail closed.
 */
export function v512SeniorExactRecovery(need: V4SystemicNeed, retrieval: V4SystemicRetrieval) {
  const candidates = seniorExactCandidates(need, retrieval);
  const best = candidates[0];
  if (!best) return null;
  const runnerUp = candidates[1];
  if (
    runnerUp &&
    best.overlap.coverage - runnerUp.overlap.coverage < 0.12 &&
    best.overlap.shared - runnerUp.overlap.shared < 2 &&
    best.specificity - runnerUp.specificity < 10
  ) return null;
  return best.candidate;
}

export function refineV512SourcePlan(
  sourcePlan: V4SystemicSourcePlan,
  plan: V4SystemicQueryPlan,
  retrieval: V4SystemicRetrieval,
) {
  let reviewedRecoveries = 0;
  let seniorRecoveries = 0;
  let delegatedEstimateBlocks = 0;
  const needs = sourcePlan.needs.map((sourceNeed) => {
    const need = plan.needs.find((candidate) => candidate.id === sourceNeed.needId);
    if (!need || need.forcedRouteKey || need.ambiguity === "material") return sourceNeed;

    const reviewed = v512ReviewedPoliciesForNeed(need, retrieval);
    if (reviewed.length) {
      reviewedRecoveries += 1;
      const reviewedIds = reviewed.map((candidate) => candidate.policy.id);
      return {
        ...sourceNeed,
        lane: "answer" as const,
        directPolicyIds: reviewedIds,
        preferredPolicyIds: reviewedIds,
        excludedConflictPolicyIds: retrieval.candidates
          .filter((candidate) => candidate.needScores?.[need.id] && !reviewedIds.includes(candidate.policy.id))
          .map((candidate) => candidate.policy.id),
        modelDisposition: "answer" as const,
        modelDirectPolicyIds: reviewedIds,
        deterministicPolicyIds: reviewedIds,
        reason: "V5.12 used the standalone source-reviewed decision registered for this exact material relationship and scope.",
      };
    }

    const selected = sourceNeed.preferredPolicyIds
      .map((id) => retrieval.candidates.find((candidate) => candidate.policy.id === id))
      .filter((candidate): candidate is V4SystemicCandidate => Boolean(candidate));
    if (selected.some(v512UnsafeDelegatedEstimate)) {
      delegatedEstimateBlocks += 1;
      return {
        ...sourceNeed,
        lane: "route" as const,
        directPolicyIds: [],
        preferredPolicyIds: [],
        excludedConflictPolicyIds: [...new Set([...sourceNeed.excludedConflictPolicyIds, ...selected.map((candidate) => candidate.policy.id)])],
        modelDisposition: "route" as const,
        modelDirectPolicyIds: [],
        deterministicPolicyIds: [],
        reason: "V5.12 withheld a tentative estimate whose own record delegates the final answer to a live owner.",
      };
    }

    if (sourceNeed.lane === "route") {
      const recovered = v512SeniorExactRecovery(need, retrieval);
      if (recovered) {
        seniorRecoveries += 1;
        return {
          ...sourceNeed,
          lane: "answer" as const,
          directPolicyIds: [recovered.policy.id],
          preferredPolicyIds: [recovered.policy.id],
          excludedConflictPolicyIds: retrieval.candidates
            .filter((candidate) => candidate.needScores?.[need.id] && candidate.policy.id !== recovered.policy.id)
            .map((candidate) => candidate.policy.id),
          modelDisposition: "answer" as const,
          modelDirectPolicyIds: [recovered.policy.id],
          deterministicPolicyIds: [recovered.policy.id],
          reason: "V5.12 recovered one uniquely more specific, relationship-compatible senior-authority record after the model falsely routed it.",
        };
      }
    }
    return sourceNeed;
  });

  return {
    sourcePlan: {
      ...sourcePlan,
      needs,
      reasoningSummary: `${sourcePlan.reasoningSummary} V5.12 applied ${reviewedRecoveries} reviewed-decision recoveries, ${seniorRecoveries} conservative senior-exact recoveries, and ${delegatedEstimateBlocks} delegated-estimate blocks.`,
    },
    metadata: { reviewedRecoveries, seniorRecoveries, delegatedEstimateBlocks },
  };
}

export async function refineV512SourcePlanWithRawEntailment(input: {
  turn: V3TurnResolution;
  plan: V4SystemicQueryPlan;
  retrieval: V4SystemicRetrieval;
  sourcePlan: V4SystemicSourcePlan;
  provider: V3Provider;
}) {
  const result = await refineV511SourcePlanWithRawEntailment(input);
  const refined = refineV512SourcePlan(result.sourcePlan, input.plan, input.retrieval);
  return {
    ...result,
    sourcePlan: refined.sourcePlan,
    metadata: {
      ...result.metadata,
      v512AnswerFidelity: refined.metadata,
    },
  };
}

import { matchingV4SystemicAuthorityResolutions } from "@/lib/ask-sales-faq/v4/systemic/authority-resolutions";
import type {
  V4SystemicSourcePlan,
  V4SystemicSourceNeedPlan,
} from "@/lib/ask-sales-faq/v4/systemic/runtime";
import type {
  V4SystemicCandidate,
  V4SystemicNeed,
  V4SystemicQueryPlan,
  V4SystemicRetrieval,
} from "@/lib/ask-sales-faq/v4/systemic/types";
import {
  evaluateV51DecisionContract,
  evaluateV52DecisionIdentity,
} from "@/lib/ask-sales-faq/v5/decision-contract";

const DAY_MS = 86_400_000;

function candidateFor(id: string, retrieval: V4SystemicRetrieval) {
  return retrieval.candidates.find((candidate) => candidate.policy.id === id) || null;
}

function approvedRoleScore(candidate: V4SystemicCandidate) {
  const names = candidate.policy.source.approved_by.join(" ").toLowerCase();
  if (/\brich\b/.test(names)) return 3;
  if (/\b(?:mike|rudy)\b/.test(names)) return 2.6;
  if (/\b(?:madeline|raul)\b/.test(names)) return 2;
  return 0;
}

function timestamp(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export type V52AuthorityScore = {
  policyId: string;
  total: number;
  role: number;
  recency: number;
  specificity: number;
  identity: number;
};

/**
 * Authority is multi-factor and claim-scoped. Role matters, but it is not an
 * unconditional override: a much newer, exact, narrower Sales Ops decision
 * can outrank an old general Head-of-Sales statement. Close calls fail closed.
 */
export function scoreV52Authority(
  need: V4SystemicNeed,
  candidate: V4SystemicCandidate,
  newestEffectiveAt: number,
): V52AuthorityScore {
  const effectiveAt = timestamp(candidate.policy.effective_at || candidate.policy.last_reviewed);
  const daysBehind = newestEffectiveAt && effectiveAt
    ? Math.max(0, (newestEffectiveAt - effectiveAt) / DAY_MS)
    : 365;
  const recency = Math.max(0, 3 - daysBehind / 60);
  const needScore = candidate.needScores?.[need.id];
  const identity = Math.min(4, evaluateV52DecisionIdentity(
    need,
    candidate.policy,
    needScore?.matchedDecisionText || candidate.matchedDecisionText || "",
  ).score / 2.5);
  const specificity = Math.min(3,
    (needScore?.familyScore || candidate.familyScore) / 4 +
    (needScore?.structuredScore || candidate.structuredScore) / 10 +
    candidate.policy.specificity_priority / 100,
  );
  const role = approvedRoleScore(candidate);
  return {
    policyId: candidate.policy.id,
    total: role + recency + specificity + identity,
    role,
    recency,
    specificity,
    identity,
  };
}

export function chooseV52ContextualAuthority(
  need: V4SystemicNeed,
  candidates: V4SystemicCandidate[],
): { winner: V4SystemicCandidate | null; scores: V52AuthorityScore[]; reason: string } {
  const exact = candidates.filter((candidate) => {
    const needScore = candidate.needScores?.[need.id];
    return evaluateV51DecisionContract(need, candidate.policy).errors.length === 0 &&
      evaluateV52DecisionIdentity(
        need,
        candidate.policy,
        needScore?.matchedDecisionText || candidate.matchedDecisionText || "",
      ).exact;
  });
  if (exact.length < 2) return { winner: null, scores: [], reason: "Fewer than two exact conflicting authority positions were available." };
  const newest = Math.max(...exact.map((candidate) => timestamp(candidate.policy.effective_at || candidate.policy.last_reviewed)));
  const scores = exact.map((candidate) => scoreV52Authority(need, candidate, newest))
    .sort((left, right) => right.total - left.total || left.policyId.localeCompare(right.policyId));
  const winner = exact.find((candidate) => candidate.policy.id === scores[0]?.policyId) || null;
  const margin = (scores[0]?.total || 0) - (scores[1]?.total || 0);
  if (!winner || margin < 1.75) return {
    winner: null,
    scores,
    reason: `Authority evidence was too close to resolve safely (margin ${margin.toFixed(2)}).`,
  };
  return {
    winner,
    scores,
    reason: `Contextual authority selected ${winner.policy.id} using exact claim identity, specificity, recency, and role (margin ${margin.toFixed(2)}).`,
  };
}

function routeNeed(sourceNeed: V4SystemicSourceNeedPlan, reason: string): V4SystemicSourceNeedPlan {
  return {
    ...sourceNeed,
    lane: "route",
    directPolicyIds: [],
    preferredPolicyIds: [],
    reason,
  };
}

function exactCandidateForNeed(need: V4SystemicNeed, candidate: V4SystemicCandidate) {
  const needScore = candidate.needScores?.[need.id];
  return evaluateV51DecisionContract(need, candidate.policy).errors.length === 0 &&
    evaluateV52DecisionIdentity(
      need,
      candidate.policy,
      needScore?.matchedDecisionText || candidate.matchedDecisionText || "",
    ).exact;
}

function highConfidenceDeterministicRecovery(
  need: V4SystemicNeed,
  candidate: V4SystemicCandidate,
  retrieval: V4SystemicRetrieval,
) {
  const explicitlyControlled = matchingV4SystemicAuthorityResolutions(need)
    .some((resolution) => resolution.controlling_policy_ids.includes(candidate.policy.id));
  const compiledStableRule = candidate.policy.quality_flags.includes("v52_stable_rule_compiled");
  const rank = candidate.needScores?.[need.id]?.rank || candidate.rank;
  const score = candidate.needScores?.[need.id]?.score || candidate.score;
  const runnerUp = retrieval.candidates
    .filter((other) => other.policy.id !== candidate.policy.id && exactCandidateForNeed(need, other))
    .sort((left, right) =>
      (right.needScores?.[need.id]?.score || right.score) - (left.needScores?.[need.id]?.score || left.score),
    )[0];
  const margin = score - (runnerUp?.needScores?.[need.id]?.score || runnerUp?.score || 0);
  return exactCandidateForNeed(need, candidate) && (
    explicitlyControlled || (compiledStableRule && rank === 1 && margin >= 8)
  );
}

/**
 * Final non-bypassable decision gate. Downstream answer retries and exact-text
 * recovery may operate only on the policy IDs that survive this function.
 */
export function refineV52SourcePlan(
  sourcePlan: V4SystemicSourcePlan,
  plan: V4SystemicQueryPlan,
  retrieval: V4SystemicRetrieval,
): V4SystemicSourcePlan {
  const needs = sourcePlan.needs.map((sourceNeed): V4SystemicSourceNeedPlan => {
    const need = plan.needs.find((candidate) => candidate.id === sourceNeed.needId);
    if (!need || need.forcedRouteKey || sourceNeed.lane === "route" && !sourceNeed.excludedConflictPolicyIds.length && !sourceNeed.preferredPolicyIds.length) {
      return sourceNeed;
    }

    if (sourceNeed.lane === "route" && sourceNeed.excludedConflictPolicyIds.length >= 2) {
      const conflictCandidates = sourceNeed.excludedConflictPolicyIds
        .map((id) => candidateFor(id, retrieval))
        .filter((candidate): candidate is V4SystemicCandidate => Boolean(candidate));
      const adjudication = chooseV52ContextualAuthority(need, conflictCandidates);
      if (!adjudication.winner) return routeNeed(sourceNeed, `${sourceNeed.reason} ${adjudication.reason}`);
      return {
        ...sourceNeed,
        lane: "answer",
        directPolicyIds: [adjudication.winner.policy.id],
        preferredPolicyIds: [adjudication.winner.policy.id],
        excludedConflictPolicyIds: conflictCandidates
          .map((candidate) => candidate.policy.id)
          .filter((id) => id !== adjudication.winner!.policy.id),
        reason: adjudication.reason,
      };
    }

    const preferred = sourceNeed.preferredPolicyIds
      .map((id) => candidateFor(id, retrieval))
      .filter((candidate): candidate is V4SystemicCandidate => Boolean(candidate))
      .filter((candidate) => exactCandidateForNeed(need, candidate));
    const modelDirect = new Set(sourceNeed.modelDirectPolicyIds || []);
    const deterministic = new Set(sourceNeed.deterministicPolicyIds || []);
    const safePreferred = preferred.filter((candidate) => {
      if (sourceNeed.modelDisposition !== "route") return true;
      if (modelDirect.has(candidate.policy.id)) return true;
      return deterministic.has(candidate.policy.id) && highConfidenceDeterministicRecovery(need, candidate, retrieval);
    });
    if (!safePreferred.length) {
      return routeNeed(
        sourceNeed,
        "V5.2 withheld the answer because no preferred source passed the exact decision-identity and non-bypassable recovery contract.",
      );
    }
    const preferredIds = safePreferred.map((candidate) => candidate.policy.id).slice(0, 4);
    return {
      ...sourceNeed,
      lane: "answer",
      directPolicyIds: sourceNeed.directPolicyIds.filter((id) => preferredIds.includes(id)),
      preferredPolicyIds: preferredIds,
      reason: `${sourceNeed.reason} V5.2 verified exact decision identity before allowing answer recovery.`,
    };
  });
  return {
    ...sourcePlan,
    needs,
    reasoningSummary: `${sourcePlan.reasoningSummary} V5.2 applied the non-bypassable decision contract and contextual authority gate.`,
  };
}

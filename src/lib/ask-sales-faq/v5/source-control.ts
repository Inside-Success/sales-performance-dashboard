import { matchingV4SystemicAuthorityResolutions } from "@/lib/ask-sales-faq/v4/systemic/authority-resolutions";
import { getV4AtomicDecisionsForPolicy, v4AtomicTerms } from "@/lib/ask-sales-faq/v4/systemic/decision-ledger";
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
  v52OperationalEffectErrors,
} from "@/lib/ask-sales-faq/v5/decision-contract";
import {
  v54DecisionsFormConsensus,
  v54MaterialEffectsConflict,
  v54MaterialEffectsSupport,
} from "@/lib/ask-sales-faq/v5/consensus";

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
  const explicitlyControlled = matchingV4SystemicAuthorityResolutions(need)
    .some((resolution) => resolution.controlling_policy_ids.includes(candidate.policy.id));
  return (explicitlyControlled || evaluateV51DecisionContract(need, candidate.policy).errors.length === 0) &&
    evaluateV52DecisionIdentity(
      need,
      candidate.policy,
      needScore?.matchedDecisionText || candidate.matchedDecisionText || "",
    ).exact;
}

function canonicalResolutionCandidate(need: V4SystemicNeed, retrieval: V4SystemicRetrieval) {
  // Controlling IDs are ordered with the reviewed canonical synthesis first.
  // Prefer that synthesis over older agreeing fragments so the answer retains
  // the exact current wording (for example "three months", not a legacy
  // approximation of "90 days"). The resolution's match groups remain the
  // non-bypassable claim-scope gate.
  for (const resolution of matchingV4SystemicAuthorityResolutions(need)) {
    for (const id of resolution.controlling_policy_ids) {
      const candidate = candidateFor(id, retrieval);
      if (candidate?.policy.answerability === "answer_evidence" && exactCandidateForNeed(need, candidate)) return candidate;
    }
  }
  return null;
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
    if (!need || need.forcedRouteKey) {
      return sourceNeed;
    }

    const resolutionPreferred = canonicalResolutionCandidate(need, retrieval);
    if (sourceNeed.modelDisposition === "answer" && resolutionPreferred) {
      return {
        ...sourceNeed,
        lane: "answer",
        directPolicyIds: [resolutionPreferred.policy.id],
        preferredPolicyIds: [resolutionPreferred.policy.id],
        excludedConflictPolicyIds: sourceNeed.excludedConflictPolicyIds.filter((id) => id !== resolutionPreferred.policy.id),
        reason: `Applied the matching claim-scoped authority resolution using ${resolutionPreferred.policy.id}.`,
      };
    }

    if (sourceNeed.lane === "route" && !sourceNeed.excludedConflictPolicyIds.length && !sourceNeed.preferredPolicyIds.length) return sourceNeed;

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

    const resolution = matchingV4SystemicAuthorityResolutions(need).find((item) =>
      (sourceNeed.deterministicPolicyIds || []).some((id) => item.controlling_policy_ids.includes(id)),
    );
    const resolutionRecovery = sourceNeed.modelDisposition === "route" && resolution
      ? canonicalResolutionCandidate(need, retrieval)
      : null;
    const preferred = [...new Set([
      ...sourceNeed.preferredPolicyIds,
      ...(resolutionRecovery ? [resolutionRecovery.policy.id] : []),
    ])]
      .map((id) => candidateFor(id, retrieval))
      .filter((candidate): candidate is V4SystemicCandidate => Boolean(candidate))
      .filter((candidate) => exactCandidateForNeed(need, candidate));
    const modelDirect = new Set(sourceNeed.modelDirectPolicyIds || []);
    const deterministic = new Set([
      ...(sourceNeed.deterministicPolicyIds || []),
      ...(resolutionRecovery ? [resolutionRecovery.policy.id] : []),
    ]);
    const safePreferred = preferred.filter((candidate) => {
      if (sourceNeed.modelDisposition !== "route") return true;
      if (modelDirect.has(candidate.policy.id)) return true;
      if (resolutionRecovery && candidate.policy.id !== resolutionRecovery.policy.id &&
        resolution?.controlling_policy_ids.includes(candidate.policy.id)) return false;
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

const COMPATIBILITY_STOP = new Set([
  "after", "answer", "applicant", "before", "boundaries", "business", "call", "conditions", "client", "does", "lead", "only", "policy", "prospect", "representative", "sales", "should", "their", "this", "when", "with",
]);

function primaryDecision(value: string) {
  return value.split(/\b(?:Conditions?|Boundaries):/i)[0].replace(/\s+/g, " ").trim();
}

function compatibilityTerms(value: string) {
  return new Set(value.toLowerCase().replace(/[^a-z0-9%$]+/g, " ").split(/\s+/)
    .map((term) => term.length > 4 ? term.replace(/(?:ing|ied|ed|es|s)$/i, (suffix) => suffix === "ied" ? "y" : "") : term)
    .filter((term) => term.length >= 3 && !COMPATIBILITY_STOP.has(term)));
}

function materialPolarity(value: string) {
  if (/\b(?:do\s+not|don't|does\s+not|must\s+not|cannot|can't|may\s+not|not\s+allowed|not\s+permitted|prohibited|never|no[,.;:]?)\b/i.test(value)) return "negative";
  if (/\b(?:may|can|allowed|permitted|must|should|required|yes[,.;:]?)\b/i.test(value)) return "positive";
  return "neutral";
}

function materialNumbers(value: string) {
  return [...new Set(value.match(/(?:[$£€]\s*)?\d+(?:\.\d+)?(?:\s*%|\s*(?:minutes?|hours?|days?|weeks?|months?|years?|payments?|installments?))?/gi) || [])]
    .map((number) => number.toLowerCase().replace(/\s+/g, ""));
}

function decisionsAgree(candidates: V4SystemicCandidate[]) {
  for (let leftIndex = 0; leftIndex < candidates.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < candidates.length; rightIndex += 1) {
      const left = primaryDecision(candidates[leftIndex].policy.decision);
      const right = primaryDecision(candidates[rightIndex].policy.decision);
      const polarities = new Set([materialPolarity(left), materialPolarity(right)]);
      if (polarities.has("positive") && polarities.has("negative")) return false;
      const leftNumbers = materialNumbers(left);
      const rightNumbers = materialNumbers(right);
      if (leftNumbers.length && rightNumbers.length && !leftNumbers.some((number) => rightNumbers.includes(number))) return false;
      const leftTerms = compatibilityTerms(left);
      const rightTerms = compatibilityTerms(right);
      if ([...leftTerms].filter((term) => rightTerms.has(term)).length < 2) return false;
    }
  }
  return true;
}

/**
 * Recovers only a model-confirmed, mutually compatible answer set after V5.2's
 * source-plan gate. This addresses false conflict groupings without allowing a
 * deterministic similarity match to overrule a model abstention, live owner,
 * blocked topic, material ambiguity, or genuinely incompatible source.
 */
export function refineV53SourcePlan(
  sourcePlan: V4SystemicSourcePlan,
  plan: V4SystemicQueryPlan,
  retrieval: V4SystemicRetrieval,
): V4SystemicSourcePlan {
  const v52 = refineV52SourcePlan(sourcePlan, plan, retrieval);
  const needs = v52.needs.map((sourceNeed): V4SystemicSourceNeedPlan => {
    if (sourceNeed.lane !== "route" || sourceNeed.modelDisposition !== "answer") return sourceNeed;
    const need = plan.needs.find((candidate) => candidate.id === sourceNeed.needId);
    if (!need || need.forcedRouteKey || need.ambiguity === "material" || need.requestKind !== "knowledge") return sourceNeed;

    const exactModelDirect = [...new Set(sourceNeed.modelDirectPolicyIds || [])]
      .map((id) => candidateFor(id, retrieval))
      .filter((candidate): candidate is V4SystemicCandidate => Boolean(
        candidate &&
        candidate.policy.answerability === "answer_evidence" &&
        exactCandidateForNeed(need, candidate),
      ))
      .sort((left, right) =>
        (left.needScores?.[need.id]?.rank || left.rank) - (right.needScores?.[need.id]?.rank || right.rank),
      );
    if (!exactModelDirect.length || !decisionsAgree(exactModelDirect)) return sourceNeed;

    const excludedAnswerEvidence = sourceNeed.excludedConflictPolicyIds
      .map((id) => candidateFor(id, retrieval))
      .filter((candidate): candidate is V4SystemicCandidate => Boolean(
        candidate && candidate.policy.answerability === "answer_evidence" && exactCandidateForNeed(need, candidate),
      ));
    if (!decisionsAgree([...exactModelDirect, ...excludedAnswerEvidence])) return sourceNeed;

    const preferredPolicyIds = exactModelDirect.slice(0, 2).map((candidate) => candidate.policy.id);
    return {
      ...sourceNeed,
      lane: "answer",
      directPolicyIds: [...new Set([...sourceNeed.directPolicyIds, ...preferredPolicyIds])],
      preferredPolicyIds,
      excludedConflictPolicyIds: sourceNeed.excludedConflictPolicyIds.filter((id) => !preferredPolicyIds.includes(id)),
      reason: "V5.3 recovered mutually compatible, exact, model-confirmed answer evidence after rejecting a false conflict grouping.",
    };
  });
  return {
    ...v52,
    needs,
    reasoningSummary: `${v52.reasoningSummary} V5.3 recovered only exact model-confirmed source positions that passed pairwise material-compatibility checks.`,
  };
}

function candidateDecisionForNeed(need: V4SystemicNeed, candidate: V4SystemicCandidate) {
  return candidate.needScores?.[need.id]?.matchedDecisionText || candidate.matchedDecisionText || candidate.policy.decision;
}

export function v54ExactSourceFallbackSentence(
  need: V4SystemicNeed,
  _plan: V4SystemicQueryPlan,
  retrieval: V4SystemicRetrieval,
  preferredPolicyIds: string[],
) {
  void _plan;
  const preferred = preferredPolicyIds
    .map((id) => candidateFor(id, retrieval))
    .filter((candidate): candidate is V4SystemicCandidate => Boolean(
      candidate && candidate.policy.answerability === "answer_evidence" && exactCandidateForNeed(need, candidate),
    ))
    .sort((left, right) =>
      (left.needScores?.[need.id]?.rank || left.rank) - (right.needScores?.[need.id]?.rank || right.rank),
    );
  for (const candidate of preferred) {
    const evidence = `${candidate.policy.title}: ${candidate.policy.decision}`;
    const queryTerms = new Set(v4AtomicTerms([
      need.authorityText || need.originalRequestText || need.text,
      ...need.retrievalQueries,
      ...need.actions,
      ...need.entities,
    ].join(" ")));
    const effectiveDate = candidate.policy.decision.match(/^As of (\d{4}-\d{2}-\d{2}),/i)?.[1] || "";
    const statements = [...new Set([
      candidateDecisionForNeed(need, candidate),
      candidate.policy.decision.split(/\b(?:Conditions?|Boundaries):/i)[0].trim(),
      ...getV4AtomicDecisionsForPolicy(candidate.policy.id).map((atom) => atom.statement),
    ])].map((value) => value.split(/\b(?:Conditions?|Boundaries):/i)[0].replace(/^['"]|['"]$/g, "").trim());
    const asksPermission = need.relation === "permission" ||
      /\b(?:can|could|may|allowed|permitted)\s+(?:a|the|our)?\s*(?:reps?|representatives?|closers?|salespersons?|we|i)\b/i.test(need.text);
    const ranked = statements.flatMap((raw) => {
      const statement = effectiveDate && !/^As of \d{4}-\d{2}-\d{2},/i.test(raw)
        ? `As of ${effectiveDate}, ${raw.charAt(0).toLowerCase()}${raw.slice(1)}`
        : raw;
      if (statement.length < 20 || statement.length > 500) return [];
      const effectComplete = asksPermission
        ? /\b(?:can|cannot|can't|may|allowed|not\s+allowed|permitted|do\s+not|don't|must\s+not|should\s+not|only)\b/i.test(statement)
        : need.relation === "requirement"
          ? /\b(?:must|should|required|need(?:s)?\s+to|do\s+not|don't|cannot|can't|only)\b/i.test(statement)
          : true;
      if (!effectComplete || v52OperationalEffectErrors(need, statement, evidence).length) return [];
      const identity = evaluateV52DecisionIdentity(need, candidate.policy, statement);
      if (!identity.exact) return [];
      const sharedTerms = v4AtomicTerms(statement).filter((term) => queryTerms.has(term)).length;
      return [{ statement, score: identity.score + sharedTerms }];
    }).sort((left, right) => right.score - left.score || left.statement.localeCompare(right.statement));
    if (ranked[0]) return { text: ranked[0].statement, policyId: candidate.policy.id, evidence };
  }
  return null;
}

function largestSafeConsensusCluster(need: V4SystemicNeed, candidates: V4SystemicCandidate[]) {
  const ordered = [...candidates].sort((left, right) =>
    (left.needScores?.[need.id]?.rank || left.rank) - (right.needScores?.[need.id]?.rank || right.rank),
  );
  const clusters = ordered.map((seed) => ordered.reduce<V4SystemicCandidate[]>((cluster, candidate) => {
    if (cluster.some((member) => member.policy.id === candidate.policy.id)) return cluster;
    return cluster.every((member) => v54MaterialEffectsSupport(
      candidateDecisionForNeed(need, member),
      candidateDecisionForNeed(need, candidate),
    )) ? [...cluster, candidate] : cluster;
  }, [seed])).sort((left, right) => right.length - left.length ||
    (left[0]?.needScores?.[need.id]?.rank || left[0]?.rank || 999) -
    (right[0]?.needScores?.[need.id]?.rank || right[0]?.rank || 999));
  const winner = clusters[0] || [];
  if (winner.length < 2) return [];
  const outside = ordered.filter((candidate) => !winner.some((member) => member.policy.id === candidate.policy.id));
  const materialOpposition = outside.some((candidate) => winner.some((member) => v54MaterialEffectsConflict(
    candidateDecisionForNeed(need, member),
    candidateDecisionForNeed(need, candidate),
  )));
  return materialOpposition ? [] : winner;
}

export function chooseV54DominantExactAnswer(
  need: V4SystemicNeed,
  retrieval: V4SystemicRetrieval,
) {
  const candidates = retrieval.candidates
    .filter((candidate) => candidate.policy.answerability === "answer_evidence" && exactCandidateForNeed(need, candidate))
    .sort((left, right) =>
      (right.needScores?.[need.id]?.score || right.score) - (left.needScores?.[need.id]?.score || left.score),
    );
  const winner = candidates[0] || null;
  const winnerScore = winner?.needScores?.[need.id]?.score || winner?.score || 0;
  const runnerUpScore = candidates[1]?.needScores?.[need.id]?.score || candidates[1]?.score || 0;
  const rank = winner?.needScores?.[need.id]?.rank || winner?.rank || 999;
  return {
    winner: winner && rank <= 2 && winnerScore - runnerUpScore >= 14 &&
      ["canonical", "trusted_evidence"].includes(winner.policy.quality_tier)
      ? winner
      : null,
    rank,
    margin: winnerScore - runnerUpScore,
    candidateIds: candidates.map((candidate) => candidate.policy.id),
  };
}

/**
 * Establishes support before conflict adjudication. Candidate identity still
 * has to pass the existing non-bypassable scope and exact-decision contract;
 * this layer only prevents mutually supporting records from being mistaken
 * for opposing policies because they arrived in an excluded-conflict bucket.
 */
export function refineV54SourcePlan(
  sourcePlan: V4SystemicSourcePlan,
  plan: V4SystemicQueryPlan,
  retrieval: V4SystemicRetrieval,
): V4SystemicSourcePlan {
  const preprocessedNeeds = sourcePlan.needs.map((sourceNeed): V4SystemicSourceNeedPlan => {
    const need = plan.needs.find((candidate) => candidate.id === sourceNeed.needId);
    if (!need || need.forcedRouteKey || need.ambiguity === "material" || need.requestKind !== "knowledge") return sourceNeed;

    if (sourceNeed.modelDisposition === "route") {
      const excludedExactAnswers = [...new Set(sourceNeed.excludedConflictPolicyIds)]
        .map((id) => candidateFor(id, retrieval))
        .filter((candidate): candidate is V4SystemicCandidate => Boolean(
          candidate && candidate.policy.answerability === "answer_evidence" && exactCandidateForNeed(need, candidate),
        ))
        .sort((left, right) =>
          (left.needScores?.[need.id]?.rank || left.rank) - (right.needScores?.[need.id]?.rank || right.rank),
        );
      const consensusCluster = largestSafeConsensusCluster(need, excludedExactAnswers);
      const consensus = consensusCluster.length >= 2;
      const dominant = excludedExactAnswers.length < 2
        ? chooseV54DominantExactAnswer(need, retrieval).winner
        : null;
      const recovered = consensus ? consensusCluster.slice(0, 3) : dominant ? [dominant] : [];
      const recoveredIds = recovered.map((candidate) => candidate.policy.id);
      if (recoveredIds.length) {
        return {
          ...sourceNeed,
          lane: "answer",
          directPolicyIds: recoveredIds,
          preferredPolicyIds: recoveredIds,
          excludedConflictPolicyIds: sourceNeed.excludedConflictPolicyIds.filter((id) => !recoveredIds.includes(id)),
          modelDisposition: "answer",
          modelDirectPolicyIds: recoveredIds,
          deterministicPolicyIds: recoveredIds,
          reason: consensus
            ? "V5.4 recovered multiple exact answer sources only after establishing that their material decisions agree."
            : "V5.4 recovered one uniquely dominant exact answer source after the model abstained on structural admission metadata.",
        };
      }
    }
    if (sourceNeed.modelDisposition !== "answer") return sourceNeed;

    const modelDirect = new Set(sourceNeed.modelDirectPolicyIds || []);
    const ids = [...new Set([
      ...modelDirect,
      ...sourceNeed.directPolicyIds,
      ...sourceNeed.preferredPolicyIds,
      ...sourceNeed.excludedConflictPolicyIds,
    ])];
    const exact = ids
      .map((id) => candidateFor(id, retrieval))
      .filter((candidate): candidate is V4SystemicCandidate => Boolean(
        candidate && candidate.policy.answerability === "answer_evidence" && exactCandidateForNeed(need, candidate),
      ))
      .sort((left, right) =>
        Number(modelDirect.has(right.policy.id)) - Number(modelDirect.has(left.policy.id)) ||
        (left.needScores?.[need.id]?.rank || left.rank) - (right.needScores?.[need.id]?.rank || right.rank),
      );
    const exactModelConfirmed = exact.filter((candidate) => modelDirect.has(candidate.policy.id));
    if (!exactModelConfirmed.length || !v54DecisionsFormConsensus(exact.map((candidate) => candidateDecisionForNeed(need, candidate)))) {
      return sourceNeed;
    }

    const preferredPolicyIds = exact.slice(0, 3).map((candidate) => candidate.policy.id);
    const exactIds = new Set(exact.map((candidate) => candidate.policy.id));
    return {
      ...sourceNeed,
      lane: "answer",
      directPolicyIds: [...new Set([...sourceNeed.directPolicyIds, ...preferredPolicyIds])],
      preferredPolicyIds,
      excludedConflictPolicyIds: sourceNeed.excludedConflictPolicyIds.filter((id) => !exactIds.has(id)),
      reason: "V5.4 established exact same-decision source consensus before contextual authority and conflict adjudication.",
    };
  });
  const refined = refineV53SourcePlan({ ...sourcePlan, needs: preprocessedNeeds }, plan, retrieval);
  return {
    ...refined,
    reasoningSummary: `${refined.reasoningSummary} V5.4 treated aligned exact records as support while retaining fail-closed behavior for genuine policy conflicts.`,
  };
}

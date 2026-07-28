import type { V3Provider, V3TurnResolution } from "@/lib/ask-sales-faq/v3/types";
import type { V4SystemicSourcePlan } from "@/lib/ask-sales-faq/v4/systemic/runtime";
import type { V4SystemicNeed, V4SystemicQueryPlan, V4SystemicRetrieval } from "@/lib/ask-sales-faq/v4/systemic/types";
import { v513DecisionContractErrors } from "@/lib/ask-sales-faq/v5-13/decision-contract";
import { refineV513SourcePlanWithRawEntailment } from "@/lib/ask-sales-faq/v5-13/entailment";

type EntailmentRecord = {
  policyId: string;
  verdict: string;
  confidence: number;
  supportingQuote: string;
  supportingQuoteVerified: boolean;
  supportingQuoteShapeVerified: boolean;
  uncoveredRequestElements: string[];
};

type EntailmentNeed = {
  needId: string;
  disposition: string;
  coverageMode: string;
  preferredPolicyIds: string[];
  uncoveredRequestElements: string[];
  materialConflict: boolean;
  records: EntailmentRecord[];
};

function modelNeeds(metadata: Record<string, unknown>) {
  const needs = metadata.needs;
  return Array.isArray(needs) ? needs as EntailmentNeed[] : [];
}

export function v514QuoteProjectable(need: V4SystemicNeed, retrieval: V4SystemicRetrieval, record: EntailmentRecord) {
  const candidate = retrieval.candidates.find((item) => item.policy.id === record.policyId && item.needScores?.[need.id]);
  if (!candidate || candidate.policy.systemic.ownerReviewRequired || candidate.policy.systemic.temporalRisk === "live_only") return false;
  if (!record.supportingQuoteVerified || !record.supportingQuoteShapeVerified || record.confidence < 0.9) return false;
  if (record.verdict !== "direct_answer" || record.uncoveredRequestElements.length) return false;
  if (candidate.policy.answerability !== "answer_evidence" && !(
    candidate.policy.answerability === "route_or_support" &&
    candidate.policy.systemic.sourceClass === "authoritative_operational_qna" &&
    candidate.policy.systemic.temporalRisk === "stable"
  )) return false;
  return !v513DecisionContractErrors(need, { ...candidate.policy, decision: record.supportingQuote }).length;
}

export function recoverV514QuoteVerifiedAnswers(
  sourcePlan: V4SystemicSourcePlan,
  plan: V4SystemicQueryPlan,
  retrieval: V4SystemicRetrieval,
  metadata: Record<string, unknown>,
) {
  const byNeed = new Map(modelNeeds(metadata).map((need) => [need.needId, need]));
  let recoveries = 0;
  let unsafeTemporalSelectionsBlocked = 0;
  const needs = sourcePlan.needs.map((sourceNeed) => {
    const need = plan.needs.find((item) => item.id === sourceNeed.needId);
    const modelNeed = byNeed.get(sourceNeed.needId);
    if (!need || need.forcedRouteKey) return sourceNeed;
    const exactFamily = retrieval.candidates.filter((candidate) =>
      candidate.needScores?.[need.id]?.matchedDecisionId.endsWith("::v514-exact-material-family") &&
      candidate.policy.answerability === "answer_evidence" &&
      !v513DecisionContractErrors(need, candidate.policy).length);
    if (exactFamily.length) {
      const ids = exactFamily.map((candidate) => candidate.policy.id);
      recoveries += 1;
      return {
        ...sourceNeed,
        lane: "answer" as const,
        directPolicyIds: ids,
        preferredPolicyIds: ids,
        excludedConflictPolicyIds: retrieval.candidates.filter((candidate) => candidate.needScores?.[need.id] && !ids.includes(candidate.policy.id)).map((candidate) => candidate.policy.id),
        modelDisposition: sourceNeed.modelDisposition,
        modelDirectPolicyIds: sourceNeed.modelDirectPolicyIds,
        deterministicPolicyIds: ids,
        reason: "V5.14 admitted the complete governed decision family for the exact material relationship after every member passed the final decision contract.",
      };
    }
    const unsafeTemporalPolicyIds = sourceNeed.preferredPolicyIds.filter((id) => {
      const policy = retrieval.candidates.find((candidate) => candidate.policy.id === id)?.policy;
      return Boolean(policy && /\b(?:not\s+(?:yet\s+)?live|currently\s+live|should\s+be\s+live|live\s+on\s+istv|on\s+air\s+(?:now|currently))\b/i.test(policy.decision));
    });
    if (sourceNeed.lane === "answer" && unsafeTemporalPolicyIds.length) {
      unsafeTemporalSelectionsBlocked += 1;
      return {
        ...sourceNeed,
        lane: "route" as const,
        directPolicyIds: [],
        preferredPolicyIds: [],
        excludedConflictPolicyIds: [...new Set([...sourceNeed.excludedConflictPolicyIds, ...sourceNeed.directPolicyIds])],
        modelDisposition: "route" as const,
        modelDirectPolicyIds: [],
        deterministicPolicyIds: [],
        reason: "V5.14 withheld time-sensitive support evidence from direct answer projection; current status requires confirmation.",
      };
    }
    if (need.ambiguity === "material") return sourceNeed;
    if (!modelNeed) return sourceNeed;
    if (modelNeed.disposition !== "answer" || modelNeed.materialConflict || modelNeed.uncoveredRequestElements.length) return sourceNeed;
    const preferred = modelNeed.preferredPolicyIds;
    if (!preferred.length || preferred.length > 12) return sourceNeed;
    const records = preferred.map((id) => modelNeed.records.find((record) => record.policyId === id)).filter((record): record is EntailmentRecord => Boolean(record));
    if (records.length !== preferred.length || !records.every((record) => v514QuoteProjectable(need, retrieval, record))) return sourceNeed;
    if (preferred.length > 1 && preferred.some((id) => retrieval.candidates.find((candidate) => candidate.policy.id === id)?.policy.answerability !== "answer_evidence")) return sourceNeed;
    recoveries += 1;
    return {
      ...sourceNeed,
      lane: "answer" as const,
      directPolicyIds: preferred,
      preferredPolicyIds: preferred,
      excludedConflictPolicyIds: retrieval.candidates.filter((candidate) => candidate.needScores?.[need.id] && !preferred.includes(candidate.policy.id)).map((candidate) => candidate.policy.id),
      modelDisposition: "answer" as const,
      modelDirectPolicyIds: preferred,
      deterministicPolicyIds: [],
      reason: "V5.14 preserved the model-selected, verbatim-verified direct source quote after the whole-record projection gate would otherwise discard it.",
    };
  });
  return {
    sourcePlan: {
      ...sourcePlan,
      needs,
      reasoningSummary: `${sourcePlan.reasoningSummary} V5.14 recovered ${recoveries} quote-verified answer admission(s) and blocked ${unsafeTemporalSelectionsBlocked} unsafe temporal support selection(s).`,
    },
    recoveries,
    unsafeTemporalSelectionsBlocked,
  };
}

export async function refineV514SourcePlanWithRawEntailment(input: {
  turn: V3TurnResolution;
  plan: V4SystemicQueryPlan;
  retrieval: V4SystemicRetrieval;
  sourcePlan: V4SystemicSourcePlan;
  provider: V3Provider;
}) {
  const prior = await refineV513SourcePlanWithRawEntailment(input);
  const recovered = recoverV514QuoteVerifiedAnswers(prior.sourcePlan, input.plan, input.retrieval, prior.metadata);
  return {
    ...prior,
    sourcePlan: recovered.sourcePlan,
    metadata: {
      ...prior.metadata,
      v514QuoteVerifiedAdmissionRecoveries: recovered.recoveries,
      v514UnsafeTemporalSelectionsBlocked: recovered.unsafeTemporalSelectionsBlocked,
    },
  };
}

export function v514VerifiedQuoteForNeed(
  needId: string,
  policyId: string,
  metadata?: Record<string, unknown>,
) {
  const need = metadata ? modelNeeds(metadata).find((item) => item.needId === needId) : null;
  const record = need?.records.find((item) => item.policyId === policyId);
  return record?.supportingQuoteVerified && record.supportingQuoteShapeVerified ? record.supportingQuote.trim() : "";
}

import type { V3Provider, V3TurnResolution } from "@/lib/ask-sales-faq/v3/types";
import type { V4SystemicSourcePlan } from "@/lib/ask-sales-faq/v4/systemic/runtime";
import type { V4SystemicQueryPlan, V4SystemicRetrieval } from "@/lib/ask-sales-faq/v4/systemic/types";
import { refineV510SourcePlanWithRawEntailment } from "@/lib/ask-sales-faq/v5-10/entailment";
import { v511ReviewedPolicyForNeed } from "@/lib/ask-sales-faq/v5-11/retrieval";

/**
 * The model still audits raw record entailment, but it cannot randomly withhold
 * a source-reviewed V5.11 synthesis after the deterministic family contract
 * has matched. All unmatched and ambiguous cases retain V5.10 fail-closed
 * behavior.
 */
export async function refineV511SourcePlanWithRawEntailment(input: {
  turn: V3TurnResolution;
  plan: V4SystemicQueryPlan;
  retrieval: V4SystemicRetrieval;
  sourcePlan: V4SystemicSourcePlan;
  provider: V3Provider;
}) {
  const result = await refineV510SourcePlanWithRawEntailment(input);
  let recoveries = 0;
  const needs = result.sourcePlan.needs.map((sourceNeed) => {
    const need = input.plan.needs.find((candidate) => candidate.id === sourceNeed.needId);
    if (!need || need.forcedRouteKey || need.ambiguity === "material") return sourceNeed;
    const reviewed = v511ReviewedPolicyForNeed(need, input.retrieval);
    if (!reviewed) return sourceNeed;
    recoveries += 1;
    return {
      ...sourceNeed,
      lane: "answer" as const,
      directPolicyIds: [reviewed.policy.id],
      preferredPolicyIds: [reviewed.policy.id],
      excludedConflictPolicyIds: input.retrieval.candidates
        .filter((candidate) => candidate.needScores?.[need.id] && candidate.policy.id !== reviewed.policy.id)
        .map((candidate) => candidate.policy.id),
      modelDisposition: "answer" as const,
      modelDirectPolicyIds: [reviewed.policy.id],
      deterministicPolicyIds: [reviewed.policy.id],
      reason: "V5.11 admitted the exact source-reviewed conditional synthesis after its immutable decision-family contract matched.",
    };
  });
  return {
    ...result,
    sourcePlan: {
      ...result.sourcePlan,
      needs,
      reasoningSummary: `${result.sourcePlan.reasoningSummary} V5.11 applied ${recoveries} bounded source-reviewed deterministic recoveries.`,
    },
    metadata: {
      ...result.metadata,
      v511SourceReviewedRecoveries: recoveries,
    },
  };
}

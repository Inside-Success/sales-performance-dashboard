import type { V3Provider, V3TurnResolution } from "@/lib/ask-sales-faq/v3/types";
import type { V4SystemicSourcePlan } from "@/lib/ask-sales-faq/v4/systemic/runtime";
import type { V4SystemicQueryPlan, V4SystemicRetrieval } from "@/lib/ask-sales-faq/v4/systemic/types";
import { refineV512SourcePlanWithRawEntailment } from "@/lib/ask-sales-faq/v5-12/entailment";
import { v513DecisionContractErrors, v513ImmutableNeedText } from "@/lib/ask-sales-faq/v5-13/decision-contract";
import { V513_CURRENT_STUDIO_ADDRESS_POLICY } from "@/lib/ask-sales-faq/v5-13/knowledge";
import { isV513CurrentStudioAddressNeed } from "@/lib/ask-sales-faq/v5-13/retrieval";

export function enforceV513DecisionContract(sourcePlan: V4SystemicSourcePlan, plan: V4SystemicQueryPlan, retrieval: V4SystemicRetrieval) {
  let rejectedSelections = 0;
  let addressSelections = 0;
  const rejectionReasons: Record<string, string[]> = {};
  const needs = sourcePlan.needs.map((sourceNeed) => {
    const need = plan.needs.find((item) => item.id === sourceNeed.needId);
    if (!need || need.forcedRouteKey || need.ambiguity === "material") return sourceNeed;

    if (isV513CurrentStudioAddressNeed(need)) {
      addressSelections += 1;
      return {
        ...sourceNeed,
        lane: "answer" as const,
        directPolicyIds: [V513_CURRENT_STUDIO_ADDRESS_POLICY.id],
        preferredPolicyIds: [V513_CURRENT_STUDIO_ADDRESS_POLICY.id],
        excludedConflictPolicyIds: retrieval.candidates.filter((item) => item.policy.id !== V513_CURRENT_STUDIO_ADDRESS_POLICY.id).map((item) => item.policy.id),
        modelDisposition: "answer" as const,
        modelDirectPolicyIds: [V513_CURRENT_STUDIO_ADDRESS_POLICY.id],
        deterministicPolicyIds: [V513_CURRENT_STUDIO_ADDRESS_POLICY.id],
        reason: "V5.13 selected the owner-confirmed current studio address for the exact location relationship.",
      };
    }

    const reviewed = retrieval.candidates.filter((item) => item.needScores?.[need.id] && item.policy.id.startsWith("v513src-"));
    if (reviewed.length === 1 && !v513DecisionContractErrors(need, reviewed[0].policy).length) {
      const id = reviewed[0].policy.id;
      return {
        ...sourceNeed,
        lane: "answer" as const,
        directPolicyIds: [id],
        preferredPolicyIds: [id],
        excludedConflictPolicyIds: retrieval.candidates.filter((item) => item.policy.id !== id).map((item) => item.policy.id),
        modelDisposition: "answer" as const,
        modelDirectPolicyIds: [id],
        deterministicPolicyIds: [id],
        reason: "V5.13 selected one narrowly activated source-reviewed decision after the immutable decision contract passed.",
      };
    }

    const immutableText = v513ImmutableNeedText(need);
    if (/\b(?:vip|premium)\b/i.test(immutableText) && /\b(?:platform|amazon|apple\s+tv|tubi)\b/i.test(immutableText) &&
        /\b(?:which|what|all|major|list|pay\s+extra|three|3)\b/i.test(immutableText)) {
      const platformBoundary = retrieval.candidates.find((item) => item.needScores?.[need.id] && item.policy.id === "owner-vip-tier-one-platform-boundary");
      if (platformBoundary && !v513DecisionContractErrors(need, platformBoundary.policy).length) {
        const id = platformBoundary.policy.id;
        return {
          ...sourceNeed,
          lane: "answer" as const,
          directPolicyIds: [id],
          preferredPolicyIds: [id],
          excludedConflictPolicyIds: retrieval.candidates.filter((item) => item.policy.id !== id).map((item) => item.policy.id),
          modelDisposition: "answer" as const,
          modelDirectPolicyIds: [id],
          deterministicPolicyIds: [id],
          reason: "V5.13 selected the existing owner-approved VIP Tier-1 platform boundary for the exact platform-list relationship.",
        };
      }
    }

    if (/recovered one uniquely more specific|senior[- ]exact|senior-authority/i.test(sourceNeed.reason)) {
      return {
        ...sourceNeed,
        lane: "route" as const,
        directPolicyIds: [],
        preferredPolicyIds: [],
        excludedConflictPolicyIds: [...new Set([...sourceNeed.excludedConflictPolicyIds, ...sourceNeed.directPolicyIds])],
        modelDisposition: "route" as const,
        modelDirectPolicyIds: [],
        deterministicPolicyIds: [],
        reason: "V5.13 declined the legacy senior-overlap recovery because the raw entailment model did not find a direct answer.",
      };
    }

    if (sourceNeed.lane !== "answer" || !sourceNeed.preferredPolicyIds.length) return sourceNeed;
    const errors = sourceNeed.preferredPolicyIds.flatMap((id) => {
      const policy = retrieval.candidates.find((item) => item.policy.id === id)?.policy;
      return policy ? v513DecisionContractErrors(need, policy).map((error) => `${id}:${error}`) : [`${id}:selected_policy_missing`];
    });
    if (!errors.length) return sourceNeed;
    rejectedSelections += 1;
    rejectionReasons[need.id] = errors;
    return {
      ...sourceNeed,
      lane: "route" as const,
      directPolicyIds: [],
      preferredPolicyIds: [],
      excludedConflictPolicyIds: [...new Set([...sourceNeed.excludedConflictPolicyIds, ...sourceNeed.directPolicyIds])],
      modelDisposition: "route" as const,
      modelDirectPolicyIds: [],
      deterministicPolicyIds: [],
      reason: `V5.13 withheld a source that failed the immutable decision contract (${errors.join(", ")}).`,
    };
  });
  return {
    sourcePlan: {
      ...sourcePlan,
      needs,
      reasoningSummary: `${sourcePlan.reasoningSummary} V5.13 rejected ${rejectedSelections} relationship-incompatible selection(s) and applied ${addressSelections} owner-confirmed current-address selection(s).`,
    },
    metadata: { rejectedSelections, addressSelections, rejectionReasons },
  };
}

export async function refineV513SourcePlanWithRawEntailment(input: {
  turn: V3TurnResolution;
  plan: V4SystemicQueryPlan;
  retrieval: V4SystemicRetrieval;
  sourcePlan: V4SystemicSourcePlan;
  provider: V3Provider;
}) {
  const prior = await refineV512SourcePlanWithRawEntailment(input);
  const final = enforceV513DecisionContract(prior.sourcePlan, input.plan, input.retrieval);
  return {
    ...prior,
    sourcePlan: final.sourcePlan,
    metadata: { ...prior.metadata, v513DecisionContract: final.metadata },
  };
}

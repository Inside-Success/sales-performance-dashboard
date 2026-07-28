import type { AskSalesFaqChatMessage } from "@/lib/ask-sales-faq/types";
import {
  runAskSalesFaqV4SystemicCandidateWithProfile,
  type V4SystemicCandidateRuntimeProfile,
} from "@/lib/ask-sales-faq/v4/systemic/runtime";
import type { V4RuntimeOptions } from "@/lib/ask-sales-faq/v4/types";
import type { V4SystemicNeed, V4SystemicNeedDecision, V4SystemicQueryPlan, V4SystemicRetrieval } from "@/lib/ask-sales-faq/v4/systemic/types";
import { v52OperationalEffectErrors } from "@/lib/ask-sales-faq/v5/decision-contract";
import { v54ExactSourceFallbackSentence } from "@/lib/ask-sales-faq/v5/source-control";
import { naturalizeV57Decision, preferredV57ExactEvidenceSentence } from "@/lib/ask-sales-faq/v5-7/runtime";
import { resolveV58RouteKey } from "@/lib/ask-sales-faq/v5-8/runtime";
import { refineV59QueryPlan } from "@/lib/ask-sales-faq/v5-9/runtime";
import { resolveV59Turn } from "@/lib/ask-sales-faq/v5-9/turn";
import { refineV510SourcePlanWithRawEntailment } from "@/lib/ask-sales-faq/v5-10/entailment";
import { getV510KnowledgeVersion, getV510OperationalPolicyCount } from "@/lib/ask-sales-faq/v5-10/knowledge";
import { retrieveV510Policies, v510DecisionFamilyForNeed } from "@/lib/ask-sales-faq/v5-10/retrieval";

export const ASK_SALES_V510_PIPELINE_VERSION = "v5.10-isolated" as const;
export const ASK_SALES_V510_DECISION_LAYER_VERSION = "decision-family-evidence-control-r1";

export function resolveV510RouteKey(
  need: V4SystemicNeed,
  decision: V4SystemicNeedDecision,
  retrieval: V4SystemicRetrieval,
): NonNullable<V4SystemicNeedDecision["routeKey"]> {
  if (need.forcedRouteKey) return resolveV58RouteKey(need, decision, retrieval);
  // An unanswered passive FAQ belongs in the general policy channel. Evidence
  // route hints may only choose an operational owner after the immutable user
  // request was deterministically classified as a live action.
  if (need.requestKind === "knowledge") return "sales_policy";
  return resolveV58RouteKey(need, decision, retrieval);
}

export function preferredV510ExactEvidenceSentence(
  need: V4SystemicNeed,
  plan: V4SystemicQueryPlan,
  retrieval: V4SystemicRetrieval,
  preferredPolicyIds: string[],
  metadata?: Record<string, unknown>,
) {
  const exact = preferredV57ExactEvidenceSentence(need, plan, retrieval, preferredPolicyIds, metadata);
  if (!exact || v510DecisionFamilyForNeed(need) !== "missed_call2_reapplication") return exact;
  const policy = retrieval.candidates.find((candidate) => candidate.policy.id === exact.policyId)?.policy;
  if (!policy || !/\bmust\s+reapply\s+in\s+90\s+days?\b/i.test(policy.decision)) return exact;
  return {
    ...exact,
    text: exact.text.replace(/^Yes,\s+the\s+correct\s+policy\s+is\s+that\s+the\s+prospect\s+/i, "No. The prospect "),
  };
}

const profile: V4SystemicCandidateRuntimeProfile = {
  pipelineVersion: ASK_SALES_V510_PIPELINE_VERSION,
  knowledgeVersion: getV510KnowledgeVersion,
  operationalPolicyCount: getV510OperationalPolicyCount,
  resolveTurn: resolveV59Turn,
  retrieve: retrieveV510Policies,
  refineQueryPlan: refineV59QueryPlan,
  resolveRouteKey: resolveV510RouteKey,
  sentenceBoundaryErrors: v52OperationalEffectErrors,
  allowGenericRichAuthority: false,
  skipLegacySourcePlanner: true,
  refineSourcePlanWithModel: refineV510SourcePlanWithRawEntailment,
  exactSourceFallbackSentence: v54ExactSourceFallbackSentence,
  preferredExactEvidenceSentence: preferredV510ExactEvidenceSentence,
  trustPreferredExactEvidence: true,
  trustPreferredCollectiveEvidence: true,
  precomposePreferredEvidence: true,
  appendRouteForAnsweredSupport: false,
  fallbackLabel: "Frozen V4",
  fallbackOnEmptyRetrieval: false,
  fallbackOnStageFailure: false,
};

export async function runAskSalesFaqV510(
  question: string,
  conversationMessages: AskSalesFaqChatMessage[] = [],
  options: V4RuntimeOptions = {},
) {
  return runAskSalesFaqV4SystemicCandidateWithProfile(question, conversationMessages, options, profile);
}

export { naturalizeV57Decision as naturalizeV510Decision };

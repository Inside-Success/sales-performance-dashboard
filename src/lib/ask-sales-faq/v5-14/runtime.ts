import type { AskSalesFaqChatMessage } from "@/lib/ask-sales-faq/types";
import { runAskSalesFaqV4SystemicCandidateWithProfile, type V4SystemicCandidateRuntimeProfile } from "@/lib/ask-sales-faq/v4/systemic/runtime";
import type { V4RuntimeOptions } from "@/lib/ask-sales-faq/v4/types";
import type { V4SystemicNeed, V4SystemicQueryPlan, V4SystemicRetrieval } from "@/lib/ask-sales-faq/v4/systemic/types";
import { v52OperationalEffectErrors } from "@/lib/ask-sales-faq/v5/decision-contract";
import { naturalizeV512Decision, preferredV512EvidenceSentence, refineV512QueryPlan, resolveV512RouteKey, resolveV512Turn, v512ExactSourceFallbackSentence } from "@/lib/ask-sales-faq/v5-12/runtime";
import { v513DecisionContractErrors } from "@/lib/ask-sales-faq/v5-13/decision-contract";
import { refineV514SourcePlanWithRawEntailment, v514VerifiedQuoteForNeed } from "@/lib/ask-sales-faq/v5-14/entailment";
import { getV514KnowledgeVersion, getV514OperationalPolicyCount } from "@/lib/ask-sales-faq/v5-14/knowledge";
import { retrieveV514Policies } from "@/lib/ask-sales-faq/v5-14/retrieval";

export const ASK_SALES_V514_PIPELINE_VERSION = "v5.14-isolated" as const;
export const ASK_SALES_V514_DECISION_LAYER_VERSION = "governed-source-preservation-quote-verified-projection-r1";

function preferredV514EvidenceSentence(
  need: V4SystemicNeed,
  plan: V4SystemicQueryPlan,
  retrieval: V4SystemicRetrieval,
  preferredPolicyIds: string[],
  metadata?: Record<string, unknown>,
) {
  if (preferredPolicyIds.length !== 1) return preferredV512EvidenceSentence(need, plan, retrieval, preferredPolicyIds, metadata);
  const policyId = preferredPolicyIds[0];
  const candidate = retrieval.candidates.find((item) => item.policy.id === policyId);
  const policy = candidate?.policy;
  const matchedDecisionId = candidate?.needScores?.[need.id]?.matchedDecisionId || "";
  const needsQuoteProjection =
    policy?.answerability === "route_or_support" ||
    policy?.id.startsWith("v514src-") ||
    matchedDecisionId.endsWith("::v514-governed-v3-preservation") ||
    matchedDecisionId.endsWith("::v514-exact-material-family");
  const quote = needsQuoteProjection ? v514VerifiedQuoteForNeed(need.id, policyId, metadata) : null;
  if (quote && policy && !v513DecisionContractErrors(need, { ...policy, decision: quote }).length) {
    return { text: naturalizeV512Decision(quote), policyId, evidence: `${policy.title}: ${quote}` };
  }
  return preferredV512EvidenceSentence(need, plan, retrieval, preferredPolicyIds, metadata);
}

const profile: V4SystemicCandidateRuntimeProfile = {
  pipelineVersion: ASK_SALES_V514_PIPELINE_VERSION,
  knowledgeVersion: getV514KnowledgeVersion,
  operationalPolicyCount: getV514OperationalPolicyCount,
  resolveTurn: resolveV512Turn,
  retrieve: retrieveV514Policies,
  refineQueryPlan: refineV512QueryPlan,
  resolveRouteKey: resolveV512RouteKey,
  sentenceBoundaryErrors: v52OperationalEffectErrors,
  allowGenericRichAuthority: false,
  skipLegacySourcePlanner: true,
  refineSourcePlanWithModel: refineV514SourcePlanWithRawEntailment,
  exactSourceFallbackSentence: v512ExactSourceFallbackSentence,
  disableDefaultExactSourceFallback: true,
  preferredExactEvidenceSentence: preferredV514EvidenceSentence,
  trustPreferredExactEvidence: true,
  trustPreferredCollectiveEvidence: true,
  precomposePreferredEvidence: true,
  appendRouteForAnsweredSupport: false,
  evidenceDraftPurpose: "v5_14_quote_verified_answer_projection_validation",
  evidenceDraftRetryPurpose: "v5_14_quote_verified_answer_projection_retry_validation",
  fallbackLabel: "Frozen V4",
  fallbackOnEmptyRetrieval: false,
  fallbackOnStageFailure: false,
};

export async function runAskSalesFaqV514(question: string, conversationMessages: AskSalesFaqChatMessage[] = [], options: V4RuntimeOptions = {}) {
  return runAskSalesFaqV4SystemicCandidateWithProfile(question, conversationMessages, options, profile);
}

import type { AskSalesFaqChatMessage } from "@/lib/ask-sales-faq/types";
import { runAskSalesFaqV4SystemicCandidateWithProfile, type V4SystemicCandidateRuntimeProfile } from "@/lib/ask-sales-faq/v4/systemic/runtime";
import type { V4RuntimeOptions } from "@/lib/ask-sales-faq/v4/types";
import { v52OperationalEffectErrors } from "@/lib/ask-sales-faq/v5/decision-contract";
import { refineV512QueryPlan, preferredV512EvidenceSentence, resolveV512RouteKey, resolveV512Turn, v512ExactSourceFallbackSentence } from "@/lib/ask-sales-faq/v5-12/runtime";
import { refineV513SourcePlanWithRawEntailment } from "@/lib/ask-sales-faq/v5-13/entailment";
import { getV513KnowledgeVersion, getV513OperationalPolicyCount } from "@/lib/ask-sales-faq/v5-13/knowledge";
import { retrieveV513Policies } from "@/lib/ask-sales-faq/v5-13/retrieval";

export const ASK_SALES_V513_PIPELINE_VERSION = "v5.13-isolated" as const;
export const ASK_SALES_V513_DECISION_LAYER_VERSION = "immutable-final-decision-contract-current-address-r1";

const profile: V4SystemicCandidateRuntimeProfile = {
  pipelineVersion: ASK_SALES_V513_PIPELINE_VERSION,
  knowledgeVersion: getV513KnowledgeVersion,
  operationalPolicyCount: getV513OperationalPolicyCount,
  resolveTurn: resolveV512Turn,
  retrieve: retrieveV513Policies,
  refineQueryPlan: refineV512QueryPlan,
  resolveRouteKey: resolveV512RouteKey,
  sentenceBoundaryErrors: v52OperationalEffectErrors,
  allowGenericRichAuthority: false,
  skipLegacySourcePlanner: true,
  refineSourcePlanWithModel: refineV513SourcePlanWithRawEntailment,
  exactSourceFallbackSentence: v512ExactSourceFallbackSentence,
  disableDefaultExactSourceFallback: true,
  preferredExactEvidenceSentence: preferredV512EvidenceSentence,
  trustPreferredExactEvidence: true,
  trustPreferredCollectiveEvidence: true,
  precomposePreferredEvidence: true,
  appendRouteForAnsweredSupport: false,
  evidenceDraftPurpose: "v5_13_evidence_answer_projection_validation",
  evidenceDraftRetryPurpose: "v5_13_evidence_answer_projection_retry_validation",
  fallbackLabel: "Frozen V4",
  fallbackOnEmptyRetrieval: false,
  fallbackOnStageFailure: false,
};

export async function runAskSalesFaqV513(question: string, conversationMessages: AskSalesFaqChatMessage[] = [], options: V4RuntimeOptions = {}) {
  return runAskSalesFaqV4SystemicCandidateWithProfile(question, conversationMessages, options, profile);
}

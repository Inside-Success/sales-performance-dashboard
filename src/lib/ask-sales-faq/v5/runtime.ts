import type { AskSalesFaqChatMessage } from "@/lib/ask-sales-faq/types";
import {
  runAskSalesFaqV4SystemicCandidateWithProfile,
  type V4SystemicCandidateRuntimeProfile,
} from "@/lib/ask-sales-faq/v4/systemic/runtime";
import type { V4RuntimeOptions } from "@/lib/ask-sales-faq/v4/types";
import { v52OperationalEffectErrors } from "@/lib/ask-sales-faq/v5/decision-contract";
import { refineV53QueryPlan, resolveV53RouteKey } from "@/lib/ask-sales-faq/v5/decision-routing";
import { getV5KnowledgeVersion, getV5OperationalPolicyCount } from "@/lib/ask-sales-faq/v5/knowledge";
import { retrieveV5Policies } from "@/lib/ask-sales-faq/v5/retrieval";
import { refineV53SourcePlan } from "@/lib/ask-sales-faq/v5/source-control";

export const ASK_SALES_V51_PIPELINE_VERSION = "v5.3-isolated" as const;
export const ASK_SALES_V51_DECISION_LAYER_VERSION = "evidence-admission-r3";

export function getV51KnowledgeVersion() {
  return `${getV5KnowledgeVersion()}+v53_${ASK_SALES_V51_DECISION_LAYER_VERSION}`;
}

const profile: V4SystemicCandidateRuntimeProfile = {
  pipelineVersion: ASK_SALES_V51_PIPELINE_VERSION,
  knowledgeVersion: getV51KnowledgeVersion,
  operationalPolicyCount: getV5OperationalPolicyCount,
  retrieve: retrieveV5Policies,
  refineQueryPlan: refineV53QueryPlan,
  resolveRouteKey: resolveV53RouteKey,
  sentenceBoundaryErrors: v52OperationalEffectErrors,
  allowGenericRichAuthority: false,
  refineSourcePlan: refineV53SourcePlan,
  appendRouteForAnsweredSupport: true,
  fallbackLabel: "Frozen V4",
  fallbackOnEmptyRetrieval: false,
  fallbackOnStageFailure: false,
};

export async function runAskSalesFaqV5(
  question: string,
  conversationMessages: AskSalesFaqChatMessage[] = [],
  options: V4RuntimeOptions = {},
) {
  return runAskSalesFaqV4SystemicCandidateWithProfile(question, conversationMessages, options, profile);
}

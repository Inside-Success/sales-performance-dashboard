import type { AskSalesFaqChatMessage } from "@/lib/ask-sales-faq/types";
import {
  runAskSalesFaqV4SystemicCandidateWithProfile,
  type V4SystemicCandidateRuntimeProfile,
} from "@/lib/ask-sales-faq/v4/systemic/runtime";
import type { V4RuntimeOptions } from "@/lib/ask-sales-faq/v4/types";
import type { V4SystemicNeed, V4SystemicQueryPlan } from "@/lib/ask-sales-faq/v4/systemic/types";
import { v52OperationalEffectErrors } from "@/lib/ask-sales-faq/v5/decision-contract";
import { v54ExactSourceFallbackSentence } from "@/lib/ask-sales-faq/v5/source-control";
import { naturalizeV57Decision, preferredV57ExactEvidenceSentence } from "@/lib/ask-sales-faq/v5-7/runtime";
import { refineV59QueryPlan } from "@/lib/ask-sales-faq/v5-9/runtime";
import { resolveV510RouteKey } from "@/lib/ask-sales-faq/v5-10/runtime";
import { refineV511SourcePlanWithRawEntailment } from "@/lib/ask-sales-faq/v5-11/entailment";
import { getV511KnowledgeVersion, getV511OperationalPolicyCount } from "@/lib/ask-sales-faq/v5-11/knowledge";
import { retrieveV511Policies } from "@/lib/ask-sales-faq/v5-11/retrieval";
import { resolveV511Turn } from "@/lib/ask-sales-faq/v5-11/turn";

export const ASK_SALES_V511_PIPELINE_VERSION = "v5.11-isolated" as const;
export const ASK_SALES_V511_DECISION_LAYER_VERSION = "source-reconciled-bounded-control-r1";

const EXPLICIT_CHATBOT_ACTION = /\b(?:can|could|would|will)\s+(?:you|the\s+chatbot)\b|^\s*(?:please\s+)?(?:create|generate|send|provide|issue|make|get)\b/i;
const ZOOM_LINK_ACTION = /\bzoom\b[\s\S]{0,80}\b(?:link|meeting)\b|\b(?:link|meeting)\b[\s\S]{0,80}\bzoom\b/i;
const SELF_GENERATED_LEAD_OVERVIEW = /\b(?:self[- ]generated\s+lead|generated\s+the\s+lead\s+myself|my\s+own\s+lead)\b/i;
const OVERVIEW_DIFFERENCE = /\b(?:anything\s+different|what(?:\s+else)?\s+should\s+i|make\s+sure|special\s+steps?|different\s+onboarding)\b/i;
const EXPLICIT_COMMISSION_MECHANISM = /\b(?:how|where)\b[\s\S]{0,100}\b(?:enter|record|submit|apply|calculate)\b[\s\S]{0,80}\b(?:commission|20\s*%)\b/i;

function completeNeedText(need: V4SystemicNeed) {
  return [need.authorityText, need.originalRequestText, need.text, ...need.retrievalQueries, ...need.domains, ...need.actions, ...need.entities]
    .filter(Boolean)
    .join(" ");
}

export function refineV511QueryPlan(
  plan: V4SystemicQueryPlan,
  turn: Parameters<typeof refineV59QueryPlan>[1],
) {
  const refined = refineV59QueryPlan(plan, turn);
  const immutableQuestion = turn.currentQuestion || turn.standaloneQuestion;
  const mergeSelfGeneratedOverview = refined.needs.length > 1 &&
    SELF_GENERATED_LEAD_OVERVIEW.test(immutableQuestion) &&
    OVERVIEW_DIFFERENCE.test(immutableQuestion) &&
    !EXPLICIT_COMMISSION_MECHANISM.test(immutableQuestion);
  const initialNeeds = mergeSelfGeneratedOverview ? [{
    ...refined.needs[0],
    id: "N1",
    text: immutableQuestion,
    authorityText: immutableQuestion,
    originalRequestText: immutableQuestion,
    retrievalQueries: [...new Set([immutableQuestion, ...refined.needs.flatMap((need) => need.retrievalQueries)])],
    relation: "procedure" as const,
    requestKind: "knowledge" as const,
    forcedRouteKey: null,
  }] : refined.needs;
  if (!EXPLICIT_CHATBOT_ACTION.test(immutableQuestion) || !ZOOM_LINK_ACTION.test(immutableQuestion)) {
    return mergeSelfGeneratedOverview ? {
      ...refined,
      needs: initialNeeds,
      reasoningSummary: refined.reasoningSummary + " V5.11 kept a general self-generated-lead difference question as one overview instead of inventing an unasked commission-entry procedure.",
    } : refined;
  }
  const needs = initialNeeds.map((need) => {
    const text = `${immutableQuestion} ${completeNeedText(need)}`;
    if (!ZOOM_LINK_ACTION.test(text)) return need;
    return {
      ...need,
      requestKind: "operational_action" as const,
      forcedRouteKey: "sales_tech" as const,
    };
  });
  return {
    ...refined,
    needs,
    reasoningSummary: `${refined.reasoningSummary} V5.11 deterministically routes explicit Zoom-link generation actions to Sales Tech without changing passive Zoom policy questions.`,
  };
}

const profile: V4SystemicCandidateRuntimeProfile = {
  pipelineVersion: ASK_SALES_V511_PIPELINE_VERSION,
  knowledgeVersion: getV511KnowledgeVersion,
  operationalPolicyCount: getV511OperationalPolicyCount,
  resolveTurn: resolveV511Turn,
  retrieve: retrieveV511Policies,
  refineQueryPlan: refineV511QueryPlan,
  resolveRouteKey: resolveV510RouteKey,
  sentenceBoundaryErrors: v52OperationalEffectErrors,
  allowGenericRichAuthority: false,
  skipLegacySourcePlanner: true,
  refineSourcePlanWithModel: refineV511SourcePlanWithRawEntailment,
  exactSourceFallbackSentence: v54ExactSourceFallbackSentence,
  preferredExactEvidenceSentence: preferredV57ExactEvidenceSentence,
  trustPreferredExactEvidence: true,
  trustPreferredCollectiveEvidence: true,
  precomposePreferredEvidence: true,
  appendRouteForAnsweredSupport: false,
  fallbackLabel: "Frozen V4",
  fallbackOnEmptyRetrieval: false,
  fallbackOnStageFailure: false,
};

export async function runAskSalesFaqV511(
  question: string,
  conversationMessages: AskSalesFaqChatMessage[] = [],
  options: V4RuntimeOptions = {},
) {
  return runAskSalesFaqV4SystemicCandidateWithProfile(question, conversationMessages, options, profile);
}

export { naturalizeV57Decision as naturalizeV511Decision };

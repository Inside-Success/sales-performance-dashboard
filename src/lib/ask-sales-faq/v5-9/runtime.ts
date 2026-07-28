import type { AskSalesFaqChatMessage } from "@/lib/ask-sales-faq/types";
import {
  runAskSalesFaqV4SystemicCandidateWithProfile,
  type V4SystemicCandidateRuntimeProfile,
} from "@/lib/ask-sales-faq/v4/systemic/runtime";
import type { V4RuntimeOptions } from "@/lib/ask-sales-faq/v4/types";
import type { V4SystemicNeed, V4SystemicQueryPlan } from "@/lib/ask-sales-faq/v4/systemic/types";
import { v52OperationalEffectErrors } from "@/lib/ask-sales-faq/v5/decision-contract";
import { v54ExactSourceFallbackSentence } from "@/lib/ask-sales-faq/v5/source-control";
import {
  naturalizeV57Decision,
  preferredV57ExactEvidenceSentence,
  refineV57QueryPlan,
} from "@/lib/ask-sales-faq/v5-7/runtime";
import { resolveV58RouteKey } from "@/lib/ask-sales-faq/v5-8/runtime";
import { refineV59SourcePlanWithRawEntailment } from "@/lib/ask-sales-faq/v5-9/entailment";
import { getV59KnowledgeVersion, getV59OperationalPolicyCount } from "@/lib/ask-sales-faq/v5-9/knowledge";
import { retrieveV59Policies } from "@/lib/ask-sales-faq/v5-9/retrieval";
import { resolveV59Turn } from "@/lib/ask-sales-faq/v5-9/turn";

export const ASK_SALES_V59_PIPELINE_VERSION = "v5.9-isolated" as const;
export const ASK_SALES_V59_DECISION_LAYER_VERSION = "full-record-context-r1";

const REPORTING_DEFINITION = /\b(?:should|do|does|what|which|how)\b[\s\S]{0,180}\b(?:count|counted|include|included|classif(?:y|ied)|categor(?:y|ize|ized)|mean|definition)\b[\s\S]{0,160}\b(?:daily\s+stats?|scheduled\s+calls?|report(?:ing)?)\b|\b(?:daily\s+stats?|scheduled\s+calls?|report(?:ing)?)\b[\s\S]{0,180}\b(?:count|counted|include|included|classif(?:y|ied)|categor(?:y|ize|ized)|mean|definition)\b/i;
const STABLE_NAVIGATION = /\bwhere\s+should\s+(?:i|we|reps?)\s+(?:find|look|check|confirm|verify|see)\b/i;
const CHATBOT_ACTION_REQUEST = /\b(?:can|could|would|will)\s+(?:you|the\s+chatbot)\b|^\s*(?:please\s+)?(?:block|cancel|change|combine|create|delete|expedite|fix|generate|import|issue|locate|merge|migrate|move|prepare|reassign|remove|replace|send|trace|transfer|update|verify)\b/i;
const CRM_OR_CALENDAR_MUTATION = /\b(?:block|combine|merge|deduplicat\w*|replace|remove|delete|correct|fix|update|change|reassign|reschedule|cancel|transfer|import|migrate|move)\b[\s\S]{0,160}\b(?:crm|hubspot|keap|lead|record|calendar|appointment|booking)\b|\b(?:crm|hubspot|keap|lead|record|calendar|appointment|booking)\b[\s\S]{0,160}\b(?:block|combine|merge|deduplicat\w*|replace|remove|delete|correct|fix|update|change|reassign|reschedule|cancel|transfer|import|migrate|move)\b/i;
const POST_SALE_FULFILLMENT_LIVE = /\b(?:cast\s+member|client|post[- ]sale|onboarding|filming|production|marketing\s+event|event)\b[\s\S]{0,180}\b(?:availability|spaces?|capacity|registration|expired|broken|link|schedule|delivery|fix|check)\b|\b(?:availability|spaces?|capacity|registration|expired|broken|link|schedule|delivery|fix|check)\b[\s\S]{0,180}\b(?:cast\s+member|client|post[- ]sale|onboarding|filming|production|marketing\s+event|event)\b/i;
const FINANCE_LIVE = /\b(?:locate|trace|verify|confirm|check|status|pending|missing|failed|declined|refund|reverse|void)\b[\s\S]{0,140}\b(?:payment|ach|wire|invoice|charge|transaction)\b|\b(?:payment|ach|wire|invoice|charge|transaction)\b[\s\S]{0,140}\b(?:locate|trace|verify|confirm|check|status|pending|missing|failed|declined|refund|reverse|void)\b/i;
const GREENLIGHT_LIVE = /\b(?:create|prepare|send|generate|issue|expedite|check|status|missing)\b[\s\S]{0,120}\b(?:green\s*light|greenlight)(?:\s+letter)?\b|\b(?:green\s*light|greenlight)(?:\s+letter)?\b[\s\S]{0,120}\b(?:create|prepare|send|generate|issue|expedite|check|status|missing)\b/i;
const POST_BOOKING_COMMUNICATION_CORRECTION = /\b(?:booked|scheduled)\b[\s\S]{0,160}\b(?:forgot|did\s+not|didn['’]?t|failed)\b[\s\S]{0,120}\b(?:confirm|tell|mention|explain|clarify)\b|\b(?:forgot|did\s+not|didn['’]?t|failed)\b[\s\S]{0,120}\b(?:confirm|tell|mention|explain|clarify)\b[\s\S]{0,160}\b(?:booked|scheduled)\b/i;

function completeNeedText(need: V4SystemicNeed) {
  return [need.authorityText, need.originalRequestText, need.text, ...need.retrievalQueries, ...need.domains, ...need.actions, ...need.entities]
    .filter(Boolean)
    .join(" ");
}

export function refineV59QueryPlan(
  plan: V4SystemicQueryPlan,
  turn: Parameters<typeof refineV57QueryPlan>[1],
) {
  const refined = refineV57QueryPlan(plan, turn);
  const immutableQuestion = turn.currentQuestion || turn.standaloneQuestion;
  const explicitAction = CHATBOT_ACTION_REQUEST.test(immutableQuestion);
  const stableKnowledge = REPORTING_DEFINITION.test(immutableQuestion) ||
    (STABLE_NAVIGATION.test(immutableQuestion) && !explicitAction);
  const communicationCorrection = POST_BOOKING_COMMUNICATION_CORRECTION.test(immutableQuestion);
  const initialNeeds = communicationCorrection && refined.needs.length > 1
    ? [{
      ...refined.needs[0],
      id: "N1",
      text: immutableQuestion,
      authorityText: immutableQuestion,
      originalRequestText: immutableQuestion,
      retrievalQueries: [...new Set([immutableQuestion, ...refined.needs.flatMap((need) => need.retrievalQueries)])],
      relation: "procedure" as const,
      requestKind: "knowledge" as const,
      forcedRouteKey: null,
    }]
    : refined.needs;
  const needs = initialNeeds.map((need) => {
    const text = `${immutableQuestion} ${completeNeedText(need)}`;
    if (stableKnowledge) return {
      ...need,
      text: immutableQuestion,
      authorityText: immutableQuestion,
      originalRequestText: immutableQuestion,
      retrievalQueries: [...new Set([immutableQuestion, ...need.retrievalQueries])],
      relation: REPORTING_DEFINITION.test(immutableQuestion) ? "definition" as const : need.relation,
      requestKind: "knowledge" as const,
      forcedRouteKey: null,
    };
    if (explicitAction && GREENLIGHT_LIVE.test(text)) {
      return { ...need, requestKind: "operational_action" as const, forcedRouteKey: "greenlight" as const };
    }
    if (explicitAction && CRM_OR_CALENDAR_MUTATION.test(text)) {
      return { ...need, requestKind: "operational_action" as const, forcedRouteKey: "sales_tech" as const };
    }
    if (explicitAction && POST_SALE_FULFILLMENT_LIVE.test(text)) {
      return { ...need, requestKind: "operational_action" as const, forcedRouteKey: "fulfillment" as const };
    }
    if (explicitAction && FINANCE_LIVE.test(text)) {
      return { ...need, requestKind: "current_lookup" as const, forcedRouteKey: "finance" as const };
    }
    return { ...need, requestKind: "knowledge" as const, forcedRouteKey: null };
  });
  const changed = communicationCorrection || needs.some((need, index) => JSON.stringify(need) !== JSON.stringify(refined.needs[index]));
  return changed ? {
    ...refined,
    needs,
    reasoningSummary: `${refined.reasoningSummary} V5.9 separates explicit chatbot actions from first-person policy questions before assigning an operational owner.`,
  } : refined;
}

const profile: V4SystemicCandidateRuntimeProfile = {
  pipelineVersion: ASK_SALES_V59_PIPELINE_VERSION,
  knowledgeVersion: getV59KnowledgeVersion,
  operationalPolicyCount: getV59OperationalPolicyCount,
  resolveTurn: resolveV59Turn,
  retrieve: retrieveV59Policies,
  refineQueryPlan: refineV59QueryPlan,
  resolveRouteKey: resolveV58RouteKey,
  sentenceBoundaryErrors: v52OperationalEffectErrors,
  allowGenericRichAuthority: false,
  skipLegacySourcePlanner: true,
  refineSourcePlanWithModel: refineV59SourcePlanWithRawEntailment,
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

export async function runAskSalesFaqV59(
  question: string,
  conversationMessages: AskSalesFaqChatMessage[] = [],
  options: V4RuntimeOptions = {},
) {
  return runAskSalesFaqV4SystemicCandidateWithProfile(question, conversationMessages, options, profile);
}

export { naturalizeV57Decision as naturalizeV59Decision };

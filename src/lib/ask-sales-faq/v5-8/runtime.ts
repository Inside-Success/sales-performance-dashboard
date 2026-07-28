import type { AskSalesFaqChatMessage } from "@/lib/ask-sales-faq/types";
import {
  runAskSalesFaqV4SystemicCandidateWithProfile,
  type V4SystemicCandidateRuntimeProfile,
} from "@/lib/ask-sales-faq/v4/systemic/runtime";
import type { V4RuntimeOptions } from "@/lib/ask-sales-faq/v4/types";
import type {
  V4SystemicNeed,
  V4SystemicNeedDecision,
  V4SystemicQueryPlan,
  V4SystemicRetrieval,
} from "@/lib/ask-sales-faq/v4/systemic/types";
import { v52OperationalEffectErrors } from "@/lib/ask-sales-faq/v5/decision-contract";
import { v54ExactSourceFallbackSentence } from "@/lib/ask-sales-faq/v5/source-control";
import {
  naturalizeV57Decision,
  preferredV57ExactEvidenceSentence,
  refineV57QueryPlan,
  resolveV57RouteKey,
} from "@/lib/ask-sales-faq/v5-7/runtime";
import { refineV58SourcePlanWithRawEntailment } from "@/lib/ask-sales-faq/v5-8/entailment";
import { getV58KnowledgeVersion, getV58OperationalPolicyCount } from "@/lib/ask-sales-faq/v5-8/knowledge";
import { retrieveV58Policies } from "@/lib/ask-sales-faq/v5-8/retrieval";
import { resolveV58Turn } from "@/lib/ask-sales-faq/v5-8/turn";

export const ASK_SALES_V58_PIPELINE_VERSION = "v5.8-isolated" as const;
export const ASK_SALES_V58_DECISION_LAYER_VERSION = "relationship-owner-context-r1";

const REPORTING_DEFINITION = /\b(?:should|do|does|what|which|how)\b[\s\S]{0,180}\b(?:count|counted|include|included|classif(?:y|ied)|categor(?:y|ize|ized)|mean|definition)\b[\s\S]{0,160}\b(?:daily\s+stats?|scheduled\s+calls?|report(?:ing)?)\b|\b(?:daily\s+stats?|scheduled\s+calls?|report(?:ing)?)\b[\s\S]{0,180}\b(?:count|counted|include|included|classif(?:y|ied)|categor(?:y|ize|ized)|mean|definition)\b/i;
const STABLE_NAVIGATION = /\bwhere\s+should\s+(?:i|we|reps?)\s+(?:find|look|check|confirm|verify|see)\b/i;
const EXPLICIT_LIVE_LOOKUP = /\b(?:can|could)\s+(?:you|the\s+chatbot|someone)\b[\s\S]{0,120}\b(?:check|find|locate|fix|change|update|combine|replace|send|generate|trace|confirm)\b|\b(?:this|my|our|that)\s+(?:specific\s+)?(?:client|prospect|lead|payment|contract|booking|appointment|record)\b[\s\S]{0,120}\b(?:status|pending|missing|failed|received|signed|fix|change|update|combine|replace|locate|confirm)\b/i;
const CRM_OR_CALENDAR_MUTATION = /\b(?:combine|merge|deduplicat\w*|replace|remove|delete|correct|fix|update|change|reassign|reschedule|cancel)\b[\s\S]{0,160}\b(?:crm|keap|lead|record|calendar|appointment|booking)\b|\b(?:crm|keap|lead|record|calendar|appointment|booking)\b[\s\S]{0,160}\b(?:combine|merge|deduplicat\w*|replace|remove|delete|correct|fix|update|change|reassign|reschedule|cancel)\b/i;
const POST_SALE_FULFILLMENT_LIVE = /\b(?:cast\s+member|client|post[- ]sale|onboarding|filming|production|marketing\s+event|event)\b[\s\S]{0,180}\b(?:availability|spaces?|capacity|registration|expired|broken|link|schedule|delivery|fix|check)\b|\b(?:availability|spaces?|capacity|registration|expired|broken|link|schedule|delivery|fix|check)\b[\s\S]{0,180}\b(?:cast\s+member|client|post[- ]sale|onboarding|filming|production|marketing\s+event|event)\b/i;
const FINANCE_LIVE = /\b(?:locate|trace|verify|confirm|check|status|pending|missing|failed|declined|refund|reverse|void)\b[\s\S]{0,140}\b(?:payment|ach|wire|invoice|charge|transaction)\b|\b(?:payment|ach|wire|invoice|charge|transaction)\b[\s\S]{0,140}\b(?:locate|trace|verify|confirm|check|status|pending|missing|failed|declined|refund|reverse|void)\b/i;
const GREENLIGHT_LIVE = /\b(?:send|generate|issue|expedite|check|status|missing)\b[\s\S]{0,120}\b(?:green\s*light|greenlight)(?:\s+letter)?\b|\b(?:green\s*light|greenlight)(?:\s+letter)?\b[\s\S]{0,120}\b(?:send|generate|issue|expedite|check|status|missing)\b/i;
const POST_BOOKING_COMMUNICATION_CORRECTION = /\b(?:booked|scheduled)\b[\s\S]{0,160}\b(?:forgot|did\s+not|didn['’]?t|failed)\b[\s\S]{0,120}\b(?:confirm|tell|mention|explain|clarify)\b|\b(?:forgot|did\s+not|didn['’]?t|failed)\b[\s\S]{0,120}\b(?:confirm|tell|mention|explain|clarify)\b[\s\S]{0,160}\b(?:booked|scheduled)\b/i;

function completeNeedText(need: V4SystemicNeed) {
  return [need.authorityText, need.originalRequestText, need.text, ...need.retrievalQueries, ...need.domains, ...need.actions, ...need.entities]
    .filter(Boolean)
    .join(" ");
}

export function refineV58QueryPlan(
  plan: V4SystemicQueryPlan,
  turn: Parameters<typeof refineV57QueryPlan>[1],
) {
  const refined = refineV57QueryPlan(plan, turn);
  const immutableQuestion = turn.currentQuestion || turn.standaloneQuestion;
  const stableKnowledge = REPORTING_DEFINITION.test(immutableQuestion) ||
    (STABLE_NAVIGATION.test(immutableQuestion) && !EXPLICIT_LIVE_LOOKUP.test(immutableQuestion));

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
    if (stableKnowledge) {
      return {
        ...need,
        text: immutableQuestion,
        authorityText: immutableQuestion,
        originalRequestText: immutableQuestion,
        retrievalQueries: [...new Set([immutableQuestion, ...need.retrievalQueries])],
        relation: REPORTING_DEFINITION.test(immutableQuestion) ? "definition" as const : need.relation,
        requestKind: "knowledge" as const,
        forcedRouteKey: null,
      };
    }
    if (GREENLIGHT_LIVE.test(text)) return { ...need, requestKind: "operational_action" as const, forcedRouteKey: "greenlight" as const };
    if (CRM_OR_CALENDAR_MUTATION.test(text) && EXPLICIT_LIVE_LOOKUP.test(text)) {
      return { ...need, requestKind: "operational_action" as const, forcedRouteKey: "sales_tech" as const };
    }
    if (POST_SALE_FULFILLMENT_LIVE.test(text) && EXPLICIT_LIVE_LOOKUP.test(text)) {
      return { ...need, requestKind: "operational_action" as const, forcedRouteKey: "fulfillment" as const };
    }
    if (FINANCE_LIVE.test(text) && EXPLICIT_LIVE_LOOKUP.test(text)) {
      return { ...need, requestKind: "current_lookup" as const, forcedRouteKey: "finance" as const };
    }
    return need;
  });
  const changed = communicationCorrection || needs.some((need, index) => JSON.stringify(need) !== JSON.stringify(refined.needs[index]));
  return changed ? {
    ...refined,
    needs,
    reasoningSummary: `${refined.reasoningSummary} V5.8 kept reporting definitions and stable navigation answerable while assigning live CRM, calendar, fulfillment, finance, and greenlight work to the matching operational owner.`,
  } : refined;
}

const ROUTE_STOPWORDS = new Set([
  "about", "after", "again", "also", "and", "asks", "before", "but", "can", "chatbot", "client", "could", "current",
  "does", "from", "have", "into", "just", "need", "please", "post", "question", "repost", "request", "route", "should", "specific",
  "that", "the", "their", "there", "this", "through", "what", "when", "where", "which", "with", "would", "your",
]);

function routeTokens(value: string) {
  return [...new Set(value.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(/\s+/)
    .filter((token) => token.length >= 3 && !ROUTE_STOPWORDS.has(token)))];
}

function bestEvidenceRoute(
  need: V4SystemicNeed,
  retrieval: V4SystemicRetrieval,
): NonNullable<V4SystemicNeedDecision["routeKey"]> | null {
  const questionTokens = new Set(routeTokens(completeNeedText(need)));
  const matches = retrieval.candidates.flatMap((candidate) => {
    if (!candidate.needScores?.[need.id] || !candidate.policy.route_key) return [];
    const evidenceTokens = routeTokens([
      candidate.policy.title,
      candidate.policy.decision,
      candidate.policy.search_text,
      ...candidate.policy.question_families,
      ...candidate.policy.domains,
      ...candidate.policy.entities,
    ].join(" "));
    const overlap = evidenceTokens.filter((token) => questionTokens.has(token));
    const distinctive = overlap.filter((token) => !new Set(["channel", "sales", "team", "help", "issue"]).has(token));
    if (distinctive.length < 2) return [];
    return [{
      key: candidate.policy.route_key as NonNullable<V4SystemicNeedDecision["routeKey"]>,
      score: distinctive.length * 10 + overlap.length - (candidate.needScores?.[need.id]?.rank || candidate.rank) / 100,
    }];
  }).sort((left, right) => right.score - left.score);
  return matches[0]?.key || null;
}

export function resolveV58RouteKey(
  need: V4SystemicNeed,
  decision: V4SystemicNeedDecision,
  retrieval: V4SystemicRetrieval,
): NonNullable<V4SystemicNeedDecision["routeKey"]> {
  if (need.forcedRouteKey) return need.forcedRouteKey;
  const selectedEvidenceRoute = decision.evidenceRefs
    .map((id) => retrieval.candidates.find((candidate) => candidate.policy.id === id)?.policy.route_key || null)
    .find((key): key is NonNullable<V4SystemicNeedDecision["routeKey"]> => Boolean(key));
  return selectedEvidenceRoute || bestEvidenceRoute(need, retrieval) || resolveV57RouteKey(need, decision, retrieval);
}

const profile: V4SystemicCandidateRuntimeProfile = {
  pipelineVersion: ASK_SALES_V58_PIPELINE_VERSION,
  knowledgeVersion: getV58KnowledgeVersion,
  operationalPolicyCount: getV58OperationalPolicyCount,
  resolveTurn: resolveV58Turn,
  retrieve: retrieveV58Policies,
  refineQueryPlan: refineV58QueryPlan,
  resolveRouteKey: resolveV58RouteKey,
  sentenceBoundaryErrors: v52OperationalEffectErrors,
  allowGenericRichAuthority: false,
  skipLegacySourcePlanner: true,
  refineSourcePlanWithModel: refineV58SourcePlanWithRawEntailment,
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

export async function runAskSalesFaqV58(
  question: string,
  conversationMessages: AskSalesFaqChatMessage[] = [],
  options: V4RuntimeOptions = {},
) {
  return runAskSalesFaqV4SystemicCandidateWithProfile(question, conversationMessages, options, profile);
}

export { naturalizeV57Decision as naturalizeV58Decision };

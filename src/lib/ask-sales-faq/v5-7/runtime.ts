import type { AskSalesFaqChatMessage } from "@/lib/ask-sales-faq/types";
import {
  runAskSalesFaqV4SystemicCandidateWithProfile,
  type V4SystemicCandidateRuntimeProfile,
  type V4SystemicSourcePlan,
} from "@/lib/ask-sales-faq/v4/systemic/runtime";
import type { V4RuntimeOptions } from "@/lib/ask-sales-faq/v4/types";
import type {
  V4SystemicNeed,
  V4SystemicNeedDecision,
  V4SystemicQueryPlan,
  V4SystemicRetrieval,
} from "@/lib/ask-sales-faq/v4/systemic/types";
import { v52OperationalEffectErrors } from "@/lib/ask-sales-faq/v5/decision-contract";
import { resolveV54RouteKey } from "@/lib/ask-sales-faq/v5/decision-routing";
import { v54ExactSourceFallbackSentence } from "@/lib/ask-sales-faq/v5/source-control";
import { refineV56QueryPlan } from "@/lib/ask-sales-faq/v5-6/runtime";
import { refineV57SourcePlanWithRawEntailment } from "@/lib/ask-sales-faq/v5-7/entailment";
import { getV57KnowledgeVersion, getV57OperationalPolicyCount } from "@/lib/ask-sales-faq/v5-7/knowledge";
import { retrieveV57Policies } from "@/lib/ask-sales-faq/v5-7/retrieval";
import { resolveV57Turn } from "@/lib/ask-sales-faq/v5-7/turn";

export const ASK_SALES_V57_PIPELINE_VERSION = "v5.7-isolated" as const;
export const ASK_SALES_V57_DECISION_LAYER_VERSION = "claim-scoped-source-resolution-r1";

const POLICY_DECISION_QUESTION = /\b(?:can|could|may|should|must|are|is|does|do|what|when|where|how|which)\b/i;
const EXPLICIT_LIVE_EXECUTION = /\b(?:please|can\s+you|could\s+you|can\s+someone|could\s+someone|need\s+someone|chatbot)\b[\s\S]{0,140}\b(?:check|verify|find|locate|fix|change|update|send|issue|process|add|invite|reschedule|cancel|refund|trace|confirm)\b/i;
const LIVE_FAILURE_OR_MUTATION = /\b(?:missing|failed|failing|declined|pending|not\s+working|did\s+not|doesn['’]?t|cannot|can['’]?t)\b[\s\S]{0,160}\b(?:fix|change|update|check|verify|trace|process|send|add|invite|reschedule|cancel|refund|payment|commission|ledger|contract|keap|oncehub|greenlight)\b/i;
const SENSITIVE_CASE_DECISION = /\b(?:criminal|felon|conviction|lawsuit|background\s+check)\b[\s\S]{0,180}\b(?:approve|eligible|qualif|proceed|greenlight|reject)\b/i;
const STABLE_POLICY_RELATIONS = new Set(["permission", "requirement", "eligibility", "definition", "duration", "procedure", "inclusion", "price_amount", "payment_option", "timing_start", "deadline", "limit", "exception", "status", "other"]);
const SPECIFIC_CONTRACT_RECEIPT = /\b(?:this|that|my|our|specific)\s+(?:client['’]s\s+)?(?:signed\s+)?contract\b|\b(?:signed\s+)?contract\b[\s\S]{0,80}\b(?:received|came\s+through|located|find|check|verify)\b/i;
const DISCOUNT_NEXT_DAY = /\b(?:\$?2,?000|2k)\b[\s\S]{0,80}\bdiscount\b|\bdiscount\b[\s\S]{0,80}\b(?:\$?2,?000|2k)\b/i;
const DISCOUNT_TIME_RELATION = /\b(?:tomorrow|next\s+day|later\s+day|overnight|carry\s+over|carried\s+over|expire|same\s+day)\b/i;

function completeNeedText(need: V4SystemicNeed) {
  return [need.authorityText, need.originalRequestText, need.text, ...need.domains, ...need.actions, ...need.entities]
    .filter(Boolean)
    .join(" ");
}

function isStablePolicyQuestion(question: string, need: V4SystemicNeed) {
  if (!POLICY_DECISION_QUESTION.test(question)) return false;
  if (EXPLICIT_LIVE_EXECUTION.test(question) || LIVE_FAILURE_OR_MUTATION.test(question) || SENSITIVE_CASE_DECISION.test(question)) return false;
  return STABLE_POLICY_RELATIONS.has(need.relation);
}

export function refineV57QueryPlan(
  plan: V4SystemicQueryPlan,
  turn: Parameters<typeof refineV56QueryPlan>[1],
) {
  const refined = refineV56QueryPlan(plan, turn);
  const immutableQuestion = turn.currentQuestion || turn.standaloneQuestion;
  const needs = refined.needs.map((need) => {
    const text = completeNeedText(need);
    if (SPECIFIC_CONTRACT_RECEIPT.test(immutableQuestion) && /\b(?:contract|receipt|received|locate|verify|check)\b/i.test(text)) {
      return {
        ...need,
        relation: "status" as const,
        requestKind: "current_lookup" as const,
        forcedRouteKey: "fulfillment" as const,
      };
    }
    if (!isStablePolicyQuestion(immutableQuestion, need)) return need;
    const discountTiming = DISCOUNT_NEXT_DAY.test(immutableQuestion) && DISCOUNT_TIME_RELATION.test(immutableQuestion) && !/\bupgrade\b/i.test(immutableQuestion);
    return {
      ...need,
      text: discountTiming ? immutableQuestion : need.text,
      authorityText: discountTiming ? immutableQuestion : need.authorityText,
      originalRequestText: discountTiming ? immutableQuestion : need.originalRequestText,
      retrievalQueries: discountTiming
        ? [...new Set([immutableQuestion, "$2,000 same-day discount next-day expiration", ...need.retrievalQueries])]
        : need.retrievalQueries,
      relation: discountTiming ? "deadline" as const : need.relation,
      requestKind: "knowledge" as const,
      forcedRouteKey: null,
    };
  });
  const changed = needs.some((need, index) => JSON.stringify(need) !== JSON.stringify(refined.needs[index]));
  return changed ? {
    ...refined,
    needs,
    reasoningSummary: `${refined.reasoningSummary} V5.7 separated reusable policy decisions from live execution, bound specific contract receipt checks to Fulfillment, and preserved discount timing as a distinct relationship from package upgrades.`,
  } : refined;
}

export function resolveV57RouteKey(
  need: V4SystemicNeed,
  decision: V4SystemicNeedDecision,
  retrieval: V4SystemicRetrieval,
): NonNullable<V4SystemicNeedDecision["routeKey"]> {
  const text = completeNeedText(need);
  if (SPECIFIC_CONTRACT_RECEIPT.test(text)) return "fulfillment";
  if (need.forcedRouteKey) return need.forcedRouteKey;
  const evidenceRoute = decision.evidenceRefs
    .map((id) => retrieval.candidates.find((candidate) => candidate.policy.id === id)?.policy.route_key || null)
    .find((key): key is NonNullable<V4SystemicNeedDecision["routeKey"]> => Boolean(key));
  return evidenceRoute || resolveV54RouteKey(need, decision, retrieval);
}

function cleanClause(value: string) {
  return value.replace(/\s+/g, " ").replace(/^[;,:.\s]+|[;,:\s]+$/g, "").trim();
}

function naturalCondition(value: string) {
  return cleanClause(value)
    .replace(/^(?:when|if)\s+/i, "")
    .replace(/^(The|A|An|Prospect|Applicant|Client|Cast member|Lead|Show|Dispensary)\b/, (subject) => subject.toLowerCase())
    .replace(/;\s*/g, "; ")
    .replace(/\.$/, "");
}

function naturalBoundaries(value: string) {
  return cleanClause(value)
    .replace(/;\s*(?=(?:Does|Do)\s+not\b)/gi, ". ")
    .replace(/^Does\s+not\s+/i, "It does not ")
    .replace(/\.\s+Does\s+not\s+/gi, ". It does not ")
    .replace(/^Do\s+not\s+/i, "Do not ");
}

export function naturalizeV57Decision(decision: string) {
  const policyMatch = decision.match(/^\s*Policy context:\s*[\s\S]*?\s*Decision evidence:\s*([\s\S]+?)\s*$/i);
  const raw = cleanClause(policyMatch?.[1] || decision);
  const [beforeBoundaries, boundaries = ""] = raw.split(/\s+Boundaries:\s*/i);
  const [main, conditions = ""] = beforeBoundaries.split(/\s+Conditions:\s*/i);
  const sentences = [cleanClause(main)];
  if (conditions) {
    const condition = naturalCondition(conditions);
    sentences.push(`This applies when ${condition}.`);
  }
  if (boundaries) {
    const boundary = naturalBoundaries(boundaries);
    sentences.push(/^(?:It|Do)\s+/i.test(boundary) ? boundary : `Limit: ${boundary}`);
  }
  return sentences.filter(Boolean).join(" ").replace(/\.{2,}/g, ".").trim();
}

export function preferredV57ExactEvidenceSentence(
  _need: V4SystemicNeed,
  _plan: V4SystemicQueryPlan,
  retrieval: V4SystemicRetrieval,
  preferredPolicyIds: string[],
  _metadata?: Record<string, unknown>,
) {
  void _need;
  void _plan;
  void _metadata;
  if (preferredPolicyIds.length !== 1) return null;
  const candidate = retrieval.candidates.find((item) => item.policy.id === preferredPolicyIds[0]);
  if (!candidate) return null;
  const text = naturalizeV57Decision(candidate.policy.decision);
  if (text.length < 12 || text.length > 1600) return null;
  return {
    text,
    policyId: candidate.policy.id,
    evidence: `${candidate.policy.title}: ${candidate.policy.decision}`,
  };
}

const profile: V4SystemicCandidateRuntimeProfile = {
  pipelineVersion: ASK_SALES_V57_PIPELINE_VERSION,
  knowledgeVersion: getV57KnowledgeVersion,
  operationalPolicyCount: getV57OperationalPolicyCount,
  resolveTurn: resolveV57Turn,
  retrieve: retrieveV57Policies,
  refineQueryPlan: refineV57QueryPlan,
  resolveRouteKey: resolveV57RouteKey,
  sentenceBoundaryErrors: v52OperationalEffectErrors,
  allowGenericRichAuthority: false,
  skipLegacySourcePlanner: true,
  refineSourcePlanWithModel: refineV57SourcePlanWithRawEntailment,
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

export async function runAskSalesFaqV57(
  question: string,
  conversationMessages: AskSalesFaqChatMessage[] = [],
  options: V4RuntimeOptions = {},
) {
  return runAskSalesFaqV4SystemicCandidateWithProfile(question, conversationMessages, options, profile);
}

export type V57SourcePlan = V4SystemicSourcePlan;

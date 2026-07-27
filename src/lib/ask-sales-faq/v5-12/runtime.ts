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
import { resolveV510RouteKey } from "@/lib/ask-sales-faq/v5-10/runtime";
import { refineV511QueryPlan } from "@/lib/ask-sales-faq/v5-11/runtime";
import { resolveV511Turn } from "@/lib/ask-sales-faq/v5-11/turn";
import { refineV512SourcePlanWithRawEntailment, v512UnsafeDelegatedEstimate } from "@/lib/ask-sales-faq/v5-12/entailment";
import { getV512KnowledgeVersion, getV512OperationalPolicyCount } from "@/lib/ask-sales-faq/v5-12/knowledge";
import { retrieveV512Policies } from "@/lib/ask-sales-faq/v5-12/retrieval";

export const ASK_SALES_V512_PIPELINE_VERSION = "v5.12-isolated" as const;
export const ASK_SALES_V512_DECISION_LAYER_VERSION = "answer-fidelity-owner-routing-r1";

const EXPLICIT_LIVE_ACTION = /\b(?:please|can\s+(?:you|someone)|could\s+(?:you|someone)|need\s+(?:you|someone|the\s+team)\s+to|which\s+(?:person|vendor)|who\s+should\s+i\s+(?:ask|hire|contact))\b|^\s*(?:create|send|issue|change|update|fix|cancel|refund|reschedule|hire|replace|locate|trace)\b/i;
const FULFILLMENT_ACTION = /\b(?:videographer|filming|film\s+date|studio\s+booking|onboarding|editing|edit\s+status|trailer|episode\s+delivery|production|post[- ]sale|ad\s+campaign|promotion\s+delivery|view\s+target|fulfillment)\b/i;
const FINANCE_ACTION = /\b(?:payment|invoice|refund|charge|card|ach|wire|installment|payme|finance)\b/i;
const GREENLIGHT_ACTION = /\b(?:green\s*light|approval\s+letter|eligibility\s+approval|approve\s+this\s+(?:lead|prospect|case))\b/i;
const SALES_TECH_ACTION = /\b(?:keap|oncehub|calendar|zoom\s+link|crm|form|login|technical|recording\s+missing|automation|sales\s+tech)\b/i;
const BARE_CONTEXTUAL_DECISION = /^\s*Policy context:[\s\S]*?Decision evidence:\s*(?:yes|no)(?:\s+if)?[.!]?\s*$/i;
const BARE_YES_NO = /^\s*(?:yes|no)(?:\s+if\b[\s\S]{0,100})?[.!]?\s*$/i;
const ATTORNEY_ELLIPSIS = /^(?:(?:and|but|so)\s+)?(?:what\s+if|if)\b[\s\S]{0,100}\b(?:attorney|lawyer)\b[\s\S]{0,80}\b(?:it|that|this)\b/i;
const PRIOR_CONTRACT = /\b(?:contract|agreement|contract\s+pdf)\b/i;

function completeNeedText(need: V4SystemicNeed) {
  return [need.originalRequestText, need.authorityText, need.text, ...need.domains, ...need.actions, ...need.entities]
    .filter(Boolean)
    .join(" ");
}

function liveOwnerForNeed(need: V4SystemicNeed, immutableQuestion: string) {
  const text = `${immutableQuestion} ${completeNeedText(need)}`;
  const liveAction = EXPLICIT_LIVE_ACTION.test(text);
  if (!liveAction) return null;
  if (GREENLIGHT_ACTION.test(text)) return "greenlight" as const;
  if (FINANCE_ACTION.test(text)) return "finance" as const;
  if (SALES_TECH_ACTION.test(text)) return "sales_tech" as const;
  if (FULFILLMENT_ACTION.test(text)) return "fulfillment" as const;
  return null;
}

export function refineV512QueryPlan(
  plan: V4SystemicQueryPlan,
  turn: Parameters<typeof refineV511QueryPlan>[1],
) {
  const refined = refineV511QueryPlan(plan, turn);
  const immutableQuestion = [turn.currentQuestion, turn.standaloneQuestion].filter(Boolean).join(" ");
  let ownerBindings = 0;
  let passiveRouteCorrections = 0;
  const needs = refined.needs.map((need) => {
    const owner = liveOwnerForNeed(need, immutableQuestion);
    if (need.forcedRouteKey && !owner) {
      passiveRouteCorrections += 1;
      return { ...need, forcedRouteKey: null, requestKind: "knowledge" as const };
    }
    if (need.forcedRouteKey) return need;
    if (!owner) return need;
    ownerBindings += 1;
    return {
      ...need,
      requestKind: "operational_action" as const,
      forcedRouteKey: owner,
    };
  });
  return ownerBindings || passiveRouteCorrections ? {
    ...refined,
    needs,
    reasoningSummary: `${refined.reasoningSummary} V5.12 bound ${ownerBindings} explicit live action owner(s) and removed ${passiveRouteCorrections} unsupported action-owner bindings before retrieval.`,
  } : refined;
}

export function resolveV512Turn(question: string, messages: AskSalesFaqChatMessage[] = []) {
  const turn = resolveV511Turn(question, messages);
  if (turn.usedImmediateContext || !ATTORNEY_ELLIPSIS.test(question)) return turn;
  const normalizedQuestion = question.trim().replace(/\s+/g, " ");
  const history = messages.map((message) => ({ ...message, content: message.content.trim().replace(/\s+/g, " ") }));
  if (history.at(-1)?.role === "user" && history.at(-1)?.content === normalizedQuestion) history.pop();
  const previousUserQuestion = [...history].reverse().find((message) => message.role === "user")?.content;
  if (!previousUserQuestion || !PRIOR_CONTRACT.test(previousUserQuestion)) return turn;
  return {
    ...turn,
    kind: "follow_up" as const,
    standaloneQuestion: `Immediate prior contract question: ${previousUserQuestion}\nCurrent attorney-review follow-up: ${turn.currentQuestion}`,
    immediatePreviousUserQuestion: previousUserQuestion,
    usedImmediateContext: true,
    intentResolutionMode: "deterministic" as const,
    intentResolutionReason: "V5.12 carried the contract object into a bounded attorney-review follow-up.",
  };
}

function delegatedOwnerFromSelectedEvidence(need: V4SystemicNeed, evidenceRefs: string[], retrieval: V4SystemicRetrieval) {
  if (!evidenceRefs.length) return null;
  const selected = new Set(evidenceRefs);
  const direct = retrieval.candidates
    .filter((candidate) => candidate.needScores?.[need.id] && selected.has(candidate.policy.id))
    .sort((left, right) => (left.needScores?.[need.id]?.rank || 999) - (right.needScores?.[need.id]?.rank || 999));
  const fulfillment = direct.find((candidate) => /\b(?:fulfillment|post[- ]sale|production team)\b/i.test(candidate.policy.decision));
  if (fulfillment) return "fulfillment" as const;
  const finance = direct.find((candidate) => /\b(?:finance|sales-finance-requests)\b/i.test(candidate.policy.decision));
  if (finance) return "finance" as const;
  const greenlight = direct.find((candidate) => /\b(?:green\s*light|greenlight)\b/i.test(candidate.policy.decision));
  if (greenlight) return "greenlight" as const;
  const tech = direct.find((candidate) => /\b(?:sales\s+tech|tech\s+channel|technical support)\b/i.test(candidate.policy.decision));
  return tech ? "sales_tech" as const : null;
}

export function resolveV512RouteKey(
  need: V4SystemicNeed,
  decision: V4SystemicNeedDecision,
  retrieval: V4SystemicRetrieval,
): NonNullable<V4SystemicNeedDecision["routeKey"]> {
  if (need.forcedRouteKey) return need.forcedRouteKey;
  return delegatedOwnerFromSelectedEvidence(need, decision.evidenceRefs, retrieval) || resolveV510RouteKey(need, decision, retrieval);
}

function safeForExactProjection(retrieval: V4SystemicRetrieval, preferredPolicyIds: string[]) {
  if (preferredPolicyIds.length !== 1) return false;
  const candidate = retrieval.candidates.find((item) => item.policy.id === preferredPolicyIds[0]);
  if (!candidate || candidate.policy.answerability !== "answer_evidence") return false;
  if (v512UnsafeDelegatedEstimate(candidate)) return false;
  const decision = candidate.policy.decision.trim();
  if (BARE_CONTEXTUAL_DECISION.test(decision)) return false;
  const evidenceOnly = decision.match(/Decision evidence:\s*([\s\S]+)$/i)?.[1]?.trim() || decision;
  if (BARE_YES_NO.test(evidenceOnly)) return false;
  return true;
}

export function preferredV512EvidenceSentence(
  need: V4SystemicNeed,
  plan: V4SystemicQueryPlan,
  retrieval: V4SystemicRetrieval,
  preferredPolicyIds: string[],
  metadata?: Record<string, unknown>,
) {
  if (!safeForExactProjection(retrieval, preferredPolicyIds)) return null;
  return preferredV57ExactEvidenceSentence(need, plan, retrieval, preferredPolicyIds, metadata);
}

export function v512ExactSourceFallbackSentence(
  need: V4SystemicNeed,
  plan: V4SystemicQueryPlan,
  retrieval: V4SystemicRetrieval,
  preferredPolicyIds: string[],
  _rejectedDeterministicErrors: string[] = [],
) {
  void _rejectedDeterministicErrors;
  if (!safeForExactProjection(retrieval, preferredPolicyIds)) return null;
  return v54ExactSourceFallbackSentence(need, plan, retrieval, preferredPolicyIds);
}

const profile: V4SystemicCandidateRuntimeProfile = {
  pipelineVersion: ASK_SALES_V512_PIPELINE_VERSION,
  knowledgeVersion: getV512KnowledgeVersion,
  operationalPolicyCount: getV512OperationalPolicyCount,
  resolveTurn: resolveV512Turn,
  retrieve: retrieveV512Policies,
  refineQueryPlan: refineV512QueryPlan,
  resolveRouteKey: resolveV512RouteKey,
  sentenceBoundaryErrors: v52OperationalEffectErrors,
  allowGenericRichAuthority: false,
  skipLegacySourcePlanner: true,
  refineSourcePlanWithModel: refineV512SourcePlanWithRawEntailment,
  exactSourceFallbackSentence: v512ExactSourceFallbackSentence,
  disableDefaultExactSourceFallback: true,
  preferredExactEvidenceSentence: preferredV512EvidenceSentence,
  trustPreferredExactEvidence: true,
  trustPreferredCollectiveEvidence: true,
  precomposePreferredEvidence: true,
  appendRouteForAnsweredSupport: false,
  // The provider assigns temperature zero to purposes containing "validation".
  // V5.12 makes answer projection reproducible without changing other runtimes.
  evidenceDraftPurpose: "v5_12_evidence_answer_projection_validation",
  evidenceDraftRetryPurpose: "v5_12_evidence_answer_projection_retry_validation",
  fallbackLabel: "Frozen V4",
  fallbackOnEmptyRetrieval: false,
  fallbackOnStageFailure: false,
};

export async function runAskSalesFaqV512(
  question: string,
  conversationMessages: AskSalesFaqChatMessage[] = [],
  options: V4RuntimeOptions = {},
) {
  return runAskSalesFaqV4SystemicCandidateWithProfile(question, conversationMessages, options, profile);
}

export { naturalizeV57Decision as naturalizeV512Decision };

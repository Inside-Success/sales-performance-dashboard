import type { AskSalesFaqChatMessage } from "@/lib/ask-sales-faq/types";
import {
  runAskSalesFaqV4SystemicCandidateWithProfile,
  type V4SystemicCandidateRuntimeProfile,
} from "@/lib/ask-sales-faq/v4/systemic/runtime";
import type { V4RuntimeOptions } from "@/lib/ask-sales-faq/v4/types";
import type { V4SystemicQueryPlan } from "@/lib/ask-sales-faq/v4/systemic/types";
import { v52OperationalEffectErrors } from "@/lib/ask-sales-faq/v5/decision-contract";
import { resolveV54RouteKey } from "@/lib/ask-sales-faq/v5/decision-routing";
import { v54ExactSourceFallbackSentence } from "@/lib/ask-sales-faq/v5/source-control";
import { preferredV55ExactEvidenceSentence, refineV55QueryPlan } from "@/lib/ask-sales-faq/v5-5/runtime";
import { refineV56SourcePlanWithRawEntailment } from "@/lib/ask-sales-faq/v5-6/entailment";
import { getV56KnowledgeVersion, getV56OperationalPolicyCount } from "@/lib/ask-sales-faq/v5-6/knowledge";
import { retrieveV56Policies } from "@/lib/ask-sales-faq/v5-6/retrieval";
import { resolveV56Turn } from "@/lib/ask-sales-faq/v5-6/turn";

export const ASK_SALES_V56_PIPELINE_VERSION = "v5.6-isolated" as const;
export const ASK_SALES_V56_DECISION_LAYER_VERSION = "bounded-causal-correction-r1";

const CLEAR_INFORMATIONAL_FAQ = /\b(?:how\s+long|what\s+is\s+the\s+(?:duration|timeline|rule|policy|process|waiting\s+period)|is\s+there\s+(?:a|an|any)\s+(?:waiting\s+period|deadline|time\s+limit)|when\s+does\b|what\s+(?:does|do)\b.{0,100}\binclude|are\s+reps?\s+allowed|can\s+reps?\s+generally|should\s+reps?\s+generally)\b/i;
const LIVE_OR_MUTATING_REQUEST = /\b(?:please|can\s+someone|could\s+someone|would\s+someone|need\s+someone|right\s+now|currently|today|tomorrow|urgent|status|pending|failed|failing|declined|missing|this\s+(?:specific\s+)?(?:client|lead|prospect|payment|transaction|booking|application)|my\s+(?:client|lead|prospect|payment|transaction|booking|application))\b|\b(?:check|verify|trace|process|issue|refund|reverse|void|cancel|update|change|fix|repair|rerun|reprocess|expedite|send|generate|create)\b.{0,100}\b(?:payment|transaction|invoice|refund|greenlight|approval\s+letter|booking|record|link|contract)\b/i;
const STABLE_SIGNED_PAYMENT_LINK_PERMISSION = /\b(?:can|may|should)\s+(?:i|we|the\s+(?:sales\s+)?rep|a\s+(?:sales\s+)?rep|reps)\s+(?:send|share|use)\b/i;
const SIGNED_UNCHANGED_PLAN = /\b(?:signed|already\s+signed|contracted)\b[\s\S]{0,160}\b(?:contract|plan|payment|amount)\b|\b(?:same|matching|matches?)\b[\s\S]{0,100}\b(?:signed\s+)?(?:contract|plan|payment|amount)\b/i;
const OFFICIAL_PAYMENT_LINK = /\b(?:official|approved|listed)\b[\s\S]{0,60}\b(?:payment\s+)?link\b/i;
const PAYMENT_PLAN_MUTATION = /\b(?:change|custom|customize|different|new|create|generate|modify|alter)\b[\s\S]{0,80}\b(?:plan|amount|split|terms?|link)\b/i;
const CALL_SEQUENCE_TIMING_PERMISSION = /\bcall\s*1\b[\s\S]{0,180}\bcall\s*2\b|\bcall\s*2\b[\s\S]{0,180}\bcall\s*1\b/i;
const CONCRETE_TIMING_SCENARIO = /\b(?:can|may|allowed|permitted|schedule|book)\b[\s\S]{0,180}\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|next|same)\s*(?:business\s+)?(?:day|week|month)s?\b|\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|next|same)\s*(?:business\s+)?(?:day|week|month)s?\b[\s\S]{0,180}\b(?:can|may|allowed|permitted|schedule|book)\b/i;
const GENERAL_PERSISTENT_PRICING_FAQ = /\b(?:keep\s+pushing|keeps?\s+pushing|exact\s+breakdown|line[- ]items?|break\s+down|persists?|insists?)\b/i;
const ACTUAL_ELIGIBILITY_DECISION = /\b(?:this|that|my|our|specific)\s+(?:client|lead|prospect|applicant)\b[\s\S]{0,180}\b(?:eligible|qualif\w*|approve|approval|greenlight|green\s+light|proceed)\b/i;

function completeNeedText(need: V4SystemicQueryPlan["needs"][number]) {
  return [
    need.originalRequestText,
    need.authorityText,
    need.text,
    ...need.domains,
    ...need.actions,
    ...need.entities,
  ].filter(Boolean).join(" ");
}

/**
 * The preceding owner classifier is intentionally conservative, but it can
 * label a duration FAQ as a fulfillment action merely because it contains
 * words such as editing or delivery. V5.6 reopens only unmistakably
 * informational FAQ wording and never overrides a live, case-specific, or
 * mutating request.
 */
export function refineV56QueryPlan(
  plan: V4SystemicQueryPlan,
  turn: Parameters<typeof refineV55QueryPlan>[1],
) {
  let refined = refineV55QueryPlan(plan, turn);
  const originalQuestion = turn.standaloneQuestion || turn.currentQuestion;
  const turnQuestion = [turn.currentQuestion, originalQuestion].filter(Boolean).join(" ");
  if (GENERAL_PERSISTENT_PRICING_FAQ.test(turnQuestion) && !ACTUAL_ELIGIBILITY_DECISION.test(turnQuestion)) {
    const needs = refined.needs.filter((need) => !need.id.endsWith("__case_review"));
    if (needs.length !== refined.needs.length) refined = {
      ...refined,
      needs,
      reasoningSummary: `${refined.reasoningSummary} V5.6 removed a synthetic eligibility review from a general pricing-response FAQ that did not ask for a prospect decision.`,
    };
  }
  const stableSignedLinkPermission = STABLE_SIGNED_PAYMENT_LINK_PERMISSION.test(originalQuestion) &&
    SIGNED_UNCHANGED_PLAN.test(originalQuestion) &&
    OFFICIAL_PAYMENT_LINK.test(originalQuestion) &&
    !PAYMENT_PLAN_MUTATION.test(originalQuestion);
  const needs = refined.needs.map((need) => {
    const text = completeNeedText(need);
    if (stableSignedLinkPermission && /\b(?:payment|contract|bank|link)\b/i.test(text)) {
      return { ...need, requestKind: "knowledge" as const, forcedRouteKey: null };
    }
    if (!CLEAR_INFORMATIONAL_FAQ.test(text) || LIVE_OR_MUTATING_REQUEST.test(text)) return need;
    return { ...need, requestKind: "knowledge" as const, forcedRouteKey: null };
  });
  const shouldCollapseTimingScenario = refined.conversationIntent === "answer" &&
    needs.length > 1 &&
    CALL_SEQUENCE_TIMING_PERMISSION.test(originalQuestion) &&
    CONCRETE_TIMING_SCENARIO.test(originalQuestion);
  const timingScenario = shouldCollapseTimingScenario
    ? needs.find((need) => need.relation === "permission" && CALL_SEQUENCE_TIMING_PERMISSION.test(completeNeedText(need))) ||
      needs.find((need) => /\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|next|same)\s*(?:business\s+)?(?:day|week|month)s?\b/i.test(completeNeedText(need))) ||
      needs[needs.length - 1]
    : null;
  const atomicScenario = stableSignedLinkPermission ? needs[0] : timingScenario;
  const collapsedNeeds = atomicScenario ? [{
    ...atomicScenario,
    id: "N1",
    text: originalQuestion,
    authorityText: originalQuestion,
    originalRequestText: originalQuestion,
    retrievalQueries: [...new Set([originalQuestion, ...needs.flatMap((need) => need.retrievalQueries)])],
    relation: "permission" as const,
    requestKind: "knowledge" as const,
    forcedRouteKey: null,
  }] : needs;
  const changed = stableSignedLinkPermission || Boolean(timingScenario) || needs.some((need, index) =>
    need.requestKind !== refined.needs[index].requestKind || need.forcedRouteKey !== refined.needs[index].forcedRouteKey);
  return changed ? {
    ...refined,
    needs: collapsedNeeds,
    reasoningSummary: `${refined.reasoningSummary} V5.6 reopened only bounded informational permissions and FAQs that a topic-word owner classifier had mislabeled as live work.${timingScenario ? " It also kept one concrete Call 1-to-Call 2 scheduling decision atomic instead of routing artificial interval subquestions." : ""}${stableSignedLinkPermission ? " It preserved the signed-contract, unchanged-plan, and failed-transfer conditions as one atomic payment-link permission." : ""}`,
  } : refined;
}

function publishableDecision(decision: string) {
  const match = decision.match(/^\s*Policy context:\s*[\s\S]*?\s*Decision evidence:\s*([\s\S]+?)\s*$/i);
  return (match?.[1] || decision).replace(/\s+/g, " ").trim();
}

/**
 * The blind review established that the selected verified record was correct
 * while its short supporting quote sometimes omitted controlling conditions.
 * V5.6 therefore publishes the complete selected decision, not a lossy quote.
 */
export function preferredV56ExactEvidenceSentence(
  need: Parameters<typeof preferredV55ExactEvidenceSentence>[0],
  plan: Parameters<typeof preferredV55ExactEvidenceSentence>[1],
  retrieval: Parameters<typeof preferredV55ExactEvidenceSentence>[2],
  preferredPolicyIds: string[],
  evidenceEntailmentMetadata?: Record<string, unknown>,
) {
  const fallback = preferredV55ExactEvidenceSentence(
    need,
    plan,
    retrieval,
    preferredPolicyIds,
    evidenceEntailmentMetadata,
  );
  if (!fallback || preferredPolicyIds.length !== 1) return fallback;
  const candidate = retrieval.candidates.find((item) => item.policy.id === preferredPolicyIds[0]);
  const completeDecision = candidate ? publishableDecision(candidate.policy.decision) : "";
  if (!candidate || completeDecision.length < 12 || completeDecision.length > 1600) return fallback;
  return {
    text: completeDecision,
    policyId: candidate.policy.id,
    evidence: `${candidate.policy.title}: ${candidate.policy.decision}`,
  };
}

const profile: V4SystemicCandidateRuntimeProfile = {
  pipelineVersion: ASK_SALES_V56_PIPELINE_VERSION,
  knowledgeVersion: getV56KnowledgeVersion,
  operationalPolicyCount: getV56OperationalPolicyCount,
  resolveTurn: resolveV56Turn,
  retrieve: retrieveV56Policies,
  refineQueryPlan: refineV56QueryPlan,
  resolveRouteKey: resolveV54RouteKey,
  sentenceBoundaryErrors: v52OperationalEffectErrors,
  allowGenericRichAuthority: false,
  skipLegacySourcePlanner: true,
  refineSourcePlanWithModel: refineV56SourcePlanWithRawEntailment,
  exactSourceFallbackSentence: v54ExactSourceFallbackSentence,
  preferredExactEvidenceSentence: preferredV56ExactEvidenceSentence,
  trustPreferredExactEvidence: true,
  trustPreferredCollectiveEvidence: true,
  precomposePreferredEvidence: true,
  appendRouteForAnsweredSupport: false,
  fallbackLabel: "Frozen V4",
  fallbackOnEmptyRetrieval: false,
  fallbackOnStageFailure: false,
};

export async function runAskSalesFaqV56(
  question: string,
  conversationMessages: AskSalesFaqChatMessage[] = [],
  options: V4RuntimeOptions = {},
) {
  return runAskSalesFaqV4SystemicCandidateWithProfile(question, conversationMessages, options, profile);
}

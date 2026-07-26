import type { AskSalesFaqChatMessage } from "@/lib/ask-sales-faq/types";
import {
  runAskSalesFaqV4SystemicCandidateWithProfile,
  type V4SystemicCandidateRuntimeProfile,
} from "@/lib/ask-sales-faq/v4/systemic/runtime";
import type { V4RuntimeOptions } from "@/lib/ask-sales-faq/v4/types";
import type { V4SystemicNeed, V4SystemicQueryPlan, V4SystemicRetrieval } from "@/lib/ask-sales-faq/v4/systemic/types";
import { v52OperationalEffectErrors } from "@/lib/ask-sales-faq/v5/decision-contract";
import { refineV54QueryPlan, resolveV54RouteKey } from "@/lib/ask-sales-faq/v5/decision-routing";
import { getV5KnowledgeVersion, getV5OperationalPolicyCount } from "@/lib/ask-sales-faq/v5/knowledge";
import { v54ExactSourceFallbackSentence } from "@/lib/ask-sales-faq/v5/source-control";
import { refineV55SourcePlanWithRawEntailment } from "@/lib/ask-sales-faq/v5-5/entailment";
import { retrieveV55Policies } from "@/lib/ask-sales-faq/v5-5/retrieval";

export const ASK_SALES_V55_PIPELINE_VERSION = "v5.5-isolated" as const;
export const ASK_SALES_V55_DECISION_LAYER_VERSION = "raw-record-entailment-publisher-conflicts-r1";

export function getV55KnowledgeVersion() {
  return `${getV5KnowledgeVersion()}+v55_${ASK_SALES_V55_DECISION_LAYER_VERSION}`;
}

const STABLE_OPTION_PERMISSION = /\b(?:can|could|may|should)\s+(?:i|we|the\s+(?:applicant|client|prospect|cast\s+member)|an?\s+(?:applicant|client|prospect|cast\s+member))\b/i;
const PAYMENT_OPTION_OR_RESCHEDULE = /\b(?:custom|cheaper|lower|unlisted|different)\s+(?:payment\s+)?(?:plan|option|arrangement|split)\b|\b(?:reschedule|rebook)\b/i;
const EXECUTE_LIVE_FINANCE_WORK = /\b(?:payment\s+link|invoice|transaction|refund|charge|wire|ach)\b|\b(?:please|can\s+someone|could\s+someone|need\s+someone)\b/i;

export function refineV55QueryPlan(plan: V4SystemicQueryPlan, turn: Parameters<typeof refineV54QueryPlan>[1]) {
  const refined = refineV54QueryPlan(plan, turn);
  const needs = refined.needs.map((need) => {
    const atomicRequest = need.authorityText || need.originalRequestText || need.text;
    const stablePermission = STABLE_OPTION_PERMISSION.test(atomicRequest) && PAYMENT_OPTION_OR_RESCHEDULE.test(atomicRequest);
    if (!stablePermission || EXECUTE_LIVE_FINANCE_WORK.test(atomicRequest)) return need;
    return { ...need, requestKind: "knowledge" as const, forcedRouteKey: null };
  });
  const changed = needs.some((need, index) =>
    need.requestKind !== refined.needs[index].requestKind || need.forcedRouteKey !== refined.needs[index].forcedRouteKey);
  return changed ? {
    ...refined,
    needs,
    reasoningSummary: `${refined.reasoningSummary} V5.5 kept stable payment-option and rescheduling permission questions in retrieval while preserving explicit live Finance execution routing.`,
  } : refined;
}

function candidateFor(id: string, retrieval: V4SystemicRetrieval) {
  return retrieval.candidates.find((candidate) => candidate.policy.id === id) || null;
}

function publishableDecision(decision: string) {
  const match = decision.match(/^\s*Policy context:\s*[\s\S]*?\s*Decision evidence:\s*([\s\S]+?)\s*$/i);
  return (match?.[1] || decision).replace(/\s+/g, " ").trim();
}

function preferredExactEvidenceSentence(
  need: V4SystemicNeed,
  _plan: V4SystemicQueryPlan,
  retrieval: V4SystemicRetrieval,
  preferredPolicyIds: string[],
  evidenceEntailmentMetadata?: Record<string, unknown>,
) {
  void _plan;
  if (preferredPolicyIds.length !== 1) return null;
  const candidate = candidateFor(preferredPolicyIds[0], retrieval);
  if (!candidate) return null;
  const metadataNeeds = Array.isArray(evidenceEntailmentMetadata?.needs) ? evidenceEntailmentMetadata.needs : [];
  const metadataNeed = metadataNeeds.find((value): value is Record<string, unknown> =>
    Boolean(value && typeof value === "object" && (value as Record<string, unknown>).needId === need.id));
  const metadataRecords = Array.isArray(metadataNeed?.records) ? metadataNeed.records : [];
  const metadataRecord = metadataRecords.find((value): value is Record<string, unknown> =>
    Boolean(value && typeof value === "object" && (value as Record<string, unknown>).policyId === candidate.policy.id));
  const quote = typeof metadataRecord?.supportingQuote === "string" &&
    metadataRecord.supportingQuoteVerified === true &&
    metadataRecord.supportingQuoteShapeVerified === true
    ? metadataRecord.supportingQuote.replace(/\s+/g, " ").trim()
    : "";
  const normalizedDecision = candidate.policy.decision.toLowerCase().replace(/\s+/g, " ").trim();
  const normalizedQuote = quote.toLowerCase().replace(/\s+/g, " ").trim();
  const verifiedQuote = quote.length >= 12 && quote.length <= 900 && normalizedDecision.includes(normalizedQuote)
    ? quote.replace(/^["'“‘]+|["'”’]+$/g, "").replace(/[;,:]+$/g, "").trim()
    : "";
  const text = /^(?:yes|no)[,.;:]|^(?:those|these|it|they|this|that)\b/i.test(verifiedQuote)
    ? `${candidate.policy.title.replace(/[?.:]+$/g, "")}: ${verifiedQuote}`
    : verifiedQuote
      ? verifiedQuote
    : publishableDecision(candidate.policy.decision);
  if (!text || text.length > 900) return null;
  return {
    text,
    policyId: candidate.policy.id,
    evidence: `${candidate.policy.title}: ${candidate.policy.decision}`,
  };
}

const profile: V4SystemicCandidateRuntimeProfile = {
  pipelineVersion: ASK_SALES_V55_PIPELINE_VERSION,
  knowledgeVersion: getV55KnowledgeVersion,
  operationalPolicyCount: getV5OperationalPolicyCount,
  retrieve: retrieveV55Policies,
  refineQueryPlan: refineV55QueryPlan,
  resolveRouteKey: resolveV54RouteKey,
  sentenceBoundaryErrors: v52OperationalEffectErrors,
  allowGenericRichAuthority: false,
  skipLegacySourcePlanner: true,
  refineSourcePlanWithModel: refineV55SourcePlanWithRawEntailment,
  exactSourceFallbackSentence: v54ExactSourceFallbackSentence,
  preferredExactEvidenceSentence,
  trustPreferredExactEvidence: true,
  trustPreferredCollectiveEvidence: true,
  precomposePreferredEvidence: true,
  appendRouteForAnsweredSupport: false,
  fallbackLabel: "Frozen V4",
  fallbackOnEmptyRetrieval: false,
  fallbackOnStageFailure: false,
};

export async function runAskSalesFaqV55(
  question: string,
  conversationMessages: AskSalesFaqChatMessage[] = [],
  options: V4RuntimeOptions = {},
) {
  return runAskSalesFaqV4SystemicCandidateWithProfile(question, conversationMessages, options, profile);
}

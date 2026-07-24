import { inferV4SystemicRelation, inferV4SystemicRequestKind } from "@/lib/ask-sales-faq/v4/systemic/relations";
import type {
  V4SystemicNeed,
  V4SystemicNeedDecision,
  V4SystemicQueryPlan,
  V4SystemicRetrieval,
} from "@/lib/ask-sales-faq/v4/systemic/types";
import type { V3TurnResolution } from "@/lib/ask-sales-faq/v3/types";

type RouteKey = NonNullable<V4SystemicNeedDecision["routeKey"]>;

function completeText(need: V4SystemicNeed) {
  return [
    need.originalRequestText,
    need.authorityText,
    need.text,
    ...need.domains,
    ...need.actions,
    ...need.entities,
  ].filter(Boolean).join(" ");
}

const STABLE_NAVIGATION_QUESTION = /\bwhere\s+(?:do|should|can|would)\s+(?:i|we|reps?)\s+(?:send|post|submit|upload|attach|find|locate|access|check|verify)\b|\bwhich\s+(?:channel|thread|form|sheet|link|place)\b/i;
const LIVE_MUTATION_REQUEST = /\b(?:can|could|would)\s+(?:someone|you|the\s+team)\b.{0,120}\b(?:fix|repair|change|update|correct|restore|rerun|reprocess|void|cancel|expedite|send|issue|process)\w*\b|\bplease\s+(?:fix|repair|change|update|correct|restore|rerun|reprocess|void|cancel|expedite|send|issue|process)\w*\b/i;
const CURRENT_FAILURE_OR_STATUS = /\b(?:right\s+now|currently|specific|this\s+client|this\s+lead|this\s+prospect|pending|failed|failing|declined|not\s+working|did\s+not|didn't|does\s+not|doesn't)\b/i;
const PERMISSION_TO_USE_EXISTING_RESOURCE = /\b(?:can|could|may|should|is|are)\s+(?:i|we|a|an|the|my|our|their|his|her|client|prospect|cast\s+member|family\s+member|mother|father|spouse|guest|attendee|they|he|she)\b.{0,160}\b(?:share|use|include|forward|give|join)\w*\b.{0,120}\b(?:same|existing|current|the)\b.{0,80}\b(?:link|url|form|document|recording|call)\b/i;
const PERSONAL_ACTOR_DECISION = /\bdoes\s+[a-z][a-z .'-]{1,55}?\s+personally\s+(?:interview|create|record|host|meet|call|approve|review|send|provide)\w*\b/i;
const GENERIC_ACTOR_REQUIREMENT = /\b(?:does|do)\s+(?:the\s+)?(?:rep|representative|closer|salesperson|we|i)\s+need\s+to\b|\b(?:must|should)\s+(?:the\s+)?(?:rep|representative|closer|salesperson|we|i)\b/i;
const DEFINITION_SHAPED_REQUEST = /\bwhat\s+does\b.{0,180}\bmean\b|\bwhat\s+(?:is|are)\s+(?:the\s+)?(?:seo\s+benefit|social\s+promo(?:tional)?\s+assets?|promotional\s+activities)\b/i;
const REFERENCED_CONTEXT_REVIEW = /\b(?:review|assess|analy[sz]e|look\s+at|read)\w*\b.{0,120}\b(?:this|the|attached|following)\b.{0,50}\b(?:message|email|text|screenshot|attachment|recording|document)\b/i;
const PAYMENT_CHANGE_CONTRACT_REQUIREMENT = /\b(?:payment\s+(?:arrangement|plan|split|structure|terms?)\s+(?:change|changes|changed)|change\w*\s+payment\s+(?:arrangement|plan|split|structure|terms?))\b.{0,180}\b(?:new|another|replacement)\s+(?:contract|agreement)\b|\b(?:new|another|replacement)\s+(?:contract|agreement)\b.{0,180}\b(?:payment\s+(?:arrangement|plan|split|structure|terms?)\s+(?:change|changes|changed)|change\w*\s+payment)\b/i;

function isMissingReferencedContext(value: string) {
  if (!REFERENCED_CONTEXT_REVIEW.test(value)) return false;
  const suppliesInlineContext = /\b(?:message|email|text)\s+(?:says?|reads?)\s*[:“"]|\b(?:following|below)\s*[:“"]|[“"][^”"]{12,}[”"]|\n\s*\S.{20,}/i.test(value);
  return !suppliesInlineContext;
}

function deterministicRouteOwner(text: string, requestKind: V4SystemicNeed["requestKind"]): RouteKey | null {
  const supportingApprovalEvidence = /\b(?:supporting\s+)?(?:documents?|links?|evidence|proof)\b.{0,140}\b(?:greenlight|green\s+light|approval)\b|\b(?:greenlight|green\s+light|approval)\b.{0,140}\b(?:supporting\s+)?(?:documents?|links?|evidence|proof)\b/i.test(text) &&
    /\b(?:lead|prospect|call\s*(?:1|one)|provided|supplied|sent|send)\b/i.test(text);
  if (supportingApprovalEvidence) return "fulfillment";

  const paymentContractAutomation = /\b(?:payment|paid)\b.{0,180}\b(?:contract|agreement)\b|\b(?:contract|agreement)\b.{0,180}\b(?:payment|paid)\b/i.test(text) &&
    /\b(?:automation|automatic|redirect|integration|workflow|failed|missing|fix|repair|rerun|reprocess|did\s+not|didn't|does\s+not|doesn't)\b/i.test(text);
  if (paymentContractAutomation) return "sales_tech";

  const controlledSalesArtifact = /\b(?:current|latest|exact|approved|right)\b.{0,120}\b(?:link|form|sheet|spreadsheet|deck|file|document)\b|\b(?:link|form|sheet|spreadsheet|deck|file|document)\b.{0,120}\b(?:current|latest|exact|approved|right)\b/i.test(text) &&
    /\b(?:package\s+upgrade|upgrade|sales\s+deck|slide\s+deck|payment|contract|crm|keap|oncehub)\b/i.test(text);
  if (controlledSalesArtifact) return "sales_tech";

  const technicalSystem = /\b(?:keap|hubspot|oncehub|zoom|crm|calendar|dashboard|leaderboard|rpc|rpct|automation|integration|redirect|technical|tech|record|attribution|referral\s+entry|self[- ]generated|self[- ]sourced)\b/i.test(text) &&
    /\b(?:fix|repair|update|change|correct|merge|combine|replace|delete|remove|sync|populate|generate|enter|entry|submit|route|find|locate|access|link|workflow|failed|missing)\w*\b/i.test(text);
  if (technicalSystem && requestKind !== "knowledge") return "sales_tech";

  const specificGreenlightContractStatus = /\b(?:greenlight|green\s+light|greenlit)\b/i.test(text) &&
    /\b(?:specific|this|that|status|sent|send|confirm|check|verify|letter|approval)\b/i.test(text) &&
    !supportingApprovalEvidence;
  if (specificGreenlightContractStatus) return "greenlight";

  const financeOperation = /\b(?:amex|american\s+express|ach|wire|card|payment|transaction|invoice|billing|charge|refund|commission)\b/i.test(text) &&
    /\b(?:confirm|verify|check|trace|process|issue|refund|reverse|cancel|void|replace|switch|update|correct|receive|clear|fail|declin|reject|not\s+work|status|why)\w*\b/i.test(text);
  if (financeOperation) return "finance";

  const greenlightOperation = /\b(?:greenlight|green\s+light|greenlit|approval\s+letter)\b/i.test(text) &&
    /\b(?:specific|this|that|lead|prospect|applicant|letter|status|approval|confirm|check|verify|send|request|expedite)\b/i.test(text);
  if (greenlightOperation) return "greenlight";

  const fulfillmentOperation = /\b(?:filming|production|fulfillment|delivery|onboarding|scriptwriter|trailer)\b/i.test(text) &&
    /\b(?:schedule|reschedule|change|update|send|request|deliver|missing|status|support)\w*\b/i.test(text);
  if (fulfillmentOperation && requestKind !== "knowledge") return "fulfillment";

  return null;
}

function refineNeed(need: V4SystemicNeed): V4SystemicNeed {
  const text = completeText(need);
  const atomicRequest = need.authorityText || need.text || need.originalRequestText || "";
  const missingReferencedContext = isMissingReferencedContext(need.originalRequestText || need.authorityText || need.text);
  let relation = need.relation;
  let requestKind = need.requestKind;
  let refinedText = need.text;

  const greenlightContractStatus = /\b(?:greenlight|green\s+light|greenlit)\b/i.test(text) &&
    /\b(?:contract|agreement)\b/i.test(text) &&
    /\b(?:sent|send|received|delivered|status|confirm|check|verify)\w*\b/i.test(text);

  if (PAYMENT_CHANGE_CONTRACT_REQUIREMENT.test(atomicRequest)) {
    // "Does a change require a new contract?" is a stable policy decision,
    // not a request to locate or send the current contract artifact.
    relation = "requirement";
    requestKind = "knowledge";
  } else if (greenlightContractStatus) {
    relation = "status";
    requestKind = "current_lookup";
  } else if (PERMISSION_TO_USE_EXISTING_RESOURCE.test(text)) {
    relation = "permission";
    requestKind = "knowledge";
  } else if (PERSONAL_ACTOR_DECISION.test(text)) {
    relation = "owner";
    requestKind = "knowledge";
  } else if (DEFINITION_SHAPED_REQUEST.test(text)) {
    relation = "definition";
    requestKind = "knowledge";
    // "What are the social promo assets?" asks what the term means. Keep an
    // explicit request for the exact/current/specific package asset list in the
    // stricter inclusion lane so a bounded definition cannot masquerade as an
    // enumerated deliverables list.
  } else if (STABLE_NAVIGATION_QUESTION.test(text) && !LIVE_MUTATION_REQUEST.test(text) && !CURRENT_FAILURE_OR_STATUS.test(text)) {
    relation = inferV4SystemicRelation(need.originalRequestText || need.authorityText || need.text);
    requestKind = "knowledge";
  } else if (GENERIC_ACTOR_REQUIREMENT.test(need.originalRequestText || need.authorityText || need.text)) {
    relation = "requirement";
    requestKind = "knowledge";
  } else if (LIVE_MUTATION_REQUEST.test(text)) {
    requestKind = "operational_action";
  } else if (CURRENT_FAILURE_OR_STATUS.test(text) && /\b(?:confirm|verify|check|trace|why|status|failed|failing|declined|sent|received)\b/i.test(text)) {
    requestKind = "current_lookup";
  } else {
    requestKind = inferV4SystemicRequestKind(need.originalRequestText || need.authorityText || need.text);
  }

  const atomicNeedText = [need.text, ...need.entities].join(" ");
  if (relation === "definition" && /\bsocial\s+promo(?:tional)?\s+assets?\b/i.test(atomicNeedText) &&
    !/\b(?:exact|specific|complete|full|list|enumerate|which|current)\b/i.test(need.originalRequestText || need.authorityText || need.text)) {
    refinedText = "Define social promotional assets and explain their purpose in the offer.";
  }

  const paymentChangeRequirement = PAYMENT_CHANGE_CONTRACT_REQUIREMENT.test(atomicRequest);
  const dailyStatsCorrection = /\b(?:correct|correction|incorrect|wrong|mistake)\w*\b/i.test(atomicRequest) &&
    /\b(?:daily|eod|end[- ]of[- ]day)\s+stats?\b/i.test(need.originalRequestText || text);
  const refined = {
    ...need,
    text: refinedText,
    relation,
    requestKind,
    domains: [
      ...(paymentChangeRequirement
        ? need.domains.filter((domain) => domain !== "controlled artifact")
        : need.domains),
      ...(dailyStatsCorrection ? ["daily stats"] : []),
    ].filter((domain, index, all) => all.indexOf(domain) === index),
    actions: paymentChangeRequirement
      ? need.actions.filter((action) => action !== "locate current artifact")
      : need.actions,
  };
  const referralIntakeOwner = /\b(?:self[- ]generated|self[- ]sourced|client\s+referral|referral)\b/i.test(text) &&
    /\b(?:enter|entry|apply|application|submit\s+greenlight|intake|workflow)\b/i.test(text)
    ? "sales_tech" as const
    : null;
  if (missingReferencedContext) requestKind = "current_lookup";
  const forcedRouteKey = missingReferencedContext
    ? "sales_policy" as const
    : referralIntakeOwner || (requestKind === "knowledge" ? null : deterministicRouteOwner(text, requestKind));
  return { ...refined, requestKind, forcedRouteKey };
}

export function refineV51QueryPlan(plan: V4SystemicQueryPlan, _turn: V3TurnResolution): V4SystemicQueryPlan {
  void _turn;
  const needs = plan.needs.map(refineNeed);
  const changed = needs.some((need, index) =>
    need.relation !== plan.needs[index].relation ||
    need.requestKind !== plan.needs[index].requestKind ||
    need.forcedRouteKey !== plan.needs[index].forcedRouteKey,
  );
  return {
    ...plan,
    needs,
    reasoningSummary: changed
      ? `${plan.reasoningSummary} V5.1 preserved stable navigation as knowledge and bound live work to its deterministic action owner.`
      : plan.reasoningSummary,
  };
}

export function resolveV51RouteKey(
  need: V4SystemicNeed,
  decision: V4SystemicNeedDecision,
  retrieval: V4SystemicRetrieval,
): RouteKey {
  const text = completeText(need);
  if (need.forcedRouteKey) return need.forcedRouteKey;
  const deterministic = deterministicRouteOwner(text, need.requestKind);
  if (deterministic) return deterministic;

  // A reusable policy question with no exact answer belongs to Sales
  // Questions. Evidence or model hints cannot redirect it merely because a
  // finance, greenlight, or tech word appeared in the topic.
  if (need.requestKind === "knowledge") return "sales_policy";

  const hinted = [
    decision.routeKey,
    ...decision.evidenceRefs.map((id) => retrieval.candidates.find((candidate) => candidate.policy.id === id)?.policy.route_key || null),
  ].find((key): key is RouteKey => Boolean(key && ["sales_policy", "sales_tech", "finance", "fulfillment", "greenlight"].includes(key)));
  return hinted || "sales_policy";
}

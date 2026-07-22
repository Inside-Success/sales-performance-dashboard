import type { AskSalesFaqChatMessage, AskSalesFaqStructuredAnswer } from "@/lib/ask-sales-faq/types";
import { parseV3Json } from "@/lib/ask-sales-faq/v3/provider";
import type { V3Policy, V3Provider, V3ProviderAttempt, V3TurnResolution } from "@/lib/ask-sales-faq/v3/types";
import { v4BlockedTopicDecisionMatch, v4BlockedTopicMatchesNeed, v4PolicyCanAnswer, v4PolicyBoundaryErrors } from "@/lib/ask-sales-faq/v4/boundaries";
import {
  getV4KnowledgeVersion,
  getV4MainShowNames,
  getV4RouteCatalog,
  V4_LITE_REPEAT_EPISODE_BOUNDARY_CLAIM,
  V4_MAIN_STANDARD_PROMO_VIEWS_CLAIM,
  V4_VIP_REPEAT_EPISODE_DISCOUNT_CLAIM,
} from "@/lib/ask-sales-faq/v4/corpus";
import { deterministicV4SentenceErrors } from "@/lib/ask-sales-faq/v4/facts";
import { generateV4Json, generateV4ValidationJson, providerAttemptsFromV4Error } from "@/lib/ask-sales-faq/v4/provider";
import { sanitizeV4SensitiveText } from "@/lib/ask-sales-faq/v4/privacy";
import { resolveV4PriorityPolicyFamily, retrieveV4Policies } from "@/lib/ask-sales-faq/v4/retrieval";
import { resolveV4Turn, v4DecisionQuestion } from "@/lib/ask-sales-faq/v4/turn";
import type {
  AskSalesFaqV4Result,
  V4AnswerPlan,
  V4Candidate,
  V4ComposedSentence,
  V4Composition,
  V4BlockedCandidate,
  V4Lane,
  V4PlannedNeed,
  V4RuntimeOptions,
  V4SentenceCheck,
  V4Validation,
  V4RetrievalResult,
} from "@/lib/ask-sales-faq/v4/types";

const routeCatalog = getV4RouteCatalog();
const allowedRouteKeys = new Set(Object.keys(routeCatalog));
const V4_DIRECT_INSTRUCTION_PATTERNS = new Map<string, RegExp>([
  ["owner-current-show-list-watchability-boundary", /\b(?:show list|catalog|listed|watch|watchable|stream|on air|aired|airing|episode availability)\b/i],
  ["claim_d2519c5b8045823b", /\b(?:texted|replied|said|wrote) stop\b|\bstop\b.{0,100}\b(?:reinstat|resubscrib|contact|book)\w*\b/i],
  ["owner-six-month-training-discontinued", /\b(?:six[ -]?month|weekly)\b.{0,80}\btraining\b|\btraining\b.{0,80}\b(?:six[ -]?month|weekly)\b/i],
  ["claim_d8f7bb6d2647ddd3", /\b(?:photo|photos|photograph|photographs|photographed|photographing|screenshot|screenshots)\b.{0,80}\bslides?\b|\bslides?\b.{0,80}\b(?:photo|photos|photograph|photographs|photographed|photographing|screenshot|screenshots)\b/i],
]);
const V4_POLICY_ROUTE_OVERRIDES = new Map<string, string>([
  ["owner-scriptwriter-scheduling-fulfillment-route", "fulfillment"],
]);

function clean(value: unknown, limit = 4000) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function v4DirectInstructionApplies(policy: V3Policy, request: string) {
  if (policy.id === "claim_d8f7bb6d2647ddd3" &&
    /\bnot\b.{0,80}\b(?:slide photos?|photos? of (?:the )?slides?|photograph(?:ing|s|ed)? (?:the )?slides?)\b/i.test(request)) {
    return false;
  }
  return V4_DIRECT_INSTRUCTION_PATTERNS.get(policy.id)?.test(request) === true;
}

function v4SupportModeRequest(turn: V3TurnResolution) {
  const positiveCorrection = turn.currentQuestion.split(/\bnot\b/i, 1)[0];
  const priorFacets = v4CoverageFacets(turn.immediatePreviousUserQuestion || "");
  const positiveFacets = v4CoverageFacets(positiveCorrection);
  const introducesNewDecisionFacet = [...positiveFacets].some((facet) => !priorFacets.has(facet));
  const useResolvedCorrection = turn.kind === "follow_up" &&
    turn.explicitCorrection &&
    turn.usedImmediateContext &&
    !turn.explicitScopeSwitch &&
    !introducesNewDecisionFacet;
  return useResolvedCorrection ? `${turn.currentQuestion}\n${turn.standaloneQuestion}` : v4DecisionQuestion(turn);
}

function displayText(value: unknown, limit = 4000) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim()
    .replace(/\s*(?:\(|\[)(?:C\d{1,2}|E\d{1,2})(?:\s*[,;]\s*(?:C\d{1,2}|E\d{1,2}))*\s*(?:\)|\])/gi, "")
    .replace(/\b(?:in|from) (?:my|the|our) (?:knowledge base|retrieval|RAG|evidence set)\b/gi, "in the current guidance")
    .replace(/\s+/g, " ")
    .trim();
  if (normalized.length <= limit) return normalized;
  const prefix = normalized.slice(0, Math.max(1, limit));
  const sentenceBoundary = Math.max(prefix.lastIndexOf(". "), prefix.lastIndexOf("! "), prefix.lastIndexOf("? "));
  if (sentenceBoundary >= Math.floor(limit * 0.6)) return prefix.slice(0, sentenceBoundary + 1).trim();
  const wordBoundary = prefix.lastIndexOf(" ");
  return `${prefix.slice(0, wordBoundary > 0 ? wordBoundary : limit).trimEnd()}…`;
}

function stringArray(value: unknown, limit = 20) {
  return Array.isArray(value) ? value.map((item) => clean(item, 500)).filter(Boolean).slice(0, limit) : [];
}

function clampConfidence(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  const scaled = numeric >= 0 && numeric <= 1 ? numeric * 100 : numeric;
  return Math.max(0, Math.min(100, Math.round(scaled)));
}

function redactSensitiveText(value: string) {
  return sanitizeV4SensitiveText(value, 12000);
}

function evidenceDecision(policy: V3Policy) {
  const match = policy.decision.match(/^\s*Policy context:\s*[\s\S]*?\s*Decision evidence:\s*([\s\S]+?)\s*$/i);
  const value = displayText(match?.[1] || policy.decision, 4000).replace(/^"([\s\S]+)"$/, "$1");
  if (!value.includes("|")) return value;
  return value.split("|")
    .map((cell) => cell.replace(/\s+/g, " ").trim())
    .filter((cell) => cell && !/^[-: ]+$/.test(cell))
    .join("; ")
    .replace(/;\s*;/g, ";")
    .replace(/:;/g, ":")
    .trim();
}

function evidenceText(policies: V3Policy[]) {
  return policies.map((policy) => `${policy.title}: ${evidenceDecision(policy)}`).join("\n");
}

function candidateCards(candidates: V4Candidate[], request = "") {
  return candidates.slice(0, 28).map((candidate, index) => ({
    ref: `C${index + 1}`,
    title: candidate.policy.title,
    question_families: candidate.policy.question_families.slice(0, 5),
    decision: evidenceDecision(candidate.policy),
    decision_key: candidate.policy.decision_key,
    product_scopes: candidate.policy.product_scopes,
    domains: candidate.policy.domains,
    actions: candidate.policy.actions,
    entities: candidate.policy.entities,
    answerability: candidate.policy.answerability,
    quality_tier: candidate.policy.quality_tier,
    authority: candidate.policy.authority,
    route_key: V4_POLICY_ROUTE_OVERRIDES.get(candidate.policy.id) || candidate.policy.route_key,
    v4_support_mode: v4DirectInstructionApplies(candidate.policy, request) ? "direct_governed_instruction" : candidate.policy.answerability === "route_or_support" ? "route_only" : "answer_evidence",
    last_reviewed: candidate.policy.last_reviewed,
  }));
}

function resolveCandidateRef(value: string, candidates: V4Candidate[]) {
  const direct = candidates.find((candidate) => candidate.policy.id === value)?.policy.id;
  if (direct) return direct;
  const ref = value.match(/^C(\d{1,2})$/i);
  if (!ref) return null;
  return candidates[Number.parseInt(ref[1], 10) - 1]?.policy.id || null;
}

type ConcreteProductScope = "main_istv" | "dj_nlceo";

function mentionedProductScopes(value: string) {
  const scopes = new Set<ConcreteProductScope>();
  if (/\b(?:main\s+istv|inside success(?:\s+tv)?|istv)\b/i.test(value)) scopes.add("main_istv");
  if (/\b(?:daymond john|next level ceo|nlceo|dj\/nlceo|dj show)\b/i.test(value)) scopes.add("dj_nlceo");
  return scopes;
}

function decisionProductScopes(policy: V3Policy) {
  if (policy.product_scopes.includes("product_agnostic")) return new Set<ConcreteProductScope>();
  const explicit = mentionedProductScopes(evidenceDecision(policy));
  if (explicit.size) return explicit;
  return new Set(policy.product_scopes.filter((scope): scope is ConcreteProductScope => scope === "main_istv" || scope === "dj_nlceo"));
}

function hasNonEnglishCondition(value: string) {
  const positive = /\b(?:spanish|non[- ]english|language barrier|translat(?:e|ion)|interpreter|does not speak english|doesn't speak english|cannot speak english|can't speak english)\b/i.test(value);
  const negated = /\b(?:not|isn't|is not|wasn't|was not|without)\s+(?:a\s+)?(?:spanish|non[- ]english|language barrier|translation|interpreter)\b/i.test(value);
  return positive && !negated;
}

function hasBankBlockedPaymentCondition(value: string) {
  const negated = /\b(?:bank|card|payment)\b.{0,40}\b(?:did not|didn't|does not|doesn't|was not|wasn't|is not|isn't|never)\b.{0,30}\b(?:block|blocked|decline|declined|fail|failed)\b|\b(?:payment|card)\b.{0,30}\b(?:went|goes) through\b/i.test(value);
  if (negated) return false;
  return /\bbank\b.{0,80}\b(?:block|blocked|decline|declined|prevent|prevented|stop|stopped)\b|\b(?:payment|card)\b.{0,80}\b(?:block|blocked|decline|declined|fail|failed|cannot go through|can't go through|could not go through|couldn't go through|won't go through)\b/i.test(value);
}

function hasCanceledCall2ForInvestmentInability(value: string) {
  const canceledCall2 = /\bcancel(?:ed|led|ing)?\b.{0,160}\bcall\s*2\b|\bcall\s*2\b.{0,160}\bcancel(?:ed|led|ing)?\b/i.test(value);
  const inability = /\b(?:cannot|can't|could not|couldn't|unable to|not able to|did not have|didn't have|does not have|doesn't have|insufficient|not enough|no)\b.{0,50}\b(?:afford|invest|investment|funds?|money)\b|\b(?:afford|invest|investment|funds?|money)\b.{0,50}\b(?:unavailable|insufficient|not available)\b/i.test(value);
  const contrary = /\b(?:can|could|was able to|is able to)\s+(?:afford|invest|make (?:the )?investment)\b/i.test(value);
  const cancelThenCause = /(?:\bcancel(?:ed|led|ing)?\b.{0,120}\bcall\s*2\b|\bcall\s*2\b.{0,120}\bcancel(?:ed|led|ing)?\b)\s*[,—–-]?\s*(?:(?:because|since)\s+(?:they\s+|the\s+(?:applicant|prospect|lead)\s+)?(?:cannot|can't|could not|couldn't|were unable to|was unable to|did not have|didn't have|does not have|doesn't have|had insufficient|had no|had not enough).{0,35}(?:afford|invest|investment|funds?|money)|due to\s+(?:their\s+|an?\s+)?(?:inability to (?:afford|invest)|lack of funds?|insufficient funds?|not enough money))/i.test(value);
  return canceledCall2 && inability && !contrary && cancelThenCause;
}

function hasFranchiseCondition(value: string) {
  return /\bfranchis(?:e|ee|or)\b/i.test(value) && !/\b(?:not|isn't|is not|wasn't|was not)\s+(?:a\s+)?franchis(?:e|ee|or)\b/i.test(value);
}

function hasHospitalEmployedCondition(value: string) {
  const positive = /\b(?:hospital[- ]employed|employed by (?:a )?hospital)\b/i.test(value);
  const negated = /\b(?:not|isn't|is not|wasn't|was not)\s+hospital[- ]employed\b|\b(?:not|isn't|is not|wasn't|was not)\s+employed by (?:a )?hospital\b/i.test(value);
  return positive && !negated;
}

const V4_POLICY_PRECONDITIONS: Array<{ label: string; policy: RegExp; request: (value: string) => boolean }> = [
  {
    label: "a non-English or translation scenario",
    policy: /\b(?:non[- ]english|english[- ]speaking|spanish|language barrier|translat(?:e|ion)|interpreter)\b/i,
    request: hasNonEnglishCondition,
  },
  {
    label: "a bank-blocked or failed-payment scenario",
    policy: /\b(?:bank block|bank blocked|bank.*(?:declin|prevent|stop)|payment (?:cannot|can't|could not|couldn't|won't) go through)\b/i,
    request: hasBankBlockedPaymentCondition,
  },
  {
    label: "a canceled Call 2 caused by inability to invest",
    policy: /\bcancel(?:ed|led|ing)?\b.{0,100}\bcall\s*2\b.{0,140}\b(?:invest|afford|funds?)\b|\bcall\s*2\b.{0,100}\bcancel(?:ed|led|ing)?\b.{0,140}\b(?:invest|afford|funds?)\b/i,
    request: hasCanceledCall2ForInvestmentInability,
  },
  {
    label: "a franchise-owner scenario",
    policy: /\bfranchis(?:e|ee|or)\b/i,
    request: hasFranchiseCondition,
  },
  {
    label: "a hospital-employed physician scenario",
    policy: /\b(?:hospital[- ]employed|employed by (?:a )?hospital)\b/i,
    request: hasHospitalEmployedCondition,
  },
];

function v4PolicyPreconditionErrors(policy: V3Policy, turn: V3TurnResolution) {
  const policyIntent = `${policy.title} ${policy.question_families.join(" ")} ${evidenceDecision(policy)}`;
  const request = `${turn.standaloneQuestion} ${v4DecisionQuestion(turn)}`;
  return V4_POLICY_PRECONDITIONS.flatMap(({ label, policy: policyPattern, request: requestMatches }) =>
    policyPattern.test(policyIntent) && !requestMatches(request) ? [`policy requires ${label} that is absent or explicitly negated in the request`] : [],
  );
}

function asksMultiBusinessEpisodeFocus(value: string) {
  return /\b(?:two|multiple|both|different|separate|more than one)\s+(?:distinct\s+)?business(?:es)?\b/i.test(value) &&
    /\b(?:episode|show|operation ceo)\b/i.test(value) &&
    /\b(?:choose|focus|feature|mention|discuss|cover|include)\b/i.test(value);
}

function evidenceGovernsMultiBusinessEpisodeFocus(policy: V3Policy) {
  const evidence = `${policy.title} ${policy.question_families.join(" ")} ${evidenceDecision(policy)}`;
  return /\b(?:two|multiple|both|different|separate|more than one)\s+(?:distinct\s+)?business(?:es)?\b/i.test(evidence) &&
    /\b(?:episode|show|operation ceo)\b/i.test(evidence) &&
    /\b(?:choose|focus|feature|mention|discuss|cover|include)\b/i.test(evidence);
}

function v4PolicyDecisionObjectErrors(policy: V3Policy, turn: V3TurnResolution, needText: string) {
  const request = `${v4DecisionQuestion(turn)} ${needText}`;
  if (asksMultiBusinessEpisodeFocus(request) && !evidenceGovernsMultiBusinessEpisodeFocus(policy)) {
    return ["policy governs people or partners, not whether one applicant may feature multiple businesses in one episode"];
  }
  if (policy.id === "claim_6e636dc287b976f5" &&
    /\b(?:employees?|employee count|team size|staff(?:ing)?|headcount)\b/i.test(needText) &&
    !/\b(?:time in business|how long|years? in business|months? in business|business age)\b/i.test(needText)) {
    return ["policy governs minimum time in business, not an employee-count qualification threshold"];
  }
  return [];
}

function productScopeErrorsForNeed(needText: string, policies: V3Policy[], turn: V3TurnResolution) {
  const evidenceScopes = policies.map((policy) => decisionProductScopes(policy));
  if (!evidenceScopes.some((scopes) => scopes.size)) return [];
  if (turn.productScope === "unknown") {
    const boundaryText = `${v4DecisionQuestion(turn)} ${needText}`;
    const exactTierOneBoundary = policies.some((policy) => policy.id === "owner-vip-tier-one-platform-boundary") &&
      policies.every((policy) => policy.product_scopes.includes("main_istv") || policy.product_scopes.includes("product_agnostic")) &&
      /\b(?:tier[ -]?1|platforms?|placement|submit|submission|apple tv|amazon prime|tubi)\b/i.test(boundaryText);
    const exactStandardPromoFingerprint = policies.some((policy) => policy.id === "claim_c9e50172a4cd057b") &&
      /\$\s*20\s*k\b|\$\s*20,?000\b/i.test(boundaryText) &&
      /\b(?:promotional|pre[- ]?promo)\s+views?\b/i.test(boundaryText);
    const namesMainShow = getV4MainShowNames().some((showName) => {
      const escaped = showName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`\\b${escaped.replace(/\\\s+/g, "\\s+")}\\b`, "i").test(boundaryText);
    });
    const namedMainShowBoundary = namesMainShow && evidenceScopes.every((scopes) => !scopes.size || scopes.has("main_istv"));
    if (exactTierOneBoundary || exactStandardPromoFingerprint || namedMainShowBoundary) return [];
    return ["product-specific evidence cannot answer a need whose product scope is unknown"];
  }
  if (turn.productScope !== "comparison") return [];

  const needScopes = mentionedProductScopes(needText);
  if (!needScopes.size) {
    return ["comparison needs must name the product scope for each product-sensitive atomic answer"];
  }
  if (evidenceScopes.some((scopes) => scopes.size && ![...scopes].some((scope) => needScopes.has(scope)))) {
    return ["comparison evidence does not match the product scope named by the atomic need"];
  }
  if ([...needScopes].some((scope) => !evidenceScopes.some((scopes) => scopes.has(scope)))) {
    return ["comparison evidence does not cover every product scope named by the atomic need"];
  }
  return [];
}

function v4PolicySupportErrors(policy: V3Policy, turn: V3TurnResolution, needText: string) {
  const errors = [
    ...v4PolicyBoundaryErrors(policy, turn),
    ...v4PolicyPreconditionErrors(policy, turn),
    ...v4PolicyDecisionObjectErrors(policy, turn, needText),
  ];
  const request = `${v4DecisionQuestion(turn)} ${needText}`;
  const exactNegativeWatchabilityBoundary = policy.id === "owner-current-show-list-watchability-boundary" &&
    v4DirectInstructionApplies(policy, request);
  const exactStopReinstatementRoute = policy.id === "claim_d2519c5b8045823b" &&
    v4DirectInstructionApplies(policy, request);
  const exactV4DirectInstruction = v4DirectInstructionApplies(policy, request);
  const platformChoiceWithoutAuthority = /\b(?:choose|select|decide|control|pick)\b.{0,80}\b(?:tier[ -]?1|platform)\b|\b(?:tier[ -]?1|platform)\b.{0,80}\b(?:choose|select|decide|control|pick)\b/i.test(needText) &&
    !/\b(?:choose|select|decide|control|pick)\b/i.test(evidenceDecision(policy));
  const filtered = exactNegativeWatchabilityBoundary || exactStopReinstatementRoute || exactV4DirectInstruction
    ? errors.filter((error) => error !== "route or resource evidence cannot authorize a substantive decision")
    : errors;
  return platformChoiceWithoutAuthority ? [...filtered, "the evidence does not grant the client a Tier-1 platform selection right"] : filtered;
}

function v4PolicyCanSupportNeed(policy: V3Policy, turn: V3TurnResolution, needText: string) {
  return (v4PolicyCanAnswer(policy, turn) || v4DirectInstructionApplies(policy, `${v4DecisionQuestion(turn)} ${needText}`)) &&
    v4PolicySupportErrors(policy, turn, needText).length === 0;
}

type V4QuestionCoverageFacet =
  | "app_access"
  | "artifact"
  | "discount"
  | "event_or_guest"
  | "guarantee"
  | "language"
  | "payment"
  | "platform_coverage"
  | "price"
  | "qualification"
  | "refund_or_cancel"
  | "recording_disclosure"
  | "rights"
  | "roi"
  | "schedule_or_timing"
  | "season_capacity"
  | "show_list"
  | "submission"
  | "technical_access"
  | "upgrade"
  | "viewer_statistics"
  | "watchability"
  | "quantity";

const V4_QUESTION_COVERAGE_FACETS: Array<[V4QuestionCoverageFacet, RegExp]> = [
  ["app_access", /\b(?:download|install|get)\b.{0,50}\bapp\b|\bapp\b.{0,50}\b(?:device|devices|roku|fire stick|apple tv)\b/i],
  ["artifact", /\b(?:pdf|deck|slides?|slide deck|presentation|document|script|template|media kit|resource|contract link|payment link|training video|recording link)\b/i],
  ["discount", /\b(?:discount|discounted|half[ -]?off|same[ -]?day|crossover|cross[ -]?product)\b|\b50\s*%/i],
  ["event_or_guest", /\b(?:guests?|invite|invitation|attend|attendance|mastermind|red[ -]?carpet)\b|\b(?:event|mastermind|red[ -]?carpet)\b.{0,50}\b(?:access|entry|bring)\b/i],
  ["guarantee", /\b(?:promise|promised|guarantee|guaranteed|definitely approved|assure|assured|commit|committed)\b/i],
  ["language", /\b(?:spanish|non[- ]english|another language|translation|translate|translated|bilingual)\b/i],
  ["payment", /\b(?:pay|paid|payment|payments|ach|invoice|invoices|ledger|deposit|down payment|installments?|instalments?|split option|split options|pif|paid in full)\b|\b\d+\s*x\s*\$?\s*\d/i],
  ["platform_coverage", /\b(?:tier[ -]?1|platform|platforms|apple tv|amazon prime|tubi)\b/i],
  ["price", /\b(?:price|prices|pricing|cost|costs|costing)\b|(?:\$|£)\s*\d/i],
  ["qualification", /\b(?:qualify|qualifies|qualified|qualifying|qualification|eligible|eligibility|disqualify|disqualified)\b|\bfreelanc(?:e|er|ers|ing)\b.{0,70}\b(?:call\s*2|move|advance|qualif)\w*\b/i],
  ["refund_or_cancel", /\b(?:refund|refundable|chargeback)\b|\b(?:cancel|cancellation)\w*\b.{0,50}\b(?:contract|purchase|payment|episode|license|after signing|signed agreement)\b|\b(?:contract|purchase|payment|episode|license|signed agreement)\b.{0,50}\b(?:cancel|cancellation)\w*\b/i],
  ["recording_disclosure", /\b(?:record|recorded|recording|recordings)\b.{0,35}\b(?:call|client|prospect|conversation|meeting|zoom|audio|video|details?)\b|\b(?:call|client|prospect|conversation|meeting|zoom|audio|video|details?)\b.{0,35}\b(?:record|recorded|recording|recordings)\b|\b(?:disclose|disclosed|disclosing|disclosure)\b/i],
  ["rights", /\b(?:content rights|ownership|own the|license rights|reuse|use their segment|contract rights)\b/i],
  ["roi", /\b(?:roi|return on investment|revenue|leads?|fundrais|business outcome)\b/i],
  ["schedule_or_timing", /\b(?:schedule|scheduled|booking|book|deadline|cutoff|timing|dates?|weeks?|months?|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|\bwhen\b.{0,50}\b(?:submit|submission|film|filming|receive|deliver)\b/i],
  ["season_capacity", /\b(?:season|seasons|episodes per season|season capacity)\b/i],
  ["show_list", /\b(?:show list|list of shows|list the shows|what shows|approved shows|active shows|available shows)\b/i],
  ["submission", /\b(?:submit|submits|submitted|submission)\b|\bpayme\s+(?:post|entry)\b|\b(?:post|entry)\s+(?:in|to)\s+payme\b/i],
  ["technical_access", /\b(?:login|log in|access issue|cannot access|can't access|broken link|sales tech|technical issue)\b|\b(?:keap|zoom phone)\b.{0,40}\b(?:login|access|broken|error|issue|missing|not working)\b|\b(?:login|access|broken|error|issue|missing|not working)\b.{0,40}\b(?:keap|zoom phone)\b/i],
  ["upgrade", /\b(?:upgrade|upgrading|move from|moving from)\b/i],
  ["viewer_statistics", /\b(?:views|viewers|viewership|audience|demographics|awards)\b/i],
  ["watchability", /\b(?:watch|watchable|stream|streaming|on air|aired|airing|episode availability|episode link|available to view)\b/i],
  ["quantity", /\b(?:how many|number of|count|all three)\b|\b(?:one|two|three|multiple)\b.{0,24}\b(?:platforms?|packages?|people|persons?|guests?|seasons?|episodes?|shows?|payments?|installments?|instalments?)\b|\b(?:platforms?|packages?|people|persons?|guests?|seasons?|episodes?|shows?|payments?|installments?|instalments?)\b.{0,24}\b(?:one|two|three|multiple)\b/i],
];

// These decision facets must appear in the supported claim, not merely in a
// planner need that could have copied the user's wording while answering less.
const V4_CLAIM_REQUIRED_COVERAGE_FACETS = new Set<V4QuestionCoverageFacet>([
  "app_access",
  "discount",
  "event_or_guest",
  "guarantee",
  "language",
  "payment",
  "platform_coverage",
  "price",
  "qualification",
  "recording_disclosure",
  "refund_or_cancel",
  "rights",
  "roi",
  "schedule_or_timing",
  "season_capacity",
  "submission",
  "technical_access",
  "upgrade",
  "viewer_statistics",
  "watchability",
  "quantity",
]);

const V4_COVERAGE_STOP_WORDS = new Set([
  "a", "about", "an", "and", "are", "as", "at", "be", "by", "can", "could", "do", "does", "for", "from", "has", "have", "how", "i", "if", "in", "is", "it", "me", "my", "now", "of", "on", "or", "our", "should", "that", "the", "their", "this", "to", "we", "what", "when", "where", "which", "who", "why", "will", "with", "would", "you",
]);

const V4_BROAD_BLOCKED_SUBJECTS = new Set([
  "applicant", "applicants", "client", "clients", "customer", "customers", "episode", "episodes", "istv", "lead", "leads", "nlceo", "package", "packages", "prospect", "prospects", "rep", "reps", "sale", "sales", "show", "shows", "vip",
]);

function v4CoverageFacets(value: string) {
  return new Set(V4_QUESTION_COVERAGE_FACETS.flatMap(([facet, pattern]) => pattern.test(value) ? [facet] : []));
}

function v4CoverageTerms(value: string) {
  return new Set(value.toLowerCase()
    .replace(/tier[ -]?1/g, "tier1")
    .replace(/apple tv/g, "appletv")
    .replace(/amazon prime/g, "amazonprime")
    .replace(/daymond john|next level ceo|dj\s*\/\s*nlceo/g, "nlceo")
    .replace(/inside success tv|main istv/g, "istv")
    .replace(/same[ -]?day/g, "sameday")
    .replace(/cross[ -]?product/g, "crossover")
    .replace(/\b(?:reapplying|reapply|reapplies|reapplied|applying|applies|applied)\b/g, "apply")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((term) => term.length > 2 && !V4_COVERAGE_STOP_WORDS.has(term)));
}

const V4_DIRECT_MATCH_IGNORED_TERMS = new Set([
  ...V4_BROAD_BLOCKED_SUBJECTS,
  "answer", "approved", "available", "booking", "call", "calls", "confirm", "contract", "current", "decision", "discount", "discounts", "explain", "guidance", "month", "months", "payment", "payments", "policy", "premium", "price", "pricing", "process", "program", "question", "route", "schedule", "scheduling", "six", "verify", "weekly",
]);

function v4DirectMatchTerms(value: string) {
  return new Set([...v4CoverageTerms(value)].filter((term) => !V4_DIRECT_MATCH_IGNORED_TERMS.has(term) && !/^\d+$/.test(term)));
}

function v4EvidenceCoversNeedFacets(policies: V3Policy[], needText: string) {
  const needed = v4CoverageFacets(needText);
  const evidenceTextValue = policies.map((policy) => evidenceDecision(policy)).join(" ");
  const covered = v4CoverageFacets(evidenceTextValue);
  const variableAmountBoundary = /\b(?:unlisted|custom)\b.{0,80}\b(?:amount|split|payment|plan)\b|\b(?:amount|split|payment|plan)\b.{0,80}\b(?:unlisted|custom)\b/i.test(evidenceTextValue);
  return [...needed].every((facet) =>
    !V4_CLAIM_REQUIRED_COVERAGE_FACETS.has(facet) || covered.has(facet) || (variableAmountBoundary && ["price", "quantity"].includes(facet)),
  );
}

function v4PolicyDirectlyAddressesNeed(policy: V3Policy, needText: string) {
  if (!v4EvidenceCoversNeedFacets([policy], needText)) return false;
  const needTerms = v4DirectMatchTerms(needText);
  if (needTerms.size < 2) return false;
  return [policy.title, ...policy.question_families].some((family) => {
    const policyTerms = v4DirectMatchTerms(family);
    if (policyTerms.size < 2) return false;
    const overlap = [...needTerms].filter((term) => policyTerms.has(term));
    const needCoverage = overlap.length / needTerms.size;
    const familyCoverage = overlap.length / policyTerms.size;
    return overlap.length >= 2 && overlap.some((term) => term.length >= 6) && needCoverage >= 0.3 && familyCoverage >= 0.45;
  });
}

function v4PoliciesDirectlyAddressNeed(policies: V3Policy[], needText: string) {
  return policies.length > 0 &&
    v4EvidenceCoversNeedFacets(policies, needText) &&
    policies.some((policy) => v4PolicyDirectlyAddressesNeed(policy, needText));
}

function v4BlockedTopicMatchesOriginalQuestion(topic: V4BlockedCandidate["topic"], question: string) {
  const match = v4BlockedTopicDecisionMatch(topic, question);
  if (!match.matches) return false;
  if (match.matchKind === "canonical_family" || match.matchKind === "legacy_anchor") return true;
  return match.matchedSubjects.some((subject) =>
    !V4_BROAD_BLOCKED_SUBJECTS.has(subject) && !/^\d+(?:\.\d+)?$/.test(subject),
  );
}

function v4QuestionCoverageSegments(question: string) {
  const boundary = /\s*;\s*|\?\s+(?=\S)|(?:,\s*)?\b(?:and|but)\s+(?=(?:also\s+)?(?:can|could|do|does|did|will|would|should|may|might|must|what|when|where|which|who|why|how|exactly\s+when|use|verify|confirm|check|fix|get|download|tell|promise|attend|receive|record|bring|invite|offer)\b)|(?:,\s*)?\bor\s+(?=(?:also\s+)?(?:can|could|do|does|did|will|would|should|may|might|must|what|where|who|why|how|use|verify|confirm|check|fix|get|download|promise|attend|receive|record|bring|invite|offer)\b)|,\s*\band\s+(?=(?:also\s+)?(?:is|are|was|were)\b)|\s+\b(?:plus|as well as|while)\b\s+/gi;
  const segments = displayText(question, 12000)
    .split(boundary)
    .map((segment) => clean(segment
      .replace(/^(?:separately|additionally|also|independently|on a separate point)[,:;—–-]*\s*/i, "")
      .replace(/[?.!,;:]+$/g, ""), 1000))
    .filter((segment) => segment && (v4CoverageFacets(segment).size > 0 || v4CoverageTerms(segment).size > 0))
    .slice(0, 8);
  return segments.length ? segments : [displayText(question, 1000)];
}

function v4RequestedCoverageSegments(question: string) {
  const segments = v4QuestionCoverageSegments(question);
  if (segments.length <= 1) return segments;
  const requested = segments.filter((segment) =>
    /\b(?:can|could|do|does|did|will|would|should|may|might|must|what|when|where|which|who|why|how|use|verify|confirm|check|fix|get|download|tell|promise|attend|receive|record|bring|invite|offer|approve|find|locate|provide|explain)\b/i.test(segment) ||
    /^(?:(?:for|regarding)\b.{0,80},\s*)?(?:is|are|am|was|were)\b/i.test(segment),
  );
  return requested.length ? requested : segments;
}

function everyExactGovernedClauseMatches(question: string, predicate: (segment: string) => boolean) {
  const segments = v4QuestionCoverageSegments(question);
  return segments.length > 0 && segments.every(predicate);
}

function isUnlistedPaymentClause(segment: string) {
  const object = /\$\s*\d|\b(?:pay|payment|amount|first|remaining|balance|later|contract|split|license)\b/i.test(segment);
  const decision = /\b(?:pay|offer|use|sign|send|contract|split|amount|first|remaining|balance|later)\b/i.test(segment);
  return object && decision;
}

function isFreelancerQualificationClause(segment: string) {
  const object = /\b(?:freelanc(?:e|er|ers|ing)|established business|own (?:a\s+)?business|entrepreneur)\b/i.test(segment);
  const decision = /\b(?:qualif|eligible|entrepreneur|business|call\s*2|move|advance)\w*\b/i.test(segment);
  return object && decision;
}

function isPublicCalendarClause(segment: string) {
  const object = /\b(?:public calendar|oncehub|google|calendar|outbound lead|appointment)\b/i.test(segment);
  const decision = /\b(?:book|booking|schedule|times?|availability|available|unavailable|later|next week|process)\w*\b/i.test(segment);
  return object && decision;
}

function isPreviouslyClaimedLeadClause(segment: string) {
  const object = /\b(?:dial[- ]out|20\s*%|twenty percent|claimed lead|original rep|another rep|no[- ]?show)\b/i.test(segment);
  const decision = /\b(?:contact|rebook|book|call|outreach|proceed|claimed|no[- ]?show)\w*\b/i.test(segment);
  return object && decision;
}

function isSixMonthTrainingClause(segment: string) {
  const object = /\b(?:six[ -]?month|weekly training|training program|training|rudy(?:'s)? call videos?|media kit)\b/i.test(segment);
  const decision = /\b(?:still|current|continue|continued|discontinued|receive|available|material|alternative|explain|learn|maximize|use|status|program|training)\w*\b/i.test(segment);
  return object && decision;
}

function isExactFreelancerQualificationPair(segments: string[]) {
  if (segments.length !== 2) return false;
  return segments.some((segment) => /\bfreelanc(?:e|er|ers|ing)\b.{0,80}\b(?:move|go|advance)\b.{0,25}\bcall\s*2\b/i.test(segment)) &&
    segments.some((segment) => /\b(?:established business|own (?:a\s+)?business)\b.{0,80}\bqualif\w*\b|\bqualif\w*\b.{0,80}\b(?:established business|own (?:a\s+)?business)\b/i.test(segment));
}

function isExactPreviouslyClaimedLeadPair(segments: string[]) {
  if (segments.length !== 2) return false;
  return segments.some((segment) => /\b(?:dial[- ]out|20\s*%|twenty percent)\b.{0,120}\b(?:no[- ]?show|claimed|rebook)\w*\b/i.test(segment)) &&
    segments.some((segment) => /\bcontact\w*\b.{0,60}\boriginal rep\b|\boriginal rep\b.{0,60}\bcontact\w*\b/i.test(segment));
}

function asksShowListLocation(question: string) {
  const asksExplicitCatalog = /\b(?:show list|list of shows|show catalog|show roster)\b/i.test(question) ||
    /\b(?:current|active|approved|latest)\s+shows?\b/i.test(question);
  if (!asksExplicitCatalog) return false;
  return /\b(?:where|source|location|link|check|find|locate|access)\b/i.test(question);
}

function asksPaidAllThreePlatforms(question: string) {
  return /\b(?:pay|paid|extra|upgrade)\b.{0,80}\ball\s+(?:3|three)\b.{0,40}\b(?:tier[ -]?1|platforms?)\b/i.test(question) ||
    /\ball\s+(?:3|three)\b.{0,80}\b(?:tier[ -]?1|platforms?)\b.{0,50}\b(?:pay|paid|extra|upgrade)\b/i.test(question);
}

function asksClientMessageReview(question: string) {
  return /\b(?:email|message|reply|response)\b/i.test(question) &&
    /\b(?:fact[ -]?check|write|draft|rewrite|respond|reply|word|better|send)\b/i.test(question);
}

function asksStopReinstatement(question: string) {
  return /\b(?:texted|replied|said|wrote) stop\b|\bstop\b.{0,80}\b(?:reinstat|resubscrib|contact|book)\w*\b/i.test(question);
}

function asksExactSeasonCount(question: string) {
  return /\b(?:how many|number of|exact(?:ly)? how many)\s+seasons?\b/i.test(question);
}

function asksConceptualWatchabilityBoundary(question: string) {
  const hasCatalog = /\b(?:show list|approved list|catalog|listed|list membership)\b/i.test(question);
  const hasBoundaryIntent = /\b(?:mean|means|prove|proves|guarantee|guarantees|does not|doesn't|right)\b/i.test(question);
  return hasCatalog && hasBoundaryIntent;
}

function asksSpecificShowWatchability(question: string) {
  return /\b(?:currently on air|on air|aired|airing|watch|watchable|episode availability|episode link|available to view)\b/i.test(question) &&
    !asksConceptualWatchabilityBoundary(question);
}

function asksLiveEpisodeViewingPath(question: string) {
  const asksForCurrentEpisode = /\b(?:live|currently live|sendable|available)\b.{0,100}\bepisodes?\b|\bepisodes?\b.{0,100}\b(?:live|currently live|sendable|available to (?:view|watch))\b/i.test(question);
  const namesGuestCategory = /\b(?:charity|nonprofit|non-profit|foundation|guest|cast member|someone who|person who)\b/i.test(question);
  const asksToUseOrLocate = /\b(?:do we have|find|where|view|watch|send|share|show)\b/i.test(question);
  return asksForCurrentEpisode && namesGuestCategory && asksToUseOrLocate;
}

function asksControlledArtifactLookup(question: string) {
  return /\b(?:where|find|locate|get|access|download)\b.{0,100}\b(?:document|pdf|deck|slide deck|media kit|resource|script|template|training video|recording link)\b|\b(?:document|pdf|deck|slide deck|media kit|resource|script|template|training video|recording link)\b.{0,100}\b(?:where|find|locate|get|access|download)\b/i.test(question);
}

function asksExactUnlistedPaymentSplit(question: string) {
  const amounts = question.match(/\$\s*\d+(?:\.\d+)?\s*k?\b/gi) || [];
  const proposesAmountsAndTiming = amounts.length >= 2 && /\b(?:first|remaining|balance|later|weeks?|months?|contract|split)\b/i.test(question);
  const negatesProposal = /\b(?:did not|didn't|does not|doesn't|is not|isn't|was not|wasn't|not|never)\b.{0,60}\b(?:ask|want|propose|request|pay|payment|split|amount|first|remaining|balance)\b/i.test(question);
  const unrelatedDecision = /\b(?:refund|refundable|cancel|cancellation|chargeback|guarantee|guaranteed|discount|upgrade|qualif\w*|roi|return on investment|content rights?|platform|criminal|felon|bankrupt|auto[- ]?draft|automatic(?:ally)? draft|approve each payment|ach|guest|invite|invitation|attend|record|legal exception)\b/i.test(question);
  const asksControlledDecision = /\b(?:which|what)\s+contract\b|\b(?:can|may|should|could|do)\b.{0,120}\b(?:offer|use|sign|send|pay|payment|split)\b/i.test(question);
  return proposesAmountsAndTiming && !negatesProposal && !unrelatedDecision && asksControlledDecision;
}

function asksFreelancerQualification(question: string) {
  const namesFreelancing = /\bfreelanc(?:e|er|ers|ing)\b/i.test(question);
  const negatesFreelancing = /\b(?:not|isn't|is not|wasn't|was not|never)\s+(?:only\s+)?(?:a\s+)?freelanc(?:e|er|ers|ing)\b/i.test(question);
  const addsAnotherQualificationObject = /\b(?:criminal|felon|felony|dui|background check|bankrupt|bankruptcy|franchis\w*|hospital|physician|doctor|employee|nonprofit|patent|licensed|certified)\b/i.test(question) ||
    /\bfreelanc(?:e|er|ers|ing)\b.{0,45}\b(?:with|who|whose)\b/i.test(question);
  const asksFreelancerOnlyDecision = /\bshould\s+(?:a\s+)?freelanc(?:e|er|ers|ing)\b.{0,80}\b(?:move|go|advance)\b.{0,20}\bcall\s*2\b/i.test(question) ||
    /\b(?:does|do|can|should)\b.{0,80}\bfreelanc(?:e|er|ers|ing)\b.{0,100}\b(?:qualif\w*|entrepreneur|established business|own (?:a\s+)?business)\b/i.test(question) ||
    /\bqualif\w*\b.{0,100}\b(?:only|solely|just)\b.{0,30}\bfreelanc(?:e|er|ers|ing)\b/i.test(question);
  return namesFreelancing && !negatesFreelancing && !addsAnotherQualificationObject && asksFreelancerOnlyDecision;
}

function asksPublicCalendarFallback(question: string) {
  const namesCalendar = /\b(?:public calendar|oncehub)\b/i.test(question);
  const hasAvailabilityProblem = /\b(?:only allows?|does not (?:show|offer|allow)|doesn't (?:show|offer|allow)|cannot (?:find|see|book)|can't (?:find|see|book)|missing|unavailable|outside)\b.{0,100}\b(?:times?|days?|hours?|book|booking|appointment|next week|later)\b|\b(?:later|next week|outside)\b.{0,100}\b(?:missing|unavailable|not (?:shown|visible|available)|only allows?)\b/i.test(question);
  const explicitlyAvailable = /\b(?:not unavailable|working normally|works normally|no (?:availability )?(?:issue|problem)|later times? (?:are )?(?:visible|available)|times? (?:are )?(?:visible|available))\b/i.test(question);
  const asksConfigurationChange = /\b(?:change|configure|edit|adjust|extend|settings?|make)\b.{0,80}\b(?:oncehub|calendar|times?|availability|window)\b|\b(?:oncehub|calendar)\b.{0,80}\b(?:change|configure|edit|adjust|extend|settings?)\b/i.test(question);
  const asksUnrelatedDecision = /\b(?:record|recording|guest|invite|invitation|discount|refund|contract|legal exception)\b/i.test(question);
  const asksBookingProcess = /\b(?:what|which|how|where|can|may|should|do)\b.{0,120}\b(?:book|booking|schedule|appointment|process|use google)\b/i.test(question);
  return namesCalendar && hasAvailabilityProblem && !explicitlyAvailable && !asksConfigurationChange && !asksUnrelatedDecision && asksBookingProcess;
}

function asksPreviouslyClaimedTwentyPercentLead(question: string) {
  const namesClaimedLead = /\b(?:dial[- ]out|20\s*%|twenty percent)\b/i.test(question) &&
    /\b(?:another|other|original)\s+rep\b/i.test(question) &&
    /\b(?:no[- ]?show(?:ed)?|previously claimed|claimed|rebook|contact)\b/i.test(question);
  const negatesClaim = /\b(?:not|isn't|is not|wasn't|was not|never)\b.{0,50}\b(?:previously\s+)?claimed\b|\bnot\b.{0,35}\b(?:20\s*%|twenty percent|dial[- ]out)\b/i.test(question);
  const asksUnrelatedDecision = /\b(?:record|recording|discount|veteran|refund|guest|invite|invitation|contract|legal exception)\b/i.test(question);
  const asksProcedure = /\b(?:may|can|should|do|what)\b.{0,120}\b(?:rebook|book|contact|call|outreach|proceed|original rep)\b/i.test(question);
  return namesClaimedLead && !negatesClaim && !asksUnrelatedDecision && asksProcedure;
}

function asksSixMonthTrainingGuidance(question: string) {
  const namesProgram = /\b(?:six[ -]?month|weekly)\b.{0,80}\btraining\b|\btraining\b.{0,80}\b(?:six[ -]?month|weekly)\b/i.test(question);
  const asksUnsupportedHistory = /\b(?:who|when|what date|which date|exact date|exactly when|decided|decision maker|why)\b/i.test(question);
  const asksArtifactLocation = /\b(?:where|link|url|download|file|pdf)\b/i.test(question);
  const negatesProgramTopic = /\b(?:not|isn't|is not|wasn't|was not|never)\b.{0,50}\b(?:six[ -]?month|weekly|training|program)\b/i.test(question);
  const asksUnrelatedDecision = /\b(?:guest|invite|invitation|record|recording|discount|price|payment|contract|refund|legal exception)\b/i.test(question);
  const asksStatusOrAlternative = /\b(?:still|current|continue|continued|discontinued|receive|available|additional material|other material|alternative|explain|learn|maximize|use (?:the|their) episode|rudy(?:'s)? call videos?|media kit)\b/i.test(question);
  return namesProgram && !asksUnsupportedHistory && !asksArtifactLocation && !negatesProgramTopic && !asksUnrelatedDecision && asksStatusOrAlternative;
}

function asksTwentyPercentRecordingBoundary(question: string) {
  const hasProgram = /(?:20\s*%|20\s*percent|twenty\s+percent)/i.test(question) &&
    /\b(?:dial[- ]?out|outbound|list|lead|zoom)\b/i.test(question);
  const asksRecording = /\brecord(?:ed|ing|ings)?\b/i.test(question);
  const unrelated = /\b(?:discount|price|refund|contract|guest|event|commission|payment plan|card[- ]payment|payment details?|card details?|credit card|bank details?|legal exception|original rep|another rep|no[- ]?show|rebook|previously claimed)\b/i.test(question);
  return hasProgram && asksRecording && !unrelated;
}

function asksTwentyPercentTemplateTiming(question: string) {
  const hasProgram = /(?:20\s*%|20\s*percent|twenty\s+percent)/i.test(question) &&
    /\b(?:list|dial[- ]?out|outbound|booking|booked)\b/i.test(question);
  const asksMessage = /\b(?:email|sms|text|message|template|wording|confirmation)\w*\b/i.test(question);
  const asksTiming = /\b(?:night before|morning of|day before|calendar day before|when|timing)\b/i.test(question);
  const unrelated = /\b(?:discount|refund|contract|guest|event|commission|payment plan|record(?:ed|ing|ings)?)\b/i.test(question);
  return hasProgram && asksMessage && asksTiming && !unrelated;
}

function asksNlceoCohortTemplateBoundary(question: string) {
  return /\b(?:daymond john|next level ceo|nlceo|dj)\b/i.test(question) &&
    /\bcohort\b/i.test(question) &&
    /\b(?:confirmation|template|text|sms|wording|message)\b/i.test(question) &&
    /\b(?:change|edit|rewrite|update|leave|unchanged|use)\b/i.test(question);
}

function asksInternalStatsSharingBoundary(question: string) {
  const outboundRequest = /\b(?:can|may|should|could|do)\s+(?:i|we)\b.{0,100}\b(?:send|share|show|reference|screenshot|photograph)\b/i.test(question) ||
    /\b(?:send|share|show)\b.{0,80}\b(?:client|prospect|cast member|externally)\b/i.test(question);
  const incomingMaterial = /\b(?:client|prospect|cast member)\b.{0,60}\b(?:sent|shared|showed)\b.{0,40}\b(?:me|us|our team)\b/i.test(question);
  const internalOnly = /\b(?:internal use only|for internal use|keep (?:it|this) internal|not (?:send|share).{0,30}externally)\b/i.test(question);
  return outboundRequest && !incomingMaterial && !internalOnly &&
    /\b(?:stats?|statistics|social reach|combined following|internal numbers?)\b/i.test(question) &&
    /\b(?:slides?|decks?|screenshots?|photos?|images?)\b/i.test(question) &&
    /\b(?:send|share|reference|show|take|taking|photograph|screenshot|client|prospect|external)\w*\b/i.test(question);
}

function asksPodcastPurposeFormat(question: string) {
  return /\bpodcast\b/i.test(question) &&
    /\b(?:lead generation|generate leads|questions|structure|format|designed|purpose|interviewer|recorded)\b/i.test(question) &&
    !/\b(?:where|download|link|schedule|booking time|guest availability|ownership|rights|residuals?|revenue share|refund|cancel|external podcast|external interview|third[- ]party podcast|client records?)\b/i.test(question);
}

function asksNlceoSocialAssetsBoundary(question: string) {
  return /\b(?:daymond john|next level ceo|nlceo|dj)\b/i.test(question) &&
    /\b(?:social|promotional)\b.{0,70}\b(?:assets?|package|management|deliverables?|promise|promising)\b|\b(?:assets?|package|management|deliverables?|promise|promising)\b.{0,70}\b(?:social|promotional)\b/i.test(question) &&
    !/\b(?:results?|case studies?|examples?)\b/i.test(question);
}

function asksEarlyStageQualificationBoundary(question: string) {
  return /\b(?:early[- ]stage|startup|pre[- ]?launch|not launched|launch(?:es|ing)? in|future launch)\b/i.test(question) &&
    /\b(?:call\s*1|qualif\w*|fit|greenlit?|greenlight|eligible|disqualif\w*)\b/i.test(question) &&
    !/\b(?:criminal|felon|felony|dui|bankrupt|bankruptcy|hospital|physician|doctor|employee|nonprofit|franchise|refund|contract exception|legal exception)\b/i.test(question);
}

function asksSpecificFutureLaunchGreenlight(question: string) {
  return asksEarlyStageQualificationBoundary(question) &&
    /\b(?:greenlit?|greenlight|approve|approval|eligible)\b/i.test(question) &&
    /\b(?:in\s+(?:\d+|one|two|three|four|five|six)\s+months?|website|strong story|ability to invest|social proof)\b/i.test(question);
}

function asksVipRepeatEpisodeDiscount(question: string) {
  const vipMentions = question.match(/\bvip\b/gi)?.length || 0;
  const asksRepeatEpisode = /\b(?:second|another|additional|repeat)\b.{0,50}\bepisodes?\b|\bepisodes?\b.{0,50}\b(?:second|another|additional|repeat)\b/i.test(question);
  return vipMentions >= 2 && !/\blite\b/i.test(question) &&
    asksRepeatEpisode &&
    /(?:50\s*%|\bdiscount|half[- ]?off|percent off)\b/i.test(question);
}

function asksLiteRepeatEpisodeDiscountBoundary(question: string) {
  const vipMentions = question.match(/\bvip\b/gi)?.length || 0;
  const asksRepeatEpisode = /\b(?:second|another|additional|repeat)\b.{0,50}\bepisodes?\b|\bepisodes?\b.{0,50}\b(?:second|another|additional|repeat)\b/i.test(question);
  return vipMentions < 2 && /\blite\b/i.test(question) &&
    asksRepeatEpisode &&
    /(?:50\s*%|\bdiscount|half[- ]?off|percent off)\b/i.test(question);
}

function asksScriptwriterProcess(question: string) {
  if (asksControlledArtifactLookup(question)) return false;
  return /\b(?:scriptwriter|script writer|scriptwriting|script writing|scripting)\b/i.test(question) &&
    /\b(?:process|paired|pairing|assigned|onboarding|receive|delivery|delivered|filming)\b/i.test(question);
}

function asksExactScriptDeliveryTiming(question: string) {
  return asksScriptwriterProcess(question) &&
    /\b(?:when|exact(?:ly)?|timing|timeline|receive|delivery|delivered)\b/i.test(question) &&
    /\b(?:filming|film|month|january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(question);
}

function asksEventAccessHandoff(question: string) {
  return /\b(?:event|mastermind|red[- ]?carpet)\b/i.test(question) &&
    /\baccess\b/i.test(question) &&
    /\b(?:call\s*2|sales|onboarding|after (?:the )?sale|explain|explained|discuss|discussed)\b/i.test(question) &&
    !/\b(?:how often|frequency|once a year|address|location|venue|travel|guest rules?|refund|cancel)\b/i.test(question);
}

function asksCurrentEventDateOrTiming(question: string) {
  return /\b(?:when is|what date|which date|exact date|event date|event timing|event schedule|calendar|next event|upcoming event)\b/i.test(question);
}

function asksPartnerPaymentBoundary(question: string) {
  return /\b(?:business partner|partner|family member|decision maker|third party)\b/i.test(question) &&
    /\b(?:pay|payment|paid|payer)\w*\b/i.test(question) &&
    /\b(?:client|cast member|episode|keap|behalf)\b/i.test(question) &&
    !/\b(?:refund|chargeback|dispute|reverse|cancel|discount|tax|receipt)\b/i.test(question);
}

function asksReuseLicensePurposeBoundary(question: string) {
  return /\b(?:commercial )?reuse license\b/i.test(question) &&
    /\b(?:why|purpose|cover|covers|declin\w*|greenlit|greenlight|reuse|republish)\b/i.test(question) &&
    !/\b(?:refund|price|pricing|cost|discount|payment plan|legal exception|contract exception)\b/i.test(question);
}

function asksZoomPhonePaymentLinkBoundary(question: string) {
  return /\bpayment link\b/i.test(question) &&
    /\b(?:zoom phone|sms|text|message)\b/i.test(question) &&
    /\b(?:send|sent|share|provide|allowed|may|can|channel|email)\b/i.test(question) &&
    !/\b(?:broken|error|not working|wrong link|which link|refund|chargeback|discount|price|pricing)\b/i.test(question);
}

function asksFathomZoomRecordingBoundary(question: string) {
  return /\bfathom\b/i.test(question) &&
    /\bzoom\b/i.test(question) &&
    /\b(?:record|recording|transcript|summar\w*|coaching|feedback|action items?|backup|call review)\b/i.test(question) &&
    !/\b(?:storage|retention|download|where (?:is|are)|who can access|legal exception)\b/i.test(question);
}

function asksMainCrossShowReapplyBoundary(question: string) {
  const namesDifferentMainShows = /\b(?:legacy makers|america(?:'|’|s|’s|'s)? authors|different (?:main )?istv show|another (?:main )?istv show)\b/i.test(question);
  return namesDifferentMainShows &&
    hasCanceledCall2ForInvestmentInability(question) &&
    /\b(?:reapply|reapplication|apply now|wait|waiting|three to six months|different show)\b/i.test(question);
}

function asksMissingShowNameRecovery(question: string) {
  return /\b(?:show name|which show)\b/i.test(question) &&
    /\bkeap\b/i.test(question) &&
    /\b(?:missing|blank|not (?:in|on)|no longer|find|recover|update)\b/i.test(question) &&
    !/\b(?:current|active|approved|latest)\s+show list\b|\blist of shows\b/i.test(question);
}

function asksExistingClientCrossShowBoundary(question: string) {
  return /\b(?:existing|current|already)\b.{0,55}\b(?:istv )?(?:client|customer|cast member)\b|\balready an? istv customer\b/i.test(question) &&
    /\b(?:another|different|new)\b.{0,45}\b(?:istv )?show\b/i.test(question) &&
    /\b(?:apply|application|proceed|skip|call|buy|purchase|rep assignment|assigned)\w*\b/i.test(question) &&
    !/\b(?:refund|cancel a purchase|discount|price|pricing|guarantee|legal exception)\b/i.test(question);
}

function asksStudioTourGuestBoundary(question: string) {
  const asksTour = /\b(?:studio tour|tour the studio|tour before|friends? tour|studio walkthrough)\b/i.test(question);
  const asksGuestLimit = /\b(?:how many|number of|guest limit|guests?|friends?)\b.{0,70}\b(?:film|filming|shoot|studio|attend|bring)\w*\b|\b(?:film|filming|shoot|studio)\w*\b.{0,70}\b(?:how many|number of|guest limit|guests?)\b/i.test(question);
  return asksTour && asksGuestLimit &&
    !/\b(?:address|location|venue|mastermind|payment|deposit|pif|delivery|timeline|how quickly|schedule date)\b/i.test(question);
}

function asksRecurringInvoiceBoundary(question: string) {
  return /\b(?:recurring|installment)\b/i.test(question) &&
    /\b(?:invoice|ledger|commission)\w*\b/i.test(question) &&
    /\b(?:rep|client|automated|automatic|send|appear|track|process)\w*\b/i.test(question) &&
    !/\b(?:refund|chargeback|dispute|reverse|cancel|payme|submit another|second entry|tax|receipt)\b/i.test(question);
}

function asksRepeatedDisqualifiedBoundary(question: string) {
  return /\bdisqualif\w*\b/i.test(question) &&
    /\b(?:repeatedly|keeps? applying|reapply|reapplying|applying again|repeat bookings?|another show|cancel an audition|stop (?:repeat )?bookings?)\b/i.test(question);
}

function asksScriptwriterSchedulingEscalation(question: string) {
  const namesScripting = /\b(?:script\s*writer|scriptwriter|script-writing|scripting(?: call)?)\b/i.test(question);
  if (!namesScripting) return false;
  const unavailable = /\b(?:no (?:booking )?times?|cannot (?:book|find)|can't (?:book|find)|unable to (?:book|find)|unavailable|missing (?:booking )?times?)\b/i.test(question);
  const explicitlyWorking = /\b(?:working normally|works normally|no (?:scheduling )?(?:issue|problem)|not unavailable|times? (?:are )?(?:available|visible)|plenty of (?:booking )?times?)\b/i.test(question);
  if (explicitlyWorking && !unavailable) return false;
  const asksOwner = /\b(?:who owns|which (?:team|channel)|where (?:should|do) (?:i|we) (?:ask|post|route|escalate)|where to (?:ask|post|route|escalate))\b/i.test(question);
  const asksSchedulingHelp = /\b(?:what should (?:i|we) do|need help|issue|problem|trouble)\b.{0,100}\b(?:schedule|scheduling|book|booking)\b|\b(?:schedule|scheduling|book|booking)\b.{0,100}\b(?:help|issue|problem|trouble)\b/i.test(question);
  const asksAssignmentOrDelivery = /\b(?:paired|assigned|pairing|still (?:paired|assigned)|who (?:writes|handles)|when|timing|timeline|receive|delivered?|delivery|schedule|scheduling)\b/i.test(question) &&
    /\b(?:cast member|client|film|filming|script|scriptwriter|scripting)\b/i.test(question);
  const artifactOnly = /\b(?:send|share|download|find|locate|get)\b.{0,50}\b(?:script|template|document|file|link)\b/i.test(question) &&
    !/\b(?:when|timing|timeline|receive|deliver|delivery|paired|assigned|schedule|scheduling)\b/i.test(question);
  return !artifactOnly && (unavailable || asksOwner || asksSchedulingHelp || asksAssignmentOrDelivery);
}

function v4BlockedTopicMatchesQuestion(topic: V4BlockedCandidate["topic"], question: string) {
  return v4QuestionCoverageSegments(question).some((segment) => v4BlockedTopicMatchesOriginalQuestion(topic, segment));
}

function v4BlockedTopicIsStrictlyBound(topic: V4BlockedCandidate["topic"], question: string) {
  return v4QuestionCoverageSegments(question).some((segment) => {
    const match = v4BlockedTopicDecisionMatch(topic, segment);
    return match.matches && (match.matchKind === "canonical_family" || match.matchKind === "legacy_anchor");
  });
}

function v4NeedCoversQuestionSegment(need: Omit<V4PlannedNeed, "id">, segment: string) {
  const segmentFacets = v4CoverageFacets(segment);
  const representation = `${need.text} ${need.reason} ${need.clarification_question} ${need.supported_claim}`;
  const representationFacets = v4CoverageFacets(representation);
  if (segmentFacets.size) {
    return [...segmentFacets].every((facet) => representationFacets.has(facet));
  }
  const segmentTerms = v4CoverageTerms(segment);
  const needTerms = v4CoverageTerms(representation);
  const overlap = [...segmentTerms].filter((term) => needTerms.has(term));
  return overlap.length >= Math.min(2, segmentTerms.size);
}

function v4NeedsCollectivelyCoverQuestionSegment(needs: V4PlannedNeed[], segment: string) {
  if (needs.some((need) => v4NeedCoversQuestionSegment(need, segment))) return true;
  const segmentFacets = v4CoverageFacets(segment);
  const representation = needs.map((need) => `${need.text} ${need.reason} ${need.clarification_question} ${need.supported_claim}`).join(" ");
  const representationFacets = v4CoverageFacets(representation);
  if (segmentFacets.size) {
    return [...segmentFacets].every((facet) => representationFacets.has(facet));
  }
  const segmentTerms = v4CoverageTerms(segment);
  const representedTerms = v4CoverageTerms(representation);
  const overlap = [...segmentTerms].filter((term) => representedTerms.has(term));
  return overlap.length >= Math.min(3, segmentTerms.size);
}

function v4NeedSegmentCoverageScore(need: V4PlannedNeed, segment: string) {
  if (!v4NeedCoversQuestionSegment(need, segment)) return 0;
  const segmentFacets = v4CoverageFacets(segment);
  const segmentTerms = v4CoverageTerms(segment);
  const claim = need.lane === "answer" ? need.supported_claim : `${need.text} ${need.reason} ${need.clarification_question}`;
  const claimFacets = v4CoverageFacets(claim);
  const governedRecentDisqualification = need.evidence_refs.some((ref) => ref === "claim_a5945bc4fd156d47" || ref === "claim_4c5932f5c97e68ed") &&
    /\b(?:disqualif\w*|reapply|reapplying|applying again|repeat bookings?|cancel an audition)\b/i.test(segment);
  const requiredFacets = [...segmentFacets].filter((facet) =>
    V4_CLAIM_REQUIRED_COVERAGE_FACETS.has(facet) && !(governedRecentDisqualification && facet === "qualification"),
  );
  const variableAmountBoundary = (segment.match(/\$\s*\d+(?:\.\d+)?\s*k?/gi) || []).length >= 2 &&
    /\b(?:custom|unlisted)\b.{0,80}\b(?:amount|split|payment|plan)\b|\b(?:amount|split|payment|plan)\b.{0,80}\b(?:custom|unlisted)\b/i.test(claim);
  if (need.lane === "answer" && requiredFacets.some((facet) =>
    !claimFacets.has(facet) && !(variableAmountBoundary && ["price", "quantity"].includes(facet)),
  )) return 0;
  const claimTerms = v4CoverageTerms(claim);
  const facetOverlap = [...segmentFacets].filter((facet) => claimFacets.has(facet)).length;
  const termOverlap = [...segmentTerms].filter((term) => claimTerms.has(term)).length;
  const requiredFacetOverlap = requiredFacets.filter((facet) => claimFacets.has(facet)).length;
  return 1 + requiredFacetOverlap * 100 + facetOverlap * 20 + termOverlap;
}

function v4AnswerClaimCoversQuestionSegment(need: V4PlannedNeed, segment: string) {
  if (need.lane !== "answer" || !clean(need.supported_claim)) return false;
  const segmentFacets = v4CoverageFacets(segment);
  const claimFacets = v4CoverageFacets(need.supported_claim);
  const governedRecentDisqualification = need.evidence_refs.some((ref) => ref === "claim_a5945bc4fd156d47" || ref === "claim_4c5932f5c97e68ed") &&
    /\b(?:disqualif\w*|reapply|reapplying|applying again|repeat bookings?|cancel an audition)\b/i.test(segment);
  const requiredFacets = [...segmentFacets].filter((facet) =>
    V4_CLAIM_REQUIRED_COVERAGE_FACETS.has(facet) && !(governedRecentDisqualification && facet === "qualification"),
  );
  const variableAmountBoundary = (segment.match(/\$\s*\d+(?:\.\d+)?\s*k?/gi) || []).length >= 2 &&
    /\b(?:custom|unlisted)\b.{0,80}\b(?:amount|split|payment|plan)\b|\b(?:amount|split|payment|plan)\b.{0,80}\b(?:custom|unlisted)\b/i.test(need.supported_claim);
  if (requiredFacets.some((facet) =>
    !claimFacets.has(facet) && !(variableAmountBoundary && ["price", "quantity"].includes(facet)),
  )) return false;
  if (segmentFacets.has("qualification") && /\bfreelanc\w*\b/i.test(segment) && /\bfreelanc\w*\b/i.test(need.supported_claim)) return true;
  if (variableAmountBoundary) return true;
  const segmentTerms = v4CoverageTerms(segment);
  const claimTerms = v4CoverageTerms(need.supported_claim);
  const termOverlap = [...segmentTerms].filter((term) => claimTerms.has(term)).length;
  if (requiredFacets.length) return termOverlap >= 1 || requiredFacets.length >= 2;
  return termOverlap >= Math.min(2, segmentTerms.size);
}

function v4OverallPlanLane(needs: V4PlannedNeed[]): V4Lane {
  const answered = needs.filter((need) => need.lane === "answer").length;
  const unresolved = needs.length - answered;
  return answered && unresolved
    ? "partial"
    : answered
      ? "answer"
      : needs.some((need) => need.lane === "clarify")
        ? "clarify"
        : needs.some((need) => need.lane === "live_lookup")
          ? "live_lookup"
          : needs.some((need) => need.lane === "artifact")
            ? "artifact"
            : "route";
}

function enforceV4QuestionCompleteness(
  plan: V4AnswerPlan,
  turn: V3TurnResolution,
  retrieval: V4RetrievalResult,
  planningMode: "model" | "deterministic_governed" | "deterministic_fallback",
) {
  // Governed shortcuts still pass through the same atomic completeness and
  // blocker checks as model plans. A deterministic answer may be exact for
  // one clause without being allowed to hide an appended independent request.
  const blocked = retrieval.blocked;
  const additions: Array<Omit<V4PlannedNeed, "id">> = [];
  const decisionQuestion = v4DecisionQuestion(turn);
  const policiesForNeed = (need: V4PlannedNeed) => need.evidence_refs
    .map((id) => retrieval.candidates.find((candidate) => candidate.policy.id === id)?.policy)
    .filter((policy): policy is V3Policy => Boolean(policy));
  const directAnswerControlsQuestion = plan.needs.some((need) =>
    need.lane === "answer" &&
    v4PoliciesDirectlyAddressNeed(policiesForNeed(need), decisionQuestion) &&
    policiesForNeed(need).every((policy) => v4PolicySupportErrors(policy, turn, need.text).length === 0),
  );
  if (directAnswerControlsQuestion) {
    const retained = plan.needs.filter((need) => {
      if (need.lane === "answer") return true;
      const blockerId = need.reason.match(/governance topic\s+([^\s]+)\s+is explicitly unresolved/i)?.[1];
      return !blockerId || !blocked.some((candidate) =>
        candidate.topic.id === blockerId &&
        v4BlockedTopicMatchesQuestion(candidate.topic, decisionQuestion) &&
        !v4BlockedTopicIsStrictlyBound(candidate.topic, decisionQuestion),
      );
    });
    if (retained.length !== plan.needs.length) {
      const needs = retained.map((need, index) => ({ ...need, id: `N${index + 1}` }));
      plan = { ...plan, needs, overall_lane: v4OverallPlanLane(needs) };
    }
  }
  const segments = v4RequestedCoverageSegments(decisionQuestion);
  const answerPolicyIds = new Set(plan.needs.filter((need) => need.lane === "answer").flatMap((need) => need.evidence_refs));
  const exactGovernedQuestionIsFullyBounded = planningMode === "deterministic_governed" &&
    plan.needs.length > 0 &&
    plan.needs.every((need) => need.lane === "answer") && (
      (asksZoomPhonePaymentLinkBoundary(decisionQuestion) && answerPolicyIds.has("owner-zoom-phone-payment-link-email-only")) ||
      (asksFathomZoomRecordingBoundary(decisionQuestion) && answerPolicyIds.has("owner-fathom-zoom-recording-prohibited")) ||
      (asksMainCrossShowReapplyBoundary(decisionQuestion) && answerPolicyIds.has("owner-main-istv-cross-show-reapply-wait")) ||
      (asksMissingShowNameRecovery(decisionQuestion) && answerPolicyIds.has("owner-keap-missing-show-name-recovery")) ||
      (asksExistingClientCrossShowBoundary(decisionQuestion) && answerPolicyIds.has("claim_606e9d59e3cd964f")) ||
      (asksStudioTourGuestBoundary(decisionQuestion) && answerPolicyIds.has("claim_4d14d445a904a4af"))
    );
  const wholeQuestionIsAlreadyBounded = exactGovernedQuestionIsFullyBounded || plan.needs.some((need) => {
    if (need.lane === "answer") return false;
    if (clean(need.text).toLowerCase() === clean(decisionQuestion).toLowerCase()) return true;
    const representation = `${need.text} ${need.reason}`;
    if (asksStopReinstatement(decisionQuestion)) {
      return need.route_key === "sales_tech" && /\b(?:stop|resubscrib|tech confirmation|outreach|booking)\b/i.test(representation);
    }
    if (asksClientMessageReview(decisionQuestion)) {
      return need.route_key === "sales_policy" && /\bclient-message fact check and rewrite\b/i.test(representation);
    }
    return false;
  });

  const governedFutureLaunchQuestionIsBounded = planningMode === "deterministic_governed" &&
    segments.length === 1 &&
    asksSpecificFutureLaunchGreenlight(decisionQuestion) &&
    plan.needs.some((need) => need.lane === "answer" && need.evidence_refs.includes("claim_aa93466af64a3cdd")) &&
    plan.needs.some((need) => need.lane === "clarify" && /\b(?:final greenlight|complete current qualification facts|owner review)\b/i.test(`${need.text} ${need.reason}`));
  const singleQuestionIsAlreadyBounded = segments.length === 1 && (directAnswerControlsQuestion || governedFutureLaunchQuestionIsBounded);
  if (!wholeQuestionIsAlreadyBounded && !singleQuestionIsAlreadyBounded) {
    if (segments.length > 1) {
      // Explicit compound questions require distinct atomic needs. A planner
      // cannot make one narrow answer need stand in for two requested actions.
      const needToSegment = new Map<number, number>();
      const matchSegment = (segmentIndex: number, visited: Set<number>): boolean => {
        const rankedNeeds = plan.needs
          .map((need, needIndex) => ({ needIndex, score: v4NeedSegmentCoverageScore(need, segments[segmentIndex]) }))
          .filter((candidate) => candidate.score > 0)
          .sort((left, right) => right.score - left.score || left.needIndex - right.needIndex);
        for (const { needIndex } of rankedNeeds) {
          if (visited.has(needIndex)) continue;
          visited.add(needIndex);
          const previousSegment = needToSegment.get(needIndex);
          if (previousSegment === undefined || matchSegment(previousSegment, visited)) {
            needToSegment.set(needIndex, segmentIndex);
            return true;
          }
        }
        return false;
      };
      const segmentOrder = segments.map((segment, index) => ({
        segment,
        index,
        bestScore: Math.max(0, ...plan.needs.map((need) => v4NeedSegmentCoverageScore(need, segment))),
      })).sort((left, right) => right.bestScore - left.bestScore || left.index - right.index);
      segmentOrder.forEach(({ segment, index }) => {
        if (plan.needs.some((need) => v4AnswerClaimCoversQuestionSegment(need, segment))) return;
        if (matchSegment(index, new Set())) return;
        additions.push({
          text: segment,
          lane: "route",
          evidence_refs: [],
          supported_claim: "",
          reason: "The model plan did not account for this independently requested part of the original question.",
          route_key: null,
          clarification_question: "",
        });
      });
    } else {
      for (const segment of segments) {
        if (v4NeedsCollectivelyCoverQuestionSegment(plan.needs, segment)) continue;
        additions.push({
          text: segment,
          lane: "route",
          evidence_refs: [],
          supported_claim: "",
          reason: "The answer plan did not account for this requested part of the original question.",
          route_key: null,
          clarification_question: "",
        });
      }
    }
  }

  const answerPolicies = plan.needs
    .filter((need) => need.lane === "answer")
    .flatMap((need) => need.evidence_refs)
    .map((id) => retrieval.candidates.find((candidate) => candidate.policy.id === id)?.policy)
    .filter((policy): policy is V3Policy => Boolean(policy));
  const boundedNeedMatches = (pattern: RegExp) => [...plan.needs, ...additions].some((need) =>
    need.lane !== "answer" && pattern.test(`${need.text} ${need.reason}`),
  );
  const addBoundedNeed = (input: Omit<V4PlannedNeed, "id">, pattern: RegExp) => {
    if (!boundedNeedMatches(pattern)) additions.push(input);
  };

  if (asksShowListLocation(decisionQuestion)) {
    addBoundedNeed({
      text: "Where the maintained active-show source is located",
      lane: "route",
      evidence_refs: [],
      supported_claim: "",
      reason: "The approved catalog provides the current list but does not identify a rep-facing maintained link or location.",
      route_key: "sales_policy",
      clarification_question: "",
    }, /\b(?:where|source|location|link|find|check)\b/i);
  }

  const hasPaidAllThreeDecision = answerPolicies.some((policy) =>
    /\b(?:pay|paid|extra|upgrade)\b.{0,100}\ball\s+(?:3|three)\b|\ball\s+(?:3|three)\b.{0,100}\b(?:pay|paid|extra|upgrade)\b/i.test(policy.decision),
  );
  if (asksPaidAllThreePlatforms(decisionQuestion) && !hasPaidAllThreeDecision) {
    addBoundedNeed({
      text: "Whether a client may pay extra for submission to all three Tier-1 platforms",
      lane: "route",
      evidence_refs: [],
      supported_claim: "",
      reason: "Current evidence covers one included platform and paid Apple TV guarantees, but not a paid all-three option.",
      route_key: "sales_policy",
      clarification_question: "",
    }, /\b(?:pay|paid|extra|upgrade)\b.{0,100}\ball\s+(?:3|three)\b|\ball\s+(?:3|three)\b.{0,100}\b(?:pay|paid|extra|upgrade)\b/i);
  }

  const hasExactSeasonCount = answerPolicies.some((policy) => /\b\d+\s+(?:total\s+)?seasons?\b/i.test(policy.decision));
  if (asksExactSeasonCount(decisionQuestion) && !hasExactSeasonCount) {
    addBoundedNeed({
      text: "The exact number of seasons",
      lane: "route",
      evidence_refs: [],
      supported_claim: "",
      reason: "Current evidence confirms multiple seasons but does not provide a fixed total season count.",
      route_key: "sales_policy",
      clarification_question: "",
    }, /\b(?:exact|number|how many|total)\b.{0,50}\bseasons?\b/i);
  }

  const usesCatalogWatchabilityBoundary = answerPolicies.some((policy) => policy.id === "owner-current-show-list-watchability-boundary");
  if (usesCatalogWatchabilityBoundary && asksSpecificShowWatchability(decisionQuestion)) {
    addBoundedNeed({
      text: "The exact show's current public episode availability",
      lane: "live_lookup",
      evidence_refs: [],
      supported_claim: "",
      reason: "Catalog membership cannot establish current public watchability.",
      route_key: "sales_policy",
      clarification_question: "",
    }, /\b(?:exact|current|currently|watch|watchable|air|aired|availability)\b/i);
  }

  for (const candidate of blocked) {
    if (!v4BlockedTopicMatchesQuestion(candidate.topic, decisionQuestion)) continue;
    if (planningMode === "deterministic_governed" && candidate.matchKind === "structured") continue;
    const governedClarifiesFinalQualification = planningMode === "deterministic_governed" &&
      candidate.topic.id === "blocked_65d2e70d14703b7e" &&
      asksSpecificFutureLaunchGreenlight(decisionQuestion) &&
      plan.needs.some((need) => need.lane === "clarify" && /\b(?:final greenlight|complete current qualification facts|owner review)\b/i.test(`${need.text} ${need.reason}`));
    if (governedClarifiesFinalQualification) continue;
    const matchingBlockedSegments = segments.filter((segment) => v4BlockedTopicMatchesOriginalQuestion(candidate.topic, segment));
    const directAnswerControlsBlocker = plan.needs.some((need) =>
      need.lane === "answer" &&
      v4PoliciesDirectlyAddressNeed(policiesForNeed(need), decisionQuestion) &&
      policiesForNeed(need).every((policy) => v4PolicySupportErrors(policy, turn, need.text).length === 0),
    );
    if (directAnswerControlsBlocker && !v4BlockedTopicIsStrictlyBound(candidate.topic, decisionQuestion)) continue;
    const nonAnswerNeeds = [...plan.needs, ...additions].filter((need) => need.lane !== "answer");
    const alreadyBounded = nonAnswerNeeds.some((need) => v4BlockedTopicMatchesQuestion(candidate.topic, need.text)) ||
      (matchingBlockedSegments.length > 0 && matchingBlockedSegments.every((segment) =>
        nonAnswerNeeds.some((need) => v4NeedCoversQuestionSegment(need, segment)),
      ));
    if (alreadyBounded) continue;
    additions.push({
      text: decisionQuestion,
      lane: "route",
      evidence_refs: [],
      supported_claim: "",
      reason: `The matching governance topic ${candidate.topic.id} is explicitly unresolved.`,
      route_key: null,
      clarification_question: "",
    });
  }

  if (!additions.length) return plan;
  const needs = [...plan.needs, ...additions].map((need, index) => ({ ...need, id: `N${index + 1}` }));
  const overallLane = v4OverallPlanLane(needs);
  return {
    ...plan,
    needs,
    overall_lane: overallLane,
    confidence_score: Math.min(plan.confidence_score, overallLane === "partial" ? 79 : 49),
    reasoning_summary: `${plan.reasoning_summary} Deterministic completeness checks preserved ${additions.length} omitted or blocked need${additions.length === 1 ? "" : "s"} as unresolved.`.trim(),
  };
}

function parsePlan(content: string, candidates: V4Candidate[], blocked: V4BlockedCandidate[], turn: V3TurnResolution): V4AnswerPlan {
  const raw = parseV3Json<Record<string, unknown>>(content);
  const rawNeeds = Array.isArray(raw.needs) ? raw.needs : [];
  const parsedNeeds = rawNeeds.slice(0, 8).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const entry = item as Record<string, unknown>;
    const text = clean(entry.text || entry.need, 300);
    if (!text) return [];
    const matchedBlockedTopic = blocked.find((candidate) => v4BlockedTopicMatchesNeed(candidate.topic, text));
    const rawProposedLane = ["answer", "clarify", "live_lookup", "artifact", "route"].includes(String(entry.lane))
      ? String(entry.lane) as V4PlannedNeed["lane"]
      : "route";
    const clarificationText = displayText(entry.clarification_question, 400);
    const userCanSupplyMissingDiscriminator = /\b(?:which|what)\s+(?:product|show|package|program|person|actor|rep|client|prospect|applicant|case|scenario)\b|\b(?:main\s+istv|inside success tv|daymond john|next level ceo|nlceo)\b.{0,60}\b(?:which|mean|apply)\b|\b(?:revenue|profit|business age|how long in business|website|funds to invest|criminal history|specific charge|role|relationship)\b/i.test(`${text} ${clarificationText}`);
    const proposedLane = rawProposedLane === "clarify" && !userCanSupplyMissingDiscriminator ? "route" : rawProposedLane;
    const evidenceRefs = stringArray(entry.evidence_refs, 8)
      .map((ref) => resolveCandidateRef(ref, candidates))
      .filter((ref): ref is string => Boolean(ref));
    const referencedPolicies = evidenceRefs
      .map((id) => candidates.find((candidate) => candidate.policy.id === id)?.policy)
      .filter((policy): policy is V3Policy => Boolean(policy));
    const productScopeErrors = proposedLane === "answer" ? productScopeErrorsForNeed(text, referencedPolicies, turn) : [];
    const canAnswer = evidenceRefs.length > 0 &&
      referencedPolicies.length === evidenceRefs.length &&
      referencedPolicies.every((policy) => v4PolicyCanSupportNeed(policy, turn, text)) &&
      productScopeErrors.length === 0;
    const strictBlockedTopic = Boolean(
      matchedBlockedTopic && v4BlockedTopicIsStrictlyBound(matchedBlockedTopic.topic, v4DecisionQuestion(turn)),
    );
    const directEvidenceControlsBlocker = Boolean(
      matchedBlockedTopic &&
      !strictBlockedTopic &&
      proposedLane === "answer" &&
      canAnswer &&
      v4PoliciesDirectlyAddressNeed(referencedPolicies, `${v4DecisionQuestion(turn)} ${text}`),
    );
    const controllingBlockedTopic = directEvidenceControlsBlocker ? undefined : matchedBlockedTopic;
    const artifactLookup = asksControlledArtifactLookup(text) && !canAnswer;
    const lane = controllingBlockedTopic
      ? artifactLookup ? "artifact" : "route"
      : proposedLane === "route" && artifactLookup
        ? "artifact"
      : proposedLane === "answer" && !canAnswer
        ? artifactLookup
          ? "artifact"
          : productScopeErrors.length && turn.productScope === "unknown" ? "clarify" : "route"
        : proposedLane;
    const proposedRouteKey = allowedRouteKeys.has(String(entry.route_key)) ? String(entry.route_key) : null;
    const routeKey = proposedRouteKey && referencedPolicies.some((policy) => {
      const override = V4_POLICY_ROUTE_OVERRIDES.get(policy.id);
      if (override === "fulfillment") return proposedRouteKey === override && asksScriptwriterSchedulingEscalation(`${text} ${clean(entry.reason, 600)}`);
      const governedChannel = routeCatalog[proposedRouteKey]?.channel;
      const policyNamesGovernedChannel = Boolean(
        governedChannel && evidenceDecision(policy).toLowerCase().includes(governedChannel.toLowerCase()),
      );
      return v4PolicyDirectlyAddressesNeed(policy, text) && (
        (policy.answerability === "route_or_support" && policy.route_key === proposedRouteKey) ||
        policyNamesGovernedChannel
      );
    }) ? proposedRouteKey : null;
    return [{
      text,
      lane,
      evidence_refs: [...new Set(evidenceRefs)],
      supported_claim: lane === "answer" ? displayText(entry.supported_claim, 1000) : "",
      reason: controllingBlockedTopic
        ? `The matching governance topic ${controllingBlockedTopic.topic.id} is explicitly unresolved.`
        : productScopeErrors.length
          ? productScopeErrors.join("; ")
        : clean(entry.reason, 600) || (lane === "route" ? "No controlling applicable answer evidence was selected." : "Applicable evidence was selected."),
      route_key: routeKey,
      clarification_question: lane === "clarify"
        ? clarificationText || "Which product does this request apply to: main ISTV or Daymond John / Next Level CEO?"
        : "",
    } satisfies Omit<V4PlannedNeed, "id">];
  });
  const needs: V4PlannedNeed[] = parsedNeeds.map((need, index) => ({ ...need, id: `N${index + 1}` }));

  const safeNeeds = needs.length ? needs : [{
    id: "N1",
    text: v4DecisionQuestion(turn),
    lane: "route" as const,
    evidence_refs: [],
    supported_claim: "",
    reason: "The planner did not return a usable atomic need.",
    route_key: null,
    clarification_question: "",
  }];
  return {
    needs: safeNeeds,
    overall_lane: v4OverallPlanLane(safeNeeds),
    confidence_score: clampConfidence(raw.confidence_score),
    reasoning_summary: clean(raw.reasoning_summary || raw.reason, 700),
  };
}

function planningPrompt(turn: V3TurnResolution, candidates: V4Candidate[], blocked: Array<{ topic: { id: string; resolution?: string | null; question_families?: string[] } }>) {
  return {
    system: [
      "You are the evidence planner for an internal sales FAQ. Return JSON only.",
      "Decompose the user's request into atomic decision needs. For each need choose exactly one lane: answer, clarify, live_lookup, artifact, or route.",
      "Use answer only when one or more supplied cards directly entail the exact need under the same product, actor, timing, relationship, conditions, and requested action.",
      "Cards marked v4_support_mode=route_only can support a route or resource instruction but cannot authorize a substantive answer. A card marked direct_governed_instruction may answer only the exact status, boundary, or action written in that card.",
      "A governed named internal destination or verification action is itself a complete answer when the user asks where or how to verify. Preserve that exact destination instead of replacing it with a generic route.",
      "Do not infer public watchability from membership in a show catalog. Do not turn 'one of three platforms' into 'all three'. Do not treat a listed installment choice as a custom payment-plan exception.",
      "Do not use model confidence as authority. Prefer current canonical or trusted evidence, but do not combine conflicting cards into a new rule.",
      "Account for every independently requested decision or action in current_question. Never replace the original compound request with a narrower need from resolved_question. Keep any uncovered or unresolved clause as its own non-answer need.",
      "Treat purpose, rationale, or tool-detail phrases inside one yes/no permission question as conditions of that single decision, not as separate needs, unless the user independently asks for another action or outcome.",
      "An unresolved governance topic controls only the same decision, action, and specific subject or object. Do not route an exact governed answer merely because an unrelated blocker shares broad words such as call, calendar, recording, studio, payment, or channel.",
      "If a supplied unresolved governance topic exactly matches one requested clause, include that clause as a route need even when a different clause can be answered.",
      "When some needs are answerable and others are not, answer the supported needs and route only the unresolved needs.",
      "For answer lanes, supported_claim must be a concise, exact paraphrase of the selected decision text with no new numbers, guarantees, exceptions, or operational steps.",
      "Use only candidate refs C1..Cn. Return {needs:[{id,text,lane,evidence_refs,supported_claim,reason,route_key,clarification_question}],confidence_score,reasoning_summary}.",
    ].join("\n"),
    user: JSON.stringify({
      original_question: turn.currentQuestion,
      current_question: v4DecisionQuestion(turn),
      resolved_question: turn.standaloneQuestion,
      resolved_product_scope: turn.productScope,
      excluded_product_scopes: turn.excludedScopes,
      candidates: candidateCards(candidates, v4SupportModeRequest(turn)),
      route_catalog: Object.fromEntries(Object.entries(routeCatalog).map(([key, value]) => [key, value.channel])),
      unresolved_governance_topics: blocked.map((item) => ({ id: item.topic.id, resolution: item.topic.resolution, question_families: item.topic.question_families })),
    }),
  };
}

type SafeFallbackFamily = Parameters<typeof resolveV4PriorityPolicyFamily>[1];

const SAFE_FALLBACK_POLICY_FAMILIES = {
  mainPrices: "main_prices",
  mainPayments: "main_payments",
  sameDayDiscount: "same_day_discount",
  djOffers: "dj_offers",
  tierOneBoundary: "tier_one_boundary",
  appDevices: "app_devices",
  showList: "show_list",
  watchabilityBoundary: "watchability",
  episodeViewingPath: "episode_viewing_path",
  roiBoundary: "roi_boundary",
  languageBoundary: "language_boundary",
  seasonCapacity: "season_capacity",
  callOneFlow: "call_1_flow",
  postSaleHandoff: "post_sale_handoff",
  contractBeforeCallTwo: "contract_before_call_2",
  stopReinstatement: "stop_reinstatement",
  existingClientCrossShow: "existing_client_cross_show",
  reuseLicensePurpose: "reuse_license_purpose",
  zoomPhonePaymentLink: "zoom_phone_payment_link",
  fathomZoomRecording: "fathom_zoom_recording",
  mainCrossShowReapply: "main_cross_show_reapply",
  keapMissingShowRecovery: "keap_missing_show_recovery",
  studioTourGuestLimit: "studio_tour_guest_limit",
  unlistedPaymentSplit: "unlisted_payment_split",
  freelancerQualification: "freelancer_qualification",
  publicCalendarFallback: "public_calendar_fallback",
  previouslyClaimedTwentyPercentLead: "previously_claimed_twenty_percent_lead",
  sixMonthTraining: "six_month_training",
  internalStatsSharing: "internal_stats_sharing",
  futureLaunchQualification: "future_launch_qualification",
  vipRepeatEpisode: "vip_repeat_episode",
  scriptwriterProcess: "scriptwriter_process",
  eventAccessHandoff: "event_access_handoff",
  twentyPercentRecording: "twenty_percent_recording",
  twentyPercentTemplatesTiming: "twenty_percent_templates_timing",
  nlceoCohortBoundary: "nlceo_cohort_boundary",
  podcastPurposeFormat: "podcast_purpose_format",
  nlceoSocialAssetsBoundary: "nlceo_social_assets_boundary",
  partnerPayment: "partner_payment",
  recurringInvoice: "recurring_invoice",
  repeatDisqualified: "repeat_disqualified",
} as const;
const safeFallbackFamilies = [...new Set<SafeFallbackFamily>(Object.values(SAFE_FALLBACK_POLICY_FAMILIES))];

function isDeterministicWhitelistPlan(plan: V4AnswerPlan, retrieval: V4RetrievalResult, turn: V3TurnResolution) {
  const answerNeeds = plan.needs.filter((need) => need.lane === "answer");
  const safePolicyIds = new Set(safeFallbackFamilies.flatMap((family) =>
    resolveV4PriorityPolicyFamily(retrieval.candidates.map((candidate) => candidate.policy), family)
      .map((policy) => policy.id),
  ));
  return answerNeeds.length > 0 && answerNeeds.every((need) =>
    need.evidence_refs.length > 0 && need.evidence_refs.every((policyId) => {
      const policy = retrieval.candidates.find((candidate) => candidate.policy.id === policyId)?.policy;
      return Boolean(policy && safePolicyIds.has(policyId) && v4PolicyCanSupportNeed(policy, turn, need.text));
    }),
  );
}

function fallbackPlanForLane(
  turn: V3TurnResolution,
  lane: Exclude<V4PlannedNeed["lane"], "answer">,
  reason: string,
  routeKey: string | null = null,
  clarificationQuestion = "",
): V4AnswerPlan {
  return {
    needs: [{
      id: "N1",
      text: v4DecisionQuestion(turn),
      lane,
      evidence_refs: [],
      supported_claim: "",
      reason,
      route_key: routeKey,
      clarification_question: lane === "clarify" ? clarificationQuestion : "",
    }],
    overall_lane: lane,
    confidence_score: lane === "clarify" ? 95 : 0,
    reasoning_summary: reason,
  };
}

function fallbackPolicies(retrieval: V4RetrievalResult, turn: V3TurnResolution, families: SafeFallbackFamily[], supportNeedText = v4DecisionQuestion(turn)) {
  const policies = retrieval.candidates.map((candidate) => candidate.policy);
  const selections = families.map((family) =>
    resolveV4PriorityPolicyFamily(policies, family)
      .filter((policy) => v4PolicyCanSupportNeed(policy, turn, supportNeedText))
      .flatMap((policy) => {
        const candidate = retrieval.candidates.find((item) => item.policy.id === policy.id);
        return candidate ? [candidate] : [];
      }),
  );
  if (selections.some((selection) => !selection.length)) return null;
  return [...new Map(selections.flat().map((candidate) => [candidate.policy.id, candidate])).values()];
}

type ExactFallbackUnresolved = {
  lane: Exclude<V4PlannedNeed["lane"], "answer">;
  text: string;
  reason: string;
  routeKey?: string;
  clarificationQuestion?: string;
};

function exactFallbackAnswerPlan(
  turn: V3TurnResolution,
  retrieval: V4RetrievalResult,
  families: SafeFallbackFamily[],
  reason: string,
  unresolved?: ExactFallbackUnresolved | ExactFallbackUnresolved[],
  answerNeedText = v4DecisionQuestion(turn),
  boundedSupportedClaim?: string,
): V4AnswerPlan {
  const selected = fallbackPolicies(retrieval, turn, families, answerNeedText);
  if (!selected) {
    return fallbackPlanForLane(turn, "route", "The safe fallback could not find every required controlling policy card.");
  }
  const normalizedBoundedClaim = displayText(boundedSupportedClaim, 1000);
  if (normalizedBoundedClaim && (
    selected.length !== 1 ||
    !evidenceDecision(selected[0].policy).includes(normalizedBoundedClaim)
  )) {
    return fallbackPlanForLane(turn, "route", "The bounded governed claim was not present verbatim in the selected controlling policy card.");
  }
  const answerNeed: V4PlannedNeed = {
    id: "N1",
    text: answerNeedText,
    lane: "answer",
    evidence_refs: selected.map((candidate) => candidate.policy.id),
    supported_claim: normalizedBoundedClaim || selected.map((candidate) => evidenceDecision(candidate.policy)).join(" "),
    reason,
    route_key: null,
    clarification_question: "",
  };
  if (!unresolved) {
    return { needs: [answerNeed], overall_lane: "answer", confidence_score: 90, reasoning_summary: reason };
  }
  const unresolvedNeeds = (Array.isArray(unresolved) ? unresolved : [unresolved]).map((need, index): V4PlannedNeed => ({
    id: `N${index + 2}`,
    text: need.text,
    lane: need.lane,
    evidence_refs: [],
    supported_claim: "",
    reason: need.reason,
    route_key: need.routeKey || null,
    clarification_question: need.lane === "clarify" ? need.clarificationQuestion || "" : "",
  }));
  return {
    needs: [answerNeed, ...unresolvedNeeds],
    overall_lane: "partial",
    confidence_score: 79,
    reasoning_summary: `${reason} The separable unresolved part remains bounded.`,
  };
}

function exactFallbackAtomicAnswerPlan(
  turn: V3TurnResolution,
  retrieval: V4RetrievalResult,
  families: SafeFallbackFamily[],
  answerNeedTexts: string[],
  reason: string,
  boundedSupportedClaim?: string,
): V4AnswerPlan {
  const selections = answerNeedTexts.map((needText) => fallbackPolicies(retrieval, turn, families, needText));
  if (selections.some((selection) => !selection)) {
    return fallbackPlanForLane(turn, "route", "The safe fallback could not find every required controlling policy card.");
  }
  const normalizedBoundedClaim = displayText(boundedSupportedClaim, 1000);
  if (normalizedBoundedClaim && selections.some((selection) =>
    selection!.length !== 1 || !evidenceDecision(selection![0].policy).includes(normalizedBoundedClaim)
  )) {
    return fallbackPlanForLane(turn, "route", "The bounded governed claim was not present verbatim in every selected controlling policy card.");
  }
  const needs = selections.map((selection, index): V4PlannedNeed => ({
    id: `N${index + 1}`,
    text: answerNeedTexts[index],
    lane: "answer",
    evidence_refs: selection!.map((candidate) => candidate.policy.id),
    supported_claim: normalizedBoundedClaim || selection!.map((candidate) => evidenceDecision(candidate.policy)).join(" "),
    reason,
    route_key: null,
    clarification_question: "",
  }));
  return { needs, overall_lane: "answer", confidence_score: 90, reasoning_summary: reason };
}

function exactGovernedPlan(turn: V3TurnResolution, retrieval: V4RetrievalResult): V4AnswerPlan | null {
  const question = v4DecisionQuestion(turn);
  const segments = v4QuestionCoverageSegments(question);
  const singleClause = segments.length === 1;
  const asksStandardPromoViews = /\$\s*20(?:,?000|k)\b/i.test(question) &&
    /\b(?:pre[- ]?promo|pre[- ]?promotional|promotional)\s+views?\b/i.test(question);
  if (asksStandardPromoViews) {
    const asksChannelRestriction = /\b(?:facebook|instagram|linkedin|youtube|social (?:network|platform)|platform only)\b/i.test(question);
    return exactFallbackAnswerPlan(
      turn,
      retrieval,
      [SAFE_FALLBACK_POLICY_FAMILIES.mainPrices],
      "The $20,000 Standard-package fingerprint uniquely identifies the governed main ISTV package and its included pre-promo views.",
      asksChannelRestriction
        ? {
          lane: "route",
          text: "Determine whether the included promotional views are restricted to the named social platform",
          reason: "The package card governs the view count but does not establish a Facebook-only or other channel-specific distribution promise.",
          routeKey: "sales_policy",
        }
        : undefined,
      "Whether the $20,000 main ISTV Standard package includes promotional views and the governed amount",
      V4_MAIN_STANDARD_PROMO_VIEWS_CLAIM,
    );
  }
  if (asksReuseLicensePurposeBoundary(question)) {
    const asksDeclinedRights = /\bdeclin\w*\b/i.test(question) &&
      /\b(?:greenlit|greenlight|use|reuse|rights?|segment|content)\b/i.test(question);
    return exactFallbackAnswerPlan(
      turn,
      retrieval,
      [SAFE_FALLBACK_POLICY_FAMILIES.reuseLicensePurpose],
      "The governed reuse-license purpose and approved reuse boundary directly answer the explainable portion of this request.",
      asksDeclinedRights
        ? {
          lane: "route",
          text: "Decide the exact company and cast-member usage rights when the reuse license is declined but the person was greenlit",
          reason: "Greenlight status alone does not establish the product-specific rights created when the reuse license is declined; current contracts or legal-approved wording are required.",
          routeKey: "sales_policy",
        }
        : undefined,
      "Why the company reuse license exists and the governed reuse scope it covers",
    );
  }
  if (asksLiveEpisodeViewingPath(question)) {
    return exactFallbackAnswerPlan(
      turn,
      retrieval,
      [SAFE_FALLBACK_POLICY_FAMILIES.episodeViewingPath],
      "The governed public viewing path is answerable, while a currently live episode matching the requested guest category requires a current lookup.",
      {
        lane: "live_lookup",
        text: "Find a currently live episode matching the requested guest category",
        reason: "The governed source explains where live episodes can be viewed but does not identify a currently live episode for this guest category.",
        routeKey: "sales_policy",
      },
      "Where an available live episode can be viewed without inventing a specific current example",
      "live episodes can be viewed on the website/app platforms.",
    );
  }
  if (asksZoomPhonePaymentLinkBoundary(question)) {
    return exactFallbackAnswerPlan(
      turn,
      retrieval,
      [SAFE_FALLBACK_POLICY_FAMILIES.zoomPhonePaymentLink],
      "The owner-approved payment-link delivery channel directly controls this request.",
      undefined,
      "Whether the approved payment link may be sent through Zoom Phone or must be sent by email",
    );
  }
  if (asksFathomZoomRecordingBoundary(question)) {
    return exactFallbackAnswerPlan(
      turn,
      retrieval,
      [SAFE_FALLBACK_POLICY_FAMILIES.fathomZoomRecording],
      "The owner-approved Fathom-and-Zoom recording rule directly controls the combined setup and its listed Fathom features.",
      undefined,
      "Whether Fathom may be used for recording or transcription features together with the required Zoom recording",
    );
  }
  if (asksMainCrossShowReapplyBoundary(question)) {
    return exactFallbackAnswerPlan(
      turn,
      retrieval,
      [SAFE_FALLBACK_POLICY_FAMILIES.mainCrossShowReapply],
      "The owner-approved main-ISTV cross-show waiting rule directly controls both alternatives in this request.",
      undefined,
      "Whether changing to another main ISTV show removes the waiting period after canceling Call 2 for inability to invest",
    );
  }
  if (asksMissingShowNameRecovery(question)) {
    return exactFallbackAnswerPlan(
      turn,
      retrieval,
      [SAFE_FALLBACK_POLICY_FAMILIES.keapMissingShowRecovery],
      "The owner-approved missing-show-name recovery procedure directly applies.",
    );
  }
  if (asksExistingClientCrossShowBoundary(question)) {
    return exactFallbackAtomicAnswerPlan(
      turn,
      retrieval,
      [SAFE_FALLBACK_POLICY_FAMILIES.existingClientCrossShow],
      [
        "Whether an existing ISTV client may proceed with a new-show application rather than automatically skipping the call",
        "How the rep assignment should be checked for the existing client's new-show interest",
      ],
      "The governed existing-client cross-show decision directly answers both the application and assignment parts.",
    );
  }
  if (asksStudioTourGuestBoundary(question)) {
    return exactFallbackAtomicAnswerPlan(
      turn,
      retrieval,
      [SAFE_FALLBACK_POLICY_FAMILIES.studioTourGuestLimit],
      [
        "Whether prospects or friends may receive an in-person studio tour before signing or filming",
        "The current approved number of guests a client may bring to filming",
      ],
      "The governed studio-tour and filming-guest policy directly answers both requested parts.",
    );
  }
  const asksTierOneSelection = /\b(?:cast member|client|prospect)\b/i.test(question) &&
    /\b(?:choose|choice|select|decide|control|pick)\w*\b.{0,90}\b(?:tier[ -]?1|streaming platform|platform)\b|\b(?:tier[ -]?1|streaming platform|platform)\b.{0,90}\b(?:choose|choice|select|decide|control|pick)\w*\b/i.test(question);
  if (asksTierOneSelection) {
    return exactFallbackAnswerPlan(
      turn,
      retrieval,
      [SAFE_FALLBACK_POLICY_FAMILIES.tierOneBoundary],
      "The approved one-platform and no-placement-guarantee boundary is safe to explain, while client selection authority is not established.",
      {
        lane: "route",
        text: "Confirm whether the cast member controls which eligible Tier-1 platform receives the submission",
        reason: "The current boundary names eligible destinations but does not grant the cast member a platform-selection right.",
        routeKey: "sales_policy",
      },
      "State the included one-platform submission and no-placement-guarantee boundary",
    );
  }
  if (singleClause && asksExactUnlistedPaymentSplit(question) && everyExactGovernedClauseMatches(question, isUnlistedPaymentClause)) {
    return exactFallbackAnswerPlan(
      turn,
      retrieval,
      [SAFE_FALLBACK_POLICY_FAMILIES.unlistedPaymentSplit],
      "The owner-approved unlisted-split boundary controls the proposed amounts, timing, and matching contract.",
    );
  }
  if (asksFreelancerQualification(question) && (
    (singleClause && everyExactGovernedClauseMatches(question, isFreelancerQualificationClause)) ||
    isExactFreelancerQualificationPair(segments)
  )) {
    return exactFallbackAnswerPlan(
      turn,
      retrieval,
      [SAFE_FALLBACK_POLICY_FAMILIES.freelancerQualification],
      "The exact governed freelancer-qualification boundary directly applies.",
    );
  }
  if (singleClause && asksPublicCalendarFallback(question) && everyExactGovernedClauseMatches(question, isPublicCalendarClause)) {
    return exactFallbackAnswerPlan(
      turn,
      retrieval,
      [SAFE_FALLBACK_POLICY_FAMILIES.publicCalendarFallback],
      "The governed public-calendar fallback and master-calendar boundary directly apply.",
    );
  }
  if (asksPreviouslyClaimedTwentyPercentLead(question) && (
    (singleClause && everyExactGovernedClauseMatches(question, isPreviouslyClaimedLeadClause)) ||
    isExactPreviouslyClaimedLeadPair(segments)
  )) {
    return exactFallbackAnswerPlan(
      turn,
      retrieval,
      [SAFE_FALLBACK_POLICY_FAMILIES.previouslyClaimedTwentyPercentLead],
      "The canonical previously-claimed 20 percent lead procedure directly applies.",
    );
  }
  if (singleClause && asksSixMonthTrainingGuidance(question) && everyExactGovernedClauseMatches(question, isSixMonthTrainingClause)) {
    return exactFallbackAnswerPlan(
      turn,
      retrieval,
      [SAFE_FALLBACK_POLICY_FAMILIES.sixMonthTraining],
      "The owner-reviewed discontinued-status and approved-alternatives instruction directly applies.",
    );
  }
  if (asksTwentyPercentRecordingBoundary(question)) {
    return exactFallbackAnswerPlan(
      turn,
      retrieval,
      [SAFE_FALLBACK_POLICY_FAMILIES.twentyPercentRecording],
      "The owner-approved recording and disclosure rule directly controls 20 percent outbound calls.",
      undefined,
      "The recording and prospect-disclosure requirements for 20 percent outbound calls",
    );
  }
  if (asksNlceoCohortTemplateBoundary(question)) {
    return exactFallbackAnswerPlan(
      turn,
      retrieval,
      [SAFE_FALLBACK_POLICY_FAMILIES.nlceoCohortBoundary],
      "The canonical no-cohort boundary directly controls the NLCEO/DJ statement.",
      {
        lane: "route",
        text: "Decide whether the rep may edit the shared confirmation template wording independently",
        reason: "The no-cohort rule does not authorize an individual rep to change a controlled team template.",
        routeKey: "sales_policy",
      },
      "Whether main ISTV cohort-deadline pressure applies to Next Level CEO or Daymond John",
    );
  }
  if (asksInternalStatsSharingBoundary(question)) {
    const asksApprovedWording = /\b(?:reference|message|wording|say|quote|describe)\w*\b/i.test(question);
    return exactFallbackAnswerPlan(
      turn,
      retrieval,
      [SAFE_FALLBACK_POLICY_FAMILIES.internalStatsSharing],
      "The approved internal-material boundaries directly control external sharing of the statistics deck.",
      asksApprovedWording
        ? {
          lane: "route",
          text: "Get the current approved wording for referencing the statistics in a client message",
          reason: "Current public proof wording must come from the approved proof or source owner rather than the internal deck or memory.",
          routeKey: "sales_policy",
        }
        : undefined,
      "Whether an internal statistics slide or screenshot may be shared externally",
    );
  }
  if (asksPodcastPurposeFormat(question)) {
    return exactFallbackAtomicAnswerPlan(
      turn,
      retrieval,
      [SAFE_FALLBACK_POLICY_FAMILIES.podcastPurposeFormat],
      [
        "Whether podcast questions are designed for lead generation and the approved promise boundary",
        "The current podcast episode structure, recording format, and interviewer format",
        "How the podcast is intelligently designed to build exposure, authority, credibility, story, trust, and education",
      ],
      "The owner-approved podcast purpose, promise boundary, and current format directly answer this request.",
      "The podcast is designed around exposure, authority, credibility, background story, trust, and education; do not promise it will generate leads. It is recorded live in the studio and is no longer necessarily interviewed by Rudy.",
    );
  }
  if (asksNlceoSocialAssetsBoundary(question)) {
    return exactFallbackAnswerPlan(
      turn,
      retrieval,
      [SAFE_FALLBACK_POLICY_FAMILIES.nlceoSocialAssetsBoundary],
      "The governed social-package promise boundary is answerable, while the exact current asset list must come from the current listed deliverables.",
      {
        lane: "route",
        text: "List the exact current social promotional assets included in the selected Next Level CEO package",
        reason: "The governed boundary says some assets may be included but does not enumerate the current package-specific list.",
        routeKey: "sales_policy",
      },
      "What the rep must avoid promising about social-media services",
    );
  }
  if (asksSpecificFutureLaunchGreenlight(question)) {
    return exactFallbackAnswerPlan(
      turn,
      retrieval,
      [SAFE_FALLBACK_POLICY_FAMILIES.futureLaunchQualification],
      "The approved early-stage boundary supplies the general evaluation factors without making the individualized final greenlight decision.",
      {
        lane: "clarify",
        text: "Make the final greenlight decision for this future-launch applicant",
        reason: "The final edge-case decision requires the complete current qualification facts and owner review rather than an automatic approval.",
        routeKey: "sales_policy",
        clarificationQuestion: "Please confirm the applicant's complete current qualification facts and have the current sales-policy owner make the final greenlight decision.",
      },
      "Whether a future launch is an automatic disqualification when other fit signals exist",
    );
  }
  if (asksEarlyStageQualificationBoundary(question)) {
    return exactFallbackAtomicAnswerPlan(
      turn,
      retrieval,
      [SAFE_FALLBACK_POLICY_FAMILIES.futureLaunchQualification],
      [
        "Whether to conduct Call 1 for an early-stage business that has not launched",
        "Whether to tell the early-stage lead they are automatically not a fit, and which fit factors to examine",
      ],
      "The approved early-stage applicant boundary directly answers whether Call 1 should proceed and which factors to assess.",
    );
  }
  const asksLiteRepeatBoundary = asksLiteRepeatEpisodeDiscountBoundary(question);
  if (asksVipRepeatEpisodeDiscount(question) || asksLiteRepeatBoundary) {
    const asksMediaOutletList = !asksLiteRepeatBoundary && /\b(?:media outlets?|outlet list|included outlets?|where (?:can|do) (?:i|we) find)\b/i.test(question);
    return exactFallbackAnswerPlan(
      turn,
      retrieval,
      [SAFE_FALLBACK_POLICY_FAMILIES.vipRepeatEpisode],
      asksLiteRepeatBoundary
        ? "The governed Lite-license boundary for the VIP-to-VIP repeat-episode discount directly applies."
        : "The governed VIP-to-VIP repeat-episode eligibility and discount rule directly applies.",
      asksMediaOutletList
        ? {
          lane: "artifact",
          text: "Locate the current approved list of media outlets included with the purchase",
          reason: "The discount decision does not contain or authorize a current controlled media-outlet list.",
          routeKey: "sales_policy",
        }
        : undefined,
      asksLiteRepeatBoundary
        ? "Whether a Lite license qualifies for the repeat-episode 50% discount"
        : "The repeat-purchase eligibility and discount for a VIP ISTV client buying a second VIP ISTV episode",
      asksLiteRepeatBoundary
        ? V4_LITE_REPEAT_EPISODE_BOUNDARY_CLAIM
        : V4_VIP_REPEAT_EPISODE_DISCOUNT_CLAIM,
    );
  }
  if (asksScriptwriterProcess(question)) {
    const exactTiming = asksExactScriptDeliveryTiming(question);
    return exactFallbackAnswerPlan(
      turn,
      retrieval,
      [SAFE_FALLBACK_POLICY_FAMILIES.scriptwriterProcess],
      "The current onboarding and scripting-call policies establish the governed process but not an individualized delivery date.",
      exactTiming
        ? {
          lane: "route",
          text: "Confirm the exact script delivery timing for this filming schedule",
          reason: "Assignment and delivery dates are current fulfillment scheduling decisions and must not be invented.",
          routeKey: "fulfillment",
        }
        : undefined,
      "The governed portion of the current scripting process after onboarding",
    );
  }
  if (asksEventAccessHandoff(question)) {
    const asksCurrentTiming = asksCurrentEventDateOrTiming(question);
    return exactFallbackAnswerPlan(
      turn,
      retrieval,
      [SAFE_FALLBACK_POLICY_FAMILIES.eventAccessHandoff],
      "The current inclusion, onboarding-ownership, and drifting-logistics boundaries directly explain the sales-versus-post-sale handoff.",
      asksCurrentTiming
        ? {
          lane: "route",
          text: "Confirm the current date or schedule for the requested event",
          reason: "Event dates and schedules can change and require the current approved event source or owner.",
          routeKey: "sales_policy",
        }
        : undefined,
      "What sales may explain about event access during Call 2 and which detailed event questions belong to post-sale onboarding",
    );
  }
  if (asksPartnerPaymentBoundary(question)) {
    const unresolved: ExactFallbackUnresolved[] = [];
    if (/\b(?:confirm|verify|match)\w*\b/i.test(question) && /\b(?:not in keap|third[- ]party|payer|partner)\b/i.test(question)) {
      unresolved.push({
        lane: "route",
        text: "Confirm the third-party payment against the correct client",
        reason: "Finance must match and confirm a payer who is not the Keap contact before the sale is treated as paid.",
        routeKey: "finance",
      });
    }
    if (/\b(?:contract|agreement)\b/i.test(question) && /\b(?:does not|doesn't|did not|didn't|not)\s+(?:populate|appear|generate)|missing|not populating\b/i.test(question)) {
      unresolved.push({
        lane: "route",
        text: "Get the correct contract signed when it does not populate automatically",
        reason: "A missing contract requires the current contract-automation or sales-tech action; do not substitute a nearby contract.",
        routeKey: "sales_tech",
      });
    }
    return exactFallbackAnswerPlan(
      turn,
      retrieval,
      [SAFE_FALLBACK_POLICY_FAMILIES.partnerPayment],
      "The trusted partner-payment boundary directly answers who may pay when the payment is tied to the correct client.",
      unresolved.length ? unresolved : undefined,
      "Whether a business owner or partner may pay on behalf of the correct client",
    );
  }
  if (asksRecurringInvoiceBoundary(question)) {
    const answerNeeds = [
      ...(/\binvoices?\b/i.test(question) ? ["Whether recurring client installment invoices are automated or manually sent by reps"] : []),
      ...(/\bledger\b/i.test(question) ? ["Whether recurring client payments should appear in the sales ledger"] : []),
      ...(/\bcommission\b/i.test(question) ? ["The approved process for the rep's commission invoice"] : []),
    ];
    return exactFallbackAtomicAnswerPlan(
      turn,
      retrieval,
      [SAFE_FALLBACK_POLICY_FAMILIES.recurringInvoice],
      answerNeeds.length ? answerNeeds : [question],
      "The current recurring-invoice, ledger, and rep-commission process directly answers this request.",
    );
  }
  if (asksRepeatedDisqualifiedBoundary(question)) {
    return exactFallbackAtomicAnswerPlan(
      turn,
      retrieval,
      [SAFE_FALLBACK_POLICY_FAMILIES.repeatDisqualified],
      [
        "Whether to cancel an audition for someone recently disqualified who keeps reapplying, under the current waiting rule",
        "How to stop automated outreach or repeat bookings from a repeatedly disqualified person through the approved process",
      ],
      "The current waiting rule and approved opt-out process directly control a repeatedly disqualified applicant.",
    );
  }
  if (asksTwentyPercentTemplateTiming(question)) {
    const asksExactCopy = /\b(?:exact(?: current)? (?:copy|wording|template|message|email|text)|wording|copy|templates?)\b/i.test(question);
    return exactFallbackAnswerPlan(
      turn,
      retrieval,
      [SAFE_FALLBACK_POLICY_FAMILIES.twentyPercentTemplatesTiming],
      "The approved template family and calendar-day-before timing directly answer the governed parts of this request.",
      asksExactCopy
        ? {
          lane: "artifact",
          text: "Get the exact current night-before and morning email and text copy",
          reason: "Exact controlled template copy must come from the current approved artifact rather than being rewritten from memory.",
          routeKey: "sales_policy",
        }
        : undefined,
      "Which approved email and SMS templates apply to 20 percent bookings and when the day-before confirmation should be sent",
    );
  }
  return null;
}

function deterministicPlan(turn: V3TurnResolution, retrieval: V4RetrievalResult): V4AnswerPlan {
  const decisionQuestion = v4DecisionQuestion(turn);
  const normalizedQuestion = decisionQuestion.toLowerCase().replace(/\s+/g, " ").trim();
  const blocked = retrieval.blocked.find((candidate) => v4BlockedTopicMatchesQuestion(candidate.topic, decisionQuestion));
  const directPolicyControlsBlockedQuestion = blocked && retrieval.candidates.some((candidate) =>
    v4PolicyCanSupportNeed(candidate.policy, turn, decisionQuestion) &&
    v4PolicyDirectlyAddressesNeed(candidate.policy, decisionQuestion),
  ) && !v4BlockedTopicIsStrictlyBound(blocked.topic, decisionQuestion);
  if (blocked && !directPolicyControlsBlockedQuestion) {
    return fallbackPlanForLane(
      turn,
      "route",
      `The matching governance topic ${blocked.topic.id} is explicitly unresolved.`,
    );
  }

  const asksTierOneBoundary = /\b(?:tier[ -]?1|apple tv|amazon(?: prime)?|tubi|streaming platforms?|streaming plaforms?|platform placement)\b/.test(normalizedQuestion) &&
    /\b(?:one|all|all (?:3|three)|which|what|how|list|choose|choice|guarantee|guaranteed|pay extra|force|placement|submit|submission|cover|include|appear)\b/.test(normalizedQuestion);
  if (asksTierOneBoundary && !/\b(?:film|filming|book|schedule|after purchase)\b/.test(normalizedQuestion)) {
    const paidAllThree = asksPaidAllThreePlatforms(decisionQuestion);
    const asksPlatformChoice = /\b(?:choose|choice|select|decide|control|pick)\b.{0,80}\b(?:tier[ -]?1|platform)\b|\b(?:tier[ -]?1|platform)\b.{0,80}\b(?:choose|choice|select|decide|control|pick)\b/.test(normalizedQuestion);
    const asksPlatformMechanics = /\bhow\b.{0,60}\b(?:appear|placed|placement|submitted|submission|find|search)\b|\bhow do episodes appear\b/.test(normalizedQuestion);
    const asksClientMessageDraft = asksClientMessageReview(decisionQuestion);
    return exactFallbackAnswerPlan(
      turn,
      retrieval,
      [SAFE_FALLBACK_POLICY_FAMILIES.tierOneBoundary],
      "The owner-reviewed one-platform and no-guarantee boundary directly applies.",
      paidAllThree
        ? {
          lane: "route",
          text: "Whether a client may pay extra for submission to all three Tier-1 platforms",
          reason: "The current boundary does not expressly approve or prohibit a paid all-three option.",
          routeKey: "sales_policy",
        }
        : asksPlatformChoice
          ? {
            lane: "route",
            text: "Whether the cast member controls which Tier-1 platform receives the submission",
            reason: "The current boundary names eligible destinations but does not grant the cast member a platform-selection right.",
            routeKey: "sales_policy",
          }
        : asksPlatformMechanics
          ? {
            lane: "route",
            text: "The platform-specific appearance or discovery mechanics",
            reason: "The current boundary names eligible platforms but does not establish how an episode appears or is found there.",
            routeKey: "sales_policy",
          }
          : asksClientMessageDraft
            ? {
              lane: "route",
              text: "The requested client-message fact check and rewrite",
              reason: "One platform boundary cannot validate every factual claim or complete the requested client-facing draft.",
              routeKey: "sales_policy",
            }
          : undefined,
      "The included VIP submission count and placement boundary",
    );
  }

  const asksContractBeforeCallTwo = /\b(?:send|share|provide)\b.{0,80}\b(?:contract|agreement)\b.{0,80}\b(?:before call 2|legal|review)\b|\b(?:contract|agreement)\b.{0,80}\b(?:legal|review)\b.{0,80}\bbefore call 2\b/.test(normalizedQuestion);
  if (asksContractBeforeCallTwo) {
    return exactFallbackAnswerPlan(
      turn,
      retrieval,
      [SAFE_FALLBACK_POLICY_FAMILIES.contractBeforeCallTwo],
      "The canonical contract-before-Call-2 boundary directly answers this request.",
    );
  }

  if (asksStopReinstatement(decisionQuestion)) {
    return exactFallbackAnswerPlan(
      turn,
      retrieval,
      [SAFE_FALLBACK_POLICY_FAMILIES.stopReinstatement],
      "The current STOP-reinstatement support instruction directly applies.",
      {
        lane: "route",
        text: "Whether sales tech has cleared the prospect for renewed outreach and booking",
        reason: "A prior STOP response requires the current sales-tech resubscription check before proceeding.",
        routeKey: "sales_tech",
      },
    );
  }

  const asksAppDownload = /\b(?:download|install)\b.{0,40}\b(?:istv|isn)(?:\s+app)?\b|\bget\b.{0,40}\b(?:istv|isn)?\s*app\b|\b(?:roku|fire stick|apple tv)\b.{0,40}\bapp\b/.test(normalizedQuestion);
  const asksControlledArtifact = /\b(?:pdf|deck|slide deck|presentation|document|script|template|media kit|resource|contract link|payment link|training video|recording link)\b/.test(normalizedQuestion) && !asksAppDownload;
  if (asksControlledArtifact) {
    return fallbackPlanForLane(turn, "artifact", "The no-model fallback does not return or authorize controlled files.");
  }

  const asksViewerStatistic = /\b(?:average|exact|how many|number of)\b.{0,35}\b(?:views?|viewers?|viewership|audience|demographics?|awards?)\b/.test(normalizedQuestion);
  if (asksViewerStatistic) {
    return fallbackPlanForLane(turn, "route", "Viewer, audience, and award statistics require a current governed source.");
  }

  const asksSameDayDiscount = /\b(?:same day|same-day)\b.{0,40}\bdiscount\b|\bdiscount\b.{0,40}\b(?:same day|same-day)\b/.test(normalizedQuestion);
  if (asksSameDayDiscount) {
    return exactFallbackAnswerPlan(
      turn,
      retrieval,
      [SAFE_FALLBACK_POLICY_FAMILIES.sameDayDiscount],
      "An exact canonical same-day-discount boundary is available.",
    );
  }

  const asksPricing = /\b(?:prices?|pricing|costs?|packages?|offers?|payments?|payment plans?|payment options?|installments?|instalments?)\b/.test(normalizedQuestion);
  if (asksPricing && turn.productScope === "unknown") {
    return fallbackPlanForLane(
      turn,
      "clarify",
      "Pricing differs by product and the question does not establish the product.",
      null,
      "Do you mean main ISTV or Daymond John / Next Level CEO?",
    );
  }
  if (asksPricing && turn.productScope === "dj_nlceo") {
    return exactFallbackAnswerPlan(
      turn,
      retrieval,
      [SAFE_FALLBACK_POLICY_FAMILIES.djOffers],
      "The current owner-approved DJ/NLCEO offer table directly answers this request.",
    );
  }
  if (asksPricing && turn.productScope === "main_istv") {
    const asksPaymentPlan = /\b(?:payments?|payment plans?|payment options?|installments?|instalments?|split)\b/.test(normalizedQuestion);
    const asksPriceOrPackage = /\b(?:prices?|pricing|costs?|packages?|offers?)\b/.test(normalizedQuestion);
    const families = [
      ...(asksPriceOrPackage ? [SAFE_FALLBACK_POLICY_FAMILIES.mainPrices] : []),
      ...(asksPaymentPlan ? [SAFE_FALLBACK_POLICY_FAMILIES.mainPayments] : []),
    ];
    return exactFallbackAnswerPlan(
      turn,
      retrieval,
      families.length ? families : [SAFE_FALLBACK_POLICY_FAMILIES.mainPrices, SAFE_FALLBACK_POLICY_FAMILIES.mainPayments],
      "The canonical main ISTV price and listed-plan cards directly answer this request.",
    );
  }

  if (asksAppDownload) {
    return exactFallbackAnswerPlan(
      turn,
      retrieval,
      [SAFE_FALLBACK_POLICY_FAMILIES.appDevices],
      "The owner-reviewed device list directly answers this app-download question.",
    );
  }

  const asksEpisodeAiringTimeline = /\b(?:how long|timeline|turnaround|time frame|timeframe)\b.{0,100}\b(?:episode|air|aired|airing)\b|\bhow long does it take\b.{0,100}\b(?:air|aired|airing)\b/.test(normalizedQuestion);
  if (asksEpisodeAiringTimeline) {
    return fallbackPlanForLane(
      turn,
      "route",
      "The current catalog-versus-watchability boundary does not establish an episode production or airing timeline.",
      "sales_policy",
    );
  }

  const asksWatchability = /\b(?:watch|watchable|stream|streaming|on air|aired|airing|episode availability|episode link|available to view)\b/.test(normalizedQuestion);
  if (asksWatchability) {
    const onlyAsksConceptualBoundary = asksConceptualWatchabilityBoundary(decisionQuestion);
    return exactFallbackAnswerPlan(
      turn,
      retrieval,
      [SAFE_FALLBACK_POLICY_FAMILIES.watchabilityBoundary],
      "The owner-reviewed catalog-versus-watchability boundary directly applies.",
      onlyAsksConceptualBoundary ? undefined : {
        lane: "live_lookup",
        text: "The exact show's current public episode availability",
        reason: "Catalog membership cannot establish current public watchability.",
        routeKey: "sales_policy",
      },
    );
  }

  const asksShowList = /\b(?:current|active|approved|available|latest)\b.{0,35}\bshow(?:s| list)?\b|\bwhat shows\b|\blist (?:of|the) shows\b|\bshows (?:we are|we re) currently casting\b/.test(normalizedQuestion);
  if (asksShowList) {
    return exactFallbackAnswerPlan(
      turn,
      retrieval,
      [SAFE_FALLBACK_POLICY_FAMILIES.showList],
      "The current canonical approved-show list directly answers this request.",
      asksShowListLocation(decisionQuestion)
        ? {
          lane: "route",
          text: "Where the maintained active-show source is located",
          reason: "The approved catalog provides the current list but not a rep-facing maintained link or location.",
          routeKey: "sales_policy",
        }
        : undefined,
    );
  }

  const asksRoiBoundary = /\b(?:roi|return on investment|revenue guarantee|guaranteed leads?|fundrais|business outcome)\b/.test(normalizedQuestion);
  if (asksRoiBoundary) {
    return exactFallbackAnswerPlan(
      turn,
      retrieval,
      [SAFE_FALLBACK_POLICY_FAMILIES.roiBoundary],
      "A direct approved prohibition covers ROI claims.",
    );
  }

  const asksLanguageBoundary = /\b(?:spanish|non[- ]english|another language|translation|translate|translated|bilingual)\b/.test(normalizedQuestion);
  if (asksLanguageBoundary) {
    return exactFallbackAnswerPlan(
      turn,
      retrieval,
      [SAFE_FALLBACK_POLICY_FAMILIES.languageBoundary],
      "The approved production-language boundary directly applies.",
    );
  }

  const asksSeasonCapacity = /\b(?:how many|multiple)\b.{0,35}\b(?:seasons?|episodes?(?: per season| for (?:a|the) show)?)\b|\bseason capacity\b/.test(normalizedQuestion);
  if (asksSeasonCapacity) {
    return exactFallbackAnswerPlan(
      turn,
      retrieval,
      [SAFE_FALLBACK_POLICY_FAMILIES.seasonCapacity],
      "A direct governed season-capacity statement answers this narrow question.",
      asksExactSeasonCount(decisionQuestion)
        ? {
          lane: "route",
          text: "The exact number of seasons",
          reason: "Current evidence confirms multiple seasons but not a fixed total season count.",
          routeKey: "sales_policy",
        }
        : undefined,
    );
  }

  const asksCallOneFlow = /\b(?:approved guidance (?:for|on)|guidance (?:for|on))\s+call\s*1 flow\b|\bcall\s*1 flow\b/.test(normalizedQuestion);
  if (asksCallOneFlow) {
    return exactFallbackAnswerPlan(
      turn,
      retrieval,
      [SAFE_FALLBACK_POLICY_FAMILIES.callOneFlow],
      "The canonical Call 1 answer and escalation rules directly answer this named-guidance request.",
    );
  }

  const asksPostSaleHandoff = /\b(?:approved guidance (?:for|on)|guidance (?:for|on))\s+post[- ]sale handoff after close\b|\bpost[- ]sale handoff after close\b/.test(normalizedQuestion);
  if (asksPostSaleHandoff) {
    return exactFallbackAnswerPlan(
      turn,
      retrieval,
      [SAFE_FALLBACK_POLICY_FAMILIES.postSaleHandoff],
      "The canonical post-sale handoff answer cards directly answer this named-guidance request.",
    );
  }

  const asksLiveLookup = /\b(?:currently|right now|today|latest status|available now|exact status)\b/.test(normalizedQuestion);
  return fallbackPlanForLane(
    turn,
    asksLiveLookup ? "live_lookup" : "route",
    "The no-model fallback is intentionally limited to explicit high-confidence governed question families.",
  );
}

function parseComposition(content: string, plan: V4AnswerPlan, candidates: V4Candidate[]): V4Composition {
  const raw = parseV3Json<Record<string, unknown>>(content);
  const needIds = new Set(plan.needs.map((need) => need.id));
  const plannedRefs = new Set(plan.needs.flatMap((need) => need.evidence_refs));
  const sentences = Array.isArray(raw.sentences) ? raw.sentences.slice(0, 16).flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const entry = item as Record<string, unknown>;
    const text = displayText(entry.text || entry.sentence, 900);
    if (!text) return [];
    const refs = stringArray(entry.evidence_refs, 8)
      .map((ref) => resolveCandidateRef(ref, candidates))
      .filter((ref): ref is string => ref !== null)
      .filter((ref) => plannedRefs.has(ref));
    const attachedNeeds = [...new Set(stringArray(entry.need_ids, 8).filter((id) => {
      if (!needIds.has(id)) return false;
      const need = plan.needs.find((candidate) => candidate.id === id);
      return Boolean(need && need.lane === "answer");
    }))];
    const kind = ["answer", "boundary", "clarification"].includes(String(entry.kind))
      ? String(entry.kind) as V4ComposedSentence["kind"]
      : "answer";
    return [{ id: `S${index + 1}`, text, need_ids: attachedNeeds, evidence_refs: [...new Set(refs)], kind }];
  }) : [];
  return { summary: displayText(raw.summary, 1000), sentences };
}

function compositionPrompt(plan: V4AnswerPlan, candidates: V4Candidate[], turn: V3TurnResolution) {
  const selectedIds = new Set(plan.needs.flatMap((need) => need.evidence_refs));
  const evidence = candidateCards(candidates, v4SupportModeRequest(turn)).filter((_, index) => selectedIds.has(candidates[index].policy.id));
  return {
    system: [
      "Write a concise internal sales answer from the approved atomic plan and exact evidence. Return JSON only.",
      "Return each factual sentence separately as {id,text,need_ids,evidence_refs,kind}. Use only plan need IDs and supplied C refs.",
      "Every factual sentence must be fully entailed by its cited evidence. Preserve amounts and units exactly, although equivalent formatting such as $20k and $20,000 is allowed.",
      "Do not add a route channel, caveat, exception, guarantee, deadline, step, platform, or actor unless the cited evidence says it.",
      "Do not mention evidence, policy IDs, RAG, source files, approval mechanics, or governance to the sales rep.",
      "Compose only answer-lane needs. The runtime will add clarification and route language for other needs.",
      "Return {summary,sentences:[...]}.",
    ].join("\n"),
    user: JSON.stringify({ question: v4DecisionQuestion(turn), original_question: turn.currentQuestion, plan, evidence }),
  };
}

function exactEvidenceFallback(
  plan: V4AnswerPlan,
  candidates: V4Candidate[],
  useBoundedGovernedClaims = false,
): V4Composition {
  const grouped = new Map<string, { policy: V3Policy; needIds: string[] }>();
  for (const need of plan.needs.filter((candidate) => candidate.lane === "answer")) {
    for (const policyId of need.evidence_refs) {
      const policy = candidates.find((candidate) => candidate.policy.id === policyId)?.policy;
      if (!policy) continue;
      const entry = grouped.get(policyId) || { policy, needIds: [] };
      if (!entry.needIds.includes(need.id)) entry.needIds.push(need.id);
      grouped.set(policyId, entry);
    }
  }
  const sentences = [...grouped.values()].map(({ policy, needIds }, index) => {
    const fullEvidence = evidenceDecision(policy);
    const answerNeeds = needIds
      .map((needId) => plan.needs.find((need) => need.id === needId))
      .filter((need): need is V4PlannedNeed => Boolean(need));
    const boundedClaims = answerNeeds
      .map((need) => displayText(need.supported_claim, 1000))
      .filter(Boolean);
    const canUseBoundedClaims = useBoundedGovernedClaims &&
      boundedClaims.length === answerNeeds.length &&
      boundedClaims.every((claim) => fullEvidence.includes(claim));
    const text = canUseBoundedClaims
      ? [...new Set(boundedClaims)].join(" ")
      : fullEvidence;
    return {
      id: `F${index + 1}`,
      text,
      need_ids: needIds,
      evidence_refs: [policy.id],
      kind: "answer" as const,
    };
  });
  return { summary: sentences.map((sentence) => sentence.text).join(" "), sentences };
}

function validatorPrompt(composition: V4Composition, plan: V4AnswerPlan, candidates: V4Candidate[], turn: V3TurnResolution) {
  const evidenceForRefs = (refs: string[]) => {
    const selectedIds = new Set(refs);
    return candidates.filter((candidate) => selectedIds.has(candidate.policy.id)).map((candidate) => ({
      id: candidate.policy.id,
      title: candidate.policy.title,
      decision: evidenceDecision(candidate.policy),
      product_scopes: candidate.policy.product_scopes,
    }));
  };
  const sentenceAudits = composition.sentences.map((sentence) => ({
    sentence_id: sentence.id,
    text: sentence.text,
    need_ids: sentence.need_ids,
    evidence: evidenceForRefs(sentence.evidence_refs),
  }));
  const needAudits = plan.needs.filter((need) => need.lane === "answer").map((need) => ({
    need_id: need.id,
    text: need.text,
    supported_claim: need.supported_claim,
    original_user_question: turn.currentQuestion,
    resolved_user_question: turn.standaloneQuestion,
    sentences: composition.sentences.filter((sentence) => sentence.need_ids.includes(need.id)).map((sentence) => {
      const needSentenceRefs = sentence.evidence_refs.filter((ref) => need.evidence_refs.includes(ref));
      return {
        sentence_id: sentence.id,
        text: sentence.text,
        evidence: evidenceForRefs(needSentenceRefs),
      };
    }),
  }));
  return {
    system: [
      "Audit each proposed sentence against only its cited evidence. Return JSON only.",
      "Treat every sentence_audit and need_audit as an isolated packet. Never use evidence from another sentence or need to support the packet being checked.",
      "Before judging entailment, verify that the cited policy's prerequisites actually occur in original_user_question or resolved_user_question. Do not apply a rule for cancellation, inability to invest, a bank block, language support, or another special condition when that condition is absent.",
      "Mark supported only when the whole sentence is entailed under the same product, actor, timing, relationship, conditions, quantity, and requested action.",
      "Formatting-equivalent numbers are equal: $20k equals $20,000 and $2.5k equals $2,500.",
      "A sentence with any unsupported clause is unsupported. Do not rewrite it and do not approve it because it sounds plausible.",
      "For each supported sentence, evidence_refs must contain at least one evidence ID from that sentence_audit and no ID outside that packet.",
      "Sentence-check status must be exactly supported, unsupported, or irrelevant. Need-check status must be exactly answered, partial, or unresolved.",
      "Return exactly one sentence_check for every supplied sentence_id and exactly one need_check for every supplied need_id. Do not omit, duplicate, rename, or add IDs.",
      "Return {sentence_checks:[{sentence_id,status,evidence_refs,reason}],need_checks:[{need_id,status,reason}],reason}.",
    ].join("\n"),
    user: JSON.stringify({
      sentence_audits: sentenceAudits,
      need_audits: needAudits,
    }),
  };
}

function parseValidator(
  content: string,
  expectedSentenceIds: string[],
  expectedNeedIds: string[],
  allowedEvidenceRefsBySentence: Map<string, Set<string>>,
) {
  const raw = parseV3Json<Record<string, unknown>>(content);
  if (!Array.isArray(raw.sentence_checks)) throw new Error("V4 validator omitted sentence checks");
  if (!Array.isArray(raw.need_checks)) throw new Error("V4 validator omitted need checks");
  const checks = raw.sentence_checks.slice(0, 20).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const entry = item as Record<string, unknown>;
    const sentenceId = clean(entry.sentence_id, 40);
    if (!sentenceId) return [];
    if (!["supported", "unsupported", "irrelevant"].includes(String(entry.status))) {
      throw new Error("V4 validator returned an invalid sentence-check status");
    }
    const status = String(entry.status) as "supported" | "unsupported" | "irrelevant";
    return [{ sentenceId, status, evidenceRefs: stringArray(entry.evidence_refs, 8), reason: clean(entry.reason, 500) }];
  });
  const needChecks = raw.need_checks.slice(0, 12).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const entry = item as Record<string, unknown>;
    const needId = clean(entry.need_id, 40);
    if (!needId) return [];
    if (!["answered", "partial", "unresolved"].includes(String(entry.status))) {
      throw new Error("V4 validator returned an invalid need-check status");
    }
    const status = String(entry.status) as "answered" | "partial" | "unresolved";
    return [{ needId, status, reason: clean(entry.reason, 500) }];
  });
  const exactIds = (actual: string[], expected: string[], label: string) => {
    const actualSet = new Set(actual);
    const expectedSet = new Set(expected);
    if (
      actual.length !== actualSet.size ||
      actual.length !== expected.length ||
      actual.some((id) => !expectedSet.has(id)) ||
      expected.some((id) => !actualSet.has(id))
    ) {
      throw new Error(`V4 validator must return exactly one ${label} for every supplied ID`);
    }
  };
  exactIds(checks.map((check) => check.sentenceId), expectedSentenceIds, "sentence check");
  exactIds(needChecks.map((check) => check.needId), expectedNeedIds, "need check");
  for (const check of checks) {
    if (check.status !== "supported") continue;
    const allowed = allowedEvidenceRefsBySentence.get(check.sentenceId) || new Set<string>();
    if (!check.evidenceRefs.length) throw new Error(`V4 validator omitted evidence refs for supported sentence ${check.sentenceId}`);
    if (check.evidenceRefs.some((ref) => !allowed.has(ref))) {
      throw new Error(`V4 validator cited evidence outside the packet for sentence ${check.sentenceId}`);
    }
  }
  return { checks, needChecks, reason: clean(raw.reason, 700) };
}

function policiesForSentence(sentence: V4ComposedSentence, candidates: V4Candidate[]) {
  return sentence.evidence_refs
    .map((id) => candidates.find((candidate) => candidate.policy.id === id)?.policy)
    .filter((policy): policy is V3Policy => Boolean(policy));
}

function v4SentenceDeterministicallyCoversNeed(sentence: string, need: V4PlannedNeed) {
  if (/^\s*(?:why|where|who|when|how|which|what\s+(?:time|reason))\b|\b(?:reason why|exact(?:ly)? when|exact time)\b/i.test(need.text)) return false;
  const neededFacets = v4CoverageFacets(need.text);
  const sentenceFacets = v4CoverageFacets(sentence);
  if ([...neededFacets].some((facet) => V4_CLAIM_REQUIRED_COVERAGE_FACETS.has(facet) && !sentenceFacets.has(facet))) return false;
  const needTerms = v4DirectMatchTerms(need.text);
  if (!needTerms.size) return false;
  const sentenceTerms = v4DirectMatchTerms(sentence);
  const overlap = [...needTerms].filter((term) => sentenceTerms.has(term));
  const required = needTerms.size <= 2 ? needTerms.size : Math.ceil(needTerms.size * 0.75);
  return overlap.length >= required;
}

async function validateComposition(input: {
  composition: V4Composition;
  plan: V4AnswerPlan;
  candidates: V4Candidate[];
  turn: V3TurnResolution;
  provider: V3Provider;
  attempts: V3ProviderAttempt[];
  allowModelValidationBypass: boolean;
}) {
  let modelChecks = new Map<string, { status: "supported" | "unsupported" | "irrelevant"; evidenceRefs: string[]; reason: string }>();
  let modelNeedChecks = new Map<string, { status: "answered" | "partial" | "unresolved"; reason: string }>();
  let modelReason = input.allowModelValidationBypass ? "Runtime-generated exact evidence from a deterministic whitelist plan." : "";
  if (!input.allowModelValidationBypass && input.composition.sentences.length) {
    try {
      const prompt = validatorPrompt(input.composition, input.plan, input.candidates, input.turn);
      const expectedSentenceIds = input.composition.sentences.map((sentence) => sentence.id);
      const expectedNeedIds = input.plan.needs.filter((need) => need.lane === "answer").map((need) => need.id);
      const allowedEvidenceRefsBySentence = new Map(input.composition.sentences.map((sentence) => {
        const refs = new Set(sentence.evidence_refs);
        for (const policyId of sentence.evidence_refs) {
          const candidateIndex = input.candidates.findIndex((candidate) => candidate.policy.id === policyId);
          if (candidateIndex >= 0) refs.add(`C${candidateIndex + 1}`);
        }
        return [sentence.id, refs] as const;
      }));
      const result = await input.provider({
        purpose: "v4_claim_validation",
        system: prompt.system,
        user: prompt.user,
        maxTokens: 1800,
        parse: (content) => parseValidator(content, expectedSentenceIds, expectedNeedIds, allowedEvidenceRefsBySentence),
      });
      input.attempts.push(...result.attempts);
      modelChecks = new Map(result.output.checks.map((check) => [check.sentenceId, check]));
      modelNeedChecks = new Map(result.output.needChecks.map((check) => [check.needId, check]));
      modelReason = result.output.reason;
    } catch (error) {
      input.attempts.push(...providerAttemptsFromV4Error(error));
      modelReason = `Claim validator unavailable: ${clean(error, 400)}`;
    }
  }

  const sentenceChecks: V4SentenceCheck[] = input.composition.sentences.map((sentence) => {
    const policies = policiesForSentence(sentence, input.candidates);
    const evidence = evidenceText(policies);
    const attachedNeeds = sentence.need_ids
      .map((id) => input.plan.needs.find((need) => need.id === id))
      .filter((need): need is V4PlannedNeed => Boolean(need && need.lane === "answer"));
    const deterministicErrors = [
      ...(sentence.evidence_refs.length ? [] : ["sentence has no evidence reference"]),
      ...(attachedNeeds.length ? [] : ["sentence is not attached to an answer need"]),
      ...(policies.length === sentence.evidence_refs.length ? [] : ["sentence references evidence outside the selected candidate set"]),
      ...attachedNeeds.flatMap((need) =>
        sentence.evidence_refs.every((ref) => need.evidence_refs.includes(ref))
          ? []
          : [`sentence cites evidence outside need ${need.id}`],
      ),
      ...policies.flatMap((policy) => v4PolicySupportErrors(policy, input.turn, attachedNeeds.map((need) => need.text).join(" "))),
      ...deterministicV4SentenceErrors(sentence.text, evidence),
    ];
    const model = modelChecks.get(sentence.id);
    const resolvedValidatorRefs = model?.evidenceRefs.map((ref) => resolveCandidateRef(ref, input.candidates)) || [];
    const validatorRefsValid = Boolean(
      model &&
      model.evidenceRefs.length > 0 &&
      resolvedValidatorRefs.every((ref) => ref !== null && sentence.evidence_refs.includes(ref)),
    );
    if (model && !model.evidenceRefs.length) deterministicErrors.push("validator supplied no evidence reference");
    if (model && model.evidenceRefs.length && !validatorRefsValid) deterministicErrors.push("validator cited evidence outside the sentence");
    const modelRejected = model && model.status !== "supported";
    const validatorMissing = !input.allowModelValidationBypass && !model;
    const status = deterministicErrors.length || modelRejected || validatorMissing ? (model?.status === "irrelevant" ? "irrelevant" : "unsupported") : "supported";
    return {
      sentenceId: sentence.id,
      status,
      evidenceRefs: sentence.evidence_refs,
      reason: deterministicErrors.join("; ") || model?.reason || (input.allowModelValidationBypass ? "Exact governed decision passed deterministic checks." : "Sentence passed claim validation."),
      deterministicErrors,
    };
  });
  const supportedSentenceIds = new Set(sentenceChecks.filter((check) => check.status === "supported").map((check) => check.sentenceId));
  const groundedNeedIds = new Set<string>();
  const answeredNeedIds = new Set(input.plan.needs.flatMap((need) => {
    if (need.lane !== "answer") return [];
    const hasGroundedSentence = input.composition.sentences.some((sentence) =>
      supportedSentenceIds.has(sentence.id) &&
      sentence.need_ids.includes(need.id) &&
      sentence.evidence_refs.length > 0 &&
      sentence.evidence_refs.every((ref) => need.evidence_refs.includes(ref)),
    );
    const deterministicNeedCoverage = input.composition.sentences.some((sentence) =>
      supportedSentenceIds.has(sentence.id) && sentence.need_ids.includes(need.id) && v4SentenceDeterministicallyCoversNeed(sentence.text, need),
    );
    if (hasGroundedSentence) groundedNeedIds.add(need.id);
    const modelAnswered = input.allowModelValidationBypass || modelNeedChecks.get(need.id)?.status === "answered" || deterministicNeedCoverage;
    return hasGroundedSentence && modelAnswered ? [need.id] : [];
  }));
  const partiallyAnsweredNeedIds = new Set(input.plan.needs.flatMap((need) =>
    need.lane === "answer" &&
    groundedNeedIds.has(need.id) &&
    !answeredNeedIds.has(need.id) &&
    modelNeedChecks.get(need.id)?.status === "partial"
      ? [need.id]
      : [],
  ));
  const unresolvedNeedIds = input.plan.needs.filter((need) => need.lane !== "answer" || !answeredNeedIds.has(need.id)).map((need) => need.id);
  const retainedNeedIds = new Set([...answeredNeedIds, ...partiallyAnsweredNeedIds]);
  const responsiveSupportedSentenceIds = new Set(input.composition.sentences.flatMap((sentence) =>
    supportedSentenceIds.has(sentence.id) && sentence.need_ids.some((needId) => retainedNeedIds.has(needId)) ? [sentence.id] : [],
  ));
  const removedSentences = input.composition.sentences.filter((sentence) => !responsiveSupportedSentenceIds.has(sentence.id)).map((sentence) => sentence.text);
  const supportedCount = responsiveSupportedSentenceIds.size;
  const verdict: V4Validation["verdict"] = supportedCount && !unresolvedNeedIds.length && !removedSentences.length
    ? "pass"
    : supportedCount && removedSentences.length
      ? "partial_recovery"
      : supportedCount
        ? "repair"
        : "route";
  return {
    validation: {
      verdict,
      sentenceChecks,
      removedSentences,
      unresolvedNeedIds,
      reason: unresolvedNeedIds.length
        ? `Claim-level checks retained ${unresolvedNeedIds.length} unresolved need${unresolvedNeedIds.length === 1 ? "" : "s"}; only supported answer sentences remain.`
        : removedSentences.length
          ? `Claim-level checks removed ${removedSentences.length} unsupported sentence${removedSentences.length === 1 ? "" : "s"}.`
          : modelReason || "Claim-level checks completed.",
    } satisfies V4Validation,
    supportedSentenceIds: responsiveSupportedSentenceIds,
  };
}

function routeKeyFor(question: string, policies: V3Policy[], plannedNeeds: V4PlannedNeed[]) {
  const normalized = question.toLowerCase();
  const exactOverrides = [...new Set(policies
    .map((policy) => asksScriptwriterSchedulingEscalation(question) ? V4_POLICY_ROUTE_OVERRIDES.get(policy.id) : undefined)
    .filter((key): key is string => key !== undefined && allowedRouteKeys.has(key)))];
  if (exactOverrides.length === 1) return exactOverrides[0];
  const declinedReuseLicenseRights = /\b(?:commercial )?reuse license\b/.test(normalized) &&
    /\bdeclin\w*\b/.test(normalized) &&
    /\b(?:rights?|reuse|use|segment|content)\b/.test(normalized);
  if (declinedReuseLicenseRights) return "sales_policy";
  const technicalContractVisibility = /\b(?:contract|agreement|signature|signed)\b/.test(normalized) &&
    /\b(?:missing|not appear|did not appear|does not appear|not populat|did not populat|does not populat|where (?:can|do) i (?:see|find)|verify.{0,40}(?:signed|signature)|view.{0,40}(?:signed|agreement|contract))\b/.test(normalized);
  if (technicalContractVisibility) return "sales_tech";
  const technicalCheckoutFailure = /\b(?:payment|checkout)(?:\s+(?:link|page|button|screen|form))?\b/.test(normalized) &&
    /\b(?:broken|error|fails?|failed|failure|not working|won't work|will not|cannot|can't|unable|not let|does not let|same (?:thing|problem|issue)|button|tap|click|agree to (?:the )?terms)\b/.test(normalized);
  if (technicalCheckoutFailure) return "sales_tech";
  const selfSourcedTooling = /\bself[- ]sourced\b/.test(normalized) &&
    /\b(?:application|calendar|attribut|general pool|routing|routed|form|link)\w*\b/.test(normalized);
  if (selfSourcedTooling) return "sales_tech";
  if (asksScriptwriterSchedulingEscalation(question)) return "fulfillment";
  if (/\b(?:greenlight letter|green light letter|approval letter|greenlight pdf|greenlight status|greenlight cap)\b/.test(normalized)) return "greenlight";
  const thirdPartyPaymentContext = /\b(?:third[- ]party|business partner|partner|different payer|payer (?:is )?not)\b/.test(normalized) &&
    /\b(?:pay|payment|paid|payer)\w*\b/.test(normalized);
  const thirdPartyPaymentConfirmation = thirdPartyPaymentContext && /\b(?:confirm|match|verify)\w*\b/.test(normalized);
  const receiptOrTaxTreatment = /\b(?:receipt|tax write[- ]?off|tax treatment|tax purpose|invoice description)\b/.test(normalized);
  const financeOperation = thirdPartyPaymentConfirmation || receiptOrTaxTreatment || /\b(?:ach|wire|invoice|billing|refund|duplicate charge|payment status|auto[- ]?draft|automatic(?:ally)? draft|future payments?|future installments?|approve each payment|card (?:required|requirement|charge|payment|update|decline)|failed payment|payment failed|bank transfer)\b|\bunlisted\b.{0,60}\b(?:payment|upgrade)\s+schedule\b/.test(normalized);
  if (financeOperation) return "finance";
  const contentWordingDecision = /\b(?:wording|template|copy|message|email|text)\b/.test(normalized) &&
    /\b(?:change|edit|rewrite|write|say|send|use|approved|current|night before|morning of)\b/.test(normalized) &&
    !/\b(?:delivery failed|not delivered|not received|sms error|text error|send button|not working)\b/.test(normalized);
  if (contentWordingDecision) return "sales_policy";
  if (/\b(?:login|log in|access|keap|zoom phone|calendar|recording|hubspot|form|dropdown|tool|broken link|checkout page|sms|text message|subscriber|resubscribe|re subscribe|opt in|opt out|stop keyword)\b/.test(normalized)) return "sales_tech";
  const policyKeys = [...new Set(policies
    .filter((policy) => policy.answerability === "route_or_support" && v4PolicyDirectlyAddressesNeed(policy, question))
    .map((policy) => policy.route_key)
    .filter((key): key is string => key !== null)
    .filter((key) => allowedRouteKeys.has(key)))];
  if (policyKeys.length === 1) return policyKeys[0];
  const explicit = [...new Set(plannedNeeds.map((need) => need.route_key).filter((key): key is string => key !== null).filter((key) => allowedRouteKeys.has(key)))];
  if (explicit.length === 1) return explicit[0];
  return "sales_policy";
}

function finalLane(plan: V4AnswerPlan, validation: V4Validation, supportedCount: number): V4Lane {
  if (supportedCount && validation.unresolvedNeedIds.length) return "partial";
  if (supportedCount) return "answer";
  if (plan.needs.some((need) => need.lane === "clarify")) return "clarify";
  if (plan.needs.some((need) => need.lane === "live_lookup")) return "live_lookup";
  if (plan.needs.some((need) => need.lane === "artifact")) return "artifact";
  return "route";
}

function safeRouteAnswer(channel: string) {
  return `I can’t confirm that exact case safely yet. Please check ${channel} before replying to the prospect.`;
}

function structuredAnswer(answer: string, lane: V4Lane, confidence: number, routeChannels: string[]): AskSalesFaqStructuredAnswer {
  const confidenceScore = clampConfidence(confidence);
  const sections = lane === "partial" && routeChannels.length
    ? [{ title: "Needs confirmation", items: [`Verify only the unresolved part${routeChannels.length > 1 ? "s" : ""} in ${routeChannels.join(" or ")}.`], tone: "route" as const }]
    : [];
  return {
    summary: answer,
    sections,
    confidenceLabel: confidenceScore >= 80 ? "High" : confidenceScore >= 50 ? "Medium" : "Low",
    confidenceScore,
    sourceMode: lane === "conversation" ? "conversation" : lane === "answer" || lane === "partial" ? "evidence" : "fallback",
  };
}

function deterministicRewrite(question: string, previousAnswer: string) {
  const previous = displayText(previousAnswer, 5000)
    .replace(/Check\s+(#[a-z0-9_-]+)\s+before replying\.\s+Unresolved:\s+(.+?)\.(?=\s|$)/gi, "Please check $1 to confirm $2 before replying.")
    .replace(/[?!]\s+(?=from\s+#[a-z0-9_-]+)/gi, " ")
    .replace(/^(Get the current controlled resource or file) for where can (?:I|we) find\s+(.+?)\s+from\s+(#[a-z0-9_-]+)\.?$/i, "$1 for $2 from $3.");
  const wantsBullets = /\b(?:bullet|bullets|bullet points|checklist|format(?:ted)? (?:as|into) (?:a )?list)\b/i.test(question);
  const wantsNoRoute = /\b(?:without repeating (?:the )?route|do not repeat (?:the )?route|don't repeat (?:the )?route|remove (?:the )?route(?: note)?|only what is confirmed|keep only (?:the )?confirmed)\b/i.test(question);
  const wantsShorter = /\b(?:shorten|shorter|summari[sz]e|brief|briefly|concise|concisely|short (?:checklist|list)|keep (?:that|it|the answer) short)\b/i.test(question);
  const wantsSimpler = /\b(?:simpler|simple language|plain english|more naturally|more clearly)\b/i.test(question);
  let items = previous.split(/(?<=[.!?])\s+(?=(?:[A-Z](?:[A-Za-z]|\s)|[#•*-]))/g)
    .map((item) => displayText(item.replace(/^\s*[-*•]\s*/, ""), 1000))
    .filter((item) => Boolean(item) && !/^(?:before replying|from\s+#[a-z0-9_-]+)\b/i.test(item))
    .slice(0, 16);
  if (!items.length) return previous;

  const routeOnly = (item: string) => /#[a-z0-9_-]+/i.test(item) && (
    /^For\b.{0,500}\b(?:check|get|use)\b/i.test(item) ||
    /^Please\s+(?:check|verify|use)\b/i.test(item) ||
    /^Verify only\b/i.test(item) ||
    /^(?:Get|Request)\b.{0,700}\b#[a-z0-9_-]+/i.test(item) ||
    /\b(?:current live lookup is required|before replying)\b/i.test(item)
  );
  const routeUncertainty = (item: string) => {
    const confirmation = item.match(/^Please check\s+#[a-z0-9_-]+\s+to confirm\s+(.+?)\s+before replying[.!]?$/i);
    const subject = confirmation?.[1]?.replace(/[?.!;:]+$/g, "").trim();
    if (!subject) return "";
    const turnaround = subject.match(/^what turnaround terms apply to\s+(.+)$/i);
    if (turnaround) return `No approved turnaround terms are confirmed for ${turnaround[1].replace(/[?.!]+$/g, "")}.`;
    const timing = subject.match(/^what (?:timing|timeline|date|schedule) (?:applies|is approved) for\s+(.+)$/i);
    if (timing) return `No approved timing is confirmed for ${timing[1].replace(/[?.!]+$/g, "")}.`;
    return `The current answer does not confirm ${subject}.`;
  };
  const conciseRouteInstruction = (item: string) => {
    const confirmation = item.match(/^Please check\s+(#[a-z0-9_-]+)\s+to confirm\s+(.+?)\s+before replying[.!]?$/i);
    if (confirmation) {
      const channel = confirmation[1];
      const subject = confirmation[2];
      if (/mastermind only once a year|other in-person training and networking programs/i.test(subject)) {
        return `Mastermind frequency and other in-person programs: check ${channel}.`;
      }
      return `Confirm ${subject.replace(/[?.!;:]+$/g, "")} in ${channel}.`;
    }
    const controlledResource = item.match(/^Request the current controlled resource or file for\s+(.+?)\s+from\s+(#[a-z0-9_-]+)[.!]?$/i);
    if (controlledResource) {
      let subject = controlledResource[1]
        .replace(/^the document that explains the complete\s+(.+?)(?:,\s*including[\s\S]*)?$/i, "the complete $1 document")
        .replace(/\bproduction process\b/i, "production-process")
        .replace(/\s+/g, " ")
        .trim();
      if (!/^the\b/i.test(subject)) subject = `the ${subject}`;
      return `Get ${subject} from ${controlledResource[2]}.`;
    }
    return item;
  };
  if (wantsNoRoute) {
    const factualItems = items.filter((item) => !routeOnly(item));
    if (!factualItems.length) return "No confirmed factual answer remains after removing the route note.";
    const uncertaintyItems = items.filter(routeOnly).map(routeUncertainty).filter(Boolean);
    items = [...factualItems, ...uncertaintyItems];
  }

  if (wantsShorter || wantsSimpler) {
    if (wantsSimpler) {
      items = items.map((item) => {
        const notDisqualifier = item.match(/^(.+?)\s+status by itself is not a disqualifier for\s+(.+?)[.!]?$/i);
        if (!notDisqualifier) return item;
        const subject = notDisqualifier[1].replace(/^the\s+/i, "").trim();
        return `${/^[aeiou]/i.test(subject) ? "An" : "A"} ${subject} can still qualify for ${notDisqualifier[2].replace(/[.!]+$/g, "")}.`;
      });
      const directQualification = items.find((item) => /^A\s+.+?\s+can qualify for\s+.+?[.!]?$/i.test(item));
      if (directQualification && items.every((item) => /\b(?:qualif|disqualif)\w*\b/i.test(item))) {
        items = [`Yes. ${directQualification.replace(/[.!]+$/g, "")}.`];
      }
    }
    const seen = new Set<string>();
    items = items.filter((item) => {
      const key = item.toLowerCase()
        .replace(/\bcan still qualify\b/g, "can qualify")
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/^an?\s+/, "")
        .trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map((item) => {
      const concise = conciseRouteInstruction(item);
      if (concise !== item) return concise;
      if (!routeOnly(item)) return item;
      const check = item.match(/^For\s+(.+?),\s+(?:a current live lookup is required;\s*)?please check\s+(#[a-z0-9_-]+)(?:\s+for the latest status|\s+before replying)?[.!]?$/i);
      if (check) return `${check[1].charAt(0).toUpperCase()}${check[1].slice(1)}: check ${check[2]}.`;
      const resource = item.match(/^For\s+(.+?),\s+get the current controlled resource or file from\s+(#[a-z0-9_-]+)[.!]?$/i);
      if (resource) return `${resource[1].charAt(0).toUpperCase()}${resource[1].slice(1)}: get the current file from ${resource[2]}.`;
      return item;
    });
  }

  if (wantsBullets) return items.map((item) => `• ${item}`).join(" ");
  return items.join(" ") || previous;
}

function deterministicConversation(turn: V3TurnResolution) {
  if (turn.kind === "memory") return turn.memoryAnswer || "This is the first question I can see in this isolated chat.";
  if (turn.kind === "rewrite" && turn.immediatePreviousAssistantAnswer) return deterministicRewrite(turn.currentQuestion, turn.immediatePreviousAssistantAnswer);
  if (turn.kind === "clarification") {
    const context = `${turn.standaloneQuestion} ${turn.immediatePreviousUserQuestion || ""}`;
    const thirdPartyPaymentAndMissingContract = /\b(?:business partner|partner|third[- ]party|payer)\b/i.test(context) &&
      /\b(?:pay|payment|paid)\w*\b/i.test(context) &&
      /\b(?:contract|agreement)\b/i.test(context) &&
      /\b(?:does not|doesn't|did not|didn't|not)\s+(?:populate|appear|generate)|\bmissing\b/i.test(context);
    if (thirdPartyPaymentAndMissingContract) {
      return "Please share only: the product or show, selected package and payment option, the payer’s relationship to the client, where the payment appears, and the current contract status. Do not send bank details, card numbers, login credentials, or other sensitive identifiers.";
    }
    return "Please tell me which product or show this applies to and the exact decision you need to make.";
  }
  if (/\b(?:keep|make)\b.{0,40}\b(?:answers?|replies|responses?)\b.{0,40}\b(?:short|brief|concise|practical|simple)\b/i.test(turn.currentQuestion)) {
    return "Yes—I’ll keep the answers short and practical.";
  }
  if (/\b(?:thanks|thank you|appreciate it)\b/i.test(turn.currentQuestion) &&
    /\b(?:everything|that(?:['’]s| is) all|all for now|done|finished|helpful|perfect|great)\b/i.test(turn.currentQuestion)) {
    return "You’re welcome!";
  }
  if (/^(?:hi|hello|hey|good (?:morning|afternoon|evening)|how are you)\b/i.test(turn.currentQuestion)) {
    return "Hi! I’m ready whenever you are.";
  }
  if (turn.kind === "topic_intro") {
    const topics: Array<[string, RegExp]> = [
      ["qualification", /\b(?:qualification|eligibility|applicant|greenlight)\b/i],
      ["offers and pricing", /\b(?:offer|pricing|package|discount)\b/i],
      ["payments and contracts", /\b(?:payments?|finance|invoices?|contracts?|agreements?)\b/i],
      ["sales tech", /\b(?:sales tech|keap|calendar|zoom|tool)\b/i],
      ["content rights", /\b(?:content rights|license rights|footage|media)\b/i],
      ["proof and support", /\b(?:proof|support|resources?)\b/i],
      ["platforms", /\bplatforms?\b/i],
      ["fulfillment and production", /\b(?:fulfillment|production|filming|scriptwriter|scripting)\b/i],
      ["events", /\b(?:events?|mastermind|red carpet)\b/i],
      ["20 percent outreach", /\b(?:20\s*%|twenty percent|dial[- ]out)\b/i],
    ];
    const named = topics.filter(([, pattern]) => pattern.test(turn.currentQuestion)).map(([label]) => label);
    if (named.length) return `Got it—I’m ready for your ${named.slice(0, 5).join(", ")} questions.`;
    return "Got it—I’m ready for the next set of questions.";
  }
  return "Hi! I’m ready—ask me a sales-policy, qualification, offer, payment, content-rights, or process question.";
}

function isVerifiedSlidePhotoPerspectiveCorrection(turn: V3TurnResolution) {
  if (
    turn.kind !== "follow_up" ||
    !turn.explicitCorrection ||
    !turn.usedImmediateContext ||
    !/\bwhat (?:the )?rep should do\b.{0,80}\bnot what (?:the )?prospect should do\b/i.test(turn.currentQuestion)
  ) return false;
  const priorQuestion = turn.immediatePreviousUserQuestion || "";
  const priorAnswer = turn.immediatePreviousAssistantAnswer || "";
  const exactSubject = /\b(?:photo|photos|photograph|photographs|photographed|photographing|screenshot|screenshots)\b.{0,80}\bslides?\b|\bslides?\b.{0,80}\b(?:photo|photos|photograph|photographs|photographed|photographing|screenshot|screenshots)\b/i.test(priorQuestion);
  const exactGovernedAction = /\bask (?:the )?prospect to stop\b/i.test(priorAnswer) &&
    /\bslides? (?:are|were) confidential\b/i.test(priorAnswer) &&
    /\b(?:ask (?:them|the prospect) to )?delete\b.{0,50}\b(?:photo|photos|photograph|photographs|screenshot|screenshots)\b/i.test(priorAnswer);
  return exactSubject && exactGovernedAction;
}

export async function runAskSalesFaqV4(
  question: string,
  conversationMessages: AskSalesFaqChatMessage[] = [],
  options: V4RuntimeOptions = {},
): Promise<AskSalesFaqV4Result> {
  const startedAt = Date.now();
  const stageTimings: Record<string, number> = {};
  const attempts: V3ProviderAttempt[] = [];
  const provider = options.provider || generateV4Json;
  const validatorProvider = options.validatorProvider || options.provider || generateV4ValidationJson;
  const redacted = redactSensitiveText(question);
  const redactedMessages = conversationMessages.map((message) => ({ role: message.role, ...redactSensitiveText(message.content) }));
  const messages = redactedMessages.map((message) => ({ role: message.role, content: message.text }));
  const redactions = [...new Set([...redacted.redactions, ...redactedMessages.flatMap((message) => message.redactions)])];
  const turnStarted = Date.now();
  let turn = resolveV4Turn(redacted.text, messages);
  if (
    turn.productScope === "unknown" &&
    /\bISTV\b/i.test(turn.currentQuestion) &&
    !/\b(?:not|excluding|except)\s+(?:main\s+)?ISTV\b/i.test(turn.currentQuestion) &&
    !/\b(?:Daymond John|Next Level CEO|NLCEO|DJ\/NLCEO)\b/i.test(turn.currentQuestion)
  ) {
    turn = {
      ...turn,
      productScope: "main_istv",
      intentResolutionReason: `${turn.intentResolutionReason || "Deterministic turn resolution."} V4 resolved explicit ISTV wording to the main ISTV product scope.`,
    };
  }
  stageTimings.turnResolutionMs = Date.now() - turnStarted;

  const perspectiveOnlyCorrection = isVerifiedSlidePhotoPerspectiveCorrection(turn);
  if (["social", "topic_intro", "memory", "rewrite", "clarification"].includes(turn.kind) || perspectiveOnlyCorrection) {
    const previousAnswer = displayText(turn.immediatePreviousAssistantAnswer || "", 5000);
    const answer = perspectiveOnlyCorrection
      ? `Those are the rep’s actions: ${previousAnswer.replace(/^[A-Z]/, (letter) => letter.toLowerCase())}`
      : deterministicConversation(turn);
    const validation: V4Validation = { verdict: "pass", sentenceChecks: [], removedSentences: [], unresolvedNeedIds: [], reason: "No policy answer was required." };
    const plan: V4AnswerPlan = { needs: [], overall_lane: "conversation", confidence_score: 100, reasoning_summary: "Conversation-only turn." };
    stageTimings.totalMs = Date.now() - startedAt;
    return {
      ok: true,
      answer,
      structuredAnswer: structuredAnswer(answer, "conversation", 100, []),
      lane: "conversation",
      needsRoute: false,
      routeReason: null,
      routeChannels: [],
      provider: null,
      model: null,
      latencyMs: stageTimings.totalMs,
      citations: [],
      selectedPolicyIds: [],
      redactions,
      runtimeMetadata: {
        pipelineVersion: "v4-isolated",
        isolation: { productionSelectorChanged: false, databaseWrites: false, historyPersistence: false },
        knowledgeVersion: getV4KnowledgeVersion(),
        turn,
        retrieval: { corpusSize: 0, candidateCount: 0, candidates: [], blockedTopicIds: [] },
        plan,
        executionMode: { planning: "conversation", composition: "not_required", validation: "not_required" },
        validation,
        providerAttempts: [],
        stageTimings,
      },
    };
  }

  const retrieval = retrieveV4Policies(turn);
  Object.assign(stageTimings, retrieval.stageTimings);
  let providerName: "deepseek" | "anthropic" | null = null;
  let model: string | null = null;
  let plan: V4AnswerPlan;
  let planningMode: "model" | "deterministic_governed" | "deterministic_fallback" = "model";
  const planStarted = Date.now();
  const hasStrictOpenBlocker = retrieval.blocked.some((candidate) =>
    v4BlockedTopicIsStrictlyBound(candidate.topic, v4DecisionQuestion(turn)),
  );
  const governedPlan = hasStrictOpenBlocker ? null : exactGovernedPlan(turn, retrieval);
  if (governedPlan) {
    plan = governedPlan;
    planningMode = "deterministic_governed";
  } else {
    try {
      const planningBlocked = retrieval.blocked.filter((blockedCandidate) =>
        v4BlockedTopicIsStrictlyBound(blockedCandidate.topic, v4DecisionQuestion(turn)) ||
        !retrieval.candidates.some((candidate) =>
          v4PolicyCanSupportNeed(candidate.policy, turn, v4DecisionQuestion(turn)) &&
          v4PolicyDirectlyAddressesNeed(candidate.policy, v4DecisionQuestion(turn)) &&
          v4BlockedTopicMatchesQuestion(blockedCandidate.topic, v4DecisionQuestion(turn)),
        ),
      );
      const prompt = planningPrompt(turn, retrieval.candidates, planningBlocked);
      const result = await provider({ purpose: "v4_atomic_plan", system: prompt.system, user: prompt.user, maxTokens: 2400, parse: (content) => parsePlan(content, retrieval.candidates, retrieval.blocked, turn) });
      plan = result.output;
      attempts.push(...result.attempts);
      providerName = result.provider;
      model = result.model;
    } catch (error) {
      attempts.push(...providerAttemptsFromV4Error(error));
      plan = deterministicPlan(turn, retrieval);
      planningMode = "deterministic_fallback";
      plan.reasoning_summary = `${plan.reasoning_summary} Model planner unavailable: ${clean(error, 180)}`;
    }
  }
  plan = enforceV4QuestionCompleteness(plan, turn, retrieval, planningMode);
  stageTimings.planningMs = Date.now() - planStarted;
  const deterministicWhitelistPlan = planningMode !== "model" && isDeterministicWhitelistPlan(plan, retrieval, turn);

  let composition: V4Composition = { summary: "", sentences: [] };
  let compositionMode: "model" | "exact_evidence" | "not_required" = "not_required";
  if (plan.needs.some((need) => need.lane === "answer")) {
    const compositionStarted = Date.now();
    if (planningMode === "deterministic_governed") {
      composition = exactEvidenceFallback(plan, retrieval.candidates, true);
      compositionMode = "exact_evidence";
    } else {
      try {
        const prompt = compositionPrompt(plan, retrieval.candidates, turn);
        const result = await provider({ purpose: "v4_claim_composition", system: prompt.system, user: prompt.user, maxTokens: 1800, parse: (content) => parseComposition(content, plan, retrieval.candidates) });
        composition = result.output.sentences.length ? result.output : exactEvidenceFallback(plan, retrieval.candidates);
        compositionMode = result.output.sentences.length ? "model" : "exact_evidence";
        attempts.push(...result.attempts);
        providerName = result.provider;
        model = result.model;
      } catch (error) {
        attempts.push(...providerAttemptsFromV4Error(error));
        composition = exactEvidenceFallback(plan, retrieval.candidates);
        compositionMode = "exact_evidence";
      }
    }
    stageTimings.compositionMs = Date.now() - compositionStarted;
  }

  const validationStarted = Date.now();
  const { validation, supportedSentenceIds } = await validateComposition({
    composition,
    plan,
    candidates: retrieval.candidates,
    turn,
    provider: validatorProvider,
    attempts,
    allowModelValidationBypass: deterministicWhitelistPlan && compositionMode === "exact_evidence",
  });
  stageTimings.validationMs = Date.now() - validationStarted;
  const supportedSentences = composition.sentences.filter((sentence) => supportedSentenceIds.has(sentence.id));
  const selectedPolicyIds = [...new Set(supportedSentences.flatMap((sentence) => sentence.evidence_refs))];
  const selectedPolicies = selectedPolicyIds
    .map((id) => retrieval.candidates.find((candidate) => candidate.policy.id === id)?.policy)
    .filter((policy): policy is V3Policy => Boolean(policy));
  const lane = finalLane(plan, validation, supportedSentences.length);
  const unresolvedNeeds = plan.needs.filter((need) => validation.unresolvedNeedIds.includes(need.id));
  const routeRequiredNeeds = unresolvedNeeds.filter((need) => need.lane !== "clarify" || Boolean(need.route_key));
  const routeAssignments = routeRequiredNeeds.map((need) => {
    const needPolicies = need.evidence_refs
      .map((id) => retrieval.candidates.find((candidate) => candidate.policy.id === id)?.policy)
      .filter((policy): policy is V3Policy => Boolean(policy));
    const routeKey = routeKeyFor(`${need.text} ${need.reason}`, needPolicies, [need]);
    return { need, route: routeCatalog[routeKey] || routeCatalog.sales_policy };
  });
  const fallbackRouteKey = routeKeyFor(v4DecisionQuestion(turn), selectedPolicies, []);
  const fallbackRoute = routeCatalog[fallbackRouteKey] || routeCatalog.sales_policy;
  const needsRoute = lane === "route" || lane === "live_lookup" || lane === "artifact" || routeRequiredNeeds.length > 0;
  const routeChannels = needsRoute
    ? [...new Set((routeAssignments.length ? routeAssignments.map((assignment) => assignment.route.channel) : [fallbackRoute.channel]))]
    : [];
  const supportedSentenceLimit = compositionMode === "exact_evidence" ? 4000 : 900;
  const supportedText = supportedSentences
    .map((sentence) => displayText(sentence.text, supportedSentenceLimit))
    .filter(Boolean)
    .map((sentence) => sentence.replace(/^[a-z]/, (letter) => letter.toUpperCase()))
    .map((sentence) => /[.!?](?:["'”’])?$/.test(sentence) ? sentence : `${sentence}.`)
    .join(" ");
  const unresolvedInstructions = (() => {
    const instructions = unresolvedNeeds
      .filter((need) => need.lane === "clarify")
      .map((need) => {
        const clarification = need.clarification_question || `Please clarify: ${displayText(need.text, 240).replace(/[?.!;:]+$/g, "")}`;
        const assignment = routeAssignments.find((candidate) => candidate.need.id === need.id);
        return assignment ? `${clarification.replace(/[.!?]+$/g, "")}. Check ${assignment.route.channel} before replying.` : clarification;
      });
    const grouped = new Map<string, { lane: V4PlannedNeed["lane"]; channel: string; subjects: string[] }>();
    for (const need of unresolvedNeeds.filter((candidate) => candidate.lane !== "clarify")) {
      const route = routeAssignments.find((assignment) => assignment.need.id === need.id)?.route || fallbackRoute;
      const rawSubject = (displayText(need.text, 240) || "that unresolved part").replace(/[?.!;:]+$/g, "");
      const subject = rawSubject
        .replace(/^where can (?:i|we) find\s+/i, "")
        .replace(/^where (?:is|are)\s+/i, "")
        .replace(/^(?:locate|find|get|access|download|request)\s+/i, "")
        .replace(/^(?:confirm|determine|decide|verify|check)\s+/i, "")
        .trim() || "that unresolved part";
      const key = `${need.lane}:${route.channel}`;
      const existing = grouped.get(key) || { lane: need.lane, channel: route.channel, subjects: [] };
      const normalizedSubject = subject.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (!existing.subjects.some((value) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() === normalizedSubject)) {
        existing.subjects.push(subject);
      }
      grouped.set(key, existing);
    }
    for (const group of grouped.values()) {
      const subjects = group.subjects.map((subject) =>
        /^[A-Z][a-z]/.test(subject) ? `${subject.charAt(0).toLowerCase()}${subject.slice(1)}` : subject,
      );
      const joined = subjects.length <= 1
        ? subjects[0] || "that unresolved part"
        : subjects.map((subject, index) => index === subjects.length - 1 ? `and ${subject}` : subject).join("; ");
      if (group.lane === "live_lookup") {
        instructions.push(`A current live lookup is required for ${joined}; please check ${group.channel} for the latest status.`);
      } else if (group.lane === "artifact") {
        instructions.push(`Request the current controlled resource or file for ${joined} from ${group.channel}.`);
      } else {
        const unresolved = `${joined.charAt(0).toUpperCase()}${joined.slice(1)}`.replace(/[.!?;:]+$/g, "");
        instructions.push(`Check ${group.channel} before replying. Unresolved: ${unresolved}.`);
      }
    }
    return instructions;
  })();
  const unresolvedAnswer = unresolvedInstructions.length ? unresolvedInstructions.join(" ") : safeRouteAnswer(fallbackRoute.channel);
  const answer = lane === "answer"
    ? supportedText
    : lane === "partial"
      ? [supportedText, unresolvedAnswer].filter(Boolean).join(" ")
      : unresolvedAnswer;
  const confidence = lane === "answer" ? plan.confidence_score : lane === "partial" ? Math.min(plan.confidence_score, 79) : lane === "conversation" ? 100 : Math.min(plan.confidence_score, 49);
  stageTimings.totalMs = Date.now() - startedAt;

  return {
    ok: true,
    answer: displayText(answer, 5000),
    structuredAnswer: structuredAnswer(displayText(answer, 5000), lane, confidence, routeChannels),
    lane,
    needsRoute,
    routeReason: needsRoute ? `Verify only the unresolved need${routeChannels.length > 1 ? "s" : ""} in ${routeChannels.join(" or ")}.` : null,
    routeChannels,
    provider: providerName,
    model,
    latencyMs: stageTimings.totalMs,
    citations: selectedPolicies.map((policy) => ({
      policyId: policy.id,
      title: policy.title,
      decisionKey: policy.decision_key,
      lastReviewed: policy.last_reviewed,
      authority: policy.authority,
      sourceKind: policy.source.kind,
      approvedBy: policy.source.approved_by,
    })),
    selectedPolicyIds,
    redactions,
    runtimeMetadata: {
      pipelineVersion: "v4-isolated",
      isolation: { productionSelectorChanged: false, databaseWrites: false, historyPersistence: false },
      knowledgeVersion: getV4KnowledgeVersion(),
      turn,
      retrieval: {
        corpusSize: retrieval.corpusSize,
        candidateCount: retrieval.candidates.length,
        candidates: retrieval.candidates.map((candidate) => ({
          id: candidate.policy.id,
          rank: candidate.rank,
          score: candidate.score,
          decisionKey: candidate.policy.decision_key,
          answerability: candidate.policy.answerability,
          qualityTier: candidate.policy.quality_tier,
          productScopes: candidate.policy.product_scopes,
        })),
        blockedTopicIds: retrieval.blocked.map((candidate) => candidate.topic.id),
      },
      plan,
      executionMode: {
        planning: planningMode,
        composition: compositionMode,
        validation: compositionMode === "not_required"
          ? "not_required"
          : deterministicWhitelistPlan && compositionMode === "exact_evidence"
            ? "deterministic_exact_evidence"
            : "model_and_deterministic",
      },
      validation,
      providerAttempts: attempts,
      stageTimings,
    },
  };
}

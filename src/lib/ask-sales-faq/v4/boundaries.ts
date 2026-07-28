import type { V3BlockedTopic, V3Policy, V3ProductScope, V3TurnResolution } from "@/lib/ask-sales-faq/v3/types";

function normalized(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

export function v4PolicyBoundaryErrors(policy: V3Policy, turn: V3TurnResolution) {
  const errors: string[] = [];
  const rawQuestion = turn.standaloneQuestion.toLowerCase();
  const question = normalized(turn.standaloneQuestion);
  const evidence = normalized(`${policy.title} ${policy.question_families.join(" ")} ${policy.decision}`);

  if (turn.excludedScopes.some((scope) => policy.product_scopes.includes(scope))) {
    errors.push("policy belongs to an explicitly excluded product scope");
  }
  if (
    turn.productScope !== "unknown" &&
    turn.productScope !== "comparison" &&
    !policy.product_scopes.includes(turn.productScope) &&
    !policy.product_scopes.includes("product_agnostic")
  ) {
    errors.push("policy does not apply to the resolved product scope");
  }

  const asksWatchability = /\b(?:watch|watchable|stream|streaming|on air|aired|airing|live episode|where can .* see|available to view)\b/.test(question);
  const onlyCatalogMembership = /\b(?:show list|catalog|active show|listed show|show roster)\b/.test(evidence) &&
    !/\b(?:watch|watchable|stream|on air|aired|airing|available to view)\b/.test(evidence);
  if (asksWatchability && onlyCatalogMembership) errors.push("catalog membership does not prove public watchability");

  const explicitMoneyAmounts = rawQuestion.match(/\$\s*\d+(?:\.\d+)?\s*k?\b/g) || [];
  const proposesDistinctAmountsAndTiming = explicitMoneyAmounts.length >= 2 &&
    /\b(?:first|remaining|balance|later|weeks?|months?|contract|split)\b/.test(question);
  const asksCustomSplit = /\b(?:custom|unlisted|off menu|different split|make up|invent|exception)\b/.test(question) || proposesDistinctAmountsAndTiming;
  const asksOnlyInstallments = /\b(?:down|deposit|installment|instalment|monthly|pay .* now|remaining|balance)\b/.test(question) && !asksCustomSplit;
  const customSplitBoundary = /\b(?:custom|unlisted|off menu|invent).*\b(?:split|plan|installment|payment)\b/.test(evidence);
  if (asksOnlyInstallments && customSplitBoundary) errors.push("a single total divided into installments is not automatically a custom split request");

  const bankruptcyPolicy = /\bbankrupt/.test(evidence);
  if (bankruptcyPolicy && !/\bbankrupt/.test(question)) errors.push("bankruptcy condition is not present in the question");

  const exclusivityPolicy = /\bexclusive|exclusivity\b/.test(evidence);
  if (exclusivityPolicy && !/\bexclusive|exclusivity|other show|another show|competing show\b/.test(question)) {
    errors.push("exclusivity condition is not present in the question");
  }

  const resourceOnly = policy.answerability === "route_or_support" || /\b(?:download|pdf|deck|document|script|resource|template|link)\b/.test(evidence);
  const asksSubstantiveDecision = /\b(?:can|should|allowed|eligible|qualify|price|cost|refund|guarantee|right|own|must)\b/.test(question);
  if (resourceOnly && asksSubstantiveDecision && policy.answerability !== "answer_evidence") {
    errors.push("route or resource evidence cannot authorize a substantive decision");
  }

  return errors;
}

export function v4PolicyCanAnswer(policy: V3Policy, turn: V3TurnResolution) {
  return policy.answerability === "answer_evidence" && v4PolicyBoundaryErrors(policy, turn).length === 0;
}

const BLOCKED_MATCH_STOP_WORDS = new Set([
  "a", "about", "after", "an", "and", "are", "as", "at", "be", "before", "both", "but", "by", "can", "could", "current", "currently", "do", "does",
  "already", "exact", "for", "from", "has", "have", "how", "if", "in", "is", "it", "latest", "new", "no", "not", "of", "on", "open", "or", "our", "reps", "rep",
  "should", "status", "still", "that", "the", "their", "them", "they", "this", "to", "today", "use", "was", "what", "when", "where", "which", "who", "with", "would", "you",
]);

// Product words establish scope; they are not specific decision-object evidence.
const PRODUCT_SCOPE_WORDS = new Set([
  "ceo", "daymond", "dj", "istv", "john", "level", "main", "next", "nlceo", "product", "products",
]);

// These words are useful for intent classification but are too broad to prove
// that a need addresses the exact unresolved decision.
const GENERIC_DECISION_WORDS = new Set([
  "active", "agreement", "agreements", "allowed", "answer", "applicant", "applicants", "approval", "approved", "available", "availability", "book", "booking", "business", "call", "call1", "call2", "calls",
  "case", "casting", "client", "clients", "company", "contract", "contracts", "decision", "deadline", "discount", "discounts", "episode", "episodes", "explain",
  "film", "filming", "guidance", "lead", "leads", "license", "licenses", "list", "offer", "offers", "package", "packages", "payment", "payments", "policy", "price", "pricing",
  "process", "produce", "production", "program", "promise", "prospect", "prospects", "question", "review", "reviewed", "reviewing", "reviews", "route", "sale", "sales", "show", "shows", "studio", "time", "timing", "verify", "vip",
]);

const ACTION_PATTERNS: Array<[string, RegExp]> = [
  ["qualify", /\b(?:qualif(?:y|ies|ied|ication)|eligib(?:le|ility)|fit|disqualif(?:y|ies|ied))\b/],
  ["price", /\b(?:price|prices|pricing|cost|costs|discount|discounted|half[ -]?off|offer|offers|package|packages)\b|\b\d+(?:percent)?\s*off\b/],
  ["pay", /\b(?:pay|paid|payment|payments|deposit|installments?|instalments?|pif|finance|funds?)\b/],
  ["refund_or_cancel", /\b(?:refund|refundable|cancel|cancellation|chargeback)\b/],
  ["hold_or_pause", /\b(?:hold|holding|pause|paused|spot)\b/],
  ["verify", /\b(?:verify|confirm|current|currently|latest|status|available|availability|still)\b/],
  ["promise", /\b(?:promise|promised|guarantee|guaranteed|commit|committed)\b/],
  ["use_or_promote", /\b(?:use|sell|selling|promote|promotion|offer|include|upgrade)\b/],
  ["schedule", /\b(?:schedule|scheduled|book|booking|calendar|filming date|studio time)\b/],
  ["reschedule", /\b(?:reschedule|rescheduling|rebook|rebooking|move .*\bcall)\b/],
  ["produce", /\b(?:produce|production|film|filming|episode|delivery)\b/],
  ["sign", /\b(?:sign|signed|signature|contract|agreement|addendum)\b/],
  ["send", /\b(?:send|sent|share|provide|deliver)\b/],
  ["contact", /\b(?:contact|message|call|dm|reach)\b/],
  ["report", /\b(?:report|post|submit|submission|stats?|notes?|sheet|keap)\b/],
  ["route", /\b(?:route|escalate|channel|owner|support|hotline)\b/],
  ["troubleshoot", /\b(?:troubleshoot|issue|problem|broken|error|ticket)\b/],
  ["reapply", /\b(?:reapply|reapplication|apply again|return)\b/],
  ["record", /\b(?:record|recorded|recording)\b/],
  ["invite_or_attend", /\b(?:invite|invitation|attend|attendance|mastermind|event)\b/],
  ["onboard", /\b(?:onboard|onboarding|new rep|training)\b/],
  ["access", /\b(?:access|download|watch|watchable|view|viewing|audio description|accommodation)\b/],
  ["explain", /\b(?:explain|tell|say|wording|describe)\b/],
];

const DOMAIN_PATTERNS: Array<[string, RegExp]> = [
  ["qualification", /\b(?:qualif|eligible|eligibility|fit|applicant|criminal|bankrupt|background)\w*\b/],
  ["pricing", /\b(?:price|pricing|cost|discount|offer|package)\w*\b/],
  ["payments", /\b(?:pay|payment|deposit|installment|instalment|pif|refund|funds?)\w*\b/],
  ["shows_offers", /\b(?:show|series|offer|package|casting|episode)\w*\b/],
  ["production", /\b(?:production|film|filming|episode|media pack|delivery)\w*\b/],
  ["content_rights", /\b(?:contract|license|rights?|agreement|promotion|media)\w*\b/],
  ["scheduling", /\b(?:schedule|reschedule|book|booking|calendar|deadline|cutoff)\w*\b/],
  ["communications", /\b(?:send|contact|message|email|text|wording|channel)\w*\b/],
  ["sales_tech", /\b(?:keap|sheet|slack|tech|ticket|calendar|form)\w*\b/],
  ["onboarding", /\b(?:onboard|onboarding|new rep|training)\w*\b/],
];

function matchText(value: string) {
  return value.toLowerCase()
    .replace(/call\s*1\b/g, " call1 ")
    .replace(/call\s*2\b/g, " call2 ")
    .replace(/ceo\s+day\b/g, " ceoday ")
    .replace(/same[ -]?day\b/g, " sameday ")
    .replace(/(\d+(?:\.\d+)?)\s*%/g, "$1percent")
    .replace(/(\d),(?=\d{3}\b)/g, "$1")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function classifiedTerms(value: string, patterns: Array<[string, RegExp]>) {
  const text = matchText(value);
  return patterns.flatMap(([term, pattern]) => pattern.test(text) ? [term] : []);
}

function materialTokens(value: string) {
  return [...new Set(matchText(value).split(" ").filter((token) =>
    (token.length > 2 || /^\d+(?:percent)?$/.test(token)) &&
    !BLOCKED_MATCH_STOP_WORDS.has(token) &&
    !PRODUCT_SCOPE_WORDS.has(token) &&
    !GENERIC_DECISION_WORDS.has(token),
  ))];
}

function identifierTokens(values: string[]) {
  return materialTokens(values.join(" "));
}

function intersection(left: string[], right: string[]) {
  const rightSet = new Set(right);
  return left.filter((value) => rightSet.has(value));
}

function canonicalQuestionFamilyMatch(topic: V3BlockedTopic, needText: string) {
  const needNormalized = matchText(needText);
  return Boolean(needNormalized) && (topic.question_families || []).some((family) => needNormalized === matchText(family));
}

function explicitlyNegatesSubject(needText: string, subject: RegExp) {
  return new RegExp(`\\b(?:not|never|without)\\b.{0,45}${subject.source}`, "i").test(needText) ||
    new RegExp(`\\b(?:not asking|do not need|don't need|isn't about|is not about)\\b.{0,70}${subject.source}`, "i").test(needText);
}

function legacyBlockedTopicAnchor(topic: V3BlockedTopic, needText: string) {
  switch (topic.id) {
    case "bankruptcy-qualification":
      return /\bbankrupt(?:cy)?\b/i.test(needText) &&
        /\b(?:qualif|eligible|eligibility|disqualif|approve|advance|move to call\s*2)\w*\b/i.test(needText) &&
        !/\bbankruptcy\s+(?:law|lawyer|attorney|firm|practice)\b/i.test(needText) &&
        !explicitlyNegatesSubject(needText, /\bbankrupt(?:cy)?\b/);
    case "dual-product-opportunity-ownership":
      return /\b(?:main\s+istv|inside success tv|istv)\b/i.test(needText) &&
        /\b(?:daymond john|next level ceo|nlceo|dj)\b/i.test(needText) &&
        /\b(?:who owns|which rep|pass(?:ed)? off|hand(?:ed)? off|handoff|who handles?|ownership|assigned)\b/i.test(needText) &&
        !/\b(?:not|excluding|except|rather than|instead of)\b.{0,40}\b(?:main\s+istv|inside success tv|istv|daymond john|next level ceo|nlceo|dj)\b/i.test(needText);
    case "accessibility-accommodations":
      return /\b(?:audio descriptions?|accessibility accommodations?)\b/i.test(needText) &&
        /\b(?:available|provide|support|offer|promise|can|could|do|does|include|guarantee)\b/i.test(needText) &&
        !explicitlyNegatesSubject(needText, /\b(?:audio descriptions?|accessibility accommodations?)\b/);
    case "blocked_5bd0a1e1f41418c9":
      return /\b(?:mention|say|tell|disclose|discuss|quote)\b/i.test(needText) &&
        /\b(?:minimum investment|budget|price|pricing)\b/i.test(needText) &&
        /\b(?:call\s*1|first call|vetting|vet)\b/i.test(needText) &&
        !/\b(?:not asking|do not need|don't need|isn't about|is not about)\b.{0,90}\b(?:minimum investment|budget|price|pricing)\b/i.test(needText);
    case "blocked_65d2e70d14703b7e": {
      const hasVeteranPartner = /\b(?:business\s+)?partner\b.{0,45}\bveteran\b|\bveteran\b.{0,45}\b(?:business\s+)?partner\b/i.test(needText);
      const negatesVeteranPartner = /\bwithout\b.{0,45}\b(?:veteran\b.{0,25}\b(?:business\s+)?partner|(?:business\s+)?partner\b.{0,25}\bveteran)\b/i.test(needText) ||
        /\b(?:business\s+)?partner\b.{0,35}\b(?:is|was|who\s+is|who\s+was)\s+not\s+(?:a\s+)?veteran\b/i.test(needText) ||
        /\b(?:not asking|do not need|don't need|isn't about|is not about)\b.{0,90}\b(?:veteran\b.{0,25}\b(?:business\s+)?partner|(?:business\s+)?partner\b.{0,25}\bveteran)\b/i.test(needText);
      return /\boperation\s+ceo\b/i.test(needText) &&
        /\b(?:non[-\s]?veteran|not\s+(?:a\s+)?veteran)\b/i.test(needText) &&
        hasVeteranPartner &&
        /\b(?:audition\w*|qualif\w*|eligib\w*|appl(?:y|ies|ied|ication)|greenlight\w*)\b/i.test(needText) &&
        !explicitlyNegatesSubject(needText, /\boperation\s+ceo\b/) &&
        !negatesVeteranPartner;
    }
    case "blocked_0b56158b1d22eb99":
      return /\b60\s+day\s+hustle\b/i.test(needText) &&
        /\b(?:conflict|competing|participat\w*|taking part|cast(?:ing)?|allowed|eligible)\b/i.test(needText) &&
        !explicitlyNegatesSubject(needText, /\b60\s+day\s+hustle\b/);
    case "blocked_6d6852cffbebeb4e":
      return /\b(?:speaking promotion|speaker promotion|company speaking)\b/i.test(needText) &&
        /\b(?:conflict|prior|previous|involvement|participat\w*|cast(?:ing)?|allowed|eligible)\b/i.test(needText) &&
        !explicitlyNegatesSubject(needText, /\b(?:speaking promotion|speaker promotion|company speaking)\b/);
    case "blocked_1350b414e9d4ba38":
      return /(?:\b20\s*%|\btwenty percent\b)/i.test(needText) &&
        /\b(?:post[- ]call|after (?:the )?call)\b.{0,60}\b(?:notes?|report\w*|spreadsheet|sheet|keap)\b|\b(?:notes?|report\w*|spreadsheet|sheet|keap)\b.{0,60}\b(?:post[- ]call|after (?:the )?call)\b/i.test(needText) &&
        !/\b(?:email|text|sms|template|wording)\b/i.test(needText);
    case "blocked_6522ba21e9d254b6":
      return /\bcalendar\b/i.test(needText) &&
        /\b(?:book|booking|rebook|rebooking|reschedule|rescheduling|calendar setup|which calendar)\b/i.test(needText) &&
        !/\b(?:show name|client's show|client’s show|which show)\b/i.test(needText) &&
        !(/\b(?:dial[- ]out|20\s*%|twenty percent)\b/i.test(needText) &&
          /\b(?:another|other|original)\s+rep\b/i.test(needText) &&
          /\b(?:no[- ]?show(?:ed)?|previously claimed|claimed|rebook|contact)\b/i.test(needText)) &&
        !(/\b(?:public calendar|oncehub)\b/i.test(needText) &&
          /\b(?:outside|next week|later|within|only allows?|unavailable|available)\b/i.test(needText));
    default:
      return false;
  }
}

const LEGACY_ANCHOR_ONLY_TOPIC_IDS = new Set([
  "bankruptcy-qualification",
  "dual-product-opportunity-ownership",
  "accessibility-accommodations",
  "blocked_0b56158b1d22eb99",
  "blocked_6d6852cffbebeb4e",
  "blocked_1350b414e9d4ba38",
  "blocked_6522ba21e9d254b6",
]);

function inferredScope(value: string): V3ProductScope {
  const text = matchText(value);
  const main = /\b(?:main istv|inside success tv|america s (?:best doctors|top lawyers|top trainers|top agents|authors)|operation ceo|mompreneurs|kingdom creators)\b/.test(text);
  const dj = /\b(?:daymond john|next level ceo|nlceo|dj)\b/.test(text);
  const crossPair = dj && /\bistv\b/.test(text);
  return (main && dj) || crossPair ? "comparison" : main ? "main_istv" : dj ? "dj_nlceo" : "unknown";
}

function scopeIsCompatible(
  topic: V3BlockedTopic,
  needText: string,
  options: { productScope?: V3ProductScope; excludedScopes?: Array<"main_istv" | "dj_nlceo"> },
) {
  const topicScopes = topic.product_scopes || [];
  if (options.excludedScopes?.some((scope) => topicScopes.includes(scope))) return false;
  const textScope = inferredScope(needText);
  const needScope = textScope === "comparison"
    ? textScope
    : options.productScope && options.productScope !== "unknown"
      ? options.productScope
      : textScope;
  const topicScope = inferredScope(topicText(topic));
  // A crossover conflict is not a generic rule for either product on its own.
  // Require the need itself to establish both products before such a blocker
  // can suppress otherwise applicable single-product guidance.
  if (topicScope === "comparison" && needScope !== "comparison") return false;
  if (needScope === "unknown" || needScope === "comparison" || !topicScopes.length || topicScopes.includes("product_agnostic")) return true;
  return topicScopes.includes(needScope);
}

function topicText(topic: V3BlockedTopic) {
  return [
    topic.id,
    topic.resolution || "",
    ...(topic.blocked_topic_ids || []),
    ...(topic.question_families || []),
    ...(topic.entities || []),
  ].join(" ");
}

export type V4BlockedTopicDecisionMatch = {
  matches: boolean;
  matchKind: "none" | "canonical_family" | "legacy_anchor" | "structured";
  score: number;
  scopeCompatible: boolean;
  matchedActions: string[];
  matchedDomains: string[];
  matchedSubjects: string[];
  reason: string;
};

export function v4BlockedTopicDecisionMatch(
  topic: V3BlockedTopic,
  needText: string,
  options: { productScope?: V3ProductScope; excludedScopes?: Array<"main_istv" | "dj_nlceo"> } = {},
): V4BlockedTopicDecisionMatch {
  const scopeCompatible = scopeIsCompatible(topic, needText, options);
  if (!scopeCompatible) {
    return { matches: false, matchKind: "none", score: 0, scopeCompatible, matchedActions: [], matchedDomains: [], matchedSubjects: [], reason: "Product scopes are incompatible." };
  }

  const canonicalMatch = canonicalQuestionFamilyMatch(topic, needText);
  const legacyAnchorMatch = !canonicalMatch && legacyBlockedTopicAnchor(topic, needText);
  if (canonicalMatch || legacyAnchorMatch) {
    const searchableTopic = topicText(topic);
    const matchedActions = intersection(
      [...new Set([...(topic.actions || []), ...classifiedTerms(searchableTopic, ACTION_PATTERNS)])],
      classifiedTerms(needText, ACTION_PATTERNS),
    );
    const matchedDomains = intersection(
      [...new Set([...(topic.domains || []), ...classifiedTerms(searchableTopic, DOMAIN_PATTERNS)])],
      classifiedTerms(needText, DOMAIN_PATTERNS),
    );
    const matchedSubjects = intersection(materialTokens(searchableTopic), materialTokens(needText));
    return {
      matches: true,
      matchKind: canonicalMatch ? "canonical_family" : "legacy_anchor",
      score: 20,
      scopeCompatible,
      matchedActions,
      matchedDomains,
      matchedSubjects,
      reason: canonicalMatch
        ? "The request exactly matches a canonical unresolved decision family."
        : "The request matches a narrowly reviewed legacy unresolved-decision anchor.",
    };
  }

  // These legacy gaps have no canonical question families. Their reviewed
  // anchors are the entire safe matching surface; generic token overlap must
  // not turn nearby topics (captions, bankruptcy-law work, ordinary pricing)
  // into unresolved-governance routes.
  if (LEGACY_ANCHOR_ONLY_TOPIC_IDS.has(topic.id)) {
    return {
      matches: false,
      matchKind: "none",
      score: 0,
      scopeCompatible,
      matchedActions: [],
      matchedDomains: [],
      matchedSubjects: [],
      reason: "The request does not match the reviewed legacy unresolved-decision anchor.",
    };
  }

  const searchableTopic = topicText(topic);
  const topicActions = [...new Set([...(topic.actions || []), ...classifiedTerms(searchableTopic, ACTION_PATTERNS)])];
  const needActions = classifiedTerms(needText, ACTION_PATTERNS);
  const matchedActions = intersection(topicActions, needActions);
  const topicDomains = [...new Set([...(topic.domains || []), ...classifiedTerms(searchableTopic, DOMAIN_PATTERNS)])];
  const needDomains = classifiedTerms(needText, DOMAIN_PATTERNS);
  const matchedDomains = intersection(topicDomains, needDomains);

  const structuredTerms = [...topicActions, ...topicDomains].flatMap((value) => identifierTokens([value]));
  const structuredSet = new Set(structuredTerms);
  const topicSubjects = materialTokens(searchableTopic).filter((token) => !structuredSet.has(token));
  const needSubjects = materialTokens(needText);
  const matchedSubjects = intersection(topicSubjects, needSubjects);
  const specificMatchedSubjects = matchedSubjects.filter((token) => !/^\d+(?:\.\d+)?$/.test(token));
  const strongSubject = specificMatchedSubjects.some((token) =>
    token.length >= 7 || ["dui", "pif", "cap", "vip", "call1", "call2"].includes(token),
  );
  const hasSpecificSubject = specificMatchedSubjects.length >= 2 || strongSubject;
  const hasDecisionIntent = matchedActions.length > 0 && (matchedDomains.length > 0 || topicDomains.length === 0 || needDomains.length === 0);
  const matches = hasDecisionIntent && hasSpecificSubject;
  const score = matches
    ? Math.min(20, matchedActions.length * 4 + matchedDomains.length * 2 + specificMatchedSubjects.length * 3 + (strongSubject ? 2 : 0))
    : 0;
  const reason = !matchedActions.length
    ? "No matching action or decision intent was found."
    : !hasSpecificSubject
      ? "The overlap is broad wording without a specific subject or object anchor."
      : !hasDecisionIntent
        ? "The policy domains do not support the same decision."
        : "Compatible scope, action, and specific decision subject all match.";
  return { matches, matchKind: matches ? "structured" : "none", score, scopeCompatible, matchedActions, matchedDomains, matchedSubjects, reason };
}

export function v4BlockedTopicMatchesNeed(topic: V3BlockedTopic, needText: string) {
  return v4BlockedTopicDecisionMatch(topic, needText).matches;
}

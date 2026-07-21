import type { V3BlockedTopic, V3Policy, V3ProductScope, V3TurnResolution } from "@/lib/ask-sales-faq/v3/types";

function normalized(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

export function v4PolicyBoundaryErrors(policy: V3Policy, turn: V3TurnResolution) {
  const errors: string[] = [];
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

  const asksCustomSplit = /\b(?:custom|unlisted|off menu|different split|make up|invent|exception)\b/.test(question);
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
  "exact", "for", "from", "has", "have", "how", "if", "in", "is", "it", "latest", "new", "no", "not", "of", "on", "open", "or", "our", "reps", "rep",
  "should", "status", "that", "the", "their", "this", "to", "today", "use", "was", "what", "when", "where", "which", "who", "with", "would", "you",
]);

// Product words establish scope; they are not specific decision-object evidence.
const PRODUCT_SCOPE_WORDS = new Set([
  "ceo", "daymond", "dj", "istv", "john", "level", "main", "next", "nlceo", "product", "products",
]);

// These words are useful for intent classification but are too broad to prove
// that a need addresses the exact unresolved decision.
const GENERIC_DECISION_WORDS = new Set([
  "active", "agreement", "agreements", "allowed", "answer", "applicant", "applicants", "approval", "approved", "available", "availability", "business", "call", "call1", "call2", "calls",
  "case", "casting", "client", "clients", "company", "contract", "contracts", "decision", "deadline", "discount", "discounts", "episode", "episodes", "explain",
  "guidance", "lead", "leads", "license", "licenses", "list", "offer", "offers", "package", "packages", "payment", "payments", "policy", "price", "pricing",
  "process", "program", "promise", "prospect", "prospects", "question", "review", "reviewed", "reviewing", "reviews", "route", "sale", "sales", "show", "shows", "timing", "verify", "vip",
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
  ["record", /\b(?:record|recorded|recording|notes?)\b/],
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

function inferredScope(value: string): V3ProductScope {
  const text = matchText(value);
  const main = /\b(?:main istv|inside success tv|america s (?:best doctors|top lawyers|top trainers|top agents|authors)|operation ceo|mompreneurs|kingdom creators)\b/.test(text);
  const dj = /\b(?:daymond john|next level ceo|nlceo|dj)\b/.test(text);
  return main && dj ? "comparison" : main ? "main_istv" : dj ? "dj_nlceo" : "unknown";
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
    return { matches: false, score: 0, scopeCompatible, matchedActions: [], matchedDomains: [], matchedSubjects: [], reason: "Product scopes are incompatible." };
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
  const strongSubject = matchedSubjects.some((token) =>
    token.length >= 7 || /^\d+(?:percent)?$/.test(token) || ["dui", "pif", "cap", "vip", "call1", "call2"].includes(token),
  );
  const hasSpecificSubject = matchedSubjects.length >= 2 || strongSubject;
  const hasDecisionIntent = matchedActions.length > 0 && (matchedDomains.length > 0 || topicDomains.length === 0 || needDomains.length === 0);
  const matches = hasDecisionIntent && hasSpecificSubject;
  const score = matches
    ? Math.min(20, matchedActions.length * 4 + matchedDomains.length * 2 + matchedSubjects.length * 3 + (strongSubject ? 2 : 0))
    : 0;
  const reason = !matchedActions.length
    ? "No matching action or decision intent was found."
    : !hasSpecificSubject
      ? "The overlap is broad wording without a specific subject or object anchor."
      : !hasDecisionIntent
        ? "The policy domains do not support the same decision."
        : "Compatible scope, action, and specific decision subject all match.";
  return { matches, score, scopeCompatible, matchedActions, matchedDomains, matchedSubjects, reason };
}

export function v4BlockedTopicMatchesNeed(topic: V3BlockedTopic, needText: string) {
  return v4BlockedTopicDecisionMatch(topic, needText).matches;
}

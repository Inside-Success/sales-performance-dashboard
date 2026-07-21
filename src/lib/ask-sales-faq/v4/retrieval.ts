import { getV4BlockedTopics, getV4Corpus, policyEvidenceText } from "@/lib/ask-sales-faq/v4/corpus";
import { v4BlockedTopicDecisionMatch } from "@/lib/ask-sales-faq/v4/boundaries";
import type { V4BlockedCandidate, V4Candidate, V4RetrievalResult } from "@/lib/ask-sales-faq/v4/types";
import type { V3Policy, V3TurnResolution } from "@/lib/ask-sales-faq/v3/types";

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "but", "by", "can", "could", "did", "do", "does", "for", "from", "had", "has",
  "have", "how", "i", "if", "in", "is", "it", "me", "my", "of", "on", "or", "our", "should", "so", "that", "the", "their", "them", "then",
  "there", "these", "they", "this", "those", "to", "us", "was", "we", "were", "what", "when", "where", "which", "who", "why", "will", "with",
  "would", "you", "your",
]);

const CONCEPTS: string[][] = [
  ["price", "pricing", "cost", "package", "offer", "fee"],
  ["payment", "installment", "instalment", "plan", "split", "deposit", "finance"],
  ["refund", "cancel", "cancellation", "chargeback", "moneyback"],
  ["qualify", "qualification", "eligible", "eligibility", "fit", "audition", "applicant"],
  ["apple", "amazon", "roku", "platform", "tier1", "placement", "distribution"],
  ["license", "rights", "reuse", "ownership", "content", "footage", "media"],
  ["guarantee", "promise", "claim", "proof", "compliance"],
  ["text", "sms", "message", "zoomphone", "phone"],
  ["contract", "agreement", "signature", "sign", "edit", "redline"],
  ["franchise", "franchisee", "franchisor"],
  ["nonprofit", "charity", "foundation"],
  ["doctor", "physician", "hospital", "practice"],
  ["lawyer", "attorney", "legal", "firm"],
  ["current", "active", "latest", "today", "now"],
  ["show", "series", "program", "episode"],
  ["recording", "recorded", "zoom", "call"],
  ["commercial", "business", "company", "brand"],
  ["email", "mail", "inbox"],
  ["link", "url", "checkout"],
  ["cohort", "deadline", "greenlight", "reschedule"],
];

function normalize(value: string) {
  return value.toLowerCase()
    .replace(/next\s+level\s+ceo/g, " nlceo ")
    .replace(/daymond\s+john/g, " dj ")
    .replace(/tier[\s-]*1/g, " tier1 ")
    .replace(/zoom\s+phone/g, " zoomphone ")
    .replace(/[^a-z0-9$%]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stem(token: string) {
  if (token.length <= 4) return token;
  return token
    .replace(/ies$/, "y")
    .replace(/(?:ing|ers|er|ed|es|s)$/, "")
    .replace(/(?:tion|ment)$/, "");
}

const CONCEPT_BY_TOKEN = new Map<string, string[]>();
for (const group of CONCEPTS) {
  for (const token of group) CONCEPT_BY_TOKEN.set(stem(token), group);
}

function tokens(value: string) {
  return normalize(value).split(" ").filter((token) => token.length > 1 && !STOP_WORDS.has(token)).map(stem);
}

function expandTokens(input: string[]) {
  const expanded = new Set(input);
  for (const token of input) {
    const group = CONCEPT_BY_TOKEN.get(token);
    if (group) for (const member of group) expanded.add(stem(member));
  }
  return [...expanded];
}

function trigrams(value: string) {
  const text = `  ${normalize(value)}  `;
  const output = new Set<string>();
  for (let index = 0; index <= text.length - 3; index += 1) output.add(text.slice(index, index + 3));
  return output;
}

function jaccard(left: Set<string>, right: Set<string>) {
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const item of left) if (right.has(item)) overlap += 1;
  return overlap / (left.size + right.size - overlap);
}

function tokenOverlap(query: string[], document: string[]) {
  if (!query.length || !document.length) return { score: 0, matched: [] as string[] };
  const documentSet = new Set(document);
  const matched = [...new Set(query.filter((token) => documentSet.has(token)))];
  return { score: matched.length / Math.sqrt(query.length * Math.max(1, new Set(document).size)), matched };
}

function bm25(query: string[], document: string[], documentFrequency: Map<string, number>, documentCount: number, averageLength: number) {
  if (!query.length || !document.length) return 0;
  const termFrequency = new Map<string, number>();
  for (const token of document) termFrequency.set(token, (termFrequency.get(token) || 0) + 1);
  const k1 = 1.2;
  const b = 0.75;
  let score = 0;
  for (const token of new Set(query)) {
    const frequency = termFrequency.get(token) || 0;
    if (!frequency) continue;
    const frequencyInDocuments = documentFrequency.get(token) || 0;
    const idf = Math.log(1 + (documentCount - frequencyInDocuments + 0.5) / (frequencyInDocuments + 0.5));
    score += idf * ((frequency * (k1 + 1)) / (frequency + k1 * (1 - b + b * (document.length / Math.max(1, averageLength)))));
  }
  return score;
}

function scopeScore(policy: V3Policy, turn: V3TurnResolution) {
  if (turn.excludedScopes.some((scope) => policy.product_scopes.includes(scope))) return -10;
  if (turn.productScope === "unknown") return policy.product_scopes.includes("product_agnostic") ? 0.5 : 0;
  if (turn.productScope === "comparison") {
    return policy.product_scopes.includes("main_istv") || policy.product_scopes.includes("dj_nlceo") ? 1 : 0;
  }
  if (policy.product_scopes.includes(turn.productScope)) return 2;
  if (policy.product_scopes.includes("product_agnostic")) return 0.75;
  return -2;
}

function qualityBoost(policy: V3Policy) {
  const quality = policy.quality_tier === "canonical" ? 1.4 : policy.quality_tier === "trusted_evidence" ? 0.9 : policy.quality_tier === "supporting" ? 0.5 : 0.1;
  const answerability = policy.answerability === "answer_evidence" ? 1 : policy.answerability === "route_or_support" ? 0.15 : -2;
  return quality + answerability + Math.min(1.2, Math.max(0, policy.authority - 80) / 30);
}

function queryCoverageSignal(policy: V3Policy, query: string, turn: V3TurnResolution) {
  const normalizedQuery = normalize(query);
  const evidence = policyEvidenceText(policy).toLowerCase();
  let score = 0;
  if (/\b(?:prices?|pricing|costs?)\b/.test(normalizedQuery) && (evidence.match(/\$\s*\d/g) || []).length >= 2) score += 4;
  if (/\b(?:payment plans?|installments?|instalments?)\b/.test(normalizedQuery) && /\b(?:payment plans?|listed plans?|installments?|instalments?)\b|\$\s*[\d,.]+\s*x\s*\d/i.test(evidence)) score += 4;
  if (/\b(?:doctor|physician|\bmd\b)\b/.test(normalizedQuery) && /\b(?:doctor|physician)\b/i.test(evidence)) score += 2;
  if (/\b(?:nurse|\brn\b)\b/.test(normalizedQuery) && /\bnurse\b/i.test(evidence)) score += 2;
  if (/\b(?:watch|watchable|stream|on air|aired|airing)\b/.test(normalizedQuery) && /\b(?:watch|watchable|stream|on air|aired|airing|episode availability)\b/i.test(evidence)) score += 3;
  if (/\b(?:tier1|apple tv|amazon prime|tubi|platform)\b/.test(normalizedQuery) && /\b(?:tier[ -]?1|apple tv|amazon prime|tubi|platform)\b/i.test(evidence)) score += 3;
  if (turn.productScope !== "unknown" && turn.productScope !== "comparison" && policy.product_scopes.includes(turn.productScope)) score += 2;
  return score;
}

type GovernedPriorityFamily =
  | "main_prices"
  | "main_payments"
  | "same_day_discount"
  | "dj_offers"
  | "tier_one_boundary"
  | "app_devices"
  | "show_list"
  | "watchability"
  | "roi_boundary"
  | "language_boundary"
  | "season_capacity"
  | "call_1_flow"
  | "post_sale_handoff"
  | "contract_before_call_2"
  | "stop_reinstatement";

function policyMatchesPriorityFamily(policy: V3Policy, family: GovernedPriorityFamily) {
  const key = policy.decision_key;
  const policyKey = policy.policy_key;
  const decision = normalize(policy.decision);
  switch (family) {
    case "main_prices":
      return key === "istv-nlceo-pricing-and-same-day-discount-answer-1";
    case "main_payments":
      return key === "istv-nlceo-pricing-and-same-day-discount-answer-2";
    case "same_day_discount":
      return key.startsWith("istv-nlceo-pricing-and-same-day-discount-answer-4") ||
        (policyKey.startsWith("istv-nlceo-pricing-and-same-day-discount") && /same day discount/.test(decision));
    case "dj_offers":
      return key === "dj-nlceo-current-offer-overview";
    case "tier_one_boundary":
      return key === "vip-license-platform-coverage";
    case "app_devices":
      return key === "istv-app-download-devices";
    case "show_list":
      return key === "current-show-source-latest-approved-show-list-1";
    case "watchability":
      return key === "current-show-list-watchability-boundary" || key === "current-show-watchability-route";
    case "roi_boundary":
      return key === "roi-questions" ||
        (policyKey.startsWith("platform-proof-and-claims-boundaries") && /do not promise roi/.test(decision));
    case "language_boundary":
      return key.startsWith("production-language-and-translation-boundary-answer-1") ||
        key.startsWith("production-language-and-translation-boundary-what-reps-can-say-1");
    case "season_capacity":
      return key === "show-season-capacity";
    case "call_1_flow":
      return policy.title === "Call 1 Flow: Answer" || policy.title === "Call 1 Flow: Escalation rule";
    case "post_sale_handoff":
      return policy.title === "Post-Sale Handoff After Close: Answer";
    case "contract_before_call_2":
      return policy.id === "claim_6b3311cee0cd4b18__a2";
    case "stop_reinstatement":
      return policy.id === "claim_d2519c5b8045823b";
  }
}

export function resolveV4PriorityPolicyFamily(corpus: V3Policy[], family: GovernedPriorityFamily) {
  return corpus.filter((policy) => policyMatchesPriorityFamily(policy, family));
}

function governedPriorityPolicyIds(corpus: V3Policy[], query: string, turn: V3TurnResolution) {
  const normalizedQuery = normalize(query);
  const families = new Set<GovernedPriorityFamily>();
  const asksPricing = /\b(?:prices?|pricing|costs?|packages?|offers?|payment plans?|installments?|instalments?)\b/.test(normalizedQuery);
  const explicitDj = turn.productScope === "dj_nlceo" || /\b(?:dj|nlceo)\b/.test(normalizedQuery);
  const explicitMain = turn.productScope === "main_istv" || /\bmain istv\b/.test(normalizedQuery);

  if (asksPricing && (!explicitDj || explicitMain)) {
    families.add("main_prices");
    families.add("main_payments");
  }
  if (asksPricing && (!explicitMain || explicitDj)) families.add("dj_offers");
  if (/\b(?:same day|same-day)\b.{0,40}\bdiscount\b|\bdiscount\b.{0,40}\b(?:same day|same-day)\b/.test(normalizedQuery)) {
    families.add("same_day_discount");
  }
  if (/\b(?:tier1|apple tv|amazon prime|tubi|platform placement|streaming platforms?|streaming plaforms?)\b/.test(normalizedQuery)) {
    families.add("tier_one_boundary");
  }
  if (/\b(?:download|install)\b.{0,40}\b(?:istv|isn)(?:\s+app)?\b|\bget\b.{0,40}\b(?:istv|isn)?\s*app\b|\b(?:roku|fire stick|apple tv)\b.{0,40}\bapp\b/.test(normalizedQuery)) {
    families.add("app_devices");
  }
  if (/\b(?:watch|watchable|stream|streaming|on air|aired|airing|episode availability)\b/.test(normalizedQuery)) {
    families.add("watchability");
  }
  if (/\b(?:current|active|approved|available|latest)\b.{0,35}\bshow(?:s| list)?\b|\bwhat shows\b|\blist (?:of|the) shows\b|\bshows (?:we are|we re) currently casting\b/.test(normalizedQuery)) {
    families.add("show_list");
    families.add("watchability");
  }
  if (/\b(?:roi|return on investment|revenue guarantee|guaranteed leads?|fundrais|viewer numbers?|viewership|audience statistics?)\b/.test(normalizedQuery)) {
    families.add("roi_boundary");
  }
  if (/\b(?:spanish|non english|another language|translation|translate|translated|bilingual)\b/.test(normalizedQuery)) {
    families.add("language_boundary");
  }
  if (/\b(?:how many|multiple)\b.{0,35}\b(?:seasons?|episodes?(?: per season| for (?:a|the) show)?)\b|\bseason capacity\b/.test(normalizedQuery)) {
    families.add("season_capacity");
  }
  if (/\b(?:approved guidance (?:for|on)|guidance (?:for|on))\s+call\s*1 flow\b|\bcall\s*1 flow\b/.test(normalizedQuery)) {
    families.add("call_1_flow");
  }
  if (/\b(?:approved guidance (?:for|on)|guidance (?:for|on))\s+post sale handoff after close\b|\bpost sale handoff after close\b/.test(normalizedQuery)) {
    families.add("post_sale_handoff");
  }
  if (/\b(?:send|share|provide)\b.{0,80}\b(?:contract|agreement)\b.{0,80}\b(?:before call 2|legal|review)\b|\b(?:contract|agreement)\b.{0,80}\b(?:legal|review)\b.{0,80}\bbefore call 2\b/.test(normalizedQuery)) {
    families.add("contract_before_call_2");
  }
  if (/\b(?:texted|replied|said|wrote) stop\b|\bstop\b.{0,80}\b(?:reinstat|resubscrib|contact|book)\w*\b/.test(normalizedQuery)) {
    families.add("stop_reinstatement");
  }
  return new Set([...families].flatMap((family) => resolveV4PriorityPolicyFamily(corpus, family).map((policy) => policy.id)));
}

function ranked<T>(items: T[], score: (item: T) => number) {
  return [...items].sort((left, right) => score(right) - score(left));
}

function reciprocalRankMaps(
  policies: V3Policy[],
  signals: Map<string, { lexical: number; family: number; character: number; field: number; coverage: number }>,
) {
  const sources = ["lexical", "family", "character", "field", "coverage"] as const;
  const result = new Map<string, Record<string, number>>();
  for (const source of sources) {
    const order = ranked(policies, (policy) => signals.get(policy.id)?.[source] || 0);
    order.forEach((policy, index) => {
      const score = signals.get(policy.id)?.[source] || 0;
      if (score <= 0) return;
      const current = result.get(policy.id) || {};
      current[source] = index + 1;
      result.set(policy.id, current);
    });
  }
  return result;
}

export function retrieveV4Policies(turn: V3TurnResolution, limit = 32): V4RetrievalResult {
  const startedAt = Date.now();
  const corpus = getV4Corpus();
  const query = turn.standaloneQuestion;
  const queryTokens = tokens(query);
  const expanded = expandTokens(queryTokens);
  const queryTrigrams = trigrams(query);
  const documents = new Map(corpus.map((policy) => [policy.id, tokens(policyEvidenceText(policy))]));
  const averageLength = corpus.reduce((total, policy) => total + (documents.get(policy.id)?.length || 0), 0) / Math.max(1, corpus.length);
  const documentFrequency = new Map<string, number>();
  for (const document of documents.values()) for (const token of new Set(document)) documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1);

  const signals = new Map<string, { lexical: number; family: number; character: number; field: number; coverage: number; matched: string[]; lexicalMatched: string[]; scope: number }>();
  for (const policy of corpus) {
    const document = documents.get(policy.id) || [];
    const lexical = bm25(expanded, document, documentFrequency, corpus.length, averageLength);
    const family = Math.max(0, ...[policy.title, ...policy.question_families].map((value) => tokenOverlap(queryTokens, tokens(value)).score));
    const character = Math.max(0, ...[policy.title, ...policy.question_families].map((value) => jaccard(queryTrigrams, trigrams(value))));
    const fields = tokenOverlap(expanded, tokens([...policy.domains, ...policy.actions, ...policy.entities, policy.decision_key].join(" ")));
    const lexicalMatched = tokenOverlap(queryTokens, document).matched;
    const scope = scopeScore(policy, turn);
    const coverage = queryCoverageSignal(policy, query, turn);
    signals.set(policy.id, { lexical, family, character, field: fields.score, coverage, matched: fields.matched, lexicalMatched, scope });
  }

  const eligiblePolicies = corpus.filter((policy) => {
    const signal = signals.get(policy.id)!;
    const meaningfulSignal = signal.lexical > 0 || signal.family >= 0.12 || signal.character >= 0.18 || signal.field > 0 || signal.coverage > 0;
    return meaningfulSignal && signal.scope > -10;
  });
  const controllingDecisionKeys = new Set(
    eligiblePolicies
      .filter((policy) => policy.specificity_priority > 0 && (signals.get(policy.id)?.lexicalMatched.length || 0) >= 2)
      .map((policy) => policy.decision_key),
  );
  const applicablePolicies = eligiblePolicies.filter(
    (policy) => !policy.blocked_for_decision_keys.some((key) => controllingDecisionKeys.has(key)),
  );
  const ranks = reciprocalRankMaps(applicablePolicies, signals);
  const candidates = applicablePolicies.map((policy) => {
    const signal = signals.get(policy.id)!;
    const rankSources = ranks.get(policy.id) || {};
    const reciprocalRankScore = Object.values(rankSources).reduce((total, rank) => total + 1 / (50 + rank), 0);
    const score = reciprocalRankScore * 100 + signal.family * 2.5 + signal.character * 1.5 + signal.field * 2 + signal.coverage * 0.8 + signal.scope + qualityBoost(policy);
    return {
      policy,
      rank: 0,
      score,
      reciprocalRankScore,
      lexicalScore: signal.lexical,
      familyScore: signal.family,
      characterScore: signal.character,
      fieldScore: signal.field,
      scopeScore: signal.scope,
      matchedTerms: [...new Set([...signal.matched, ...signal.lexicalMatched])].slice(0, 16),
      rankSources,
    } satisfies V4Candidate;
  }).sort((left, right) => right.score - left.score || right.policy.authority - left.policy.authority);

  const perDecision = new Map<string, number>();
  const diversifiedByScore = candidates.filter((candidate) => {
    const seen = perDecision.get(candidate.policy.decision_key) || 0;
    if (seen >= 3) return false;
    perDecision.set(candidate.policy.decision_key, seen + 1);
    return true;
  });
  const priorityIds = governedPriorityPolicyIds(applicablePolicies, query, turn);
  const priority = candidates.filter((candidate) => priorityIds.has(candidate.policy.id));
  const included = new Set<string>();
  const diversified = [...priority, ...diversifiedByScore]
    .filter((candidate) => {
      if (included.has(candidate.policy.id)) return false;
      included.add(candidate.policy.id);
      return true;
    })
    .slice(0, Math.max(1, Math.min(limit, 60)))
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }));

  const blocked = getV4BlockedTopics().flatMap((topic) => {
    const match = v4BlockedTopicDecisionMatch(topic, query, {
      productScope: turn.productScope,
      excludedScopes: turn.excludedScopes,
    });
    return match.matches ? [{
      topic,
      score: match.score,
      matchedTerms: [...match.matchedActions, ...match.matchedDomains, ...match.matchedSubjects],
    } satisfies V4BlockedCandidate] : [];
  }).sort((left, right) => right.score - left.score).slice(0, 8);

  return {
    query,
    queryTokens,
    expandedTokens: expanded,
    candidates: diversified,
    blocked,
    corpusSize: corpus.length,
    stageTimings: { retrievalMs: Date.now() - startedAt },
  };
}

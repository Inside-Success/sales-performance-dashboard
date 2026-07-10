import approvedClaimsDocument from "./generated/approved-claims.json";
import type { CanonicalProductScope, QuestionScope } from "./question-frame";

export type ApprovedClaimSourceKind =
  | "approved_article"
  | "trusted_slack_summary"
  | "trusted_transcript_summary"
  | "curated_slack_summary"
  | "owner_approved_override";

export type ApprovedClaim = {
  id: string;
  topic_key: string;
  policy_key: string;
  title: string;
  question_families: string[];
  approved_text: string;
  product_scopes: Array<CanonicalProductScope | "product_agnostic">;
  domains: string[];
  actions: string[];
  entities: string[];
  answerability: "direct" | "route";
  risk_level: "low" | "high";
  route_required: boolean;
  route_reason?: string;
  authority: number;
  source_kind: ApprovedClaimSourceKind;
  source_article_id?: string | null;
  source_ids: string[];
  approved_by: string[];
  effective_at: string;
  last_reviewed: string;
};

export type BlockedClaim = {
  id: string;
  policy_key: string;
  title: string;
  question_families: string[];
  product_scopes: Array<CanonicalProductScope | "product_agnostic">;
  domains: string[];
  actions: string[];
  entities: string[];
  reason: string;
  effective_at: string;
  source_ids: string[];
};

type ApprovedClaimsDocument = {
  schema_version: number;
  generated_at: string;
  approved_claim_count: number;
  blocked_claim_count: number;
  claims: ApprovedClaim[];
  blocked_claims: BlockedClaim[];
};

export type ApprovedClaimMatch = {
  claim: ApprovedClaim;
  score: number;
  matchedTokens: string[];
  matchedBigrams: string[];
  matchedDomains: string[];
  matchedActions: string[];
};

export type BlockedClaimMatch = {
  claim: BlockedClaim;
  score: number;
  matchedTokens: string[];
  matchedDomains: string[];
  matchedActions: string[];
};

export type ApprovedClaimSearchOptions = {
  scope?: QuestionScope;
  excludedScopes?: CanonicalProductScope[];
  sourceArticleId?: string | null;
  limit?: number;
  minimumScore?: number;
};

const DOCUMENT = approvedClaimsDocument as ApprovedClaimsDocument;

if (
  DOCUMENT.schema_version !== 2 ||
  DOCUMENT.approved_claim_count !== DOCUMENT.claims.length ||
  DOCUMENT.blocked_claim_count !== DOCUMENT.blocked_claims.length
) {
  throw new Error("Ask Sales FAQ approved claim registry is invalid or out of sync");
}

export const APPROVED_CLAIMS = DOCUMENT.claims;
export const BLOCKED_CLAIMS = DOCUMENT.blocked_claims;

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "but", "by", "can", "could", "do", "does", "for",
  "from", "had", "has", "have", "how", "i", "if", "in", "is", "it", "may", "of", "on", "or", "our",
  "should", "that", "the", "their", "there", "they", "this", "to", "was", "we", "what", "when", "where",
  "which", "who", "why", "with", "would", "you",
]);

const DOMAIN_PATTERNS: Record<string, string[]> = {
  qualification: ["qualif", "eligible", "eligibility", "disqual", "fit", "applicant", "audition"],
  pricing: ["price", "pricing", "package", "tier", "discount", "cost"],
  payments: ["payment", "pay", "deposit", "installment", "split", "refund", "charge", "wire", "ach", "invoice", "payme"],
  contracts: ["contract", "agreement", "signing", "signature", "clause"],
  scheduling: ["calendar", "schedule", "book", "rebook", "reschedule", "appointment", "oncehub"],
  onboarding: ["onboarding", "final mock", "training", "go live", "setup"],
  post_sale: ["post sale", "after sale", "after close", "client success", "fulfillment", "scriptwriter"],
  shows_offers: ["show list", "show name", "offer", "program", "ceo day", "operation ceo"],
  production: ["film", "filming", "episode", "studio", "guest", "script", "language", "spanish", "english"],
  content_rights: ["rights", "license", "footage", "asset", "media kit", "promot", "social media", "residual"],
  compliance: ["opt out", "dnc", "do not contact", "consent", "recording", "confidential", "privacy", "security"],
  sales_tech: ["keap", "zoom phone", "technical", "tech", "login", "access", "notification"],
  lead_ownership: ["lead ownership", "assigned rep", "pass off", "20 percent", "twenty percent"],
  communications: ["email", "text", "sms", "message", "call", "contact", "follow up"],
  commissions: ["commission", "ledger", "bill com", "leaderboard"],
};

const ACTION_PATTERNS: Record<string, string[]> = {
  qualify: ["qualif", "eligible", "fit", "disqual"],
  price: ["price", "pricing", "cost", "discount"],
  pay: ["payment", "pay", "deposit", "installment", "wire", "ach", "invoice", "charge"],
  split_payment: ["payment split", "split payment", "custom split"],
  hold_or_pause: ["hold", "pause", "delay", "wait until"],
  refund_or_cancel: ["refund", "cancel", "stop charge", "duplicate charge"],
  verify: ["verify", "confirm", "check", "proof"],
  sign: ["contract", "agreement", "sign", "signature"],
  send: ["send", "email", "text", "message", "link"],
  schedule: ["schedule", "book", "calendar", "oncehub"],
  reschedule: ["reschedule", "rebook", "move the call"],
  route: ["route", "post in", "channel", "escalat", "ask tech", "ask finance"],
  access: ["access", "login", "find", "where is", "where can"],
  troubleshoot: ["not working", "fail", "error", "missing", "wrong", "outage", "issue"],
  explain: ["explain", "tell", "say", "what is", "how does", "why"],
  promise: ["promise", "offer", "allowed", "can we", "can i", "may we"],
  record: ["record", "recording", "fathom", "transcript"],
  contact: ["contact", "call", "text", "email", "outreach", "follow up"],
  opt_out: ["opt out", "unsubscribe", "do not contact", "dnc", "stop messaging"],
  invite_or_attend: ["guest", "bring", "invite", "attend", "tour"],
  produce: ["produce", "film", "episode", "translate", "spanish", "english"],
  use_or_promote: ["use", "reuse", "promote", "marketing", "social media", "asset", "license"],
  reapply: ["reapply", "apply again", "try again"],
  onboard: ["onboard", "onboarding", "final mock", "go live", "training"],
  report: ["report", "post", "log", "ledger", "eod", "payme"],
};

const PRIMARY_SEARCH_TEXT = new Map(
  APPROVED_CLAIMS.map((claim) => [claim.id, normalizeClaimText([
    claim.title,
    ...claim.question_families,
    ...claim.domains,
    ...claim.actions,
    ...claim.entities,
  ].join(" "))]),
);
const SUPPORT_SEARCH_TEXT = new Map(
  APPROVED_CLAIMS.map((claim) => [claim.id, normalizeClaimText(claim.approved_text)]),
);
const PRIMARY_TOKEN_SETS = new Map(
  APPROVED_CLAIMS.map((claim) => [claim.id, new Set(tokenizeClaimText(PRIMARY_SEARCH_TEXT.get(claim.id) || ""))]),
);
const SUPPORT_TOKEN_SETS = new Map(
  APPROVED_CLAIMS.map((claim) => [claim.id, new Set(tokenizeClaimText(SUPPORT_SEARCH_TEXT.get(claim.id) || ""))]),
);
const DOCUMENT_FREQUENCY = buildDocumentFrequency();

export function retrieveApprovedClaims(question: string, options: ApprovedClaimSearchOptions = {}): ApprovedClaimMatch[] {
  const normalizedQuestion = normalizeClaimText(question);
  const questionTokens = unique(tokenizeClaimText(normalizedQuestion));
  if (!questionTokens.length) return [];
  const questionBigrams = unique(buildBigrams(questionTokens));
  const queryDomains = inferTags(normalizedQuestion, DOMAIN_PATTERNS);
  const queryActions = inferTags(normalizedQuestion, ACTION_PATTERNS);

  return APPROVED_CLAIMS.filter((claim) => claimMatchesScope(claim, options))
    .map((claim) => scoreClaim(claim, normalizedQuestion, questionTokens, questionBigrams, queryDomains, queryActions))
    .filter((match) => match.score >= (options.minimumScore ?? 24))
    .sort(
      (left, right) =>
        right.score - left.score ||
        claimSpecificityRank(right.claim) - claimSpecificityRank(left.claim) ||
        right.claim.authority - left.claim.authority ||
        right.claim.effective_at.localeCompare(left.claim.effective_at) ||
        left.claim.id.localeCompare(right.claim.id),
    )
    .slice(0, options.limit ?? 18);
}

function claimSpecificityRank(claim: ApprovedClaim) {
  if (claim.source_kind === "owner_approved_override") return 3;
  if (claim.source_kind === "trusted_slack_summary") return 2;
  if (claim.source_kind === "trusted_transcript_summary") return 2;
  if (claim.source_kind === "curated_slack_summary") return 1;
  return 0;
}

export function retrieveBlockedClaims(question: string, options: ApprovedClaimSearchOptions = {}): BlockedClaimMatch[] {
  const normalizedQuestion = normalizeClaimText(question);
  const questionTokens = unique(tokenizeClaimText(normalizedQuestion));
  const queryDomains = inferTags(normalizedQuestion, DOMAIN_PATTERNS);
  const queryActions = inferTags(normalizedQuestion, ACTION_PATTERNS);
  if (!questionTokens.length) return [];

  return BLOCKED_CLAIMS.filter((claim) => claimMatchesScope(claim, options))
    .map((claim) => {
      const searchText = normalizeClaimText([claim.title, ...claim.question_families, ...claim.entities].join(" "));
      const tokenSet = new Set(tokenizeClaimText(searchText));
      const matchedTokens = questionTokens.filter((token) => tokenSet.has(token));
      const matchedDomains = queryDomains.filter((domain) => claim.domains.includes(domain));
      const matchedActions = queryActions.filter((action) => claim.actions.includes(action));
      const coverage = matchedTokens.length / Math.max(1, questionTokens.length);
      const score = matchedTokens.reduce((sum, token) => sum + inverseDocumentFrequency(token), 0) * 5.2 +
        coverage * 34 + matchedDomains.length * 7 + matchedActions.length * 9;
      return { claim, score: roundScore(score), matchedTokens, matchedDomains, matchedActions };
    })
    .filter((match) => match.matchedTokens.length >= 2 && match.score >= (options.minimumScore ?? 48))
    .sort((left, right) => right.score - left.score || right.claim.effective_at.localeCompare(left.claim.effective_at))
    .slice(0, options.limit ?? 4);
}

export function approvedClaimById(id: string) {
  return APPROVED_CLAIMS.find((claim) => claim.id === id) || null;
}

function claimMatchesScope(
  claim: Pick<ApprovedClaim, "product_scopes"> | Pick<BlockedClaim, "product_scopes">,
  options: ApprovedClaimSearchOptions,
) {
  if ("source_article_id" in claim && options.sourceArticleId && claim.source_article_id !== options.sourceArticleId) return false;
  const excluded = options.excludedScopes || [];
  if (claim.product_scopes.some((scope) => scope !== "product_agnostic" && excluded.includes(scope))) return false;
  const scope = options.scope || "unknown";
  if (scope === "unknown" || scope === "comparison") return true;
  if (claim.product_scopes.includes("product_agnostic")) return true;
  return claim.product_scopes.includes(scope);
}

function scoreClaim(
  claim: ApprovedClaim,
  normalizedQuestion: string,
  questionTokens: string[],
  questionBigrams: string[],
  queryDomains: string[],
  queryActions: string[],
): ApprovedClaimMatch {
  const primaryText = PRIMARY_SEARCH_TEXT.get(claim.id) || "";
  const primaryTokens = PRIMARY_TOKEN_SETS.get(claim.id) || new Set<string>();
  const supportTokens = SUPPORT_TOKEN_SETS.get(claim.id) || new Set<string>();
  const matchedTokens = questionTokens.filter((token) => primaryTokens.has(token));
  const supportOnlyTokens = questionTokens.filter((token) => !primaryTokens.has(token) && supportTokens.has(token));
  const matchedBigrams = questionBigrams.filter((bigram) => primaryText.includes(bigram.replace("::", " ")));
  const matchedDomains = queryDomains.filter((domain) => claim.domains.includes(domain));
  const matchedActions = queryActions.filter((action) => claim.actions.includes(action));
  if (matchedTokens.length < 2) {
    return { claim, score: 0, matchedTokens, matchedBigrams, matchedDomains, matchedActions };
  }

  const idfScore = matchedTokens.reduce((sum, token) => sum + inverseDocumentFrequency(token), 0);
  const supportScore = supportOnlyTokens.reduce((sum, token) => sum + inverseDocumentFrequency(token), 0);
  const coverage = matchedTokens.length / Math.max(1, questionTokens.length);
  const bestFamilyCoverage = Math.max(
    0,
    ...claim.question_families.map((family) => familyCoverage(questionTokens, tokenizeClaimText(normalizeClaimText(family)))),
  );
  const exactFamily = claim.question_families.some((family) => {
    const normalizedFamily = normalizeClaimText(family);
    return normalizedFamily.length >= 12 && (normalizedFamily.includes(normalizedQuestion) || normalizedQuestion.includes(normalizedFamily));
  });
  const sourceBonus =
    claim.source_kind === "owner_approved_override"
      ? 8
      : claim.source_kind === "trusted_slack_summary" || claim.source_kind === "trusted_transcript_summary"
        ? 4
        : 0;
  const authorityBonus = Math.max(0, claim.authority - 75) * 0.12;
  const broadArticlePenalty = claim.source_kind === "approved_article" && matchedTokens.length < 3 ? 14 : 0;
  const actionMismatchPenalty = queryActions.length && !matchedActions.length && matchedTokens.length < 3 ? 10 : 0;
  const score =
    idfScore * 4.7 +
    coverage * 30 +
    matchedBigrams.length * 8 +
    bestFamilyCoverage * 28 +
    matchedDomains.length * 6 +
    matchedActions.length * 9 +
    Math.min(7, supportScore * 0.7) +
    (exactFamily ? 18 : 0) +
    sourceBonus +
    authorityBonus -
    broadArticlePenalty -
    actionMismatchPenalty;

  return { claim, score: roundScore(score), matchedTokens, matchedBigrams, matchedDomains, matchedActions };
}

function familyCoverage(questionTokens: string[], familyTokens: string[]) {
  if (!familyTokens.length) return 0;
  const family = new Set(familyTokens);
  const overlap = questionTokens.filter((token) => family.has(token)).length;
  return overlap / Math.max(2, Math.min(questionTokens.length, family.size));
}

function inferTags(normalizedText: string, patterns: Record<string, string[]>) {
  return Object.entries(patterns)
    .filter(([, phrases]) => phrases.some((phrase) => normalizedText.includes(normalizeClaimText(phrase))))
    .map(([tag]) => tag);
}

function buildDocumentFrequency() {
  const counts = new Map<string, number>();
  for (const tokenSet of PRIMARY_TOKEN_SETS.values()) {
    for (const token of tokenSet) counts.set(token, (counts.get(token) || 0) + 1);
  }
  return counts;
}

function inverseDocumentFrequency(token: string) {
  const count = DOCUMENT_FREQUENCY.get(token) || 0;
  return Math.log((APPROVED_CLAIMS.length + 1) / (count + 1)) + 1;
}

function buildBigrams(tokens: string[]) {
  return tokens.slice(0, -1).map((token, index) => `${token}::${tokens[index + 1]}`);
}

function roundScore(value: number) {
  return Math.round(Math.max(0, Math.min(100, value)) * 10) / 10;
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function tokenizeClaimText(value: string) {
  return (value.match(/[a-z0-9]+/g) || [])
    .map(stemToken)
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
}

function stemToken(token: string) {
  if (token.length > 7 && token.endsWith("ation")) return token.slice(0, -5);
  if (token.length > 6 && token.endsWith("ments")) return token.slice(0, -5);
  if (token.length > 5 && token.endsWith("ing")) return token.slice(0, -3);
  if (token.length > 5 && token.endsWith("ied")) return `${token.slice(0, -3)}y`;
  if (token.length > 4 && token.endsWith("ed")) return token.slice(0, -2);
  if (token.length > 4 && token.endsWith("es")) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith("s")) return token.slice(0, -1);
  return token;
}

function normalizeClaimText(value: string) {
  return value
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/20\s*%/g, "20 percent")
    .replace(/tier\s*[- ]?1/g, "tier 1")
    .replace(/[^a-z0-9$%']+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

import approvedClaimsDocument from "./generated/approved-claims.json";
import type { CanonicalProductScope, QuestionScope } from "./question-frame";

export type ApprovedClaimSourceKind =
  | "approved_article"
  | "trusted_slack_summary"
  | "curated_slack_summary"
  | "owner_approved_override";

export type ApprovedClaim = {
  id: string;
  topic_key: string;
  title: string;
  question_families: string[];
  approved_text: string;
  product_scopes: Array<CanonicalProductScope | "product_agnostic">;
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

type ApprovedClaimsDocument = {
  schema_version: number;
  generated_at: string;
  approved_claim_count: number;
  claims: ApprovedClaim[];
};

export type ApprovedClaimMatch = {
  claim: ApprovedClaim;
  score: number;
  matchedTokens: string[];
  matchedBigrams: string[];
};

export type ApprovedClaimSearchOptions = {
  scope?: QuestionScope;
  excludedScopes?: CanonicalProductScope[];
  sourceArticleId?: string | null;
  limit?: number;
  minimumScore?: number;
};

const DOCUMENT = approvedClaimsDocument as ApprovedClaimsDocument;

if (DOCUMENT.schema_version !== 1 || DOCUMENT.approved_claim_count !== DOCUMENT.claims.length) {
  throw new Error("Ask Sales FAQ approved claim registry is invalid or out of sync");
}

export const APPROVED_CLAIMS = DOCUMENT.claims;

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "been",
  "but",
  "by",
  "can",
  "could",
  "do",
  "does",
  "for",
  "from",
  "had",
  "has",
  "have",
  "how",
  "i",
  "if",
  "in",
  "is",
  "it",
  "may",
  "of",
  "on",
  "or",
  "our",
  "should",
  "that",
  "the",
  "their",
  "there",
  "they",
  "this",
  "to",
  "was",
  "we",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "with",
  "would",
  "you",
]);

const CLAIM_SEARCH_TEXT = new Map(
  APPROVED_CLAIMS.map((claim) => [
    claim.id,
    normalizeClaimText([claim.title, ...claim.question_families, claim.approved_text].join(" ")),
  ]),
);

const CLAIM_TOKEN_SETS = new Map(
  APPROVED_CLAIMS.map((claim) => [claim.id, new Set(tokenizeClaimText(CLAIM_SEARCH_TEXT.get(claim.id) || ""))]),
);

const DOCUMENT_FREQUENCY = buildDocumentFrequency();

export function retrieveApprovedClaims(question: string, options: ApprovedClaimSearchOptions = {}): ApprovedClaimMatch[] {
  const normalizedQuestion = normalizeClaimText(question);
  const questionTokens = unique(tokenizeClaimText(normalizedQuestion));
  if (!questionTokens.length) return [];
  const questionBigrams = unique(buildBigrams(questionTokens));

  return APPROVED_CLAIMS.filter((claim) => claimMatchesScope(claim, options))
    .map((claim) => scoreClaim(claim, normalizedQuestion, questionTokens, questionBigrams))
    .filter((match) => match.score >= (options.minimumScore ?? 24))
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.claim.authority - left.claim.authority ||
        right.claim.effective_at.localeCompare(left.claim.effective_at) ||
        left.claim.id.localeCompare(right.claim.id),
    )
    .slice(0, options.limit ?? 14);
}

export function approvedClaimById(id: string) {
  return APPROVED_CLAIMS.find((claim) => claim.id === id) || null;
}

function claimMatchesScope(claim: ApprovedClaim, options: ApprovedClaimSearchOptions) {
  if (options.sourceArticleId && claim.source_article_id !== options.sourceArticleId) return false;
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
): ApprovedClaimMatch {
  const searchText = CLAIM_SEARCH_TEXT.get(claim.id) || "";
  const tokenSet = CLAIM_TOKEN_SETS.get(claim.id) || new Set<string>();
  const matchedTokens = questionTokens.filter((token) => tokenSet.has(token));
  const matchedBigrams = questionBigrams.filter((bigram) => searchText.includes(bigram.replace("::", " ")));
  if (matchedTokens.length < 2) {
    return { claim, score: 0, matchedTokens, matchedBigrams };
  }

  const idfScore = matchedTokens.reduce((sum, token) => sum + inverseDocumentFrequency(token), 0);
  const coverage = matchedTokens.length / Math.max(1, questionTokens.length);
  const title = normalizeClaimText(claim.title);
  const exactFamily = claim.question_families.some((family) => {
    const normalizedFamily = normalizeClaimText(family);
    return normalizedFamily.includes(normalizedQuestion) || normalizedQuestion.includes(normalizedFamily);
  });
  const titleCoverage = tokenizeClaimText(title).filter((token) => questionTokens.includes(token)).length;
  const sourceBonus = claim.source_kind === "owner_approved_override" ? 6 : claim.source_kind === "approved_article" ? 4 : 0;
  const authorityBonus = Math.max(0, claim.authority - 75) * 0.2;
  const recencyBonus = claim.last_reviewed >= "2026-07-09" ? 2 : 0;
  const score =
    idfScore * 4.1 +
    coverage * 26 +
    matchedBigrams.length * 5 +
    Math.min(8, titleCoverage * 2) +
    (exactFamily ? 16 : 0) +
    sourceBonus +
    authorityBonus +
    recencyBonus;

  return {
    claim,
    score: Math.round(Math.min(100, score) * 10) / 10,
    matchedTokens,
    matchedBigrams,
  };
}

function buildDocumentFrequency() {
  const counts = new Map<string, number>();
  for (const tokenSet of CLAIM_TOKEN_SETS.values()) {
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

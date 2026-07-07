import type {
  AskSalesFaqChatMessage,
  AskSalesFaqOutcome,
  AskSalesFaqResponse,
  AskSalesFaqStructuredAnswer,
} from "@/lib/ask-sales-faq/types";
import {
  APPROVED_FAQ_ARTICLES,
  ASK_SALES_FAQ_POLICY_RULES,
  type ApprovedFaqArticle,
  type AskSalesFaqRule,
} from "@/lib/ask-sales-faq/generated/approved-faq-bundle";
import ragIndex from "@/lib/ask-sales-faq/generated/policy-aware-rag-index.json";

type RagChunk = {
  id: string;
  source_type: "approved_article" | "curated_kb_article" | "curated_slack_evidence" | "governance_log" | "training_transcript";
  source_path: string;
  source_title: string;
  heading: string;
  article_id: string | null;
  article_status: string;
  category: string;
  risk_level: "low" | "medium" | "high" | string;
  authority: number;
  trust_label: string;
  last_reviewed: string;
  text: string;
};

type IndexedChunk = RagChunk & {
  normalized: string;
  tokens: string[];
  tokenSet: Set<string>;
};

type EvidenceCandidate = {
  id: string;
  kind: "approved_article" | "source_chunk";
  articleId: string | null;
  articleStatus: string;
  sourceType: RagChunk["source_type"] | "approved_article";
  sourceTitle: string;
  heading: string;
  category: string;
  riskLevel: string;
  authority: number;
  trustLabel: string;
  lastReviewed: string;
  text: string;
  score: number;
  matchedTokens: string[];
};

type RuntimeDecision = {
  outcome: AskSalesFaqOutcome;
  sourceMode: "approved" | "evidence" | "mixed" | "fallback";
  confidenceLabel: "High" | "Medium" | "Low";
  confidenceScore: number;
  reason: string;
  routeReason: string | null;
  safeToGenerate: boolean;
  matchedRuleId: string;
  matchedArticleId: string | null;
  primaryArticle: ApprovedFaqArticle | null;
  retrieved: EvidenceCandidate[];
};

type PolicyGuardDecision = {
  decision: AskSalesFaqRule["decision"] | "abstain_unapproved";
  safeToGenerate: boolean;
  articleId: string | null;
  blockedTopic: string | null;
  matchedRuleId: string;
  reason: string;
  primaryArticle: ApprovedFaqArticle | null;
};

type ModelOutput = {
  answer: string;
  summary?: string;
  sections?: Array<{ title?: string; body?: string; items?: string[]; tone?: string }>;
  selected_source_ids?: string[];
  needs_route: boolean;
  route_reason: string;
  confidence_label?: "High" | "Medium" | "Low";
  confidence_score?: number;
};

type ProviderJsonResult<T> = {
  provider: "deepseek" | "anthropic";
  model: string;
  output: T;
};

export type AskSalesFaqRuntimeResult = AskSalesFaqResponse & {
  sanitizedQuestion: string;
  contextualQuestion: string;
  matchedArticleId: string | null;
  errorClass: string | null;
};

const STOPWORDS = new Set([
  "a",
  "about",
  "after",
  "all",
  "am",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "before",
  "by",
  "can",
  "could",
  "do",
  "does",
  "for",
  "from",
  "give",
  "had",
  "has",
  "have",
  "how",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "me",
  "my",
  "of",
  "on",
  "or",
  "our",
  "should",
  "that",
  "the",
  "their",
  "them",
  "this",
  "to",
  "we",
  "what",
  "when",
  "where",
  "which",
  "who",
  "with",
  "you",
  "your",
]);

const QUERY_EXPANSIONS: Array<{ triggers: string[]; add: string[] }> = [
  { triggers: ["pay", "payment", "payments", "plan", "plans"], add: ["price", "pricing", "package", "link", "deposit"] },
  { triggers: ["dj", "daymond", "john"], add: ["daymond", "john", "next", "level", "ceo"] },
  { triggers: ["nlceo", "next", "level"], add: ["next", "level", "ceo", "daymond", "john"] },
  { triggers: ["price", "pricing", "cost", "package", "packages"], add: ["istv", "payment", "plans", "lite", "standard", "premium"] },
  { triggers: ["discount", "discounts", "2000", "$2000", "$2,000"], add: ["same", "day", "call", "2", "pricing", "offer"] },
  { triggers: ["show", "shows", "tv"], add: ["current", "active", "list"] },
  { triggers: ["refund", "refunds"], add: ["next", "level", "ceo", "daymond", "istv"] },
  { triggers: ["apple", "amazon", "tubi", "tier", "guaranteed"], add: ["platform", "placement", "proof", "claims"] },
  { triggers: ["recording", "recordings"], add: ["zoom", "stored", "access"] },
  { triggers: ["upgrade", "upgraded"], add: ["lite", "standard", "vip", "premium", "same", "day", "discount", "filming"] },
  { triggers: ["call", "pricing"], add: ["call", "1", "price", "investment", "disqualify", "qualified"] },
];

const AI_UNAVAILABLE_RESPONSE =
  "I cannot generate a reliable answer right now. Do not guess from memory; route this to the current sales owner or the right help channel before replying.";

const REP_FACING_INTERNAL_TERMS = [
  "not approved in the knowledge base",
  "not approved in kb",
  "knowledge base",
  "approved article",
  "approved faq article",
  "route-only",
  "route only",
  "manifest",
  "source coverage",
  "pending approval",
  "article status",
  "article id",
  "source id",
  "selected source",
  "governance log",
  "internal guidance",
  "slack evidence",
  "slack-sourced",
  "slack-level",
  "slack notes",
  "curated source evidence",
  "candidate answer",
  "decision candidates",
  "candidate q and a",
  "what the evidence says",
];

const REP_FACING_INTERNAL_PATTERNS = [
  /\bnot approved\b/i,
  /\bunapproved\b/i,
  /\bpending approval\b/i,
  /\bapproved (faq )?article\b/i,
  /\bknowledge base\b/i,
  /\broute[- ]only\b/i,
  /\bRAG\b/,
  /\bmanifest\b/i,
  /\bsource coverage\b/i,
  /\bsource id\b/i,
  /\bselected source\b/i,
  /\barticle[_ -]?id\b/i,
  /\bmatched[_ -]?rule[_ -]?id\b/i,
  /\bdefault[-_ ]abstain\b/i,
  /\bin_conflict\b/i,
  /\bgovernance log\b/i,
  /\binternal guidance\b/i,
  /\binternal discussions?\b/i,
  /\bthe evidence\b/i,
  /\bSlack(?:[- ]level|[- ]sourced)? (?:evidence|notes|guidance|discussion|source)/i,
  /\bcurated (?:Slack|source) evidence\b/i,
  /\b(?:Evidence|Source)\s+\d+\b/i,
  /\bwhat the evidence says\b/i,
  /\bcandidate answer\b/i,
  /\bdecision candidates\b/i,
  /\bcandidate q and a\b/i,
  /slack\/evidence\/\S+/i,
  /transcription\/transcripts\/\S+/i,
  /knowledge-base\/\S+/i,
  /\bapproved:[a-z0-9_-]+/i,
  /\bchunk:[a-z0-9_-]+/i,
];

const rawChunks = (ragIndex as { chunks?: RagChunk[] }).chunks || [];
const ARTICLE_BY_ID = new Map(APPROVED_FAQ_ARTICLES.map((article) => [article.id, article]));
const INDEXED_CHUNKS: IndexedChunk[] = rawChunks.map((chunk) => {
  const normalized = normalizeText(`${chunk.source_title} ${chunk.heading} ${chunk.category} ${chunk.text}`);
  const tokens = tokenize(normalized, { expand: false });
  return {
    ...chunk,
    normalized,
    tokens,
    tokenSet: new Set(tokens),
  };
});

export async function runAskSalesFaq(
  question: string,
  conversationMessages: AskSalesFaqChatMessage[] = [],
): Promise<AskSalesFaqRuntimeResult> {
  const startedAt = Date.now();
  const { text: sanitizedQuestion, redactions } = redactSensitiveText(question);
  const conversationContext = buildConversationContext(conversationMessages);
  const contextualQuestion = buildContextualQuestion(sanitizedQuestion, conversationContext);
  const policyDecision = decidePolicyGuard(sanitizedQuestion);
  const candidates = buildEvidenceCandidates(sanitizedQuestion, conversationContext, policyDecision);

  if (!policyDecision.safeToGenerate) {
    const decision = buildPolicyBlockedDecision(policyDecision);
    const answer = policyBlockedAnswer(policyDecision);
    return buildHandledResponse({
      startedAt,
      sanitizedQuestion,
      contextualQuestion,
      redactions,
      decision,
      answer,
      structuredAnswer: structured({
        summary: answer,
        sections: [{ title: "What to do", body: answer, tone: policyDecision.decision === "admin_only" ? "default" : "route" }],
        decision,
      }),
      source: null,
      provider: null,
      model: null,
      errorClass: null,
    });
  }

  try {
    const answerResult = await generateProviderAnswer({
      currentQuestion: sanitizedQuestion,
      conversationContext,
      evidence: candidates,
      policyDecision,
    });
    const finalOutput = await ensureRepFacingOutput({
      currentQuestion: sanitizedQuestion,
      output: answerResult.output,
    });
    const selectedEvidence = resolveSelectedEvidence(finalOutput, candidates, sanitizedQuestion);
    const decision = buildDecision({
      output: finalOutput,
      evidence: selectedEvidence,
      policyDecision,
    });
    const answer = sanitizeModelAnswer(finalOutput.answer);

    if (!answer || modelOutputContainsHiddenTerms(finalOutput)) {
      throw new Error("AI output was empty or exposed hidden terms");
    }

    return buildHandledResponse({
      startedAt,
      sanitizedQuestion,
      contextualQuestion,
      redactions,
      decision,
      answer,
      structuredAnswer: normalizeModelStructuredAnswer(finalOutput, answer, decision),
      source: sourceSummaryFromDecision(decision),
      provider: answerResult.provider,
      model: answerResult.model,
      errorClass: null,
    });
  } catch (error) {
    console.error("Ask Sales FAQ AI runtime failed", error);
    const decision = buildUnavailableDecision(candidates);
    return buildHandledResponse({
      startedAt,
      sanitizedQuestion,
      contextualQuestion,
      redactions,
      decision,
      answer: AI_UNAVAILABLE_RESPONSE,
      structuredAnswer: structured({
        summary: AI_UNAVAILABLE_RESPONSE,
        sections: [{ title: "What to do", items: ["Route this to the current sales owner or the right help channel.", "Do not guess before replying to the prospect."], tone: "route" }],
        decision,
      }),
      source: null,
      errorClass: "ai_runtime_unavailable",
    });
  }
}

function buildHandledResponse(input: {
  startedAt: number;
  sanitizedQuestion: string;
  contextualQuestion: string;
  redactions: string[];
  decision: RuntimeDecision;
  answer: string;
  structuredAnswer: AskSalesFaqStructuredAnswer;
  source: AskSalesFaqRuntimeResult["source"];
  provider?: "deepseek" | "anthropic" | null;
  model?: string | null;
  errorClass: string | null;
}): AskSalesFaqRuntimeResult {
  return {
    ok: true,
    conversationId: "",
    messageId: "",
    answer: input.answer,
    structuredAnswer: input.structuredAnswer,
    outcome: input.decision.outcome,
    source: input.source,
    model: input.model || null,
    provider: input.provider || null,
    needsRoute:
      input.decision.outcome === "route_from_approved_article" ||
      input.decision.outcome === "route_from_evidence" ||
      input.decision.outcome === "low_confidence_route" ||
      input.decision.outcome === "abstain_unapproved" ||
      input.decision.outcome === "safe_fallback",
    routeReason: input.decision.routeReason,
    redactions: input.redactions,
    latencyMs: Date.now() - input.startedAt,
    sanitizedQuestion: input.sanitizedQuestion,
    contextualQuestion: input.contextualQuestion,
    matchedArticleId: input.decision.matchedArticleId,
    errorClass: input.errorClass,
  };
}

function decidePolicyGuard(question: string): PolicyGuardDecision {
  for (const [groupName, rules] of [
    ["adminOnlyRules", ASK_SALES_FAQ_POLICY_RULES.adminOnlyRules],
    ["abstainRules", ASK_SALES_FAQ_POLICY_RULES.abstainRules],
    ["routeRules", ASK_SALES_FAQ_POLICY_RULES.routeRules],
    ["answerRules", ASK_SALES_FAQ_POLICY_RULES.answerRules],
  ] as const) {
    for (const rule of rules) {
      if (!policyRuleMatches(question, rule)) continue;

      const article = rule.article_id ? ARTICLE_BY_ID.get(rule.article_id) || null : null;
      const safeToGenerate =
        (rule.decision === "answer_from_approved_article" || rule.decision === "route_from_approved_article") && Boolean(article);

      return {
        decision: safeToGenerate ? rule.decision : rule.decision === "admin_only" && groupName === "adminOnlyRules" ? "admin_only" : "abstain_unapproved",
        safeToGenerate,
        articleId: safeToGenerate ? rule.article_id || null : null,
        blockedTopic: rule.blocked_topic || null,
        matchedRuleId: rule.id,
        reason: safeToGenerate && rule.reason ? rule.reason : rule.reason || "No approved answer is available for this question.",
        primaryArticle: safeToGenerate ? article : null,
      };
    }
  }

  return {
    decision: ASK_SALES_FAQ_POLICY_RULES.defaultDecision.decision,
    safeToGenerate: false,
    articleId: null,
    blockedTopic: null,
    matchedRuleId: "default-abstain",
    reason: ASK_SALES_FAQ_POLICY_RULES.defaultDecision.reason,
    primaryArticle: null,
  };
}

function policyRuleMatches(question: string, rule: AskSalesFaqRule) {
  const normalizedQuestion = normalizeText(question);

  if (rule.match_all?.length && !rule.match_all.every((phrase) => phrasePresent(phrase, normalizedQuestion))) return false;
  if (rule.match_any?.length && !rule.match_any.some((phrase) => phrasePresent(phrase, normalizedQuestion))) return false;

  for (const group of rule.match_any_groups || []) {
    if (!group.some((phrase) => phrasePresent(phrase, normalizedQuestion))) return false;
  }

  return Boolean(rule.match_all?.length || rule.match_any?.length || rule.match_any_groups?.length);
}

function policyBlockedAnswer(policyDecision: PolicyGuardDecision) {
  if (policyDecision.decision === "admin_only") {
    return "This is an admin or maintenance question, not a normal sales-call answer. Keep it in the admin workflow and do not use raw Slack messages to change what reps are told.";
  }

  if (policyDecision.blockedTopic === "greenlight-pdf-and-cohort-deadlines") {
    return "I do not have a confirmed answer for that greenlight, PDF, no-show, reapply, or deadline case yet. Route this to the current greenlight owner or sales leadership before replying to the prospect.";
  }

  if (policyDecision.blockedTopic === "sales-tech-routing-and-support-requests") {
    return "I do not have a confirmed sales-tech routing answer for that yet. Route this to the current support owner before telling the rep which channel or desk to use.";
  }

  if (policyDecision.blockedTopic === "calendars-recordings-and-zoom-phone") {
    return "I do not have a confirmed calendar, rebooking, or Zoom Phone troubleshooting answer for that yet. Route it to the current sales-tech owner before giving exact steps.";
  }

  if (policyDecision.blockedTopic === "new-rep-onboarding-and-final-mock") {
    return "I do not have a confirmed new-rep onboarding or final mock checklist yet. Route this to the current training owner before giving a final checklist.";
  }

  return "I do not have a confirmed answer for that yet. Route this to the current sales owner or the right help channel before replying to the prospect.";
}

function buildPolicyBlockedDecision(policyDecision: PolicyGuardDecision): RuntimeDecision {
  return {
    outcome: policyDecision.decision === "admin_only" ? "admin_only" : "abstain_unapproved",
    sourceMode: "fallback",
    confidenceLabel: "Low",
    confidenceScore: 0,
    reason: policyDecision.reason,
    routeReason: policyDecision.decision === "admin_only" ? null : policyDecision.reason,
    safeToGenerate: false,
    matchedRuleId: policyDecision.matchedRuleId,
    matchedArticleId: null,
    primaryArticle: null,
    retrieved: [],
  };
}

function buildEvidenceCandidates(question: string, conversationContext: string, policyDecision: PolicyGuardDecision): EvidenceCandidate[] {
  if (policyDecision.safeToGenerate && policyDecision.primaryArticle) {
    return [approvedArticleToCandidate(policyDecision.primaryArticle)];
  }

  const approved = APPROVED_FAQ_ARTICLES.map((article) => approvedArticleToCandidate(article));
  const searchText = [question, conversationContext].filter(Boolean).join("\n");
  const chunkCandidates = retrieveCandidateChunks(searchText, 42, { expand: true })
    .filter((chunk) => chunk.source_type !== "approved_article")
    .map((chunk) => chunkToCandidate(chunk));
  const byId = new Map<string, EvidenceCandidate>();

  for (const candidate of [...approved, ...chunkCandidates]) {
    const existing = byId.get(candidate.id);
    if (!existing || candidate.score > existing.score) byId.set(candidate.id, candidate);
  }

  return Array.from(byId.values())
    .sort((left, right) => right.authority - left.authority || right.score - left.score || left.id.localeCompare(right.id))
    .slice(0, 48);
}

function approvedArticleToCandidate(article: ApprovedFaqArticle): EvidenceCandidate {
  return {
    id: `approved:${article.id}`,
    kind: "approved_article",
    articleId: article.id,
    articleStatus: "approved",
    sourceType: "approved_article",
    sourceTitle: article.title,
    heading: "Approved FAQ article",
    category: article.category,
    riskLevel: article.riskLevel,
    authority: 100,
    trustLabel: "Approved FAQ article",
    lastReviewed: article.lastReviewed,
    text: article.body,
    score: 100,
    matchedTokens: [],
  };
}

function chunkToCandidate(chunk: RetrievedChunk): EvidenceCandidate {
  return {
    id: `chunk:${chunk.id}`,
    kind: "source_chunk",
    articleId: chunk.article_id,
    articleStatus: chunk.article_status,
    sourceType: chunk.source_type,
    sourceTitle: chunk.source_title,
    heading: chunk.heading,
    category: chunk.category,
    riskLevel: chunk.risk_level,
    authority: chunk.authority,
    trustLabel: chunk.trust_label,
    lastReviewed: chunk.last_reviewed,
    text: chunk.text,
    score: chunk.score,
    matchedTokens: chunk.matchedTokens,
  };
}

function resolveSelectedEvidence(output: ModelOutput, candidates: EvidenceCandidate[], currentQuestion: string) {
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const selected = (output.selected_source_ids || [])
    .map((id) => byId.get(id))
    .filter((candidate): candidate is EvidenceCandidate => Boolean(candidate));

  const validatedSelected = filterQuestionSupportedEvidence(selected, currentQuestion, output);
  if (validatedSelected.length) return validatedSelected.slice(0, 10);

  const fallback = filterQuestionSupportedEvidence(candidates, currentQuestion, output);
  if (fallback.length) return fallback.slice(0, 10);

  return [];
}

async function generateProviderAnswer(input: {
  currentQuestion: string;
  conversationContext: string;
  evidence: EvidenceCandidate[];
  policyDecision: PolicyGuardDecision;
}): Promise<ProviderJsonResult<ModelOutput>> {
  const routeRequired = input.policyDecision.decision === "route_from_approved_article";
  return generateProviderJson({
    purpose: "answer generation",
    maxTokens: 1800,
    messages: [
      {
        role: "system",
        content: [
          "You are Ask Sales FAQ, an internal AI assistant for sales reps on live calls.",
          "Use only the evidence packet. Do not invent facts, prices, discounts, owners, links, or exceptions.",
          "A deterministic policy guard has already selected the only approved source you may use.",
          routeRequired
            ? "This policy decision requires routing. Give the safe boundary from the approved source and set needs_route to true."
            : "This policy decision allows a direct answer from the selected approved source unless the source itself says to route an edge case.",
          "Internally select the evidence by meaning, not by mechanical keyword overlap, then answer from that selected evidence.",
          "Answer the actual question asked. If the user asks for only one product, package, show, or topic, do not include unrelated sections.",
          "The current user question is authoritative. Use conversation context only to resolve short or ambiguous follow-ups.",
          "Write directly to the rep using you, you can say, do not promise, and route this. Do not write in third person as the rep should.",
          "Do not dump every related fact. Be direct first, then add only the context the rep needs.",
          "If the evidence is incomplete, say what is known and add a clear route note without pretending certainty.",
          "If the user asks where to check the current show list, answer from the approved show-list evidence and do not tell normal reps to check inaccessible internal channels as the primary answer.",
          "Never expose source IDs, file paths, article statuses, Slack links, implementation details, knowledge base wording, approved article wording, route-only labels, RAG, manifests, source coverage, or pending approval wording.",
          "Never say Slack evidence, Slack-level evidence, internal guidance, governance log, candidate answer, decision candidates, Evidence 1, Source 2, or similar source-review language.",
          "Do not explain why a fact is or is not approved. If something needs confirmation, say: Confirm this with the current sales owner before promising it.",
          "Return only JSON with keys: answer, summary, sections, selected_source_ids, needs_route, route_reason, confidence_label, confidence_score.",
          "sections must be an array of objects with title, optional body, optional items array, and optional tone: default, good, warning, or route.",
          "selected_source_ids must contain only IDs from the evidence packet and should list the sources actually used for the answer.",
          "confidence_score must be an integer from 0 to 100, not a 0-to-1 decimal. confidence_label must match the score: High 80-100, Medium 50-79, Low 0-49.",
          "Return valid JSON only. Do not use markdown. The first character must be { and the last character must be }.",
        ].join("\n"),
      },
      {
        role: "user",
        content: [
          "CURRENT USER QUESTION:",
          input.currentQuestion,
          "",
          "POLICY DECISION:",
          input.policyDecision.decision,
          "",
          "MATCHED POLICY REASON:",
          input.policyDecision.reason,
          "",
          "ROUTE REQUIRED:",
          routeRequired ? "yes" : "no",
          "",
          "RECENT CONVERSATION CONTEXT:",
          input.conversationContext || "None",
          "",
          "EVIDENCE PACKET:",
          formatEvidencePacket(input.evidence, { maxCharsPerItem: 1600 }),
        ].join("\n"),
      },
    ],
    parse: parseModelOutput,
  });
}

async function ensureRepFacingOutput(input: { currentQuestion: string; output: ModelOutput }) {
  if (!modelOutputContainsHiddenTerms(input.output)) return input.output;

  try {
    const rewrite = await generateProviderJson<ModelOutput>({
      purpose: "rep-facing wording repair",
      maxTokens: 1600,
      messages: [
        {
          role: "system",
          content: [
            "You rewrite Ask Sales FAQ answers so they sound like a polished internal sales assistant, not an internal QA or source-review tool.",
            "Preserve the answer's facts, warnings, route requirement, and confidence. Do not add new policy or remove useful sales guidance.",
            "Remove all internal source mechanics and review language. Never mention Slack, evidence numbers, source IDs, article IDs, knowledge base, approved articles, route-only labels, governance logs, internal guidance, RAG, manifests, or file paths.",
            "If a detail needs confirmation, use normal sales wording such as: \"Confirm this with the current sales owner before promising it.\"",
            "Write directly to the rep using you, you can say, do not promise, and route this.",
            "Return valid JSON only with the same schema: answer, summary, sections, selected_source_ids, needs_route, route_reason, confidence_label, confidence_score.",
          ].join("\n"),
        },
        {
          role: "user",
          content: [
            "CURRENT USER QUESTION:",
            input.currentQuestion,
            "",
            "DRAFT ANSWER JSON TO CLEAN UP:",
            JSON.stringify(input.output),
          ].join("\n"),
        },
      ],
      parse: parseModelOutput,
    });

    return {
      ...rewrite.output,
      selected_source_ids: input.output.selected_source_ids,
      needs_route: input.output.needs_route,
      confidence_label: input.output.confidence_label,
      confidence_score: input.output.confidence_score,
    };
  } catch (error) {
    console.warn("Ask Sales FAQ rep-facing wording repair failed", {
      error: sanitizeProviderError(error),
    });
    return input.output;
  }
}

function buildDecision(input: {
  output: ModelOutput;
  evidence: EvidenceCandidate[];
  policyDecision: PolicyGuardDecision;
}): RuntimeDecision {
  const primaryArticle = input.policyDecision.primaryArticle || firstSelectedApprovedArticle(input.evidence);
  const selectedApproved = input.evidence.filter((candidate) => candidate.kind === "approved_article");
  const selectedEvidence = input.evidence.filter((candidate) => candidate.kind !== "approved_article");
  const policyRequiresRoute = input.policyDecision.decision === "route_from_approved_article";
  const needsRoute = policyRequiresRoute || Boolean(input.output.needs_route);
  const confidenceLabel = input.output.confidence_label || "Medium";
  const confidenceScore = clampConfidence(input.output.confidence_score ?? 72);
  const sourceMode =
    selectedApproved.length && selectedEvidence.length
      ? "mixed"
      : selectedApproved.length
        ? "approved"
        : selectedEvidence.length
          ? "evidence"
          : "fallback";
  const outcome: AskSalesFaqOutcome = needsRoute ? "route_from_approved_article" : "answer_from_approved_article";

  return {
    outcome,
    sourceMode: primaryArticle ? "approved" : sourceMode,
    confidenceLabel,
    confidenceScore,
    reason: input.output.summary || input.policyDecision.reason,
    routeReason: needsRoute ? input.output.route_reason || input.policyDecision.reason || "Confirm this with the current owner before relying on it." : null,
    safeToGenerate: true,
    matchedRuleId: input.policyDecision.matchedRuleId,
    matchedArticleId: primaryArticle?.id || input.policyDecision.articleId,
    primaryArticle,
    retrieved: input.evidence,
  };
}

function buildUnavailableDecision(candidates: EvidenceCandidate[]): RuntimeDecision {
  return {
    outcome: "safe_fallback",
    sourceMode: "fallback",
    confidenceLabel: "Low",
    confidenceScore: 0,
    reason: "AI provider was unavailable, so no content answer was generated.",
    routeReason: "AI provider unavailable.",
    safeToGenerate: false,
    matchedRuleId: "ai-provider-unavailable",
    matchedArticleId: null,
    primaryArticle: null,
    retrieved: candidates.slice(0, 8),
  };
}

function firstSelectedApprovedArticle(evidence: EvidenceCandidate[]) {
  const articleId = evidence.find((candidate) => candidate.kind === "approved_article" && candidate.articleId)?.articleId;
  if (!articleId) return null;
  return APPROVED_FAQ_ARTICLES.find((article) => article.id === articleId) || null;
}

function sourceSummaryFromDecision(decision: RuntimeDecision): AskSalesFaqRuntimeResult["source"] {
  const primary = decision.primaryArticle;
  const top = decision.retrieved[0];
  if (primary) {
    return {
      label: primary.title,
      lastReviewed: primary.lastReviewed,
      approved: true,
      sourceMode: decision.sourceMode,
      confidenceLabel: decision.confidenceLabel,
      confidenceScore: decision.confidenceScore,
      expandableDetails: `FAQ source reviewed on ${primary.lastReviewed}.`,
    };
  }
  if (top) {
    return {
      label: sourceTrustLabel(top.trustLabel),
      lastReviewed: top.lastReviewed || "2026-07-01",
      approved: top.kind === "approved_article",
      sourceMode: decision.sourceMode,
      confidenceLabel: decision.confidenceLabel,
      confidenceScore: decision.confidenceScore,
      expandableDetails: `Related sales guidance area: ${top.category}. Confirm unusual or time-sensitive cases with the current owner before promising them.`,
    };
  }
  return null;
}

function structured(input: {
  summary: string;
  sections: AskSalesFaqStructuredAnswer["sections"];
  decision: RuntimeDecision;
}): AskSalesFaqStructuredAnswer {
  return {
    summary: input.summary,
    sections: input.sections.filter((section) => section.body || section.items?.length),
    confidenceLabel: input.decision.confidenceLabel,
    confidenceScore: input.decision.confidenceScore,
    sourceMode: input.decision.sourceMode,
  };
}

function buildConversationContext(messages: AskSalesFaqChatMessage[]) {
  return messages
    .slice(0, -1)
    .filter((message) => message.content.trim())
    .slice(-6)
    .map((message) => `${message.role}: ${message.content.trim().slice(0, 600)}`)
    .join("\n");
}

function buildContextualQuestion(question: string, conversationContext: string) {
  if (!conversationContext) return question;
  return `Recent conversation context:\n${conversationContext}\n\nCurrent user question:\n${question}`;
}

function redactSensitiveText(value: string) {
  const redactions = new Set<string>();
  let text = value;

  text = text.replace(/\b(?:\d[ -]*?){13,19}\b/g, (match) => {
    const digits = match.replace(/\D/g, "");
    if (digits.length >= 13 && digits.length <= 19) {
      redactions.add("payment_number");
      return "[REDACTED_PAYMENT_NUMBER]";
    }
    return match;
  });

  if (/\b\d{3}-\d{2}-\d{4}\b/.test(text)) {
    redactions.add("ssn");
    text = text.replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[REDACTED_SSN]");
  }

  text = text.replace(/\b(password|passcode|api key|secret|token)\s*[:=]\s*\S+/gi, (match, label: string) => {
    redactions.add("secret");
    return `${label}: [REDACTED_SECRET]`;
  });

  return { text, redactions: Array.from(redactions).sort() };
}

type RetrievedChunk = RagChunk & {
  score: number;
  matchedTokens: string[];
};

function retrieveCandidateChunks(question: string, topK: number, options: { expand: boolean }): RetrievedChunk[] {
  const queryTokens = tokenize(question, { expand: options.expand });
  const queryTokenSet = new Set(queryTokens);
  const normalizedQuestion = normalizeText(question);

  const scored: RetrievedChunk[] = [];
  for (const chunk of INDEXED_CHUNKS) {
    const matchedTokens = Array.from(queryTokenSet).filter((token) => chunk.tokenSet.has(token));
    if (!matchedTokens.length) continue;

    let score = 0;
    for (const token of matchedTokens) {
      const frequency = chunk.tokens.filter((candidate) => candidate === token).length;
      score += 1 + Math.log(Math.max(1, frequency));
    }

    if (phrasePresent(chunk.source_title, normalizedQuestion)) score += 3;
    if (phrasePresent(chunk.heading, normalizedQuestion)) score += 2;
    if (chunk.source_type === "approved_article") score += 1.5;
    score += Math.min(2.2, chunk.authority / 55);
    score += matchedTokens.length / Math.max(2, queryTokenSet.size);

    scored.push({
      ...chunk,
      score: Number(score.toFixed(3)),
      matchedTokens,
    });
  }

  return scored
    .sort((left, right) => right.score - left.score || right.authority - left.authority || left.id.localeCompare(right.id))
    .slice(0, topK);
}

function tokenize(value: string, options: { expand: boolean }) {
  const tokens =
    normalizeText(value)
      .match(/[a-z0-9$]+/g)
      ?.filter((token) => token.length > 1 && !STOPWORDS.has(token)) || [];

  if (!options.expand) return tokens;

  const expanded = new Set(tokens);
  for (const expansion of QUERY_EXPANSIONS) {
    if (expansion.triggers.some((trigger) => expanded.has(normalizeText(trigger)))) {
      expansion.add.forEach((token) => expanded.add(normalizeText(token)));
    }
  }
  return Array.from(expanded);
}

function phrasePresent(needle: string, haystack: string) {
  return normalizeText(haystack).includes(normalizeText(needle));
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replaceAll("next-level", "next level")
    .replaceAll("same-day", "same day")
    .replaceAll("call-2", "call 2")
    .replaceAll("call-1", "call 1")
    .replaceAll("tier-1", "tier 1")
    .replaceAll("red-carpet", "red carpet")
    .replaceAll("pay-to-play", "pay to play")
    .replace(/\bdj\b/g, "daymond john")
    .replace(/\$2\s*,?\s*000/g, " $2000 2000 $2,000 ")
    .replace(/\$2k\b/g, " $2000 2000 $2,000 ")
    .replace(/\bnlceo\b/g, "next level ceo")
    .replace(/\s+/g, " ")
    .trim();
}

function formatEvidencePacket(candidates: EvidenceCandidate[], options: { maxCharsPerItem: number }) {
  return candidates
    .map((candidate, index) =>
      [
        `EVIDENCE ${index + 1}`,
        `ID: ${candidate.id}`,
        `Trust: ${candidate.trustLabel}`,
        `Type: ${candidate.sourceType}`,
        `Category: ${candidate.category}`,
        `Risk: ${candidate.riskLevel}`,
        `Last reviewed: ${candidate.lastReviewed || "unknown"}`,
        `Title: ${candidate.sourceTitle}`,
        `Heading: ${candidate.heading}`,
        `Text: ${candidate.text.slice(0, options.maxCharsPerItem)}`,
      ].join("\n"),
    )
    .join("\n\n");
}

async function generateProviderJson<T>(input: {
  purpose: string;
  messages: Array<{ role: "system" | "user"; content: string }>;
  maxTokens: number;
  parse: (content: string) => T;
}): Promise<ProviderJsonResult<T>> {
  const deepSeekKey = process.env.DEEPSEEK_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const errors: string[] = [];

  if (deepSeekKey) {
    try {
      return await callDeepSeekJson(input, deepSeekKey);
    } catch (error) {
      const sanitizedError = sanitizeProviderError(error);
      errors.push(`deepseek: ${sanitizedError}`);
      console.warn("Ask Sales FAQ provider attempt failed", {
        provider: "deepseek",
        purpose: input.purpose,
        error: sanitizedError,
      });
    }
  }

  if (anthropicKey) {
    try {
      return await callAnthropicJson(input, anthropicKey);
    } catch (error) {
      const sanitizedError = sanitizeProviderError(error);
      errors.push(`anthropic: ${sanitizedError}`);
      console.warn("Ask Sales FAQ provider attempt failed", {
        provider: "anthropic",
        purpose: input.purpose,
        error: sanitizedError,
      });
    }
  }

  throw new Error(`No Ask Sales FAQ provider succeeded for ${input.purpose}. Attempts: ${errors.length}. ${errors.join(" | ")}`);
}

async function callDeepSeekJson<T>(
  input: {
    purpose: string;
    messages: Array<{ role: "system" | "user"; content: string }>;
    maxTokens: number;
    parse: (content: string) => T;
  },
  apiKey: string,
): Promise<ProviderJsonResult<T>> {
  const model = process.env.FAQ_DEEPSEEK_MODEL || "deepseek-v4-pro";
  const response = await fetchWithTimeout("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: input.maxTokens,
      response_format: { type: "json_object" },
      messages: input.messages,
    }),
  });

  const data = (await safeJson(response)) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  } | null;

  if (!response.ok) throw new Error(data?.error?.message || `DeepSeek ${input.purpose} request failed with HTTP ${response.status}`);

  const content = data?.choices?.[0]?.message?.content || "";
  return { provider: "deepseek", model, output: input.parse(content) };
}

async function callAnthropicJson<T>(
  input: {
    purpose: string;
    messages: Array<{ role: "system" | "user"; content: string }>;
    maxTokens: number;
    parse: (content: string) => T;
  },
  apiKey: string,
): Promise<ProviderJsonResult<T>> {
  const model = process.env.FAQ_CLAUDE_MODEL || "claude-sonnet-4-6";
  const system = input.messages.find((message) => message.role === "system")?.content || "";
  const user = input.messages.find((message) => message.role === "user")?.content || "";

  const response = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: input.maxTokens,
      temperature: 0.15,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });

  const data = (await safeJson(response)) as {
    content?: Array<{ type?: string; text?: string }>;
    error?: { message?: string };
  } | null;

  if (!response.ok) throw new Error(data?.error?.message || `Anthropic ${input.purpose} request failed with HTTP ${response.status}`);

  const content = data?.content?.find((part) => part.type === "text" && part.text)?.text || "";
  return { provider: "anthropic", model, output: input.parse(content) };
}

function parseModelOutput(content: string): ModelOutput {
  const parsed = parseJsonObject<Partial<ModelOutput>>(content);

  if (!parsed.answer || typeof parsed.needs_route !== "boolean") {
    throw new Error("Model output did not match Ask Sales FAQ schema");
  }

  return normalizeModelOutput(parsed);
}

function parseJsonObject<T>(content: string): T {
  const trimmed = content.trim();
  const jsonText = trimmed.match(/```json\s*([\s\S]*?)```/)?.[1] || extractJsonObject(trimmed) || trimmed;
  return JSON.parse(jsonText) as T;
}

function extractJsonObject(value: string) {
  const start = value.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < value.length; index += 1) {
    const char = value[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return value.slice(start, index + 1);
    }
  }

  return null;
}

function normalizeModelOutput(output: Partial<ModelOutput>): ModelOutput {
  const confidenceScore = parseConfidenceScore(output.confidence_score);
  return {
    answer: sanitizeModelAnswer(String(output.answer || "")),
    summary: typeof output.summary === "string" ? sanitizeModelAnswer(output.summary) : undefined,
    sections: Array.isArray(output.sections) ? output.sections : [],
    selected_source_ids: Array.isArray(output.selected_source_ids)
      ? output.selected_source_ids.filter((id): id is string => typeof id === "string").slice(0, 10)
      : [],
    needs_route: Boolean(output.needs_route),
    route_reason: typeof output.route_reason === "string" ? sanitizeModelAnswer(output.route_reason) : "",
    confidence_label: confidenceScore === undefined ? parseConfidenceLabel(output.confidence_label) : confidenceLabelFromScore(confidenceScore),
    confidence_score: confidenceScore,
  };
}

function normalizeModelStructuredAnswer(
  output: ModelOutput,
  answer: string,
  decision: RuntimeDecision,
): AskSalesFaqStructuredAnswer {
  const sections = Array.isArray(output.sections)
    ? output.sections
        .filter((section) => section && typeof section.title === "string")
        .map((section) => ({
          title: String(section.title),
          body: typeof section.body === "string" ? sanitizeModelAnswer(section.body) : undefined,
          items: Array.isArray(section.items)
            ? section.items.filter((item): item is string => typeof item === "string").map(sanitizeModelAnswer)
            : undefined,
          tone: parseSectionTone(section.tone),
        }))
    : [];

  return structured({
    summary: sanitizeModelAnswer(output.summary || answer),
    sections: sections.length ? sections : [{ title: "Answer", body: answer }],
    decision: {
      ...decision,
      confidenceLabel: output.confidence_label || decision.confidenceLabel,
      confidenceScore: typeof output.confidence_score === "number" ? clampConfidence(output.confidence_score) : decision.confidenceScore,
    },
  });
}

function parseConfidenceLabel(value: unknown): "High" | "Medium" | "Low" | undefined {
  return value === "High" || value === "Medium" || value === "Low" ? value : undefined;
}

function parseConfidenceScore(value: unknown) {
  const numericValue = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(numericValue)) return undefined;
  return clampConfidence(numericValue >= 0 && numericValue <= 1 ? numericValue * 100 : numericValue);
}

function confidenceLabelFromScore(score: number): "High" | "Medium" | "Low" {
  if (score >= 80) return "High";
  if (score >= 50) return "Medium";
  return "Low";
}

function parseSectionTone(value: unknown): "default" | "good" | "warning" | "route" | undefined {
  return value === "default" || value === "good" || value === "warning" || value === "route" ? value : undefined;
}

function clampConfidence(value: number) {
  if (!Number.isFinite(value)) return 60;
  return Math.max(0, Math.min(100, Math.round(value)));
}

async function fetchWithTimeout(input: string, init: RequestInit) {
  const timeoutSeconds = Number(process.env.FAQ_MODEL_TIMEOUT_SECONDS || "60");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(8, timeoutSeconds) * 1000);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function safeJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function sanitizeModelAnswer(value: string) {
  return value
    .replace(/\b[Tt]he rep should\b/g, "You should")
    .replace(/\b[Rr]eps should\b/g, "You should")
    .replace(/\b[Rr]eps must\b/g, "You must")
    .replace(/\b[Rr]ep-facing\b/g, "sales")
    .trim();
}

function containsHiddenTerms(answer: string) {
  const normalizedAnswer = answer.toLowerCase();
  return (
    REP_FACING_INTERNAL_TERMS.some((term) => normalizedAnswer.includes(term)) ||
    REP_FACING_INTERNAL_PATTERNS.some((pattern) => pattern.test(answer))
  );
}

function modelOutputContainsHiddenTerms(output: ModelOutput) {
  return modelOutputText(output).some((value) => containsHiddenTerms(value));
}

function modelOutputText(output: ModelOutput) {
  return [
    output.answer,
    output.summary,
    output.route_reason,
    ...(output.sections || []).flatMap((section) => [section.title, section.body, ...(section.items || [])]),
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);
}

function sourceTrustLabel(value: string) {
  if (/approved/i.test(value)) return "FAQ source";
  return "Sales guidance";
}

function filterQuestionSupportedEvidence(candidates: EvidenceCandidate[], currentQuestion: string, output: ModelOutput) {
  const answerText = [output.answer, output.summary, output.route_reason].filter(Boolean).join(" ");
  return candidates
    .map((candidate) => ({
      candidate,
      supportScore: evidenceSupportScore(candidate, currentQuestion, answerText),
    }))
    .filter((item) => item.supportScore >= 3)
    .sort(
      (left, right) =>
        right.supportScore - left.supportScore ||
        right.candidate.authority - left.candidate.authority ||
        right.candidate.score - left.candidate.score ||
        left.candidate.id.localeCompare(right.candidate.id),
    )
    .map((item) => item.candidate);
}

function evidenceSupportScore(candidate: EvidenceCandidate, currentQuestion: string, answerText: string) {
  const searchText = normalizeText(`${currentQuestion} ${answerText}`);
  const candidateText = normalizeText(`${candidate.sourceTitle} ${candidate.heading} ${candidate.category} ${candidate.text}`);
  const queryTokens = Array.from(new Set(tokenize(searchText, { expand: true }))).filter((token) => token.length > 2);
  let score = 0;

  for (const token of queryTokens) {
    if (candidateText.includes(token)) score += 1;
  }

  const topicPairs: Array<[string[], string[], number]> = [
    [["same day discount", "$2000", "$2,000"], ["same day discount", "$2000", "$2,000"], 7],
    [["daymond john", "next level ceo"], ["daymond john", "next level ceo"], 6],
    [["upgrade", "before filming", "after filming"], ["upgrade", "before filming", "after filming"], 6],
    [["call 1", "investment", "pricing", "disqualify"], ["call 1", "investment", "pricing", "disqualify"], 6],
    [["show list", "tv shows"], ["show list", "latest approved show list"], 5],
    [["refund"], ["refund"], 5],
    [["recording"], ["recording"], 4],
  ];

  for (const [questionPhrases, candidatePhrases, boost] of topicPairs) {
    if (questionPhrases.some((phrase) => phrasePresent(phrase, searchText)) && candidatePhrases.some((phrase) => phrasePresent(phrase, candidateText))) {
      score += boost;
    }
  }

  if (candidate.kind === "approved_article") score += 1;
  return score;
}

function sanitizeProviderError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/sk-[A-Za-z0-9_-]{12,}/g, "[redacted_key]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted_key]")
    .slice(0, 500);
}

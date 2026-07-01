import type {
  AskSalesFaqChatMessage,
  AskSalesFaqOutcome,
  AskSalesFaqResponse,
  AskSalesFaqStructuredAnswer,
} from "@/lib/ask-sales-faq/types";
import { APPROVED_FAQ_ARTICLES, type ApprovedFaqArticle } from "@/lib/ask-sales-faq/generated/approved-faq-bundle";
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
];

const AI_UNAVAILABLE_RESPONSE =
  "I cannot generate a reliable AI answer right now. Do not guess from memory; check the approved source or route the question before replying.";

const rawChunks = (ragIndex as { chunks?: RagChunk[] }).chunks || [];
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
  const candidates = buildEvidenceCandidates(sanitizedQuestion, conversationContext);

  try {
    const answerResult = await generateProviderAnswer({
      currentQuestion: sanitizedQuestion,
      conversationContext,
      evidence: candidates,
    });
    const selectedEvidence = resolveSelectedEvidence(answerResult.output, candidates);
    const finalOutput = answerResult.output;
    const decision = buildDecision({
      output: finalOutput,
      evidence: selectedEvidence,
    });
    const answer = sanitizeModelAnswer(finalOutput.answer);

    if (!answer || containsHiddenTerms(answer)) {
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
        sections: [{ title: "What to do", items: ["Check the approved source.", "Route the question before replying to the prospect."], tone: "route" }],
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

function buildEvidenceCandidates(question: string, conversationContext: string): EvidenceCandidate[] {
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

function resolveSelectedEvidence(output: ModelOutput, candidates: EvidenceCandidate[]) {
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const selected = (output.selected_source_ids || [])
    .map((id) => byId.get(id))
    .filter((candidate): candidate is EvidenceCandidate => Boolean(candidate));

  if (selected.length) return selected.slice(0, 10);

  return candidates
    .filter((candidate) => candidate.kind === "approved_article")
    .slice(0, 8)
    .concat(candidates.filter((candidate) => candidate.kind === "source_chunk").slice(0, 4));
}

async function generateProviderAnswer(input: {
  currentQuestion: string;
  conversationContext: string;
  evidence: EvidenceCandidate[];
}): Promise<ProviderJsonResult<ModelOutput>> {
  return generateProviderJson({
    purpose: "answer generation",
    maxTokens: 1800,
    messages: [
      {
        role: "system",
        content: [
          "You are Ask Sales FAQ, an internal AI assistant for sales reps on live calls.",
          "Use only the evidence packet. Do not invent facts, prices, discounts, owners, links, or exceptions.",
          "Internally select the evidence by meaning, not by mechanical keyword overlap, then answer from that selected evidence.",
          "Answer the actual question asked. If the user asks for only one product, package, show, or topic, do not include unrelated sections.",
          "The current user question is authoritative. Use conversation context only to resolve short or ambiguous follow-ups.",
          "Do not dump every related fact. Be direct first, then add only the context the rep needs.",
          "If the evidence is incomplete, say what is known and add a clear route note without pretending certainty.",
          "If the user asks where to check the current show list, answer from the approved show-list evidence and do not tell normal reps to check inaccessible internal channels as the primary answer.",
          "Never expose source IDs, file paths, article statuses, Slack links, or implementation details.",
          "Return only JSON with keys: answer, summary, sections, selected_source_ids, needs_route, route_reason, confidence_label, confidence_score.",
          "sections must be an array of objects with title, optional body, optional items array, and optional tone: default, good, warning, or route.",
          "selected_source_ids must contain only IDs from the evidence packet and should list the sources actually used for the answer.",
          "Return valid JSON only. Do not use markdown. The first character must be { and the last character must be }.",
        ].join("\n"),
      },
      {
        role: "user",
        content: [
          "CURRENT USER QUESTION:",
          input.currentQuestion,
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

function buildDecision(input: {
  output: ModelOutput;
  evidence: EvidenceCandidate[];
}): RuntimeDecision {
  const primaryArticle = firstSelectedApprovedArticle(input.evidence);
  const selectedApproved = input.evidence.filter((candidate) => candidate.kind === "approved_article");
  const selectedEvidence = input.evidence.filter((candidate) => candidate.kind !== "approved_article");
  const needsRoute = Boolean(input.output.needs_route);
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
  const outcome: AskSalesFaqOutcome = needsRoute
    ? sourceMode === "approved"
      ? "route_from_approved_article"
      : "route_from_evidence"
    : sourceMode === "approved"
      ? "answer_from_approved_article"
      : sourceMode === "fallback"
        ? "low_confidence_route"
        : "answer_from_evidence";

  return {
    outcome,
    sourceMode,
    confidenceLabel,
    confidenceScore,
    reason: input.output.summary || "AI selected source evidence and generated an answer.",
    routeReason: needsRoute ? input.output.route_reason || "Confirm this with the current owner before relying on it." : null,
    safeToGenerate: true,
    matchedRuleId: "ai-semantic-rag",
    matchedArticleId: primaryArticle?.id || input.evidence.find((candidate) => candidate.articleId)?.articleId || null,
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
      expandableDetails: `AI selected approved FAQ evidence reviewed on ${primary.lastReviewed}.`,
    };
  }
  if (top) {
    return {
      label: `${top.trustLabel}: ${top.sourceTitle}`,
      lastReviewed: top.lastReviewed || "2026-07-01",
      approved: top.kind === "approved_article",
      sourceMode: decision.sourceMode,
      confidenceLabel: decision.confidenceLabel,
      confidenceScore: decision.confidenceScore,
      expandableDetails: `AI selected evidence category: ${top.category}.`,
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
    .replace(/\$2\s*,?\s*000/g, " $2000 2000 $2,000 ")
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
      errors.push(`deepseek: ${sanitizeProviderError(error)}`);
    }
  }

  if (anthropicKey) {
    try {
      return await callAnthropicJson(input, anthropicKey);
    } catch (error) {
      errors.push(`anthropic: ${sanitizeProviderError(error)}`);
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
  const model = process.env.FAQ_DEEPSEEK_MODEL || "deepseek-chat";
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
  return {
    answer: sanitizeModelAnswer(String(output.answer || "")),
    summary: typeof output.summary === "string" ? sanitizeModelAnswer(output.summary) : undefined,
    sections: Array.isArray(output.sections) ? output.sections : [],
    selected_source_ids: Array.isArray(output.selected_source_ids)
      ? output.selected_source_ids.filter((id): id is string => typeof id === "string").slice(0, 10)
      : [],
    needs_route: Boolean(output.needs_route),
    route_reason: typeof output.route_reason === "string" ? sanitizeModelAnswer(output.route_reason) : "",
    confidence_label: parseConfidenceLabel(output.confidence_label),
    confidence_score: typeof output.confidence_score === "number" ? output.confidence_score : undefined,
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

function parseSectionTone(value: unknown): "default" | "good" | "warning" | "route" | undefined {
  return value === "default" || value === "good" || value === "warning" || value === "route" ? value : undefined;
}

function clampConfidence(value: number) {
  if (!Number.isFinite(value)) return 60;
  return Math.max(0, Math.min(100, Math.round(value)));
}

async function fetchWithTimeout(input: string, init: RequestInit) {
  const timeoutSeconds = Number(process.env.FAQ_MODEL_TIMEOUT_SECONDS || "25");
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
    .replace(/slack\/evidence\/\S+/gi, "internal evidence")
    .replace(/transcription\/transcripts\/\S+/gi, "training evidence")
    .replace(/knowledge-base\/\S+/gi, "FAQ source")
    .replace(/\bapproved:[a-z0-9_-]+/gi, "approved source")
    .replace(/\bchunk:[a-z0-9_-]+/gi, "source evidence")
    .replace(/\bsource\s+\d+\b/gi, "source")
    .replace(/\bin_conflict\b/gi, "needs owner confirmation")
    .replace(/\bdraft article\b/gi, "internal evidence")
    .replace(/\barticle_id\b/gi, "source reference")
    .trim();
}

function containsHiddenTerms(answer: string) {
  return [
    "slack/evidence",
    "transcription/transcripts",
    "knowledge-base/",
    "article_id",
    "matched_rule_id",
    "default-abstain",
    "in_conflict",
    "approved:",
    "chunk:",
  ].some((term) => answer.toLowerCase().includes(term));
}

function sanitizeProviderError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/sk-[A-Za-z0-9_-]{12,}/g, "[redacted_key]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted_key]")
    .slice(0, 500);
}

import type {
  AskSalesFaqChatMessage,
  AskSalesFaqOutcome,
  AskSalesFaqResponse,
  AskSalesFaqRuntimeMetadata,
  AskSalesFaqStructuredAnswer,
} from "@/lib/ask-sales-faq/types";
import { generateV3ClaudeFallbackJson, generateV3Json, generateV3ValidationJson, parseV3Json } from "@/lib/ask-sales-faq/v3/provider";
import { getV3Registry, retrieveV3Policies } from "@/lib/ask-sales-faq/v3/retrieval";
import { resolveV3Turn } from "@/lib/ask-sales-faq/v3/turn-resolver";
import type {
  V3AnswerOutput,
  V3Policy,
  V3Provider,
  V3ProviderAttempt,
  V3RetrievalResult,
  V3TurnResolution,
  V3ValidationResult,
} from "@/lib/ask-sales-faq/v3/types";

const registry = getV3Registry();
const ALLOWED_ROUTE_KEYS = new Set(Object.keys(registry.route_catalog));
const ALLOWED_CHANNELS = new Set(Object.values(registry.route_catalog).map((route) => route.channel));

export type AskSalesFaqV3RuntimeResult = AskSalesFaqResponse & {
  sanitizedQuestion: string;
  contextualQuestion: string;
  matchedArticleId: string | null;
  errorClass: string | null;
  runtimeMetadata: AskSalesFaqRuntimeMetadata;
};

type V3RuntimeOptions = {
  provider?: V3Provider;
  validatorProvider?: V3Provider;
  fallbackProvider?: V3Provider;
};

function clean(value: unknown, limit = 4000) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function cleanDisplayText(value: unknown, limit = 4000) {
  return clean(value, limit)
    .replace(/\s*(?:\(|\[)(?:E\d{1,2}(?:\s*[,;]\s*E\d{1,2})*)(?:\)|\])/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function redactSensitiveText(value: string) {
  const redactions: string[] = [];
  let text = value;
  const replacements: Array<[RegExp, string, string]> = [
    [/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, "[redacted email]", "email"],
    [/\+?\d[\d ()-]{8,}\d/g, "[redacted phone]", "phone"],
    [/\b(?:\d[ -]*?){13,19}\b/g, "[redacted payment card]", "payment_card"],
  ];
  for (const [pattern, replacement, label] of replacements) {
    if (pattern.test(text)) redactions.push(label);
    text = text.replace(pattern, replacement);
  }
  return { text: clean(text, 12000), redactions: Array.from(new Set(redactions)) };
}

function clampConfidence(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  const scaled = numeric >= 0 && numeric <= 1 ? numeric * 100 : numeric;
  return Math.max(0, Math.min(100, Math.round(scaled)));
}

function parseSections(value: unknown): V3AnswerOutput["sections"] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 6).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const section = item as Record<string, unknown>;
    const title = clean(section.title, 100);
    if (!title) return [];
    const tone = ["default", "good", "warning", "route"].includes(String(section.tone))
      ? (section.tone as "default" | "good" | "warning" | "route")
      : undefined;
    return [{
      title,
      body: cleanDisplayText(section.body, 1200) || undefined,
      items: Array.isArray(section.items) ? section.items.map((item) => cleanDisplayText(item, 500)).filter(Boolean).slice(0, 50) : undefined,
      tone,
    }];
  });
}

function stringArray(value: unknown, limit = 20) {
  return Array.isArray(value) ? value.map((item) => clean(item, 300)).filter(Boolean).slice(0, limit) : [];
}

function parseCoverage(value: unknown): V3AnswerOutput["coverage"] {
  return Array.isArray(value)
    ? value.slice(0, 8).flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const entry = item as Record<string, unknown>;
        const need = clean(entry.need, 240);
        if (!need) return [];
        const status = ["answered", "partial", "unresolved"].includes(String(entry.status))
          ? (entry.status as "answered" | "partial" | "unresolved")
          : "unresolved";
        return [{ need, status, policy_ids: stringArray(entry.policy_ids), reason: clean(entry.reason, 400) }];
      })
    : [];
}

function parseAnswerOutput(content: string): V3AnswerOutput {
  const raw = parseV3Json<Record<string, unknown>>(content);
  const mode = ["answer", "partial", "route", "conversation"].includes(String(raw.mode))
    ? (raw.mode as V3AnswerOutput["mode"])
    : "route";
  const coverage = parseCoverage(raw.coverage);
  const sentenceEvidence = Array.isArray(raw.sentence_evidence)
    ? raw.sentence_evidence.slice(0, 20).flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const value = item as Record<string, unknown>;
        const sentence = clean(value.sentence, 700);
        return sentence ? [{ sentence, policy_ids: stringArray(value.policy_ids, 8) }] : [];
      })
    : [];
  return {
    mode,
    answer: cleanDisplayText(raw.answer, 5000),
    summary: cleanDisplayText(raw.summary, 1200),
    sections: parseSections(raw.sections),
    selected_policy_ids: stringArray(raw.selected_policy_ids),
    rejected_policy_ids: stringArray(raw.rejected_policy_ids),
    coverage,
    sentence_evidence: sentenceEvidence,
    needs_route: Boolean(raw.needs_route),
    route_key: ALLOWED_ROUTE_KEYS.has(String(raw.route_key)) ? String(raw.route_key) : null,
    route_reason: clean(raw.route_reason, 600),
    confidence_score: clampConfidence(raw.confidence_score),
  };
}

function parseConversationOutput(content: string): V3AnswerOutput {
  const raw = parseV3Json<Record<string, unknown>>(content);
  const answer = cleanDisplayText(raw.answer || raw.message || raw.response || raw.greeting, 2500);
  if (!answer) throw new Error("Conversation response did not contain an answer.");
  return {
    mode: "conversation",
    answer,
    summary: cleanDisplayText(raw.summary, 1200) || answer,
    sections: parseSections(raw.sections),
    selected_policy_ids: [],
    rejected_policy_ids: [],
    coverage: [],
    sentence_evidence: [],
    needs_route: false,
    route_key: null,
    route_reason: "",
    confidence_score: 100,
  };
}

function policyCards(retrieval: V3RetrievalResult) {
  // Retrieval already applies the bounded candidate limit. Keep that single
  // limit authoritative so a relevant lower-ranked card cannot appear in
  // diagnostics yet be silently withheld from the composer.
  return retrieval.candidates.map((match, index) => ({
    rank: index + 1,
    ref: `E${index + 1}`,
    policy_key: match.policy.policy_key,
    title: match.policy.title,
    decision_evidence: match.policy.decision.slice(0, 1400),
    question_families: match.policy.question_families.slice(0, 3),
    scope: match.policy.product_scopes,
    domains: match.policy.domains,
    actions: match.policy.actions,
    risk: match.policy.risk_level,
    answerability: match.policy.answerability,
    quality_tier: match.policy.quality_tier,
    route_key: match.policy.route_key,
    route_channel: match.policy.route_channel,
    authority: match.policy.authority,
    effective_at: match.policy.effective_at,
    approved_by: match.policy.source.approved_by,
    retrieval_score: match.score,
  }));
}

function parseSemanticRecall(content: string) {
  const raw = parseV3Json<Record<string, unknown>>(content);
  const queries = stringArray(raw.queries, 4)
    .map((query) => clean(query, 500))
    .filter(Boolean);
  if (!queries.length) throw new Error("Semantic recall did not return usable retrieval queries.");
  return { queries };
}

function parseEvidenceSelection(content: string) {
  const raw = parseV3Json<Record<string, unknown>>(content);
  return {
    selected_refs: stringArray(raw.selected_refs, 6),
    reason: clean(raw.reason, 800),
  };
}

async function addSemanticRecall(input: {
  provider: V3Provider;
  turn: V3TurnResolution;
  retrieval: V3RetrievalResult;
  attempts: V3ProviderAttempt[];
}) {
  const bestFamilyScore = Math.max(0, ...input.retrieval.candidates.map((match) => match.familyScore));
  const strongImmediateContext = input.turn.kind === "follow_up" && input.retrieval.candidates.some((match) => match.contextScore >= 30);
  if (strongImmediateContext || (bestFamilyScore >= 6.2 && input.retrieval.candidates.length >= 10)) return input.retrieval;
  const startedAt = Date.now();
  try {
    const result = await input.provider<{ queries: string[] }>({
      purpose: "v3_semantic_recall",
      maxTokens: 450,
      system: [
        "You write compact retrieval queries for an internal sales-policy search engine. You never answer the question.",
        "Return 2 to 4 short standalone retrieval queries that preserve the exact requested action, entity, product, timing, exception, and negation.",
        "Cover each distinct decision the user needs, such as eligibility, permission, ownership, timing, next action, or exception, with a separate query when needed.",
        "Include at least one policy-title-like abstraction of the business decision instead of merely repeating the user's sentence.",
        "Use likely policy-catalog wording, but do not broaden to neighboring products or topics and do not invent a policy.",
        "Keep explicitly excluded products excluded. Every query must mean the same thing as the current question or one explicit part of it.",
        "Return JSON only: {\"queries\":[\"search phrase\"]}.",
      ].join("\n"),
      user: JSON.stringify({
        current_question: input.turn.currentQuestion,
        resolved_question: input.turn.standaloneQuestion,
        product_scope: input.turn.productScope,
        excluded_scopes: input.turn.excludedScopes,
      }),
      parse: parseSemanticRecall,
    });
    input.attempts.push(...result.attempts);
    const semanticMatches = result.output.queries.flatMap((query) => {
      const expandedTurn: V3TurnResolution = {
        ...input.turn,
        kind: "new",
        currentQuestion: query,
        standaloneQuestion: query,
        immediatePreviousUserQuestion: null,
        immediatePreviousAssistantAnswer: null,
        usedImmediateContext: false,
        explicitCorrection: false,
        contextMessages: [],
      };
      return retrieveV3Policies(expandedTurn, 16).candidates.slice(0, 12);
    });
    const combined = [
      // Preserve every bounded direct-retrieval result before adding recall
      // expansions. Expanded candidates may add evidence, but must never
      // displace a direct match that was already inside the trusted bound.
      ...input.retrieval.candidates,
      ...semanticMatches,
    ];
    const candidates: V3RetrievalResult["candidates"] = [];
    const seen = new Set<string>();
    for (const match of combined) {
      const key = `${match.policy.policy_key}:${match.policy.product_scopes.join(",")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push(match);
      if (candidates.length >= 32) break;
    }
    return {
      ...input.retrieval,
      semanticQueries: result.output.queries,
      candidates,
      stageTimings: { ...input.retrieval.stageTimings, semanticRecallMs: Date.now() - startedAt },
    };
  } catch {
    return {
      ...input.retrieval,
      stageTimings: { ...input.retrieval.stageTimings, semanticRecallMs: Date.now() - startedAt },
    };
  }
}

async function selectApplicableEvidence(input: {
  provider: V3Provider;
  fallbackProvider?: V3Provider | null;
  turn: V3TurnResolution;
  retrieval: V3RetrievalResult;
  attempts: V3ProviderAttempt[];
}) {
  if (!input.retrieval.semanticQueries?.length) return input.retrieval;
  const startedAt = Date.now();
  const cards = input.retrieval.candidates.map((match, index) => ({
    ref: `P${index + 1}`,
    id: match.policy.id,
    title: match.policy.title,
    decision_evidence: match.policy.decision.slice(0, 1000),
    question_families: match.policy.question_families.slice(0, 2),
    product_scopes: match.policy.product_scopes,
    effective_at: match.policy.effective_at,
    authority: match.policy.authority,
  }));
  try {
    const request = {
      purpose: "v3_evidence_selection",
      maxTokens: 650,
      system: [
        "You are the strict evidence-selection stage for an internal sales assistant. You do not answer the question.",
        "Select zero to six cards that directly or semantically equivalently support the requested action, conditions, product, timing, or a clearly separable part of the question.",
        "Meaning must match, but wording does not. Do not reject an applicable card only because the user used natural process wording or synonyms instead of the policy title.",
        "Shared words, the same broad topic, or the same product are not enough. Do not infer permission from silence or combine neighboring policies into a new rule.",
        "Keep genuinely different workflow stages separate, such as sent versus signed, scheduled versus completed, or rescheduled versus paid.",
        "Do not select an exception, cancellation, no-show, reapplication, or failure-condition card unless the question states that condition.",
        "Prefer the smallest sufficient set. It is correct to select no cards when none directly applies.",
        "Return JSON only: {\"selected_refs\":[\"P1\"],\"reason\":\"brief selection rationale\"}.",
      ].join("\n"),
      user: JSON.stringify({
        current_question: input.turn.currentQuestion,
        resolved_question: input.turn.standaloneQuestion,
        product_scope: input.turn.productScope,
        excluded_scopes: input.turn.excludedScopes,
        immediate_context_used: input.turn.usedImmediateContext,
        candidates: cards,
      }),
      parse: parseEvidenceSelection,
    };
    let result = await input.provider<{ selected_refs: string[]; reason: string }>(request);
    input.attempts.push(...result.attempts);
    if (input.fallbackProvider && result.output.selected_refs.length <= 1 && input.retrieval.candidates.length >= 16) {
      try {
        const fallback = await input.fallbackProvider<{ selected_refs: string[]; reason: string }>(request);
        input.attempts.push(...fallback.attempts);
        result = fallback;
      } catch {
        // DeepSeek remains authoritative when the optional Claude safety
        // fallback is unavailable. Final grounding can still fail closed.
      }
    }
    const byRef = new Map(cards.map((card, index) => [card.ref, input.retrieval.candidates[index]]));
    const candidates = result.output.selected_refs.flatMap((ref) => {
      const match = byRef.get(ref);
      return match ? [match] : [];
    });
    return {
      ...input.retrieval,
      preselectionCandidateCount: input.retrieval.candidates.length,
      evidenceSelectionReason: result.output.reason,
      candidates,
      stageTimings: {
        ...input.retrieval.stageTimings,
        evidenceSelectionMs: Date.now() - startedAt,
      },
    };
  } catch {
    return {
      ...input.retrieval,
      preselectionCandidateCount: input.retrieval.candidates.length,
      evidenceSelectionReason: "Evidence selection failed; retained the strongest bounded candidates.",
      candidates: input.retrieval.candidates.slice(0, 12),
      stageTimings: {
        ...input.retrieval.stageTimings,
        evidenceSelectionMs: Date.now() - startedAt,
      },
    };
  }
}

function composerSystemPrompt() {
  return [
    "You are Ask Sales FAQ V3, a natural and precise assistant for sales reps on live calls.",
    "Your job is to answer the exact current question using only applicable evidence cards supplied in this request.",
    "Evidence cards are candidates, not automatically applicable answers. Reject cards about a different product, action, person, timing, exception, or topic.",
    "Select the smallest coherent set of cards that answers the question. A product-agnostic card can apply to a named product when its decision directly covers the requested action; do not reject it only because the show name is absent.",
    "Shared words or a shared domain are not enough. A generic close flow, routing note, or neighboring process does not answer a question about verification, eligibility, timing, or whether a corrected product changes the answer.",
    "Honor explicit scope and negation. If the user says main ISTV and not DJ/NLCEO, never use DJ/NLCEO-only policy, and vice versa.",
    "For a follow-up, the IMMEDIATE previous user question and assistant answer are the antecedent. Never jump back two turns. If the user corrects the product or entity, re-answer the immediate previous action for the corrected scope.",
    "Answer the question asked. Do not dump adjacent knowledge-base facts, internal process notes, or irrelevant caveats.",
    "Combine multiple applicable cards when the question has multiple parts. Mark every part answered, partial, or unresolved in coverage.",
    "When evidence is incomplete, answer the supported part and route only the unresolved part. Never invent a fact, number, link, exception, owner, or channel.",
    "For a partial answer, preserve any directly relevant supported premise or rule, then name only the exact missing method, timing, or exception. Do not let a narrower conditional card erase a broader card that directly answers part of the question.",
    "When a strict selection rationale is supplied, use it only as a map of which question parts may be supported. Verify every statement against the evidence cards themselves, but do not silently discard a supported part the selector identified.",
    "Use a warm, concise, ChatGPT-like tone. Lead with the answer. Prefer 1-3 short paragraphs; use bullets only when they genuinely improve readability.",
    "When the user requests a list, checklist, or formatting change, put list entries in sections[].items instead of flattening markdown dashes into the answer string.",
    "Do not say 'I could not find that in my knowledge base.' Explain the uncertainty naturally and give the exact approved route when one is available.",
    "Use only the short evidence refs shown on the cards (E1, E2, etc.) in every policy ID field. Never invent, alter, or copy a policy key as an ID.",
    "Every factual sentence must appear in sentence_evidence with one or more supporting evidence refs.",
    "Return one JSON object only with: mode, answer, summary, sections, selected_policy_ids, rejected_policy_ids, coverage, sentence_evidence, needs_route, route_key, route_reason, confidence_score.",
    'Example shape: {"mode":"answer","answer":"...","summary":"...","sections":[],"selected_policy_ids":["E1"],"rejected_policy_ids":[],"coverage":[{"need":"...","status":"answered","policy_ids":["E1"],"reason":"..."}],"sentence_evidence":[{"sentence":"...","policy_ids":["E1"]}],"needs_route":false,"route_key":null,"route_reason":"","confidence_score":85}',
  ].join("\n");
}

function composerUserPrompt(turn: V3TurnResolution, retrieval: V3RetrievalResult) {
  return JSON.stringify({
    current_question: turn.currentQuestion,
    resolved_turn: {
      kind: turn.kind,
      standalone_question: turn.standaloneQuestion,
      immediate_previous_user_question: turn.usedImmediateContext ? turn.immediatePreviousUserQuestion : null,
      immediate_previous_assistant_answer: turn.usedImmediateContext ? turn.immediatePreviousAssistantAnswer : null,
      product_scope: turn.productScope,
      excluded_scopes: turn.excludedScopes,
      style_preferences: turn.stylePreferences,
    },
    approved_routes: registry.route_catalog,
    open_or_conflicting_topics: retrieval.blocked.map((match) => ({
      id: match.topic.id,
      reason: match.topic.resolution,
      score: match.score,
    })),
    strict_selection: retrieval.evidenceSelectionReason
      ? { applied: true, rationale: retrieval.evidenceSelectionReason }
      : { applied: false },
    evidence_cards: policyCards(retrieval),
  });
}

function conversationPrompt(turn: V3TurnResolution) {
  if (turn.kind === "rewrite") {
    const omitRepeatedRoute = /\bwithout repeating (?:the )?route(?: note)?\b|\bdo not repeat (?:the )?route(?: note)?\b/i.test(turn.currentQuestion);
    return {
      system: [
        "Rewrite the immediate previous assistant answer exactly as the user requests.",
        "Preserve its meaning, policy boundaries, numbers, and uncertainty. Add no facts.",
        omitRepeatedRoute
          ? "The user already saw the route note and explicitly asked not to repeat it. Omit that repeated route sentence while preserving any uncertainty in the answer."
          : "Preserve any channel or route instruction from the prior answer.",
        "For a list or checklist, return a concise summary plus one section whose items array contains one clean entry per item. Do not place an inline dash-separated list in the answer field.",
        "Be natural and helpful. Return the same JSON answer schema; use mode conversation and no policy IDs.",
      ].join("\n"),
      user: JSON.stringify({ request: turn.currentQuestion, immediate_previous_answer: turn.immediatePreviousAssistantAnswer }),
    };
  }
  if (turn.kind === "clarification") {
    return {
      system: [
        "The user is asking what information you need to clarify the immediate previous question.",
        "Ask only for the smallest concrete detail needed to resolve that previous question. Do not answer the policy question yet and do not invent policy.",
        "Return JSON with an answer or message field.",
      ].join("\n"),
      user: JSON.stringify({
        request: turn.currentQuestion,
        immediate_previous_question: turn.immediatePreviousUserQuestion,
        immediate_previous_answer: turn.immediatePreviousAssistantAnswer,
      }),
    };
  }
  return {
    system: [
      "Respond naturally and briefly to this conversational message as Ask Sales FAQ.",
      "You can greet, acknowledge, and invite a sales question, but do not invent company policy.",
      "Return the same JSON answer schema; use mode conversation and no policy IDs.",
    ].join("\n"),
    user: JSON.stringify({ message: turn.currentQuestion }),
  };
}

function wantsStructuredRewrite(turn: V3TurnResolution) {
  return turn.kind === "rewrite" && /\b(?:bullet|checklist|list|table|format)\b/i.test(turn.currentQuestion);
}

function hasStructuredItems(output: V3AnswerOutput) {
  return output.sections.some((section) => Boolean(section.items?.length));
}

function normalizeStructuredRewrite(output: V3AnswerOutput, request: string) {
  if (!hasStructuredItems(output)) return output;
  const noun = /\bchecklist\b/i.test(request) ? "checklist" : "list";
  const summary = `Here’s the requested ${noun}.`;
  return { ...output, answer: summary, summary };
}

function selectedPolicies(output: V3AnswerOutput, retrieval: V3RetrievalResult) {
  const allowed = new Map(retrieval.candidates.map((match) => [match.policy.id, match.policy]));
  return output.selected_policy_ids.map((id) => allowed.get(id)).filter((policy): policy is V3Policy => Boolean(policy));
}

function resolveEvidenceRefs(output: V3AnswerOutput, retrieval: V3RetrievalResult): V3AnswerOutput {
  const exactIds = new Set(retrieval.candidates.map((match) => match.policy.id));
  const resolve = (value: string) => {
    if (exactIds.has(value)) return value;
    const matched = value.trim().match(/^e(\d{1,2})$/i);
    if (!matched) return value;
    const index = Number.parseInt(matched[1], 10) - 1;
    return retrieval.candidates[index]?.policy.id || value;
  };
  return {
    ...output,
    selected_policy_ids: output.selected_policy_ids.map(resolve),
    rejected_policy_ids: output.rejected_policy_ids.map(resolve),
    coverage: output.coverage.map((item) => ({ ...item, policy_ids: item.policy_ids.map(resolve) })),
    sentence_evidence: output.sentence_evidence.map((item) => ({ ...item, policy_ids: item.policy_ids.map(resolve) })),
  };
}

function evidenceText(policies: V3Policy[], question: string) {
  return `${question}\n${policies.map((policy) => `${policy.id}: ${policy.decision}`).join("\n")}`.toLowerCase();
}

const NUMERIC_FACT_PATTERN = /(?:\$\s*)?\b\d[\d,.]*(?:%|\s*[-–—]?\s*(?:days?|weeks?|months?|years?))?/gi;

function canonicalNumericFact(value: string) {
  return value
    .toLowerCase()
    .replace(/,/g, "")
    .replace(/[-–—]/g, " ")
    .replace(/\b(days|weeks|months|years)\b/g, (unit) => unit.slice(0, -1))
    .replace(/\$\s+/g, "$")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.]+$/, "");
}

function unsupportedTokens(answer: string, source: string) {
  const answerFacts = Array.from(new Set((answer.match(NUMERIC_FACT_PATTERN) || []).map(canonicalNumericFact)));
  const sourceFacts = new Set((source.match(NUMERIC_FACT_PATTERN) || []).map(canonicalNumericFact));
  return answerFacts.filter((value) => !sourceFacts.has(value));
}

function deterministicValidation(output: V3AnswerOutput, retrieval: V3RetrievalResult, question: string) {
  const allowedIds = new Set(retrieval.candidates.map((match) => match.policy.id));
  const invalidSelectedIds = output.selected_policy_ids.filter((id) => !allowedIds.has(id));
  const policies = selectedPolicies(output, retrieval);
  const invalidSentenceIds = output.sentence_evidence.flatMap((entry) => entry.policy_ids).filter((id) => !allowedIds.has(id));
  const unsupported = unsupportedTokens(output.answer, evidenceText(policies, question));
  const unknownChannels = (output.answer.match(/#[a-z0-9_-]+/gi) || []).filter((channel) => !ALLOWED_CHANNELS.has(channel));
  const errors = [
    invalidSelectedIds.length ? `invalid selected IDs: ${invalidSelectedIds.join(", ")}` : "",
    invalidSentenceIds.length ? `invalid sentence evidence IDs: ${invalidSentenceIds.join(", ")}` : "",
    unsupported.length ? `unsupported numeric claims: ${unsupported.join(", ")}` : "",
    unknownChannels.length ? `unapproved channels: ${unknownChannels.join(", ")}` : "",
    output.mode !== "conversation" && output.mode !== "route" && !policies.length ? "answer has no selected evidence" : "",
    !output.answer ? "empty answer" : "",
  ].filter(Boolean);
  return { pass: errors.length === 0, errors, policies };
}

function parseValidationOutput(content: string): V3ValidationResult {
  const raw = parseV3Json<Record<string, unknown>>(content);
  const verdict = ["pass", "repair", "reject"].includes(String(raw.verdict))
    ? (raw.verdict as V3ValidationResult["verdict"])
    : "reject";
  return {
    verdict,
    mode: ["answer", "partial", "route", "conversation"].includes(String(raw.mode))
      ? (raw.mode as V3AnswerOutput["mode"])
      : undefined,
    answer: cleanDisplayText(raw.answer, 5000),
    summary: cleanDisplayText(raw.summary, 1200),
    sections: parseSections(raw.sections),
    sentence_evidence: Array.isArray(raw.sentence_evidence)
      ? raw.sentence_evidence.slice(0, 20).flatMap((item) => {
          if (!item || typeof item !== "object") return [];
          const value = item as Record<string, unknown>;
          const sentence = clean(value.sentence, 700);
          return sentence ? [{ sentence, policy_ids: stringArray(value.policy_ids, 8) }] : [];
        })
      : [],
    coverage: Array.isArray(raw.coverage) ? parseCoverage(raw.coverage) : undefined,
    needs_route: typeof raw.needs_route === "boolean" ? raw.needs_route : undefined,
    route_key: raw.route_key === null || ALLOWED_ROUTE_KEYS.has(String(raw.route_key)) ? (raw.route_key as string | null) : undefined,
    route_reason: typeof raw.route_reason === "string" ? clean(raw.route_reason, 600) : undefined,
    removed_claims: stringArray(raw.removed_claims),
    reason: clean(raw.reason, 500),
  };
}

async function validateAndRepair(input: {
  provider: V3Provider;
  fallbackProvider?: V3Provider | null;
  turn: V3TurnResolution;
  retrieval: V3RetrievalResult;
  output: V3AnswerOutput;
  attempts: V3ProviderAttempt[];
}): Promise<{ validation: V3ValidationResult; deterministic: ReturnType<typeof deterministicValidation> }> {
  const deterministic = deterministicValidation(input.output, input.retrieval, input.turn.standaloneQuestion);
  if (input.output.mode === "conversation") {
    return {
      validation: { verdict: input.output.answer ? ("pass" as const) : ("reject" as const), answer: input.output.answer, summary: input.output.summary, sections: input.output.sections, sentence_evidence: input.output.sentence_evidence, removed_claims: [], reason: input.output.answer ? "Conversation response is not a policy answer." : "Empty conversation response." },
      deterministic,
    };
  }
  const policies = deterministic.policies;
  if (!policies.length && input.output.mode !== "route") {
    return {
      validation: { verdict: "reject" as const, answer: "", summary: "", sections: [], sentence_evidence: [], removed_claims: [], reason: deterministic.errors.join("; ") || "No selected evidence." },
      deterministic,
    };
  }
  const request = {
    purpose: "v3_grounding_validation",
    maxTokens: 1400,
    system: [
      "Audit and, when needed, repair this Ask Sales FAQ answer sentence by sentence.",
      "The answer may use only the selected evidence below and the user's question. Remove irrelevant facts and unsupported claims.",
      "Require the smallest sufficient evidence set. Supported adjacent facts are still irrelevant when they do not answer a requested part, and must be removed.",
      "The user's question is context, not evidence. A proposed yes/no conclusion is unsupported unless the selected evidence actually states or clearly entails that conclusion.",
      "A product-agnostic decision may apply to a named product when it directly answers the requested action. Treat product_scopes as authoritative: example show names inside a product-agnostic card illustrate the decision but do not narrow its scope unless the decision explicitly says they do. Conversely, a generic process does not answer a question asking how to verify something or whether a corrected product changes the prior answer.",
      "For product/entity corrections, audit against the immediate prior action included in the resolved question. If the evidence cannot answer that corrected action, remove generic process facts and route instead.",
      "A statement that a status is required (for example, that a contract must be signed) does not answer how or where to verify that status. Method questions require evidence that states the method, tool, location, or responsible route.",
      "Reject stitched answers where one card matches the show/entity while a different card supplies the action or decision. One applicable card, or a coherent set of cards, must support the full conclusion.",
      "Do not infer permission from absence of a prohibition. Do not turn examples, neighboring products, couple/partner rules, package discounts, or generic Call 1 flow into a policy for a different case.",
      "Preserve a natural concise tone. Do not add any fact, number, channel, exception, or policy.",
      "If a useful grounded answer remains, return pass or repair. In a partial answer, preserve directly relevant supported facts and remove only the unsupported conclusion or procedure. Return reject only if the selected evidence cannot answer any useful part safely.",
      "Re-evaluate coverage and routing after repair. Do not preserve a route when the repaired answer fully resolves the question; do not remove a route when any part remains unresolved.",
      "Return JSON: verdict, mode, answer, summary, sections, sentence_evidence, coverage, needs_route, route_key, route_reason, removed_claims, reason.",
    ].join("\n"),
    user: JSON.stringify({
      question: input.turn.standaloneQuestion,
      current_message: input.turn.currentQuestion,
      immediate_previous_question: input.turn.usedImmediateContext ? input.turn.immediatePreviousUserQuestion : null,
      product_scope: input.turn.productScope,
      excluded_scopes: input.turn.excludedScopes,
      selected_evidence: policies.map((policy) => ({ id: policy.id, scope: policy.product_scopes, decision: policy.decision })),
      deterministic_errors: deterministic.errors,
      draft: input.output,
    }),
    parse: parseValidationOutput,
  };
  const applyValidation = (repaired: V3ValidationResult) => {
    const repairedOutput: V3AnswerOutput = {
      ...input.output,
      answer: repaired.answer || input.output.answer,
      summary: repaired.summary || input.output.summary,
      sections: repaired.sections.length ? repaired.sections : input.output.sections,
      sentence_evidence: repaired.sentence_evidence.length ? repaired.sentence_evidence : input.output.sentence_evidence,
      mode: repaired.mode || input.output.mode,
      coverage: repaired.coverage || input.output.coverage,
      needs_route: repaired.needs_route ?? input.output.needs_route,
      route_key: repaired.route_key === undefined ? input.output.route_key : repaired.route_key,
      route_reason: repaired.route_reason === undefined ? input.output.route_reason : repaired.route_reason,
    };
    const repairedCheck = deterministicValidation(repairedOutput, input.retrieval, input.turn.standaloneQuestion);
    if (repaired.verdict === "reject" || !repairedCheck.pass) {
      return { validation: { ...repaired, verdict: "reject" as const, reason: [repaired.reason, ...repairedCheck.errors].filter(Boolean).join("; ") }, deterministic: repairedCheck };
    }
    return { validation: repaired, deterministic: repairedCheck };
  };
  const needsMethodSafetyFallback = /\b(?:how|where|which\s+(?:tool|channel|system|page|document|link))\b/i.test(input.turn.currentQuestion) &&
    /\b(?:verify|confirm|find|see|locate|access|check|send|sign|appear|show|display)\b/i.test(input.turn.currentQuestion);
  try {
    const result = await input.provider<V3ValidationResult>(request);
    input.attempts.push(...result.attempts);
    const primary = applyValidation(result.output);
    const needsFallback = result.output.verdict !== "pass" || primary.validation.verdict !== "pass" || needsMethodSafetyFallback;
    if (needsFallback && input.fallbackProvider) {
      try {
        const fallback = await input.fallbackProvider<V3ValidationResult>(request);
        input.attempts.push(...fallback.attempts);
        return applyValidation(fallback.output);
      } catch {
        // DeepSeek remains the primary result when the optional safety
        // fallback is unavailable.
      }
    }
    return primary;
  } catch (error) {
    if (input.fallbackProvider) {
      try {
        const fallback = await input.fallbackProvider<V3ValidationResult>(request);
        input.attempts.push(...fallback.attempts);
        return applyValidation(fallback.output);
      } catch {
        // Continue into deterministic fail-closed handling.
      }
    }
    if (deterministic.pass) {
      return {
        validation: { verdict: "pass" as const, answer: input.output.answer, summary: input.output.summary, sections: input.output.sections, sentence_evidence: input.output.sentence_evidence, removed_claims: [], reason: "Deterministic grounding checks passed; model verifier was unavailable." },
        deterministic,
      };
    }
    return {
      validation: { verdict: "reject" as const, answer: "", summary: "", sections: [], sentence_evidence: [], removed_claims: [], reason: deterministic.errors.join("; ") || clean(error, 400) },
      deterministic,
    };
  }
}

function routeKeyForQuestion(question: string, policies: V3Policy[]) {
  const selectedRouteKeys = Array.from(new Set(policies.map((policy) => policy.route_key).filter(Boolean)));
  if (selectedRouteKeys.length === 1) return selectedRouteKeys[0] as string;
  const normalized = question.toLowerCase();
  if (/\b(?:payment page|checkout|broken link|button|keap|zoom phone|calendar|recording missing|hubspot|login|access|form|dropdown|tool)\b/.test(normalized)) return "sales_tech";
  if (/\b(?:greenlight letter|green light letter|approval letter|greenlight pdf|greenlight status|greenlight cap)\b/.test(normalized)) return "greenlight";
  if (/\b(?:payment|pay|ach|wire|invoice|receipt|refund|charge|installment|billing|bank|card)\b/.test(normalized)) return "finance";
  return "sales_policy";
}

function routeFor(question: string, policies: V3Policy[]) {
  const routeKey = routeKeyForQuestion(question, policies);
  return registry.route_catalog[routeKey] || registry.route_catalog.sales_policy;
}

function safeRouteAnswer(turn: V3TurnResolution, output: V3AnswerOutput | null, retrieval: V3RetrievalResult, reason: string) {
  const policies = output ? selectedPolicies(output, retrieval) : [];
  const route = routeFor(turn.currentQuestion, policies);
  const variants = [
    `I can’t confirm a reliable answer for that exact case from the applicable guidance. Please check ${route.channel} before replying to the prospect.`,
    `I don’t want to guess on that case. Please confirm it in ${route.channel} before giving the prospect an answer.`,
    `That exact situation isn’t resolved by the guidance I can safely use. Please verify it in ${route.channel} before replying.`,
    `I can’t give you a confident policy answer for that specific case yet. The right next step is to check ${route.channel}.`,
  ];
  const variantIndex = Array.from(turn.currentQuestion).reduce((total, char) => total + char.charCodeAt(0), 0) % variants.length;
  return {
    answer: variants[variantIndex],
    routeReason: reason || `The applicable policy is unresolved; use ${route.channel}.`,
    route,
  };
}

function structuredAnswer(output: V3AnswerOutput, answer: string): AskSalesFaqStructuredAnswer {
  const confidenceScore = clampConfidence(output.confidence_score);
  return {
    summary: output.summary || answer,
    sections: output.sections,
    confidenceLabel: confidenceScore >= 80 ? "High" : confidenceScore >= 50 ? "Medium" : "Low",
    confidenceScore,
    sourceMode: output.mode === "conversation" ? "conversation" : output.mode === "route" ? "fallback" : "evidence",
  };
}

function metadata(input: {
  turn: V3TurnResolution;
  retrieval: V3RetrievalResult;
  output: V3AnswerOutput;
  attempts: V3ProviderAttempt[];
  validation: V3ValidationResult;
  stageTimings: Record<string, number>;
}): AskSalesFaqRuntimeMetadata {
  return {
    pipelineVersion: "v3",
    knowledgeVersion: registry.knowledge_version,
    providerAttempts: input.attempts,
    v3: {
      turn: {
        kind: input.turn.kind,
        productScope: input.turn.productScope,
        excludedScopes: input.turn.excludedScopes,
        usedImmediateContext: input.turn.usedImmediateContext,
        previousUserQuestionUsed: Boolean(input.turn.immediatePreviousUserQuestion && input.turn.usedImmediateContext),
        previousAssistantAnswerUsed: Boolean(input.turn.immediatePreviousAssistantAnswer && input.turn.usedImmediateContext),
      },
      retrieval: {
        query: input.retrieval.query.slice(0, 4000),
        semanticQueries: input.retrieval.semanticQueries?.map((query) => query.slice(0, 500)),
        preselectionCandidateCount: input.retrieval.preselectionCandidateCount,
        evidenceSelectionReason: input.retrieval.evidenceSelectionReason,
        candidateCount: input.retrieval.candidates.length,
        candidates: input.retrieval.candidates.map((match) => ({
          id: match.policy.id,
          policyKey: match.policy.policy_key,
          score: match.score,
          qualityTier: match.policy.quality_tier,
          answerability: match.policy.answerability,
          productScopes: match.policy.product_scopes,
          sourceKind: match.policy.source.kind,
        })),
        blockedCandidates: input.retrieval.blocked.map((match) => ({ id: match.topic.id, score: match.score })),
      },
      selection: {
        selectedPolicyIds: input.output.selected_policy_ids,
        rejectedPolicyIds: input.output.rejected_policy_ids,
        coverage: input.output.coverage.map((item) => ({ need: item.need, status: item.status, policyIds: item.policy_ids, reason: item.reason })),
      },
      validation: {
        verdict: input.validation.verdict,
        reason: input.validation.reason,
        removedClaims: input.validation.removed_claims,
      },
      stageTimings: input.stageTimings,
    },
  };
}

function baseOutput(answer: string, mode: V3AnswerOutput["mode"]): V3AnswerOutput {
  return {
    mode,
    answer,
    summary: answer,
    sections: [],
    selected_policy_ids: [],
    rejected_policy_ids: [],
    coverage: [],
    sentence_evidence: [],
    needs_route: false,
    route_key: null,
    route_reason: "",
    confidence_score: mode === "conversation" ? 100 : 0,
  };
}

export async function runAskSalesFaqV3(
  question: string,
  conversationMessages: AskSalesFaqChatMessage[] = [],
  options: V3RuntimeOptions = {},
): Promise<AskSalesFaqV3RuntimeResult> {
  const startedAt = Date.now();
  const stageTimings: Record<string, number> = {};
  const provider = options.provider || generateV3Json;
  const validatorProvider = options.validatorProvider || options.provider || generateV3ValidationJson;
  const fallbackProvider = options.fallbackProvider || (options.provider ? null : generateV3ClaudeFallbackJson);
  const redacted = redactSensitiveText(question);
  const sanitizedMessages = conversationMessages.map((message) => ({ role: message.role, content: redactSensitiveText(message.content).text }));
  const turnStarted = Date.now();
  const turn = resolveV3Turn(redacted.text, sanitizedMessages);
  stageTimings.turnResolutionMs = Date.now() - turnStarted;
  const attempts: V3ProviderAttempt[] = [];
  const lexicalRetrieval = turn.kind === "new" || turn.kind === "follow_up" ? retrieveV3Policies(turn) : { query: turn.standaloneQuestion, candidates: [], blocked: [], queryTokens: [], stageTimings: { retrievalMs: 0 } };
  const recalledRetrieval = turn.kind === "new" || turn.kind === "follow_up"
    ? await addSemanticRecall({ provider, turn, retrieval: lexicalRetrieval, attempts })
    : lexicalRetrieval;
  const retrieval = turn.kind === "new" || turn.kind === "follow_up"
    ? await selectApplicableEvidence({ provider, fallbackProvider, turn, retrieval: recalledRetrieval, attempts })
    : recalledRetrieval;
  Object.assign(stageTimings, retrieval.stageTimings);

  let output: V3AnswerOutput;
  let providerName: "deepseek" | "anthropic" | null = null;
  let model: string | null = null;
  let errorClass: string | null = null;

  if (turn.kind === "memory" && turn.memoryAnswer) {
    output = baseOutput(turn.memoryAnswer, "conversation");
  } else {
    try {
      const isConversation = turn.kind === "social" || turn.kind === "rewrite" || turn.kind === "clarification";
      const prompt = isConversation ? conversationPrompt(turn) : { system: composerSystemPrompt(), user: composerUserPrompt(turn, retrieval) };
      const generationStarted = Date.now();
      const result = await provider<V3AnswerOutput>({ purpose: isConversation ? "v3_conversation" : "v3_evidence_answer", system: prompt.system, user: prompt.user, maxTokens: turn.kind === "social" ? 500 : 2200, parse: isConversation ? parseConversationOutput : parseAnswerOutput });
      stageTimings.answerGenerationMs = Date.now() - generationStarted;
      output = isConversation ? result.output : resolveEvidenceRefs(result.output, retrieval);
      attempts.push(...result.attempts);
      providerName = result.provider;
      model = result.model;

      if (wantsStructuredRewrite(turn) && !hasStructuredItems(output) && turn.immediatePreviousAssistantAnswer) {
        try {
          const retry = await provider<V3AnswerOutput>({
            purpose: "v3_conversation",
            system: [
              "Reformat the prior answer without changing, adding, or removing any factual content.",
              "Return JSON with exactly: answer, summary, and sections.",
              "The answer and summary must be one short introduction. Sections must contain one object with a short title and an items array containing one clean list item per original item.",
              "Do not put markdown dashes or the list itself in answer or summary.",
            ].join("\n"),
            user: JSON.stringify({ request: turn.currentQuestion, prior_answer: turn.immediatePreviousAssistantAnswer }),
            maxTokens: 1800,
            parse: parseConversationOutput,
          });
          attempts.push(...retry.attempts);
          if (hasStructuredItems(retry.output)) {
            output = normalizeStructuredRewrite(retry.output, turn.currentQuestion);
            providerName = retry.provider;
            model = retry.model;
          }
        } catch {
          // Preserve the first grounded rewrite if the presentation-only retry
          // fails; policy content must never be replaced by an invented list.
        }
      }
    } catch (error) {
      errorClass = "v3_provider_failure";
      if (turn.kind === "social" || turn.kind === "clarification") {
        output = baseOutput("Hi! I’m ready whenever you are—ask me any sales-policy, offer, payment, or process question.", "conversation");
      } else if (turn.kind === "rewrite" && turn.immediatePreviousAssistantAnswer) {
        output = baseOutput(turn.immediatePreviousAssistantAnswer, "conversation");
      } else {
        const routed = safeRouteAnswer(turn, null, retrieval, clean(error, 400));
        output = { ...baseOutput(routed.answer, "route"), needs_route: true, route_key: Object.entries(registry.route_catalog).find(([, route]) => route.channel === routed.route.channel)?.[0] || "sales_policy", route_reason: routed.routeReason };
      }
    }
  }

  const validationStarted = Date.now();
  const validationResult = await validateAndRepair({ provider: validatorProvider, fallbackProvider, turn, retrieval, output, attempts });
  stageTimings.validationMs = Date.now() - validationStarted;
  const validation = validationResult.validation;
  if (validation.verdict === "pass" || validation.verdict === "repair") {
    output = {
      ...output,
      answer: validation.answer || output.answer,
      summary: validation.summary || output.summary,
      sections: validation.sections.length ? validation.sections : output.sections,
      sentence_evidence: validation.sentence_evidence.length ? validation.sentence_evidence : output.sentence_evidence,
      mode: validation.mode || output.mode,
      coverage: validation.coverage || output.coverage,
      needs_route: validation.needs_route ?? output.needs_route,
      route_key: validation.route_key === undefined ? output.route_key : validation.route_key,
      route_reason: validation.route_reason === undefined ? output.route_reason : validation.route_reason,
    };
  } else {
    const routed = safeRouteAnswer(turn, output, retrieval, validation.reason);
    output = {
      ...baseOutput(routed.answer, "route"),
      rejected_policy_ids: output.selected_policy_ids,
      coverage: output.coverage.map((item) => ({ ...item, status: item.status === "answered" ? "unresolved" : item.status })),
      needs_route: true,
      route_key: Object.entries(registry.route_catalog).find(([, route]) => route.channel === routed.route.channel)?.[0] || "sales_policy",
      route_reason: routed.routeReason,
    };
    errorClass = errorClass || "v3_grounding_rejected";
  }


  if (turn.explicitCorrection && output.needs_route) {
    const routed = safeRouteAnswer(turn, output, retrieval, output.route_reason || validation.reason);
    output = {
      ...baseOutput(routed.answer, "route"),
      rejected_policy_ids: output.rejected_policy_ids,
      coverage: output.coverage,
      needs_route: true,
      route_key: Object.entries(registry.route_catalog).find(([, route]) => route.channel === routed.route.channel)?.[0] || "sales_policy",
      route_reason: routed.routeReason,
    };
  }

  const selected = selectedPolicies(output, retrieval);
  const route = output.route_key && registry.route_catalog[output.route_key]
    ? registry.route_catalog[output.route_key]
    : routeFor(turn.currentQuestion, selected);
  if (output.needs_route && !output.answer.includes(route.channel)) {
    output.answer = `${output.answer.replace(/[.!]?$/, ".")} Use ${route.channel} for the unresolved part.`;
  }
  const answer = cleanDisplayText(output.answer, 5000);
  const outcome: AskSalesFaqOutcome =
    output.mode === "conversation"
      ? "conversation_reply"
      : output.mode === "answer" && !output.needs_route
        ? "answer_from_evidence"
        : output.mode === "partial" || output.mode === "route" || output.needs_route
          ? "route_from_evidence"
          : "abstain_unapproved";
  const matchedArticleId = selected.find((policy) => policy.source.article_id)?.source.article_id || null;
  stageTimings.totalMs = Date.now() - startedAt;
  const runtimeMetadata = metadata({ turn, retrieval, output, attempts, validation, stageTimings });
  const source = selected.length
    ? {
        label: selected.length === 1 ? selected[0].title : `${selected.length} applicable policy records`,
        lastReviewed: selected.map((policy) => policy.last_reviewed).filter(Boolean).sort().at(-1) || registry.generated_at,
        approved: true,
        sourceMode: "evidence" as const,
        confidenceLabel: output.confidence_score >= 80 ? ("High" as const) : output.confidence_score >= 50 ? ("Medium" as const) : ("Low" as const),
        confidenceScore: output.confidence_score,
        expandableDetails: `Knowledge ${registry.knowledge_version}; selected policies: ${selected.map((policy) => policy.id).join(", ")}`,
      }
    : null;

  return {
    ok: true,
    conversationId: "",
    messageId: "",
    answer,
    structuredAnswer: structuredAnswer(output, answer),
    outcome,
    source,
    model,
    provider: providerName,
    needsRoute: output.needs_route || output.mode === "route" || output.mode === "partial",
    routeReason: output.needs_route || output.mode === "route" || output.mode === "partial" ? output.route_reason || `Use ${route.channel} for the unresolved part.` : null,
    redactions: redacted.redactions,
    latencyMs: Date.now() - startedAt,
    sanitizedQuestion: redacted.text,
    contextualQuestion: turn.standaloneQuestion,
    matchedArticleId,
    errorClass,
    runtimeMetadata,
  };
}

import type {
  AskSalesFaqChatMessage,
  AskSalesFaqOutcome,
  AskSalesFaqResponse,
  AskSalesFaqRuntimeMetadata,
  AskSalesFaqStructuredAnswer,
} from "@/lib/ask-sales-faq/types";
import { generateV3Json, generateV3ValidationJson, parseV3Json } from "@/lib/ask-sales-faq/v3/provider";
import { getV3Registry, retrieveV3Policies } from "@/lib/ask-sales-faq/v3/retrieval";
import { applyV3TurnIntentRefinement, resolveV3Turn, shouldRefineV3TurnIntent } from "@/lib/ask-sales-faq/v3/turn-resolver";
import type {
  V3AnswerOutput,
  V3EvidenceContract,
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
};

function clean(value: unknown, limit = 4000) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function cleanDisplayText(value: unknown, limit = 4000) {
  return clean(value, limit)
    .replace(/\s*(?:\(|\[)(?:E\d{1,2}(?:\s*[,;]\s*E\d{1,2})*)(?:\)|\])/gi, "")
    .replace(/\b(?:in|from) my knowledge base\b/gi, "in the current guidance")
    .replace(/\b(?:in|from) (?:the )?(?:provided|supplied) evidence\b/gi, "in the current guidance")
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

function policyDecisionParts(decision: string) {
  const match = decision.match(/^\s*Policy context:\s*([\s\S]*?)\s*Decision evidence:\s*([\s\S]+?)\s*$/i);
  return match
    ? { example_context: clean(match[1], 1000), decision_evidence: clean(match[2], 1400) }
    : { example_context: "", decision_evidence: clean(decision, 1400) };
}

function normalizeText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const EVIDENCE_FLOOR_STOP_WORDS = new Set([
  "a", "an", "and", "are", "be", "can", "could", "do", "does", "for", "from", "have", "how", "i", "in", "is", "it", "may", "of", "on", "or", "our", "should", "the", "their", "them", "they", "this", "through", "to", "we", "what", "when", "where", "which", "who", "with", "would", "you", "your",
]);

function evidenceFloorStem(token: string) {
  if (token.length > 7 && token.endsWith("tion")) return token.slice(0, -4);
  if (token.length > 6 && token.endsWith("ingly")) return token.slice(0, -5);
  if (token.length > 5 && token.endsWith("ing")) return token.slice(0, -3);
  if (token.length > 5 && token.endsWith("ied")) return `${token.slice(0, -3)}y`;
  if (token.length > 4 && token.endsWith("ed")) return token.slice(0, -2);
  if (token.length > 4 && token.endsWith("ly")) return token.slice(0, -2);
  if (token.length > 5 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.length > 5 && /(?:sses|shes|ches|xes|zes)$/.test(token)) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith("s")) return token.slice(0, -1);
  return token;
}

function evidenceFloorTokens(value: string) {
  return Array.from(new Set(
    normalizeText(value)
      .split(" ")
      .filter((token) => token.length >= 3 && !EVIDENCE_FLOOR_STOP_WORDS.has(token))
      .map(evidenceFloorStem),
  ));
}

function decisionOverlapCount(question: string, decision: string) {
  const questionTokens = new Set(evidenceFloorTokens(question));
  return evidenceFloorTokens(decision).filter((token) => questionTokens.has(token)).length;
}

function decisionCoversQuestionTokens(question: string, decision: string) {
  const questionTokens = evidenceFloorTokens(question);
  const decisionTokens = evidenceFloorTokens(decision);
  const sameFamily = (left: string, right: string) => {
    if (left === right) return true;
    if (Math.min(left.length, right.length) < 5 || Math.abs(left.length - right.length) > 2) return false;
    const shorter = Math.min(left.length, right.length);
    let prefix = 0;
    while (prefix < shorter && left[prefix] === right[prefix]) prefix += 1;
    return prefix >= shorter - 1;
  };
  return questionTokens.length >= 4 && questionTokens.every((token) => decisionTokens.some((candidate) => sameFamily(token, candidate)));
}

function isStructurallySingleNeedQuestion(question: string) {
  const normalized = question.trim();
  if (!normalized || normalized.split("?").filter(Boolean).length > 1 || /[;\n]/.test(normalized)) return false;
  return !/\b(?:and|also|plus|then)\s+(?:what|when|where|who|why|how|can|could|should|would|do|does|did|is|are|will)\b/i.test(normalized);
}

function crossesRightsActorBoundary(need: string, decision: string) {
  const asksCompanyRights = /\b(?:we|the company|production|inside success(?: tv)?)\b[^?.]{0,120}\b(?:use|reuse|republish|publish|sell|own|rights?|segment|content)\b/i.test(need) ||
    /\b(?:can|may|does|do)\b[^?.]{0,80}\b(?:we|the company|production|inside success(?: tv)?)\b[^?.]{0,120}\b(?:use|reuse|republish|publish|sell|own|rights?|segment|content)\b/i.test(need);
  const onlyDescribesParticipantRights = /\b(?:cast members?|clients?|prospects?|they|their)\b[^.]{0,160}\b(?:reuse|republish|publish|sell|clips?|episode|content)\b/i.test(decision) &&
    !/\b(?:the company|we|production|inside success(?: tv)?)\b[^.]{0,160}\b(?:use|reuse|republish|publish|sell|own|rights?|segment|content)\b/i.test(decision);
  return asksCompanyRights && onlyDescribesParticipantRights;
}

function crossesPublicContentPrivacyBoundary(need: string, decision: string) {
  const asksForPublishedContent = /\b(?:send|sent|share|shared|show|find|link)\b[^?.]{0,120}\b(?:live|published|public|network|episode|show|video|example)\b|\b(?:live|published|public|network|episode|show|video|example)\b[^?.]{0,120}\b(?:send|sent|share|shared|show|find|link)\b/i.test(need);
  const onlyRestrictsPersonalInformation = /\b(?:(?:do not|don't|cannot|can't|must not)\b[^.]{0,160}\b(?:share|send|give)|does not offer out|doesn't offer out)\b[^.]{0,160}\b(?:cast member|client|prospect|applicant)\b[^.]{0,80}\b(?:info|information|contact|email|phone|details)\b/i.test(decision) &&
    !/\b(?:public|published|network|episode|show|video|link)\b/i.test(decision);
  return asksForPublishedContent && onlyRestrictsPersonalInformation;
}

function missesRequestedTimingStage(need: string, decision: string) {
  if (!/\b(?:when|how long|timing|timeline|turnaround|receive|get|arrive|delivered|sent|clear)\b/i.test(need)) return false;
  const targets: Array<[RegExp, RegExp]> = [
    [/\b(?:receive|get|deliver(?:ed|y)?|sent)\b[^?.]{0,80}\bscript\b|\bscript\b[^?.]{0,80}\b(?:receive|get|deliver(?:ed|y)?|sent)\b/i, /\bscript\b/i],
    [/\b(?:payment|ach|wire)\b[^?.]{0,80}\b(?:clear|confirm|settle)\b|\b(?:clear|confirm|settle)\b[^?.]{0,80}\b(?:payment|ach|wire)\b/i, /\b(?:payment|ach|wire)\b[^.]{0,100}\b(?:clear|confirm|settle)\b|\b(?:clear|confirm|settle)\b[^.]{0,100}\b(?:payment|ach|wire)\b/i],
    [/\bcontract\b[^?.]{0,80}\b(?:sign|signed|signature|sent|receive)\b|\b(?:sign|signed|signature|sent|receive)\b[^?.]{0,80}\bcontract\b/i, /\bcontract\b[^.]{0,100}\b(?:sign|signed|signature|sent|receive)\b|\b(?:sign|signed|signature|sent|receive)\b[^.]{0,100}\bcontract\b/i],
    [/\b(?:episode|show)\b[^?.]{0,80}\b(?:air|appear|publish|release|live)\b|\b(?:air|appear|publish|release|live)\b[^?.]{0,80}\b(?:episode|show)\b/i, /\b(?:episode|show)\b[^.]{0,100}\b(?:air|appear|publish|release|live)\b|\b(?:air|appear|publish|release|live)\b[^.]{0,100}\b(?:episode|show)\b/i],
  ];
  return targets.some(([needPattern, evidencePattern]) => needPattern.test(need) && !evidencePattern.test(decision));
}

function hasConditionalCurrentnessGap(need: string, decision: string) {
  return /\b(?:current|currently|still available|right now|now available|latest)\b/i.test(need) &&
    /\b(?:if (?:that |the )?(?:rule|offer|option|plan)?\s*is still current|if still current|appears to be|may still|might still|unclear whether .*current)\b/i.test(decision);
}

function hasUnmatchedExplicitCondition(need: string, decision: string) {
  const conditionFamilies = [
    /\b(?:declin(?:e|es|ed|ing)|refus(?:e|es|ed|ing)|opt(?:s|ed|ing)? out|does not buy|doesn't buy|without (?:buying|purchasing|paying))\b/i,
    /\b(?:if|when|once|after|before|was|is|gets?|got|been|being)\s+(?:greenlit|approved|rejected|denied)\b|\bgreenlight(?:ed)?\b/i,
    /\b(?:cancel(?:s|ed|ing|lation)?|no[ -]?show|miss(?:es|ed|ing) (?:the )?(?:call|meeting|appointment))\b/i,
    /\b(?:pending|fail(?:s|ed|ing|ure)?|did not clear|didn't clear|declined payment)\b/i,
    /\b(?:bankrupt(?:cy)?|insolven(?:t|cy)|chapter\s+(?:7|11|13))\b/i,
  ];
  return conditionFamilies.some((pattern) => pattern.test(need) && !pattern.test(decision));
}

function hasUnmatchedControllingCondition(need: string, decision: string) {
  const controllingConditions = [
    /\b(?:bankrupt(?:cy)?|insolven(?:t|cy)|chapter\s+(?:7|11|13))\b/i,
  ];
  return controllingConditions.some((pattern) => pattern.test(need) && !pattern.test(decision));
}

function hasUnprovenExclusivity(need: string, decision: string) {
  if (!/\b(?:only|exclusively|limited to|restricted to)\b/i.test(need)) return false;
  const trailingTarget = need.match(/\b(?:only|exclusively)\s+(?:in|to|for|on|with|through|via|as)\s+([a-z][a-z0-9-]{2,})\b/i)?.[1] ||
    need.match(/\b(?:only|exclusively)\s+([a-z][a-z0-9-]{2,})\b/i)?.[1];
  const precedingTarget = need.match(/\b([a-z][a-z0-9-]{2,})\s+(?:only|exclusively)\b/i)?.[1];
  const namedTarget = trailingTarget ||
    (precedingTarget && !/(?:ed|ing|able)$/i.test(precedingTarget) ? precedingTarget : null) ||
    need.match(/\b(?:limited|restricted) to\s+([a-z][a-z0-9-]{2,})\b/i)?.[1];
  if (namedTarget && !decisionCoversQuestionTokens(namedTarget, decision) && !normalizeText(decision).includes(normalizeText(namedTarget))) return true;
  return !/\b(?:only|exclusively|limited to|restricted to)\b/i.test(decision);
}

function hasUnmatchedRelationalScenario(need: string, policy: V3Policy) {
  const descriptor = [policy.title, ...policy.question_families, policy.decision].join(" ");
  const requiresMultiPartyConflict = /\b(?:same|duplicate)\s+(?:prospect|lead|contact)\b[^.]{0,180}\b(?:two|multiple|both|other|another)\s+(?:reps?|calendars?|owners?|bookings?)\b|\b(?:two|multiple|both|other|another)\s+(?:reps?|calendars?|owners?)\b[^.]{0,180}\b(?:same|duplicate)\s+(?:prospect|lead|contact)\b|\b(?:two[- ]calendar|ownership conflict|other rep|another rep)\b/i.test(descriptor);
  if (!requiresMultiPartyConflict) return false;

  const statesMultiPartyConflict = /\b(?:same|duplicate)\s+(?:prospect|lead|contact)\b|\b(?:two|multiple|both|other|another|second)\s+(?:reps?|calendars?|owners?|bookings?)\b|\b(?:ownership conflict|double[- ]booked|booked twice|already booked with)\b|\b(?:my|one)\s+calendar\b[^?.]{0,120}\b(?:their|his|her|another|other|second|\w+'s)\s+calendar\b/i.test(need);
  return !statesMultiPartyConflict;
}

function misappliesCustomSplitBoundary(
  question: string,
  relation: V3EvidenceContract["support"][number]["relation"],
  decision: string,
  supportedClaim = "",
  reason = "",
) {
  if (relation === "route") return false;
  const amountTokens = question.match(/\$\s*\d[\d,]*(?:\.\d+)?\s*[km]?\b/gi) || [];
  const normalizedAmounts = new Set(amountTokens.map((value) => value.toLowerCase().replace(/[\s,]/g, "")));
  const dividesOneTotal = normalizedAmounts.size === 1 && /\b(?:split|divide|divided|installments?|payments?)\b/i.test(question);
  const statesCustomDeviation = /\b(?:custom|exception|unlisted|unequal|different\s+amounts?)\b/i.test(question) ||
    /\b(?:deposit|down\s+payment|first\s+payment)\s+(?:of|is|would\s+be)\s*\$/i.test(question) ||
    /\b(?:pay|payment)\s+\$[^?.]{0,80}\b(?:later|next\s+(?:week|month)|in\s+\d+\s+(?:days?|weeks?|months?))\b/i.test(question);
  // A single total divided into installments is not, by itself, evidence that
  // the user proposed a custom amount or schedule. Product-specific listed-plan
  // evidence may still answer it; a generic custom-split prohibition may not.
  if (!dividesOneTotal || statesCustomDeviation) return false;
  const decisionIsGenericBoundary = /\bcustom\s+(?:payment\s+)?(?:plan|split|amount|link)s?\b/i.test(decision) ||
    /\b(?:use|offer)\s+only\b[^.]{0,100}\blisted\s+(?:payment\s+)?plans?\b/i.test(decision);
  const selectionInventsDeviation = /\b(?:not\s+(?:an?\s+)?allowed|prohibit(?:ed)?|custom\s+(?:payment\s+)?split|not\s+(?:among|in)\s+the\s+listed|unlisted)\b/i.test(`${supportedClaim} ${reason}`);
  return decisionIsGenericBoundary && selectionInventsDeviation;
}

function missesRequestedArtifact(need: string, policy: V3Policy) {
  const artifactBefore = need.match(/\b((?:[a-z][a-z0-9-]*\s+){1,4})(list|document|link|template|spreadsheet|pdf)\b/i);
  const artifactAfter = need.match(/\b(list|document|link|template|spreadsheet|pdf)\s+(?:of|for|to)\s+((?:[a-z][a-z0-9-]*\s*){1,5})/i);
  if (!artifactBefore && !artifactAfter) return false;
  const qualifierText = artifactAfter?.[2] || artifactBefore?.[1] || "";
  const qualifiers = qualifierText
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token && !/^(?:a|an|the|this|that|which|what|current|latest|approved|included|relevant|correct|exact|where|find|stored|available)$/.test(token));
  if (!qualifiers.length) return false;
  const descriptor = [policy.title, ...policy.question_families, policy.decision].join(" ");
  const normalizedDescriptor = normalizeText(descriptor);
  return !qualifiers.some((token) => normalizedDescriptor.includes(normalizeText(token)));
}

function hasDanglingEnumerationReference(need: string, decision: string) {
  const asksForValues = /\b(?:what|which)\b[^?.]{0,140}\b(?:options?|plans?|prices?|amounts?|splits?|packages?|shows?|list)\b|\b(?:list|show|give|provide|enumerate)\b[^?.]{0,100}\b(?:options?|plans?|prices?|amounts?|splits?|packages?|shows?)\b/i.test(need);
  if (!asksForValues || !/\b(?:above|below|the listed (?:options?|plans?|prices?|amounts?|splits?|packages?|shows?))\b/i.test(decision)) return false;
  const numericItems = decision.match(/\$\s*\d|\b\d[\d,.]*\s*(?:%|x\s*\d|payments?)\b/gi)?.length || 0;
  const tableCells = decision.match(/\|/g)?.length || 0;
  const dashItems = decision.match(/(?:^|\s)-\s+[A-Z]/g)?.length || 0;
  return numericItems < 2 && tableCells < 6 && dashItems < 3;
}

function minimalDecisionEvidence(need: string, decision: string) {
  const needTokens = new Set(
    normalizeText(need)
      .split(" ")
      .filter((token) => token.length > 2 && !/^(?:the|and|for|with|that|this|what|which|where|when|does|will|would|could|should|have|from|into|their|they|them|client|prospect|current|currently|available)$/.test(token)),
  );
  const clauses = clean(decision, 1400)
    .split(/(?:[.;]|\s+\|\s+|\n|\s+-\s+)/)
    .map((clause) => clean(clause, 600))
    .filter((clause) => clause.length > 8);
  if (!clauses.length) return clean(decision, 600);
  const ranked = clauses.map((clause, index) => ({
    clause,
    index,
    score: normalizeText(clause).split(" ").reduce((score, token) => score + (needTokens.has(token) ? 1 : 0), 0),
  })).sort((left, right) => right.score - left.score || left.index - right.index);
  return ranked[0]?.score ? ranked[0].clause : clean(decision, 600);
}

function policyCards(retrieval: V3RetrievalResult) {
  // Retrieval already applies the bounded candidate limit. Keep that single
  // limit authoritative so a relevant lower-ranked card cannot appear in
  // diagnostics yet be silently withheld from the composer.
  return retrieval.candidates.map((match, index) => ({
    rank: index + 1,
    ref: `E${index + 1}`,
    policy_key: match.policy.policy_key,
    decision_key: match.policy.decision_key,
    title: match.policy.title,
    ...policyDecisionParts(match.policy.decision),
    question_families: match.policy.question_families.slice(0, 3),
    scope: match.policy.product_scopes,
    domains: match.policy.domains,
    actions: match.policy.actions,
    risk: match.policy.risk_level,
    answerability: match.policy.answerability,
    quality_tier: match.policy.quality_tier,
    route_key: match.policy.route_key,
    route_channel: match.policy.route_channel,
    route_reason: match.policy.route_reason,
    authority: match.policy.authority,
    effective_at: match.policy.effective_at,
    specificity_priority: match.policy.specificity_priority,
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

function parseTurnIntentRefinement(content: string) {
  const raw = parseV3Json<Record<string, unknown>>(content);
  const kind = raw.kind === "social" ? "social" : raw.kind === "follow_up" ? "follow_up" : "new";
  return {
    kind,
    resolvedQuestion: clean(raw.resolved_question, 1000),
    reason: clean(raw.reason, 500),
  } as const;
}

async function refineAmbiguousTurnIntent(input: {
  provider: V3Provider;
  turn: V3TurnResolution;
  attempts: V3ProviderAttempt[];
}) {
  if (!shouldRefineV3TurnIntent(input.turn)) return input.turn;
  try {
    const result = await input.provider({
      purpose: "v3_turn_intent",
      maxTokens: 350,
      system: [
        "Classify the current message as social, follow_up, or new.",
        "This stage has no policy authority and must not answer the question.",
        "Use social for a pure acknowledgment, thanks, confirmation, or conversational reaction that asks no policy question. Do not force it through policy retrieval merely because it refers to the prior answer.",
        "Use follow_up only when resolving a pronoun, omitted subject, correction, continuation, or condition requires the immediate prior subject. A complete independent question is new even inside the same chat.",
        "If follow_up, produce one resolved_question that combines only the immediate prior subject with the current request. Never include facts from the previous assistant answer.",
        "Return JSON only: {\"kind\":\"social|new|follow_up\",\"resolved_question\":\"...\",\"reason\":\"...\"}.",
      ].join("\n"),
      user: JSON.stringify({
        immediate_previous_user_question: input.turn.immediatePreviousUserQuestion,
        current_message: input.turn.currentQuestion,
      }),
      parse: parseTurnIntentRefinement,
    });
    input.attempts.push(...result.attempts);
    return applyV3TurnIntentRefinement(input.turn, result.output);
  } catch {
    return input.turn;
  }
}

function parseEvidenceSelection(content: string) {
  const raw = parseV3Json<Record<string, unknown>>(content);
  const needs = Array.isArray(raw.needs)
    ? raw.needs.slice(0, 6).flatMap((item, index) => {
        if (!item || typeof item !== "object") return [];
        const value = item as Record<string, unknown>;
        const text = clean(value.text || value.need, 320);
        if (!text) return [];
        return [{ id: `N${index + 1}`, text }];
      })
    : [];
  const needIds = new Set(needs.map((need) => need.id));
  const support = Array.isArray(raw.support)
    ? raw.support.slice(0, 12).flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const value = item as Record<string, unknown>;
        const needId = clean(value.need_id, 20).toUpperCase();
        const relation = ["direct", "partial", "route"].includes(String(value.relation))
          ? (value.relation as "direct" | "partial" | "route")
          : null;
        const refs = stringArray(value.refs || value.policy_ids, 6).map((ref) => ref.toUpperCase());
        if (!needIds.has(needId) || !relation || !refs.length) return [];
        return [{
          need_id: needId,
          relation,
          policy_ids: refs,
          supported_claim: clean(value.supported_claim, 500),
          reason: clean(value.reason, 500),
        }];
      })
    : [];
  const unresolvedNeedIds = new Set(
    stringArray(raw.unresolved_need_ids, 6)
      .map((value) => value.toUpperCase())
      .filter((value) => needIds.has(value)),
  );
  for (const need of needs) {
    if (!support.some((item) => item.need_id === need.id)) unresolvedNeedIds.add(need.id);
  }
  const selectedRefs = Array.from(new Set(support.flatMap((item) => item.policy_ids))).slice(0, 6);
  if (!needs.length) throw new Error("Evidence selection did not return atomic needs.");
  return {
    selected_refs: selectedRefs,
    reason: clean(raw.reason, 800) || support.map((item) => `${item.need_id}:${item.relation}`).join(", "),
    contract: {
      needs,
      support,
      unresolved_need_ids: Array.from(unresolvedNeedIds),
    } satisfies V3EvidenceContract,
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
        "When the user pastes a proposed customer email, sales message, or reply and asks for help, extract the factual business claims that need verification or correction and write separate retrieval queries for those claims. Do not collapse the request into generic email-writing or tone advice.",
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
        explicitScopeSwitch: false,
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
  turn: V3TurnResolution;
  retrieval: V3RetrievalResult;
  attempts: V3ProviderAttempt[];
}) {
  const startedAt = Date.now();
  const cards = input.retrieval.candidates.map((match, index) => ({
    ref: `P${index + 1}`,
    id: match.policy.id,
    title: match.policy.title,
    decision_key: match.policy.decision_key,
    ...policyDecisionParts(match.policy.decision),
    question_families: match.policy.question_families.slice(0, 2),
    product_scopes: match.policy.product_scopes,
    effective_at: match.policy.effective_at,
    authority: match.policy.authority,
    specificity_priority: match.policy.specificity_priority,
    quality_tier: match.policy.quality_tier,
    answerability: match.policy.answerability,
    risk_level: match.policy.risk_level,
    route_key: match.policy.route_key,
    route_channel: match.policy.route_channel,
    route_reason: match.policy.route_reason,
  }));
  try {
    const selectionUser = {
      current_question: input.turn.currentQuestion,
      resolved_question: input.turn.standaloneQuestion,
      product_scope: input.turn.productScope,
      excluded_scopes: input.turn.excludedScopes,
      immediate_context_used: input.turn.usedImmediateContext,
      candidates: cards,
    };
    const request = {
      purpose: "v3_evidence_selection",
      maxTokens: 1100,
      system: [
        "You are the claim-entailment stage for an internal sales assistant. You do not answer the user.",
        "First decompose the resolved question into one to six atomic needs. Each need must contain exactly one decision, fact, method, timing, permission, boundary, or next action that the user explicitly requested.",
        "A pasted customer email, sales message, or proposed reply plus a request for help is an explicit request to verify and correct its factual business claims. Decompose those claims into factual needs; do not use a generic 'email-writing advice' need. Tone and formatting are presentation requests, not policy needs.",
        "Do not add a helpful-sounding need that the user did not ask for. In particular, a yes/no eligibility or permission question does not also request process steps, payment handling, exceptions, caveats, or a next action unless the wording asks for them.",
        "When a question asks which contract, process, or next step to use for a proposed exception, create separate needs for whether the proposal is allowed and for the approved next action. A policy that prohibits the proposed option directly answers the first need; a policy that supplies the replacement action supports the second.",
        "Then evaluate each need independently against the evidence cards. Never require one card to answer the whole question.",
        "For every supported need, return one support record with relation direct, partial, or route and the smallest sufficient card refs.",
        "direct means the decision evidence answers the need. partial means it safely answers only a separable portion or supplies an applicable boundary while a requested detail remains unknown. route means the card supplies only an approved route or support boundary, not the missing fact.",
        "List every need without direct or partial support in unresolved_need_ids. A need may be unresolved even when a different need is answered.",
        "A card's broadly stated decision may answer a separable part even when its original example differs. Use only that applicable decision and never import the example's unrelated conclusion or conditions.",
        "Treat product_scopes as authoritative. A product_agnostic decision applies to a named show or offer when its decision directly answers the requested action; a product name in the question is not a reason to discard it. Example show names inside that card do not narrow the scope.",
        "Apply an operational instruction outside its example trigger only when the decision itself is broadly worded. Keep the broad instruction, but do not import a trigger-specific fact or conclusion.",
        "For a 'why does this exist?' question, a card that explicitly states what the item, policy, or license covers is useful evidence for that separable purpose question even if another requested consequence remains unresolved.",
        "Meaning must match, but wording does not. Do not reject an applicable card only because the user used natural process wording or synonyms instead of the policy title.",
        "Shared words, the same broad topic, or the same product are not enough. Do not infer permission from silence or combine neighboring policies into a new rule.",
        "Preserve scenario triggers and relationships. A technical limitation, availability window, booking buffer, or tool restriction is not a duplicate-record, ownership, or multi-party conflict. Evidence about another rep, two calendars, the same prospect appearing twice, or an ownership conflict applies only when the user's need states that relationship.",
        "A card with a higher specificity_priority is the controlling procedure for that decision key. Prefer it over a broader ownership, process, or topic card when both appear applicable.",
        "All superseded policies have already been removed before this stage. Never reconstruct an older rule from a broader neighboring card when a more specific current decision is present.",
        "Keep genuinely different workflow stages separate, such as sent versus signed, scheduled versus completed, or rescheduled versus paid.",
        "A timeline for one workflow stage is not even partial evidence for another stage's timing. Editing, publication, filming, onboarding, script delivery, payment clearance, and contract signing are distinct stages unless a card explicitly links them.",
        "Keep people, roles, and attributes distinct. Veteran status is not language ability; partner, spouse, guest, owner, rep, and prospect are not interchangeable unless the card explicitly covers that relationship.",
        "Keep rights holders and actors distinct. Evidence about a cast member, client, or prospect's reuse rights never proves the company's production, publication, ownership, or reuse rights, and company rights never prove participant rights.",
        "Keep public content and private personal information distinct. A rule against sharing a cast member's contact or personal information does not prohibit sharing an already-public episode, show, video, or network link.",
        "Resolve amount scope before judging a payment plan. In ordinary wording, 'split the $20K total into four payments' means four installments totaling $20K, not four payments of $20K, unless the user explicitly says '$20K each' or equivalent.",
        "For how/where/verification questions, do not treat a hedged statement such as 'appears to be', 'may be', or 'unclear' as a confirmed method. A requirement that something be signed or paid is not evidence of how to verify it.",
        "For questions asking what is currently available, evidence conditioned with 'if still current', 'may', 'appears', or another unresolved-currentness qualifier is partial at most. Keep current availability unresolved unless another card confirms it.",
        "A condition in the need must be supported by the evidence. A general rule is partial at most when the question asks what happens after a decline, approval, rejection, cancellation, no-show, pending status, or failure that the card never mentions. Do not invent the condition's consequence.",
        "Treat bankruptcy, insolvency, and other explicitly named legal or financial-status conditions as controlling conditions. General business-success, funding, recovery-story, or early-stage guidance cannot answer them unless the decision evidence explicitly addresses that condition.",
        "Do not answer an exclusivity question from silence. Evidence that names a benefit but no platform or restriction can confirm the benefit, but cannot prove it is or is not limited to a named platform.",
        "Keep requested artifacts distinct. A show list is not a media-outlet list; a contract is not its signature-status record; and a script, template, link, calendar, spreadsheet, or document cannot substitute for a different requested artifact merely because both are lists or resources.",
        "A sentence that only says to use options, prices, plans, shows, or a list 'above' or 'below' is not the requested enumeration. Select the self-contained table or list card that contains the actual values; never select a dangling cross-reference alone.",
        "Cards marked route_or_support may support relation route when their explicit boundary or approved route directly applies. They do not prove the missing fact.",
        "Do not discard a directly applicable answer_evidence card merely because it answers in policy language rather than repeating the user's exact wording.",
        "Do not select an exception, cancellation, no-show, reapplication, or failure-condition card unless the question states that condition.",
        "Prefer the smallest sufficient set. It is correct for every need to remain unresolved when nothing applies.",
        "Return JSON only with this exact shape: {\"needs\":[{\"text\":\"one atomic need\"}],\"support\":[{\"need_id\":\"N1\",\"relation\":\"direct\",\"refs\":[\"P1\"],\"supported_claim\":\"what the cards actually support\",\"reason\":\"why the action and scope match\"}],\"unresolved_need_ids\":[\"N2\"],\"reason\":\"brief overall rationale\"}.",
      ].join("\n"),
      user: JSON.stringify(selectionUser),
      parse: parseEvidenceSelection,
    };
    let result = await input.provider<ReturnType<typeof parseEvidenceSelection>>(request);
    input.attempts.push(...result.attempts);
    const hasAnswerSupport = result.output.contract.support.some((item) => item.relation === "direct" || item.relation === "partial");
    const strongAnswerCards = cards.filter((card, index) => {
      const match = input.retrieval.candidates[index];
      return card.answerability === "answer_evidence" && match.familyScore >= 4.5 && match.matchedTerms.length >= 3;
    }).slice(0, 10);
    if ((!result.output.selected_refs.length || (!hasAnswerSupport && strongAnswerCards.length)) && input.retrieval.candidates.length) {
      try {
        const retrySystem = strongAnswerCards.length
          ? [
              "You are a concise second-pass evidence entailment classifier. Do not answer the user.",
              "The atomic needs are already provided. Judge each need only against the compact governed answer_evidence cards.",
              "For the smallest applicable card set, use relation direct when the decision answers the need and partial when it safely answers only a separable portion. These candidates are answer evidence, so relation route is not allowed.",
              "Meaning may match without identical wording. A current-state decision plus an explicit boundary can answer whether that state is limited to the named option; a required method plus a prohibited alternative can answer which method is allowed.",
              "Leave a need unresolved when no decision applies. Do not infer from silence, combine unrelated cards, or import adjacent facts.",
              "Return JSON only: {\"needs\":[{\"text\":\"one atomic need\"}],\"support\":[{\"need_id\":\"N1\",\"relation\":\"direct|partial\",\"refs\":[\"P1\"],\"supported_claim\":\"maximum supported claim\",\"reason\":\"brief entailment reason\"}],\"unresolved_need_ids\":[\"N2\"],\"reason\":\"brief overall rationale\"}.",
            ].join(" ")
          : [
              "You are a concise second-pass evidence entailment classifier. Do not answer the user.",
              "The atomic needs are already provided. Re-evaluate only the compact candidates against each need.",
              "Use direct for an answered need, partial for a safely separable supported portion, and route only when a route_or_support card explicitly supplies the applicable route or boundary.",
              "Leave a need unresolved when nothing applies. Do not infer from silence or combine unrelated cards.",
              "Return JSON only: {\"needs\":[{\"text\":\"one atomic need\"}],\"support\":[{\"need_id\":\"N1\",\"relation\":\"direct|partial|route\",\"refs\":[\"P1\"],\"supported_claim\":\"maximum supported claim\",\"reason\":\"brief entailment reason\"}],\"unresolved_need_ids\":[\"N2\"],\"reason\":\"brief overall rationale\"}.",
            ].join(" ");
        const retry = await input.provider<ReturnType<typeof parseEvidenceSelection>>({
          purpose: "v3_evidence_selection_retry",
          maxTokens: 750,
          system: retrySystem,
          user: JSON.stringify({
            current_question: selectionUser.current_question,
            resolved_question: selectionUser.resolved_question,
            product_scope: selectionUser.product_scope,
            excluded_scopes: selectionUser.excluded_scopes,
            atomic_needs: result.output.contract.needs,
            candidates: strongAnswerCards.length ? strongAnswerCards : cards.slice(0, 10),
          }),
          parse: parseEvidenceSelection,
        });
        input.attempts.push(...retry.attempts);
        const retryHasAnswerSupport = retry.output.contract.support.some((item) => item.relation === "direct" || item.relation === "partial");
        if (retryHasAnswerSupport || !result.output.selected_refs.length && retry.output.selected_refs.length) result = retry;
      } catch {
        // Keep the first DeepSeek selection result. This bounded reconsideration
        // never falls through to raw candidates or a routine Claude audit.
      }
    }
    const selectedHasAnswerSupport = result.output.contract.support.some((item) => item.relation === "direct" || item.relation === "partial");
    const floorNeed = result.output.contract.needs.length === 1
      ? result.output.contract.needs[0].text
      : isStructurallySingleNeedQuestion(input.turn.standaloneQuestion)
        ? input.turn.standaloneQuestion
        : null;
    if (!selectedHasAnswerSupport && floorNeed) {
      const floorCandidates = input.retrieval.candidates
        .map((match, index) => ({
          match,
          ref: cards[index].ref,
          decision: policyDecisionParts(match.policy.decision).decision_evidence,
          overlap: decisionOverlapCount(input.turn.standaloneQuestion, policyDecisionParts(match.policy.decision).decision_evidence),
        }))
        .filter(({ match, overlap }) =>
          match.policy.answerability === "answer_evidence" &&
          match.policy.quality_tier === "canonical" &&
          match.policy.authority >= 90 &&
          match.familyScore >= 4.7 &&
          match.phraseScore >= 4 &&
          match.matchedTerms.length >= 4 &&
          overlap >= 4,
        )
        .sort((left, right) => right.overlap - left.overlap || right.match.familyScore - left.match.familyScore || right.match.score - left.match.score);
      const floorCandidate = floorCandidates[0];
      if (floorCandidate) {
        const need = floorNeed;
        const directlyEntailed = decisionCoversQuestionTokens(input.turn.standaloneQuestion, floorCandidate.decision);
        const coherentSibling = input.retrieval.candidates
          .map((match, index) => ({
            match,
            ref: cards[index].ref,
            decision: policyDecisionParts(match.policy.decision).decision_evidence,
            overlap: decisionOverlapCount(input.turn.standaloneQuestion, policyDecisionParts(match.policy.decision).decision_evidence),
          }))
          .filter(({ match, ref, overlap }) =>
            ref !== floorCandidate.ref &&
            Boolean(floorCandidate.match.policy.source.article_id) &&
            match.policy.source.article_id === floorCandidate.match.policy.source.article_id &&
            match.policy.answerability === "answer_evidence" &&
            match.policy.quality_tier === "canonical" &&
            match.policy.authority >= 90 &&
            match.familyScore >= 4.5 &&
            match.matchedTerms.length >= 3 &&
            overlap >= 2,
          )
          .sort((left, right) => right.overlap - left.overlap || right.match.familyScore - left.match.familyScore || right.match.score - left.match.score)[0];
        const floorSet = directlyEntailed ? [floorCandidate] : coherentSibling ? [floorCandidate, coherentSibling] : [floorCandidate];
        result = {
          ...result,
          output: parseEvidenceSelection(JSON.stringify({
            needs: [{ text: need }],
            support: [{
              need_id: "N1",
              relation: directlyEntailed ? "direct" : "partial",
              refs: floorSet.map((candidate) => candidate.ref),
              supported_claim: floorSet.map((candidate) => candidate.decision).join(" "),
              reason: directlyEntailed
                ? "A canonical high-authority decision covers every meaningful question token. Expose only that decision for independent composition and validation."
                : "A canonical high-authority decision has strong direct wording overlap; one same-article sibling may supply a coherent boundary. Expose only these bounded claims for independent composition and validation.",
            }],
            unresolved_need_ids: directlyEntailed ? [] : ["N1"],
            reason: "Bounded canonical evidence floor applied after both model selection passes abstained.",
          })),
        };
      }
    }
    const byRef = new Map(cards.map((card, index) => [card.ref, input.retrieval.candidates[index]]));
    const initiallySelectedCandidates = result.output.selected_refs.flatMap((ref) => {
      const match = byRef.get(ref);
      return match ? [match] : [];
    });
    const contract: V3EvidenceContract = {
      needs: result.output.contract.needs,
      support: result.output.contract.support.flatMap((item) => {
        const need = result.output.contract.needs.find((entry) => entry.id === item.need_id)?.text || "";
        const applicableMatches = item.policy_ids.flatMap((ref) => {
          const match = byRef.get(ref);
          if (!match) return [];
          const decision = policyDecisionParts(match.policy.decision).decision_evidence;
          const authoritativeNeed = `${input.turn.standaloneQuestion}\n${need}`;
          return crossesRightsActorBoundary(need, decision) ||
            crossesPublicContentPrivacyBoundary(need, decision) ||
            missesRequestedTimingStage(need, decision) ||
            missesRequestedArtifact(need, match.policy) ||
            hasDanglingEnumerationReference(need, decision) ||
            hasUnmatchedRelationalScenario(authoritativeNeed, match.policy) ||
            hasUnmatchedControllingCondition(authoritativeNeed, decision) ||
            misappliesCustomSplitBoundary(input.turn.standaloneQuestion, item.relation, decision, item.supported_claim, item.reason)
            ? []
            : [match];
        });
        if (!applicableMatches.length) return [];
        const conditionalCurrentness = applicableMatches.every((match) => hasConditionalCurrentnessGap(need, policyDecisionParts(match.policy.decision).decision_evidence));
        const conditionGap = applicableMatches.every((match) => hasUnmatchedExplicitCondition(need, policyDecisionParts(match.policy.decision).decision_evidence));
        const exclusivityGap = applicableMatches.every((match) => hasUnprovenExclusivity(need, policyDecisionParts(match.policy.decision).decision_evidence));
        const requiresPartial = conditionalCurrentness || conditionGap || exclusivityGap;
        const minimizeClaim = requiresPartial || item.relation === "partial";
        return [{
          ...item,
          relation: requiresPartial && item.relation === "direct" ? "partial" as const : item.relation,
          policy_ids: applicableMatches.map((match) => match.policy.id),
          hard_boundary: requiresPartial,
          supported_claim: minimizeClaim
            ? applicableMatches.map((match) => minimalDecisionEvidence(need, policyDecisionParts(match.policy.decision).decision_evidence)).join(" ")
            : item.supported_claim,
        }];
      }),
      unresolved_need_ids: result.output.contract.unresolved_need_ids,
    };
    for (const need of contract.needs) {
      if (contract.support.some((item) => item.need_id === need.id && item.relation === "partial") && !contract.unresolved_need_ids.includes(need.id)) {
        contract.unresolved_need_ids.push(need.id);
      }
      if (!contract.support.some((item) => item.need_id === need.id) && !contract.unresolved_need_ids.includes(need.id)) {
        contract.unresolved_need_ids.push(need.id);
      }
    }
    const contractPolicyIds = new Set(contract.support.flatMap((item) => item.policy_ids));
    const candidates = initiallySelectedCandidates.filter((match) => contractPolicyIds.has(match.policy.id));
    return {
      ...input.retrieval,
      preselectionCandidateCount: input.retrieval.candidates.length,
      evidenceSelectionReason: result.output.reason,
      evidenceContract: contract,
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
      evidenceSelectionReason: "Evidence selection failed; no unverified candidates were exposed to composition.",
      evidenceContract: {
        needs: [{ id: "N1", text: input.turn.standaloneQuestion }],
        support: [],
        unresolved_need_ids: ["N1"],
      },
      candidates: [],
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
    "The evidence contract has already decomposed the question and selected the applicable cards. Do not re-run retrieval or silently discard a supported need.",
    "Use only cards cited by the evidence contract, and use every direct or partial support record that answers a requested need. A product-agnostic card applies to a named product when its decision directly covers the requested action.",
    "Shared words or a shared domain are not enough. A generic close flow, routing note, or neighboring process does not answer a question about verification, eligibility, timing, or whether a corrected product changes the answer.",
    "Honor explicit scope and negation. If the user says main ISTV and not DJ/NLCEO, never use DJ/NLCEO-only policy, and vice versa.",
    "For a follow-up, the IMMEDIATE previous user question and assistant answer are the antecedent. Never jump back two turns. If the user corrects the product or entity, re-answer the immediate previous action for the corrected scope.",
    "Answer the question asked. Do not dump adjacent knowledge-base facts, internal process notes, unrequested process steps, or irrelevant caveats.",
    "When the user supplies a proposed customer email, sales message, or reply, return a corrected rep-ready version from the supported factual needs. Preserve supported facts, remove or soften unsupported claims, and route only the unresolved factual parts; never replace the task with generic writing advice.",
    "Coverage must contain every evidence-contract need exactly once. Map direct to answered, partial to partial, and a need with only route support or no support to unresolved.",
    "When evidence is incomplete, answer the supported part and route only the unresolved part. Never invent a fact, number, link, exception, owner, or channel.",
    "Missing evidence does not prove that a document, resource, option, policy, or process does not exist. Say only that its exact status or location is not confirmed by the supplied evidence unless a card explicitly states nonexistence.",
    "When routing is necessary, use only the exact channel from approved_routes for the selected route_key. Do not invent a team, owner, channel, or escalation path.",
    "Choose the route from the unresolved question part only. Words from a part you already answered must not redirect a different unresolved need to the wrong channel.",
    "For a partial answer, preserve any directly relevant supported premise or rule, then name only the exact missing method, timing, or exception. Do not let a narrower conditional card erase a broader card that directly answers part of the question.",
    "For a partial support record, supported_claim is the maximum claim allowed for that need. Do not copy adjacent clauses from the same card unless another support record explicitly selects them for a requested need.",
    "A route support record is an approved next step, not proof of the missing fact. Phrase it as where the rep should verify or ask; never turn it into a confirmed yes/no answer or a method the card does not state.",
    "When a strict selection rationale is supplied, use it only as a map of which question parts may be supported. Verify every statement against the evidence cards themselves, but do not silently discard a supported part the selector identified.",
    "Use a warm, concise, ChatGPT-like tone. Lead with the answer. Prefer 1-3 short paragraphs; use bullets only when they genuinely improve readability.",
    "When the user requests a list, checklist, or formatting change, put list entries in sections[].items instead of flattening markdown dashes into the answer string.",
    "Whenever an answer contains three or more named choices, packages, prices, steps, or options, put one clean entry per item in sections[].items even if the user did not explicitly ask for a list.",
    "Do not put Markdown markers such as **bold** or flattened dash lists in answer, summary, section bodies, or section items. The UI supplies its own typography and bullets.",
    "Do not say 'I could not find that in my knowledge base.' Explain the uncertainty naturally and give the exact approved route when one is available.",
    "Use only the short evidence refs shown on the cards (E1, E2, etc.) in every policy ID field. Never invent, alter, or copy a policy key as an ID.",
    "Every factual sentence must appear in sentence_evidence with one or more supporting evidence refs.",
    "Return one JSON object only with: mode, answer, summary, sections, selected_policy_ids, rejected_policy_ids, coverage, sentence_evidence, needs_route, route_key, route_reason, confidence_score.",
    'Example shape: {"mode":"answer","answer":"...","summary":"...","sections":[],"selected_policy_ids":["E1"],"rejected_policy_ids":[],"coverage":[{"need":"...","status":"answered","policy_ids":["E1"],"reason":"..."}],"sentence_evidence":[{"sentence":"...","policy_ids":["E1"]}],"needs_route":false,"route_key":null,"route_reason":"","confidence_score":85}',
  ].join("\n");
}

function composerUserPrompt(turn: V3TurnResolution, retrieval: V3RetrievalResult) {
  const evidenceCards = policyCards(retrieval);
  const evidenceRefByPolicyId = new Map(retrieval.candidates.map((match, index) => [match.policy.id, `E${index + 1}`]));
  const evidenceContract = retrieval.evidenceContract
    ? {
        needs: retrieval.evidenceContract.needs,
        support: retrieval.evidenceContract.support.map((item) => ({
          ...item,
          policy_ids: item.policy_ids.flatMap((policyId) => {
            const ref = evidenceRefByPolicyId.get(policyId);
            return ref ? [ref] : [];
          }),
        })),
        unresolved_need_ids: retrieval.evidenceContract.unresolved_need_ids,
      }
    : null;
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
      ? { applied: true, rationale: retrieval.evidenceSelectionReason, contract: evidenceContract }
      : { applied: false },
    evidence_cards: evidenceCards,
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

function wantsRepeatedRouteOmitted(turn: V3TurnResolution) {
  return turn.kind === "rewrite" && /\bwithout repeating (?:the )?route(?: note)?\b|\bdo not repeat (?:the )?route(?: note)?\b/i.test(turn.currentQuestion);
}

function omitRepeatedRouteNote(output: V3AnswerOutput) {
  const strip = (value: string) => cleanDisplayText(
    value.replace(/(?:^|\s)(?:use|check|please check)\s+#[a-z0-9_-]+[^.!?]*(?:[.!?]|$)/gi, " "),
    5000,
  );
  return {
    ...output,
    answer: strip(output.answer),
    summary: strip(output.summary),
    sections: output.sections.map((section) => ({
      ...section,
      body: section.body ? strip(section.body) : section.body,
      items: section.items?.filter((item) => !/#(?:sales|ft)-[a-z0-9_-]+/i.test(item)).map(strip),
    })),
  };
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

const NUMERIC_FACT_PATTERN = /(?:\$\s*)?\b\d[\d,.]*\s*[km]?(?:%|\s*[-–—]?\s*(?:days?|weeks?|months?|years?))?/gi;

function canonicalNumericFact(value: string) {
  return value
    .toLowerCase()
    .replace(/(\$?\s*)(\d+(?:\.\d+)?)\s*([km])\b/g, (_match, prefix: string, amount: string, scale: string) => {
      const multiplier = scale === "m" ? 1_000_000 : 1_000;
      return `${prefix}${Number.parseFloat(amount) * multiplier}`;
    })
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
  if (!Array.isArray(raw.sentence_checks) || !Array.isArray(raw.need_checks)) {
    throw new Error("V3 validation response omitted required structured checks");
  }
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
    sentence_checks: Array.isArray(raw.sentence_checks)
      ? raw.sentence_checks.slice(0, 20).flatMap((item) => {
          if (!item || typeof item !== "object") return [];
          const value = item as Record<string, unknown>;
          const sentenceRef = clean(value.sentence_ref, 20).toUpperCase();
          const status = ["supported", "unsupported", "irrelevant"].includes(String(value.status))
            ? (value.status as "supported" | "unsupported" | "irrelevant")
            : null;
          if (!/^S\d+$/.test(sentenceRef) || !status) return [];
          return [{ sentence_ref: sentenceRef, status, policy_ids: stringArray(value.evidence_refs || value.policy_ids, 8), reason: clean(value.reason, 500) }];
        })
      : [],
    need_checks: Array.isArray(raw.need_checks)
      ? raw.need_checks.slice(0, 8).flatMap((item) => {
          if (!item || typeof item !== "object") return [];
          const value = item as Record<string, unknown>;
          const needRef = clean(value.need_ref, 20).toUpperCase();
          const status = ["answered", "partial", "unresolved"].includes(String(value.status))
            ? (value.status as "answered" | "partial" | "unresolved")
            : null;
          if (!/^N\d+$/.test(needRef) || !status) return [];
          return [{ need_ref: needRef, status, policy_ids: stringArray(value.evidence_refs || value.policy_ids, 8), reason: clean(value.reason, 500) }];
        })
      : [],
  };
}

async function validateAndRepair(input: {
  provider: V3Provider;
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
  if (!policies.length && input.output.mode === "route" && deterministic.pass) {
    return {
      validation: {
        verdict: "pass" as const,
        mode: "route",
        answer: input.output.answer,
        summary: input.output.summary,
        sections: input.output.sections,
        sentence_evidence: [],
        coverage: input.retrieval.evidenceContract?.needs.map((need) => ({
          need: need.text,
          status: "unresolved" as const,
          policy_ids: [],
          reason: "No applicable approved evidence was selected.",
        })) || input.output.coverage,
        needs_route: true,
        route_key: input.output.route_key,
        route_reason: input.output.route_reason,
        removed_claims: [],
        reason: "No applicable approved evidence was selected; preserved the fail-closed route.",
      },
      deterministic,
    };
  }
  if (!policies.length) {
    return {
      validation: { verdict: "reject" as const, answer: "", summary: "", sections: [], sentence_evidence: [], removed_claims: [], reason: deterministic.errors.join("; ") || "No selected evidence." },
      deterministic,
    };
  }
  const validationRefs = new Map(policies.map((policy, index) => [`V${index + 1}`.toLowerCase(), policy.id]));
  const validationRefByPolicyId = new Map(policies.map((policy, index) => [policy.id, `V${index + 1}`]));
  const exactValidationIds = new Set(policies.map((policy) => policy.id));
  const sentenceClaims = input.output.sentence_evidence.map((entry, index) => ({
    ref: `S${index + 1}`,
    sentence: entry.sentence,
    claimed_evidence_refs: entry.policy_ids.flatMap((policyId) => {
      const ref = validationRefByPolicyId.get(policyId);
      return ref ? [ref] : [];
    }),
  }));
  const contractNeeds = input.retrieval.evidenceContract?.needs || input.output.coverage.map((item, index) => ({ id: `N${index + 1}`, text: item.need }));
  const contractSupport = (input.retrieval.evidenceContract?.support || []).map((item) => ({
    need_id: item.need_id,
    relation: item.relation,
    evidence_refs: item.policy_ids.flatMap((policyId) => {
      const ref = validationRefByPolicyId.get(policyId);
      return ref ? [ref] : [];
    }),
    supported_claim: item.supported_claim,
    hard_boundary: Boolean(item.hard_boundary),
  }));
  const request = {
    purpose: "v3_grounding_validation",
    maxTokens: 1400,
    system: [
      "Audit and, when needed, repair this Ask Sales FAQ answer using a constrained sentence-and-need entailment contract.",
      "The answer may use only the selected evidence below and the user's question. Remove irrelevant facts and unsupported claims.",
      "Require the smallest sufficient evidence set. Supported adjacent facts are still irrelevant when they do not answer a requested part, and must be removed.",
      "The user's question is context, not evidence. A proposed yes/no conclusion is unsupported unless the selected evidence actually states or clearly entails that conclusion.",
      "Text pasted as a proposed customer email, sales message, or reply is also context, not evidence. Audit each factual business claim in that draft, preserve supported corrections, remove unsupported claims, and keep only genuinely unresolved facts routed.",
      "A product-agnostic decision may apply to a named product when it directly answers the requested action. Treat product_scopes as authoritative: example show names inside a product-agnostic card illustrate the decision but do not narrow its scope unless the decision explicitly says they do. Conversely, a generic process does not answer a question asking how to verify something or whether a corrected product changes the prior answer.",
      "Do not reject a product-agnostic answer merely because the user's named product does not appear in the decision text. First compare the requested action to the decision; if that action matches, the named product is within scope unless the decision explicitly excludes it.",
      "When a broadly worded operational instruction applies across situations, preserve that instruction without importing details from its original example trigger.",
      "Preserve scenario triggers and relationships. A technical limitation, availability window, booking buffer, or tool restriction is not a duplicate-record, ownership, or multi-party conflict. Evidence about another rep, two calendars, the same prospect appearing twice, or an ownership conflict is inapplicable unless the user's need states that relationship. This applies to route instructions as well as direct answers.",
      "A timeline for one workflow stage is irrelevant to another stage's timing unless the evidence explicitly links them. Editing, publication, filming, onboarding, script delivery, payment clearance, and contract signing must stay distinct.",
      "Conditional-currentness evidence such as 'if still current', 'may', or 'appears' cannot fully answer a question asking what is currently available. Preserve the supported conditional fact and keep currentness partial or unresolved.",
      "A condition in the user's need must be supported by the evidence. A general rule is partial at most when the question asks what happens after a decline, approval, rejection, cancellation, no-show, pending status, or failure that the evidence never mentions. Remove any invented consequence while preserving the general supported boundary.",
      "Treat bankruptcy, insolvency, and other explicitly named legal or financial-status conditions as controlling conditions. General business-success, funding, recovery-story, or early-stage guidance cannot answer them unless the evidence explicitly addresses that condition.",
      "Do not infer exclusivity or non-exclusivity from silence. If evidence confirms a benefit but does not name the platform or restriction the user asks about, preserve the benefit and keep the platform boundary unresolved.",
      "Keep requested artifacts distinct. A show list is not a media-outlet list; a contract is not its signature-status record; and a script, template, link, calendar, spreadsheet, or document cannot substitute for a different requested artifact merely because both are lists or resources.",
      "For product/entity corrections, audit against the immediate prior action included in the resolved question. If the evidence cannot answer that corrected action, remove generic process facts and route instead.",
      "A statement that a status is required (for example, that a contract must be signed) does not answer how or where to verify that status. Method questions require evidence that states the method, tool, location, or responsible route.",
      "Keep entities, roles, and attributes distinct. Veteran status is not language ability; partner, spouse, guest, owner, rep, and prospect are not interchangeable unless the evidence explicitly covers that relationship.",
      "Keep rights holders and actors distinct. Evidence about a cast member, client, or prospect's reuse rights never proves the company's production, publication, ownership, or reuse rights, and company rights never prove participant rights.",
      "Keep public content and private personal information distinct. A rule against sharing a cast member's contact or personal information does not prohibit sharing an already-public episode, show, video, or network link.",
      "Resolve amount scope before auditing a payment answer. In ordinary wording, 'split the $20K total into four payments' means four installments totaling $20K, not four payments of $20K, unless the user explicitly says '$20K each' or equivalent.",
      "Reject stitched answers where one card matches the show/entity while a different card supplies the action or decision. One applicable card, or a coherent set of cards, must support the full conclusion.",
      "Do not infer permission from absence of a prohibition. Do not turn examples, neighboring products, couple/partner rules, package discounts, or generic Call 1 flow into a policy for a different case.",
      "Missing evidence does not prove that a document, resource, option, policy, or process does not exist. Remove unsupported claims such as 'we do not have one' unless selected evidence explicitly states that fact.",
      "Use only the exact approved route_key and its channel when routing. Remove invented team, owner, channel, or escalation instructions.",
      "Choose route_key from the unresolved coverage items only. Do not let an answered payment, contract, or product detail route a different unresolved timing, production, or resource question to the wrong channel.",
      "Preserve a natural concise tone. Do not add any fact, number, channel, exception, or policy.",
      "For three or more named choices, packages, prices, steps, or options, preserve the facts but return one clean entry per item in sections[].items. Do not emit Markdown markers or flattened dash lists in any display string.",
      "Preserve exact policy qualifiers and operational nouns. Do not replace 'matching contract' with 'standard contract', or otherwise strengthen, generalize, or rename the approved instruction.",
      "Evaluate every S# sentence claim. Mark it supported only when one or more selected V# cards directly entail its meaning. Mark it irrelevant when true but not requested. Mark it unsupported otherwise.",
      "Evaluate every N# need against the final repaired answer. Mark answered only when the answer fully resolves it from selected evidence, partial when a useful supported portion or boundary remains, and unresolved when no useful answer remains.",
      "The supplied evidence contract is a prior applicability judgment, not permission to invent. It prevents silently discarding a supported need, but each final sentence still requires direct evidence.",
      "For a partial support record, supported_claim is the maximum claim allowed for that need. Remove adjacent facts from the same card unless another support record explicitly selects them for a requested need.",
      "If a useful grounded answer remains, preserve it. In a partial answer, remove only unsupported or irrelevant claims and keep every supported requested fact. Return a route only when no supported requested sentence remains.",
      "Re-evaluate coverage and routing after repair. Any partial or unresolved N# requires needs_route true; all needs answered requires needs_route false.",
      "Use only the short validation refs (V1, V2, etc.) supplied with selected evidence in sentence_evidence and coverage policy_ids. Never copy, alter, or invent a long policy ID.",
      "Return JSON only with: verdict, mode, answer, summary, sections, sentence_evidence, sentence_checks, need_checks, needs_route, route_key, route_reason, removed_claims, reason.",
      "sentence_checks must contain exactly one record per supplied S# with sentence_ref, status, evidence_refs, and reason. need_checks must contain exactly one record per supplied N# with need_ref, status, evidence_refs, and reason.",
    ].join("\n"),
    user: JSON.stringify({
      question: input.turn.standaloneQuestion,
      current_message: input.turn.currentQuestion,
      immediate_previous_question: input.turn.usedImmediateContext ? input.turn.immediatePreviousUserQuestion : null,
      product_scope: input.turn.productScope,
      excluded_scopes: input.turn.excludedScopes,
      selected_evidence: policies.map((policy, index) => ({ ref: `V${index + 1}`, scope: policy.product_scopes, ...policyDecisionParts(policy.decision) })),
      evidence_contract: { needs: contractNeeds, support: contractSupport },
      sentence_claims: sentenceClaims,
      deterministic_errors: deterministic.errors,
      draft: input.output,
    }),
    parse: (content: string) => {
      const parsed = parseValidationOutput(content);
      const sentenceRefs = new Set(parsed.sentence_checks?.map((item) => item.sentence_ref));
      const needRefs = new Set(parsed.need_checks?.map((item) => item.need_ref));
      const missingSentenceRefs = sentenceClaims.map((item) => item.ref).filter((ref) => !sentenceRefs.has(ref));
      const missingNeedRefs = contractNeeds.map((item) => item.id).filter((ref) => !needRefs.has(ref));
      if (missingSentenceRefs.length || missingNeedRefs.length) {
        throw new Error(`V3 validation response omitted required checks: ${[...missingSentenceRefs, ...missingNeedRefs].join(", ")}`);
      }
      return parsed;
    },
  };
  const resolveValidationRef = (value: string) => exactValidationIds.has(value) ? value : validationRefs.get(value.trim().toLowerCase()) || value;
  const applyValidation = (rawRepaired: V3ValidationResult) => {
    const sentenceChecks = (rawRepaired.sentence_checks || []).map((entry) => ({
      ...entry,
      policy_ids: entry.policy_ids.map(resolveValidationRef),
    }));
    const needChecks = (rawRepaired.need_checks || []).map((entry) => {
      const policyIds = entry.policy_ids.map(resolveValidationRef);
      const applicable = (input.retrieval.evidenceContract?.support || []).filter((support) => support.need_id === entry.need_ref);
      const hasFactSupport = applicable.some((support) => support.relation === "direct" || support.relation === "partial");
      if (entry.status !== "unresolved" && applicable.length && !hasFactSupport) {
        return {
          ...entry,
          status: "unresolved" as const,
          policy_ids: policyIds,
          reason: `${entry.reason} The evidence contract supplies an approved route only, not the missing fact.`.trim(),
        };
      }
      return { ...entry, policy_ids: policyIds };
    });
    const repaired: V3ValidationResult = {
      ...rawRepaired,
      sentence_checks: sentenceChecks,
      need_checks: needChecks,
      sentence_evidence: rawRepaired.sentence_evidence.map((entry) => ({
        ...entry,
        policy_ids: entry.policy_ids.map(resolveValidationRef),
      })),
    };
    const sentenceCheckByRef = new Map(sentenceChecks.map((entry) => [entry.sentence_ref, entry]));
    const needCheckByRef = new Map(needChecks.map((entry) => [entry.need_ref, entry]));
    const missingSentenceChecks = sentenceClaims.filter((claim) => !sentenceCheckByRef.has(claim.ref)).map((claim) => claim.ref);
    const missingNeedChecks = contractNeeds.filter((need) => !needCheckByRef.has(need.id)).map((need) => need.id);
    const invalidCheckIds = [...sentenceChecks, ...needChecks]
      .flatMap((entry) => entry.policy_ids)
      .filter((id) => !exactValidationIds.has(id));
    const invalidNeedJudgments = needChecks.flatMap((entry) => {
      if (entry.status === "unresolved") return [];
      const applicable = (input.retrieval.evidenceContract?.support || []).filter((support) => support.need_id === entry.need_ref);
      const allowedIds = new Set(applicable.flatMap((support) => support.policy_ids));
      const allContractIds = new Set((input.retrieval.evidenceContract?.support || []).flatMap((support) => support.policy_ids));
      const relationSupportsStatus = entry.status === "answered"
        ? applicable.some((support) => support.relation === "direct")
        : applicable.some((support) => support.relation === "direct" || support.relation === "partial");
      const usesOnlyApplicableEvidence = entry.policy_ids.length > 0 && entry.policy_ids.every((id) => allowedIds.has(id));
      const selectorPartialConfirmedByValidator = entry.status === "answered" &&
        usesOnlyApplicableEvidence &&
        applicable.some((support) => support.relation === "partial") &&
        applicable.every((support) => !support.hard_boundary) &&
        sentenceChecks.length > 0 &&
        sentenceChecks.every((check) => check.status === "supported" && check.policy_ids.length > 0);
      const recoverableCrossNeedPartial = entry.status === "partial" &&
        !applicable.length &&
        entry.policy_ids.length > 0 &&
        entry.policy_ids.every((id) => allContractIds.has(id));
      return (relationSupportsStatus && usesOnlyApplicableEvidence) || selectorPartialConfirmedByValidator || recoverableCrossNeedPartial ? [] : [`${entry.need_ref}:${entry.status}`];
    });
    const supportedSentenceRefs = new Set(
      sentenceChecks
        .filter((entry) => entry.status === "supported" && entry.policy_ids.length)
        .map((entry) => entry.sentence_ref),
    );
    const unsupportedOrIrrelevant = sentenceChecks.filter((entry) => entry.status !== "supported");
    const groundedSentenceEvidence = input.output.sentence_evidence.filter((_entry, index) => supportedSentenceRefs.has(`S${index + 1}`));
    const coverage: V3AnswerOutput["coverage"] = contractNeeds.map((need) => {
      const check = needCheckByRef.get(need.id);
      return {
        need: need.text,
        status: check?.status || "unresolved",
        policy_ids: check?.policy_ids.filter((id) => exactValidationIds.has(id)) || [],
        reason: check?.reason || "The validator did not resolve this requested need.",
      };
    });
    const hasSupportedRequestedSentence = groundedSentenceEvidence.length > 0;
    const needsRoute = coverage.some((entry) => entry.status !== "answered");
    const derivedMode: V3AnswerOutput["mode"] = hasSupportedRequestedSentence
      ? needsRoute ? "partial" : "answer"
      : "route";
    const repairedAnswer = repaired.answer || (unsupportedOrIrrelevant.length ? "" : input.output.answer);
    const repairedOutput: V3AnswerOutput = {
      ...input.output,
      answer: repairedAnswer,
      summary: repaired.summary || input.output.summary,
      sections: repaired.sections.length ? repaired.sections : input.output.sections,
      sentence_evidence: groundedSentenceEvidence,
      mode: derivedMode,
      coverage,
      needs_route: needsRoute,
      route_key: repaired.route_key === undefined ? input.output.route_key : repaired.route_key,
      route_reason: repaired.route_reason === undefined ? input.output.route_reason : repaired.route_reason,
    };
    const repairedCheck = deterministicValidation(repairedOutput, input.retrieval, input.turn.standaloneQuestion);
    const contractErrors = [
      missingSentenceChecks.length ? `missing sentence checks: ${missingSentenceChecks.join(", ")}` : "",
      missingNeedChecks.length ? `missing need checks: ${missingNeedChecks.join(", ")}` : "",
      invalidCheckIds.length ? `invalid check evidence IDs: ${Array.from(new Set(invalidCheckIds)).join(", ")}` : "",
      invalidNeedJudgments.length ? `need checks exceed the evidence contract: ${invalidNeedJudgments.join(", ")}` : "",
      input.output.mode !== "route" && !sentenceClaims.length ? "draft has no sentence-level evidence claims" : "",
      input.output.mode !== "route" && !hasSupportedRequestedSentence ? "no requested sentence was independently supported" : "",
      unsupportedOrIrrelevant.length && !repairedAnswer ? "unsupported sentences were identified but no repaired answer was returned" : "",
    ].filter(Boolean);
    if (contractErrors.length || !repairedCheck.pass) {
      return {
        validation: {
          ...repaired,
          verdict: "reject" as const,
          answer: repairedAnswer,
          mode: derivedMode,
          coverage,
          needs_route: needsRoute,
          sentence_evidence: groundedSentenceEvidence,
          reason: [repaired.reason, ...contractErrors, ...repairedCheck.errors].filter(Boolean).join("; "),
        },
        deterministic: repairedCheck,
      };
    }
    const derivedVerdict: V3ValidationResult["verdict"] =
      unsupportedOrIrrelevant.length || rawRepaired.verdict !== "pass" || repairedAnswer !== input.output.answer || derivedMode !== input.output.mode
        ? "repair"
        : "pass";
    return {
      validation: {
        ...repaired,
        verdict: derivedVerdict,
        answer: repairedAnswer,
        mode: derivedMode,
        coverage,
        needs_route: needsRoute,
        sentence_evidence: groundedSentenceEvidence,
        reason: repaired.reason || "Structured sentence and need checks passed.",
      },
      deterministic: repairedCheck,
    };
  };
  try {
    const result = await input.provider<V3ValidationResult>(request);
    input.attempts.push(...result.attempts);
    return applyValidation(result.output);
  } catch (error) {
    return {
      validation: { verdict: "reject" as const, answer: "", summary: "", sections: [], sentence_evidence: [], removed_claims: [], reason: [clean(error, 400), ...deterministic.errors].filter(Boolean).join("; ") || "Structured grounding validation was unavailable." },
      deterministic,
    };
  }
}

function routeKeyForQuestion(question: string, policies: V3Policy[]) {
  const normalized = question.toLowerCase();
  if (/\b(?:can(?:not|'t)|unable to|trouble|problem|issue|error|failed? to)\b[^?.]{0,80}\b(?:log ?in|sign ?in|access|open)\b|\b(?:log ?in|sign ?in|access denied|password reset)\b[^?.]{0,80}\b(?:problem|issue|error|failed?|working)\b/.test(normalized)) return "sales_tech";
  const selectedRouteKeys = Array.from(new Set(policies.map((policy) => policy.route_key).filter(Boolean)));
  if (selectedRouteKeys.length === 1) return selectedRouteKeys[0] as string;
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
    summary: output.sections.length ? output.summary || answer : answer,
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
        explicitScopeSwitch: input.turn.explicitScopeSwitch,
        intentResolutionMode: input.turn.intentResolutionMode,
        intentResolutionReason: input.turn.intentResolutionReason,
      },
      retrieval: {
        query: input.retrieval.query.slice(0, 4000),
        semanticQueries: input.retrieval.semanticQueries?.map((query) => query.slice(0, 500)),
        preselectionCandidateCount: input.retrieval.preselectionCandidateCount,
        evidenceSelectionReason: input.retrieval.evidenceSelectionReason,
        evidenceContract: input.retrieval.evidenceContract ? {
          needs: input.retrieval.evidenceContract.needs,
          support: input.retrieval.evidenceContract.support.map((item) => ({
            needId: item.need_id,
            relation: item.relation,
            policyIds: item.policy_ids,
            supportedClaim: item.supported_claim,
            reason: item.reason,
            hardBoundary: Boolean(item.hard_boundary),
          })),
          unresolvedNeedIds: input.retrieval.evidenceContract.unresolved_need_ids,
        } : undefined,
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
        sentenceChecks: input.validation.sentence_checks?.map((item) => ({
          sentenceRef: item.sentence_ref,
          status: item.status,
          policyIds: item.policy_ids,
          reason: item.reason,
        })),
        needChecks: input.validation.need_checks?.map((item) => ({
          needRef: item.need_ref,
          status: item.status,
          policyIds: item.policy_ids,
          reason: item.reason,
        })),
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

function isSafeNoEvidenceRouteAnswer(answer: string) {
  return /\b(?:can(?:not|'t) confirm|do not have (?:a confirmed|enough (?:information|guidance)|enough confirmed guidance)|don't have (?:a confirmed|enough (?:information|guidance)|enough confirmed guidance)|not confirmed|not resolved|not covered|guidance (?:available )?(?:does not|doesn't) address|unable to confirm|need to (?:verify|confirm|check)|please (?:verify|confirm|check)|should be (?:verified|confirmed|checked))\b/i.test(answer);
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
  const redacted = redactSensitiveText(question);
  const sanitizedMessages = conversationMessages.map((message) => ({ role: message.role, content: redactSensitiveText(message.content).text }));
  const attempts: V3ProviderAttempt[] = [];
  const turnStarted = Date.now();
  let turn = resolveV3Turn(redacted.text, sanitizedMessages);
  turn = await refineAmbiguousTurnIntent({ provider, turn, attempts });
  stageTimings.turnResolutionMs = Date.now() - turnStarted;
  const lexicalRetrieval = turn.kind === "new" || turn.kind === "follow_up" ? retrieveV3Policies(turn) : { query: turn.standaloneQuestion, candidates: [], blocked: [], queryTokens: [], stageTimings: { retrievalMs: 0 } };
  const recalledRetrieval = turn.kind === "new" || turn.kind === "follow_up"
    ? await addSemanticRecall({ provider, turn, retrieval: lexicalRetrieval, attempts })
    : lexicalRetrieval;
  const retrieval = turn.kind === "new" || turn.kind === "follow_up"
    ? await selectApplicableEvidence({ provider, turn, retrieval: recalledRetrieval, attempts })
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
      const isConversation = turn.kind === "social" || turn.kind === "topic_intro" || turn.kind === "rewrite" || turn.kind === "clarification";
      const prompt = isConversation ? conversationPrompt(turn) : { system: composerSystemPrompt(), user: composerUserPrompt(turn, retrieval) };
      const generationStarted = Date.now();
      const result = await provider<V3AnswerOutput>({ purpose: isConversation ? "v3_conversation" : "v3_evidence_answer", system: prompt.system, user: prompt.user, maxTokens: turn.kind === "social" || turn.kind === "topic_intro" ? 500 : 2200, parse: isConversation ? parseConversationOutput : parseAnswerOutput });
      stageTimings.answerGenerationMs = Date.now() - generationStarted;
      output = isConversation ? result.output : resolveEvidenceRefs(result.output, retrieval);
      if (!isConversation && !retrieval.candidates.length && isSafeNoEvidenceRouteAnswer(output.answer)) {
        const safeRouteKey = routeKeyForQuestion(turn.currentQuestion, []);
        const safe = safeRouteAnswer(turn, null, retrieval, output.route_reason || "No applicable approved evidence was selected.");
        output = {
          ...output,
          mode: "route",
          answer: safe.answer,
          summary: safe.answer,
          sections: [],
          selected_policy_ids: [],
          rejected_policy_ids: [],
          coverage: retrieval.evidenceContract?.needs.map((need) => ({
            need: need.text,
            status: "unresolved" as const,
            policy_ids: [],
            reason: "No applicable approved evidence was selected.",
          })) || [],
          sentence_evidence: [],
          needs_route: true,
          route_key: safeRouteKey,
          route_reason: safe.routeReason,
        };
      }
      if (
        !isConversation &&
        !retrieval.candidates.length &&
        /\bcustom\b/i.test(output.answer) &&
        misappliesCustomSplitBoundary(turn.standaloneQuestion, "direct", "Custom split", output.answer, output.route_reason)
      ) {
        const route = routeFor(turn.currentQuestion, []);
        const answer = `I can’t confirm the installment mechanics until the product and listed payment plan are clear. Please check ${route.channel} before giving the client payment instructions.`;
        output = {
          ...output,
          mode: "route",
          answer,
          summary: answer,
          sections: [],
          selected_policy_ids: [],
          rejected_policy_ids: [],
          sentence_evidence: [],
          needs_route: true,
          route_key: routeKeyForQuestion(turn.currentQuestion, []),
          route_reason: "A single total divided into installments does not establish that the user proposed a custom split.",
        };
      }
      if (wantsRepeatedRouteOmitted(turn)) output = omitRepeatedRouteNote(output);
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
      if (turn.kind === "social" || turn.kind === "topic_intro" || turn.kind === "clarification") {
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
  const validationResult = await validateAndRepair({ provider: validatorProvider, turn, retrieval, output, attempts });
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


  if (turn.explicitCorrection && output.needs_route && (validation.verdict === "reject" || output.mode === "route")) {
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
  const evidenceRouteKeys = Array.from(new Set(selected.map((policy) => policy.route_key).filter(Boolean)));
  if (output.needs_route && evidenceRouteKeys.length !== 1) {
    // The model may use only route keys from the registry, but an allowed key
    // can still be the wrong owner (for example, treating the word
    // "greenlit" as a greenlight-letter request). When evidence does not
    // explicitly own the route, apply the same narrow request-type router used
    // by fail-closed answers instead of trusting a keyword association from
    // the composer.
    output.route_key = routeKeyForQuestion(turn.currentQuestion, selected);
  }
  const route = output.route_key && registry.route_catalog[output.route_key]
    ? registry.route_catalog[output.route_key]
    : routeFor(turn.currentQuestion, selected);
  if (output.needs_route && !output.answer.includes(route.channel)) {
    output.answer = `${output.answer.replace(/[.!]?$/, ".")} Use ${route.channel} for the unresolved part.`;
  }
  if (output.needs_route || output.mode === "route" || output.mode === "partial") {
    output.route_reason = `Please verify the unresolved part in ${route.channel} before replying.`;
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

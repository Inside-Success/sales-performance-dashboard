import type { AskSalesFaqChatMessage } from "@/lib/ask-sales-faq/types";
import { resolveV3Turn } from "@/lib/ask-sales-faq/v3/turn-resolver";
import type { V3TurnResolution } from "@/lib/ask-sales-faq/v3/types";

export type V4TurnResolution = V3TurnResolution & {
  actionableQuestion: string | null;
  conversationalPreface: string | null;
};

const META_ONLY = /^(?:(?:hi|hello|hey|hello again|hi again|good (?:morning|afternoon|evening))[,!.\s-]*)?(?:(?:can|could|would) you (?:please )?help me (?:check|review|go over|with)(?: (?:another|a|a few|some|several))? .{2,100}(?:questions?|cases?|topics?|situations?|scenarios?)|i (?:need|want) help with .{2,100}(?:now|next)?|i have (?:another|a few|some|several) .{2,100}(?:questions?|cases?|situations?|scenarios?)|let(?:['’]s| us) (?:move|switch) to .{2,100})[!.?]*$/i;
const ACTION_CUE = /^(?:for\s+(?:main\s+)?istv[,\s]+|for\s+(?:daymond john|next level ceo|nlceo|dj(?:\s*\/\s*nlceo)?)[,\s]+)?(?:what|when|where|which|who|why|how|is|are|am|can|could|do|does|did|should|would|will|may|might|must|tell|explain|give|state|confirm|verify|check|list|identify|determine|locate|provide|find)\b/i;
const SOCIAL_PREFACE = /^(?:(?:hi|hello|hey|good (?:morning|afternoon|evening)|thanks|thank you|appreciate it)(?:\s+there)?|hope you(?:['’]re| are) doing well)(?:[!,.?\s—–-]+|$)/i;
const META_PREFACE = /^(?:(?:for\s+(?:main\s+istv|inside success tv|daymond john|next level ceo|nlceo|dj(?:\s*\/\s*nlceo)?)[,\s]+)?(?:(?:can|could|would) you (?:please )?help me(?: (?:check|review|go over|with))?(?: (?:another|a|a few|some|several))? .{2,100}(?:questions?|cases?|topics?|situations?|scenarios?)|i (?:need|want) help with .{2,100}(?:now|next)?|i have (?:another|a|a few|some|several) (?:questions?|cases?|situations?|scenarios?) about .{2,100}|i have (?:another|a|a few|some|several) .{2,100}(?:questions?|cases?|situations?|scenarios?)|(?:i(?:['’]m| am)\s+)?switching to .{2,100}|(?:let(?:['’]s| us)\s+)?(?:move|moving|switch) to .{2,100}|(?:next|last) section(?:\s*[—–:-]\s*|\s+).{2,100}|(?:next|now) i have .{2,100}(?:questions?|cases?|situations?|scenarios?)|(?:questions?|cases?|scenarios?) about .{2,100}))[!.?]*$/i;
const TERSE_ACTION_OBJECT = /\b(?:prices?|pricing|payments?|plans?|offers?|packages?|contracts?|eligibility|eligible|qualification|discounts?|platforms?|shows?|episodes?|devices?|deadlines?|timelines?)\b/i;
const STYLE_ONLY_REQUEST = /^(?:(?:i have|i(?:['’]ve| have) got)\s+(?:another|a few|some|several)?\s*(?:unrelated\s+)?(?:sales\s+)?questions?[.!?]\s*)?(?:(?:can|could|would) you (?:please )?|please )?(?:keep|make)\s+(?:your\s+|the\s+)?(?:answers?|replies|responses?)\s+(?:short|brief|concise|practical|simple)(?:\s+and\s+(?:short|brief|concise|practical|simple))*[.!?]*$/i;
const CLOSING_ONLY = /^(?:(?:perfect|great|awesome|okay|ok)[,!?.\s-]*)?(?:thanks|thank you|appreciate it)(?:[,!.\s-]+(?:that(?:['’]s| is) (?:everything|all)|i(?:['’]m| am) (?:done|finished)|all (?:done|set))\s*(?:for now)?)?[!.?\s]*$/i;

function clean(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function contentAnchorCount(value: string) {
  const ignored = new Set([
    "about", "and", "are", "can", "could", "does", "for", "from", "have", "help", "how", "into", "questions", "scenarios", "should", "that", "the", "their", "them", "this", "what", "when", "where", "which", "with", "would", "you",
  ]);
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ")
    .filter((token) => token.length > 2 && !ignored.has(token)).length;
}

function looksActionable(value: string) {
  const candidate = clean(value).replace(/^[,;:—–-]+\s*/, "");
  return ACTION_CUE.test(candidate) && !META_ONLY.test(candidate) && !STYLE_ONLY_REQUEST.test(candidate) &&
    (contentAnchorCount(candidate) >= 2 || TERSE_ACTION_OBJECT.test(candidate));
}

function isConversationalPreface(value: string) {
  let remainder = clean(value);
  while (SOCIAL_PREFACE.test(remainder)) remainder = clean(remainder.replace(SOCIAL_PREFACE, ""));
  return !remainder || META_PREFACE.test(remainder) || directionalScope(remainder) !== null;
}

type DirectionalScope = {
  target: "main_istv" | "dj_nlceo";
  excluded: "main_istv" | "dj_nlceo";
};

function directionalScope(prefix: string): DirectionalScope | null {
  const main = "(?:main\\s+istv|inside success tv)";
  const dj = "(?:daymond john|next level ceo|nlceo|dj(?:\\s*\\/\\s*nlceo)?)";
  const movement = "(?:switch(?:ing)?|mov(?:e|ing))";
  const toMain = [
    new RegExp(`\\b${movement}\\s+to\\s+${main}\\s+from\\s+${dj}\\b`, "i"),
    new RegExp(`\\b${movement}\\s+from\\s+${dj}\\s+to\\s+${main}\\b`, "i"),
    new RegExp(`\\b(?:used|was using|worked with)\\s+${dj}.{0,40}\\bbefore\\b.{0,40}\\b(?:but\\s+)?now(?:\\s+this\\s+is)?\\s+${main}\\b`, "i"),
  ];
  if (toMain.some((pattern) => pattern.test(prefix))) {
    return { target: "main_istv", excluded: "dj_nlceo" };
  }
  const toDj = [
    new RegExp(`\\b${movement}\\s+to\\s+${dj}\\s+from\\s+${main}\\b`, "i"),
    new RegExp(`\\b${movement}\\s+from\\s+${main}\\s+to\\s+${dj}\\b`, "i"),
    new RegExp(`\\b(?:used|was using|worked with)\\s+${main}.{0,40}\\bbefore\\b.{0,40}\\b(?:but\\s+)?now(?:\\s+this\\s+is)?\\s+${dj}\\b`, "i"),
  ];
  if (toDj.some((pattern) => pattern.test(prefix))) {
    return { target: "dj_nlceo", excluded: "main_istv" };
  }
  return null;
}

function scopePrefix(prefix: string, candidate: string) {
  const directional = directionalScope(prefix);
  if (directional?.target === "main_istv") return `For main ISTV, not Daymond John / Next Level CEO, ${candidate}`;
  if (directional?.target === "dj_nlceo") return `For Daymond John / Next Level CEO, not main ISTV, ${candidate}`;
  const candidateHasMain = /\b(?:main\s+istv|inside success tv)\b/i.test(candidate);
  const candidateHasDj = /\b(?:daymond john|next level ceo|nlceo|dj\s*\/\s*nlceo)\b/i.test(candidate);
  const prefixHasMain = /\b(?:main\s+istv|inside success tv)\b/i.test(prefix);
  const prefixHasDj = /\b(?:daymond john|next level ceo|nlceo|dj\s*\/\s*nlceo)\b/i.test(prefix);
  if (candidateHasMain || candidateHasDj) return candidate;
  if (prefixHasMain && prefixHasDj) return `For main ISTV and Daymond John / Next Level CEO, ${candidate}`;
  if (prefixHasMain) return `For main ISTV, ${candidate}`;
  if (prefixHasDj) return `For Daymond John / Next Level CEO, ${candidate}`;
  return candidate;
}

export function extractV4ActionableQuestion(value: string) {
  const question = clean(value);
  const boundaries = [...question.matchAll(/(?:[.!?;:]\s+|\s+[—–-]\s+|,\s+(?=(?:specifically|first|such as)\b))/g)];
  for (let index = boundaries.length - 1; index >= 0; index -= 1) {
    const boundary = boundaries[index];
    const start = (boundary.index || 0) + boundary[0].length;
    const rawPrefix = clean(question.slice(0, start).replace(/[.!?;:—–-]+\s*$/, ""));
    if (!isConversationalPreface(rawPrefix)) continue;
    const rawCandidate = clean(question.slice(start).replace(/^(?:specifically|first|such as)[:,]?\s*/i, ""));
    const directional = directionalScope(rawPrefix);
    const terseDirectionalObject = Boolean(directional && TERSE_ACTION_OBJECT.test(rawCandidate) && contentAnchorCount(rawCandidate) >= 1);
    if (!looksActionable(rawCandidate) && !terseDirectionalObject) continue;
    return {
      actionableQuestion: scopePrefix(question.slice(0, start), rawCandidate),
      conversationalPreface: rawPrefix || null,
      directionalScope: directionalScope(question.slice(0, start)),
    };
  }
  return { actionableQuestion: null, conversationalPreface: null, directionalScope: null };
}

function withoutCurrentMessage(messages: AskSalesFaqChatMessage[], currentQuestion: string) {
  const normalized = messages.map((message) => ({ ...message, content: clean(message.content) })).filter((message) => message.content);
  const last = normalized.at(-1);
  return last?.role === "user" && clean(last.content) === clean(currentQuestion) ? normalized.slice(0, -1) : normalized;
}

export function resolveV4Turn(question: string, messages: AskSalesFaqChatMessage[] = []): V4TurnResolution {
  const originalQuestion = clean(question);
  const base = resolveV3Turn(originalQuestion, messages);
  if (CLOSING_ONLY.test(originalQuestion)) {
    return {
      ...base,
      kind: "social",
      actionableQuestion: null,
      conversationalPreface: originalQuestion,
      intentResolutionReason: "Resolved as a conversational acknowledgment or closing.",
    };
  }
  if (STYLE_ONLY_REQUEST.test(originalQuestion)) {
    return {
      ...base,
      kind: "topic_intro",
      actionableQuestion: null,
      conversationalPreface: originalQuestion,
      intentResolutionReason: "Resolved as a response-style preference without a substantive policy request.",
    };
  }
  const extracted = extractV4ActionableQuestion(originalQuestion);
  if (!extracted.actionableQuestion) {
    const independentlyActionable = base.kind === "follow_up" &&
      !base.explicitCorrection &&
      looksActionable(originalQuestion) &&
      contentAnchorCount(originalQuestion) >= 6 &&
      !/^(?:and|also|so|but|then|instead|what about|how about|can they|could they|should they|does that|is that)\b/i.test(originalQuestion);
    if (independentlyActionable) {
      const standalone = resolveV3Turn(originalQuestion, []);
      return {
        ...standalone,
        actionableQuestion: standalone.currentQuestion,
        conversationalPreface: null,
        intentResolutionReason: "Resolved as a self-contained new request despite referential wording.",
      };
    }
    return {
      ...base,
      actionableQuestion: ["social", "topic_intro", "memory", "rewrite", "clarification"].includes(base.kind) ? null : base.currentQuestion,
      conversationalPreface: null,
    };
  }

  const actionable = resolveV3Turn(extracted.actionableQuestion, withoutCurrentMessage(messages, originalQuestion));
  const productScope = extracted.directionalScope?.target || (actionable.productScope !== "unknown" ? actionable.productScope : base.productScope);
  return {
    ...actionable,
    currentQuestion: originalQuestion,
    productScope,
    excludedScopes: [...new Set([
      ...base.excludedScopes,
      ...actionable.excludedScopes,
      ...(extracted.directionalScope ? [extracted.directionalScope.excluded] : []),
    ])],
    explicitScopeSwitch: actionable.explicitScopeSwitch || Boolean(extracted.directionalScope),
    actionableQuestion: extracted.actionableQuestion,
    conversationalPreface: extracted.conversationalPreface,
    intentResolutionReason: `Resolved the substantive request after a conversational preface as ${actionable.kind}.`,
  };
}

export function v4DecisionQuestion(turn: V3TurnResolution) {
  const enriched = turn as V3TurnResolution & { actionableQuestion?: string | null };
  return enriched.actionableQuestion || turn.currentQuestion;
}

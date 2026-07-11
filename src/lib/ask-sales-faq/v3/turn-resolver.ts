import type { AskSalesFaqChatMessage } from "@/lib/ask-sales-faq/types";
import type { V3ProductScope, V3TurnResolution } from "@/lib/ask-sales-faq/v3/types";

const SOCIAL_ONLY = /^(?:hi|hello|hey|good (?:morning|afternoon|evening)|how are you|thanks|thank you|great|awesome|perfect|okay|ok)[!.?\s]*$/i;
const SOCIAL_ACK = /^(?:(?:perfect|great|awesome|okay|ok|thanks|thank you|appreciate it|that(?:['’]s| is) helpful)[,!?.\s-]*)+$/i;
const SOCIAL_PREFACE = /^(?:hi|hello|hey|good (?:morning|afternoon|evening)|thanks|thank you)[,!]?\s+/i;
const META_CONVERSATION = /\b(?:can you help me with (?:a few|some|several) .+ questions|i have (?:a few|some|several) (?:unrelated )?.+ questions|i(?:['’]m| am) switching to .+ now|next i have questions about|now i have (?:some )?questions about|appreciate it.{0,20}(?:next|now) i have|last section|thank you for sticking with me|thanks,? that(?:['’]s| is) everything|that(?:['’]s| is) all for now|hope you(?:['’]re| are) doing well|how(?:['’]s| is) your day going)\b/i;
const GENERIC_HELP_REQUEST = /^(?:(?:hi|hello|hey|good (?:morning|afternoon|evening))[,!\s-]*)?(?:can|could|would) you (?:please )?help me(?: with)?(?: (?:another|a|a few|some|several))?(?: sales)? questions?[!.?]*$/i;
const MEMORY_QUESTION = /\b(?:what|which)\s+(?:was|is)\s+(?:my|the)\s+(?:previous|last)\s+question\b|\bwhat did i (?:just )?ask\b/i;
const REWRITE = /\b(?:rewrite|rephrase|format|make (?:that|it)|turn (?:that|it|the previous answer|your previous answer)|put (?:that|it)|summari[sz]e|shorten|shorter|simpler language|plain english|bullet(?:s| points)?|checklist|table|answer without repeating|without repeating the route|explain only what is confirmed|explain (?:that|this|it).{0,50}(?:naturally|clearly|briefly|concisely|only what)|keep (?:that|it|the answer) short|keep only what (?:i|we) need)\b/i;
const ELLIPTICAL_FOLLOW_UP = /^(?:(?:and|also|so|but)\s+)?(?:what about|how about|does that|did that|would that|could that|is that|was that|are those|do they|can they|what if|why is that|why not|then what|anything else|tell me more|(?:can you )?(?:explain|clarify|expand on|simplify) (?:that|this|it))\b/i;
const EXPLICIT_REFERENT = /\b(?:(?:the )?(?:previous|last) (?:answer|question)|(?:same|that|this) (?:answer|rule|case|client|prospect|show|plan|package|situation|one|thing|location)|(?:does|did|is|was|would|could|can|will) (?:that|this|it))\b/i;
const CORRECTION = /\b(?:actually|you misunderstood|i(?:['’]m| am) asking|not what i asked|my previous question|i meant)\b/i;
const STYLE_PREFERENCE = /\b(?:keep (?:your )?answers? .{0,30}(?:short|concise|practical)|keep (?:that|it|the answer) short|answer .{0,20}(?:briefly|concisely)|use bullets|do not repeat route notes?)\b/i;
const CLARIFICATION_REQUEST = /\b(?:what information do you need from me|what (?:else )?do you need (?:from me|to know)|which show this applies to|what details should i provide)\b/i;

function clean(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function contentAnchorCount(value: string) {
  const ignored = new Set([
    "a", "an", "and", "are", "as", "at", "be", "but", "by", "can", "could", "did", "do", "does", "for", "from",
    "had", "has", "have", "how", "i", "if", "in", "is", "it", "me", "my", "of", "on", "or", "should", "so", "that",
    "the", "their", "them", "then", "there", "these", "they", "this", "those", "to", "was", "we", "were", "what", "when",
    "where", "which", "who", "why", "will", "with", "would", "you", "your",
  ]);
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((token) => token.length > 2 && !ignored.has(token)).length;
}

function recentMessages(messages: AskSalesFaqChatMessage[], currentQuestion: string) {
  const normalized = messages
    .map((message) => ({ role: message.role, content: clean(message.content) }))
    .filter((message) => message.content)
    .slice(-10);
  const last = normalized.at(-1);
  if (last?.role === "user" && clean(last.content) === clean(currentQuestion)) return normalized.slice(0, -1);
  return normalized;
}

function previousOfRole(messages: AskSalesFaqChatMessage[], role: "user" | "assistant") {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === role) return messages[index].content;
  }
  return null;
}

function resolveScope(question: string, previousQuestion: string | null): {
  productScope: V3ProductScope;
  excludedScopes: Array<"main_istv" | "dj_nlceo">;
} {
  const current = question.toLowerCase();
  const previous = (previousQuestion || "").toLowerCase();
  const saysMain = /\b(?:main istv|main show|inside success tv)\b/.test(current);
  const saysDj = /\b(?:daymond john|next level ceo|nlceo|dj show|dj\/nlceo)\b/.test(current);
  const excludesMain = /\b(?:not|isn't|is not|isnt|excluding|except)\s+(?:for\s+)?(?:main istv|main show|inside success tv)\b/.test(current);
  const excludesDj = /\b(?:not|isn't|is not|isnt|excluding|except)\s+(?:for\s+)?(?:any\s+|a\s+)?(?:dj(?:\s+show)?(?:\s+(?:or|\/)\s+nlceo(?:\s+show)?)?|daymond john|next level ceo|nlceo|dj\/nlceo)\b/.test(current);
  const excludedScopes: Array<"main_istv" | "dj_nlceo"> = [];
  if (excludesMain) excludedScopes.push("main_istv");
  if (excludesDj) excludedScopes.push("dj_nlceo");

  if (saysMain && saysDj && !excludesMain && !excludesDj) return { productScope: "comparison", excludedScopes };
  if (saysMain && !excludesMain) return { productScope: "main_istv", excludedScopes };
  if (saysDj && !excludesDj) return { productScope: "dj_nlceo", excludedScopes };
  if (excludesDj) return { productScope: "main_istv", excludedScopes };
  if (excludesMain) return { productScope: "dj_nlceo", excludedScopes };

  if (/\b(?:same|that|it|this|they|them)\b/.test(current)) {
    const priorMain = /\b(?:main istv|main show|inside success tv)\b/.test(previous);
    const priorDj = /\b(?:daymond john|next level ceo|nlceo|dj show|dj\/nlceo)\b/.test(previous);
    if (priorMain && !priorDj) return { productScope: "main_istv", excludedScopes };
    if (priorDj && !priorMain) return { productScope: "dj_nlceo", excludedScopes };
  }
  return { productScope: "unknown", excludedScopes };
}

export function resolveV3Turn(question: string, messages: AskSalesFaqChatMessage[] = []): V3TurnResolution {
  const currentQuestion = clean(question);
  const contextMessages = recentMessages(messages, currentQuestion);
  const immediatePreviousUserQuestion = previousOfRole(contextMessages, "user");
  const immediatePreviousAssistantAnswer = previousOfRole(contextMessages, "assistant");
  const strippedSocialPreface = clean(currentQuestion.replace(SOCIAL_PREFACE, ""));
  const social = SOCIAL_ONLY.test(currentQuestion) || SOCIAL_ACK.test(currentQuestion) || META_CONVERSATION.test(currentQuestion) || GENERIC_HELP_REQUEST.test(currentQuestion);
  const memory = MEMORY_QUESTION.test(currentQuestion);
  const rewrite = !memory && REWRITE.test(strippedSocialPreface) && Boolean(immediatePreviousAssistantAnswer);
  const clarification = !social && !memory && !rewrite && CLARIFICATION_REQUEST.test(strippedSocialPreface) && Boolean(immediatePreviousUserQuestion);
  const explicitCorrection = CORRECTION.test(strippedSocialPreface);
  const shortQuestion = strippedSocialPreface.split(/\s+/).length <= 16;
  const explicitReferent = EXPLICIT_REFERENT.test(strippedSocialPreface);
  const ellipticalFollowUp = ELLIPTICAL_FOLLOW_UP.test(strippedSocialPreface);
  const lacksStandaloneSubject = contentAnchorCount(strippedSocialPreface) < 4;
  const followUp =
    !social &&
    !memory &&
    !rewrite &&
    !clarification &&
    Boolean(immediatePreviousUserQuestion) &&
    (explicitCorrection || ellipticalFollowUp || (shortQuestion && explicitReferent && lacksStandaloneSubject));
  const kind = social ? "social" : memory ? "memory" : rewrite ? "rewrite" : clarification ? "clarification" : followUp ? "follow_up" : "new";
  const scope = resolveScope(strippedSocialPreface, immediatePreviousUserQuestion);
  const stylePreferences = contextMessages
    .filter((message) => message.role === "user" && STYLE_PREFERENCE.test(message.content))
    .map((message) => message.content)
    .slice(-2);

  let standaloneQuestion = strippedSocialPreface || currentQuestion;
  if ((followUp || clarification) && immediatePreviousUserQuestion) {
    standaloneQuestion = [
      `Immediate prior subject: ${immediatePreviousUserQuestion}`,
      `Current request about that subject: ${strippedSocialPreface}`,
    ].filter(Boolean).join("\n");
  }

  return {
    kind,
    currentQuestion,
    standaloneQuestion,
    immediatePreviousUserQuestion,
    immediatePreviousAssistantAnswer,
    productScope: scope.productScope,
    excludedScopes: scope.excludedScopes,
    memoryAnswer:
      memory && immediatePreviousUserQuestion
        ? `Your previous question was: “${immediatePreviousUserQuestion}”`
        : memory
          ? "This is the first question I can see in this chat."
          : null,
    usedImmediateContext: followUp || clarification || rewrite || memory,
    explicitCorrection,
    stylePreferences,
    contextMessages,
  };
}

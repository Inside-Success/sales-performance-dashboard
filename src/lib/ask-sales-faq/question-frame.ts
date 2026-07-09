export type CanonicalProductScope = "main_istv" | "dj_nlceo";

export type QuestionScope = CanonicalProductScope | "comparison" | "unknown";

export type QuestionRelation = "social" | "rewrite" | "context_follow_up" | "new";

export type RewriteIntent = "format_list" | "shorten" | "rewrite";

export type QuestionFrameMessage = {
  role: "user" | "assistant";
  content: string;
};

export type QuestionFrame = {
  currentQuestion: string;
  effectiveQuestion: string;
  relation: QuestionRelation;
  scope: QuestionScope;
  includedScopes: CanonicalProductScope[];
  excludedScopes: CanonicalProductScope[];
  scopeSource: "current" | "previous_user" | "none";
  isScopeCorrection: boolean;
  previousSubstantiveUserQuestion: string | null;
  rehydratedFromUserQuestion: string | null;
};

type ScopeMention = {
  scope: CanonicalProductScope;
  start: number;
  end: number;
  excluded: boolean;
};

type ScopeSignals = {
  includedScopes: CanonicalProductScope[];
  excludedScopes: CanonicalProductScope[];
};

const SCOPE_ORDER: CanonicalProductScope[] = ["main_istv", "dj_nlceo"];

const SCOPE_PATTERNS: Record<CanonicalProductScope, RegExp[]> = {
  main_istv: [
    /\bmain\s+istv(?:\s+(?:show|program))?\b/g,
    /\binside\s+success(?:\s+tv)?(?:\s+(?:show|program))?\b/g,
    /\bistv(?:\s+(?:show|program))?\b/g,
  ],
  dj_nlceo: [
    /\bdaymond\s+john(?:'s)?(?:\s+(?:show|program))?\b/g,
    /\bnext\s+level\s+ceo(?:\s+(?:show|program))?\b/g,
    /\bnlceo\b/g,
    /\bdj(?:\s+(?:show|program|applicant))?\b/g,
  ],
};

const SOCIAL_PATTERN =
  /^(?:thanks|thank\s+you|thankyou|appreciate\s+it|got\s+it|ok(?:ay)?\s+thanks|perfect(?:,?\s+thanks)?|great(?:,?\s+thanks)?|that\s+helps|makes\s+sense|sounds\s+good|cool(?:,?\s+thanks)?|awesome(?:,?\s+thanks)?)[.! ]*$/;

const REWRITE_ACTION_PATTERN =
  /\b(?:make|keep|put|rewrite|rephrase|shorten|summarize|condense|simplify|format|formatting|reformat|organize|arrange)\b/;
const LIST_REWRITE_ACTION_PATTERN = /\b(?:list|bullet|bullets|number|numbered)\b/;
const REWRITE_TARGET_PATTERN =
  /\b(?:that|this|it|these|those|answer|reply|response|list|items|shows|options|shorter|brief|concise|simpler|simple|properly|bullets|table)\b/;
const REWRITE_REFERENCE_PATTERN =
  /\b(?:that|this|it|these|those|them|answer|reply|response|previous|earlier|above|properly)\b/;
const LIST_FORMAT_PATTERN =
  /\b(?:format|formatting|reformat|organize|arrange|list|bullet|bullets|number|numbered|table)\b/;
const SHORTEN_PATTERN = /\b(?:shorten|summarize|condense|shorter|brief|concise|simplify|simpler|simple)\b/;

const CONTEXT_REFERENCE_PATTERN =
  /(?:^(?:and|also|then|so|but|what\s+about|how\s+about|what\s+if)\b|\b(?:previous|last|earlier)\s+(?:question|message|one)\b|\b(?:as\s+i\s+said|as\s+mentioned|already\s+told\s+you|already\s+said|same\s+(?:question|case|client|prospect))\b)/;

const SHORT_CONTEXT_PRONOUN_PATTERN = /\b(?:this|that|it|they|them|their|those|same|previous|above)\b/;

const CORRECTION_CUE_PATTERN =
  /\b(?:previous\s+question|last\s+question|earlier\s+question|actually|to\s+clarify|clarification|i\s+(?:already\s+)?(?:said|told|mentioned)|what\s+if|this\s+(?:is|was)|that\s+(?:is|was)|it\s+(?:is|was))\b/;

const SUBSTANTIVE_TOPIC_PATTERN =
  /\b(?:call\s*[12]|payment|pay|funds|deposit|discount|price|pricing|package|cohort|deadline|contract|refund|greenlight|qualif(?:y|ied|ication)|recording|onboarding|show\s+list|media\s+kit|mastermind|exception|hold|continue|reapply|re-apply|reschedul(?:e|ing)|send|delete|vault|access)\b/;

const SCOPE_ONLY_FILLER_PATTERN =
  /\b(?:this|that|it|question|previous|last|earlier|was|is|for|the|a|an|any|show|program|applicant|i|my|already|told|you|said|mentioned|mean|meant|actually|what|if|to|clarify|clarification|not|no|without|rather|than|instead|of|only|about)\b/g;

export function buildQuestionFrame(currentQuestion: string, conversationMessages: QuestionFrameMessage[] = []): QuestionFrame {
  const current = cleanQuestion(currentQuestion);
  const normalizedCurrent = normalizeForFrame(current);
  const currentSignals = extractScopeSignals(normalizedCurrent);
  const previousSubstantiveUserQuestion = findPreviousSubstantiveUserQuestion(current, conversationMessages);
  const scopeOnlyStatement = looksLikeScopeOnlyStatement(normalizedCurrent, currentSignals);
  const isScopeCorrection = Boolean(previousSubstantiveUserQuestion) && scopeOnlyStatement;

  const relation = classifyRelation({
    normalizedCurrent,
    previousSubstantiveUserQuestion,
    isScopeCorrection,
  });

  const shouldUsePreviousScope =
    !hasScopeSignals(currentSignals) &&
    Boolean(previousSubstantiveUserQuestion) &&
    (relation === "context_follow_up" || relation === "rewrite");
  const previousSignals = shouldUsePreviousScope
    ? extractScopeSignals(normalizeForFrame(previousSubstantiveUserQuestion || ""))
    : emptyScopeSignals();
  const resolvedSignals = hasScopeSignals(currentSignals) ? currentSignals : previousSignals;
  const scopeSource = hasScopeSignals(currentSignals)
    ? "current"
    : hasScopeSignals(previousSignals)
      ? "previous_user"
      : "none";

  const shouldRehydrate = relation === "context_follow_up" && Boolean(previousSubstantiveUserQuestion);
  const effectiveQuestion = shouldRehydrate
    ? `${previousSubstantiveUserQuestion}\n\nCurrent follow-up or correction:\n${current}`
    : current;

  return {
    currentQuestion: current,
    effectiveQuestion,
    relation,
    scope: scopeFromSignals(resolvedSignals),
    includedScopes: resolvedSignals.includedScopes,
    excludedScopes: resolvedSignals.excludedScopes,
    scopeSource,
    isScopeCorrection,
    previousSubstantiveUserQuestion,
    rehydratedFromUserQuestion: shouldRehydrate ? previousSubstantiveUserQuestion : null,
  };
}

function classifyRelation(input: {
  normalizedCurrent: string;
  previousSubstantiveUserQuestion: string | null;
  isScopeCorrection: boolean;
}): QuestionRelation {
  if (SOCIAL_PATTERN.test(input.normalizedCurrent)) return "social";
  if (input.previousSubstantiveUserQuestion && isRewriteRequest(input.normalizedCurrent)) return "rewrite";
  if (!input.previousSubstantiveUserQuestion) return "new";
  if (input.isScopeCorrection) return "context_follow_up";
  if (isContextFollowUp(input.normalizedCurrent)) return "context_follow_up";
  return "new";
}

function isRewriteRequest(normalizedQuestion: string) {
  if (REWRITE_ACTION_PATTERN.test(normalizedQuestion) && REWRITE_TARGET_PATTERN.test(normalizedQuestion)) return true;
  return LIST_REWRITE_ACTION_PATTERN.test(normalizedQuestion) && REWRITE_REFERENCE_PATTERN.test(normalizedQuestion);
}

export function classifyRewriteIntent(question: string): RewriteIntent | null {
  const normalizedQuestion = normalizeForFrame(question);
  if (!isRewriteRequest(normalizedQuestion)) return null;
  if (LIST_FORMAT_PATTERN.test(normalizedQuestion)) return "format_list";
  if (SHORTEN_PATTERN.test(normalizedQuestion)) return "shorten";
  return "rewrite";
}

function isContextFollowUp(normalizedQuestion: string) {
  if (CONTEXT_REFERENCE_PATTERN.test(normalizedQuestion)) return true;
  const tokenCount = words(normalizedQuestion).length;
  return tokenCount <= 16 && SHORT_CONTEXT_PRONOUN_PATTERN.test(normalizedQuestion);
}

function findPreviousSubstantiveUserQuestion(currentQuestion: string, messages: QuestionFrameMessage[]) {
  const normalizedCurrent = normalizeForFrame(currentQuestion);
  let end = messages.length;

  const lastMessage = messages.at(-1);
  if (lastMessage?.role === "user" && normalizeForFrame(lastMessage.content) === normalizedCurrent) {
    end -= 1;
  }

  for (let index = end - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== "user") continue;

    const content = cleanQuestion(message.content);
    if (!content || !isSubstantiveUserQuestion(content)) continue;
    return content;
  }

  return null;
}

function isSubstantiveUserQuestion(question: string) {
  const normalized = normalizeForFrame(question);
  if (!normalized || SOCIAL_PATTERN.test(normalized) || isRewriteRequest(normalized)) return false;

  const signals = extractScopeSignals(normalized);
  if (looksLikeScopeOnlyStatement(normalized, signals)) return false;
  return true;
}

function looksLikeScopeOnlyStatement(normalizedQuestion: string, signals: ScopeSignals) {
  if (!hasScopeSignals(signals) || signals.includedScopes.length > 1) return false;
  if (SUBSTANTIVE_TOPIC_PATTERN.test(normalizedQuestion)) return false;

  const withoutScopes = removeScopeAliases(normalizedQuestion)
    .replace(SCOPE_ONLY_FILLER_PATTERN, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const remainingWords = words(withoutScopes);

  return CORRECTION_CUE_PATTERN.test(normalizedQuestion) || remainingWords.length <= 2;
}

function extractScopeSignals(normalizedQuestion: string): ScopeSignals {
  const mentions = SCOPE_ORDER.flatMap((scope) => collectScopeMentions(normalizedQuestion, scope));
  const excludedScopes = SCOPE_ORDER.filter((scope) => mentions.some((mention) => mention.scope === scope && mention.excluded));
  const includedScopes = SCOPE_ORDER.filter(
    (scope) => mentions.some((mention) => mention.scope === scope && !mention.excluded) && !excludedScopes.includes(scope),
  );

  return { includedScopes, excludedScopes };
}

function collectScopeMentions(normalizedQuestion: string, scope: CanonicalProductScope): ScopeMention[] {
  const mentions: ScopeMention[] = [];

  for (const pattern of SCOPE_PATTERNS[scope]) {
    pattern.lastIndex = 0;
    for (const match of normalizedQuestion.matchAll(pattern)) {
      const start = match.index ?? -1;
      if (start < 0) continue;
      const end = start + match[0].length;
      if (mentions.some((mention) => rangesOverlap(start, end, mention.start, mention.end))) continue;

      mentions.push({
        scope,
        start,
        end,
        excluded: mentionIsExcluded(normalizedQuestion, start, end),
      });
    }
  }

  return mentions;
}

function mentionIsExcluded(question: string, start: number, end: number) {
  const prefix = question.slice(Math.max(0, start - 56), start);
  const suffix = question.slice(end, Math.min(question.length, end + 40));

  if (/\bnot\s+only\s*$/.test(prefix)) return false;

  const excludedBefore =
    /(?:\bnot\b|\bno\b|\bwithout\b|\bexcept\b|\bexclude(?:d|s|ing)?\b|\banything\s+but\b|\bbut\s+not\b|\brather\s+than\b|\binstead\s+of\b)(?:\s+(?:for|a|an|the|any|our|this|that|other|type|kind|of))*\s*$/.test(
      prefix,
    );
  const excludedAfter = /^\s*(?:show|program)?\s*(?:is\s+not|isn't|does\s+not\s+apply|doesn't\s+apply)\b/.test(suffix);

  return excludedBefore || excludedAfter;
}

function removeScopeAliases(value: string) {
  let result = value;
  for (const scope of SCOPE_ORDER) {
    for (const pattern of SCOPE_PATTERNS[scope]) {
      pattern.lastIndex = 0;
      result = result.replace(pattern, " ");
    }
  }
  return result;
}

function scopeFromSignals(signals: ScopeSignals): QuestionScope {
  if (signals.includedScopes.length > 1) return "comparison";
  return signals.includedScopes[0] || "unknown";
}

function hasScopeSignals(signals: ScopeSignals) {
  return Boolean(signals.includedScopes.length || signals.excludedScopes.length);
}

function emptyScopeSignals(): ScopeSignals {
  return { includedScopes: [], excludedScopes: [] };
}

function normalizeForFrame(value: string) {
  return value
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/[-_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanQuestion(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function words(value: string) {
  return value.match(/[a-z0-9]+/g) || [];
}

function rangesOverlap(firstStart: number, firstEnd: number, secondStart: number, secondEnd: number) {
  return firstStart < secondEnd && secondStart < firstEnd;
}

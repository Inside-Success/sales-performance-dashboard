import type { KnowledgeRefreshSourceKind } from "@/lib/ask-sales-faq/knowledge-refresh-sources";

export type KnowledgeRefreshAnalysisMode = "full" | "delta";

export type KnowledgeRefreshNoiseDecision = {
  status: "needs_review" | "needs_owner" | "duplicate";
  reason: string | null;
};

type SlackMessageBlock = {
  rootTs: string;
  ts: string;
  raw: string;
};

const NO_CHANGE_PATTERNS = [
  /^\s*no change (?:is )?needed\b/i,
  /^\s*(?:the )?(?:existing |current )?(?:rule|policy|status) (?:is )?(?:still )?(?:active|inactive|unchanged|the same|on|off)(?:\.|;)?\s*$/i,
  /^\s*(?:the )?show remains? (?:active|inactive|unchanged)(?:\.|;)?\s*$/i,
];

export function classifyKnowledgeRefreshCandidateNoise(input: {
  proposedPolicy: string;
  title: string;
  confidence: number;
  duplicateOfCandidateId?: string | null;
  candidateKind?: "new_rule" | "rule_change" | "conflict" | "clarification" | "knowledge_gap";
  domains?: string[];
  actions?: string[];
  entities?: string[];
  isDurable?: boolean;
  isReusable?: boolean;
  answerImpact?: "material" | "possible" | "none";
  sourceAuthority?: "owner_confirmed" | "manager_guidance" | "rep_answer" | "rep_question" | "unknown";
  authorityName?: string | null;
  atomicDecisionCount?: number;
}): KnowledgeRefreshNoiseDecision {
  if (input.duplicateOfCandidateId) {
    return {
      status: "duplicate",
      reason: `Automatically screened as an exact repeat of preserved candidate ${input.duplicateOfCandidateId}.`,
    };
  }

  if (NO_CHANGE_PATTERNS.some((pattern) => pattern.test(input.proposedPolicy))) {
    return {
      status: "duplicate",
      reason: "Automatically screened because the source explicitly says the governed value did not change.",
    };
  }

  if (input.atomicDecisionCount && input.atomicDecisionCount !== 1) {
    return {
      status: "needs_owner",
      reason: "The extraction combines more than one independently approvable decision and must be separated before review.",
    };
  }

  if (input.isDurable === false || input.isReusable === false || input.answerImpact === "none") {
    return {
      status: "duplicate",
      reason: "Automatically screened because it is not a durable, reusable change to a rep-facing answer.",
    };
  }

  if (input.candidateKind === "knowledge_gap") {
    return {
      status: "needs_owner",
      reason: "This is a possible reusable knowledge gap, not an approvable policy statement. An accountable owner must supply the answer.",
    };
  }

  if (!input.domains?.length || !input.actions?.length || !input.entities?.length) {
    return {
      status: "needs_owner",
      reason: "The policy decision could not be classified precisely enough to compare or approve safely.",
    };
  }

  if (input.sourceAuthority === "rep_question" || input.sourceAuthority === "rep_answer" || input.sourceAuthority === "unknown") {
    return {
      status: "needs_owner",
      reason: "The source does not establish accountable policy authority; an owner must confirm the rule.",
    };
  }

  const namedAuthority = normalizeAuthorityName(input.authorityName);
  if (["owner_confirmed", "manager_guidance"].includes(input.sourceAuthority || "") && !namedAuthority) {
    return {
      status: "needs_owner",
      reason: "The source was labeled authoritative, but no accountable person was identified in the evidence.",
    };
  }

  if (input.sourceAuthority === "manager_guidance") {
    return {
      status: "needs_owner",
      reason: `${namedAuthority} provided relevant guidance, but the final rule still requires an admin authority and scope check.`,
    };
  }

  if (input.answerImpact === "possible") {
    return {
      status: "needs_owner",
      reason: "The source may affect a reusable answer, but the material policy impact is not explicit.",
    };
  }

  if (input.confidence < 0.8) {
    return {
      status: "needs_owner",
      reason: "AI confidence is below 80%; an accountable owner must confirm the source before any approval.",
    };
  }

  return { status: "needs_review", reason: null };
}

function normalizeAuthorityName(value: string | null | undefined) {
  const normalized = String(value || "").toLowerCase().replace(/[^a-z]+/g, " ").trim();
  const potentialAuthorities = ["rudy", "rich", "mike", "raul", "madeline"];
  return potentialAuthorities.find((name) => normalized.split(/\s+/).includes(name)) || null;
}

export function buildKnowledgeRefreshAnalysisPayload(input: {
  kind: KnowledgeRefreshSourceKind;
  currentContent: string;
  previousContent?: string | null;
}) {
  if (!input.previousContent) {
    return { mode: "full" as const, content: input.currentContent, materialChange: true };
  }

  if (input.kind === "slack_channel") {
    return buildSlackThreadDelta(input.currentContent, input.previousContent);
  }

  const current = meaningfulSegments(input.currentContent, input.kind);
  const previous = meaningfulSegments(input.previousContent, input.kind);
  const currentKeys = new Set(current.map(segmentKey));
  const previousKeys = new Set(previous.map(segmentKey));
  const added = current.filter((segment) => !previousKeys.has(segmentKey(segment)));
  const removed = previous.filter((segment) => !currentKeys.has(segmentKey(segment)));

  if (!added.length && !removed.length) {
    return { mode: "delta" as const, content: "", materialChange: false };
  }

  const packet = [
    "This is a deterministic change-only packet, not the complete source.",
    "Only additions, removals, or replacements shown below may create candidates.",
    "A removed rule is a candidate only when the removal clearly changes what reps should do.",
    "",
    "<ADDED_OR_CHANGED>",
    added.length ? added.join("\n\n") : "[none]",
    "</ADDED_OR_CHANGED>",
    "",
    "<REMOVED_OR_REPLACED>",
    removed.length ? removed.join("\n\n") : "[none]",
    "</REMOVED_OR_REPLACED>",
  ].join("\n");

  return {
    mode: "delta" as const,
    content: packet.slice(0, 120_000),
    materialChange: true,
  };
}

export function doesKnowledgeRefreshEvidenceRemainCurrent(content: string, evidenceQuotes: string[]) {
  const normalizedContent = segmentKey(content);
  const substantiveQuotes = evidenceQuotes
    .map(segmentKey)
    .filter((quote) => quote.length >= 12);

  return substantiveQuotes.length > 0 && substantiveQuotes.every((quote) => normalizedContent.includes(quote));
}

function buildSlackThreadDelta(currentContent: string, previousContent: string) {
  const currentThreads = groupSlackThreads(currentContent);
  const previousThreads = groupSlackThreads(previousContent);
  if (!currentThreads.size || !previousThreads.size) {
    return buildGenericDelta(currentContent, previousContent, "slack_channel");
  }

  const addedOrChanged = Array.from(currentThreads.entries())
    .filter(([rootTs, thread]) => segmentKey(thread) !== segmentKey(previousThreads.get(rootTs) || ""))
    .map(([, thread]) => thread);
  const removed = Array.from(previousThreads.entries())
    .filter(([rootTs]) => !currentThreads.has(rootTs))
    .map(([, thread]) => thread);

  return buildDeltaPacket(addedOrChanged, removed);
}

function parseSlackMessages(content: string): SlackMessageBlock[] {
  const blocks: SlackMessageBlock[] = [];
  const pattern = /<SLACK_MESSAGE\s+root_ts=([^\s>]+)\s+ts=([^\s>]+)>[\s\S]*?<\/SLACK_MESSAGE>/g;
  for (const match of content.matchAll(pattern)) {
    blocks.push({ rootTs: match[1], ts: match[2], raw: match[0].trim() });
  }
  return blocks;
}

function groupSlackThreads(content: string) {
  const grouped = new Map<string, SlackMessageBlock[]>();
  for (const block of parseSlackMessages(content)) {
    const thread = grouped.get(block.rootTs) || [];
    thread.push(block);
    grouped.set(block.rootTs, thread);
  }
  return new Map(Array.from(grouped.entries()).map(([rootTs, blocks]) => [
    rootTs,
    blocks.sort((left, right) => left.ts.localeCompare(right.ts)).map((block) => block.raw).join("\n\n"),
  ]));
}

function buildGenericDelta(currentContent: string, previousContent: string, kind: KnowledgeRefreshSourceKind) {
  const current = meaningfulSegments(currentContent, kind);
  const previous = meaningfulSegments(previousContent, kind);
  const currentKeys = new Set(current.map(segmentKey));
  const previousKeys = new Set(previous.map(segmentKey));
  return buildDeltaPacket(
    current.filter((segment) => !previousKeys.has(segmentKey(segment))),
    previous.filter((segment) => !currentKeys.has(segmentKey(segment))),
  );
}

function buildDeltaPacket(added: string[], removed: string[]) {
  if (!added.length && !removed.length) {
    return { mode: "delta" as const, content: "", materialChange: false };
  }

  const packet = [
    "This is a deterministic change-only packet, not the complete source.",
    "For Slack, every included item contains one complete changed root thread so the question and replies stay together.",
    "Only additions, removals, or replacements shown below may create candidates.",
    "A removed rule is a candidate only when the removal clearly changes what reps should do.",
    "",
    "<ADDED_OR_CHANGED>",
    added.length ? added.join("\n\n") : "[none]",
    "</ADDED_OR_CHANGED>",
    "",
    "<REMOVED_OR_REPLACED>",
    removed.length ? removed.join("\n\n") : "[none]",
    "</REMOVED_OR_REPLACED>",
  ].join("\n");

  return { mode: "delta" as const, content: packet.slice(0, 120_000), materialChange: true };
}

function meaningfulSegments(value: string, kind: KnowledgeRefreshSourceKind) {
  return value
    .replace(/\r\n?/g, "\n")
    .split(kind === "google_sheet" ? /\n+/ : /\n{2,}|(?<=\.)\s+(?=[A-Z][^\n]{20,})/)
    .map((segment) => segment.replace(/\s+/g, " ").trim())
    .filter((segment) => segment.length >= 12)
    .slice(0, 10_000);
}

function segmentKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9$]+/g, " ").replace(/\s+/g, " ").trim();
}

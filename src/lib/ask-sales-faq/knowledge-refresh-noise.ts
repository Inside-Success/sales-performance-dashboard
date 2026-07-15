import type { KnowledgeRefreshSourceKind } from "@/lib/ask-sales-faq/knowledge-refresh-sources";

export type KnowledgeRefreshAnalysisMode = "full" | "delta";

export type KnowledgeRefreshNoiseDecision = {
  status: "needs_review" | "needs_owner" | "duplicate";
  reason: string | null;
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

  if (input.confidence < 0.55) {
    return {
      status: "needs_owner",
      reason: "AI confidence is below 55%; an accountable owner must confirm the source before any approval.",
    };
  }

  return { status: "needs_review", reason: null };
}

export function buildKnowledgeRefreshAnalysisPayload(input: {
  kind: KnowledgeRefreshSourceKind;
  currentContent: string;
  previousContent?: string | null;
}) {
  if (input.kind === "slack_channel" || !input.previousContent) {
    return { mode: "full" as const, content: input.currentContent, materialChange: true };
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

import type { AskSalesFaqChatMessage } from "@/lib/ask-sales-faq/types";
import type { V3TurnResolution } from "@/lib/ask-sales-faq/v3/types";
import { resolveV58Turn } from "@/lib/ask-sales-faq/v5-8/turn";

const SHORT_ANAPHORIC_FOLLOW_UP = /\b(?:it|they|them|their|those|that|this)\b/i;
const EXPLICIT_TOPIC_SWITCH = /\b(?:different|unrelated|new\s+question|switch(?:ing)?\s+(?:topics?|subjects?))\b/i;

/**
 * Resolve a short pronoun-dependent turn against the immediately preceding
 * user question. A tight word cap and explicit topic-switch guard prevent old
 * conversation state from contaminating a genuinely new question.
 */
export function resolveV59Turn(
  question: string,
  messages: AskSalesFaqChatMessage[] = [],
): V3TurnResolution {
  const turn = resolveV58Turn(question, messages);
  const wordCount = question.trim().split(/\s+/).filter(Boolean).length;
  if (
    turn.usedImmediateContext ||
    !turn.immediatePreviousUserQuestion ||
    wordCount > 22 ||
    EXPLICIT_TOPIC_SWITCH.test(question) ||
    !SHORT_ANAPHORIC_FOLLOW_UP.test(question)
  ) return turn;

  return {
    ...turn,
    kind: "follow_up",
    standaloneQuestion: [
      `Immediate prior subject: ${turn.immediatePreviousUserQuestion}`,
      `Current request about that subject: ${turn.currentQuestion}`,
    ].join("\n"),
    usedImmediateContext: true,
    intentResolutionMode: "deterministic",
    intentResolutionReason: "V5.9 resolved a short pronoun-dependent follow-up against the immediately preceding user question.",
  };
}

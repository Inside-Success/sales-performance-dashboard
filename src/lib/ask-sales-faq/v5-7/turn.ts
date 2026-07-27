import type { AskSalesFaqChatMessage } from "@/lib/ask-sales-faq/types";
import type { V3TurnResolution } from "@/lib/ask-sales-faq/v3/types";
import { resolveV56Turn } from "@/lib/ask-sales-faq/v5-6/turn";

const CONTEXT_DEPENDENT_FOLLOW_UP = /\b(?:anything\s+else|what\s+else|after\s+that|then\s+what|with\s+(?:her|him|them|their|his|its|that|this)|do\s+i\s+need\s+to\s+do)\b/i;
const EXPLICIT_TOPIC_SWITCH = /\b(?:different|unrelated|new\s+question|switch(?:ing)?\s+(?:topics?|subjects?))\b/i;

/**
 * Recover short, pronoun-dependent follow-ups from the immediate user turn.
 * This is intentionally bounded to explicit ellipsis/anaphora markers so a
 * genuinely new question is not silently contaminated with older context.
 */
export function resolveV57Turn(
  question: string,
  messages: AskSalesFaqChatMessage[] = [],
): V3TurnResolution {
  const turn = resolveV56Turn(question, messages);
  if (
    turn.usedImmediateContext ||
    !turn.immediatePreviousUserQuestion ||
    !CONTEXT_DEPENDENT_FOLLOW_UP.test(question) ||
    EXPLICIT_TOPIC_SWITCH.test(question)
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
    intentResolutionReason: "V5.7 resolved an explicitly anaphoric follow-up against the immediately preceding user question.",
  };
}

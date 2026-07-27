import type { AskSalesFaqChatMessage } from "@/lib/ask-sales-faq/types";
import type { V3TurnResolution } from "@/lib/ask-sales-faq/v3/types";
import { resolveV57Turn } from "@/lib/ask-sales-faq/v5-7/turn";

const BOUNDED_DEMONSTRATIVE_REFERENT = /\b(?:this|that|these|those)\s+(?:applicant|prospect|client|lead|person|case|show|package|rule|question|issue|payment|contract|request|booking|appointment)\b/i;
const BOUNDED_HANDLER_FOLLOW_UP = /\bwho\s+should\s+(?:handle|own|contact|call|follow\s+up\s+with)\s+(?:that|this|them|him|her)\b/i;
const EXPLICIT_TOPIC_SWITCH = /\b(?:different|unrelated|new\s+question|switch(?:ing)?\s+(?:topics?|subjects?))\b/i;

/**
 * Recover short demonstrative follow-ups from the immediately preceding user
 * question. The noun whitelist keeps the merge bounded so ordinary new turns
 * are not contaminated with stale conversation history.
 */
export function resolveV58Turn(
  question: string,
  messages: AskSalesFaqChatMessage[] = [],
): V3TurnResolution {
  const turn = resolveV57Turn(question, messages);
  if (
    turn.usedImmediateContext ||
    !turn.immediatePreviousUserQuestion ||
    EXPLICIT_TOPIC_SWITCH.test(question) ||
    (!BOUNDED_DEMONSTRATIVE_REFERENT.test(question) && !BOUNDED_HANDLER_FOLLOW_UP.test(question))
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
    intentResolutionReason: "V5.8 resolved a bounded demonstrative referent against the immediately preceding user question.",
  };
}

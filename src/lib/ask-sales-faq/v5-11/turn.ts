import type { AskSalesFaqChatMessage } from "@/lib/ask-sales-faq/types";
import type { V3TurnResolution } from "@/lib/ask-sales-faq/v3/types";
import { resolveV59Turn } from "@/lib/ask-sales-faq/v5-9/turn";

const ELLIPTICAL_CONTINUATION = /^(?:(?:and|but|so)\s+)?(?:what\s+if|how\s+about|even\s+if|if\s+(?:they|the\s+client)|can\s+i\s+also|could\s+i\s+also|do\s+i\s+still)\b/i;
const GENERIC_SEND_OBJECT = /\b(?:email|send|share|show|give)\b[\s\S]{0,80}\b(?:something|one|it|that|this|them|the\s+team)\b/i;
const PRIOR_GOVERNED_ARTIFACT = /\b(?:pdf|slide\s*deck|slides?|license\s+options?|contract|episode|reels?|clips?|testimonial|payment\s+link|green\s*light|zoom\s+link)\b/i;
const EXPLICIT_TOPIC_SWITCH = /\b(?:different|unrelated|new\s+question|switch(?:ing)?\s+(?:topics?|subjects?))\b/i;

/**
 * Carry a missing object only from the immediately preceding user turn. The
 * current turn must be both short and explicitly elliptical, and the prior
 * turn must name a governed sales artifact. This avoids broad conversation
 * memory while preserving natural follow-ups such as "email something" after
 * a question about the approved PDF and prohibited slide deck.
 */
export function resolveV511Turn(
  question: string,
  messages: AskSalesFaqChatMessage[] = [],
): V3TurnResolution {
  const turn = resolveV59Turn(question, messages);
  const normalizedQuestion = question.trim().replace(/\s+/g, " ");
  const history = messages.map((message) => ({ ...message, content: message.content.trim().replace(/\s+/g, " ") }));
  if (history.at(-1)?.role === "user" && history.at(-1)?.content === normalizedQuestion) history.pop();
  const previousUserQuestion = [...history].reverse().find((message) => message.role === "user")?.content ||
    turn.immediatePreviousUserQuestion;
  const wordCount = question.trim().split(/\s+/).filter(Boolean).length;
  if (
    turn.usedImmediateContext ||
    !previousUserQuestion ||
    wordCount > 30 ||
    EXPLICIT_TOPIC_SWITCH.test(question) ||
    !ELLIPTICAL_CONTINUATION.test(question) ||
    !GENERIC_SEND_OBJECT.test(question) ||
    !PRIOR_GOVERNED_ARTIFACT.test(previousUserQuestion)
  ) return turn;

  return {
    ...turn,
    kind: "follow_up",
    standaloneQuestion: [
      `Immediate prior subject: ${previousUserQuestion}`,
      `Current request about that subject: ${turn.currentQuestion}`,
    ].join("\n"),
    usedImmediateContext: true,
    immediatePreviousUserQuestion: previousUserQuestion,
    intentResolutionMode: "deterministic",
    intentResolutionReason: "V5.11 resolved a bounded omitted sales-artifact referent from the immediately preceding user question.",
  };
}

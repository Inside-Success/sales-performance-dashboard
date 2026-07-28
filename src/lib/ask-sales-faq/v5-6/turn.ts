import type { AskSalesFaqChatMessage } from "@/lib/ask-sales-faq/types";
import type { V3TurnResolution } from "@/lib/ask-sales-faq/v3/types";
import { resolveV4SystemicTurn } from "@/lib/ask-sales-faq/v4/systemic/turn";

const OBJECT_CHANGING_FOLLOW_UP = /^(?:(?:and|also|so|but)\s+)?(?:what|how)\s+about\b/i;
const CONCRETE_POLICY_OBJECT = /\b(?:reels?|clips?|episode|video|trailer|post|posting|social\s+media|contract|package|payment|installment|price|call\s*[12]|cohort|deadline|applicant|client|prospect|doctor|author|show|platform|rights?)\b/i;
const EXPLICIT_REWRITE_OBJECT = /\b(?:answer|response|wording|sentence|paragraph|version|format|table|bullet|checklist)\b/i;

/**
 * V3 treats the adjective "shorter" as a rewrite signal. V5.6 preserves that
 * behavior for answer-editing requests, but treats a "what about ..." question
 * with a concrete new sales-policy object as an ordinary contextual follow-up.
 */
export function resolveV56Turn(
  question: string,
  messages: AskSalesFaqChatMessage[] = [],
): V3TurnResolution {
  const turn = resolveV4SystemicTurn(question, messages);
  if (
    turn.kind !== "rewrite" ||
    !turn.immediatePreviousUserQuestion ||
    !OBJECT_CHANGING_FOLLOW_UP.test(question) ||
    !CONCRETE_POLICY_OBJECT.test(question) ||
    EXPLICIT_REWRITE_OBJECT.test(question)
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
    intentResolutionReason: "V5.6 resolved a what-about question with a concrete new policy object as a contextual follow-up, not an answer rewrite.",
  };
}

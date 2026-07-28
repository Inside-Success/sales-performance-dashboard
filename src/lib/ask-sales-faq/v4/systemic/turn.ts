import type { AskSalesFaqChatMessage } from "@/lib/ask-sales-faq/types";
import type { V3ProductScope } from "@/lib/ask-sales-faq/v3/types";
import { resolveV4Turn, type V4TurnResolution } from "@/lib/ask-sales-faq/v4/turn";

function explicitScope(value: string): V3ProductScope {
  const main = /\b(?:main\s+istv|main\s+show|inside\s+success\s+tv)\b/i.test(value);
  const dj = /\b(?:daymond\s+john|next\s+level\s+ceo|nlceo|dj\s*\/\s*nlceo|dj\s+show)\b/i.test(value);
  if (main && dj) return "comparison";
  if (main) return "main_istv";
  if (dj) return "dj_nlceo";
  return "unknown";
}

function inheritedConversationScope(turn: V4TurnResolution) {
  if (turn.productScope !== "unknown" || (turn.kind !== "follow_up" && turn.kind !== "clarification")) {
    return turn.productScope;
  }
  for (let index = turn.contextMessages.length - 1; index >= 0; index -= 1) {
    const message = turn.contextMessages[index];
    if (message.role !== "user") continue;
    const scope = explicitScope(message.content);
    if (scope !== "unknown") return scope;
  }
  return "unknown";
}

function editDistance(left: string, right: string) {
  const rows = Array.from({ length: left.length + 1 }, (_, index) => index);
  for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
    let diagonal = rows[0];
    rows[0] = rightIndex;
    for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
      const previous = rows[leftIndex];
      rows[leftIndex] = Math.min(
        rows[leftIndex] + 1,
        rows[leftIndex - 1] + 1,
        diagonal + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
      diagonal = previous;
    }
  }
  return rows[left.length];
}

function clarificationSelection(turn: V4TurnResolution) {
  const selection = turn.currentQuestion.replace(/^["'`\s]+|["'`\s.!?]+$/g, "").trim();
  if (!selection || selection.split(/\s+/).length > 3 || selection.length > 40) return null;
  const prior = turn.immediatePreviousAssistantAnswer || "";
  if (!/[?]/.test(prior)) return null;
  const escaped = selection.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (/\bor\b/i.test(prior) && new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(prior)) return selection;
  if (!/\b(?:could refer|refer to|did you mean|do you mean|specify|clarif|which term|what context)\b/i.test(prior)) return null;
  const selectedToken = selection.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (selectedToken.length < 2 || selectedToken.length > 10) return null;
  const previousTokens = (turn.immediatePreviousUserQuestion || "").toLowerCase().match(/[a-z0-9]{2,10}/g) || [];
  return previousTokens.some((token) => editDistance(selectedToken, token) <= Math.min(2, Math.ceil(selectedToken.length / 3)))
    ? selection
    : null;
}

/**
 * V4's base turn resolver intentionally uses only the immediate prior subject.
 * The systemic lab keeps the same behavior, but carries the nearest explicit
 * product scope through a short chain of referential follow-ups. This prevents
 * a scoped policy from the other product being selected after two or more turns.
 */
export function resolveV4SystemicTurn(question: string, messages: AskSalesFaqChatMessage[] = []): V4TurnResolution {
  let turn = resolveV4Turn(question, messages);
  const selectedSubject = clarificationSelection(turn);
  if (selectedSubject) {
    turn = {
      ...turn,
      kind: "follow_up",
      standaloneQuestion: `The user clarified that the intended subject is ${selectedSubject}. What company policy applies to ${selectedSubject}?`,
      usedImmediateContext: true,
      explicitCorrection: true,
      actionableQuestion: turn.currentQuestion,
      intentResolutionReason: "Resolved a short selection from the assistant's immediately preceding clarification question.",
    };
  }
  const productScope = inheritedConversationScope(turn);
  if (productScope === turn.productScope || productScope === "unknown" || productScope === "comparison") return turn;
  const excluded: "main_istv" | "dj_nlceo" = productScope === "main_istv" ? "dj_nlceo" : "main_istv";
  return {
    ...turn,
    productScope,
    excludedScopes: [...new Set([...turn.excludedScopes, excluded])],
    standaloneQuestion: [
      `Inherited conversation product scope: ${productScope === "main_istv" ? "main ISTV" : "Daymond John / Next Level CEO"}.`,
      turn.standaloneQuestion,
    ].join("\n"),
    intentResolutionReason: `${turn.intentResolutionReason} Preserved the nearest explicit product scope across the follow-up chain.`,
  };
}

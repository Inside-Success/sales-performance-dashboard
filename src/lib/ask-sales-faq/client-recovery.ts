import type { AskSalesFaqResponse } from "./types";

export type RecoveryRequest = {
  conversationId: string | null;
  clientRequestId: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
};

// An uncertain transport outcome must reuse the original key. The server either
// returns the saved answer or says it is still in progress, without a second run.
export function recoveryAfterResponse(request: RecoveryRequest, response: Pick<AskSalesFaqResponse, "outcome" | "conversationId">, newId: () => string): RecoveryRequest | null {
  if (response.outcome === "duplicate_in_progress") return request;
  if (response.outcome === "safe_fallback") return { ...request, conversationId: response.conversationId, clientRequestId: newId() };
  return null;
}

export async function requestFaqAnswer(request: RecoveryRequest, fetcher: typeof fetch = fetch): Promise<AskSalesFaqResponse> {
  const response = await fetcher("/api/ask-sales-faq", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request),
  });
  const data = await response.json() as Partial<AskSalesFaqResponse>;
  if (!response.ok || !data.ok || !data.answer || !data.messageId || !data.conversationId) {
    throw new Error("The connection was interrupted. Check for your answer before trying a new request.");
  }
  return data as AskSalesFaqResponse;
}

export function canRetrySavedAnswer(message?: { role: string; outcome?: string | null; retryableFailure?: boolean }) {
  return message?.role === "assistant" && message.outcome === "safe_fallback" && message.retryableFailure === true;
}

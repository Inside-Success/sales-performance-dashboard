import type { AskSalesFaqFeedbackContext } from "@/lib/ask-sales-faq/types";

const FEEDBACK_SYNC_TIMEOUT_MS = 2500;

export type AskSalesFaqFeedbackSyncResult =
  | { status: "skipped"; reason: "not_configured" | "missing_context" }
  | { status: "sent"; targetTab: "Positive Reviews" | "Negative Reviews" }
  | { status: "failed"; reason: string };

export async function syncAskSalesFaqFeedbackToSheet(
  context: AskSalesFaqFeedbackContext | null,
): Promise<AskSalesFaqFeedbackSyncResult> {
  const webhookUrl = process.env.ASK_SALES_FAQ_FEEDBACK_WEBHOOK_URL;
  if (!webhookUrl) return { status: "skipped", reason: "not_configured" };
  if (!context) return { status: "skipped", reason: "missing_context" };

  const targetTab = context.rating === "up" ? "Positive Reviews" : "Negative Reviews";
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-ask-sales-faq-source": "sales-performance-dashboard",
  };

  if (process.env.ASK_SALES_FAQ_FEEDBACK_WEBHOOK_SECRET) {
    headers["x-ask-sales-faq-feedback-secret"] = process.env.ASK_SALES_FAQ_FEEDBACK_WEBHOOK_SECRET;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        submitted_at: new Date().toISOString(),
        target_tab: targetTab,
        rating: context.rating,
        viewer_email: context.viewerEmail,
        conversation_id: context.conversationId,
        conversation_title: context.conversationTitle,
        message_id: context.messageId,
        question: context.question,
        answer: context.answer,
        outcome: context.outcome,
        source_label: context.sourceLabel,
        source_last_reviewed: context.sourceLastReviewed,
        needs_route: context.needsRoute,
        route_reason: context.routeReason,
        provider: context.provider,
        model: context.model,
        comment: context.comment,
        message_created_at: context.createdAt,
      }),
      signal: AbortSignal.timeout(FEEDBACK_SYNC_TIMEOUT_MS),
    });

    if (!response.ok) {
      return { status: "failed", reason: `webhook_status_${response.status}` };
    }

    return { status: "sent", targetTab };
  } catch (error) {
    return {
      status: "failed",
      reason: error instanceof Error ? error.message : "unknown_sync_error",
    };
  }
}

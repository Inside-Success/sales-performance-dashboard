import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getAskSalesFaqAccess } from "@/lib/ask-sales-faq/access";
import { syncAskSalesFaqFeedbackToSheet } from "@/lib/ask-sales-faq/feedback-sync";
import { getAskSalesFaqFeedbackContext, saveAskSalesFaqFeedback } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const feedbackSchema = z
  .object({
    messageId: z.string().trim().min(1).max(160),
    conversationId: z.string().trim().min(1).max(160),
    rating: z.enum(["up", "down"]),
    comment: z.string().trim().max(4000).optional().nullable(),
  })
  .refine((value) => value.rating !== "down" || Boolean(value.comment?.trim()), {
    message: "A comment is required for thumbs down feedback.",
    path: ["comment"],
  });

export async function POST(request: NextRequest) {
  const session = await auth();
  const access = getAskSalesFaqAccess(session);

  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.message, code: access.code }, { status: access.status });
  }

  let payload: z.infer<typeof feedbackSchema>;
  try {
    payload = feedbackSchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { ok: false, error: "Send a rating. Thumbs down requires a comment.", requiresComment: true },
      { status: 400 },
    );
  }

  try {
    await saveAskSalesFaqFeedback({
      id: `faq_feedback_${randomUUID()}`,
      messageId: payload.messageId,
      conversationId: payload.conversationId,
      viewerEmail: access.viewerEmail,
      rating: payload.rating,
      comment: payload.comment?.trim() || null,
    });

    const feedbackContext = await getAskSalesFaqFeedbackContext({
      messageId: payload.messageId,
      conversationId: payload.conversationId,
      viewerEmail: access.viewerEmail,
      rating: payload.rating,
      comment: payload.comment?.trim() || null,
    });
    const sheetSync = await syncAskSalesFaqFeedbackToSheet(feedbackContext);

    if (sheetSync.status === "failed") {
      console.warn("Ask Sales FAQ feedback sheet sync failed", {
        messageId: payload.messageId,
        conversationId: payload.conversationId,
        reason: sheetSync.reason,
      });
    }

    return NextResponse.json({
      ok: true,
      requiresComment: payload.rating === "down",
      sheetSync,
    });
  } catch (error) {
    console.error("Ask Sales FAQ feedback failed", error);
    return NextResponse.json({ ok: false, error: "Feedback could not be saved right now." }, { status: 202 });
  }
}

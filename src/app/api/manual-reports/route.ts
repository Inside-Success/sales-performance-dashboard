import { auth } from "@/auth";
import { manualDeliveryUrls } from "@/lib/manual-delivery";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { createManualFeedbackReport, hasDatabase, updateManualFeedbackStatus } from "@/lib/db";
import { isManualFeedbackEnabled, manualSubmitSchema } from "@/lib/manual-reports";
import { resolveZoomTranscript } from "@/lib/zoom-transcript";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  if (!isManualFeedbackEnabled()) {
    return NextResponse.json({ ok: false, error: "Manual feedback is disabled" }, { status: 404 });
  }

  if (!hasDatabase()) {
    return NextResponse.json(
      { ok: false, error: "DATABASE_URL is not configured" },
      { status: 500 },
    );
  }

  try {
    const webhookUrl =
      process.env.MANUAL_FEEDBACK_WEBHOOK_URL ||
      "https://insidesuccess.app.n8n.cloud/webhook/manual-sales-feedback";
    const body = await request.json();
    const payload = manualSubmitSchema.parse(body);
    const publicId = randomUUID().replace(/-/g, "");

    // Reject local/preview dispatch before storing a job or running paid analysis.
    const { callbackUrl, reportUrl } = manualDeliveryUrls(request.nextUrl.origin, publicId, process.env.VERCEL_ENV);
    const dispatchSecret = process.env.MANUAL_FEEDBACK_SECRET || process.env.INGEST_SECRET;
    if (!dispatchSecret) throw new Error("Manual feedback delivery is not configured.");
    await createManualFeedbackReport(publicId, payload);

    if (!webhookUrl) {
      await updateManualFeedbackStatus(
        publicId,
        "failed",
        "Manual feedback workflow URL is not configured.",
      );
      return NextResponse.json({ ok: true, public_id: publicId, status: "failed" });
    }

    let workflowTranscriptText =
      payload.input_type === "transcript" ? payload.transcript_text : null;
    let transcriptLink: string | null = null;

    if (payload.input_type === "zoom_link" && payload.zoom_link) {
      try {
        const zoomTranscript = await resolveZoomTranscript(payload.zoom_link);
        workflowTranscriptText = zoomTranscript?.transcriptText || null;
        transcriptLink = zoomTranscript?.transcriptUrl || null;
      } catch {
        workflowTranscriptText = null;
        transcriptLink = null;
      }
    }

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${dispatchSecret}`,
          "x-manual-feedback-source": "sales-performance-dashboard",
        },
        body: JSON.stringify({
          public_id: publicId,
          callback_url: callbackUrl,
          report_url: reportUrl,
          rep_name: payload.rep_name,
          rep_email: payload.rep_email,
          client_name: payload.client_name,
          input_type: payload.input_type,
          transcript_text: workflowTranscriptText,
          zoom_link: payload.input_type === "zoom_link" ? payload.zoom_link : null,
          transcript_link: transcriptLink,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        await updateManualFeedbackStatus(
          publicId,
          "failed",
          `Manual feedback workflow rejected the request with HTTP ${response.status}.`,
        );
        return NextResponse.json({ ok: true, public_id: publicId, status: "failed" });
      }

      const updated = await updateManualFeedbackStatus(publicId, "processing");
      return NextResponse.json({ ok: true, public_id: publicId, status: updated?.status || "processing" });
    } catch (error) {
      await updateManualFeedbackStatus(
        publicId,
        "processing",
        "Submission receipt could not be confirmed. Keep this link while we check for the result; do not resubmit the same call yet.",
      );
      console.error("Manual workflow receipt unavailable", error instanceof Error ? error.name : "UnknownError");
      return NextResponse.json({ ok: true, public_id: publicId, status: "processing" });
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { ok: false, error: "Invalid payload", details: error.flatten() },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Manual report creation failed" },
      { status: 400 },
    );
  }
}

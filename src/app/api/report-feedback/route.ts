import { NextResponse } from "next/server";
import { z } from "zod";
import { getManualFeedbackReport, getPerformanceCall } from "@/lib/db";
import { isEnhancedReport } from "@/lib/report-version";

export const dynamic = "force-dynamic";

const FEEDBACK_FORWARD_TIMEOUT_MS = 2500;

const feedbackSchema = z
  .object({
    rating: z.enum(["positive", "negative"]),
    report_type: z.enum(["official", "manual"]),
    report_id: z.string().trim().min(1),
    respondent_name: z.string().trim().optional().nullable(),
    comment: z.string().trim().optional().nullable(),
    page_url: z.string().trim().url().optional().nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.rating !== "negative") return;

    if (!value.respondent_name) {
      ctx.addIssue({
        code: "custom",
        path: ["respondent_name"],
        message: "Name is required for negative feedback.",
      });
    }

    if (!value.comment) {
      ctx.addIssue({
        code: "custom",
        path: ["comment"],
        message: "Feedback detail is required.",
      });
    }
  });

export async function POST(request: Request) {
  try {
    const parsed = feedbackSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message || "Invalid feedback payload." },
        { status: 400 },
      );
    }

    const payload = parsed.data;
    const webhookUrl = process.env.REPORT_FEEDBACK_WEBHOOK_URL;
    const webhookSecret = process.env.REPORT_FEEDBACK_WEBHOOK_SECRET;

    if (!webhookUrl) {
      return NextResponse.json(
        { ok: false, error: "Report feedback webhook is not configured." },
        { status: 503 },
      );
    }

    const report =
      payload.report_type === "official"
        ? await getPerformanceCall(payload.report_id)
        : await getManualFeedbackReport(payload.report_id);

    if (!report) {
      return NextResponse.json({ ok: false, error: "Report was not found." }, { status: 404 });
    }

    if (!isEnhancedReport(report.source_payload.coaching_version)) {
      return NextResponse.json(
        { ok: false, error: "Feedback is only available for Enhanced reports." },
        { status: 403 },
      );
    }

    const forwardedPayload = {
      submitted_at: new Date().toISOString(),
      rating: payload.rating,
      report_type: payload.report_type,
      report_id: payload.report_id,
      report_version: "enhanced",
      report_created_at: report.created_at,
      rep_name: report.rep_name,
      client_name: report.client_name,
      respondent_name: payload.rating === "negative" ? payload.respondent_name : null,
      comment: payload.rating === "negative" ? payload.comment : null,
      page_url: payload.page_url || null,
    };

    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (webhookSecret) headers["x-report-feedback-secret"] = webhookSecret;

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(forwardedPayload),
      signal: AbortSignal.timeout(FEEDBACK_FORWARD_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`Feedback webhook returned ${response.status}`);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Report feedback submission failed", error);
    return NextResponse.json(
      { ok: false, error: "Feedback could not be saved right now." },
      { status: 502 },
    );
  }
}

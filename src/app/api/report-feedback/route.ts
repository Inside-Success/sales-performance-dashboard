import { createHash, randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { isAllowedAuthEmail, normalizeAuthEmail } from "@/lib/auth-utils";
import { saveCoachingFeedback, markCoachingFeedbackForward } from "@/lib/feedback-store";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getManualFeedbackReport, getPerformanceCall } from "@/lib/db";
import { isEnhancedReport } from "@/lib/report-version";

export const dynamic = "force-dynamic";

const FEEDBACK_FORWARD_TIMEOUT_MS = 2500;

const feedbackSchema = z
  .object({
    submission_id: z.string().uuid().optional(),
    rating: z.enum(["positive", "negative"]),
    report_type: z.enum(["official", "manual"]),
    report_id: z.string().trim().min(1),
    respondent_name: z.string().trim().max(200).optional().nullable(),
    comment: z.string().trim().max(5000).optional().nullable(),
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
  const session = await auth();
  const email = normalizeAuthEmail(session?.user?.email);
  if (!email || !isAllowedAuthEmail(email)) return NextResponse.json({ok:false,error:"Sign in to send feedback."},{status:401});
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ok:false,error:"Open feedback on the dashboard."},{status:403});
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

    if (!webhookUrl && payload.rating === "positive") {
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

    const hash = createHash("sha256").update(JSON.stringify({reportType:payload.report_type,reportId:payload.report_id,name:payload.respondent_name,comment:payload.comment})).digest("hex");
    const submissionId = payload.submission_id || (payload.rating === "negative" ? `legacy_${createHash("sha256").update(email + hash).digest("hex")}` : randomUUID());
    if (payload.rating === "negative") {
      const saved = await saveCoachingFeedback(submissionId,email,hash,forwardedPayload);
      if (saved.conflict) return NextResponse.json({ok:false,error:"This submission changed. Reload the report before sending new feedback."},{status:409});
      if (!saved.fresh) return NextResponse.json({ok:true});
    }
    // Sheets currently uses USER_ENTERED. Preserve plain text rather than formulas.
    const safePayload = Object.fromEntries(Object.entries(forwardedPayload).map(([key,value]) => [key,typeof value === "string" && /^[=+@-]/.test(value) ? `'${value}` : value]));
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (webhookSecret) headers["x-report-feedback-secret"] = webhookSecret;

    try {
      if (!webhookUrl) throw new Error("Feedback mirror not configured");
      const response = await fetch(webhookUrl, {
        method: "POST", headers, body: JSON.stringify(safePayload),
        signal: AbortSignal.timeout(FEEDBACK_FORWARD_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`Feedback webhook returned ${response.status}`);
      if (payload.rating === "negative") await markCoachingFeedbackForward(submissionId,"received");
    } catch (error) {
      if (payload.rating === "positive") throw error;
      await markCoachingFeedbackForward(submissionId,"uncertain").catch(() => undefined);
      console.warn("Saved coaching feedback needs mirror verification", {submissionId});
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

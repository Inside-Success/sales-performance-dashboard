import { z } from "zod";
import { resolveCloseSection } from "@/lib/close-section";
import { normalizeStringList } from "@/lib/list-format";
import type { JsonObject, ManualFeedbackReport } from "@/lib/types";

const MANUAL_REPORT_TIMEOUT_MS = 5 * 60 * 1000;
const WAITING_MANUAL_REPORT_STATUSES = new Set(["pending", "processing"]);

const optionalString = z
  .union([z.string(), z.number(), z.boolean(), z.null()])
  .optional()
  .transform((value) => {
    if (value === null || value === undefined) return null;
    const text = String(value).trim();
    return text.length ? text : null;
  });

const statusSchema = z.enum([
  "pending",
  "processing",
  "completed",
  "refused",
  "needs_transcript_paste",
  "failed",
]);

export const manualSubmitSchema = z
  .object({
    input_type: z.enum(["transcript", "zoom_link"]),
    rep_name: optionalString,
    rep_email: optionalString,
    client_name: optionalString,
    transcript_text: optionalString,
    zoom_link: optionalString,
  })
  .superRefine((value, ctx) => {
    if (!value.rep_name) {
      ctx.addIssue({
        code: "custom",
        path: ["rep_name"],
        message: "Rep name is required so the report can be saved under your name",
      });
    }

    if (value.input_type === "transcript" && (!value.transcript_text || value.transcript_text.length < 80)) {
      ctx.addIssue({
        code: "custom",
        path: ["transcript_text"],
        message: "Paste a longer transcript before submitting",
      });
    }

    if (value.input_type === "zoom_link" && !value.zoom_link) {
      ctx.addIssue({
        code: "custom",
        path: ["zoom_link"],
        message: "Zoom link is required",
      });
    }
  });

export const manualCallbackSchema = z
  .object({
    public_id: optionalString,
    status: statusSchema.default("completed"),
    rep_name: optionalString,
    rep_email: optionalString,
    client_name: optionalString,
    source_type: optionalString,
    zoom_link: optionalString,
    original_zoom_link: optionalString,
    meeting_link: optionalString,
    transcript_link: optionalString,
    meeting_transcript_link: optionalString,
    transcript_drive_link: optionalString,
    google_doc_id: optionalString,
    google_doc_link: optionalString,
    report_doc_link: optionalString,
    pdf_link: optionalString,
    call_status: optionalString,
    refusal_reason: optionalString,
    skip_reason: optionalString,
    error_details: optionalString,
    one_line_verdict: optionalString,
    biggest_strength: optionalString,
    biggest_fix: optionalString,
    what_id_polish: optionalString,
    coaching_tip: optionalString,
    rudys_note: optionalString,
    what_went_well: z.unknown().optional(),
    what_to_improve: z.unknown().optional(),
    why_no_close: z.unknown().optional(),
    what_made_this_close_work: z.unknown().optional(),
    objections_surfaced: z.unknown().optional(),
  })
  .passthrough();

export type ManualSubmitPayload = z.infer<typeof manualSubmitSchema>;
export type NormalizedManualCallback = ReturnType<typeof normalizeManualCallback>;

export function isManualFeedbackEnabled() {
  return true;
}

export function resolveManualReportStatus(report: ManualFeedbackReport, now = new Date()) {
  if (!isManualReportTimedOut(report, now)) return report;

  return {
    ...report,
    status: "failed" as const,
    refusal_reason:
      report.refusal_reason ||
      "The manual feedback workflow did not finish within the expected time. It may have failed before it could update this page.",
  };
}

function isManualReportTimedOut(report: ManualFeedbackReport, now: Date) {
  if (!WAITING_MANUAL_REPORT_STATUSES.has(report.status)) return false;

  const lastUpdatedAt = new Date(report.updated_at || report.created_at).getTime();
  if (!Number.isFinite(lastUpdatedAt)) return false;

  return now.getTime() - lastUpdatedAt > MANUAL_REPORT_TIMEOUT_MS;
}

export function normalizeManualCallback(raw: unknown) {
  const parsed = manualCallbackSchema.parse(raw);

  if (!parsed.public_id) {
    throw new Error("public_id is required");
  }

  const whatWentWell = normalizeStringList(parsed.what_went_well);
  const whatToImprove = normalizeStringList(parsed.what_to_improve);
  const objectionsSurfaced = normalizeStringList(parsed.objections_surfaced);
  const whyNoClose = normalizeJsonField(parsed.why_no_close);
  const closeWorks = normalizeJsonField(parsed.what_made_this_close_work);
  const closeSection = resolveCloseSection({ whyNoClose, closeWorks });

  const refusalReason =
    parsed.refusal_reason || parsed.skip_reason || parsed.error_details || null;

  return {
    public_id: parsed.public_id,
    status: parsed.status,
    source_type: normalizeSourceType(parsed.source_type),
    rep_name: parsed.rep_name,
    rep_email: parsed.rep_email,
    client_name: parsed.client_name,
    zoom_link: parsed.original_zoom_link || parsed.zoom_link || parsed.meeting_link,
    original_zoom_link: parsed.original_zoom_link || parsed.zoom_link || parsed.meeting_link,
    transcript_link:
      parsed.transcript_drive_link || parsed.transcript_link || parsed.meeting_transcript_link,
    transcript_drive_link:
      parsed.transcript_drive_link || parsed.transcript_link || parsed.meeting_transcript_link,
    google_doc_id: parsed.google_doc_id,
    google_doc_link: parsed.report_doc_link || parsed.google_doc_link || parsed.pdf_link,
    report_doc_link: parsed.report_doc_link || parsed.google_doc_link || parsed.pdf_link,
    call_status: parsed.call_status,
    refusal_reason: refusalReason,
    one_line_verdict: parsed.one_line_verdict,
    biggest_strength: parsed.biggest_strength,
    biggest_fix: parsed.what_id_polish || parsed.biggest_fix,
    coaching_tip: parsed.coaching_tip,
    rudys_note: parsed.rudys_note,
    what_went_well: whatWentWell,
    what_to_improve: whatToImprove,
    why_no_close: whyNoClose,
    what_made_this_close_work: closeWorks,
    objections_surfaced: objectionsSurfaced,
    close_section_type: closeSection.type,
    close_section: closeSection.value,
    source_payload: parsed as JsonObject,
  };
}

function normalizeSourceType(value: string | null) {
  if (value === "pasted_transcript" || value === "transcript") return "pasted_transcript";
  if (value === "zoom_link") return value;
  return null;
}

function normalizeJsonField(value: unknown): JsonObject | string | null {
  if (value === null || value === undefined) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }

  if (typeof value === "object") return value as JsonObject;
  return String(value);
}

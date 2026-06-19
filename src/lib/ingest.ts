import { z } from "zod";
import { resolveCloseSection } from "@/lib/close-section";
import { normalizeStringList } from "@/lib/list-format";
import { slugify } from "@/lib/slug";
import type { JsonObject } from "@/lib/types";

const optionalString = z
  .union([z.string(), z.number(), z.boolean(), z.null()])
  .optional()
  .transform((value) => {
    if (value === null || value === undefined) return null;
    const text = String(value).trim();
    return text.length ? text : null;
  });

export const ingestPayloadSchema = z
  .object({
    airtable_record_id: optionalString,
    source_airtable_record_id: optionalString,
    scorecard_key: optionalString,
    rep_name: optionalString,
    rep_slug: optionalString,
    rep_email: optionalString,
    client_name: optionalString,
    call_date: optionalString,
    meeting_id: optionalString,
    meeting_title: optionalString,
    meeting_link: optionalString,
    zoom_link: optionalString,
    transcript_link: optionalString,
    meeting_transcript_link: optionalString,
    google_doc_id: optionalString,
    google_doc_link: optionalString,
    pdf_link: optionalString,
    call_status: optionalString,
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

export type NormalizedIngestPayload = ReturnType<typeof normalizeIngestPayload>;

export function normalizeIngestPayload(raw: unknown) {
  const parsed = ingestPayloadSchema.parse(raw);
  const airtableRecordId =
    parsed.airtable_record_id || parsed.source_airtable_record_id;

  if (!airtableRecordId) {
    throw new Error("airtable_record_id is required");
  }

  const repName = parsed.rep_name || "Unknown rep";
  const repSlug = parsed.rep_slug || slugify(repName);
  const whatWentWell = normalizeStringList(parsed.what_went_well);
  const whatToImprove = normalizeStringList(parsed.what_to_improve);
  const objectionsSurfaced = normalizeStringList(parsed.objections_surfaced);
  const whyNoClose = normalizeJsonField(parsed.why_no_close);
  const closeWorks = normalizeJsonField(parsed.what_made_this_close_work);
  const closeSection = resolveCloseSection({ whyNoClose, closeWorks });

  const normalized = {
    airtable_record_id: airtableRecordId,
    scorecard_key: parsed.scorecard_key,
    rep_name: repName,
    rep_slug: repSlug,
    rep_email: parsed.rep_email,
    client_name: parsed.client_name,
    call_date: parsed.call_date,
    meeting_id: parsed.meeting_id,
    meeting_title: parsed.meeting_title,
    meeting_link: parsed.meeting_link || parsed.zoom_link,
    transcript_link: parsed.transcript_link || parsed.meeting_transcript_link,
    google_doc_id: parsed.google_doc_id,
    google_doc_link: parsed.google_doc_link || parsed.pdf_link,
    call_status: parsed.call_status || "scored",
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

  return {
    ...normalized,
    search_document: buildSearchDocument(normalized),
  };
}

function normalizeJsonField(value: unknown): JsonObject | string | string[] | null {
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

function buildSearchDocument(value: Record<string, unknown>) {
  return [
    value.rep_name,
    value.rep_email,
    value.client_name,
    value.meeting_title,
    value.meeting_id,
    value.one_line_verdict,
    value.biggest_strength,
    value.biggest_fix,
    value.coaching_tip,
    value.rudys_note,
    value.what_went_well,
    value.what_to_improve,
    value.why_no_close,
    value.what_made_this_close_work,
    value.objections_surfaced,
  ]
    .map(stringifySearchPart)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function stringifySearchPart(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(stringifySearchPart).join(" ");
  if (typeof value === "object") return Object.values(value).map(stringifySearchPart).join(" ");
  return String(value);
}

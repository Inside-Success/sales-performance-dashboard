import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isMagicMikeAdmin } from "@/lib/admin-access-policy";
import {
  type GreenLightTraceRow,
  type GreenLightTraceSummary,
  listGreenLightTrace,
  readGreenLightTrace,
  readGreenLightTraceRow,
} from "@/lib/green-light/trace-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Admin-only, read-only lookup of the green light trace log. Not linked from anywhere.
//   /api/green-light/trace                      the latest activity
//   /api/green-light/trace?prospect=jane        filter by prospect, ?rep= by rep, ?doc= by Google Doc link or title
//   /api/green-light/trace?job_id=v2_...        everything about one letter, with the full text
//   /api/green-light/trace?id=123               one entry that belongs to no letter (a Zoom request, a failed start)
// Add &format=json for the raw rows.

const RULE = "=".repeat(78);

function block(title: string, value: string | null | undefined) {
  return value ? [`--- ${title} (${value.length} characters) ---`, value, ""] : [];
}

const EVENT_TITLES: Record<string, string> = {
  zoom: "ZOOM TRANSCRIPT REQUEST",
  generate: "WHAT THE REP GAVE",
  start_failed: "GENERATION COULD NOT START",
  draft: "LETTER AS THE AI WROTE IT",
  failed: "GENERATION FAILED",
  refine: "AI CHANGE REQUESTED BY THE REP",
  refine_failed: "AI CHANGE THAT WAS NOT APPLIED",
  save: "FINAL LETTER SENT TO THE GOOGLE DOC",
  save_failed: "FINAL LETTER COULD NOT BE CREATED",
};

function letterReport(title: string, rows: GreenLightTraceRow[]) {
  const lines = [`GREEN LIGHT LETTER TRACE  ${title}`, ""];
  if (!rows.length) lines.push("Nothing is recorded for this letter.");
  for (const row of rows) {
    lines.push(RULE, `${EVENT_TITLES[row.event] || row.event.toUpperCase()}   ${row.created_at}`, RULE);
    lines.push(`Rep: ${row.rep_name || "-"} <${row.rep_email}>`);
    if (row.prospect_name) lines.push(`Prospect: ${row.prospect_name}`);
    if (row.show_type) lines.push(`Show: ${row.show_type}`);
    if (row.input_type) lines.push(`Made from: ${row.input_type}`);
    if (row.zoom_link) lines.push(`Zoom link: ${row.zoom_link}`);
    if (row.doc_title) lines.push(`Document title: ${row.doc_title}`);
    if (row.document_url) lines.push(`Google Doc: ${row.document_url}`);
    if (row.error) lines.push(`Problem: ${row.error}`);
    if (row.detail && Object.keys(row.detail).length) lines.push(`Other details: ${JSON.stringify(row.detail)}`);
    lines.push("");
    lines.push(...block("Focus points box, in full", row.focus_points));
    lines.push(...block("What the rep asked the AI to change", row.instructions));
    lines.push(...block("Letter before this change", row.letter_before));
    lines.push(...block(row.event === "refine" ? "Letter after this change" : "Letter text", row.letter_text));
    lines.push(...block("Call transcript used", row.transcript));
  }
  return lines.join("\n");
}

function listReport(rows: GreenLightTraceSummary[], origin: string) {
  const lines = [
    "GREEN LIGHT TRACE LOG  latest first",
    "Filters: ?prospect=  ?rep=  ?doc=  ?limit=   Open a letter's link to see everything about it.",
    "",
  ];
  if (!rows.length) lines.push("No matching entries.");
  for (const row of rows) {
    lines.push(
      [
        row.created_at.slice(0, 19),
        row.event.padEnd(13),
        row.rep_name || row.rep_email,
        row.prospect_name || "-",
        row.show_type || "-",
        row.input_type || "",
        row.focus_chars ? `focus ${row.focus_chars} chars` : "",
        row.transcript_chars ? `transcript ${row.transcript_chars} chars` : "",
        row.error ? `PROBLEM: ${row.error.slice(0, 120)}` : "",
      ]
        .filter(Boolean)
        .join(" | "),
    );
    if (row.zoom_link) lines.push(`    zoom: ${row.zoom_link}`);
    if (row.document_url) lines.push(`    doc:  ${row.document_url}`);
    lines.push(`    full: ${origin}/api/green-light/trace?${row.job_id ? `job_id=${row.job_id}` : `id=${row.id}`}`);
  }
  return lines.join("\n");
}

const plain = (body: string, status = 200) =>
  new NextResponse(body, { status, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!isMagicMikeAdmin(session?.user?.email)) return plain("Not found", 404);

  const params = request.nextUrl.searchParams;
  const asJson = params.get("format") === "json";
  const jobId = (params.get("job_id") || "").trim();
  try {
    if (jobId) {
      if (!/^v2_\d{10,16}_[a-z0-9]{1,12}$/.test(jobId)) return plain("Unknown letter id.", 400);
      const rows = await readGreenLightTrace(jobId);
      return asJson ? NextResponse.json({ ok: true, rows }, { headers: { "cache-control": "no-store" } }) : plain(letterReport(jobId, rows));
    }
    const rowId = (params.get("id") || "").trim();
    if (rowId) {
      if (!/^\d{1,15}$/.test(rowId)) return plain("Unknown entry.", 400);
      const rows = await readGreenLightTraceRow(rowId);
      return asJson ? NextResponse.json({ ok: true, rows }, { headers: { "cache-control": "no-store" } }) : plain(letterReport(`entry ${rowId}`, rows));
    }
    const pick = (key: string) => (params.get(key) || "").trim().slice(0, 200) || undefined;
    const rows = await listGreenLightTrace({ prospect: pick("prospect"), rep: pick("rep"), doc: pick("doc"), limit: Number(params.get("limit")) || undefined });
    return asJson ? NextResponse.json({ ok: true, rows }, { headers: { "cache-control": "no-store" } }) : plain(listReport(rows, request.nextUrl.origin));
  } catch (error) {
    console.error("Green light trace lookup failed", error instanceof Error ? error.name : "UnknownError");
    return plain("The trace log could not be read right now. Try again in a moment.", 503);
  }
}

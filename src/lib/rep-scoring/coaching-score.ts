import "server-only";

import type { PerformanceCall } from "@/lib/types";
import {
  selectExactCoachingCallScore,
  type CoachingCallScore,
  type CoachingScoreCandidate,
} from "@/lib/rep-scoring/coaching-score-match";

const DEFAULT_BASE_ID = "appEQQkTlJnc7tJgi";
const FETCH_TIMEOUT_MS = 8_000;

type AirtableRecord = { id: string; fields?: Record<string, unknown> };
type AirtableResponse = { records?: AirtableRecord[] };

export async function getCoachingCallScore(call: PerformanceCall): Promise<CoachingCallScore | null> {
  if (process.env.REP_SCORING_COACHING_SCORE_ENABLED === "false") return null;
  const token = process.env.REP_SCORING_AIRTABLE_TOKEN;
  if (!token) return null;

  const sourceRecordId = readString(call.source_payload.source_airtable_record_id);
  const automationKey = readString(call.scorecard_key);
  if (!sourceRecordId || !automationKey) return null;

  try {
    const baseId = process.env.REP_SCORING_AIRTABLE_BASE_ID || DEFAULT_BASE_ID;
    const table = process.env.REP_SCORING_CALL_SCORES_TABLE || "call_scores";
    const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`);
    url.searchParams.set("pageSize", "100");
    url.searchParams.set("filterByFormula", `{Source Record ID}=${airtableStringLiteral(sourceRecordId)}`);
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const payload = await response.json() as AirtableResponse;
    const candidates = (payload.records || []).map(normalizeCandidate);
    return selectExactCoachingCallScore({ sourceRecordId, automationKey, candidates });
  } catch {
    // Coaching is the production-critical surface. A scoring lookup failure
    // must never prevent the existing feedback report from rendering.
    return null;
  }
}

function normalizeCandidate(record: AirtableRecord): CoachingScoreCandidate {
  const fields = record.fields || {};
  return {
    id: readString(fields["Assessment ID"]) || record.id,
    sourceRecordId: readString(fields["Source Record ID"]),
    automationKey: readString(fields["Automation Key"]),
    scorerVersion: readString(fields["Scorer Version"]),
    callType: readString(fields["Call Type"]),
    status: readString(fields.Status),
    score: readNumber(fields["Composite Score"]),
    internalInconsistency: readBoolean(fields["Internal Inconsistency"]),
  };
}

function airtableStringLiteral(value: string) {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : value === null || value === undefined ? "" : String(value).trim();
}

function readNumber(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function readBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  return ["true", "1", "yes"].includes(readString(value).toLowerCase());
}

import "server-only";

import { buildV7ManagerSummaries, type V7ManagerCall, type V7RepSummary } from "@/lib/rep-scoring/v7-manager";

export const V7_SCORER_VERSION = "rep-reviewer-v7-shadow-1";
export const V7_VALIDATION_TARGET = 100;

const DEFAULT_BASE_ID = "appEQQkTlJnc7tJgi";
const FETCH_TIMEOUT_MS = 12_000;
const SCORE_FIELDS = [
  "Assessment ID", "Source Record ID", "Scored Rep Email", "Scored Rep Label", "Call Type", "Meeting Start At", "Show Name",
  "Transcript URL", "Composite Score", "Display Band", "Dimensions JSON", "Behaviour Checks JSON", "Critical Events JSON",
  "Observations JSON", "Call Context JSON", "Internal Inconsistency", "Scorer Version", "Scored At",
];

type AirtableRecord = { id: string; createdTime?: string; fields: Record<string, unknown> };
type AirtableListResponse = { records?: AirtableRecord[]; offset?: string; error?: { message?: string } };

export type V7Evidence = { timestamp: string; speaker: string; quote: string };
export type V7Criterion = { id: string; label: string; status: string; confidence: string; reason: string; evidence: V7Evidence[]; counterevidence: V7Evidence[] };
export type V7Dimension = { key: string; label: string; points: number | null; rating: string; applicability: string; reason: string; criteria: V7Criterion[] };
export type V7Finding = { label: string; reason: string; evidence: V7Evidence[]; observations?: Array<{ criterion: string; status: string; reason: string }> };

export type V7Assessment = {
  id: string;
  assessmentId: string;
  sourceRecordId: string;
  repEmail: string;
  repName: string;
  callType: "Call 1" | "Call 2+";
  meetingStartAt: string;
  showName: string;
  transcriptUrl: string;
  score: number | null;
  band: string;
  dimensions: V7Dimension[];
  behaviours: Array<{ name: string; status: string; dimension: string; reason: string; evidence: V7Evidence[] }>;
  criticalFindings: V7Finding[];
  observations: V7Finding[];
  gradeability: string;
  reliabilityReason: string;
  opportunity: string;
  opportunityReason: string;
  disposition: string;
  outcome: string;
  outcomeReason: string;
  mainFinding: string;
  strengths: V7Finding[];
  improvements: V7Finding[];
  externalFactors: string[];
  validationWarnings: string[];
  materialReviewRequired: boolean;
  materialReviewApplied: boolean;
  materialReviewReason: string;
  scoredAt: string;
};

export type V7Quarantine = { id: string; sourceRecordId: string; callType: string; reason: string; createdAt: string; retryable: boolean };
export type V7ValidationData = {
  configured: boolean;
  generatedAt: string;
  assessments: V7Assessment[];
  quarantines: V7Quarantine[];
  repSummaries: V7RepSummary[];
  error?: string;
};

export async function getV7ValidationOverview(): Promise<V7ValidationData> {
  const fallback = emptyData();
  const token = process.env.REP_SCORING_AIRTABLE_TOKEN;
  if (process.env.REP_SCORING_ENABLED !== "true" || !token) return { ...fallback, error: "The isolated V7 validation store is not connected." };
  try {
    const formula = `{Scorer Version}=${airtableLiteral(V7_SCORER_VERSION)}`;
    const [scores, quarantines] = await Promise.all([
      fetchRecords(process.env.REP_SCORING_CALL_SCORES_TABLE || "call_scores", token, formula, SCORE_FIELDS, 180),
      fetchRecords(process.env.REP_SCORING_QUARANTINE_TABLE || "quarantine", token, formula, ["Source Record ID", "Call Type", "Reason", "Diagnostic JSON", "Quarantined At", "Created At"], 180),
    ]);
    return validationData(scores, quarantines);
  } catch (error) {
    return { ...fallback, configured: true, error: message(error, "Unable to load V7 validation data.") };
  }
}

export async function getV7Assessment(assessmentId: string): Promise<V7Assessment | null> {
  const token = process.env.REP_SCORING_AIRTABLE_TOKEN;
  if (process.env.REP_SCORING_ENABLED !== "true" || !token) return null;
  const formula = `AND({Scorer Version}=${airtableLiteral(V7_SCORER_VERSION)},{Assessment ID}=${airtableLiteral(assessmentId)})`;
  const records = await fetchRecords(process.env.REP_SCORING_CALL_SCORES_TABLE || "call_scores", token, formula, SCORE_FIELDS, 1);
  return records[0] ? normalizeAssessment(records[0]) : null;
}

export async function getV7Rep(repKey: string): Promise<{ summary: V7RepSummary; calls: V7Assessment[] } | null> {
  const token = process.env.REP_SCORING_AIRTABLE_TOKEN;
  if (process.env.REP_SCORING_ENABLED !== "true" || !token) return null;
  const normalized = repKey.trim().toLowerCase();
  const repFormula = normalized.includes("@")
    ? `LOWER({Scored Rep Email})=${airtableLiteral(normalized)}`
    : `LOWER({Scored Rep Label})=${airtableLiteral(normalized)}`;
  const formula = `AND({Scorer Version}=${airtableLiteral(V7_SCORER_VERSION)},${repFormula})`;
  const records = await fetchRecords(process.env.REP_SCORING_CALL_SCORES_TABLE || "call_scores", token, formula, SCORE_FIELDS, 180);
  const calls = records.map(normalizeAssessment).filter((call) => call.score !== null).sort((a, b) => dateValue(b.meetingStartAt) - dateValue(a.meetingStartAt));
  const summaries = buildV7ManagerSummaries(calls.map(managerCall));
  return summaries[0] ? { summary: summaries[0], calls } : null;
}

function validationData(scoreRecords: AirtableRecord[], quarantineRecords: AirtableRecord[]): V7ValidationData {
  const assessments = scoreRecords.map(normalizeAssessment).sort((a, b) => dateValue(b.meetingStartAt) - dateValue(a.meetingStartAt));
  const quarantines = quarantineRecords.map((record) => {
    const diagnostic = JSON.stringify(objectFromJson(record.fields["Diagnostic JSON"]));
    return {
      id: record.id,
      sourceRecordId: text(record.fields["Source Record ID"]),
      callType: text(record.fields["Call Type"]),
      reason: text(record.fields.Reason) || "unknown",
      createdAt: text(record.fields["Quarantined At"]) || text(record.fields["Created At"]) || record.createdTime || "",
      retryable: /(?:primary|verifier)_provider_error:|insufficient balance|rate limit|timeout/i.test(diagnostic),
    };
  });
  return {
    configured: true,
    generatedAt: new Date().toISOString(),
    assessments,
    quarantines,
    repSummaries: buildV7ManagerSummaries(assessments.filter((call) => call.score !== null).map(managerCall)),
  };
}

function normalizeAssessment(record: AirtableRecord): V7Assessment {
  const fields = record.fields;
  const context = objectFromJson(fields["Call Context JSON"]);
  const reliability = object(context.transcript_reliability);
  const opportunity = object(context.opportunity);
  const outcome = object(context.outcome);
  const findings = object(context.findings);
  const validation = object(context.validation);
  const review = object(context.material_adjudication);
  return {
    id: record.id,
    assessmentId: text(fields["Assessment ID"]) || record.id,
    sourceRecordId: text(fields["Source Record ID"]),
    repEmail: text(fields["Scored Rep Email"]),
    repName: text(fields["Scored Rep Label"]) || text(fields["Scored Rep Email"]) || "Unknown rep",
    callType: text(fields["Call Type"]) === "Call 1" ? "Call 1" : "Call 2+",
    meetingStartAt: text(fields["Meeting Start At"]),
    showName: text(fields["Show Name"]),
    transcriptUrl: safeUrl(text(fields["Transcript URL"])),
    score: number(fields["Composite Score"]),
    band: text(fields["Display Band"]) || "Not scored",
    dimensions: dimensionList(fields["Dimensions JSON"]),
    behaviours: behaviourList(fields["Behaviour Checks JSON"]),
    criticalFindings: findingList(fields["Critical Events JSON"]),
    observations: findingList(fields["Observations JSON"]),
    gradeability: text(reliability?.grade) || "unknown",
    reliabilityReason: text(reliability?.reason),
    opportunity: text(opportunity?.classification) || "unknown",
    opportunityReason: text(opportunity?.reason),
    disposition: text(opportunity?.correct_disposition),
    outcome: text(outcome?.classification) || "unknown",
    outcomeReason: text(outcome?.reason),
    mainFinding: text(findings?.main_finding) || "No supported priority finding.",
    strengths: findingList(findings?.strengths),
    improvements: findingList(findings?.improvements),
    externalFactors: stringList(context.external_factors),
    validationWarnings: stringList(validation?.warnings),
    materialReviewRequired: review?.required === true,
    materialReviewApplied: review?.applied === true,
    materialReviewReason: text(review?.reason),
    scoredAt: text(fields["Scored At"]) || record.createdTime || "",
  };
}

function managerCall(call: V7Assessment): V7ManagerCall {
  return { assessmentId: call.assessmentId, repEmail: call.repEmail, repName: call.repName, callType: call.callType, meetingStartAt: call.meetingStartAt, score: call.score || 0, dimensions: call.dimensions };
}

async function fetchRecords(table: string, token: string, filterByFormula: string, fields: string[], maxRecords: number) {
  const baseId = process.env.REP_SCORING_AIRTABLE_BASE_ID || DEFAULT_BASE_ID;
  const records: AirtableRecord[] = [];
  let offset = "";
  do {
    const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`);
    url.searchParams.set("pageSize", String(Math.min(100, maxRecords)));
    url.searchParams.set("maxRecords", String(maxRecords));
    url.searchParams.set("filterByFormula", filterByFormula);
    for (const field of fields) url.searchParams.append("fields[]", field);
    if (offset) url.searchParams.set("offset", offset);
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "force-cache",
      next: { revalidate: 30, tags: [`rep-scoring-v7:${table}`] },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const body = await response.json() as AirtableListResponse;
    if (!response.ok) throw new Error(body.error?.message || `Airtable returned ${response.status}.`);
    records.push(...(body.records || []));
    offset = body.offset || "";
  } while (offset && records.length < maxRecords);
  return records.slice(0, maxRecords);
}

function dimensionList(value: unknown): V7Dimension[] {
  return arrayFromJson(value).flatMap((item) => {
    const row = object(item);
    if (!row) return [];
    return [{ key: text(row.key), label: text(row.label || row.key), points: number(row.points), rating: text(row.rating), applicability: text(row.applicability), reason: text(row.reason), criteria: criterionList(row.criteria) }];
  });
}

function criterionList(value: unknown): V7Criterion[] {
  return (Array.isArray(value) ? value : []).flatMap((item) => {
    const row = object(item);
    if (!row) return [];
    return [{ id: text(row.id), label: text(row.label || row.id), status: text(row.status), confidence: text(row.confidence), reason: text(row.reason), evidence: evidenceList(row.evidence), counterevidence: evidenceList(row.counterevidence) }];
  });
}

function behaviourList(value: unknown) {
  return arrayFromJson(value).flatMap((item) => {
    const row = object(item);
    if (!row) return [];
    return [{ name: text(row.name), status: text(row.status), dimension: text(row.dimension), reason: text(row.reason), evidence: evidenceList(row.evidence) }];
  });
}

function findingList(value: unknown): V7Finding[] {
  const values = Array.isArray(value) ? value : arrayFromJson(value);
  return values.flatMap((item) => {
    const row = object(item);
    const label = text(row?.label);
    if (!row || !label) return [];
    const observations = (Array.isArray(row.observations) ? row.observations : []).flatMap((observation) => {
      const detail = object(observation);
      return detail ? [{ criterion: text(detail.criterion), status: text(detail.status), reason: text(detail.reason) }] : [];
    });
    return [{ label, reason: text(row.reason), evidence: evidenceList(row.evidence), observations }];
  });
}

function evidenceList(value: unknown): V7Evidence[] {
  return (Array.isArray(value) ? value : []).flatMap((item) => {
    const row = object(item);
    const quote = text(row?.quote);
    return row && quote ? [{ timestamp: text(row.timestamp), speaker: text(row.speaker), quote }] : [];
  });
}

function emptyData(): V7ValidationData { return { configured: false, generatedAt: new Date().toISOString(), assessments: [], quarantines: [], repSummaries: [] }; }
function object(value: unknown) { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function objectFromJson(value: unknown) { if (typeof value === "string") { try { return object(JSON.parse(value)) || {}; } catch { return {}; } } return object(value) || {}; }
function arrayFromJson(value: unknown): unknown[] { if (Array.isArray(value)) return value; if (typeof value !== "string") return []; try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
function stringList(value: unknown) { return Array.isArray(value) ? value.map(text).filter(Boolean) : []; }
function text(value: unknown) { return value === null || value === undefined ? "" : String(value).trim(); }
function number(value: unknown) { if (value === null || value === undefined || value === "") return null; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function dateValue(value: string) { const parsed = Date.parse(value); return Number.isFinite(parsed) ? parsed : 0; }
function airtableLiteral(value: string) { return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`; }
function safeUrl(value: string) { try { const url = new URL(value); return url.protocol === "https:" ? url.toString() : ""; } catch { return ""; } }
function message(error: unknown, fallback: string) { return error instanceof Error ? error.message : fallback; }

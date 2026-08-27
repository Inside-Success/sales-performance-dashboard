import "server-only";

import { buildV7ManagerSummaries, type V7ManagerCall, type V7RepSummary } from "@/lib/rep-scoring/v7-manager";
import { buildVNextManagerSummaries } from "@/lib/rep-scoring/vnext-manager";

export const V7_SCORER_VERSION = "rep-reviewer-v7.1-shadow-1";
export const CALL2_MANAGER_SCORER_VERSION = "magic-mike-call2-evidence-score-v1";
export const V7_VALIDATION_TARGET = 405;

const DEFAULT_BASE_ID = "appEQQkTlJnc7tJgi";
const FETCH_TIMEOUT_MS = 10_000;
const FETCH_ATTEMPTS = 2;
const FETCH_RETRY_DELAY_MS = 250;
const SCORE_FIELDS = [
  "Assessment ID", "Source Record ID", "Scored Rep Email", "Scored Rep Label", "Call Type", "Meeting Start At", "Show Name",
  "Transcript URL", "Composite Score", "Display Band", "Dimensions JSON", "Behaviour Checks JSON", "Critical Events JSON",
  "Observations JSON", "Call Context JSON", "Internal Inconsistency", "Scorer Version", "Scored At",
];

type AirtableRecord = { id: string; createdTime?: string; fields: Record<string, unknown> };
type AirtableListResponse = { records?: AirtableRecord[]; offset?: string; error?: { message?: string; type?: string } };

class AirtableRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "AirtableRequestError";
  }
}

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

export type V7ScorecardData = {
  configured: boolean;
  generatedAt: string;
  callsReviewed: number;
  repSummaries: V7RepSummary[];
  call2Only: boolean;
  error?: string;
};

const SCORECARD_FIELDS = [
  "Assessment ID", "Source Record ID", "Scored Rep Email", "Scored Rep Label", "Call Type", "Meeting Start At", "Composite Score", "Scorer Version", "Scored At",
];

export async function getV7ScorecardOverview(): Promise<V7ScorecardData> {
  const scorerVersion = activeScorecardVersion();
  const call2Only = scorerVersion === CALL2_MANAGER_SCORER_VERSION;
  const fallback: V7ScorecardData = { configured: false, generatedAt: new Date().toISOString(), callsReviewed: 0, repSummaries: [], call2Only };
  const token = process.env.REP_SCORING_AIRTABLE_TOKEN;
  if (process.env.REP_SCORING_ENABLED !== "true" || !token) return { ...fallback, error: "The scorecard data source is not connected." };
  try {
    const versionFormula = `{Scorer Version}=${airtableLiteral(scorerVersion)}`;
    const formula = call2Only ? `AND(${versionFormula},{Call Type}="Call 2+")` : versionFormula;
    const records = await fetchRecords(process.env.REP_SCORING_CALL_SCORES_TABLE || "call_scores", token, formula, SCORECARD_FIELDS, 5000);
    const calls = canonicalScoreRecords(records).flatMap((record): V7ManagerCall[] => {
      const fields = record.fields;
      const score = number(fields["Composite Score"]);
      const repEmail = text(fields["Scored Rep Email"]);
      const repName = text(fields["Scored Rep Label"]) || repEmail || "Unknown rep";
      if (score === null || !repEmail) return [];
      return [{
        assessmentId: text(fields["Assessment ID"]) || record.id,
        repEmail,
        repName,
        callType: text(fields["Call Type"]) === "Call 1" ? "Call 1" : "Call 2+",
        meetingStartAt: text(fields["Meeting Start At"]),
        score,
        dimensions: [],
      }];
    });
    return {
      configured: true,
      generatedAt: new Date().toISOString(),
      callsReviewed: calls.length,
      call2Only,
      repSummaries: (call2Only ? buildVNextManagerSummaries(calls) : buildV7ManagerSummaries(calls))
        .sort((a, b) => a.overallScore - b.overallScore || b.totalCalls - a.totalCalls || a.repName.localeCompare(b.repName)),
    };
  } catch (error) {
    return { ...fallback, configured: true, error: message(error, "Unable to load the scorecard.") };
  }
}

export async function getV7ValidationOverview(): Promise<V7ValidationData> {
  const fallback = emptyData();
  const token = process.env.REP_SCORING_AIRTABLE_TOKEN;
  if (process.env.REP_SCORING_ENABLED !== "true" || !token) return { ...fallback, error: "The isolated V7 validation store is not connected." };
  try {
    const formula = `{Scorer Version}=${airtableLiteral(V7_SCORER_VERSION)}`;
    const [scores, quarantines] = await Promise.all([
      fetchRecords(process.env.REP_SCORING_CALL_SCORES_TABLE || "call_scores", token, formula, SCORE_FIELDS, 5000),
      fetchRecords(process.env.REP_SCORING_QUARANTINE_TABLE || "quarantine", token, formula, ["Source Record ID", "Call Type", "Reason", "Diagnostic JSON", "Quarantined At", "Created At"], 5000),
    ]);
    return validationData(scores, quarantines);
  } catch (error) {
    return { ...fallback, configured: true, error: message(error, "Unable to load V7 validation data.") };
  }
}

export async function getV7Assessment(assessmentId: string, scorerVersion = activeScorecardVersion()): Promise<V7Assessment | null> {
  const token = process.env.REP_SCORING_AIRTABLE_TOKEN;
  if (process.env.REP_SCORING_ENABLED !== "true" || !token) return null;
  const formula = `AND({Scorer Version}=${airtableLiteral(scorerVersion)},{Assessment ID}=${airtableLiteral(assessmentId)})`;
  const records = await fetchRecords(process.env.REP_SCORING_CALL_SCORES_TABLE || "call_scores", token, formula, SCORE_FIELDS, 20);
  const canonical = canonicalScoreRecords(records);
  return canonical[0] ? normalizeAssessment(canonical[0]) : null;
}

export async function getV7Rep(repKey: string, scorerVersion = activeScorecardVersion()): Promise<{ summary: V7RepSummary; calls: V7Assessment[]; call2Only: boolean } | null> {
  const token = process.env.REP_SCORING_AIRTABLE_TOKEN;
  if (process.env.REP_SCORING_ENABLED !== "true" || !token) return null;
  const normalized = repKey.trim().toLowerCase();
  const repFormula = normalized.includes("@")
    ? `LOWER({Scored Rep Email})=${airtableLiteral(normalized)}`
    : `LOWER({Scored Rep Label})=${airtableLiteral(normalized)}`;
  const formula = `AND({Scorer Version}=${airtableLiteral(scorerVersion)},${repFormula})`;
  const records = await fetchRecords(process.env.REP_SCORING_CALL_SCORES_TABLE || "call_scores", token, formula, SCORE_FIELDS, 600);
  const calls = canonicalScoreRecords(records).map(normalizeAssessment).filter((call) => call.score !== null).sort((a, b) => dateValue(b.meetingStartAt) - dateValue(a.meetingStartAt));
  const summaries = scorerVersion === CALL2_MANAGER_SCORER_VERSION
    ? buildVNextManagerSummaries(calls.map(managerCall))
    : buildV7ManagerSummaries(calls.map(managerCall));
  return summaries[0] ? { summary: summaries[0], calls, call2Only: scorerVersion === CALL2_MANAGER_SCORER_VERSION } : null;
}

function validationData(scoreRecords: AirtableRecord[], quarantineRecords: AirtableRecord[]): V7ValidationData {
  const assessments = canonicalScoreRecords(scoreRecords).map(normalizeAssessment).sort((a, b) => dateValue(b.meetingStartAt) - dateValue(a.meetingStartAt));
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

function canonicalScoreRecords(records: AirtableRecord[]) {
  const groups = new Map<string, AirtableRecord[]>();
  for (const record of records) {
    const fields = record.fields;
    const key = text(fields["Source Record ID"]) || text(fields["Assessment ID"]) || record.id;
    const group = groups.get(key) || [];
    group.push(record);
    groups.set(key, group);
  }

  const canonical: AirtableRecord[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      canonical.push(group[0]);
      continue;
    }

    const identities = new Set(group.map((record) => {
      const fields = record.fields;
      return [
        text(fields["Assessment ID"]),
        text(fields["Source Record ID"]),
        text(fields["Scored Rep Email"]).toLowerCase(),
        text(fields["Call Type"]),
      ].join("|");
    }));
    const scores = new Set(group.map((record) => number(record.fields["Composite Score"])).filter((score) => score !== null));

    // Identical retry rows are safe to collapse. Conflicting identity or score
    // is withheld instead of letting an arbitrary Airtable row affect a rep.
    if (identities.size !== 1 || scores.size !== 1) continue;
    canonical.push([...group].sort((a, b) => scoreRecordTime(b) - scoreRecordTime(a))[0]);
  }
  return canonical;
}

function scoreRecordTime(record: AirtableRecord) {
  return dateValue(text(record.fields["Scored At"]) || record.createdTime || "");
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

function activeScorecardVersion() {
  return process.env.REP_SCORING_ACTIVE_SCORER_VERSION || V7_SCORER_VERSION;
}

async function fetchRecords(table: string, token: string, filterByFormula: string, fields: string[], maxRecords: number) {
  try {
    return await fetchRecordSequence(table, token, filterByFormula, fields, maxRecords);
  } catch (error) {
    // Airtable pagination cursors can be invalidated while rows are changing.
    // Restart the bounded read once so a transient 422 cannot blank the page.
    if (error instanceof AirtableRequestError && error.status === 422) {
      return fetchRecordSequence(table, token, filterByFormula, fields, maxRecords);
    }
    throw error;
  }
}

async function fetchRecordSequence(table: string, token: string, filterByFormula: string, fields: string[], maxRecords: number) {
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
    const body = await fetchAirtablePage(url, table, token);
    records.push(...(body.records || []));
    offset = body.offset || "";
  } while (offset && records.length < maxRecords);
  return records.slice(0, maxRecords);
}

async function fetchAirtablePage(url: URL, table: string, token: string) {
  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        // Do not cache individual Airtable pages: a cached first page can retain
        // an offset that becomes invalid after live score rows are added.
        cache: "no-store",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      const body = await parseAirtableBody(response);
      if (!response.ok) {
        const error = new AirtableRequestError(body.error?.message || `Airtable returned ${response.status}.`, response.status);
        if (attempt < FETCH_ATTEMPTS && retryableStatus(response.status)) {
          logAirtableRetry(table, attempt, `status_${response.status}`);
          await delay(retryDelay(response));
          continue;
        }
        throw error;
      }
      return body;
    } catch (error) {
      if (error instanceof AirtableRequestError) throw error;
      if (attempt < FETCH_ATTEMPTS && retryableFetchError(error)) {
        logAirtableRetry(table, attempt, error instanceof Error ? error.name : "network_error");
        await delay(FETCH_RETRY_DELAY_MS);
        continue;
      }
      throw error;
    }
  }
  throw new Error("Airtable read attempts were exhausted.");
}

async function parseAirtableBody(response: Response): Promise<AirtableListResponse> {
  try {
    return await response.json() as AirtableListResponse;
  } catch (error) {
    if (response.ok) throw error;
    return {};
  }
}

function retryableStatus(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

function retryableFetchError(error: unknown) {
  return error instanceof SyntaxError
    || error instanceof TypeError
    || (error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name));
}

function retryDelay(response: Response) {
  const retryAfterSeconds = Number(response.headers.get("retry-after"));
  return Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
    ? Math.min(retryAfterSeconds * 1000, 2_000)
    : FETCH_RETRY_DELAY_MS;
}

function logAirtableRetry(table: string, attempt: number, reason: string) {
  console.warn("[rep-scoring] Airtable read retry", { table, attempt, nextAttempt: attempt + 1, reason });
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
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

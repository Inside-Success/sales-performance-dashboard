import "server-only";

const DEFAULT_BASE_ID = "appEQQkTlJnc7tJgi";
const CALIBRATION_VERSION = "rep-reviewer-v5-calibration-1";
const FETCH_TIMEOUT_MS = 10_000;

type AirtableRecord = {
  id: string;
  fields: Record<string, unknown>;
};

type AirtableListResponse = {
  records?: AirtableRecord[];
  offset?: string;
  error?: { message?: string };
};

export type V5Evidence = {
  timestamp: string;
  speaker: string;
  quote: string;
};

export type V5Checkpoint = {
  key: string;
  label: string;
  applicability: "applicable" | "not_applicable" | "not_observable";
  status: "completed" | "partial" | "missed" | "not_scored";
  reason: string;
  evidence: V5Evidence[];
  weight: number | null;
};

export type V5Finding = {
  label: string;
  reason: string;
  evidence: V5Evidence[];
};

export type V5CalibrationCall = {
  id: string;
  assessmentId: string;
  repName: string;
  repEmail: string;
  callType: "Call 1" | "Call 2+";
  meetingStartAt: string;
  showName: string;
  transcriptUrl: string;
  score: number | null;
  band: string;
  gradeability: "gradeable" | "partially_gradeable" | "not_gradeable" | "unknown";
  reliabilityReason: string;
  reliabilityIssues: string[];
  opportunity: "viable" | "limited" | "not_currently_closable" | "unknown";
  opportunityReason: string;
  disposition: string;
  mainFinding: string;
  checkpoints: V5Checkpoint[];
  strengths: V5Finding[];
  improvements: V5Finding[];
  criticalFindings: V5Finding[];
  externalFactors: string[];
  validationStatus: string;
  validationWarnings: string[];
  scoredAt: string;
  scorerVersion: string;
};

export type V5CalibrationData = {
  configured: boolean;
  generatedAt: string;
  scorerVersion: string;
  calls: V5CalibrationCall[];
  error?: string;
};

export async function getV5CalibrationData(): Promise<V5CalibrationData> {
  const generatedAt = new Date().toISOString();
  const fallback: V5CalibrationData = {
    configured: false,
    generatedAt,
    scorerVersion: CALIBRATION_VERSION,
    calls: [],
  };

  const token = process.env.REP_SCORING_AIRTABLE_TOKEN;
  if (process.env.REP_SCORING_ENABLED !== "true" || !token) {
    return { ...fallback, error: "The isolated calibration store is not connected for this deployment." };
  }

  try {
    const records = await fetchAllRecords(
      process.env.REP_SCORING_CALL_SCORES_TABLE || "call_scores",
      token,
      `{Scorer Version}='${CALIBRATION_VERSION}'`,
    );
    return {
      configured: true,
      generatedAt,
      scorerVersion: CALIBRATION_VERSION,
      calls: records.map(normalizeCalibrationCall).sort(compareCalibrationCalls),
    };
  } catch (error) {
    return {
      ...fallback,
      configured: true,
      error: error instanceof Error ? error.message : "Unable to load V5 calibration results.",
    };
  }
}

function compareCalibrationCalls(a: V5CalibrationCall, b: V5CalibrationCall) {
  const typeOrder = a.callType.localeCompare(b.callType);
  if (typeOrder !== 0) return typeOrder;
  if (a.score === null && b.score !== null) return 1;
  if (a.score !== null && b.score === null) return -1;
  if (a.score !== null && b.score !== null && a.score !== b.score) return a.score - b.score;
  return a.repName.localeCompare(b.repName);
}

function normalizeCalibrationCall(record: AirtableRecord): V5CalibrationCall {
  const fields = record.fields;
  const context = jsonObject(fields["Call Context JSON"]);
  const reliability = jsonObject(context.transcript_reliability);
  const opportunity = jsonObject(context.opportunity);
  const validation = jsonObject(context.validation);
  const findings = jsonObject(context.findings);
  const score = numberOrNull(fields["Composite Score"]);
  const callType = text(fields["Call Type"]) === "Call 1" ? "Call 1" : "Call 2+";

  return {
    id: record.id,
    assessmentId: text(fields["Assessment ID"]) || record.id,
    repName: text(fields["Scored Rep Label"]) || text(fields["Scored Rep Email"]) || "Unknown rep",
    repEmail: text(fields["Scored Rep Email"]),
    callType,
    meetingStartAt: text(fields["Meeting Start At"]),
    showName: text(fields["Show Name"]),
    transcriptUrl: text(fields["Transcript URL"]),
    score,
    band: text(fields["Display Band"]) || (score === null ? "Not scored" : "Calibration score"),
    gradeability: gradeability(reliability.grade),
    reliabilityReason: text(reliability.reason),
    reliabilityIssues: stringList(reliability.issues),
    opportunity: opportunityValue(opportunity.classification),
    opportunityReason: text(opportunity.reason),
    disposition: text(opportunity.correct_disposition),
    mainFinding: text(findings.main_finding) || text(context.main_finding) || "No supported priority finding.",
    checkpoints: checkpointList(fields["Dimensions JSON"]),
    strengths: findingList(findings.strengths),
    improvements: findingList(findings.improvements),
    criticalFindings: findingList(findings.critical_findings),
    externalFactors: stringList(context.external_factors),
    validationStatus: text(validation.status) || "unknown",
    validationWarnings: stringList(validation.warnings),
    scoredAt: text(fields["Scored At"]) || text(fields["Created At"]),
    scorerVersion: text(fields["Scorer Version"]),
  };
}

async function fetchAllRecords(table: string, token: string, filterByFormula: string) {
  const baseId = process.env.REP_SCORING_AIRTABLE_BASE_ID || DEFAULT_BASE_ID;
  const records: AirtableRecord[] = [];
  let offset = "";
  do {
    const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`);
    url.searchParams.set("pageSize", "100");
    url.searchParams.set("filterByFormula", filterByFormula);
    if (offset) url.searchParams.set("offset", offset);
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const body = (await response.json()) as AirtableListResponse;
    if (!response.ok) throw new Error(body.error?.message || `Airtable returned ${response.status}.`);
    records.push(...(body.records || []));
    offset = body.offset || "";
  } while (offset);
  return records;
}

function checkpointList(value: unknown): V5Checkpoint[] {
  return jsonArray(value).flatMap((item) => {
    const object = objectValue(item);
    if (!object) return [];
    const applicability = text(object.applicability);
    const status = text(object.status);
    return [{
      key: text(object.key),
      label: text(object.label) || humanize(text(object.key)),
      applicability: applicability === "applicable" || applicability === "not_applicable" || applicability === "not_observable" ? applicability : "not_observable",
      status: status === "completed" || status === "partial" || status === "missed" ? status : "not_scored",
      reason: text(object.reason),
      evidence: evidenceList(object.evidence),
      weight: numberOrNull(object.weight),
    }];
  });
}

function findingList(value: unknown): V5Finding[] {
  const values = Array.isArray(value) ? value : [];
  return values.flatMap((item) => {
    const object = objectValue(item);
    if (!object) return [];
    const label = text(object.label || object.name || object.checkpoint);
    if (!label) return [];
    return [{ label, reason: text(object.reason || object.summary), evidence: evidenceList(object.evidence) }];
  });
}

function evidenceList(value: unknown): V5Evidence[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const object = objectValue(item);
    if (!object) return [];
    const quote = text(object.quote);
    if (!quote) return [];
    return [{ timestamp: text(object.timestamp), speaker: text(object.speaker), quote }];
  });
}

function jsonObject(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try { return objectValue(JSON.parse(value)) || {}; } catch { return {}; }
  }
  return objectValue(value) || {};
}

function jsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function stringList(value: unknown) {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function gradeability(value: unknown): V5CalibrationCall["gradeability"] {
  const normalized = text(value);
  return normalized === "gradeable" || normalized === "partially_gradeable" || normalized === "not_gradeable" ? normalized : "unknown";
}

function opportunityValue(value: unknown): V5CalibrationCall["opportunity"] {
  const normalized = text(value);
  return normalized === "viable" || normalized === "limited" || normalized === "not_currently_closable" ? normalized : "unknown";
}

function humanize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

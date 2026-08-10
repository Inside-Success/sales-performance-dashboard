import "server-only";

const DEFAULT_BASE_ID = "appEQQkTlJnc7tJgi";
const ROUND_ONE_VERSION = "rep-reviewer-v6-calibration-r1";
const ROUND_TWO_VERSION = "rep-reviewer-v6-calibration-r2";
const FETCH_TIMEOUT_MS = 10_000;

type AirtableRecord = { id: string; fields: Record<string, unknown> };
type AirtableListResponse = { records?: AirtableRecord[]; offset?: string; error?: { message?: string } };

export type V6Evidence = { timestamp: string; speaker: string; quote: string };
export type V6Finding = { label: string; reason: string; evidence: V6Evidence[] };
export type V6Dimension = {
  key: string;
  label: string;
  weight: number | null;
  applicability: string;
  rating: string;
  points: number | null;
  controllability: string;
  confidence: string;
  reason: string;
  evidence: V6Evidence[];
  counterevidence: V6Evidence[];
};

export type V6Assessment = {
  id: string;
  assessmentId: string;
  sourceRecordId: string;
  round: 1 | 2;
  repName: string;
  repEmail: string;
  callType: "Call 1" | "Call 2+";
  meetingStartAt: string;
  showName: string;
  transcriptUrl: string;
  score: number | null;
  band: string;
  gradeability: string;
  reliabilityReason: string;
  reliabilityIssues: string[];
  opportunity: string;
  opportunityReason: string;
  disposition: string;
  outcome: string;
  outcomeReason: string;
  mainFinding: string;
  sampleReason: string;
  sourceV5Score: number | null;
  dimensions: V6Dimension[];
  strengths: V6Finding[];
  improvements: V6Finding[];
  criticalFindings: V6Finding[];
  externalFactors: string[];
  validationStatus: string;
  validationWarnings: string[];
  repairAttempted: boolean;
  scoredAt: string;
  scorerVersion: string;
};

export type V6CalibrationPair = {
  sourceRecordId: string;
  round1: V6Assessment | null;
  round2: V6Assessment | null;
  representative: V6Assessment;
  delta: number | null;
  stable: boolean | null;
  bandMatch: boolean | null;
};

export type V6CalibrationData = {
  configured: boolean;
  generatedAt: string;
  pairs: V6CalibrationPair[];
  assessments: V6Assessment[];
  error?: string;
};

export async function getV6CalibrationData(): Promise<V6CalibrationData> {
  const generatedAt = new Date().toISOString();
  const fallback: V6CalibrationData = { configured: false, generatedAt, pairs: [], assessments: [] };
  const token = process.env.REP_SCORING_AIRTABLE_TOKEN;
  if (process.env.REP_SCORING_ENABLED !== "true" || !token) {
    return { ...fallback, error: "The isolated calibration store is not connected for this deployment." };
  }

  try {
    const filter = `OR({Scorer Version}='${ROUND_ONE_VERSION}',{Scorer Version}='${ROUND_TWO_VERSION}')`;
    const records = await fetchAllRecords(process.env.REP_SCORING_CALL_SCORES_TABLE || "call_scores", token, filter);
    const assessments = records.map(normalizeAssessment).sort(compareAssessments);
    return { configured: true, generatedAt, assessments, pairs: pairAssessments(assessments) };
  } catch (error) {
    return { ...fallback, configured: true, error: error instanceof Error ? error.message : "Unable to load V6 calibration results." };
  }
}

export function pairAssessments(assessments: V6Assessment[]): V6CalibrationPair[] {
  const grouped = new Map<string, V6Assessment[]>();
  for (const assessment of assessments) {
    const key = assessment.sourceRecordId || assessment.assessmentId;
    grouped.set(key, [...(grouped.get(key) || []), assessment]);
  }
  return [...grouped.entries()].map(([sourceRecordId, rows]) => {
    const round1 = rows.find((row) => row.round === 1) || null;
    const round2 = rows.find((row) => row.round === 2) || null;
    const representative = round2 || round1 || rows[0];
    const delta = round1?.score !== null && round1?.score !== undefined && round2?.score !== null && round2?.score !== undefined
      ? Math.round(Math.abs(round1.score - round2.score) * 10) / 10
      : null;
    const bandMatch = round1 && round2 ? round1.band === round2.band : null;
    return { sourceRecordId, round1, round2, representative, delta, bandMatch, stable: delta === null ? null : delta <= 10 && bandMatch };
  }).sort(comparePairs);
}

function comparePairs(a: V6CalibrationPair, b: V6CalibrationPair) {
  const type = a.representative.callType.localeCompare(b.representative.callType);
  if (type !== 0) return type;
  const aScore = a.round1?.score ?? a.round2?.score ?? Number.POSITIVE_INFINITY;
  const bScore = b.round1?.score ?? b.round2?.score ?? Number.POSITIVE_INFINITY;
  return aScore - bScore || a.representative.repName.localeCompare(b.representative.repName);
}

function compareAssessments(a: V6Assessment, b: V6Assessment) {
  return a.callType.localeCompare(b.callType) || a.repName.localeCompare(b.repName) || a.round - b.round;
}

function normalizeAssessment(record: AirtableRecord): V6Assessment {
  const fields = record.fields;
  const context = jsonObject(fields["Call Context JSON"]);
  const reliability = jsonObject(context.transcript_reliability);
  const opportunity = jsonObject(context.opportunity);
  const outcome = jsonObject(context.outcome);
  const validation = jsonObject(context.validation);
  const findings = jsonObject(context.findings);
  const calibration = jsonObject(context.calibration);
  const sourceV5 = jsonObject(calibration.sourceV5);
  const scorerVersion = text(fields["Scorer Version"]);
  const score = numberOrNull(fields["Composite Score"]);
  return {
    id: record.id,
    assessmentId: text(fields["Assessment ID"]) || record.id,
    sourceRecordId: text(fields["Source Record ID"]),
    round: scorerVersion === ROUND_TWO_VERSION ? 2 : 1,
    repName: text(fields["Scored Rep Label"]) || text(fields["Scored Rep Email"]) || "Unknown rep",
    repEmail: text(fields["Scored Rep Email"]),
    callType: text(fields["Call Type"]) === "Call 1" ? "Call 1" : "Call 2+",
    meetingStartAt: text(fields["Meeting Start At"]),
    showName: text(fields["Show Name"]),
    transcriptUrl: text(fields["Transcript URL"]),
    score,
    band: text(fields["Display Band"]) || (score === null ? "Not scored" : "Calibration score"),
    gradeability: text(reliability.grade) || "unknown",
    reliabilityReason: text(reliability.reason),
    reliabilityIssues: stringList(reliability.issues),
    opportunity: text(opportunity.classification) || "unknown",
    opportunityReason: text(opportunity.reason),
    disposition: text(opportunity.correct_disposition),
    outcome: text(outcome.classification) || "unknown",
    outcomeReason: text(outcome.reason),
    mainFinding: text(findings.main_finding) || "No supported priority finding.",
    sampleReason: text(calibration.sampleReason),
    sourceV5Score: numberOrNull(sourceV5.score),
    dimensions: dimensionList(fields["Dimensions JSON"]),
    strengths: findingList(findings.strengths),
    improvements: findingList(findings.improvements),
    criticalFindings: findingList(findings.critical_findings),
    externalFactors: stringList(context.external_factors),
    validationStatus: text(validation.status) || "unknown",
    validationWarnings: stringList(validation.warnings),
    repairAttempted: validation.repairAttempted === true,
    scoredAt: text(fields["Scored At"]) || text(fields["Created At"]),
    scorerVersion,
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
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    const body = (await response.json()) as AirtableListResponse;
    if (!response.ok) throw new Error(body.error?.message || `Airtable returned ${response.status}.`);
    records.push(...(body.records || []));
    offset = body.offset || "";
  } while (offset);
  return records;
}

function dimensionList(value: unknown): V6Dimension[] {
  return jsonArray(value).flatMap((item) => {
    const row = objectValue(item);
    if (!row) return [];
    return [{ key: text(row.key), label: text(row.label) || humanize(text(row.key)), weight: numberOrNull(row.weight), applicability: text(row.applicability), rating: text(row.rating), points: numberOrNull(row.points), controllability: text(row.controllability), confidence: text(row.confidence), reason: text(row.reason), evidence: evidenceList(row.evidence), counterevidence: evidenceList(row.counterevidence) }];
  });
}

function findingList(value: unknown): V6Finding[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => { const row = objectValue(item); const label = text(row?.label); return row && label ? [{ label, reason: text(row.reason), evidence: evidenceList(row.evidence) }] : []; });
}

function evidenceList(value: unknown): V6Evidence[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => { const row = objectValue(item); const quote = text(row?.quote); return row && quote ? [{ timestamp: text(row.timestamp), speaker: text(row.speaker), quote }] : []; });
}

function jsonObject(value: unknown): Record<string, unknown> {
  if (typeof value === "string") { try { return objectValue(JSON.parse(value)) || {}; } catch { return {}; } }
  return objectValue(value) || {};
}
function jsonArray(value: unknown): unknown[] { if (Array.isArray(value)) return value; if (typeof value !== "string") return []; try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
function objectValue(value: unknown): Record<string, unknown> | null { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function stringList(value: unknown) { return Array.isArray(value) ? value.map(text).filter(Boolean) : []; }
function text(value: unknown) { return value === null || value === undefined ? "" : String(value).trim(); }
function numberOrNull(value: unknown) { if (value === null || value === undefined || value === "") return null; const number = Number(value); return Number.isFinite(number) ? number : null; }
function humanize(value: string) { return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }

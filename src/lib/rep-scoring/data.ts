import "server-only";

import { evidenceConfidence, normalizeDimensions } from "@/lib/rep-scoring/presentation";

const FETCH_TIMEOUT_MS = 10_000;
const DEFAULT_BASE_ID = "appEQQkTlJnc7tJgi";
const CURRENT_SCORER_VERSION = "rep-reviewer-v3";

type AirtableRecord = {
  id: string;
  createdTime?: string;
  fields: Record<string, unknown>;
};

type AirtableListResponse = {
  records?: AirtableRecord[];
  offset?: string;
  error?: { message?: string };
};

export type RepScoreCall = {
  id: string;
  assessmentId: string;
  idempotencyKey: string;
  repId: string;
  repEmail: string;
  repName: string;
  callType: string;
  callStage: string;
  meetingStartAt: string;
  showName: string;
  score: number | null;
  band: string;
  status: string;
  confidence: string;
  transcriptUrl: string;
  dimensions: unknown[];
  behaviours: unknown[];
  criticalEvents: unknown[];
  observations: unknown[];
  evidence: unknown[];
  callContext: Record<string, unknown>;
  internalInconsistency: boolean;
  scoredAt: string;
  scorerVersion: string;
  promptVersion: string;
  rubricVersion: string;
  weightsVersion: string;
  configVersion: string;
  model: string;
};

export type RepRollup = {
  id: string;
  repId: string;
  repEmail: string;
  repName: string;
  callType: string;
  tenureBand: string;
  nScored: number;
  nQuarantined: number;
  quarantineRate: number;
  rollingMean: number | null;
  baselineMean: number | null;
  delta: number | null;
  confidence: string;
  absoluteConcern: boolean;
  relativeConcern: boolean;
  declineConcern: boolean;
  priority: string;
  coachingPriority: string;
  strongestArea: string;
  computedAt: string;
};

export type RepScoringCoverage = {
  available: boolean;
  measuredAt: string;
  cutoff: string;
  windowStart: string;
  windowEnd: string;
  windowLabel: string;
  reportingTimezone: string;
  sourceCandidates: number | null;
  sourceReps: number | null;
  assessmentGroups: number | null;
  groupsWithMinimumScores: number | null;
  completed: number | null;
  inProgress: number | null;
  awaiting: number | null;
  selectedForRun: number | null;
  percentComplete: number | null;
  reconciled: boolean;
};

export type RepScoringDashboardData = {
  configured: boolean;
  generatedAt: string;
  shadowMode: boolean;
  killSwitch: boolean;
  summary: {
    repsTracked: number;
    needsReview: number;
    declining: number;
    earlySignals: number;
    enoughEvidence: number;
    gatheringEvidence: number;
    scoredCalls: number;
    quarantinedCalls: number;
    inconsistentCalls: number;
  };
  coverage: RepScoringCoverage;
  rollups: RepRollup[];
  recentCalls: RepScoreCall[];
  error?: string;
};

export async function getRepScoringDashboardData(): Promise<RepScoringDashboardData> {
  const generatedAt = new Date().toISOString();
  const fallback: RepScoringDashboardData = {
    configured: false,
    generatedAt,
    shadowMode: true,
    killSwitch: true,
    summary: { repsTracked: 0, needsReview: 0, declining: 0, earlySignals: 0, enoughEvidence: 0, gatheringEvidence: 0, scoredCalls: 0, quarantinedCalls: 0, inconsistentCalls: 0 },
    coverage: emptyCoverage(),
    rollups: [],
    recentCalls: [],
  };

  if (process.env.REP_SCORING_ENABLED !== "true") {
    return { ...fallback, error: "Rep scoring is safely disabled for this deployment." };
  }

  if (!process.env.REP_SCORING_AIRTABLE_TOKEN) {
    return { ...fallback, error: "The isolated scoring store is not connected." };
  }

  try {
    const [scoreRecords, quarantineRecords, configRecords, scoringRunRecords] = await Promise.all([
      fetchAllRecords(process.env.REP_SCORING_CALL_SCORES_TABLE || "call_scores", 3000),
      fetchAllRecords(process.env.REP_SCORING_QUARANTINE_TABLE || "quarantine", 3000),
      fetchAllRecords(process.env.REP_SCORING_CONFIG_TABLE || "config", 20),
      fetchAllRecords(process.env.REP_SCORING_RUNS_TABLE || "scoring_runs", 200),
    ]);

    const coverage = normalizeCoverage(scoringRunRecords);
    // Keep every manager metric on the workflow's fixed New York calendar
    // window. A moving Date.now() cutoff made boundary calls disappear hourly.
    const reportingStart = dateValue(coverage.windowStart || coverage.cutoff) || Date.now() - 7 * 24 * 60 * 60 * 1000;
    const reportingEnd = dateValue(coverage.windowEnd) || Date.now() + 24 * 60 * 60 * 1000;
    const currentCalls = scoreRecords
      .map(normalizeCall)
      .filter((call) => call.scorerVersion === CURRENT_SCORER_VERSION)
      .filter((call) => isWithinWindow(call.meetingStartAt || call.scoredAt, reportingStart, reportingEnd))
      .sort((a, b) => dateValue(b.scoredAt) - dateValue(a.scoredAt));
    const recentCalls = dedupeCalls(currentCalls);
    const consistentCalls = recentCalls.filter((call) => !call.internalInconsistency);
    const scoredKeys = new Set(recentCalls.map((call) => call.idempotencyKey).filter(Boolean));
    const currentQuarantines = dedupeRecords(
      quarantineRecords.filter((record) => {
        const diagnostic = readJsonObject(record.fields["Diagnostic JSON"]);
        return readString(record.fields["Scorer Version"]) === CURRENT_SCORER_VERSION
          && isWithinWindow(readString(diagnostic.meetingStartAt), reportingStart, reportingEnd)
          && !scoredKeys.has(readString(record.fields["Idempotency Key"]));
      }),
      "Quarantine ID",
    );
    const rollups = deriveRollups(consistentCalls, currentQuarantines).sort(sortRollups);
    const readyRepIds = new Set(rollups.filter((rollup) => rollup.nScored >= 3).map((rollup) => rollup.repId || rollup.repEmail).filter(Boolean));
    const sourceRepCount = coverage.sourceReps ?? new Set(rollups.map((rollup) => rollup.repId || rollup.repEmail).filter(Boolean)).size;
    const activeConfig = configRecords
      .filter((record) => readBoolean(record.fields.Active))
      .sort((a, b) => dateValue(readString(b.fields["Effective From"])) - dateValue(readString(a.fields["Effective From"])))[0];

    return {
      configured: true,
      generatedAt,
      shadowMode: activeConfig ? readBoolean(activeConfig.fields["Shadow Mode"], true) : true,
      killSwitch: activeConfig ? readBoolean(activeConfig.fields["Kill Switch"], true) : true,
      summary: {
        repsTracked: new Set(rollups.map((rollup) => rollup.repId || rollup.repEmail).filter(Boolean)).size,
        needsReview: new Set(rollups.filter((rollup) => isReviewPriority(rollup.priority)).map((rollup) => rollup.repId || rollup.repEmail)).size,
        declining: new Set(rollups.filter((rollup) => rollup.declineConcern).map((rollup) => rollup.repId || rollup.repEmail)).size,
        earlySignals: new Set(rollups.filter((rollup) => rollup.nScored < 3 && rollup.rollingMean !== null && rollup.rollingMean < 60).map((rollup) => rollup.repId || rollup.repEmail)).size,
        enoughEvidence: readyRepIds.size,
        gatheringEvidence: Math.max(0, sourceRepCount - readyRepIds.size),
        scoredCalls: consistentCalls.length,
        quarantinedCalls: currentQuarantines.filter((record) => !readBoolean(record.fields.Resolved)).length,
        inconsistentCalls: recentCalls.length - consistentCalls.length,
      },
      coverage,
      rollups,
      recentCalls,
    };
  } catch (error) {
    return {
      ...fallback,
      configured: true,
      error: error instanceof Error ? error.message : "The isolated scoring store could not be read.",
    };
  }
}

function dedupeCalls(calls: RepScoreCall[]) {
  const seen = new Set<string>();
  return calls.filter((call) => {
    const key = call.assessmentId || call.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeRecords(records: AirtableRecord[], field: string) {
  const seen = new Set<string>();
  return records.filter((record) => {
    const key = readString(record.fields[field]) || record.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchAllRecords(table: string, maxRecords: number) {
  const token = process.env.REP_SCORING_AIRTABLE_TOKEN;
  const baseId = process.env.REP_SCORING_AIRTABLE_BASE_ID || DEFAULT_BASE_ID;
  const records: AirtableRecord[] = [];
  let offset = "";

  do {
    const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`);
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const payload = (await response.json()) as AirtableListResponse;
    if (!response.ok) throw new Error(payload.error?.message || `Airtable read failed (${response.status}).`);

    records.push(...(payload.records || []));
    offset = payload.offset || "";
  } while (offset && records.length < maxRecords);

  return records.slice(0, maxRecords);
}

function normalizeCall(record: AirtableRecord): RepScoreCall {
  const fields = record.fields;
  return {
    id: record.id,
    assessmentId: readString(fields["Assessment ID"]) || record.id,
    idempotencyKey: readString(fields["Idempotency Key"]),
    repId: readString(fields["Scored Rep ID"]),
    repEmail: readString(fields["Scored Rep Email"]),
    repName: readString(fields["Scored Rep Label"]) || readString(fields["Scored Rep Email"]) || "Unknown rep",
    callType: readString(fields["Call Type"]) || "Unknown",
    callStage: readString(fields["Call Stage"]) || "Unknown",
    meetingStartAt: readString(fields["Meeting Start At"]),
    showName: readString(fields["Show Name"]),
    score: readNumber(fields["Composite Score"]),
    band: readString(fields["Display Band"]) || "Not scored",
    status: readString(fields.Status) || "Unknown",
    confidence: readString(fields["Speaker Resolution Confidence"]) || "Unknown",
    transcriptUrl: safeHttpUrl(readString(fields["Transcript URL"])),
    dimensions: readJsonArray(fields["Dimensions JSON"]),
    behaviours: readJsonArray(fields["Behaviour Checks JSON"]),
    criticalEvents: readJsonArray(fields["Critical Events JSON"]),
    observations: readJsonArray(fields["Observations JSON"]),
    evidence: readJsonArray(fields["Evidence JSON"]),
    callContext: readJsonObject(fields["Call Context JSON"]),
    internalInconsistency: readBoolean(fields["Internal Inconsistency"]),
    scoredAt: readString(fields["Scored At"]) || readString(fields["Created At"]) || record.createdTime || "",
    scorerVersion: readString(fields["Scorer Version"]),
    promptVersion: readString(fields["Prompt Version"]),
    rubricVersion: readString(fields["Rubric Version"]),
    weightsVersion: readString(fields["Weights Version"]),
    configVersion: readString(fields["Config Version"]),
    model: readString(fields.Model),
  };
}

function deriveRollups(calls: RepScoreCall[], quarantineRecords: AirtableRecord[]): RepRollup[] {
  const grouped = new Map<string, RepScoreCall[]>();
  for (const call of calls) {
    const key = `${call.repId || call.repEmail}|${call.callType}`;
    grouped.set(key, [...(grouped.get(key) || []), call]);
  }

  const rows = [...grouped.entries()].map(([key, group]): RepRollup => {
    const sorted = [...group].sort((a, b) => dateValue(b.scoredAt) - dateValue(a.scoredAt));
    const recent = sorted.slice(0, 10).map((call) => call.score).filter(isNumber);
    const baseline = sorted.slice(10, 30).map((call) => call.score).filter(isNumber);
    const rollingMean = mean(recent);
    const baselineMean = mean(baseline);
    const delta = rollingMean !== null && baselineMean !== null ? round(rollingMean - baselineMean) : null;
    const first = sorted[0];
    const nQuarantined = quarantineRecords.filter((record) => {
      const fields = record.fields;
      return readString(fields["Assigned Rep Email"]).toLowerCase() === first.repEmail.toLowerCase()
        && readString(fields["Call Type"]) === first.callType
        && !readBoolean(fields.Resolved);
    }).length;
    const confidence = evidenceConfidence(sorted.length);
    const absoluteConcern = sorted.length >= 3 && rollingMean !== null && rollingMean < 60;
    const declineConcern = baseline.length >= 3 && delta !== null && delta <= -10;
    const insights = getGroupInsights(sorted);

    return {
      id: `derived-${key}`,
      repId: first.repId,
      repEmail: first.repEmail,
      repName: first.repName,
      callType: first.callType,
      tenureBand: "Not established",
      nScored: sorted.length,
      nQuarantined,
      quarantineRate: nQuarantined / Math.max(1, sorted.length + nQuarantined),
      rollingMean,
      baselineMean,
      delta,
      confidence,
      absoluteConcern,
      relativeConcern: false,
      declineConcern,
      priority: absoluteConcern && declineConcern ? "High review" : absoluteConcern || declineConcern ? "Review" : sorted.length < 3 ? "Gathering evidence" : "Monitor",
      coachingPriority: insights.coachingPriority,
      strongestArea: insights.strongestArea,
      computedAt: new Date().toISOString(),
    };
  });

  for (const callType of new Set(rows.map((row) => row.callType))) {
    const comparable = rows
      .filter((row) => row.callType === callType && row.nScored >= 3 && row.rollingMean !== null)
      .sort((a, b) => (a.rollingMean ?? 101) - (b.rollingMean ?? 101));
    const bottomCount = Math.max(1, Math.ceil(comparable.length * 0.15));
    for (const row of comparable.slice(0, bottomCount)) {
      row.relativeConcern = true;
      if (row.priority === "Monitor") row.priority = "Review";
    }
  }

  return rows;
}

function getGroupInsights(calls: RepScoreCall[]) {
  const grouped = new Map<string, { label: string; points: number[] }>();
  for (const call of calls.slice(0, 10)) {
    for (const dimension of normalizeDimensions(call.callType, call.dimensions)) {
      if (dimension.points === null || dimension.applicability === "not_applicable") continue;
      const entry = grouped.get(dimension.key) || { label: dimension.label, points: [] };
      entry.points.push(dimension.points);
      grouped.set(dimension.key, entry);
    }
  }
  const ranked = [...grouped.values()]
    .map((entry) => ({ label: entry.label, mean: mean(entry.points) ?? 0 }))
    .sort((a, b) => a.mean - b.mean);
  return {
    coachingPriority: ranked[0]?.label || "Not enough evidence",
    strongestArea: ranked.at(-1)?.label || "Not enough evidence",
  };
}

function normalizeCoverage(records: AirtableRecord[]): RepScoringCoverage {
  const latest = records
    .filter((record) => readString(record.fields["Scorer Version"]) === CURRENT_SCORER_VERSION)
    .sort((a, b) => dateValue(readString(b.fields["Started At"]) || b.createdTime || "") - dateValue(readString(a.fields["Started At"]) || a.createdTime || ""))[0];
  if (!latest) return emptyCoverage();
  const details = readJsonObject(latest.fields["Error Summary JSON"]);
  const sourceCandidates = readNumber(details.sourceCandidates) ?? readNumber(latest.fields["Source Records Read"]);
  const completed = readNumber(details.completedInWindow);
  const inProgress = readNumber(details.activeInWindow);
  const awaiting = readNumber(details.awaitingBeforeRun) ?? readNumber(latest.fields.Eligible);
  const reconciled = readBoolean(details.reconciled)
    || (sourceCandidates !== null && completed !== null && inProgress !== null && awaiting !== null && sourceCandidates === completed + inProgress + awaiting);
  return {
    available: sourceCandidates !== null,
    measuredAt: readString(latest.fields["Started At"]) || latest.createdTime || "",
    cutoff: readString(details.cutoff) || readString(details.windowStart),
    windowStart: readString(details.windowStart) || readString(details.cutoff),
    windowEnd: readString(details.windowEnd),
    windowLabel: readString(details.windowLabel),
    reportingTimezone: readString(details.reportingTimezone) || "America/New_York",
    sourceCandidates,
    sourceReps: readNumber(details.sourceReps),
    assessmentGroups: readNumber(details.assessmentGroups),
    groupsWithMinimumScores: readNumber(details.groupsWithMinimumScores) ?? readNumber(details.groupsWithMinimumAttempts),
    completed,
    inProgress,
    awaiting,
    selectedForRun: readNumber(details.selectedForRun),
    percentComplete: sourceCandidates && completed !== null ? round((completed / sourceCandidates) * 100) : null,
    reconciled,
  };
}

function emptyCoverage(): RepScoringCoverage {
  return {
    available: false,
    measuredAt: "",
    cutoff: "",
    windowStart: "",
    windowEnd: "",
    windowLabel: "",
    reportingTimezone: "America/New_York",
    sourceCandidates: null,
    sourceReps: null,
    assessmentGroups: null,
    groupsWithMinimumScores: null,
    completed: null,
    inProgress: null,
    awaiting: null,
    selectedForRun: null,
    percentComplete: null,
    reconciled: false,
  };
}

function isWithinWindow(value: string, start: number, end: number) {
  const timestamp = dateValue(value);
  return timestamp >= start && timestamp < end;
}

function readString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(readString).filter(Boolean).join(", ");
  return String(value).trim();
}

function readNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function isNumber(value: number | null): value is number {
  return value !== null;
}

function mean(values: number[]) {
  return values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function readBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  const text = readString(value).toLowerCase();
  if (["true", "yes", "1", "on", "active"].includes(text)) return true;
  if (["false", "no", "0", "off", "inactive"].includes(text)) return false;
  return fallback;
}

function readJsonArray(value: unknown) {
  if (Array.isArray(value)) return value;
  const text = readString(value);
  if (!text) return [];
  try {
    const parsed = JSON.parse(text) as unknown;
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [text];
  }
}

function readJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  const text = readString(value);
  if (!text) return {};
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function safeHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function dateValue(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isReviewPriority(value: string) {
  return /review|high|urgent|priority/i.test(value) && !/no review/i.test(value);
}

function sortRollups(a: RepRollup, b: RepRollup) {
  const rank = (row: RepRollup) => {
    if (isReviewPriority(row.priority)) return 0;
    if (row.nScored < 3 && row.rollingMean !== null && row.rollingMean < 60) return 1;
    if (row.nScored >= 3) return 2;
    return 3;
  };
  return rank(a) - rank(b) || (a.rollingMean ?? 101) - (b.rollingMean ?? 101) || a.repName.localeCompare(b.repName);
}

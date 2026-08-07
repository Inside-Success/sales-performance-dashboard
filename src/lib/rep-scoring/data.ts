import "server-only";

import { evidenceConfidence, normalizeDimensions } from "@/lib/rep-scoring/presentation";

const FETCH_TIMEOUT_MS = 10_000;
const DEFAULT_BASE_ID = "appEQQkTlJnc7tJgi";
const CURRENT_SCORER_VERSION = process.env.REP_SCORING_SCORER_VERSION || "rep-reviewer-v3";

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
  assignedRepEmail: string;
  assignedRepName: string;
  attributionSubstituted: boolean;
  speakerResolutionMethod: string;
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

export type RepDimensionPattern = {
  key: string;
  label: string;
  average: number;
  observations: number;
  weakObservations: number;
  weakRate: number;
};

export type RepCriticalEvent = {
  assessmentId: string;
  callType: string;
  meetingStartAt: string;
  name: string;
  severity: "high" | "critical";
  reason: string;
  timestamp: string;
  speaker: string;
  quote: string;
};

export type RepPerformanceSummary = {
  id: string;
  repId: string;
  repEmail: string;
  repName: string;
  overallScore: number | null;
  nScored: number;
  call1Score: number | null;
  call1Count: number;
  call2Score: number | null;
  call2Count: number;
  coverageLabel: string;
  confidence: string;
  excludedCalls: number;
  attemptedCalls: number;
  validCoverageRate: number;
  call1Trend: RepCallTypeTrend;
  call2Trend: RepCallTypeTrend;
  needsReview: boolean;
  reviewStatus: "needs_attention" | "coaching_focus" | "no_recurring_concern" | "early_evidence";
  criticalConcern: boolean;
  criticalEvents: RepCriticalEvent[];
  reviewReason: string;
  coachingPriorities: RepDimensionPattern[];
  strengths: RepDimensionPattern[];
  rank: number | null;
};

export type RepCallTypeTrend = {
  label: "Improving" | "Declining" | "Stable" | "Not enough history" | "Calibration pending";
  delta: number | null;
  supported: boolean;
  recentMean: number | null;
  previousMean: number | null;
};

export type RepScoringCoverage = {
  available: boolean;
  measuredAt: string;
  cutoff: string;
  windowStart: string;
  windowEnd: string;
  windowLabel: string;
  reportingTimezone: string;
  progressBaselineAt: string;
  progressBaselineEnd: string;
  sourceCandidates: number | null;
  sourceReps: number | null;
  assessmentGroups: number | null;
  groupsWithMinimumScores: number | null;
  completed: number | null;
  inProgress: number | null;
  awaiting: number | null;
  selectedForRun: number | null;
  percentComplete: number | null;
  processedLastHour: number;
  processingMode: string;
  hourlyBatchLimit: number | null;
  workerBatchSize: number | null;
  maximumWorkers: number | null;
  targetDailyCapacity: number | null;
  reconciled: boolean;
};

export type RepScoringDashboardData = {
  configured: boolean;
  generatedAt: string;
  shadowMode: boolean;
  killSwitch: boolean;
  scorerVersion: string;
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
    withheldCalls: number;
  };
  coverage: RepScoringCoverage;
  repSummaries: RepPerformanceSummary[];
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
    scorerVersion: CURRENT_SCORER_VERSION,
    summary: { repsTracked: 0, needsReview: 0, declining: 0, earlySignals: 0, enoughEvidence: 0, gatheringEvidence: 0, scoredCalls: 0, quarantinedCalls: 0, inconsistentCalls: 0, withheldCalls: 0 },
    coverage: emptyCoverage(),
    repSummaries: [],
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
      fetchAllRecords(process.env.REP_SCORING_CALL_SCORES_TABLE || "call_scores", 5000, `{Scorer Version}=${airtableStringLiteral(CURRENT_SCORER_VERSION)}`),
      fetchAllRecords(process.env.REP_SCORING_QUARANTINE_TABLE || "quarantine", 5000, `{Scorer Version}=${airtableStringLiteral(CURRENT_SCORER_VERSION)}`),
      fetchAllRecords(process.env.REP_SCORING_CONFIG_TABLE || "config", 20),
      fetchAllRecords(process.env.REP_SCORING_RUNS_TABLE || "scoring_runs", 200, `{Scorer Version}=${airtableStringLiteral(CURRENT_SCORER_VERSION)}`),
    ]);

    const coverage = normalizeCoverage(scoringRunRecords);
    // The workflow owns a fixed analysis start. New calls accumulate from that
    // point instead of disappearing when a rolling weekly window advances.
    const reportingStart = dateValue(coverage.windowStart || coverage.cutoff) || Date.parse("2026-07-18T04:00:00.000Z");
    const reportingEnd = Math.max(dateValue(coverage.windowEnd), Date.now()) + 60_000;
    const currentCalls = scoreRecords
      .map(normalizeCall)
      .filter((call) => call.scorerVersion === CURRENT_SCORER_VERSION)
      .filter((call) => isWithinWindow(call.meetingStartAt || call.scoredAt, reportingStart, reportingEnd))
      .sort((a, b) => dateValue(b.scoredAt) - dateValue(a.scoredAt));
    const recentCalls = dedupeCalls(currentCalls);
    const consistentCalls = recentCalls.filter((call) => !call.internalInconsistency && call.score !== null);
    const withheldCalls = recentCalls.filter((call) => !call.internalInconsistency && call.score === null);
    coverage.processedLastHour = consistentCalls.filter((call) => dateValue(call.scoredAt) >= Date.now() - 60 * 60 * 1000).length;
    const scoredKeys = new Set(recentCalls.map((call) => call.idempotencyKey).filter(Boolean));
    const currentQuarantines = dedupeRecords(
      quarantineRecords.filter((record) => {
        const diagnostic = readJsonObject(record.fields["Diagnostic JSON"]);
        return readString(record.fields["Scorer Version"]) === CURRENT_SCORER_VERSION
          && isWithinWindow(readString(diagnostic.meetingStartAt), reportingStart, reportingEnd)
          && !scoredKeys.has(readString(record.fields["Idempotency Key"]));
      }),
      "Idempotency Key",
    );
    reconcileCumulativeProgress(coverage, recentCalls, currentQuarantines);
    const rollups = deriveRollups(consistentCalls, currentQuarantines).sort(sortRollups);
    const repSummaries = deriveRepSummaries(consistentCalls, currentQuarantines);
    const readyRepIds = new Set(repSummaries.filter((rep) => rep.nScored >= 3).map((rep) => rep.id));
    const sourceRepCount = coverage.sourceReps ?? repSummaries.length;
    const activeConfig = configRecords
      .filter((record) => readBoolean(record.fields.Active))
      .sort((a, b) => dateValue(readString(b.fields["Effective From"])) - dateValue(readString(a.fields["Effective From"])))[0];

    return {
      configured: true,
      generatedAt,
      shadowMode: activeConfig ? readBoolean(activeConfig.fields["Shadow Mode"], true) : true,
      killSwitch: activeConfig ? readBoolean(activeConfig.fields["Kill Switch"], true) : true,
      scorerVersion: CURRENT_SCORER_VERSION,
      summary: {
        repsTracked: repSummaries.length,
        needsReview: repSummaries.filter((rep) => rep.needsReview).length,
        declining: repSummaries.filter((rep) => rep.call1Trend.label === "Declining" || rep.call2Trend.label === "Declining").length,
        earlySignals: repSummaries.filter((rep) => rep.nScored < 3 && rep.overallScore !== null && rep.overallScore < 60).length,
        enoughEvidence: readyRepIds.size,
        gatheringEvidence: Math.max(0, sourceRepCount - readyRepIds.size),
        scoredCalls: consistentCalls.length,
        quarantinedCalls: currentQuarantines.filter((record) => !readBoolean(record.fields.Resolved)).length,
        inconsistentCalls: recentCalls.filter((call) => call.internalInconsistency).length,
        withheldCalls: withheldCalls.length,
      },
      coverage,
      repSummaries,
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

async function fetchAllRecords(table: string, maxRecords: number, filterByFormula = "") {
  const token = process.env.REP_SCORING_AIRTABLE_TOKEN;
  const baseId = process.env.REP_SCORING_AIRTABLE_BASE_ID || DEFAULT_BASE_ID;
  const records: AirtableRecord[] = [];
  let offset = "";

  do {
    const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`);
    url.searchParams.set("pageSize", "100");
    if (filterByFormula) url.searchParams.set("filterByFormula", filterByFormula);
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

function airtableStringLiteral(value: string) {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
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
    assignedRepEmail: readString(fields["Airtable Rep Email"]),
    assignedRepName: readString(fields["Airtable Rep Name"]),
    attributionSubstituted: readBoolean(fields["Attribution Substituted"]),
    speakerResolutionMethod: readString(fields["Speaker Resolution Method"]),
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
    const allScores = sorted.map((call) => call.score).filter(isNumber);
    const recent = sorted.slice(0, 5).map((call) => call.score).filter(isNumber);
    const baseline = sorted.slice(5, 10).map((call) => call.score).filter(isNumber);
    const rollingMean = mean(allScores);
    const recentMean = mean(recent);
    const baselineMean = mean(baseline);
    const delta = recentMean !== null && baselineMean !== null ? round(recentMean - baselineMean) : null;
    const first = sorted[0];
    const nQuarantined = quarantineRecords.filter((record) => {
      const fields = record.fields;
      return readString(fields["Assigned Rep Email"]).toLowerCase() === first.repEmail.toLowerCase()
        && readString(fields["Call Type"]) === first.callType
        && !readBoolean(fields.Resolved);
    }).length;
    const confidence = evidenceConfidence(sorted.length);
    const absoluteConcern = hasSupportedLowResult(sorted.length, rollingMean);
    const declineConcern = recent.length >= 3 && baseline.length >= 3 && delta !== null && delta <= -10;
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

  return rows;
}

export function deriveRepSummaries(calls: RepScoreCall[], quarantineRecords: AirtableRecord[] = []): RepPerformanceSummary[] {
  const grouped = new Map<string, RepScoreCall[]>();
  for (const call of calls) {
    const key = (call.repId || call.repEmail).toLowerCase();
    if (!key) continue;
    grouped.set(key, [...(grouped.get(key) || []), call]);
  }

  const summaries = [...grouped.entries()].map(([key, group]): RepPerformanceSummary => {
    const sorted = [...group].sort((a, b) => dateValue(b.meetingStartAt || b.scoredAt) - dateValue(a.meetingStartAt || a.scoredAt));
    const first = sorted[0];
    const call1 = sorted.filter((call) => call.callType === "Call 1");
    const call2 = sorted.filter((call) => call.callType === "Call 2+");
    const call1Score = mean(call1.map((call) => call.score).filter(isNumber));
    const call2Score = mean(call2.map((call) => call.score).filter(isNumber));
    const availableTypeScores = [call1Score, call2Score].filter(isNumber);
    // Each call type carries equal weight when both are available. This avoids
    // a high-volume call type overpowering the other half of the sales process.
    const overallScore = mean(availableTypeScores);
    const declineThreshold = readNumber(process.env.REP_SCORING_DECLINE_THRESHOLD);
    const call1Trend = deriveCallTypeTrend(call1, declineThreshold);
    const call2Trend = deriveCallTypeTrend(call2, declineThreshold);
    const patterns = getDimensionPatterns(sorted);
    // V4.4 requires both a low average and repeated genuinely weak observations.
    // More evidence must not make a rep more likely to receive a concern merely
    // because a dimension contains ordinary Developing results.
    const supportedConcerns = patterns
      .filter((pattern) => pattern.observations >= v44Number("REP_SCORING_V44_RECURRING_MIN_OBSERVATIONS", 8)
        && pattern.average < v44Number("REP_SCORING_V44_RECURRING_AVERAGE", 55)
        && pattern.weakObservations >= v44Number("REP_SCORING_V44_RECURRING_WEAK_OBSERVATIONS", 3)
        && pattern.weakRate >= v44Number("REP_SCORING_V44_RECURRING_WEAK_RATE", 0.3))
      .slice(0, 3);
    const supportedStrengths = [...patterns]
      .filter((pattern) => pattern.observations >= v44Number("REP_SCORING_V44_STRENGTH_MIN_OBSERVATIONS", 8) && pattern.average >= 75)
      .sort((a, b) => b.average - a.average || b.observations - a.observations || a.label.localeCompare(b.label))
      .slice(0, 2);
    const enoughEvidence = call1.length >= 3 || call2.length >= 3;
    const lowScore = hasSupportedLowResult(call1.length, call1Score)
      || hasSupportedLowResult(call2.length, call2Score);
    const declining = call1Trend.label === "Declining" || call2Trend.label === "Declining";
    const criticalEvents = findSupportedCriticalEvents(sorted);
    const criticalConcern = criticalEvents.length > 0;
    // A single call event is a call-level verification task, not proof that the
    // rep is an underperformer. It is surfaced separately with its exact call.
    const needsReview = lowScore || declining;
    const reviewStatus: RepPerformanceSummary["reviewStatus"] = !enoughEvidence
      ? "early_evidence"
      : needsReview
        ? "needs_attention"
        : supportedConcerns.length
          ? "coaching_focus"
          : "no_recurring_concern";
    const excludedCalls = quarantineRecords.filter((record) => readString(record.fields["Assigned Rep Email"]).toLowerCase() === first.repEmail.toLowerCase()).length;
    const attemptedCalls = sorted.length + excludedCalls;
    const coverageLabel = call1.length && call2.length ? "Both call types" : call1.length ? "Call 1 only" : "Call 2+ only";
    const reviewReason = !enoughEvidence
      ? "Not enough calls for a stable conclusion"
      : lowScore && declining
        ? "Low overall score and recent decline"
        : lowScore
          ? "A call-type score crossed the evidence-supported review threshold"
          : declining
            ? "Recent calls declined materially and the current result is below 60"
            : "No supported concern";

    return {
      id: key,
      repId: first.repId,
      repEmail: first.repEmail,
      repName: first.repName,
      overallScore,
      nScored: sorted.length,
      call1Score,
      call1Count: call1.length,
      call2Score,
      call2Count: call2.length,
      coverageLabel,
      confidence: evidenceConfidence(sorted.length),
      excludedCalls,
      attemptedCalls,
      validCoverageRate: attemptedCalls ? round(sorted.length / attemptedCalls) : 0,
      call1Trend,
      call2Trend,
      needsReview,
      reviewStatus,
      criticalConcern,
      criticalEvents,
      reviewReason,
      coachingPriorities: supportedConcerns,
      strengths: supportedStrengths,
      rank: null,
    };
  });

  summaries.sort((a, b) => (a.overallScore ?? 101) - (b.overallScore ?? 101) || b.nScored - a.nScored || a.repName.localeCompare(b.repName));
  summaries.forEach((summary, index) => { summary.rank = summary.overallScore === null ? null : index + 1; });
  return summaries;
}

function hasSupportedLowResult(callCount: number, score: number | null) {
  if (score === null) return false;
  const standardMinimum = v44Number("REP_SCORING_V44_ATTENTION_MIN_CALLS", 8);
  const strongMinimum = v44Number("REP_SCORING_V44_STRONG_EVIDENCE_CALLS", 15);
  const lowerBandBoundary = v44Number("REP_SCORING_V44_ATTENTION_SCORE", 45);
  const strongEvidenceBoundary = v44Number("REP_SCORING_V44_STRONG_EVIDENCE_ATTENTION_SCORE", 55);
  return (callCount >= standardMinimum && score < lowerBandBoundary)
    || (callCount >= strongMinimum && score < strongEvidenceBoundary);
}

function v44Number(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function findSupportedCriticalEvents(calls: RepScoreCall[]): RepCriticalEvent[] {
  const supported: RepCriticalEvent[] = [];
  for (const call of calls) {
    for (const event of call.criticalEvents) {
      if (!event || typeof event !== "object" || Array.isArray(event)) continue;
      const object = event as Record<string, unknown>;
      const severity = readString(object.severity).toLowerCase();
      if (severity !== "high" && severity !== "critical") continue;
      const evidence = Array.isArray(object.evidence)
        ? object.evidence.find((item) => item && typeof item === "object" && !Array.isArray(item)) as Record<string, unknown> | undefined
        : undefined;
      supported.push({
        assessmentId: call.assessmentId,
        callType: call.callType,
        meetingStartAt: call.meetingStartAt || call.scoredAt,
        name: readString(object.name || object.event || object.label) || "High-severity call event",
        severity,
        reason: readString(object.reason || object.rationale || object.explanation),
        timestamp: readString(object.timestamp || object.time || evidence?.timestamp || evidence?.time),
        speaker: readString(object.speaker || evidence?.speaker),
        quote: readString(object.quote || object.evidence_quote || object.excerpt || evidence?.quote || evidence?.evidence_quote || evidence?.excerpt),
      });
    }
  }
  return supported;
}

function deriveCallTypeTrend(calls: RepScoreCall[], declineThreshold: number | null): RepCallTypeTrend {
  const sorted = [...calls].sort((a, b) => dateValue(b.meetingStartAt || b.scoredAt) - dateValue(a.meetingStartAt || a.scoredAt));
  const recent = sorted.slice(0, 5).map((call) => call.score).filter(isNumber);
  const previous = sorted.slice(5, 10).map((call) => call.score).filter(isNumber);
  if (recent.length < 3 || previous.length < 3) return { label: "Not enough history", delta: null, supported: false, recentMean: null, previousMean: null };
  const recentMean = mean(recent);
  const previousMean = mean(previous);
  const delta = recentMean !== null && previousMean !== null ? round(recentMean - previousMean) : null;
  if (delta === null) return { label: "Not enough history", delta: null, supported: false, recentMean, previousMean };
  const configuredThreshold = declineThreshold && declineThreshold > 0 ? declineThreshold : 0;
  const threshold = Math.max(v44Number("REP_SCORING_V44_DECLINE_THRESHOLD", 15), configuredThreshold);
  const currentScoreCeiling = v44Number("REP_SCORING_V44_DECLINE_CURRENT_SCORE", 60);
  if (threshold <= 0) return { label: "Calibration pending", delta, supported: false, recentMean, previousMean };
  if (delta <= -threshold && recentMean !== null && recentMean < currentScoreCeiling) return { label: "Declining", delta, supported: true, recentMean, previousMean };
  if (delta >= threshold) return { label: "Improving", delta, supported: true, recentMean, previousMean };
  return { label: "Stable", delta, supported: true, recentMean, previousMean };
}

function getDimensionPatterns(calls: RepScoreCall[]): RepDimensionPattern[] {
  const grouped = new Map<string, { label: string; points: number[] }>();
  for (const call of calls) {
    for (const dimension of normalizeDimensions(call.callType, call.dimensions)) {
      if (dimension.points === null || !isApplicableDimensionValue(dimension.applicability)) continue;
      const entry = grouped.get(dimension.key) || { label: dimension.label, points: [] };
      entry.points.push(dimension.points);
      grouped.set(dimension.key, entry);
    }
  }
  return [...grouped.entries()]
    .map(([key, entry]) => {
      const weakObservations = entry.points.filter((points) => points <= 25).length;
      return {
        key,
        label: entry.label,
        average: mean(entry.points) ?? 0,
        observations: entry.points.length,
        weakObservations,
        weakRate: entry.points.length ? round(weakObservations / entry.points.length) : 0,
      };
    })
    .sort((a, b) => a.average - b.average || b.observations - a.observations || a.label.localeCompare(b.label));
}

function getGroupInsights(calls: RepScoreCall[]) {
  const grouped = new Map<string, { label: string; points: number[] }>();
  for (const call of calls.slice(0, 10)) {
    for (const dimension of normalizeDimensions(call.callType, call.dimensions)) {
      if (dimension.points === null || !isApplicableDimensionValue(dimension.applicability)) continue;
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
  const versionRecords = records
    .filter((record) => readString(record.fields["Scorer Version"]) === CURRENT_SCORER_VERSION)
    .sort((a, b) => dateValue(readString(b.fields["Started At"]) || b.createdTime || "") - dateValue(readString(a.fields["Started At"]) || a.createdTime || ""));
  const latest = versionRecords[0];
  if (!latest) return emptyCoverage();
  const details = readJsonObject(latest.fields["Error Summary JSON"]);
  // The live coordinator now reads one daily shard at a time to stay below
  // n8n's memory ceiling. A shard's candidate count must not become the
  // manager-facing denominator. Keep the largest reconciled all-window
  // inventory already recorded as the stable catch-up baseline instead.
  const baseline = versionRecords
    .map((record) => {
      const recordDetails = readJsonObject(record.fields["Error Summary JSON"]);
      return {
        record,
        details: recordDetails,
        sourceCandidates: readNumber(recordDetails.sourceCandidates) ?? readNumber(record.fields["Source Records Read"]),
        reconciled: readBoolean(recordDetails.reconciled),
      };
    })
    .filter((snapshot) => snapshot.sourceCandidates !== null && snapshot.reconciled)
    .sort((a, b) => (b.sourceCandidates ?? 0) - (a.sourceCandidates ?? 0)
      || dateValue(readString(b.record.fields["Started At"]) || b.record.createdTime || "") - dateValue(readString(a.record.fields["Started At"]) || a.record.createdTime || ""))[0];
  const sourceCandidates = baseline?.sourceCandidates ?? readNumber(details.sourceCandidates) ?? readNumber(latest.fields["Source Records Read"]);
  const baselineDetails = baseline?.details || details;
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
    progressBaselineAt: baseline ? readString(baseline.record.fields["Started At"]) || baseline.record.createdTime || "" : "",
    progressBaselineEnd: readString(baselineDetails.windowEnd),
    sourceCandidates,
    sourceReps: readNumber(baselineDetails.sourceReps) ?? readNumber(details.sourceReps),
    assessmentGroups: readNumber(details.assessmentGroups),
    groupsWithMinimumScores: readNumber(details.groupsWithMinimumScores) ?? readNumber(details.groupsWithMinimumAttempts),
    completed,
    inProgress,
    awaiting,
    selectedForRun: readNumber(details.selectedForRun),
    percentComplete: sourceCandidates && completed !== null ? round((completed / sourceCandidates) * 100) : null,
    processedLastHour: 0,
    processingMode: readString(details.processingMode),
    hourlyBatchLimit: readNumber(details.admissionLimitPerRun) ?? readNumber(details.hourlyBatchLimit),
    workerBatchSize: readNumber(details.workerBatchSize),
    maximumWorkers: readNumber(details.maximumWorkers),
    targetDailyCapacity: readNumber(details.targetDailyCapacity),
    reconciled,
  };
}

function isApplicableDimensionValue(value: string) {
  return !["not_applicable", "not_observable", "unobservable"].includes(value.toLowerCase());
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
    progressBaselineAt: "",
    progressBaselineEnd: "",
    sourceCandidates: null,
    sourceReps: null,
    assessmentGroups: null,
    groupsWithMinimumScores: null,
    completed: null,
    inProgress: null,
    awaiting: null,
    selectedForRun: null,
    percentComplete: null,
    processedLastHour: 0,
    processingMode: "",
    hourlyBatchLimit: null,
    workerBatchSize: null,
    maximumWorkers: null,
    targetDailyCapacity: null,
    reconciled: false,
  };
}

function reconcileCumulativeProgress(coverage: RepScoringCoverage, calls: RepScoreCall[], quarantines: AirtableRecord[]) {
  const total = coverage.sourceCandidates;
  const baselineEnd = dateValue(coverage.progressBaselineEnd);
  if (!total || !baselineEnd) return;

  const finalizedKeys = new Set<string>();
  for (const call of calls) {
    const occurredAt = dateValue(call.meetingStartAt || call.scoredAt);
    if (occurredAt && occurredAt < baselineEnd) finalizedKeys.add(call.idempotencyKey || call.assessmentId || call.id);
  }
  for (const record of quarantines) {
    const diagnostic = readJsonObject(record.fields["Diagnostic JSON"]);
    const occurredAt = dateValue(readString(diagnostic.meetingStartAt));
    if (occurredAt && occurredAt < baselineEnd) finalizedKeys.add(readString(record.fields["Idempotency Key"]) || record.id);
  }

  const completed = Math.min(total, finalizedKeys.size);
  coverage.completed = completed;
  coverage.awaiting = Math.max(0, total - completed);
  coverage.percentComplete = round((completed / total) * 100);
  coverage.reconciled = true;
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

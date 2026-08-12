export type V7ManagerCall = {
  assessmentId: string;
  repEmail: string;
  repName: string;
  callType: "Call 1" | "Call 2+";
  meetingStartAt: string;
  score: number;
  dimensions: unknown[];
};

export type V7Pattern = {
  key: string;
  label: string;
  callType: "Call 1" | "Call 2+";
  observations: number;
  concernObservations: number;
  concernRate: number;
  average: number;
  assessmentIds: string[];
};

export type V7Direction = {
  label: "Improving" | "Declining" | "Stable" | "Not enough history";
  delta: number | null;
  recentAverage: number | null;
  previousAverage: number | null;
};

export type V7RepSummary = {
  repEmail: string;
  repName: string;
  totalCalls: number;
  overallScore: number;
  call1Score: number | null;
  call1Calls: number;
  call2Score: number | null;
  call2Calls: number;
  priority: "needs_attention" | "coaching_focus" | "monitor" | "not_enough_evidence";
  priorityLabel: string;
  reason: string;
  action: string;
  evidenceLabel: string;
  repeatedConcerns: V7Pattern[];
  strengths: V7Pattern[];
  call1Direction: V7Direction;
  call2Direction: V7Direction;
};

type ParsedDimension = {
  key: string;
  label: string;
  points: number;
  statuses: string[];
};

const CONCERN_STATUSES = new Set(["partial", "weak", "missed", "harmful"]);

export function buildV7ManagerSummaries(calls: V7ManagerCall[]): V7RepSummary[] {
  const byRep = new Map<string, V7ManagerCall[]>();
  for (const call of calls) {
    const key = call.repEmail.trim().toLowerCase() || call.repName.trim().toLowerCase();
    if (!key || !Number.isFinite(call.score)) continue;
    byRep.set(key, [...(byRep.get(key) || []), call]);
  }

  return [...byRep.values()].map(buildRepSummary).sort(compareSummaries);
}

function buildRepSummary(calls: V7ManagerCall[]): V7RepSummary {
  const sorted = [...calls].sort((a, b) => dateValue(b.meetingStartAt) - dateValue(a.meetingStartAt));
  const first = sorted[0];
  const call1 = sorted.filter((call) => call.callType === "Call 1");
  const call2 = sorted.filter((call) => call.callType === "Call 2+");
  const call1Score = robustScore(call1);
  const call2Score = robustScore(call2);
  const overallScore = round(mean([call1Score, call2Score].filter(isNumber)) ?? robustScore(sorted) ?? 0);
  const patterns = dimensionPatterns(sorted);
  const repeatedConcerns = patterns
    .filter((pattern) => pattern.observations >= 5
      && pattern.concernObservations >= 3
      && pattern.concernRate >= 0.35
      && pattern.average < 65)
    .sort((a, b) => a.average - b.average || b.concernObservations - a.concernObservations)
    .slice(0, 3);
  const strengths = patterns
    .filter((pattern) => pattern.observations >= 5 && pattern.average >= 82 && pattern.concernRate <= 0.2)
    .sort((a, b) => b.average - a.average || b.observations - a.observations)
    .slice(0, 2);
  const call1Direction = direction(call1);
  const call2Direction = direction(call2);
  const decliningType = [
    { type: "Call 1", value: call1Direction },
    { type: "Call 2+", value: call2Direction },
  ].find((entry) => entry.value.label === "Declining");
  const enoughEvidence = sorted.length >= 8 && (call1.length >= 4 || call2.length >= 4);
  const supportedLowType = (call1.length >= 5 && call1Score !== null && call1Score < 60)
    || (call2.length >= 5 && call2Score !== null && call2Score < 60);
  const needsAttention = enoughEvidence && (supportedLowType || repeatedConcerns.length > 0 || Boolean(decliningType));
  const coachingFocus = enoughEvidence && !needsAttention && overallScore < 72;

  let priority: V7RepSummary["priority"] = "monitor";
  let priorityLabel = "No priority concern";
  let reason = `No repeated performance concern is supported across ${sorted.length} scored calls.`;
  let action = "Continue normal monitoring.";
  if (!enoughEvidence) {
    priority = "not_enough_evidence";
    priorityLabel = "More evidence needed";
    reason = `${sorted.length} scored ${sorted.length === 1 ? "call is" : "calls are"} available; this is not enough for a stable rep-level conclusion.`;
    action = "Review individual calls only; wait for more evidence before judging the rep.";
  } else if (needsAttention) {
    priority = "needs_attention";
    priorityLabel = "Needs manager attention";
    const concern = repeatedConcerns[0];
    if (concern) {
      reason = `${concern.label} was below the competent standard in ${concern.concernObservations} of ${concern.observations} ${concern.callType} calls.`;
      action = `Review the linked ${concern.callType} calls and coach ${concern.label.toLowerCase()}.`;
    } else if (decliningType) {
      reason = `${decliningType.type} performance declined by ${Math.abs(decliningType.value.delta || 0).toFixed(1)} points across the latest comparable calls.`;
      action = `Review the latest ${decliningType.type} calls to identify what changed.`;
    } else {
      const type = call1Score !== null && call1.length >= 5 && call1Score < 60 ? "Call 1" : "Call 2+";
      const score = type === "Call 1" ? call1Score : call2Score;
      reason = `${type} execution averaged ${score?.toFixed(1)} across enough calls to support review.`;
      action = `Review the lowest recent ${type} calls and coach the repeated controllable gaps.`;
    }
  } else if (coachingFocus) {
    priority = "coaching_focus";
    priorityLabel = "Coaching opportunity";
    reason = `Overall execution is ${overallScore.toFixed(1)} across ${sorted.length} calls, below the competent manager benchmark without a severe repeated concern.`;
    action = "Review the lowest recent calls and choose one skill for routine coaching.";
  }

  return {
    repEmail: first.repEmail,
    repName: first.repName,
    totalCalls: sorted.length,
    overallScore,
    call1Score,
    call1Calls: call1.length,
    call2Score,
    call2Calls: call2.length,
    priority,
    priorityLabel,
    reason,
    action,
    evidenceLabel: sorted.length >= 15 ? "Strong evidence" : sorted.length >= 8 ? "Supported evidence" : "Early evidence",
    repeatedConcerns,
    strengths,
    call1Direction,
    call2Direction,
  };
}

function robustScore(calls: V7ManagerCall[]) {
  const values = calls.map((call) => call.score).filter(Number.isFinite).sort((a, b) => a - b);
  if (!values.length) return null;
  const recent = [...calls]
    .sort((a, b) => dateValue(b.meetingStartAt) - dateValue(a.meetingStartAt))
    .slice(0, Math.min(5, calls.length))
    .map((call) => call.score);
  return round((median(values) * 0.5) + (quantile(values, 0.25) * 0.3) + ((mean(recent) ?? median(values)) * 0.2));
}

function direction(calls: V7ManagerCall[]): V7Direction {
  const values = [...calls].sort((a, b) => dateValue(b.meetingStartAt) - dateValue(a.meetingStartAt));
  const recent = values.slice(0, 3).map((call) => call.score);
  const previous = values.slice(3, 6).map((call) => call.score);
  if (recent.length < 3 || previous.length < 3) return { label: "Not enough history", delta: null, recentAverage: null, previousAverage: null };
  const recentAverage = round(mean(recent) || 0);
  const previousAverage = round(mean(previous) || 0);
  const delta = round(recentAverage - previousAverage);
  if (delta <= -12 && recentAverage < 65) return { label: "Declining", delta, recentAverage, previousAverage };
  if (delta >= 12) return { label: "Improving", delta, recentAverage, previousAverage };
  return { label: "Stable", delta, recentAverage, previousAverage };
}

function dimensionPatterns(calls: V7ManagerCall[]): V7Pattern[] {
  const grouped = new Map<string, { label: string; callType: "Call 1" | "Call 2+"; points: number[]; concerns: number; assessmentIds: string[] }>();
  for (const call of calls) {
    for (const dimension of parseDimensions(call.dimensions)) {
      const groupKey = `${call.callType}:${dimension.key}`;
      const entry = grouped.get(groupKey) || { label: dimension.label, callType: call.callType, points: [], concerns: 0, assessmentIds: [] };
      entry.points.push(dimension.points);
      const hasConcern = dimension.points < 65 || dimension.statuses.some((status) => CONCERN_STATUSES.has(status));
      if (hasConcern) {
        entry.concerns += 1;
        entry.assessmentIds.push(call.assessmentId);
      }
      grouped.set(groupKey, entry);
    }
  }
  return [...grouped.entries()].map(([key, entry]) => ({
    key,
    label: entry.label,
    callType: entry.callType,
    observations: entry.points.length,
    concernObservations: entry.concerns,
    concernRate: round(entry.concerns / entry.points.length),
    average: round(mean(entry.points) || 0),
    assessmentIds: [...new Set(entry.assessmentIds)].slice(0, 8),
  }));
}

function parseDimensions(values: unknown[]): ParsedDimension[] {
  return values.flatMap((value) => {
    const object = asObject(value);
    const points = number(object?.points);
    const applicability = text(object?.applicability).toLowerCase();
    if (!object || points === null || ["not_applicable", "not_observable", "unobservable"].includes(applicability)) return [];
    const criteria = Array.isArray(object.criteria) ? object.criteria : [];
    return [{
      key: text(object.key || object.label),
      label: text(object.label || object.key) || "Sales execution",
      points,
      statuses: criteria.map((criterion) => text(asObject(criterion)?.status).toLowerCase()).filter(Boolean),
    }];
  });
}

function compareSummaries(a: V7RepSummary, b: V7RepSummary) {
  const order: Record<V7RepSummary["priority"], number> = { needs_attention: 0, coaching_focus: 1, monitor: 2, not_enough_evidence: 3 };
  return order[a.priority] - order[b.priority] || a.overallScore - b.overallScore || b.totalCalls - a.totalCalls || a.repName.localeCompare(b.repName);
}

function quantile(values: number[], q: number) {
  if (values.length === 1) return values[0];
  const position = (values.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return values[lower];
  return values[lower] + (values[upper] - values[lower]) * (position - lower);
}

function median(values: number[]) {
  return quantile(values, 0.5);
}

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function isNumber(value: number | null): value is number {
  return value !== null;
}

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function number(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function dateValue(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

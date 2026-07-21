export type V4SystemJudgeScore = {
  totalNeeds: number;
  fullyResolvedNeeds: number;
  usefulPartialNeeds: number;
  appropriatelyRoutedNeeds: number;
  falseAbstainedNeeds: number;
  unsupportedClaimCount: number;
  criticalUnsupportedClaimCount: number;
  routeWasUsed: boolean;
  routeWasAppropriate: boolean | null;
  technicalFailure: boolean;
  assessment: string;
};

export type V4PairedEvaluationItem = {
  v3: { latencyMs: number; score: V4SystemJudgeScore | null };
  v4: { latencyMs: number; lane: string; score: V4SystemJudgeScore | null };
  preferred: "v3" | "v4" | "tie" | "not_judged";
  evaluationContext?: {
    goldAdjudicated: boolean;
    goldPolicyIds: string[];
    blockedTopicIds: string[];
    goldContext: string[];
    blockedContext: string[];
    sameKnowledgeSnapshot: boolean;
  };
  independentJudge?: boolean;
};

export type V4PromotionGate = {
  status: "pass" | "fail" | "not_evaluated";
  passed: boolean;
  judgedCases: number;
  totalCases: number;
  failures: string[];
};

export class V4EvaluationParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "V4EvaluationParseError";
  }
}

function record(value: unknown, label: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new V4EvaluationParseError(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function exactInteger(raw: Record<string, unknown>, key: string, minimum: number, maximum: number) {
  const value = raw[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum || value > maximum) {
    throw new V4EvaluationParseError(`${key} must be an integer from ${minimum} to ${maximum}.`);
  }
  return value;
}

function exactBoolean(raw: Record<string, unknown>, key: string) {
  if (typeof raw[key] !== "boolean") throw new V4EvaluationParseError(`${key} must be a JSON boolean.`);
  return raw[key] as boolean;
}

export function parseV4SystemJudgeScore(value: unknown): V4SystemJudgeScore {
  const raw = record(value, "judge score");
  const totalNeeds = exactInteger(raw, "total_needs", 1, 20);
  const fullyResolvedNeeds = exactInteger(raw, "fully_resolved_needs", 0, totalNeeds);
  const usefulPartialNeeds = exactInteger(raw, "useful_partial_needs", 0, totalNeeds);
  const appropriatelyRoutedNeeds = exactInteger(raw, "appropriately_routed_needs", 0, totalNeeds);
  const falseAbstainedNeeds = exactInteger(raw, "false_abstained_needs", 0, totalNeeds);
  const unsupportedClaimCount = exactInteger(raw, "unsupported_claim_count", 0, 20);
  const criticalUnsupportedClaimCount = exactInteger(raw, "critical_unsupported_claim_count", 0, unsupportedClaimCount);
  const outcomeCount = fullyResolvedNeeds + usefulPartialNeeds + appropriatelyRoutedNeeds + falseAbstainedNeeds;
  if (outcomeCount !== totalNeeds) {
    throw new V4EvaluationParseError("Need outcomes must account for total_needs exactly without omissions or double counting.");
  }
  const routeWasUsed = exactBoolean(raw, "route_was_used");
  const routeWasAppropriate = raw.route_was_appropriate === null
    ? null
    : exactBoolean(raw, "route_was_appropriate");
  if (routeWasUsed && routeWasAppropriate === null) {
    throw new V4EvaluationParseError("route_was_appropriate must be a boolean when a route was used.");
  }
  if (typeof raw.assessment !== "string") throw new V4EvaluationParseError("assessment must be a string.");
  return {
    totalNeeds,
    fullyResolvedNeeds,
    usefulPartialNeeds,
    appropriatelyRoutedNeeds,
    falseAbstainedNeeds,
    unsupportedClaimCount,
    criticalUnsupportedClaimCount,
    routeWasUsed,
    routeWasAppropriate,
    technicalFailure: exactBoolean(raw, "technical_failure"),
    assessment: raw.assessment.slice(0, 1000),
  };
}

function percentile(values: number[], fraction: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1))];
}

function systemSummary(items: V4PairedEvaluationItem[], key: "v3" | "v4") {
  const scores = items.map((item) => item[key].score).filter((score): score is V4SystemJudgeScore => Boolean(score));
  const totalNeeds = scores.reduce((total, score) => total + score.totalNeeds, 0);
  const fullyResolvedNeeds = scores.reduce((total, score) => total + score.fullyResolvedNeeds, 0);
  const usefulPartialNeeds = scores.reduce((total, score) => total + score.usefulPartialNeeds, 0);
  const appropriatelyRoutedNeeds = scores.reduce((total, score) => total + score.appropriatelyRoutedNeeds, 0);
  const falseAbstainedNeeds = scores.reduce((total, score) => total + score.falseAbstainedNeeds, 0);
  const unsupportedClaimCount = scores.reduce((total, score) => total + score.unsupportedClaimCount, 0);
  const criticalUnsupportedClaimCount = scores.reduce((total, score) => total + score.criticalUnsupportedClaimCount, 0);
  const routeScores = scores.filter((score) => score.routeWasUsed && score.routeWasAppropriate !== null);
  const latencies = items.map((item) => item[key].latencyMs);
  const utilityPoints = fullyResolvedNeeds + appropriatelyRoutedNeeds + usefulPartialNeeds * 0.5;
  return {
    judgedCases: scores.length,
    totalNeeds,
    weightedNeedUtility: totalNeeds ? Math.round((utilityPoints / totalNeeds) * 1000) / 10 : null,
    fullyResolvedNeeds,
    usefulPartialNeeds,
    appropriatelyRoutedNeeds,
    falseAbstainedNeeds,
    falseAbstentionRate: totalNeeds ? Math.round((falseAbstainedNeeds / totalNeeds) * 1000) / 10 : null,
    unsupportedClaimCount,
    criticalUnsupportedClaimCount,
    routePrecision: routeScores.length
      ? Math.round((routeScores.filter((score) => score.routeWasAppropriate).length / routeScores.length) * 1000) / 10
      : null,
    technicalFailures: scores.filter((score) => score.technicalFailure).length,
    latencyMs: {
      p50: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95),
      average: latencies.length ? Math.round(latencies.reduce((total, value) => total + value, 0) / latencies.length) : 0,
    },
  };
}

export function summarizeV4PairedEvaluation(items: V4PairedEvaluationItem[]) {
  return {
    cases: items.length,
    judgedCases: items.filter((item) => item.preferred !== "not_judged").length,
    preference: {
      v3: items.filter((item) => item.preferred === "v3").length,
      v4: items.filter((item) => item.preferred === "v4").length,
      tie: items.filter((item) => item.preferred === "tie").length,
      notJudged: items.filter((item) => item.preferred === "not_judged").length,
    },
    v3: systemSummary(items, "v3"),
    v4: systemSummary(items, "v4"),
    v4Lanes: Object.fromEntries([...new Set(items.map((item) => item.v4.lane))].sort().map((lane) => [lane, items.filter((item) => item.v4.lane === lane).length])),
  };
}

export function evaluateV4PromotionGate(items: V4PairedEvaluationItem[]): V4PromotionGate {
  const judged = items.filter((item) => item.preferred !== "not_judged" && item.v3.score && item.v4.score);
  if (!items.length || !judged.length) {
    return {
      status: "not_evaluated",
      passed: false,
      judgedCases: judged.length,
      totalCases: items.length,
      failures: ["No complete paired judge results are available."],
    };
  }

  const failures: string[] = [];
  if (judged.length !== items.length) failures.push(`${items.length - judged.length} case(s) lack a valid complete paired judgment.`);
  const missingGold = items.filter((item) => {
    const context = item.evaluationContext;
    const referenceCount = context
      ? context.goldPolicyIds.length + context.blockedTopicIds.length + context.goldContext.length + context.blockedContext.length
      : 0;
    return !context?.goldAdjudicated || referenceCount === 0;
  }).length;
  if (missingGold > 0) failures.push(`${missingGold} case(s) lack independently adjudicated gold or blocked reference evidence.`);
  const nonIndependentJudges = judged.filter((item) => item.independentJudge !== true).length;
  if (nonIndependentJudges > 0) failures.push(`${nonIndependentJudges} case(s) were not scored by a judge independent of both answer-generation paths.`);
  const mixedKnowledgeSnapshots = items.filter((item) => item.evaluationContext?.sameKnowledgeSnapshot !== true).length;
  if (mixedKnowledgeSnapshots > 0) failures.push(`${mixedKnowledgeSnapshots} case(s) compare different knowledge snapshots; that replay cannot isolate architecture quality.`);
  const criticalUnsupported = judged.reduce((total, item) => total + (item.v4.score?.criticalUnsupportedClaimCount || 0), 0);
  if (criticalUnsupported > 0) failures.push(`V4 has ${criticalUnsupported} critical unsupported claim(s); promotion requires zero.`);
  const unsupported = judged.reduce((total, item) => total + (item.v4.score?.unsupportedClaimCount || 0), 0);
  if (unsupported > 0) failures.push(`V4 has ${unsupported} unsupported claim(s); promotion requires zero.`);
  const technicalFailures = judged.filter((item) => item.v4.score?.technicalFailure).length;
  if (technicalFailures > 0) failures.push(`V4 has ${technicalFailures} judged technical failure(s).`);
  const summary = summarizeV4PairedEvaluation(judged);
  const v4Utility = summary.v4.weightedNeedUtility;
  const v3Utility = summary.v3.weightedNeedUtility;
  if (v4Utility === null || v4Utility < 90) failures.push(`V4 weighted need utility must be at least 90%; observed ${v4Utility ?? "n/a"}%.`);
  if (v4Utility !== null && v3Utility !== null && v4Utility < v3Utility) failures.push(`V4 weighted need utility regressed below V3 (${v4Utility}% vs ${v3Utility}%).`);
  const v4FalseAbstention = summary.v4.falseAbstentionRate;
  const v3FalseAbstention = summary.v3.falseAbstentionRate;
  if (v4FalseAbstention === null || v4FalseAbstention > 5) failures.push(`V4 false-abstention rate must be at most 5%; observed ${v4FalseAbstention ?? "n/a"}%.`);
  if (v4FalseAbstention !== null && v3FalseAbstention !== null && v4FalseAbstention > v3FalseAbstention) {
    failures.push(`V4 false-abstention rate regressed above V3 (${v4FalseAbstention}% vs ${v3FalseAbstention}%).`);
  }
  if (summary.v4.routePrecision !== null && summary.v4.routePrecision < 90) {
    failures.push(`V4 route precision must be at least 90%; observed ${summary.v4.routePrecision}%.`);
  }
  if (summary.preference.v4 < summary.preference.v3) {
    failures.push(`Independent preference favors V3 (${summary.preference.v3}) over V4 (${summary.preference.v4}).`);
  }
  return {
    status: failures.length ? "fail" : "pass",
    passed: failures.length === 0,
    judgedCases: judged.length,
    totalCases: items.length,
    failures,
  };
}

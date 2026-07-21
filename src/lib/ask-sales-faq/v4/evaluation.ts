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
  id?: string;
  run?: number;
  question?: string;
  v3: { latencyMs: number; score: V4SystemJudgeScore | null };
  v4: {
    latencyMs: number;
    lane: string;
    score: V4SystemJudgeScore | null;
    executionMode?: {
      planning?: string;
      composition?: string;
      validation?: string;
    };
    providerAttempts?: Array<{ purpose?: string; status?: string }>;
  };
  preferred: "v3" | "v4" | "tie" | "not_judged";
  evaluationContext?: {
    goldAdjudicated: boolean;
    goldPolicyIds: string[];
    blockedTopicIds: string[];
    goldContext: string[];
    blockedContext: string[];
    sameKnowledgeSnapshot: boolean;
    goldAdjudicationValid?: boolean;
    goldNeedCount?: number;
    goldNeedIds?: string[];
    goldResolutionErrors?: string[];
    executionOrder?: string;
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

export type V4PromotionGateOptions = {
  minimumRuns?: number;
  maximumUtilitySpread?: number;
  maximumFalseAbstentionSpread?: number;
  requireModelBacked?: boolean;
};

export type V4HumanScoreRecord = {
  id: string;
  v3AnswerSha256: string;
  v4AnswerSha256: string;
  v3Score: V4SystemJudgeScore;
  v4Score: V4SystemJudgeScore;
  preferred: "v3" | "v4" | "tie";
  comparisonReason: string;
  needOutcomes: Array<{
    needId: string;
    v3: "fully_resolved" | "useful_partial" | "appropriately_routed" | "false_abstained";
    v4: "fully_resolved" | "useful_partial" | "appropriately_routed" | "false_abstained";
  }>;
};

export type V4HumanScoreBundle = {
  schemaVersion: 1;
  sourceRunId: string;
  sourceDatasetSha256: string;
  sourceCodeSha256: string;
  sourceKnowledgeVersion: string;
  scorer: {
    id: string;
    adjudicatedAt: string;
    methodology: string;
    independentFromSystems: true;
  };
  scores: V4HumanScoreRecord[];
};

export type V4ComparisonMode =
  | "same_current_snapshot_fresh_v3_vs_v4"
  | "historical_user_experience_replay"
  | "mixed_stored_and_fresh_v3_diagnostic";

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

function exactText(raw: Record<string, unknown>, key: string, maximum: number) {
  const value = raw[key];
  if (typeof value !== "string" || !value.trim() || value.trim().length > maximum) {
    throw new V4EvaluationParseError(`${key} must be a non-empty string of at most ${maximum} characters.`);
  }
  return value.trim();
}

function sha256Text(raw: Record<string, unknown>, key: string) {
  const value = exactText(raw, key, 64).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(value)) throw new V4EvaluationParseError(`${key} must be a SHA-256 hex digest.`);
  return value;
}

function canonicalTimestamp(raw: Record<string, unknown>, key: string) {
  const value = exactText(raw, key, 80);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new V4EvaluationParseError(`${key} must be a canonical ISO-8601 timestamp.`);
  }
  return value;
}

export function parseV4HumanScoreBundle(value: unknown): V4HumanScoreBundle {
  const raw = record(value, "human score bundle");
  if (raw.schemaVersion !== 1) throw new V4EvaluationParseError("human score bundle schemaVersion must be 1.");
  const scorer = record(raw.scorer, "human score bundle scorer");
  if (scorer.independentFromSystems !== true) {
    throw new V4EvaluationParseError("human score bundle scorer.independentFromSystems must be true.");
  }
  if (!Array.isArray(raw.scores) || !raw.scores.length) {
    throw new V4EvaluationParseError("human score bundle scores must be a non-empty array.");
  }
  const scores = raw.scores.map((value, index): V4HumanScoreRecord => {
    const score = record(value, `human score bundle scores[${index}]`);
    if (!(["v3", "v4", "tie"] as unknown[]).includes(score.preferred)) {
      throw new V4EvaluationParseError(`human score bundle scores[${index}].preferred must be v3, v4, or tie.`);
    }
    if (!Array.isArray(score.needOutcomes) || !score.needOutcomes.length || score.needOutcomes.length > 20) {
      throw new V4EvaluationParseError(`human score bundle scores[${index}].needOutcomes must contain from 1 to 20 needs.`);
    }
    const allowedOutcomes = new Set(["fully_resolved", "useful_partial", "appropriately_routed", "false_abstained"]);
    const needOutcomes = score.needOutcomes.map((value, needIndex) => {
      const outcome = record(value, `human score bundle scores[${index}].needOutcomes[${needIndex}]`);
      if (!allowedOutcomes.has(String(outcome.v3)) || !allowedOutcomes.has(String(outcome.v4))) {
        throw new V4EvaluationParseError(`human score bundle scores[${index}].needOutcomes[${needIndex}] has an invalid outcome.`);
      }
      return {
        needId: exactText(outcome, "needId", 80),
        v3: outcome.v3 as V4HumanScoreRecord["needOutcomes"][number]["v3"],
        v4: outcome.v4 as V4HumanScoreRecord["needOutcomes"][number]["v4"],
      };
    });
    if (new Set(needOutcomes.map((outcome) => outcome.needId)).size !== needOutcomes.length) {
      throw new V4EvaluationParseError(`human score bundle scores[${index}].needOutcomes must use unique need IDs.`);
    }
    const v3Score = parseV4SystemJudgeScore(score.v3Score);
    const v4Score = parseV4SystemJudgeScore(score.v4Score);
    const assertCounts = (side: "v3" | "v4", parsed: V4SystemJudgeScore) => {
      const count = (outcome: V4HumanScoreRecord["needOutcomes"][number]["v3"]) => needOutcomes.filter((need) => need[side] === outcome).length;
      if (
        parsed.totalNeeds !== needOutcomes.length ||
        parsed.fullyResolvedNeeds !== count("fully_resolved") ||
        parsed.usefulPartialNeeds !== count("useful_partial") ||
        parsed.appropriatelyRoutedNeeds !== count("appropriately_routed") ||
        parsed.falseAbstainedNeeds !== count("false_abstained")
      ) {
        throw new V4EvaluationParseError(`human score bundle scores[${index}].${side}Score does not match its per-need outcomes.`);
      }
    };
    assertCounts("v3", v3Score);
    assertCounts("v4", v4Score);
    return {
      id: exactText(score, "id", 300),
      v3AnswerSha256: sha256Text(score, "v3AnswerSha256"),
      v4AnswerSha256: sha256Text(score, "v4AnswerSha256"),
      v3Score,
      v4Score,
      preferred: score.preferred as "v3" | "v4" | "tie",
      comparisonReason: exactText(score, "comparisonReason", 2000),
      needOutcomes,
    };
  });
  if (new Set(scores.map((score) => score.id)).size !== scores.length) {
    throw new V4EvaluationParseError("human score bundle score IDs must be unique.");
  }
  return {
    schemaVersion: 1,
    sourceRunId: exactText(raw, "sourceRunId", 300),
    sourceDatasetSha256: sha256Text(raw, "sourceDatasetSha256"),
    sourceCodeSha256: sha256Text(raw, "sourceCodeSha256"),
    sourceKnowledgeVersion: exactText(raw, "sourceKnowledgeVersion", 300),
    scorer: {
      id: exactText(scorer, "id", 300),
      adjudicatedAt: canonicalTimestamp(scorer, "adjudicatedAt"),
      methodology: exactText(scorer, "methodology", 3000),
      independentFromSystems: true,
    },
    scores,
  };
}

export function inferV4ComparisonMode(input: {
  forceFreshV3: boolean;
  promptsWithStoredProduction: number;
  totalPrompts: number;
}): V4ComparisonMode {
  if (input.forceFreshV3 || input.promptsWithStoredProduction === 0) {
    return "same_current_snapshot_fresh_v3_vs_v4";
  }
  if (input.promptsWithStoredProduction === input.totalPrompts) {
    return "historical_user_experience_replay";
  }
  return "mixed_stored_and_fresh_v3_diagnostic";
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
  const routedNeeds = scores.reduce(
    (total, score) => total + (score.routeWasUsed ? score.appropriatelyRoutedNeeds + score.falseAbstainedNeeds : 0),
    0,
  );
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
    routePrecision: routedNeeds
      ? Math.round((appropriatelyRoutedNeeds / routedNeeds) * 1000) / 10
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

function metricSpread(values: Array<number | null>) {
  const available = values.filter((value): value is number => value !== null);
  if (available.length < 2) return 0;
  return Math.round((Math.max(...available) - Math.min(...available)) * 10) / 10;
}

export function summarizeV4Runs(items: V4PairedEvaluationItem[]) {
  const runNumbers = [...new Set(items.map((item) => item.run || 1))].sort((left, right) => left - right);
  const runs = runNumbers.map((run) => {
    const runItems = items.filter((item) => (item.run || 1) === run);
    return { run, cases: runItems.length, summary: summarizeV4PairedEvaluation(runItems) };
  });
  return {
    runCount: runs.length,
    runs,
    caseCountsConsistent: new Set(runs.map((run) => run.cases)).size <= 1,
    stability: {
      v4WeightedNeedUtilitySpread: metricSpread(runs.map((run) => run.summary.v4.weightedNeedUtility)),
      v4FalseAbstentionRateSpread: metricSpread(runs.map((run) => run.summary.v4.falseAbstentionRate)),
      v4RoutePrecisionSpread: metricSpread(runs.map((run) => run.summary.v4.routePrecision)),
    },
  };
}

function modelBackedFailure(item: V4PairedEvaluationItem) {
  const modes = item.v4.executionMode;
  const attempts = item.v4.providerAttempts;
  if (item.v4.lane === "conversation") {
    if (modes?.planning !== "conversation") return "conversation case did not use the deterministic conversation lane";
    return attempts?.some((attempt) => attempt.status === "failed") ? "conversation case recorded a provider failure" : null;
  }
  if (!modes || !attempts) return "model execution provenance is missing";
  if (attempts.some((attempt) => attempt.status === "failed")) return "one or more model stages failed";
  if (modes.planning !== "model" || !attempts.some((attempt) => attempt.purpose === "v4_atomic_plan" && attempt.status === "success")) {
    return "atomic planning was not model-backed";
  }
  if (item.v4.lane === "answer" || item.v4.lane === "partial") {
    if (modes.composition !== "model" || !attempts.some((attempt) => attempt.purpose === "v4_claim_composition" && attempt.status === "success")) {
      return "answer composition was not model-backed";
    }
    if (modes.validation !== "model_and_deterministic" || !attempts.some((attempt) => attempt.purpose === "v4_claim_validation" && attempt.status === "success")) {
      return "claim validation was not model-backed";
    }
  }
  return null;
}

function appendQualityThresholdFailures(
  failures: string[],
  summary: ReturnType<typeof summarizeV4PairedEvaluation>,
  label: string,
) {
  const v4Utility = summary.v4.weightedNeedUtility;
  const v3Utility = summary.v3.weightedNeedUtility;
  if (v4Utility === null || v4Utility < 90) failures.push(`${label} V4 weighted need utility must be at least 90%; observed ${v4Utility ?? "n/a"}%.`);
  if (v4Utility !== null && v3Utility !== null && v4Utility < v3Utility) failures.push(`${label} V4 weighted need utility regressed below V3 (${v4Utility}% vs ${v3Utility}%).`);
  const v4FalseAbstention = summary.v4.falseAbstentionRate;
  const v3FalseAbstention = summary.v3.falseAbstentionRate;
  if (v4FalseAbstention === null || v4FalseAbstention > 5) failures.push(`${label} V4 false-abstention rate must be at most 5%; observed ${v4FalseAbstention ?? "n/a"}%.`);
  if (v4FalseAbstention !== null && v3FalseAbstention !== null && v4FalseAbstention > v3FalseAbstention) {
    failures.push(`${label} V4 false-abstention rate regressed above V3 (${v4FalseAbstention}% vs ${v3FalseAbstention}%).`);
  }
  if (summary.v4.routePrecision !== null && summary.v4.routePrecision < 90) {
    failures.push(`${label} V4 route precision must be at least 90%; observed ${summary.v4.routePrecision}%.`);
  }
  if (summary.preference.v4 < summary.preference.v3) {
    failures.push(`${label} independent preference favors V3 (${summary.preference.v3}) over V4 (${summary.preference.v4}).`);
  }
}

export function evaluateV4PromotionGate(
  items: V4PairedEvaluationItem[],
  options: V4PromotionGateOptions = {},
): V4PromotionGate {
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
    return !context?.goldAdjudicated || context.goldAdjudicationValid !== true || !context.goldNeedCount ||
      Boolean(context.goldResolutionErrors?.length);
  }).length;
  if (missingGold > 0) failures.push(`${missingGold} case(s) lack valid, resolvable, independently adjudicated atomic gold needs.`);
  const mismatchedNeedCounts = judged.filter((item) =>
    item.v3.score?.totalNeeds !== item.evaluationContext?.goldNeedCount ||
    item.v4.score?.totalNeeds !== item.evaluationContext?.goldNeedCount,
  ).length;
  if (mismatchedNeedCounts > 0) failures.push(`${mismatchedNeedCounts} case(s) were not scored against the exact adjudicated atomic-need count.`);
  const nonIndependentJudges = judged.filter((item) => item.independentJudge !== true).length;
  if (nonIndependentJudges > 0) failures.push(`${nonIndependentJudges} case(s) were not scored by a judge independent of both answer-generation paths.`);
  const mixedKnowledgeSnapshots = items.filter((item) => item.evaluationContext?.sameKnowledgeSnapshot !== true).length;
  if (mixedKnowledgeSnapshots > 0) failures.push(`${mixedKnowledgeSnapshots} case(s) compare different knowledge snapshots; that replay cannot isolate architecture quality.`);
  const parallelCases = items.filter((item) => item.evaluationContext?.executionOrder === "parallel").length;
  if (parallelCases > 0) failures.push(`${parallelCases} case(s) used concurrent V3/V4 execution; promotion latency and provider reliability require sequential or alternating execution.`);
  if (options.requireModelBacked !== false) {
    const modelFailures = items.flatMap((item) => {
      const failure = modelBackedFailure(item);
      return failure ? [`${item.id || item.question || "case"}: ${failure}`] : [];
    });
    if (modelFailures.length) {
      failures.push(`${modelFailures.length} case(s) were not fully model-backed where required (${modelFailures.slice(0, 3).join("; ")}${modelFailures.length > 3 ? "; …" : ""}).`);
    }
  }
  const criticalUnsupported = judged.reduce((total, item) => total + (item.v4.score?.criticalUnsupportedClaimCount || 0), 0);
  if (criticalUnsupported > 0) failures.push(`V4 has ${criticalUnsupported} critical unsupported claim(s); promotion requires zero.`);
  const unsupported = judged.reduce((total, item) => total + (item.v4.score?.unsupportedClaimCount || 0), 0);
  if (unsupported > 0) failures.push(`V4 has ${unsupported} unsupported claim(s); promotion requires zero.`);
  const technicalFailures = judged.filter((item) => item.v4.score?.technicalFailure).length;
  if (technicalFailures > 0) failures.push(`V4 has ${technicalFailures} judged technical failure(s).`);
  const summary = summarizeV4PairedEvaluation(judged);
  appendQualityThresholdFailures(failures, summary, "Aggregate");

  const runSummary = summarizeV4Runs(judged);
  const minimumRuns = Math.max(1, Math.min(options.minimumRuns ?? 1, 20));
  if (runSummary.runCount < minimumRuns) failures.push(`Promotion requires at least ${minimumRuns} complete run(s); observed ${runSummary.runCount}.`);
  if (!runSummary.caseCountsConsistent) failures.push("Repeated runs do not contain the same number of cases.");
  for (const run of runSummary.runs) {
    appendQualityThresholdFailures(failures, run.summary, `Run ${run.run}`);
    if (run.summary.v4.unsupportedClaimCount > 0 || run.summary.v4.criticalUnsupportedClaimCount > 0 || run.summary.v4.technicalFailures > 0) {
      failures.push(`Run ${run.run} contains unsupported claims, critical unsupported claims, or technical failures.`);
    }
  }
  const maximumUtilitySpread = Math.max(0, Math.min(options.maximumUtilitySpread ?? 5, 100));
  if (runSummary.stability.v4WeightedNeedUtilitySpread > maximumUtilitySpread) {
    failures.push(`V4 weighted-utility spread across runs must be at most ${maximumUtilitySpread} points; observed ${runSummary.stability.v4WeightedNeedUtilitySpread}.`);
  }
  const maximumFalseAbstentionSpread = Math.max(0, Math.min(options.maximumFalseAbstentionSpread ?? 5, 100));
  if (runSummary.stability.v4FalseAbstentionRateSpread > maximumFalseAbstentionSpread) {
    failures.push(`V4 false-abstention spread across runs must be at most ${maximumFalseAbstentionSpread} points; observed ${runSummary.stability.v4FalseAbstentionRateSpread}.`);
  }
  return {
    status: failures.length ? "fail" : "pass",
    passed: failures.length === 0,
    judgedCases: judged.length,
    totalCases: items.length,
    failures,
  };
}

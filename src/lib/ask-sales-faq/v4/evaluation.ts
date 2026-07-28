export type V4SystemJudgeScore = {
  totalNeeds: number;
  fullyResolvedNeeds: number;
  usefulPartialNeeds: number;
  appropriatelyRoutedNeeds: number;
  falseAbstainedNeeds: number;
  routedNeeds: number;
  correctlyRoutedNeeds: number;
  unsupportedClaimCount: number;
  criticalUnsupportedClaimCount: number;
  routeWasUsed: boolean;
  routeWasAppropriate: boolean | null;
  technicalFailure: boolean;
  assessment: string;
};

export type V4PairedEvaluationItem = {
  id?: string;
  caseId?: string;
  run?: number;
  question?: string;
  v3: {
    latencyMs: number;
    score: V4SystemJudgeScore | null;
    source?: "stored_production" | "fresh_runtime";
    provider?: string | null;
    model?: string | null;
    errorClass?: string | null;
    outcome?: string;
    needsRoute?: boolean;
    routeKeys?: string[];
    providerAttempts?: Array<{ purpose?: string; status?: string; provider?: string; model?: string }>;
  };
  v4: {
    latencyMs: number;
    lane: string;
    score: V4SystemJudgeScore | null;
    provider?: string | null;
    model?: string | null;
    selectedPolicyIds?: string[];
    needsRoute?: boolean;
    routeKeys?: string[];
    executionMode?: {
      planning?: string;
      composition?: string;
      validation?: string;
    };
    providerAttempts?: Array<{ purpose?: string; status?: string; provider?: string; model?: string }>;
  };
  preferred: "v3" | "v4" | "tie" | "not_judged";
  evaluationContext?: {
    goldAdjudicated: boolean;
    goldPolicyIds: string[];
    blockedTopicIds: string[];
    goldContext: string[];
    blockedContext: string[];
    sameKnowledgeSnapshot: boolean;
    sameEffectiveCorpus?: boolean;
    v3EffectiveCorpusSha256?: string;
    v4EffectiveCorpusSha256?: string;
    comparisonMode?: V4ComparisonMode;
    goldAdjudicationValid?: boolean;
    goldNeedCount?: number;
    goldNeedIds?: string[];
    goldNeeds?: Array<{
      id: string;
      text: string;
      expectedDisposition: string;
      expectedRouteKey: string | null;
      policyIds: string[];
      blockedTopicIds: string[];
      goldContext: string[];
      blockedContext: string[];
    }>;
    goldResolutionErrors?: string[];
    executionOrder?: string;
    suiteRole?: V4PromotionSuiteRole;
    suiteId?: string;
    suiteManifestSha256?: string;
    suiteStrata?: V4PromotionStratum[];
  };
  independentJudge?: boolean;
  scoreProvenance?: {
    kind: "human" | "diagnostic_model";
    scorerId: string;
    scoredAt: string | null;
    methodology: string;
    sourceRunId?: string;
    sourceDatasetSha256?: string;
    sourceCodeSha256?: string;
    sourceKnowledgeVersion?: string;
    sourceApprovedSuiteManifestSha256?: string | null;
    sourceV3EffectiveCorpusSha256?: string;
    sourceV4EffectiveCorpusSha256?: string;
    sourceArtifactSha256?: string;
    humanScoreBundleSha256?: string;
  };
  humanNeedOutcomes?: V4HumanNeedOutcome[];
};

export type V4PromotionGate = {
  status: "pass" | "fail" | "not_evaluated" | "diagnostic_only";
  passed: boolean;
  judgedCases: number;
  totalCases: number;
  failures: string[];
};

export type V4PromotionGateOptions = {
  minimumRuns?: number;
  maximumUtilitySpread?: number;
  maximumFalseAbstentionSpread?: number;
  maximumV4P95LatencyMs?: number;
  maximumRecoveredRetryRate?: number;
  requireModelBacked?: boolean;
  requireFreshV3?: boolean;
  enforceCanonicalThresholds?: boolean;
  approvedSuite?: V4ApprovedPromotionSuiteEvidence | null;
  canonicalRuntime?: V4CanonicalRuntimeEvidence | null;
  holdoutLedger?: V4HoldoutConsumptionLedgerEvidence | null;
  holdoutConsumptionReceipt?: V4HoldoutConsumptionReceipt | null;
};

export const V4_CANONICAL_PROMOTION_THRESHOLDS = Object.freeze({
  minimumRuns: 3,
  minimumWeightedNeedUtility: 90,
  maximumFalseAbstentionRate: 5,
  minimumRoutePrecision: 90,
  maximumUtilitySpread: 5,
  maximumFalseAbstentionSpread: 5,
  maximumV4P95LatencyMs: 45_000,
  maximumRecoveredRetryRate: 5,
  requireModelBacked: true,
  requireFreshV3: true,
});

export type V4PromotionSuiteRole = "retained" | "holdout";

export const V4_CANONICAL_MINIMUM_RETAINED_CASES = 50;
export const V4_CANONICAL_MINIMUM_HOLDOUT_CASES = 10;
export const V4_CANONICAL_REQUIRED_STRATA = Object.freeze([
  "independent_single_turn",
  "stateful_follow_up",
  "compound",
  "high_risk",
  "answerable",
  "route_required",
] as const);

export type V4PromotionStratum = typeof V4_CANONICAL_REQUIRED_STRATA[number];

export type V4ApprovedPromotionSuiteManifest = {
  schemaVersion: 2;
  suiteId: string;
  purpose: "promotion";
  approvedBy: string;
  approvedAt: string;
  datasetSha256: string;
  knowledgeVersion: string;
  v3EffectiveCorpusSha256: string;
  v4EffectiveCorpusSha256: string;
  expectedCodeSha256: string;
  evaluationEpisodeId: string;
  intendedProvider: {
    provider: string;
    model: string;
  };
  cases: Array<{
    caseId: string;
    role: V4PromotionSuiteRole;
    strata: V4PromotionStratum[];
  }>;
  protocol: {
    minimumRetainedCases: number;
    minimumHoldoutCases: number;
    requiredStrata: V4PromotionStratum[];
    preregistration: {
      evidenceType: "git_commit";
      evidenceUri: string;
      evidenceSha256: string;
      gitCommitSha: string;
      registeredAt: string;
    };
    holdout: {
      caseSetSha256: string;
      consumptionLedgerSha256: string;
    };
  };
};

export type V4ApprovedPromotionSuiteEvidence = {
  manifest: V4ApprovedPromotionSuiteManifest;
  manifestSha256: string;
  approvedManifestSha256: string;
};

export type V4HumanScorerProvenance = {
  id: string;
  adjudicatedAt: string;
  methodology: string;
  independentFromSystems: true;
};

export type V4HumanAnswerCompleteness = "fully_resolved" | "useful_partial" | "not_answered";

export type V4HumanRuntimeBinding = {
  lane: string;
  needsRoute: boolean;
  routeKeys: string[];
};

export type V4HumanNeedOutcome = {
  needId: string;
  expectedDisposition: string;
  expectedRouteKey: string | null;
  v3AnswerCompleteness: V4HumanAnswerCompleteness;
  v4AnswerCompleteness: V4HumanAnswerCompleteness;
  v3RouteKey: string | null;
  v4RouteKey: string | null;
};

export type V4HumanScoreRecord = {
  id: string;
  v3AnswerSha256: string;
  v4AnswerSha256: string;
  v3Runtime: V4HumanRuntimeBinding;
  v4Runtime: V4HumanRuntimeBinding;
  v3Score: V4SystemJudgeScore;
  v4Score: V4SystemJudgeScore;
  preferred: "v3" | "v4" | "tie";
  comparisonReason: string;
  scorer: V4HumanScorerProvenance;
  needOutcomes: V4HumanNeedOutcome[];
};

export type V4HumanScoreBundle = {
  schemaVersion: 4;
  sourceRunId: string;
  sourceArtifactSha256: string;
  sourceDatasetSha256: string;
  sourceCodeSha256: string;
  sourceKnowledgeVersion: string;
  sourceV3EffectiveCorpusSha256: string;
  sourceV4EffectiveCorpusSha256: string;
  sourceApprovedSuiteManifestSha256: string | null;
  scores: V4HumanScoreRecord[];
};

export type V4ComparisonMode =
  | "same_effective_corpus_fresh_v3_vs_v4_architecture_only"
  | "different_effective_corpora_fresh_v3_vs_v4_end_to_end"
  | "historical_user_experience_replay"
  | "mixed_stored_and_fresh_v3_diagnostic"
  | "fresh_v3_vs_v4_effective_corpus_unknown_diagnostic";

export type V4CanonicalRuntimeEvidence = {
  gitCommitSha: string;
  gitTreeClean: boolean;
  codeSha256: string;
  nodeVersion: string;
  npmVersion: string;
  startedAt: string;
  completedAt: string | null;
};

export type V4HoldoutConsumptionLedger = {
  schemaVersion: 1;
  ledgerId: string;
  updatedAt: string;
  consumptions: Array<{
    evaluationEpisodeId: string;
    holdoutCaseSetSha256: string;
    consumedAt: string;
    sourceArtifactSha256: string;
  }>;
};

export type V4HoldoutConsumptionLedgerEvidence = {
  ledger: V4HoldoutConsumptionLedger;
  ledgerSha256: string;
};

export type V4HoldoutConsumptionReceipt = {
  evaluationEpisodeId: string;
  holdoutCaseSetSha256: string;
  priorLedgerSha256: string;
  consumedAt: string;
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
  const routedNeeds = exactInteger(raw, "routed_need_count", 0, totalNeeds);
  const correctlyRoutedNeeds = exactInteger(raw, "correctly_routed_need_count", 0, routedNeeds);
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
  if (routeWasUsed !== (routedNeeds > 0)) throw new V4EvaluationParseError("route_was_used must match routed_need_count.");
  if (!routeWasUsed && routeWasAppropriate !== null) throw new V4EvaluationParseError("route_was_appropriate must be null when no route was used.");
  if (routeWasUsed && routeWasAppropriate !== (correctlyRoutedNeeds === routedNeeds)) throw new V4EvaluationParseError("route_was_appropriate must match exact need-level route correctness.");
  if (appropriatelyRoutedNeeds > correctlyRoutedNeeds) throw new V4EvaluationParseError("appropriately_routed_needs cannot exceed correctly_routed_need_count.");
  if (typeof raw.assessment !== "string") throw new V4EvaluationParseError("assessment must be a string.");
  return {
    totalNeeds,
    fullyResolvedNeeds,
    usefulPartialNeeds,
    appropriatelyRoutedNeeds,
    falseAbstainedNeeds,
    routedNeeds,
    correctlyRoutedNeeds,
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

function normalizedModelId(value: string) {
  return value.trim().toLowerCase().replace(/^[a-z0-9_-]+\//, "");
}

function gitShaText(raw: Record<string, unknown>, key: string) {
  const value = exactText(raw, key, 40).toLowerCase();
  if (!/^[a-f0-9]{40}$/.test(value)) throw new V4EvaluationParseError(`${key} must be a 40-character Git commit SHA.`);
  return value;
}

function parsePromotionStrata(value: unknown, label: string) {
  if (!Array.isArray(value) || !value.length) {
    throw new V4EvaluationParseError(`${label} must be a non-empty array.`);
  }
  const allowed = new Set<string>(V4_CANONICAL_REQUIRED_STRATA);
  const strata = value.map((entry) => {
    if (typeof entry !== "string" || !allowed.has(entry)) {
      throw new V4EvaluationParseError(`${label} contains an unsupported canonical stratum: ${String(entry)}`);
    }
    return entry as V4PromotionStratum;
  });
  if (new Set(strata).size !== strata.length) throw new V4EvaluationParseError(`${label} must not contain duplicate strata.`);
  return strata;
}

export function parseV4ApprovedPromotionSuiteManifest(value: unknown): V4ApprovedPromotionSuiteManifest {
  const raw = record(value, "approved promotion suite manifest");
  if (raw.schemaVersion !== 2) throw new V4EvaluationParseError("approved promotion suite manifest schemaVersion must be 2.");
  if (raw.purpose !== "promotion") throw new V4EvaluationParseError("approved promotion suite manifest purpose must be promotion.");
  const intendedProvider = record(raw.intendedProvider, "approved promotion suite manifest intendedProvider");
  const protocol = record(raw.protocol, "approved promotion suite manifest protocol");
  const preregistration = record(protocol.preregistration, "approved promotion suite manifest protocol.preregistration");
  const holdout = record(protocol.holdout, "approved promotion suite manifest protocol.holdout");
  if (!Array.isArray(raw.cases) || !raw.cases.length) {
    throw new V4EvaluationParseError("approved promotion suite manifest cases must be a non-empty array.");
  }
  const cases = raw.cases.map((value, index) => {
    const item = record(value, `approved promotion suite manifest cases[${index}]`);
    if (item.role !== "retained" && item.role !== "holdout") {
      throw new V4EvaluationParseError(`approved promotion suite manifest cases[${index}].role must be retained or holdout.`);
    }
    return {
      caseId: exactText(item, "caseId", 300),
      role: item.role as V4PromotionSuiteRole,
      strata: parsePromotionStrata(item.strata, `approved promotion suite manifest cases[${index}].strata`),
    };
  });
  if (new Set(cases.map((item) => item.caseId)).size !== cases.length) {
    throw new V4EvaluationParseError("approved promotion suite manifest case IDs must be unique.");
  }
  const retainedCases = cases.filter((item) => item.role === "retained");
  const holdoutCases = cases.filter((item) => item.role === "holdout");
  const minimumRetainedCases = exactInteger(protocol, "minimumRetainedCases", V4_CANONICAL_MINIMUM_RETAINED_CASES, 10_000);
  const minimumHoldoutCases = exactInteger(protocol, "minimumHoldoutCases", V4_CANONICAL_MINIMUM_HOLDOUT_CASES, 10_000);
  if (retainedCases.length < minimumRetainedCases || holdoutCases.length < minimumHoldoutCases) {
    throw new V4EvaluationParseError(
      `approved promotion suite manifest requires at least ${minimumRetainedCases} retained and ${minimumHoldoutCases} holdout cases.`,
    );
  }
  const requiredStrata = parsePromotionStrata(protocol.requiredStrata, "approved promotion suite manifest protocol.requiredStrata");
  if (
    requiredStrata.length !== V4_CANONICAL_REQUIRED_STRATA.length ||
    V4_CANONICAL_REQUIRED_STRATA.some((stratum) => !requiredStrata.includes(stratum))
  ) {
    throw new V4EvaluationParseError("approved promotion suite manifest protocol.requiredStrata must contain every canonical stratum.");
  }
  for (const role of ["retained", "holdout"] as const) {
    const roleCases = role === "retained" ? retainedCases : holdoutCases;
    const missing = requiredStrata.filter((stratum) => !roleCases.some((item) => item.strata.includes(stratum)));
    if (missing.length) {
      throw new V4EvaluationParseError(`approved promotion suite manifest ${role} cases are missing strata: ${missing.join(", ")}.`);
    }
  }
  if (preregistration.evidenceType !== "git_commit") {
    throw new V4EvaluationParseError("approved promotion suite manifest preregistration evidenceType must be git_commit.");
  }
  const evidenceUri = exactText(preregistration, "evidenceUri", 1000);
  if (!/^https:\/\//i.test(evidenceUri)) {
    throw new V4EvaluationParseError("approved promotion suite manifest preregistration evidenceUri must be an externally addressable HTTPS URL.");
  }
  return {
    schemaVersion: 2,
    suiteId: exactText(raw, "suiteId", 300),
    purpose: "promotion",
    approvedBy: exactText(raw, "approvedBy", 300),
    approvedAt: canonicalTimestamp(raw, "approvedAt"),
    datasetSha256: sha256Text(raw, "datasetSha256"),
    knowledgeVersion: exactText(raw, "knowledgeVersion", 300),
    v3EffectiveCorpusSha256: sha256Text(raw, "v3EffectiveCorpusSha256"),
    v4EffectiveCorpusSha256: sha256Text(raw, "v4EffectiveCorpusSha256"),
    expectedCodeSha256: sha256Text(raw, "expectedCodeSha256"),
    evaluationEpisodeId: exactText(raw, "evaluationEpisodeId", 300),
    intendedProvider: {
      provider: exactText(intendedProvider, "provider", 100).toLowerCase(),
      model: normalizedModelId(exactText(intendedProvider, "model", 200)),
    },
    cases,
    protocol: {
      minimumRetainedCases,
      minimumHoldoutCases,
      requiredStrata,
      preregistration: {
        evidenceType: "git_commit",
        evidenceUri,
        evidenceSha256: sha256Text(preregistration, "evidenceSha256"),
        gitCommitSha: gitShaText(preregistration, "gitCommitSha"),
        registeredAt: canonicalTimestamp(preregistration, "registeredAt"),
      },
      holdout: {
        caseSetSha256: sha256Text(holdout, "caseSetSha256"),
        consumptionLedgerSha256: sha256Text(holdout, "consumptionLedgerSha256"),
      },
    },
  };
}

export function parseV4HoldoutConsumptionLedger(value: unknown): V4HoldoutConsumptionLedger {
  const raw = record(value, "holdout consumption ledger");
  if (raw.schemaVersion !== 1) throw new V4EvaluationParseError("holdout consumption ledger schemaVersion must be 1.");
  if (!Array.isArray(raw.consumptions)) throw new V4EvaluationParseError("holdout consumption ledger consumptions must be an array.");
  const consumptions = raw.consumptions.map((value, index) => {
    const entry = record(value, `holdout consumption ledger consumptions[${index}]`);
    return {
      evaluationEpisodeId: exactText(entry, "evaluationEpisodeId", 300),
      holdoutCaseSetSha256: sha256Text(entry, "holdoutCaseSetSha256"),
      consumedAt: canonicalTimestamp(entry, "consumedAt"),
      sourceArtifactSha256: sha256Text(entry, "sourceArtifactSha256"),
    };
  });
  if (new Set(consumptions.map((entry) => entry.evaluationEpisodeId)).size !== consumptions.length) {
    throw new V4EvaluationParseError("holdout consumption ledger evaluationEpisodeId values must be unique.");
  }
  return {
    schemaVersion: 1,
    ledgerId: exactText(raw, "ledgerId", 300),
    updatedAt: canonicalTimestamp(raw, "updatedAt"),
    consumptions,
  };
}

function parseHumanScorer(value: unknown, label: string): V4HumanScorerProvenance {
  const scorer = record(value, label);
  if (scorer.independentFromSystems !== true) {
    throw new V4EvaluationParseError(`${label}.independentFromSystems must be true.`);
  }
  return {
    id: exactText(scorer, "id", 300),
    adjudicatedAt: canonicalTimestamp(scorer, "adjudicatedAt"),
    methodology: exactText(scorer, "methodology", 3000),
    independentFromSystems: true,
  };
}

function parseHumanRuntime(value: unknown, label: string): V4HumanRuntimeBinding {
  const raw = record(value, label);
  const needsRoute = exactBoolean(raw, "needsRoute");
  if (!Array.isArray(raw.routeKeys) || raw.routeKeys.some((key) => typeof key !== "string" || !key.trim())) {
    throw new V4EvaluationParseError(`${label}.routeKeys must be an array of non-empty governed route keys.`);
  }
  const routeKeys = (raw.routeKeys as string[]).map((key) => key.trim());
  if (new Set(routeKeys).size !== routeKeys.length) throw new V4EvaluationParseError(`${label}.routeKeys must be unique.`);
  if (needsRoute !== (routeKeys.length > 0)) {
    throw new V4EvaluationParseError(`${label}.needsRoute must exactly match whether routeKeys is non-empty.`);
  }
  return { lane: exactText(raw, "lane", 100), needsRoute, routeKeys };
}

function optionalRouteKey(raw: Record<string, unknown>, key: string) {
  return raw[key] === null ? null : exactText(raw, key, 100);
}

function systemScoreFromHumanNeedOutcomes(
  needOutcomes: V4HumanNeedOutcome[],
  side: "v3" | "v4",
  assessment: V4SystemJudgeScore,
) {
  const answerField = side === "v3" ? "v3AnswerCompleteness" : "v4AnswerCompleteness";
  const routeField = side === "v3" ? "v3RouteKey" : "v4RouteKey";
  const fullyResolvedNeeds = needOutcomes.filter((need) => need[answerField] === "fully_resolved").length;
  const appropriatelyRoutedNeeds = needOutcomes.filter((need) => {
    return need[answerField] !== "fully_resolved" && need.expectedRouteKey !== null && need[routeField] === need.expectedRouteKey;
  }).length;
  const usefulPartialNeeds = needOutcomes.filter((need) =>
    need[answerField] === "useful_partial" && !(need.expectedRouteKey !== null && need[routeField] === need.expectedRouteKey),
  ).length;
  const falseAbstainedNeeds = needOutcomes.length - fullyResolvedNeeds - usefulPartialNeeds - appropriatelyRoutedNeeds;
  const routedNeeds = needOutcomes.filter((need) => need[routeField] !== null).length;
  const correctlyRoutedNeeds = needOutcomes.filter((need) =>
    need[routeField] !== null && need[routeField] === need.expectedRouteKey,
  ).length;
  return {
    ...assessment,
    totalNeeds: needOutcomes.length,
    fullyResolvedNeeds,
    usefulPartialNeeds,
    appropriatelyRoutedNeeds,
    falseAbstainedNeeds,
    routedNeeds,
    correctlyRoutedNeeds,
    routeWasUsed: routedNeeds > 0,
    routeWasAppropriate: routedNeeds ? correctlyRoutedNeeds === routedNeeds : null,
  } satisfies V4SystemJudgeScore;
}

export function parseV4HumanScoreBundle(value: unknown): V4HumanScoreBundle {
  const raw = record(value, "human score bundle");
  if (raw.schemaVersion !== 4) throw new V4EvaluationParseError("human score bundle schemaVersion must be 4.");
  if (!Array.isArray(raw.scores) || !raw.scores.length) {
    throw new V4EvaluationParseError("human score bundle scores must be a non-empty array.");
  }
  const scores = raw.scores.map((value, index): V4HumanScoreRecord => {
    const score = record(value, `human score bundle scores[${index}]`);
    const scorer = parseHumanScorer(score.scorer, `human score bundle scores[${index}].scorer`);
    const v3Runtime = parseHumanRuntime(score.v3Runtime, `human score bundle scores[${index}].v3Runtime`);
    const v4Runtime = parseHumanRuntime(score.v4Runtime, `human score bundle scores[${index}].v4Runtime`);
    if (!(["v3", "v4", "tie"] as unknown[]).includes(score.preferred)) {
      throw new V4EvaluationParseError(`human score bundle scores[${index}].preferred must be v3, v4, or tie.`);
    }
    if (!Array.isArray(score.needOutcomes) || !score.needOutcomes.length || score.needOutcomes.length > 20) {
      throw new V4EvaluationParseError(`human score bundle scores[${index}].needOutcomes must contain from 1 to 20 needs.`);
    }
    const allowedCompleteness = new Set<V4HumanAnswerCompleteness>(["fully_resolved", "useful_partial", "not_answered"]);
    const allowedDispositions = new Set(["answer", "partial", "route", "clarify", "live_lookup", "artifact", "conversation"]);
    const needOutcomes = score.needOutcomes.map((value, needIndex) => {
      const outcome = record(value, `human score bundle scores[${index}].needOutcomes[${needIndex}]`);
      if (!allowedCompleteness.has(outcome.v3AnswerCompleteness as V4HumanAnswerCompleteness) || !allowedCompleteness.has(outcome.v4AnswerCompleteness as V4HumanAnswerCompleteness)) {
        throw new V4EvaluationParseError(`human score bundle scores[${index}].needOutcomes[${needIndex}] has invalid answer completeness.`);
      }
      const parsed = {
        needId: exactText(outcome, "needId", 80),
        expectedDisposition: exactText(outcome, "expectedDisposition", 100),
        expectedRouteKey: optionalRouteKey(outcome, "expectedRouteKey"),
        v3AnswerCompleteness: outcome.v3AnswerCompleteness as V4HumanAnswerCompleteness,
        v4AnswerCompleteness: outcome.v4AnswerCompleteness as V4HumanAnswerCompleteness,
        v3RouteKey: optionalRouteKey(outcome, "v3RouteKey"),
        v4RouteKey: optionalRouteKey(outcome, "v4RouteKey"),
      } satisfies V4HumanNeedOutcome;
      if (!allowedDispositions.has(parsed.expectedDisposition)) {
        throw new V4EvaluationParseError(`human score bundle scores[${index}].needOutcomes[${needIndex}] has an invalid expectedDisposition.`);
      }
      if (["route", "live_lookup", "artifact"].includes(parsed.expectedDisposition) &&
        (parsed.v3AnswerCompleteness === "fully_resolved" || parsed.v4AnswerCompleteness === "fully_resolved")) {
        throw new V4EvaluationParseError(`human score bundle scores[${index}].needOutcomes[${needIndex}] cannot mark a governed unresolved need fully answered.`);
      }
      return parsed;
    });
    if (new Set(needOutcomes.map((outcome) => outcome.needId)).size !== needOutcomes.length) {
      throw new V4EvaluationParseError(`human score bundle scores[${index}].needOutcomes must use unique need IDs.`);
    }
    for (const side of ["v3", "v4"] as const) {
      const runtime = side === "v3" ? v3Runtime : v4Runtime;
      const routeField = side === "v3" ? "v3RouteKey" : "v4RouteKey";
      const assigned = needOutcomes.map((need) => need[routeField]).filter((key): key is string => key !== null);
      if (assigned.some((key) => !runtime.routeKeys.includes(key))) {
        throw new V4EvaluationParseError(`human score bundle scores[${index}].${side} assigns a route key absent from its runtime binding.`);
      }
      if (runtime.routeKeys.some((key) => !assigned.includes(key))) {
        throw new V4EvaluationParseError(`human score bundle scores[${index}].${side} runtime route keys must be assigned to at least one need.`);
      }
    }
    const parsedV3Score = parseV4SystemJudgeScore(score.v3Score);
    const parsedV4Score = parseV4SystemJudgeScore(score.v4Score);
    const v3Score = systemScoreFromHumanNeedOutcomes(needOutcomes, "v3", parsedV3Score);
    const v4Score = systemScoreFromHumanNeedOutcomes(needOutcomes, "v4", parsedV4Score);
    const assertDerivedScore = (side: "v3" | "v4", supplied: V4SystemJudgeScore, derived: V4SystemJudgeScore) => {
      const metricKeys: Array<keyof V4SystemJudgeScore> = [
        "totalNeeds", "fullyResolvedNeeds", "usefulPartialNeeds", "appropriatelyRoutedNeeds",
        "falseAbstainedNeeds", "routedNeeds", "correctlyRoutedNeeds", "routeWasUsed", "routeWasAppropriate",
      ];
      if (metricKeys.some((key) => supplied[key] !== derived[key])) {
        throw new V4EvaluationParseError(`human score bundle scores[${index}].${side}Score must be mechanically derived from answer completeness, gold expectations, and observed routes.`);
      }
    };
    assertDerivedScore("v3", parsedV3Score, v3Score);
    assertDerivedScore("v4", parsedV4Score, v4Score);
    return {
      id: exactText(score, "id", 300),
      v3AnswerSha256: sha256Text(score, "v3AnswerSha256"),
      v4AnswerSha256: sha256Text(score, "v4AnswerSha256"),
      v3Runtime,
      v4Runtime,
      v3Score,
      v4Score,
      preferred: score.preferred as "v3" | "v4" | "tie",
      comparisonReason: exactText(score, "comparisonReason", 2000),
      scorer,
      needOutcomes,
    };
  });
  if (new Set(scores.map((score) => score.id)).size !== scores.length) {
    throw new V4EvaluationParseError("human score bundle score IDs must be unique.");
  }
  return {
    schemaVersion: 4,
    sourceRunId: exactText(raw, "sourceRunId", 300),
    sourceArtifactSha256: sha256Text(raw, "sourceArtifactSha256"),
    sourceDatasetSha256: sha256Text(raw, "sourceDatasetSha256"),
    sourceCodeSha256: sha256Text(raw, "sourceCodeSha256"),
    sourceKnowledgeVersion: exactText(raw, "sourceKnowledgeVersion", 300),
    sourceV3EffectiveCorpusSha256: sha256Text(raw, "sourceV3EffectiveCorpusSha256"),
    sourceV4EffectiveCorpusSha256: sha256Text(raw, "sourceV4EffectiveCorpusSha256"),
    sourceApprovedSuiteManifestSha256: raw.sourceApprovedSuiteManifestSha256 === null
      ? null
      : sha256Text(raw, "sourceApprovedSuiteManifestSha256"),
    scores,
  };
}

export function inferV4ComparisonMode(input: {
  forceFreshV3: boolean;
  promptsWithStoredProduction: number;
  totalPrompts: number;
  v3EffectiveCorpusSha256?: string;
  v4EffectiveCorpusSha256?: string;
}): V4ComparisonMode {
  if (input.forceFreshV3 || input.promptsWithStoredProduction === 0) {
    if (!input.v3EffectiveCorpusSha256 || !input.v4EffectiveCorpusSha256) {
      return "fresh_v3_vs_v4_effective_corpus_unknown_diagnostic";
    }
    return input.v3EffectiveCorpusSha256 === input.v4EffectiveCorpusSha256
      ? "same_effective_corpus_fresh_v3_vs_v4_architecture_only"
      : "different_effective_corpora_fresh_v3_vs_v4_end_to_end";
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

type RawRatio = { numerator: number; denominator: number };

function ratioPercent(ratio: RawRatio) {
  return ratio.denominator ? (ratio.numerator / ratio.denominator) * 100 : null;
}

function displayRatio(ratio: RawRatio) {
  const value = ratioPercent(ratio);
  return value === null ? null : Math.round(value * 10) / 10;
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
  const routedNeeds = scores.reduce((total, score) => total + score.routedNeeds, 0);
  const correctlyRoutedNeeds = scores.reduce((total, score) => total + score.correctlyRoutedNeeds, 0);
  const latencies = items.map((item) => item[key].latencyMs);
  const weightedUtilityRatio = {
    numerator: (fullyResolvedNeeds + appropriatelyRoutedNeeds) * 2 + usefulPartialNeeds,
    denominator: totalNeeds * 2,
  };
  const falseAbstentionRatio = { numerator: falseAbstainedNeeds, denominator: totalNeeds };
  const routePrecisionRatio = { numerator: correctlyRoutedNeeds, denominator: routedNeeds };
  return {
    judgedCases: scores.length,
    totalNeeds,
    weightedNeedUtility: displayRatio(weightedUtilityRatio),
    fullyResolvedNeeds,
    usefulPartialNeeds,
    appropriatelyRoutedNeeds,
    falseAbstainedNeeds,
    routedNeeds,
    correctlyRoutedNeeds,
    falseAbstentionRate: displayRatio(falseAbstentionRatio),
    unsupportedClaimCount,
    criticalUnsupportedClaimCount,
    routePrecision: displayRatio(routePrecisionRatio),
    rawRatios: {
      weightedNeedUtility: weightedUtilityRatio,
      falseAbstentionRate: falseAbstentionRatio,
      routePrecision: routePrecisionRatio,
    },
    technicalFailures: scores.filter((score) => score.technicalFailure).length,
    latencyMs: {
      p50: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95),
      average: latencies.length ? Math.round(latencies.reduce((total, value) => total + value, 0) / latencies.length) : 0,
    },
  };
}

function providerReliability(items: V4PairedEvaluationItem[]) {
  const attempts = items.flatMap((item) => (item.v4.providerAttempts || []).map((attempt, index) => ({ item, attempt, index })));
  const successfulAttempts = attempts.filter(({ attempt }) => attempt.status === "success").length;
  const failedAttempts = attempts.filter(({ attempt }) => attempt.status === "failed");
  const stages = items.flatMap((item) => {
    const purposes = [...new Set((item.v4.providerAttempts || []).map((attempt) => attempt.purpose || "unknown"))];
    return purposes.flatMap((purpose) => {
      const stageAttempts = (item.v4.providerAttempts || [])
        .map((attempt, index) => ({ attempt, index }))
        .filter(({ attempt }) => (attempt.purpose || "unknown") === purpose);
      const failures = stageAttempts.filter(({ attempt }) => attempt.status === "failed");
      if (!failures.length) return [];
      const lastFailureIndex = failures.at(-1)!.index;
      const recovery = stageAttempts.find(({ attempt, index }) => index > lastFailureIndex && attempt.status === "success");
      return [{
        itemId: item.id || item.caseId || item.question || "unknown",
        purpose,
        failedAttemptIndexes: failures.map(({ index }) => index),
        recoveryAttemptIndex: recovery?.index ?? null,
        recovered: Boolean(recovery),
      }];
    });
  });
  const recoveredFailedAttempts = failedAttempts.filter(({ item, attempt, index }) =>
    item.v4.providerAttempts?.some((candidate, candidateIndex) =>
      candidateIndex > index && candidate.purpose === attempt.purpose && candidate.status === "success",
    ),
  ).length;
  const unrecoveredFailedAttempts = failedAttempts.length - recoveredFailedAttempts;
  const affectedCaseIds = new Set(stages.map((stage) => stage.itemId));
  const recoveredAffectedCaseIds = new Set(stages.filter((stage) => stage.recovered).map((stage) => stage.itemId));
  const recoveredRetryRatio = { numerator: recoveredAffectedCaseIds.size, denominator: items.length };
  return {
    successfulAttempts,
    failedAttempts: failedAttempts.length,
    recoveredFailedAttempts,
    unrecoveredFailedAttempts,
    recoveredRetryRate: displayRatio(recoveredRetryRatio) ?? 0,
    rawRecoveredRetryRate: recoveredRetryRatio,
    affectedCases: affectedCaseIds.size,
    recoveredAffectedCases: recoveredAffectedCaseIds.size,
    affectedStages: stages.length,
    stages,
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
    v4ProviderReliability: providerReliability(items),
    v4Lanes: Object.fromEntries([...new Set(items.map((item) => item.v4.lane))].sort().map((lane) => [lane, items.filter((item) => item.v4.lane === lane).length])),
  };
}

function metricSpread(values: Array<number | null>) {
  const available = values.filter((value): value is number => value !== null);
  if (available.length < 2) return 0;
  return Math.max(...available) - Math.min(...available);
}

export function summarizeV4Runs(items: V4PairedEvaluationItem[]) {
  const runNumbers = [...new Set(items.map((item) => item.run || 1))].sort((left, right) => left - right);
  const runs = runNumbers.map((run) => {
    const runItems = items.filter((item) => (item.run || 1) === run);
    const caseIds = runItems.map((item) => item.caseId || "").sort();
    return { run, cases: runItems.length, caseIds, summary: summarizeV4PairedEvaluation(runItems) };
  });
  const firstCaseIds = runs[0]?.caseIds || [];
  const exactCaseIdsConsistent = runs.every((run) => JSON.stringify(run.caseIds) === JSON.stringify(firstCaseIds));
  const invalidItemIds = items.filter((item) =>
    !item.caseId || !item.id || !Number.isInteger(item.run) || item.run! < 1 || item.id !== `${item.caseId}-run-${item.run}`,
  ).map((item) => item.id || item.caseId || "missing-id");
  const duplicateItemIds = items.length - new Set(items.map((item) => item.id)).size;
  const consecutiveRunNumbers = runNumbers.every((run, index) => run === index + 1);
  return {
    runCount: runs.length,
    runs,
    caseCountsConsistent: new Set(runs.map((run) => run.cases)).size <= 1,
    exactCaseIdsConsistent,
    invalidItemIds,
    duplicateItemIds,
    consecutiveRunNumbers,
    stability: {
      v4WeightedNeedUtilitySpread: metricSpread(runs.map((run) => ratioPercent(run.summary.v4.rawRatios.weightedNeedUtility))),
      v4FalseAbstentionRateSpread: metricSpread(runs.map((run) => ratioPercent(run.summary.v4.rawRatios.falseAbstentionRate))),
      v4RoutePrecisionSpread: metricSpread(runs.map((run) => ratioPercent(run.summary.v4.rawRatios.routePrecision))),
    },
  };
}

function modelBackedFailure(item: V4PairedEvaluationItem) {
  const modes = item.v4.executionMode;
  const attempts = item.v4.providerAttempts;
  if (item.v4.lane === "conversation") {
    if (modes?.planning !== "conversation") return "conversation case did not use the deterministic conversation lane";
    return attempts?.length ? "conversation case unexpectedly invoked a provider" : null;
  }
  if (!modes || !attempts) return "model execution provenance is missing";
  if (modes.planning === "deterministic_governed") {
    if (modes.composition !== "exact_evidence" || modes.validation !== "deterministic_exact_evidence") {
      return "deterministic governed execution did not preserve exact-evidence composition and validation";
    }
    if (attempts.length || item.v4.provider || item.v4.model) {
      return "deterministic governed execution unexpectedly invoked or claimed a model provider";
    }
    if (!item.v4.selectedPolicyIds?.length) return "deterministic governed execution has no selected governed policy";
    return null;
  }
  const unrecoveredPurpose = unrecoveredAttemptPurpose(attempts);
  if (unrecoveredPurpose) return `${unrecoveredPurpose} failed without a successful recovery`;
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
  thresholds: {
    minimumWeightedNeedUtility: number;
    maximumFalseAbstentionRate: number;
    minimumRoutePrecision: number;
    maximumV4P95LatencyMs: number;
  },
) {
  const v4Utility = summary.v4.rawRatios.weightedNeedUtility;
  const v3Utility = summary.v3.rawRatios.weightedNeedUtility;
  const v4UtilityDisplay = summary.v4.weightedNeedUtility;
  const v3UtilityDisplay = summary.v3.weightedNeedUtility;
  if (!v4Utility.denominator || v4Utility.numerator * 100 < thresholds.minimumWeightedNeedUtility * v4Utility.denominator) {
    failures.push(`${label} V4 weighted need utility must be at least ${thresholds.minimumWeightedNeedUtility}%; observed ${v4UtilityDisplay ?? "n/a"}%.`);
  }
  if (v4Utility.denominator && v3Utility.denominator && v4Utility.numerator * v3Utility.denominator < v3Utility.numerator * v4Utility.denominator) {
    failures.push(`${label} V4 weighted need utility regressed below V3 (${v4UtilityDisplay}% vs ${v3UtilityDisplay}%).`);
  }
  const v4FalseAbstention = summary.v4.rawRatios.falseAbstentionRate;
  const v3FalseAbstention = summary.v3.rawRatios.falseAbstentionRate;
  const v4FalseAbstentionDisplay = summary.v4.falseAbstentionRate;
  const v3FalseAbstentionDisplay = summary.v3.falseAbstentionRate;
  if (!v4FalseAbstention.denominator || v4FalseAbstention.numerator * 100 > thresholds.maximumFalseAbstentionRate * v4FalseAbstention.denominator) {
    failures.push(`${label} V4 false-abstention rate must be at most ${thresholds.maximumFalseAbstentionRate}%; observed ${v4FalseAbstentionDisplay ?? "n/a"}%.`);
  }
  if (v4FalseAbstention.denominator && v3FalseAbstention.denominator && v4FalseAbstention.numerator * v3FalseAbstention.denominator > v3FalseAbstention.numerator * v4FalseAbstention.denominator) {
    failures.push(`${label} V4 false-abstention rate regressed above V3 (${v4FalseAbstentionDisplay}% vs ${v3FalseAbstentionDisplay}%).`);
  }
  const routePrecision = summary.v4.rawRatios.routePrecision;
  if (!routePrecision.denominator || routePrecision.numerator * 100 < thresholds.minimumRoutePrecision * routePrecision.denominator) {
    failures.push(`${label} V4 route precision must be at least ${thresholds.minimumRoutePrecision}%; observed ${summary.v4.routePrecision ?? "n/a"}%.`);
  }
  if (summary.v4.latencyMs.p95 > thresholds.maximumV4P95LatencyMs) {
    failures.push(`${label} V4 p95 latency must be at most ${thresholds.maximumV4P95LatencyMs}ms; observed ${summary.v4.latencyMs.p95}ms.`);
  }
  if (summary.preference.v4 < summary.preference.v3) {
    failures.push(`${label} independent preference favors V3 (${summary.preference.v3}) over V4 (${summary.preference.v4}).`);
  }
}

function ratioExceedsPercent(ratio: RawRatio, threshold: number) {
  return ratio.denominator > 0 && ratio.numerator * 100 > threshold * ratio.denominator;
}

function appendHoldoutQualityThresholdFailures(
  failures: string[],
  items: V4PairedEvaluationItem[],
  approvedSuite: V4ApprovedPromotionSuiteEvidence,
  thresholds: {
    minimumWeightedNeedUtility: number;
    maximumFalseAbstentionRate: number;
    minimumRoutePrecision: number;
    maximumUtilitySpread: number;
    maximumFalseAbstentionSpread: number;
    maximumV4P95LatencyMs: number;
    maximumRecoveredRetryRate: number;
  },
) {
  const holdoutCaseIds = new Set(
    approvedSuite.manifest.cases
      .filter((item) => item.role === "holdout")
      .map((item) => item.caseId),
  );
  const holdoutItems = items.filter((item) => item.caseId && holdoutCaseIds.has(item.caseId));
  if (!holdoutItems.length) {
    failures.push("Approved holdout quality could not be evaluated because no complete holdout judgments are available.");
    return;
  }

  const holdoutSummary = summarizeV4PairedEvaluation(holdoutItems);
  appendQualityThresholdFailures(failures, holdoutSummary, "Holdout aggregate", thresholds);
  if (holdoutSummary.v4ProviderReliability.unrecoveredFailedAttempts > 0) {
    failures.push(`Holdout has ${holdoutSummary.v4ProviderReliability.unrecoveredFailedAttempts} unrecovered provider attempt failure(s).`);
  }
  if (ratioExceedsPercent(holdoutSummary.v4ProviderReliability.rawRecoveredRetryRate, thresholds.maximumRecoveredRetryRate)) {
    failures.push(`Holdout recovered-retry rate must be at most ${thresholds.maximumRecoveredRetryRate}%; observed ${holdoutSummary.v4ProviderReliability.recoveredRetryRate}%.`);
  }

  const holdoutRunSummary = summarizeV4Runs(holdoutItems);
  for (const run of holdoutRunSummary.runs) {
    appendQualityThresholdFailures(failures, run.summary, `Run ${run.run} holdout`, thresholds);
    if (run.summary.v4ProviderReliability.unrecoveredFailedAttempts > 0) {
      failures.push(`Run ${run.run} holdout has ${run.summary.v4ProviderReliability.unrecoveredFailedAttempts} unrecovered provider attempt failure(s).`);
    }
    if (ratioExceedsPercent(run.summary.v4ProviderReliability.rawRecoveredRetryRate, thresholds.maximumRecoveredRetryRate)) {
      failures.push(`Run ${run.run} holdout recovered-retry rate must be at most ${thresholds.maximumRecoveredRetryRate}%; observed ${run.summary.v4ProviderReliability.recoveredRetryRate}%.`);
    }
  }
  if (holdoutRunSummary.stability.v4WeightedNeedUtilitySpread > thresholds.maximumUtilitySpread) {
    failures.push(`Holdout V4 weighted-utility spread across runs must be at most ${thresholds.maximumUtilitySpread} points; observed ${holdoutRunSummary.stability.v4WeightedNeedUtilitySpread}.`);
  }
  if (holdoutRunSummary.stability.v4FalseAbstentionRateSpread > thresholds.maximumFalseAbstentionSpread) {
    failures.push(`Holdout V4 false-abstention spread across runs must be at most ${thresholds.maximumFalseAbstentionSpread} points; observed ${holdoutRunSummary.stability.v4FalseAbstentionRateSpread}.`);
  }
}

function unrecoveredAttemptPurpose(attempts: Array<{ purpose?: string; status?: string }> | undefined) {
  return attempts?.find((attempt, index) =>
    attempt.status === "failed" && !attempts.some((candidate, candidateIndex) =>
      candidateIndex > index && candidate.purpose === attempt.purpose && candidate.status === "success",
    ),
  )?.purpose || null;
}

function appendApprovedSuiteFailures(
  failures: string[],
  items: V4PairedEvaluationItem[],
  approvedSuite: V4ApprovedPromotionSuiteEvidence | null | undefined,
  runtime: V4CanonicalRuntimeEvidence | null | undefined,
  holdoutLedger: V4HoldoutConsumptionLedgerEvidence | null | undefined,
  receipt: V4HoldoutConsumptionReceipt | null | undefined,
) {
  if (!approvedSuite) {
    failures.push("Promotion enforcement requires an explicit immutable approved-suite manifest and its independently supplied SHA-256 hash.");
    return;
  }
  if (!/^[a-f0-9]{64}$/.test(approvedSuite.manifestSha256) || approvedSuite.manifestSha256 !== approvedSuite.approvedManifestSha256) {
    failures.push("The approved-suite manifest hash does not match the independently supplied approved SHA-256 hash.");
  }
  const expectedRoles = new Map(approvedSuite.manifest.cases.map((item) => [item.caseId, item.role]));
  const expectedStrata = new Map(approvedSuite.manifest.cases.map((item) => [item.caseId, item.strata]));
  const runNumbers = [...new Set(items.map((item) => item.run || 1))];
  for (const run of runNumbers) {
    const runItems = items.filter((item) => (item.run || 1) === run);
    const actualCaseIds = runItems.map((item) => item.caseId || "").sort();
    const expectedCaseIds = [...expectedRoles.keys()].sort();
    if (JSON.stringify(actualCaseIds) !== JSON.stringify(expectedCaseIds)) {
      failures.push(`Run ${run} does not contain the exact approved-suite case IDs.`);
    }
    const roleMismatch = runItems.filter((item) =>
      !item.caseId || item.evaluationContext?.suiteRole !== expectedRoles.get(item.caseId),
    ).length;
    if (roleMismatch > 0) failures.push(`Run ${run} has ${roleMismatch} case(s) with a missing or incorrect approved-suite role.`);
    const strataMismatch = runItems.filter((item) =>
      !item.caseId || JSON.stringify([...(item.evaluationContext?.suiteStrata || [])].sort()) !== JSON.stringify([...(expectedStrata.get(item.caseId) || [])].sort()),
    ).length;
    if (strataMismatch > 0) failures.push(`Run ${run} has ${strataMismatch} case(s) with missing or incorrect preregistered strata.`);
  }
  const wrongSuiteBinding = items.filter((item) =>
    item.evaluationContext?.suiteId !== approvedSuite.manifest.suiteId ||
    item.evaluationContext?.suiteManifestSha256 !== approvedSuite.manifestSha256,
  ).length;
  if (wrongSuiteBinding > 0) failures.push(`${wrongSuiteBinding} case(s) are not bound to the exact approved-suite ID and manifest hash.`);
  const roles = new Set(items.map((item) => item.evaluationContext?.suiteRole));
  if (!roles.has("retained") || !roles.has("holdout")) {
    failures.push("Promotion requires both retained regression cases and approved holdout cases; retained results alone cannot promote.");
  }
  const wrongCorpusBinding = items.filter((item) =>
    item.evaluationContext?.v3EffectiveCorpusSha256 !== approvedSuite.manifest.v3EffectiveCorpusSha256 ||
    item.evaluationContext?.v4EffectiveCorpusSha256 !== approvedSuite.manifest.v4EffectiveCorpusSha256,
  ).length;
  if (wrongCorpusBinding > 0) failures.push(`${wrongCorpusBinding} case(s) are not bound to both approved effective-corpus hashes.`);

  if (!runtime) {
    failures.push("Canonical promotion requires complete clean-tree runtime provenance.");
  } else {
    if (!runtime.gitTreeClean) failures.push("Canonical promotion requires a clean committed Git tree at generation time.");
    if (runtime.gitCommitSha !== approvedSuite.manifest.protocol.preregistration.gitCommitSha) {
      failures.push("Canonical runtime Git commit does not match the preregistered commit.");
    }
    if (runtime.codeSha256 !== approvedSuite.manifest.expectedCodeSha256) {
      failures.push("Canonical runtime code fingerprint does not match the preregistered code fingerprint.");
    }
    if (!runtime.nodeVersion || !runtime.npmVersion) failures.push("Canonical runtime Node and npm versions must be recorded.");
    const start = new Date(runtime.startedAt).getTime();
    const end = runtime.completedAt ? new Date(runtime.completedAt).getTime() : Number.NaN;
    const registered = new Date(approvedSuite.manifest.protocol.preregistration.registeredAt).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) failures.push("Canonical runtime start/end timestamps are incomplete or invalid.");
    if (Number.isFinite(start) && start < registered) failures.push("Canonical generation started before preregistration evidence was recorded.");
  }

  if (!holdoutLedger || holdoutLedger.ledgerSha256 !== approvedSuite.manifest.protocol.holdout.consumptionLedgerSha256) {
    failures.push("Canonical promotion requires the exact preregistered holdout-consumption ledger hash.");
  } else if (holdoutLedger.ledger.consumptions.some((entry) =>
    entry.holdoutCaseSetSha256 === approvedSuite.manifest.protocol.holdout.caseSetSha256,
  )) {
    failures.push("The approved holdout case set was already consumed before this evaluation episode.");
  }
  if (
    !receipt ||
    receipt.evaluationEpisodeId !== approvedSuite.manifest.evaluationEpisodeId ||
    receipt.holdoutCaseSetSha256 !== approvedSuite.manifest.protocol.holdout.caseSetSha256 ||
    receipt.priorLedgerSha256 !== approvedSuite.manifest.protocol.holdout.consumptionLedgerSha256
  ) {
    failures.push("Canonical promotion requires a holdout-consumption receipt bound to this preregistered episode and prior ledger.");
  }
}

function appendProviderAndBaselineHealthFailures(
  failures: string[],
  items: V4PairedEvaluationItem[],
  approvedSuite: V4ApprovedPromotionSuiteEvidence | null | undefined,
) {
  const expectedProvider = approvedSuite?.manifest.intendedProvider.provider;
  const expectedModel = approvedSuite?.manifest.intendedProvider.model;
  const unhealthyV3 = items.filter((item) =>
    item.v3.score?.technicalFailure ||
    item.v3.errorClass === "v3_provider_failure" ||
    Boolean(unrecoveredAttemptPurpose(item.v3.providerAttempts)),
  );
  if (unhealthyV3.length) {
    failures.push(`${unhealthyV3.length} case(s) have an unhealthy V3 baseline due to a technical or provider failure.`);
  }
  if (!expectedProvider || !expectedModel) return;
  const providerMismatch = items.filter((item) => {
    const v4UsesModel = item.v4.executionMode?.planning === "model";
    const v3ShouldUseModel = item.v4.lane !== "conversation";
    const v4Mismatch = v4UsesModel && (
      item.v4.provider?.toLowerCase() !== expectedProvider ||
      normalizedModelId(item.v4.model || "") !== expectedModel
    );
    const v3InvokedModel = Boolean(item.v3.provider || item.v3.model || item.v3.providerAttempts?.length);
    const v3MissingExpectedModel = v3ShouldUseModel && !v3InvokedModel;
    const v3Mismatch = v3InvokedModel && (
      item.v3.provider?.toLowerCase() !== expectedProvider ||
      normalizedModelId(item.v3.model || "") !== expectedModel
    );
    const attemptMismatch = [...(item.v3.providerAttempts || []), ...(item.v4.providerAttempts || [])].some((attempt) =>
      attempt.provider?.toLowerCase() !== expectedProvider || normalizedModelId(attempt.model || "") !== expectedModel,
    );
    return v4Mismatch || v3MissingExpectedModel || v3Mismatch || attemptMismatch;
  }).length;
  if (providerMismatch > 0) {
    failures.push(`${providerMismatch} case(s) did not use the approved provider/model consistently across the V3 baseline and V4 candidate.`);
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
  const enforceCanonicalThresholds = options.enforceCanonicalThresholds === true;
  const thresholds = enforceCanonicalThresholds
    ? V4_CANONICAL_PROMOTION_THRESHOLDS
    : {
        ...V4_CANONICAL_PROMOTION_THRESHOLDS,
        minimumRuns: Math.max(1, Math.min(options.minimumRuns ?? 1, 20)),
        maximumUtilitySpread: Math.max(0, Math.min(options.maximumUtilitySpread ?? V4_CANONICAL_PROMOTION_THRESHOLDS.maximumUtilitySpread, 100)),
        maximumFalseAbstentionSpread: Math.max(0, Math.min(options.maximumFalseAbstentionSpread ?? V4_CANONICAL_PROMOTION_THRESHOLDS.maximumFalseAbstentionSpread, 100)),
        maximumV4P95LatencyMs: Math.max(1_000, Math.min(options.maximumV4P95LatencyMs ?? V4_CANONICAL_PROMOTION_THRESHOLDS.maximumV4P95LatencyMs, 120_000)),
        maximumRecoveredRetryRate: Math.max(0, Math.min(options.maximumRecoveredRetryRate ?? V4_CANONICAL_PROMOTION_THRESHOLDS.maximumRecoveredRetryRate, 100)),
        requireModelBacked: options.requireModelBacked !== false,
        requireFreshV3: options.requireFreshV3 !== false,
      };
  if (enforceCanonicalThresholds) {
    appendApprovedSuiteFailures(
      failures,
      items,
      options.approvedSuite,
      options.canonicalRuntime,
      options.holdoutLedger,
      options.holdoutConsumptionReceipt,
    );
    const nonHumanScores = items.filter((item) =>
      item.scoreProvenance?.kind !== "human" ||
      !item.scoreProvenance.scorerId ||
      !item.scoreProvenance.scoredAt ||
      !item.scoreProvenance.sourceRunId ||
      !item.scoreProvenance.sourceDatasetSha256 ||
      !item.scoreProvenance.sourceCodeSha256 ||
      !item.scoreProvenance.sourceKnowledgeVersion ||
      !item.scoreProvenance.sourceV3EffectiveCorpusSha256 ||
      !item.scoreProvenance.sourceV4EffectiveCorpusSha256 ||
      !item.scoreProvenance.sourceArtifactSha256 ||
      !item.scoreProvenance.humanScoreBundleSha256 ||
      item.scoreProvenance.sourceDatasetSha256 !== options.approvedSuite?.manifest.datasetSha256 ||
      item.scoreProvenance.sourceKnowledgeVersion !== options.approvedSuite?.manifest.knowledgeVersion ||
      item.scoreProvenance.sourceV3EffectiveCorpusSha256 !== options.approvedSuite?.manifest.v3EffectiveCorpusSha256 ||
      item.scoreProvenance.sourceV4EffectiveCorpusSha256 !== options.approvedSuite?.manifest.v4EffectiveCorpusSha256 ||
      item.scoreProvenance.sourceApprovedSuiteManifestSha256 !== options.approvedSuite?.manifestSha256,
    ).length;
    if (nonHumanScores > 0) failures.push(`${nonHumanScores} case(s) lack current per-item independent human scorer provenance.`);
    const invalidPerNeedHumanScores = items.filter((item) => {
      const goldNeeds = item.evaluationContext?.goldNeeds || [];
      const outcomes = item.humanNeedOutcomes || [];
      if (!goldNeeds.length || outcomes.length !== goldNeeds.length) return true;
      const goldById = new Map(goldNeeds.map((need) => [need.id, need]));
      if (new Set(outcomes.map((outcome) => outcome.needId)).size !== outcomes.length) return true;
      if (outcomes.some((outcome) => {
        const gold = goldById.get(outcome.needId);
        return !gold || gold.expectedDisposition !== outcome.expectedDisposition || gold.expectedRouteKey !== outcome.expectedRouteKey ||
          (["route", "live_lookup", "artifact"].includes(outcome.expectedDisposition) &&
            (outcome.v3AnswerCompleteness === "fully_resolved" || outcome.v4AnswerCompleteness === "fully_resolved"));
      })) return true;
      for (const side of ["v3", "v4"] as const) {
        const routeField = side === "v3" ? "v3RouteKey" : "v4RouteKey";
        const actualRouteKeys = [...new Set(item[side].routeKeys || [])].sort();
        const assignedRouteKeys = [...new Set(outcomes.map((outcome) => outcome[routeField]).filter((key): key is string => key !== null))].sort();
        if (item[side].needsRoute !== (actualRouteKeys.length > 0) || JSON.stringify(actualRouteKeys) !== JSON.stringify(assignedRouteKeys)) return true;
        const score = item[side].score;
        if (!score) return true;
        const derived = systemScoreFromHumanNeedOutcomes(outcomes, side, score);
        const keys: Array<keyof V4SystemJudgeScore> = [
          "totalNeeds", "fullyResolvedNeeds", "usefulPartialNeeds", "appropriatelyRoutedNeeds",
          "falseAbstainedNeeds", "routedNeeds", "correctlyRoutedNeeds", "routeWasUsed", "routeWasAppropriate",
        ];
        if (keys.some((key) => score[key] !== derived[key])) return true;
      }
      return false;
    }).length;
    if (invalidPerNeedHumanScores > 0) {
      failures.push(`${invalidPerNeedHumanScores} case(s) lack mechanically validated per-need answer-completeness and observed-route judgments.`);
    }
    if (new Set(items.map((item) => item.scoreProvenance?.sourceRunId)).size !== 1) {
      failures.push("Per-item human scores are not all bound to the same current benchmark run ID.");
    }
  }
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
  if (mixedKnowledgeSnapshots > 0) failures.push(`${mixedKnowledgeSnapshots} case(s) compare different source knowledge versions.`);
  const wrongComparisonMode = items.filter((item) => {
    const context = item.evaluationContext;
    if (!context?.v3EffectiveCorpusSha256 || !context.v4EffectiveCorpusSha256) return true;
    const expected = context.v3EffectiveCorpusSha256 === context.v4EffectiveCorpusSha256
      ? "same_effective_corpus_fresh_v3_vs_v4_architecture_only"
      : "different_effective_corpora_fresh_v3_vs_v4_end_to_end";
    return context.comparisonMode !== expected || context.sameEffectiveCorpus !== (context.v3EffectiveCorpusSha256 === context.v4EffectiveCorpusSha256);
  }).length;
  if (wrongComparisonMode > 0) failures.push(`${wrongComparisonMode} case(s) lack a truthful fresh effective-corpus comparison label and hash binding.`);
  if (thresholds.requireFreshV3) {
    const nonFreshV3 = items.filter((item) => item.v3.source !== "fresh_runtime").length;
    if (nonFreshV3 > 0) failures.push(`${nonFreshV3} case(s) do not use fresh V3 runtime answers.`);
  }
  const parallelCases = items.filter((item) => item.evaluationContext?.executionOrder === "parallel").length;
  if (parallelCases > 0) failures.push(`${parallelCases} case(s) used concurrent V3/V4 execution; promotion latency and provider reliability require sequential or alternating execution.`);
  if (thresholds.requireModelBacked) {
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
  const incorrectlyRoutedNeeds = judged.reduce((total, item) => total + Math.max(0, (item.v4.score?.routedNeeds || 0) - (item.v4.score?.correctlyRoutedNeeds || 0)), 0);
  if (incorrectlyRoutedNeeds > 0) failures.push(`V4 has ${incorrectlyRoutedNeeds} incorrectly routed need(s); promotion requires exact route correctness.`);
  appendProviderAndBaselineHealthFailures(failures, judged, enforceCanonicalThresholds ? options.approvedSuite : null);
  const summary = summarizeV4PairedEvaluation(judged);
  appendQualityThresholdFailures(failures, summary, "Aggregate", thresholds);
  if (enforceCanonicalThresholds && options.approvedSuite) {
    appendHoldoutQualityThresholdFailures(failures, judged, options.approvedSuite, thresholds);
  }
  if (summary.v4ProviderReliability.unrecoveredFailedAttempts > 0) {
    failures.push(`V4 has ${summary.v4ProviderReliability.unrecoveredFailedAttempts} unrecovered provider attempt failure(s).`);
  }
  if (ratioExceedsPercent(summary.v4ProviderReliability.rawRecoveredRetryRate, thresholds.maximumRecoveredRetryRate)) {
    failures.push(`V4 recovered-retry rate must be at most ${thresholds.maximumRecoveredRetryRate}%; observed ${summary.v4ProviderReliability.recoveredRetryRate}%.`);
  }

  const runSummary = summarizeV4Runs(judged);
  if (enforceCanonicalThresholds && runSummary.runCount !== thresholds.minimumRuns) {
    failures.push(`Canonical promotion requires exactly ${thresholds.minimumRuns} complete run(s); observed ${runSummary.runCount}.`);
  } else if (runSummary.runCount < thresholds.minimumRuns) {
    failures.push(`Promotion requires at least ${thresholds.minimumRuns} complete run(s); observed ${runSummary.runCount}.`);
  }
  if (!runSummary.caseCountsConsistent) failures.push("Repeated runs do not contain the same number of cases.");
  if (!runSummary.exactCaseIdsConsistent) failures.push("Repeated runs do not contain the exact same case IDs.");
  if (!runSummary.consecutiveRunNumbers) failures.push("Repeated run numbers must be consecutive and begin at 1.");
  if (runSummary.duplicateItemIds > 0) failures.push(`Evaluation contains ${runSummary.duplicateItemIds} duplicate item ID(s).`);
  if (runSummary.invalidItemIds.length > 0) failures.push(`${runSummary.invalidItemIds.length} item(s) do not use the exact <caseId>-run-<run> identity.`);
  for (const run of runSummary.runs) {
    appendQualityThresholdFailures(failures, run.summary, `Run ${run.run}`, thresholds);
    if (run.summary.v4.unsupportedClaimCount > 0 || run.summary.v4.criticalUnsupportedClaimCount > 0 || run.summary.v4.technicalFailures > 0) {
      failures.push(`Run ${run.run} contains unsupported claims, critical unsupported claims, or technical failures.`);
    }
    if (run.summary.v4ProviderReliability.unrecoveredFailedAttempts > 0) {
      failures.push(`Run ${run.run} has ${run.summary.v4ProviderReliability.unrecoveredFailedAttempts} unrecovered provider attempt failure(s).`);
    }
    if (ratioExceedsPercent(run.summary.v4ProviderReliability.rawRecoveredRetryRate, thresholds.maximumRecoveredRetryRate)) {
      failures.push(`Run ${run.run} recovered-retry rate must be at most ${thresholds.maximumRecoveredRetryRate}%; observed ${run.summary.v4ProviderReliability.recoveredRetryRate}%.`);
    }
  }
  if (runSummary.stability.v4WeightedNeedUtilitySpread > thresholds.maximumUtilitySpread) {
    failures.push(`V4 weighted-utility spread across runs must be at most ${thresholds.maximumUtilitySpread} points; observed ${runSummary.stability.v4WeightedNeedUtilitySpread}.`);
  }
  if (runSummary.stability.v4FalseAbstentionRateSpread > thresholds.maximumFalseAbstentionSpread) {
    failures.push(`V4 false-abstention spread across runs must be at most ${thresholds.maximumFalseAbstentionSpread} points; observed ${runSummary.stability.v4FalseAbstentionRateSpread}.`);
  }
  return {
    status: enforceCanonicalThresholds ? (failures.length ? "fail" : "pass") : "diagnostic_only",
    passed: enforceCanonicalThresholds && failures.length === 0,
    judgedCases: judged.length,
    totalCases: items.length,
    failures,
  };
}

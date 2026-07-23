import { describe, expect, it } from "vitest";
import {
  evaluateV4PromotionGate,
  inferV4ComparisonMode,
  parseV4ApprovedPromotionSuiteManifest,
  parseV4HumanScoreBundle,
  parseV4SystemJudgeScore,
  summarizeV4PairedEvaluation,
  summarizeV4Runs,
  V4_CANONICAL_REQUIRED_STRATA,
  type V4PairedEvaluationItem,
  type V4SystemJudgeScore,
} from "@/lib/ask-sales-faq/v4/evaluation";

const v3CorpusSha256 = "d".repeat(64);
const v4CorpusSha256 = "e".repeat(64);
const codeSha256 = "c".repeat(64);
const preregisteredGitSha = "f".repeat(40);

const validGoldContext = {
  goldAdjudicated: true,
  goldPolicyIds: ["policy-1"],
  blockedTopicIds: [],
  goldContext: [],
  blockedContext: [],
  goldAdjudicationValid: true,
  goldNeedCount: 2,
  goldNeedIds: ["need-1", "need-2"],
  goldResolutionErrors: [],
  sameKnowledgeSnapshot: true,
  sameEffectiveCorpus: false,
  v3EffectiveCorpusSha256: v3CorpusSha256,
  v4EffectiveCorpusSha256: v4CorpusSha256,
  comparisonMode: "different_effective_corpora_fresh_v3_vs_v4_end_to_end" as const,
  executionOrder: "v3-first",
};

const runIdentity = { id: "case-1-run-1", caseId: "case-1", run: 1 };

function rawScore(overrides: Record<string, unknown> = {}) {
  return {
    total_needs: 2,
    fully_resolved_needs: 1,
    useful_partial_needs: 0,
    appropriately_routed_needs: 1,
    false_abstained_needs: 0,
    routed_need_count: 1,
    correctly_routed_need_count: 1,
    unsupported_claim_count: 0,
    critical_unsupported_claim_count: 0,
    route_was_used: true,
    route_was_appropriate: true,
    technical_failure: false,
    assessment: "Valid.",
    ...overrides,
  };
}

const promotionManifestSha256 = "b".repeat(64);
const suiteCases = (role: "retained" | "holdout", count: number) => Array.from({ length: count }, (_, index) => ({
  caseId: index === 0 ? `${role}-case` : `${role}-case-${index + 1}`,
  role,
  strata: [V4_CANONICAL_REQUIRED_STRATA[index % V4_CANONICAL_REQUIRED_STRATA.length]],
}));
const promotionManifest = parseV4ApprovedPromotionSuiteManifest({
  schemaVersion: 2,
  suiteId: "ask-sales-v4-approved-suite",
  purpose: "promotion",
  approvedBy: "project-owner",
  approvedAt: "2026-07-22T00:00:00.000Z",
  datasetSha256: "a".repeat(64),
  knowledgeVersion: "knowledge-1",
  v3EffectiveCorpusSha256: v3CorpusSha256,
  v4EffectiveCorpusSha256: v4CorpusSha256,
  expectedCodeSha256: codeSha256,
  evaluationEpisodeId: "episode-1",
  intendedProvider: { provider: "deepseek", model: "deepseek-v4-pro" },
  cases: [...suiteCases("retained", 50), ...suiteCases("holdout", 10)],
  protocol: {
    minimumRetainedCases: 50,
    minimumHoldoutCases: 10,
    requiredStrata: [...V4_CANONICAL_REQUIRED_STRATA],
    preregistration: {
      evidenceType: "git_commit",
      evidenceUri: `https://github.com/example/project/commit/${preregisteredGitSha}`,
      evidenceSha256: "1".repeat(64),
      gitCommitSha: preregisteredGitSha,
      registeredAt: "2026-07-21T23:00:00.000Z",
    },
    holdout: {
      caseSetSha256: "2".repeat(64),
      consumptionLedgerSha256: "3".repeat(64),
    },
  },
});

const approvedSuite = {
  manifest: promotionManifest,
  manifestSha256: promotionManifestSha256,
  approvedManifestSha256: promotionManifestSha256,
};

const canonicalOptions = {
  enforceCanonicalThresholds: true,
  approvedSuite,
  canonicalRuntime: {
    gitCommitSha: preregisteredGitSha,
    gitTreeClean: true,
    codeSha256,
    nodeVersion: "v22.0.0",
    npmVersion: "10.0.0",
    startedAt: "2026-07-22T00:00:00.000Z",
    completedAt: "2026-07-22T01:00:00.000Z",
  },
  holdoutLedger: {
    ledgerSha256: "3".repeat(64),
    ledger: {
      schemaVersion: 1 as const,
      ledgerId: "ledger-1",
      updatedAt: "2026-07-21T23:30:00.000Z",
      consumptions: [],
    },
  },
  holdoutConsumptionReceipt: {
    evaluationEpisodeId: "episode-1",
    holdoutCaseSetSha256: "2".repeat(64),
    priorLedgerSha256: "3".repeat(64),
    consumedAt: "2026-07-22T01:00:00.000Z",
  },
};

function canonicalPromotionItems() {
  const safe = parseV4SystemJudgeScore(rawScore());
  return [1, 2, 3].flatMap((run) => promotionManifest.cases.map(({ caseId, role }): V4PairedEvaluationItem => ({
    id: `${caseId}-run-${run}`,
    caseId,
    run,
    preferred: "v4",
    v3: {
      latencyMs: 10,
      score: safe,
      source: "fresh_runtime",
      outcome: "route_from_evidence",
      needsRoute: true,
      routeKeys: ["sales_policy"],
      provider: "deepseek",
      model: "deepseek-v4-pro",
      errorClass: null,
      providerAttempts: [{ purpose: "v3_evidence_answer", status: "success", provider: "deepseek", model: "deepseek-v4-pro" }],
    },
    v4: {
      latencyMs: 10,
      lane: "answer",
      score: safe,
      needsRoute: true,
      routeKeys: ["sales_policy"],
      provider: "deepseek",
      model: "deepseek-v4-pro",
      executionMode: { planning: "model", composition: "model", validation: "model_and_deterministic" },
      providerAttempts: [
        { purpose: "v4_atomic_plan", status: "success", provider: "deepseek", model: "deepseek-v4-pro" },
        { purpose: "v4_claim_composition", status: "success", provider: "deepseek", model: "deepseek-v4-pro" },
        { purpose: "v4_claim_validation", status: "success", provider: "deepseek", model: "deepseek-v4-pro" },
      ],
    },
    independentJudge: true,
    humanNeedOutcomes: [
      { needId: "need-1", expectedDisposition: "answer", expectedRouteKey: null, v3AnswerCompleteness: "fully_resolved", v4AnswerCompleteness: "fully_resolved", v3RouteKey: null, v4RouteKey: null },
      { needId: "need-2", expectedDisposition: "route", expectedRouteKey: "sales_policy", v3AnswerCompleteness: "not_answered", v4AnswerCompleteness: "not_answered", v3RouteKey: "sales_policy", v4RouteKey: "sales_policy" },
    ],
    scoreProvenance: {
      kind: "human",
      scorerId: `reviewer-${caseId}`,
      scoredAt: "2026-07-22T01:00:00.000Z",
      methodology: "Blind need-level review.",
      sourceRunId: "paired-approved",
      sourceDatasetSha256: "a".repeat(64),
      sourceCodeSha256: "c".repeat(64),
      sourceKnowledgeVersion: "knowledge-1",
      sourceApprovedSuiteManifestSha256: promotionManifestSha256,
      sourceV3EffectiveCorpusSha256: v3CorpusSha256,
      sourceV4EffectiveCorpusSha256: v4CorpusSha256,
      sourceArtifactSha256: "4".repeat(64),
      humanScoreBundleSha256: "5".repeat(64),
    },
    evaluationContext: {
      ...validGoldContext,
      goldNeeds: [
        { id: "need-1", text: "Answer the governed need.", expectedDisposition: "answer", expectedRouteKey: null, policyIds: ["policy-1"], blockedTopicIds: [], goldContext: [], blockedContext: [] },
        { id: "need-2", text: "Route the unresolved need.", expectedDisposition: "route", expectedRouteKey: "sales_policy", policyIds: [], blockedTopicIds: ["block-1"], goldContext: [], blockedContext: [] },
      ],
      suiteRole: role,
      suiteId: promotionManifest.suiteId,
      suiteManifestSha256: promotionManifestSha256,
      suiteStrata: promotionManifest.cases.find((entry) => entry.caseId === caseId)?.strata,
      executionOrder: run % 2 ? "v3-first" : "v4-first",
    },
  })));
}

describe("Ask Sales V4 fair evaluation", () => {
  it("credits an appropriate route and a useful partial instead of treating route as failure", () => {
    const items: V4PairedEvaluationItem[] = [{
      preferred: "v4",
      v3: {
        latencyMs: 100,
        score: { totalNeeds: 2, fullyResolvedNeeds: 0, usefulPartialNeeds: 0, appropriatelyRoutedNeeds: 0, falseAbstainedNeeds: 2, routedNeeds: 2, correctlyRoutedNeeds: 0, unsupportedClaimCount: 0, criticalUnsupportedClaimCount: 0, routeWasUsed: true, routeWasAppropriate: false, technicalFailure: false, assessment: "Unnecessary full route." },
      },
      v4: {
        latencyMs: 120,
        lane: "partial",
        score: { totalNeeds: 2, fullyResolvedNeeds: 1, usefulPartialNeeds: 0, appropriatelyRoutedNeeds: 1, falseAbstainedNeeds: 0, routedNeeds: 1, correctlyRoutedNeeds: 1, unsupportedClaimCount: 0, criticalUnsupportedClaimCount: 0, routeWasUsed: true, routeWasAppropriate: true, technicalFailure: false, assessment: "Answered one need and correctly routed one." },
      },
    }];
    const summary = summarizeV4PairedEvaluation(items);
    expect(summary.v4.weightedNeedUtility).toBe(100);
    expect(summary.v4.routePrecision).toBe(100);
    expect(summary.v3.weightedNeedUtility).toBe(0);
  });

  it("applies half credit to a materially useful partial need", () => {
    const score = { totalNeeds: 1, fullyResolvedNeeds: 0, usefulPartialNeeds: 1, appropriatelyRoutedNeeds: 0, falseAbstainedNeeds: 0, routedNeeds: 1, correctlyRoutedNeeds: 1, unsupportedClaimCount: 0, criticalUnsupportedClaimCount: 0, routeWasUsed: true, routeWasAppropriate: true, technicalFailure: false, assessment: "Useful partial." };
    const summary = summarizeV4PairedEvaluation([{ preferred: "tie", v3: { latencyMs: 10, score }, v4: { latencyMs: 10, lane: "partial", score } }]);
    expect(summary.v4.weightedNeedUtility).toBe(50);
  });

  it("rejects malformed numeric and boolean judge fields instead of coercing them", () => {
    expect(() => parseV4SystemJudgeScore(rawScore({ total_needs: "2" }))).toThrow(/integer/);
    expect(() => parseV4SystemJudgeScore(rawScore({ route_was_used: "false" }))).toThrow(/JSON boolean/);
    expect(() => parseV4SystemJudgeScore(rawScore({ fully_resolved_needs: 1.5 }))).toThrow(/integer/);
    expect(() => parseV4SystemJudgeScore(rawScore({ fully_resolved_needs: 2, appropriately_routed_needs: 1 }))).toThrow(/without omissions or double counting/);
    expect(() => parseV4SystemJudgeScore(rawScore({ fully_resolved_needs: 0, appropriately_routed_needs: 1 }))).toThrow(/without omissions or double counting/);
    expect(() => parseV4SystemJudgeScore(rawScore({ unsupported_claim_count: 0, critical_unsupported_claim_count: 1 }))).toThrow(/integer/);
  });

  it("accepts exact JSON invariants without changing the judge's counts", () => {
    expect(parseV4SystemJudgeScore(rawScore())).toEqual({
      totalNeeds: 2,
      fullyResolvedNeeds: 1,
      usefulPartialNeeds: 0,
      appropriatelyRoutedNeeds: 1,
      falseAbstainedNeeds: 0,
      routedNeeds: 1,
      correctlyRoutedNeeds: 1,
      unsupportedClaimCount: 0,
      criticalUnsupportedClaimCount: 0,
      routeWasUsed: true,
      routeWasAppropriate: true,
      technicalFailure: false,
      assessment: "Valid.",
    });
  });

  it("fails the promotion gate on any V4 critical unsupported claim", () => {
    const safe: V4SystemJudgeScore = parseV4SystemJudgeScore(rawScore());
    const unsafe: V4SystemJudgeScore = parseV4SystemJudgeScore(rawScore({
      unsupported_claim_count: 1,
      critical_unsupported_claim_count: 1,
    }));
    const items: V4PairedEvaluationItem[] = [{
      preferred: "v3",
      v3: { latencyMs: 10, score: safe, source: "fresh_runtime" },
      v4: { latencyMs: 10, lane: "answer", score: unsafe },
      independentJudge: true,
      evaluationContext: validGoldContext,
    }];
    const gate = evaluateV4PromotionGate(items, { requireModelBacked: false });
    expect(gate.passed).toBe(false);
    expect(gate.failures).toEqual(expect.arrayContaining([expect.stringMatching(/critical unsupported/)]));
  });

  it("requires adjudicated gold, an independent judge, and meaningful quality thresholds", () => {
    const safe: V4SystemJudgeScore = parseV4SystemJudgeScore(rawScore());
    const ungrounded = evaluateV4PromotionGate([{
      preferred: "v4",
      v3: { latencyMs: 10, score: safe },
      v4: { latencyMs: 10, lane: "answer", score: safe },
      independentJudge: false,
      evaluationContext: { goldAdjudicated: false, goldPolicyIds: [], blockedTopicIds: [], goldContext: [], blockedContext: [], sameKnowledgeSnapshot: false },
    }], { requireModelBacked: false });
    expect(ungrounded.passed).toBe(false);
    expect(ungrounded.failures).toEqual(expect.arrayContaining([
      expect.stringMatching(/independently adjudicated.*gold/),
      expect.stringMatching(/judge independent/),
      expect.stringMatching(/different source knowledge versions/),
    ]));

    const passing = evaluateV4PromotionGate([{
      ...runIdentity,
      preferred: "v4",
      v3: { latencyMs: 10, score: parseV4SystemJudgeScore(rawScore({ fully_resolved_needs: 0, appropriately_routed_needs: 1, false_abstained_needs: 1 })), source: "fresh_runtime" },
      v4: { latencyMs: 10, lane: "answer", score: safe },
      independentJudge: true,
      evaluationContext: validGoldContext,
    }], { requireModelBacked: false });
    expect(passing.status).toBe("diagnostic_only");
    expect(passing.passed).toBe(false);
  });

  it("does not claim a promotion pass when judgments are missing", () => {
    const gate = evaluateV4PromotionGate([{
      preferred: "not_judged",
      v3: { latencyMs: 10, score: null },
      v4: { latencyMs: 10, lane: "route", score: null },
    }]);
    expect(gate.status).toBe("not_evaluated");
    expect(gate.passed).toBe(false);
  });

  it("binds independent human scores to a reproducible run manifest", () => {
    const digest = "a".repeat(64);
    const parsed = parseV4HumanScoreBundle({
      schemaVersion: 4,
      sourceRunId: "paired-fixed",
      sourceArtifactSha256: digest,
      sourceDatasetSha256: digest,
      sourceCodeSha256: digest,
      sourceKnowledgeVersion: "knowledge-1",
      sourceV3EffectiveCorpusSha256: digest,
      sourceV4EffectiveCorpusSha256: digest,
      sourceApprovedSuiteManifestSha256: null,
      scores: [{
        id: "case-1-run-1",
        v3AnswerSha256: digest,
        v4AnswerSha256: digest,
        v3Runtime: { lane: "route_from_evidence", needsRoute: true, routeKeys: ["sales_policy"] },
        v4Runtime: { lane: "partial", needsRoute: true, routeKeys: ["sales_policy"] },
        v3Score: rawScore(),
        v4Score: rawScore(),
        preferred: "tie",
        comparisonReason: "Both answers satisfy the same two needs.",
        scorer: {
          id: "reviewer-1",
          adjudicatedAt: "2026-07-21T18:00:00.000Z",
          methodology: "Blind need-level human adjudication against governed evidence.",
          independentFromSystems: true,
        },
        needOutcomes: [
          { needId: "need-1", expectedDisposition: "answer", expectedRouteKey: null, v3AnswerCompleteness: "fully_resolved", v4AnswerCompleteness: "fully_resolved", v3RouteKey: null, v4RouteKey: null },
          { needId: "need-2", expectedDisposition: "route", expectedRouteKey: "sales_policy", v3AnswerCompleteness: "not_answered", v4AnswerCompleteness: "not_answered", v3RouteKey: "sales_policy", v4RouteKey: "sales_policy" },
        ],
      }],
    });
    expect(parsed.scores[0].v4Score.totalNeeds).toBe(2);
    expect(parsed.scores[0].scorer.independentFromSystems).toBe(true);
    expect(() => parseV4HumanScoreBundle({
      ...parsed,
      scores: [{ ...parsed.scores[0], scorer: { ...parsed.scores[0].scorer, independentFromSystems: false } }],
    })).toThrow(/independentFromSystems/);
  });

  it("infers fresh and mixed comparison modes from actual stored-answer coverage", () => {
    const digestA = "a".repeat(64);
    const digestB = "b".repeat(64);
    expect(inferV4ComparisonMode({ forceFreshV3: false, promptsWithStoredProduction: 0, totalPrompts: 78, v3EffectiveCorpusSha256: digestA, v4EffectiveCorpusSha256: digestA })).toBe("same_effective_corpus_fresh_v3_vs_v4_architecture_only");
    expect(inferV4ComparisonMode({ forceFreshV3: true, promptsWithStoredProduction: 78, totalPrompts: 78, v3EffectiveCorpusSha256: digestA, v4EffectiveCorpusSha256: digestB })).toBe("different_effective_corpora_fresh_v3_vs_v4_end_to_end");
    expect(inferV4ComparisonMode({ forceFreshV3: false, promptsWithStoredProduction: 40, totalPrompts: 78 })).toBe("mixed_stored_and_fresh_v3_diagnostic");
    expect(inferV4ComparisonMode({ forceFreshV3: false, promptsWithStoredProduction: 78, totalPrompts: 78 })).toBe("historical_user_experience_replay");
  });

  it("requires model-backed answer stages and rejects a deterministic fallback", () => {
    const safe = parseV4SystemJudgeScore(rawScore());
    const gate = evaluateV4PromotionGate([{
      id: "case-1-run-1",
      caseId: "case-1",
      run: 1,
      preferred: "v4",
      v3: { latencyMs: 10, score: safe, source: "fresh_runtime" },
      v4: {
        latencyMs: 10,
        lane: "answer",
        score: safe,
        executionMode: { planning: "deterministic_fallback", composition: "exact_evidence", validation: "deterministic_exact_evidence" },
        providerAttempts: [],
      },
      independentJudge: true,
      evaluationContext: validGoldContext,
    }]);
    expect(gate.failures).toEqual(expect.arrayContaining([expect.stringMatching(/not fully model-backed/)]));
  });

  it("accepts exact deterministic-governed provenance as the audited non-model exception", () => {
    const safe = parseV4SystemJudgeScore(rawScore());
    const gate = evaluateV4PromotionGate([{
      id: "case-1-run-1",
      caseId: "case-1",
      run: 1,
      preferred: "v4",
      v3: { latencyMs: 10, score: safe, source: "fresh_runtime" },
      v4: {
        latencyMs: 10,
        lane: "answer",
        score: safe,
        selectedPolicyIds: ["owner-governed-policy"],
        executionMode: { planning: "deterministic_governed", composition: "exact_evidence", validation: "deterministic_exact_evidence" },
        providerAttempts: [],
      },
      independentJudge: true,
      evaluationContext: validGoldContext,
    }], { minimumRuns: 1 });
    expect(gate).toMatchObject({ status: "diagnostic_only", passed: false });
  });

  it("rejects malformed deterministic-governed provenance", () => {
    const safe = parseV4SystemJudgeScore(rawScore());
    const gate = evaluateV4PromotionGate([{
      id: "case-1-run-1",
      caseId: "case-1",
      run: 1,
      preferred: "v4",
      v3: { latencyMs: 10, score: safe, source: "fresh_runtime" },
      v4: {
        latencyMs: 10,
        lane: "answer",
        score: safe,
        executionMode: { planning: "deterministic_governed", composition: "model", validation: "model_and_deterministic" },
        providerAttempts: [{ purpose: "v4_claim_composition", status: "success", provider: "deepseek", model: "deepseek-v4-pro" }],
      },
      independentJudge: true,
      evaluationContext: validGoldContext,
    }], { minimumRuns: 1 });
    expect(gate.failures).toEqual(expect.arrayContaining([expect.stringMatching(/not fully model-backed/)]));
  });

  it("accepts complete model-stage provenance when every other gate is satisfied", () => {
    const safe = parseV4SystemJudgeScore(rawScore());
    const gate = evaluateV4PromotionGate([{
      id: "case-1-run-1",
      caseId: "case-1",
      run: 1,
      preferred: "v4",
      v3: { latencyMs: 10, score: safe, source: "fresh_runtime" },
      v4: {
        latencyMs: 10,
        lane: "answer",
        score: safe,
        executionMode: { planning: "model", composition: "model", validation: "model_and_deterministic" },
        providerAttempts: [
          { purpose: "v4_atomic_plan", status: "success" },
          { purpose: "v4_claim_composition", status: "success" },
          { purpose: "v4_claim_validation", status: "success" },
        ],
      },
      independentJudge: true,
      evaluationContext: validGoldContext,
    }], { minimumRuns: 1 });
    expect(gate).toMatchObject({ status: "diagnostic_only", passed: false });
  });

  it("evaluates worst-run thresholds instead of hiding a weak repeat in the aggregate", () => {
    const good = parseV4SystemJudgeScore(rawScore());
    const weak = parseV4SystemJudgeScore(rawScore({ fully_resolved_needs: 0, appropriately_routed_needs: 0, false_abstained_needs: 2 }));
    const items: V4PairedEvaluationItem[] = [1, 2].map((run) => ({
      id: `case-1-run-${run}`,
      caseId: "case-1",
      run,
      preferred: "v4",
      v3: { latencyMs: 10, score: weak },
      v4: { latencyMs: 10, lane: "answer", score: run === 1 ? good : weak },
      independentJudge: true,
      evaluationContext: validGoldContext,
    }));
    const summary = summarizeV4Runs(items);
    expect(summary.runCount).toBe(2);
    expect(summary.stability.v4WeightedNeedUtilitySpread).toBe(100);
    const gate = evaluateV4PromotionGate(items, { minimumRuns: 2, requireModelBacked: false, maximumUtilitySpread: 5 });
    expect(gate.failures).toEqual(expect.arrayContaining([
      expect.stringMatching(/Run 2 V4 weighted need utility/),
      expect.stringMatching(/spread across runs/),
    ]));
  });

  it("rejects inconsistent need-level route counts", () => {
    expect(() => parseV4SystemJudgeScore(rawScore({ routed_need_count: 0, correctly_routed_need_count: 0 }))).toThrow(/route_was_used must match/);
    expect(() => parseV4SystemJudgeScore(rawScore({ correctly_routed_need_count: 0 }))).toThrow(/route_was_appropriate must match/);
    expect(() => parseV4SystemJudgeScore(rawScore({ routed_need_count: 1, correctly_routed_need_count: 0, route_was_appropriate: false }))).toThrow(/appropriately_routed_needs cannot exceed/);
  });

  it("keeps answer completeness and extra routing orthogonal", () => {
    const digest = "a".repeat(64);
    const routedButAnswered = rawScore({
      fully_resolved_needs: 2,
      appropriately_routed_needs: 0,
      routed_need_count: 1,
      correctly_routed_need_count: 0,
      route_was_appropriate: false,
    });
    const parsed = parseV4HumanScoreBundle({
      schemaVersion: 4,
      sourceRunId: "paired-fixed",
      sourceArtifactSha256: digest,
      sourceDatasetSha256: digest,
      sourceCodeSha256: digest,
      sourceKnowledgeVersion: "knowledge-1",
      sourceV3EffectiveCorpusSha256: digest,
      sourceV4EffectiveCorpusSha256: digest,
      sourceApprovedSuiteManifestSha256: null,
      scores: [{
        id: "case-1-run-1",
        v3AnswerSha256: digest,
        v4AnswerSha256: digest,
        v3Runtime: { lane: "answer", needsRoute: false, routeKeys: [] },
        v4Runtime: { lane: "partial", needsRoute: true, routeKeys: ["sales_policy"] },
        v3Score: rawScore({ fully_resolved_needs: 2, appropriately_routed_needs: 0, routed_need_count: 0, correctly_routed_need_count: 0, route_was_used: false, route_was_appropriate: null }),
        v4Score: routedButAnswered,
        preferred: "tie",
        comparisonReason: "Both answers are complete; V4 also added an unnecessary route.",
        scorer: {
          id: "reviewer-1",
          adjudicatedAt: "2026-07-21T18:00:00.000Z",
          methodology: "Blind review.",
          independentFromSystems: true,
        },
        needOutcomes: [
          { needId: "need-1", expectedDisposition: "answer", expectedRouteKey: null, v3AnswerCompleteness: "fully_resolved", v4AnswerCompleteness: "fully_resolved", v3RouteKey: null, v4RouteKey: "sales_policy" },
          { needId: "need-2", expectedDisposition: "answer", expectedRouteKey: null, v3AnswerCompleteness: "fully_resolved", v4AnswerCompleteness: "fully_resolved", v3RouteKey: null, v4RouteKey: null },
        ],
      }],
    });
    expect(parsed.scores[0].v4Score.fullyResolvedNeeds).toBe(2);
    expect(parsed.scores[0].v4Score.correctlyRoutedNeeds).toBe(0);
  });

  it("allows a recovered provider retry but limits retry instability", () => {
    const safe = parseV4SystemJudgeScore(rawScore());
    const item: V4PairedEvaluationItem = {
      id: "case-1-run-1",
      caseId: "case-1",
      run: 1,
      preferred: "v4",
      v3: { latencyMs: 10, score: safe, source: "fresh_runtime" },
      v4: {
        latencyMs: 10,
        lane: "answer",
        score: safe,
        executionMode: { planning: "model", composition: "model", validation: "model_and_deterministic" },
        providerAttempts: [
          { purpose: "v4_atomic_plan", status: "failed" },
          { purpose: "v4_atomic_plan", status: "success" },
          { purpose: "v4_claim_composition", status: "success" },
          { purpose: "v4_claim_validation", status: "success" },
        ],
      },
      independentJudge: true,
      evaluationContext: validGoldContext,
    };
    expect(evaluateV4PromotionGate([item], { minimumRuns: 1, maximumRecoveredRetryRate: 100 }).status).toBe("diagnostic_only");
    expect(evaluateV4PromotionGate([item], { minimumRuns: 1, maximumRecoveredRetryRate: 0 }).failures).toEqual(expect.arrayContaining([expect.stringMatching(/recovered-retry rate/)]));
  });

  it("does not treat an earlier success as recovery for a later failed stage", () => {
    const safe = parseV4SystemJudgeScore(rawScore());
    const item: V4PairedEvaluationItem = {
      id: "case-1-run-1",
      caseId: "case-1",
      run: 1,
      preferred: "v4",
      v3: { latencyMs: 10, score: safe, source: "fresh_runtime" },
      v4: {
        latencyMs: 10,
        lane: "answer",
        score: safe,
        executionMode: { planning: "model", composition: "model", validation: "model_and_deterministic" },
        providerAttempts: [
          { purpose: "v4_atomic_plan", status: "success" },
          { purpose: "v4_atomic_plan", status: "failed" },
          { purpose: "v4_claim_composition", status: "success" },
          { purpose: "v4_claim_validation", status: "success" },
        ],
      },
      independentJudge: true,
      evaluationContext: validGoldContext,
    };
    const summary = summarizeV4PairedEvaluation([item]);
    expect(summary.v4ProviderReliability).toMatchObject({ unrecoveredFailedAttempts: 1, affectedCases: 1, affectedStages: 1 });
    expect(summary.v4ProviderReliability.stages[0]).toMatchObject({ recovered: false, recoveryAttemptIndex: null });
    expect(evaluateV4PromotionGate([item]).failures).toEqual(expect.arrayContaining([expect.stringMatching(/failed without a successful recovery/)]));
  });

  it("gates the raw utility fraction even when the display value rounds to 90 percent", () => {
    const full = parseV4SystemJudgeScore(rawScore({
      total_needs: 20,
      fully_resolved_needs: 20,
      appropriately_routed_needs: 0,
      routed_need_count: 0,
      correctly_routed_need_count: 0,
      route_was_used: false,
      route_was_appropriate: null,
    }));
    const almostFull = parseV4SystemJudgeScore(rawScore({
      total_needs: 20,
      fully_resolved_needs: 19,
      useful_partial_needs: 1,
      appropriately_routed_needs: 0,
      routed_need_count: 0,
      correctly_routed_need_count: 0,
      route_was_used: false,
      route_was_appropriate: null,
    }));
    const empty = parseV4SystemJudgeScore(rawScore({
      total_needs: 20,
      fully_resolved_needs: 0,
      appropriately_routed_needs: 0,
      false_abstained_needs: 20,
      routed_need_count: 0,
      correctly_routed_need_count: 0,
      route_was_used: false,
      route_was_appropriate: null,
    }));
    const scores = [...Array.from({ length: 44 }, () => full), almostFull, ...Array.from({ length: 5 }, () => empty)];
    const items = scores.map((score, index): V4PairedEvaluationItem => ({
      id: `raw-${index + 1}-run-1`,
      caseId: `raw-${index + 1}`,
      run: 1,
      preferred: "tie",
      v3: { latencyMs: 1, score, source: "fresh_runtime" },
      v4: { latencyMs: 1, lane: "answer", score },
      independentJudge: true,
      evaluationContext: { ...validGoldContext, goldNeedCount: 20, goldNeedIds: Array.from({ length: 20 }, (_, needIndex) => `need-${needIndex + 1}`) },
    }));
    const summary = summarizeV4PairedEvaluation(items);
    expect(summary.v4.weightedNeedUtility).toBe(90);
    expect(summary.v4.rawRatios.weightedNeedUtility).toEqual({ numerator: 1799, denominator: 2000 });
    expect(evaluateV4PromotionGate(items, { requireModelBacked: false }).failures).toEqual(expect.arrayContaining([
      expect.stringMatching(/weighted need utility must be at least 90%; observed 90%/),
    ]));
  });

  it("fails stale V3 sources and excessive V4 p95 latency", () => {
    const safe = parseV4SystemJudgeScore(rawScore());
    const gate = evaluateV4PromotionGate([{
      preferred: "v4",
      v3: { latencyMs: 10, score: safe, source: "stored_production" },
      v4: { latencyMs: 46_000, lane: "answer", score: safe },
      independentJudge: true,
      evaluationContext: validGoldContext,
    }], { requireModelBacked: false, maximumV4P95LatencyMs: 45_000 });
    expect(gate.failures).toEqual(expect.arrayContaining([
      expect.stringMatching(/do not use fresh V3/),
      expect.stringMatching(/p95 latency/),
    ]));
  });

  it("requires an immutable approved suite with both retained and holdout roles", () => {
    expect(promotionManifest.cases.filter((item) => item.role === "retained")).toHaveLength(50);
    expect(promotionManifest.cases.filter((item) => item.role === "holdout")).toHaveLength(10);
    expect(() => parseV4ApprovedPromotionSuiteManifest({
      ...promotionManifest,
      cases: [{ caseId: "retained-only", role: "retained", strata: [...V4_CANONICAL_REQUIRED_STRATA] }],
    })).toThrow(/at least 50 retained and 10 holdout/);

    const gate = evaluateV4PromotionGate(canonicalPromotionItems(), canonicalOptions);
    expect(gate).toMatchObject({ status: "pass", passed: true, judgedCases: 180 });

    const missingSuite = evaluateV4PromotionGate(canonicalPromotionItems(), {
      enforceCanonicalThresholds: true,
    });
    expect(missingSuite.failures).toEqual(expect.arrayContaining([expect.stringMatching(/immutable approved-suite manifest/)]));
  });

  it("does not let strong retained results mask weak holdout quality", () => {
    const strongRetained = parseV4SystemJudgeScore(rawScore({
      total_needs: 20,
      fully_resolved_needs: 20,
      appropriately_routed_needs: 0,
      routed_need_count: 0,
      correctly_routed_need_count: 0,
      route_was_used: false,
      route_was_appropriate: null,
    }));
    const weakHoldout = parseV4SystemJudgeScore(rawScore({
      total_needs: 1,
      fully_resolved_needs: 0,
      appropriately_routed_needs: 0,
      false_abstained_needs: 1,
      routed_need_count: 0,
      correctly_routed_need_count: 0,
      route_was_used: false,
      route_was_appropriate: null,
    }));
    const items = canonicalPromotionItems().map((item) => {
      const isHoldout = item.evaluationContext?.suiteRole === "holdout";
      const score = isHoldout ? weakHoldout : strongRetained;
      return {
        ...item,
        preferred: isHoldout ? "tie" as const : "v4" as const,
        v3: { ...item.v3, score },
        v4: { ...item.v4, score },
        evaluationContext: {
          ...item.evaluationContext!,
          goldNeedCount: score.totalNeeds,
          goldNeedIds: Array.from({ length: score.totalNeeds }, (_, index) => `need-${index + 1}`),
        },
      };
    });

    const aggregate = summarizeV4PairedEvaluation(items);
    expect(aggregate.v4.weightedNeedUtility).toBe(99);
    expect(aggregate.v4.falseAbstentionRate).toBe(1);
    expect(summarizeV4Runs(items).runs.every((run) =>
      run.summary.v4.weightedNeedUtility! >= 90 && run.summary.v4.falseAbstentionRate! <= 5,
    )).toBe(true);

    const gate = evaluateV4PromotionGate(items, { enforceCanonicalThresholds: true, approvedSuite });
    expect(gate.failures).toEqual(expect.arrayContaining([
      expect.stringMatching(/Holdout aggregate V4 weighted need utility must be at least 90%; observed 0%/),
      expect.stringMatching(/Holdout aggregate V4 false-abstention rate must be at most 5%; observed 100%/),
      expect.stringMatching(/Run 1 holdout V4 weighted need utility must be at least 90%; observed 0%/),
    ]));
  });

  it("enforces holdout thresholds within every repeated run", () => {
    const strong = parseV4SystemJudgeScore(rawScore({
      total_needs: 20,
      fully_resolved_needs: 20,
      appropriately_routed_needs: 0,
      routed_need_count: 0,
      correctly_routed_need_count: 0,
      route_was_used: false,
      route_was_appropriate: null,
    }));
    const weakHoldoutRepeat = parseV4SystemJudgeScore(rawScore({
      total_needs: 20,
      fully_resolved_needs: 18,
      appropriately_routed_needs: 0,
      false_abstained_needs: 2,
      routed_need_count: 0,
      correctly_routed_need_count: 0,
      route_was_used: false,
      route_was_appropriate: null,
    }));
    const items = canonicalPromotionItems().map((item) => {
      const weakRepeat = item.evaluationContext?.suiteRole === "holdout" && item.run === 3;
      const score = weakRepeat ? weakHoldoutRepeat : strong;
      return {
        ...item,
        preferred: weakRepeat ? "tie" as const : "v4" as const,
        v3: { ...item.v3, score },
        v4: { ...item.v4, score },
        evaluationContext: {
          ...item.evaluationContext!,
          goldNeedCount: 20,
          goldNeedIds: Array.from({ length: 20 }, (_, index) => `need-${index + 1}`),
        },
      };
    });

    const holdoutAggregate = summarizeV4PairedEvaluation(items.filter((item) => item.caseId === "holdout-case"));
    expect(holdoutAggregate.v4.weightedNeedUtility).toBe(96.7);
    expect(holdoutAggregate.v4.falseAbstentionRate).toBe(3.3);
    expect(summarizeV4Runs(items).runs.every((run) =>
      run.summary.v4.weightedNeedUtility! >= 90 && run.summary.v4.falseAbstentionRate! <= 5,
    )).toBe(true);

    const gate = evaluateV4PromotionGate(items, { enforceCanonicalThresholds: true, approvedSuite });
    expect(gate.failures).toEqual(expect.arrayContaining([
      expect.stringMatching(/Run 3 holdout V4 false-abstention rate must be at most 5%; observed 10%/),
      expect.stringMatching(/Holdout V4 weighted-utility spread across runs must be at most 5 points; observed 10/),
      expect.stringMatching(/Holdout V4 false-abstention spread across runs must be at most 5 points; observed 10/),
    ]));
  });

  it("does not allow callers to relax canonical enforced thresholds", () => {
    const slow = canonicalPromotionItems().map((item) => ({ ...item, v4: { ...item.v4, latencyMs: 46_000 } }));
    const gate = evaluateV4PromotionGate(slow, {
      enforceCanonicalThresholds: true,
      approvedSuite,
      minimumRuns: 1,
      maximumV4P95LatencyMs: 120_000,
      maximumRecoveredRetryRate: 100,
    });
    expect(gate.failures).toEqual(expect.arrayContaining([expect.stringMatching(/at most 45000ms/)]));

    const firstRun = canonicalPromotionItems().filter((item) => item.run === 1);
    const fourRuns = [
      ...canonicalPromotionItems(),
      ...firstRun.map((item) => ({ ...item, run: 4, id: `${item.caseId}-run-4` })),
    ];
    expect(evaluateV4PromotionGate(fourRuns, {
      enforceCanonicalThresholds: true,
      approvedSuite,
      minimumRuns: 1,
    }).failures).toEqual(expect.arrayContaining([expect.stringMatching(/exactly 3 complete run/)]));
  });

  it("invalidates an unhealthy or provider-mismatched V3 baseline", () => {
    const unhealthy = canonicalPromotionItems();
    unhealthy[0] = { ...unhealthy[0], v3: { ...unhealthy[0].v3, errorClass: "v3_provider_failure" } };
    expect(evaluateV4PromotionGate(unhealthy, { enforceCanonicalThresholds: true, approvedSuite }).failures)
      .toEqual(expect.arrayContaining([expect.stringMatching(/unhealthy V3 baseline/)]));

    const mismatched = canonicalPromotionItems();
    mismatched[0] = { ...mismatched[0], v4: { ...mismatched[0].v4, model: "different-model" } };
    expect(evaluateV4PromotionGate(mismatched, { enforceCanonicalThresholds: true, approvedSuite }).failures)
      .toEqual(expect.arrayContaining([expect.stringMatching(/approved provider\/model/)]));
  });

  it("enforces retry stability separately for every repeated run", () => {
    const items = canonicalPromotionItems();
    const runTwoIndexes = items.flatMap((item, index) => item.run === 2 ? [index] : []).slice(0, 4);
    for (const runTwoIndex of runTwoIndexes) {
      items[runTwoIndex] = {
        ...items[runTwoIndex],
        v4: {
          ...items[runTwoIndex].v4,
          providerAttempts: [
            { purpose: "v4_atomic_plan", status: "failed", provider: "deepseek", model: "deepseek-v4-pro" },
            ...(items[runTwoIndex].v4.providerAttempts || []),
          ],
        },
      };
    }
    const gate = evaluateV4PromotionGate(items, canonicalOptions);
    expect(gate.failures).toEqual(expect.arrayContaining([expect.stringMatching(/Run 2 recovered-retry rate/)]));
  });

  it("requires the exact same stable case IDs in every repeated run", () => {
    const safe = parseV4SystemJudgeScore(rawScore());
    const items: V4PairedEvaluationItem[] = [
      { id: "case-a-run-1", caseId: "case-a", run: 1, preferred: "v4", v3: { latencyMs: 1, score: safe, source: "fresh_runtime" }, v4: { latencyMs: 1, lane: "answer", score: safe }, independentJudge: true, evaluationContext: validGoldContext },
      { id: "case-b-run-2", caseId: "case-b", run: 2, preferred: "v4", v3: { latencyMs: 1, score: safe, source: "fresh_runtime" }, v4: { latencyMs: 1, lane: "answer", score: safe }, independentJudge: true, evaluationContext: validGoldContext },
    ];
    const gate = evaluateV4PromotionGate(items, { minimumRuns: 2, requireModelBacked: false });
    expect(gate.failures).toEqual(expect.arrayContaining([expect.stringMatching(/exact same case IDs/)]));
  });
});

import { describe, expect, it } from "vitest";
import {
  evaluateV4PromotionGate,
  inferV4ComparisonMode,
  parseV4HumanScoreBundle,
  parseV4SystemJudgeScore,
  summarizeV4PairedEvaluation,
  summarizeV4Runs,
  type V4PairedEvaluationItem,
  type V4SystemJudgeScore,
} from "@/lib/ask-sales-faq/v4/evaluation";

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
  executionOrder: "v3-first",
};

function rawScore(overrides: Record<string, unknown> = {}) {
  return {
    total_needs: 2,
    fully_resolved_needs: 1,
    useful_partial_needs: 0,
    appropriately_routed_needs: 1,
    false_abstained_needs: 0,
    unsupported_claim_count: 0,
    critical_unsupported_claim_count: 0,
    route_was_used: true,
    route_was_appropriate: true,
    technical_failure: false,
    assessment: "Valid.",
    ...overrides,
  };
}

describe("Ask Sales V4 fair evaluation", () => {
  it("credits an appropriate route and a useful partial instead of treating route as failure", () => {
    const items: V4PairedEvaluationItem[] = [{
      preferred: "v4",
      v3: {
        latencyMs: 100,
        score: { totalNeeds: 2, fullyResolvedNeeds: 0, usefulPartialNeeds: 0, appropriatelyRoutedNeeds: 0, falseAbstainedNeeds: 2, unsupportedClaimCount: 0, criticalUnsupportedClaimCount: 0, routeWasUsed: true, routeWasAppropriate: false, technicalFailure: false, assessment: "Unnecessary full route." },
      },
      v4: {
        latencyMs: 120,
        lane: "partial",
        score: { totalNeeds: 2, fullyResolvedNeeds: 1, usefulPartialNeeds: 0, appropriatelyRoutedNeeds: 1, falseAbstainedNeeds: 0, unsupportedClaimCount: 0, criticalUnsupportedClaimCount: 0, routeWasUsed: true, routeWasAppropriate: true, technicalFailure: false, assessment: "Answered one need and correctly routed one." },
      },
    }];
    const summary = summarizeV4PairedEvaluation(items);
    expect(summary.v4.weightedNeedUtility).toBe(100);
    expect(summary.v4.routePrecision).toBe(100);
    expect(summary.v3.weightedNeedUtility).toBe(0);
  });

  it("applies half credit to a materially useful partial need", () => {
    const score = { totalNeeds: 1, fullyResolvedNeeds: 0, usefulPartialNeeds: 1, appropriatelyRoutedNeeds: 0, falseAbstainedNeeds: 0, unsupportedClaimCount: 0, criticalUnsupportedClaimCount: 0, routeWasUsed: true, routeWasAppropriate: true, technicalFailure: false, assessment: "Useful partial." };
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
      v3: { latencyMs: 10, score: safe },
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
      expect.stringMatching(/different knowledge snapshots/),
    ]));

    const passing = evaluateV4PromotionGate([{
      preferred: "v4",
      v3: { latencyMs: 10, score: parseV4SystemJudgeScore(rawScore({ fully_resolved_needs: 0, appropriately_routed_needs: 1, false_abstained_needs: 1 })) },
      v4: { latencyMs: 10, lane: "answer", score: safe },
      independentJudge: true,
      evaluationContext: validGoldContext,
    }], { requireModelBacked: false });
    expect(passing.status).toBe("pass");
    expect(passing.passed).toBe(true);
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
      schemaVersion: 1,
      sourceRunId: "paired-fixed",
      sourceDatasetSha256: digest,
      sourceCodeSha256: digest,
      sourceKnowledgeVersion: "knowledge-1",
      scorer: {
        id: "reviewer-1",
        adjudicatedAt: "2026-07-21T18:00:00.000Z",
        methodology: "Blind need-level human adjudication against governed evidence.",
        independentFromSystems: true,
      },
      scores: [{
        id: "case-1-run-1",
        v3AnswerSha256: digest,
        v4AnswerSha256: digest,
        v3Score: rawScore(),
        v4Score: rawScore(),
        preferred: "tie",
        comparisonReason: "Both answers satisfy the same two needs.",
        needOutcomes: [
          { needId: "need-1", v3: "fully_resolved", v4: "fully_resolved" },
          { needId: "need-2", v3: "appropriately_routed", v4: "appropriately_routed" },
        ],
      }],
    });
    expect(parsed.scores[0].v4Score.totalNeeds).toBe(2);
    expect(parsed.scorer.independentFromSystems).toBe(true);
    expect(() => parseV4HumanScoreBundle({ ...parsed, scorer: { ...parsed.scorer, independentFromSystems: false } })).toThrow(/independentFromSystems/);
  });

  it("infers fresh and mixed comparison modes from actual stored-answer coverage", () => {
    expect(inferV4ComparisonMode({ forceFreshV3: false, promptsWithStoredProduction: 0, totalPrompts: 78 })).toBe("same_current_snapshot_fresh_v3_vs_v4");
    expect(inferV4ComparisonMode({ forceFreshV3: false, promptsWithStoredProduction: 40, totalPrompts: 78 })).toBe("mixed_stored_and_fresh_v3_diagnostic");
    expect(inferV4ComparisonMode({ forceFreshV3: false, promptsWithStoredProduction: 78, totalPrompts: 78 })).toBe("historical_user_experience_replay");
  });

  it("requires model-backed answer stages and rejects a deterministic fallback", () => {
    const safe = parseV4SystemJudgeScore(rawScore());
    const gate = evaluateV4PromotionGate([{
      id: "case-1-run-1",
      run: 1,
      preferred: "v4",
      v3: { latencyMs: 10, score: safe },
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

  it("accepts complete model-stage provenance when every other gate is satisfied", () => {
    const safe = parseV4SystemJudgeScore(rawScore());
    const gate = evaluateV4PromotionGate([{
      id: "case-1-run-1",
      run: 1,
      preferred: "v4",
      v3: { latencyMs: 10, score: safe },
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
    expect(gate).toMatchObject({ status: "pass", passed: true });
  });

  it("evaluates worst-run thresholds instead of hiding a weak repeat in the aggregate", () => {
    const good = parseV4SystemJudgeScore(rawScore());
    const weak = parseV4SystemJudgeScore(rawScore({ fully_resolved_needs: 0, appropriately_routed_needs: 0, false_abstained_needs: 2 }));
    const items: V4PairedEvaluationItem[] = [1, 2].map((run) => ({
      id: `case-1-run-${run}`,
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
});

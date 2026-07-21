import { describe, expect, it } from "vitest";
import {
  evaluateV4PromotionGate,
  parseV4SystemJudgeScore,
  summarizeV4PairedEvaluation,
  type V4PairedEvaluationItem,
  type V4SystemJudgeScore,
} from "@/lib/ask-sales-faq/v4/evaluation";

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
      evaluationContext: { goldAdjudicated: true, goldPolicyIds: ["policy-1"], blockedTopicIds: [], goldContext: [], blockedContext: [], sameKnowledgeSnapshot: true },
    }];
    const gate = evaluateV4PromotionGate(items);
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
    }]);
    expect(ungrounded.passed).toBe(false);
    expect(ungrounded.failures).toEqual(expect.arrayContaining([
      expect.stringMatching(/independently adjudicated gold/),
      expect.stringMatching(/judge independent/),
      expect.stringMatching(/different knowledge snapshots/),
    ]));

    const passing = evaluateV4PromotionGate([{
      preferred: "v4",
      v3: { latencyMs: 10, score: parseV4SystemJudgeScore(rawScore({ fully_resolved_needs: 0, appropriately_routed_needs: 1, false_abstained_needs: 1 })) },
      v4: { latencyMs: 10, lane: "answer", score: safe },
      independentJudge: true,
      evaluationContext: { goldAdjudicated: true, goldPolicyIds: ["policy-1"], blockedTopicIds: [], goldContext: [], blockedContext: [], sameKnowledgeSnapshot: true },
    }]);
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
});

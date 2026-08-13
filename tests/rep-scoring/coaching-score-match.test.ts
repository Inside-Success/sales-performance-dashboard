import { describe, expect, it } from "vitest";
import {
  COACHING_SCORE_SCORER_VERSION,
  selectExactCoachingCallScore,
  type CoachingScoreCandidate,
} from "@/lib/rep-scoring/coaching-score-match";

const valid: CoachingScoreCandidate = {
  id: "assessment-1",
  sourceRecordId: "rec-source-1",
  automationKey: "zoom:meeting:file",
  scorerVersion: COACHING_SCORE_SCORER_VERSION,
  callType: "Call 2+",
  status: "scored",
  score: 82.5,
  internalInconsistency: false,
};

describe("Coaching Call 2 score matching", () => {
  it("reads only the approved V7.1 production scorer", () => {
    expect(COACHING_SCORE_SCORER_VERSION).toBe("rep-reviewer-v7.1-shadow-1");
  });

  it("returns the score only for one exact dual-identifier match", () => {
    expect(selectExactCoachingCallScore({ sourceRecordId: valid.sourceRecordId, automationKey: valid.automationKey, candidates: [valid] }))
      .toEqual({ assessmentId: "assessment-1", score: 82.5 });
  });

  it.each([
    [{ ...valid, sourceRecordId: "other" }],
    [{ ...valid, automationKey: "other" }],
    [{ ...valid, callType: "Call 1" }],
    [{ ...valid, scorerVersion: "older" }],
    [{ ...valid, status: "quarantined" }],
    [{ ...valid, internalInconsistency: true }],
    [{ ...valid, score: null }],
    [valid, { ...valid, id: "duplicate" }],
    [valid, { ...valid, score: 76 }],
  ])("fails closed for mismatched, ineligible, or duplicate candidates", (...candidates) => {
    expect(selectExactCoachingCallScore({ sourceRecordId: valid.sourceRecordId, automationKey: valid.automationKey, candidates }))
      .toBeNull();
  });

  it("collapses retry rows only when immutable identity and score agree", () => {
    expect(selectExactCoachingCallScore({
      sourceRecordId: valid.sourceRecordId,
      automationKey: valid.automationKey,
      candidates: [valid, { ...valid }],
    })).toEqual({ assessmentId: "assessment-1", score: 82.5 });
  });
});

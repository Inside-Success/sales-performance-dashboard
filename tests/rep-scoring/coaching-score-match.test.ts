import { describe, expect, it } from "vitest";
import {
  COACHING_SCORE_SCORER_VERSION,
  COACHING_SCORE_SCORER_VERSIONS,
  selectExactCoachingCallScore,
  type CoachingScoreCandidate,
} from "@/lib/rep-scoring/coaching-score-match";

const valid: CoachingScoreCandidate = {
  latestReviewed: true,
  id: `${COACHING_SCORE_SCORER_VERSION}:rec-source-1`,
  sourceRecordId: "rec-source-1",
  automationKey: "zoom:meeting:file",
  repEmail: "rep@example.com",
  callDate: "2026-09-10T12:00:00Z",
  scorerVersion: COACHING_SCORE_SCORER_VERSION,
  callType: "Call 2+",
  status: "scored",
  score: 82.5,
  internalInconsistency: false,
};

describe("Coaching Call 2 score matching", () => {
  it("reads the approved forward-only scorer and the previous rubric for older reports only", () => {
    expect(COACHING_SCORE_SCORER_VERSION).toBe("magic-mike-call2-evidence-score-v3");
    expect([...COACHING_SCORE_SCORER_VERSIONS]).toEqual(["magic-mike-call2-evidence-score-v3", "magic-mike-call2-evidence-score-v2"]);
  });

  it("shows the previous rubric score for a report that was never scored under the current rubric", () => {
    const previous = { ...valid, id: "magic-mike-call2-evidence-score-v2:rec-source-1", scorerVersion: "magic-mike-call2-evidence-score-v2", score: 61.8 };
    expect(selectExactCoachingCallScore({ sourceRecordId: valid.sourceRecordId, automationKey: valid.automationKey, repEmail: valid.repEmail, callDate: valid.callDate, candidates: [previous] }))
      .toEqual({ assessmentId: previous.id, score: 61.8 });
  });

  it("prefers the current rubric when both versions exist for one call", () => {
    const previous = { ...valid, id: "magic-mike-call2-evidence-score-v2:rec-source-1", scorerVersion: "magic-mike-call2-evidence-score-v2", score: 61.8 };
    expect(selectExactCoachingCallScore({ sourceRecordId: valid.sourceRecordId, automationKey: valid.automationKey, repEmail: valid.repEmail, callDate: valid.callDate, candidates: [previous, valid] }))
      .toEqual({ assessmentId: valid.id, score: 82.5 });
  });

  it("never shows the August v1 rubric to reps", () => {
    const legacy = { ...valid, id: "magic-mike-call2-evidence-score-v1:rec-source-1", scorerVersion: "magic-mike-call2-evidence-score-v1" };
    expect(selectExactCoachingCallScore({ sourceRecordId: valid.sourceRecordId, automationKey: valid.automationKey, repEmail: valid.repEmail, callDate: valid.callDate, candidates: [legacy] })).toBeNull();
  });

  it("returns the score only for an exact source, rep, date and version match", () => {
    expect(selectExactCoachingCallScore({ sourceRecordId: valid.sourceRecordId, automationKey: valid.automationKey, repEmail: valid.repEmail, callDate: valid.callDate, candidates: [valid] }))
      .toEqual({ assessmentId: `${COACHING_SCORE_SCORER_VERSION}:rec-source-1`, score: 82.5 });
  });

  it.each([
    [{ ...valid, latestReviewed: false }],
    [{ ...valid, sourceRecordId: "other" }],
    [{ ...valid, repEmail: "other@example.com" }],
    [{ ...valid, callDate: "2026-09-09T12:00:00Z" }],
    [{ ...valid, callType: "Call 1" }],
    [{ ...valid, scorerVersion: "older" }],
    [{ ...valid, status: "quarantined" }],
    [{ ...valid, internalInconsistency: true }],
    [{ ...valid, score: null }],
    [valid, { ...valid, id: "duplicate" }],
    [valid, { ...valid, score: 76 }],
  ])("fails closed for mismatched, ineligible, or duplicate candidates", (...candidates) => {
    expect(selectExactCoachingCallScore({ sourceRecordId: valid.sourceRecordId, automationKey: valid.automationKey, repEmail: valid.repEmail, callDate: valid.callDate, candidates }))
      .toBeNull();
  });

  it("collapses retry rows only when immutable identity and score agree", () => {
    expect(selectExactCoachingCallScore({
      sourceRecordId: valid.sourceRecordId,
      automationKey: valid.automationKey, repEmail: valid.repEmail, callDate: valid.callDate,
      candidates: [valid, { ...valid }],
    })).toEqual({ assessmentId: `${COACHING_SCORE_SCORER_VERSION}:rec-source-1`, score: 82.5 });
  });
});

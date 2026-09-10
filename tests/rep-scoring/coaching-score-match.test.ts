import { describe, expect, it } from "vitest";
import {
  COACHING_SCORE_SCORER_VERSION,
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
  it("reads only the approved forward-only scorer", () => {
    expect(COACHING_SCORE_SCORER_VERSION).toBe("magic-mike-call2-evidence-score-v2");
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

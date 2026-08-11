import { describe, expect, it } from "vitest";
import { deriveRepSummaries, type RepScoreCall } from "@/lib/rep-scoring/data";

function call(overrides: Partial<RepScoreCall> & Pick<RepScoreCall, "assessmentId" | "repEmail" | "repName" | "callType" | "score">): RepScoreCall {
  return {
    id: overrides.assessmentId,
    idempotencyKey: overrides.assessmentId,
    repId: overrides.repEmail,
    assignedRepEmail: overrides.repEmail,
    assignedRepName: overrides.repName,
    attributionSubstituted: false,
    speakerResolutionMethod: "transcript_roster_assigned_v1",
    callStage: "",
    meetingStartAt: overrides.meetingStartAt || "2026-07-30T12:00:00.000Z",
    showName: "",
    band: "",
    status: "scored",
    confidence: "high",
    transcriptUrl: "",
    dimensions: overrides.dimensions || [],
    behaviours: [],
    criticalEvents: [],
    observations: [],
    evidence: [],
    callContext: {},
    internalInconsistency: false,
    scoredAt: overrides.scoredAt || overrides.meetingStartAt || "2026-07-30T12:00:00.000Z",
    scorerVersion: "rep-reviewer-v3",
    promptVersion: "rep-prompt-v2",
    rubricVersion: "rep-rubric-v1",
    weightsVersion: "rep-weights-v1",
    configVersion: "rep-scoring-config-v4-cumulative",
    model: "deepseek-v4-pro",
    ...overrides,
  };
}

describe("rep scoring aggregation", () => {
  it("weights Call 1 and Call 2+ equally instead of weighting by call volume", () => {
    const calls = [
      call({ assessmentId: "c1", repEmail: "rep@example.com", repName: "Rep", callType: "Call 1", score: 40 }),
      call({ assessmentId: "c2", repEmail: "rep@example.com", repName: "Rep", callType: "Call 2+", score: 80 }),
      call({ assessmentId: "c3", repEmail: "rep@example.com", repName: "Rep", callType: "Call 2+", score: 100 }),
      call({ assessmentId: "c4", repEmail: "rep@example.com", repName: "Rep", callType: "Call 2+", score: 90 }),
    ];

    expect(deriveRepSummaries(calls)[0]).toMatchObject({ call1Score: 40, call2Score: 90, overallScore: 65, nScored: 4 });
  });

  it("orders the lowest cumulative rep score first and marks supported low results", () => {
    const calls = [
      ...[44, 44, 44, 44, 44, 44, 44, 44].map((score, index) => call({ assessmentId: `low-${index}`, repEmail: "low@example.com", repName: "Low", callType: "Call 1", score })),
      ...[80, 85, 90, 90, 85, 80, 90, 85].map((score, index) => call({ assessmentId: `high-${index}`, repEmail: "high@example.com", repName: "High", callType: "Call 1", score })),
    ];

    const summaries = deriveRepSummaries(calls);
    expect(summaries.map((summary) => summary.repName)).toEqual(["Low", "High"]);
    expect(summaries[0]).toMatchObject({ overallScore: 44, needsReview: true, reviewStatus: "needs_attention", rank: 1 });
    expect(summaries[1]).toMatchObject({ overallScore: 85.63, needsReview: false, reviewStatus: "no_recurring_concern", rank: 2 });
  });

  it("does not manufacture weaknesses for a rep whose recurring dimensions meet expectations", () => {
    const calls = Array.from({ length: 10 }, (_, index) => call({
      assessmentId: `strong-${index}`,
      repEmail: "strong@example.com",
      repName: "Strong Rep",
      callType: "Call 1",
      score: 90,
      dimensions: [
        { key: "discovery", band: "Excellent" },
        { key: "qualification", band: "Meets Expectations" },
      ],
    }));

    const summary = deriveRepSummaries(calls)[0];
    expect(summary.coachingPriorities).toEqual([]);
    expect(summary.strengths.map((pattern) => pattern.key)).toEqual(["discovery", "qualification"]);
  });

  it("shows only recurring below-expectation dimensions as coaching concerns", () => {
    const calls = Array.from({ length: 10 }, (_, index) => call({
      assessmentId: `mixed-${index}`,
      repEmail: "mixed@example.com",
      repName: "Mixed Rep",
      callType: "Call 1",
      score: 72,
      dimensions: [
        { key: "discovery", band: index < 3 ? "Needs Improvement" : "Developing" },
        { key: "qualification", band: "Excellent" },
        { key: "authority", band: "Excellent" },
      ],
    }));

    const summary = deriveRepSummaries(calls)[0];
    expect(summary.coachingPriorities.map((pattern) => pattern.key)).toEqual(["discovery"]);
    expect(summary.strengths.map((pattern) => pattern.key)).toEqual(["authority", "qualification"]);
    expect(summary.reviewStatus).toBe("coaching_focus");
    expect(summary.coachingPriorities[0]).toMatchObject({ weakObservations: 3, weakRate: 0.3 });
  });

  it("does not label an ordinary Developing result as needs attention without strong evidence", () => {
    const calls = [0, 1, 2, 3, 4, 5, 6, 7].map((index) => call({
      assessmentId: `developing-${index}`,
      repEmail: "developing@example.com",
      repName: "Developing Rep",
      callType: "Call 1",
      score: 55,
      dimensions: [{ key: "discovery", band: "Developing" }],
    }));

    expect(deriveRepSummaries(calls)[0]).toMatchObject({ needsReview: false, reviewStatus: "no_recurring_concern", coachingPriorities: [] });
  });

  it("uses the stronger 15-call rule for a sustained score below 55", () => {
    const calls = Array.from({ length: 15 }, (_, index) => call({
      assessmentId: `sustained-${index}`,
      repEmail: "sustained@example.com",
      repName: "Sustained Rep",
      callType: "Call 2+",
      score: 54,
    }));

    expect(deriveRepSummaries(calls)[0]).toMatchObject({ needsReview: true, reviewStatus: "needs_attention" });
  });

  it("marks only the lowest 15 percent of a strong-evidence cohort as a comparative manager priority", () => {
    const calls = Array.from({ length: 20 }, (_, repIndex) =>
      Array.from({ length: 15 }, (_, callIndex) => call({
        assessmentId: `relative-${repIndex}-${callIndex}`,
        repEmail: `rep-${repIndex}@example.com`,
        repName: `Rep ${repIndex}`,
        callType: "Call 1",
        score: 70 + repIndex,
      })),
    ).flat();

    const summaries = deriveRepSummaries(calls);
    const priorities = summaries.filter((summary) => summary.relativeReviewPriority);
    expect(priorities).toHaveLength(3);
    expect(priorities.map((summary) => summary.overallScore)).toEqual([70, 71, 72]);
    expect(priorities.every((summary) => !summary.needsReview && summary.reviewStatus === "coaching_focus")).toBe(true);
  });

  it("separates a high-severity call event from the rep performance verdict and links the exact call", () => {
    const calls = [0, 1, 2].map((index) => call({
      assessmentId: `event-${index}`,
      repEmail: "event@example.com",
      repName: "Event Rep",
      callType: "Call 2+",
      score: 80,
      criticalEvents: index === 0 ? [{ name: "Material pricing error", severity: "high", reason: "Incorrect amount stated", timestamp: "00:04:12", speaker: "Rep", quote: "The price is..." }] : [],
    }));

    const summary = deriveRepSummaries(calls)[0];
    expect(summary).toMatchObject({
      needsReview: false,
      criticalConcern: true,
      reviewStatus: "no_recurring_concern",
      criticalEvents: [{ assessmentId: "event-0", name: "Material pricing error", severity: "high", timestamp: "00:04:12" }],
    });
    expect(summary.coachingPriorities).toEqual([]);
  });

  it("does not mix Call 1 and Call 2+ when calculating recent direction", () => {
    const calls = [
      ...[40, 40, 40, 40, 40, 80, 80, 80, 80, 80].map((score, index) => call({ assessmentId: `call1-${index}`, repEmail: "rep@example.com", repName: "Rep", callType: "Call 1", score, meetingStartAt: `2026-07-${String(10 + index).padStart(2, "0")}T12:00:00.000Z` })),
      ...[90, 90, 90, 90, 90, 50, 50, 50, 50, 50].map((score, index) => call({ assessmentId: `call2-${index}`, repEmail: "rep@example.com", repName: "Rep", callType: "Call 2+", score, meetingStartAt: `2026-07-${String(10 + index).padStart(2, "0")}T13:00:00.000Z` })),
    ];
    const summary = deriveRepSummaries(calls)[0];
    expect(summary.call1Trend.delta).toBe(40);
    expect(summary.call2Trend.delta).toBe(-40);
    expect(summary.call1Trend).toMatchObject({ label: "Improving", recentMean: 80, previousMean: 40 });
    expect(summary.call2Trend).toMatchObject({ label: "Declining", recentMean: 50, previousMean: 90 });
  });

  it("uses the measured threshold only within each call type", () => {
    const previousThreshold = process.env.REP_SCORING_DECLINE_THRESHOLD;
    process.env.REP_SCORING_DECLINE_THRESHOLD = "12";
    try {
      const calls = [
        ...[80, 80, 80, 80, 80, 55, 55, 55, 55, 55].map((score, index) => call({ assessmentId: `call1-threshold-${index}`, repEmail: "rep@example.com", repName: "Rep", callType: "Call 1", score, meetingStartAt: `2026-07-${String(10 + index).padStart(2, "0")}T12:00:00.000Z` })),
        ...[70, 70, 70, 70, 70, 75, 75, 75, 75, 75].map((score, index) => call({ assessmentId: `call2-threshold-${index}`, repEmail: "rep@example.com", repName: "Rep", callType: "Call 2+", score, meetingStartAt: `2026-07-${String(10 + index).padStart(2, "0")}T13:00:00.000Z` })),
      ];
      const summary = deriveRepSummaries(calls)[0];
      expect(summary.call1Trend).toMatchObject({ label: "Declining", delta: -25, recentMean: 55, previousMean: 80, supported: true });
      expect(summary.call2Trend).toMatchObject({ label: "Stable", delta: 5, supported: true });
      expect(summary.needsReview).toBe(true);
    } finally {
      if (previousThreshold === undefined) delete process.env.REP_SCORING_DECLINE_THRESHOLD;
      else process.env.REP_SCORING_DECLINE_THRESHOLD = previousThreshold;
    }
  });

  it("does not turn a material decline into needs attention while the recent result remains healthy", () => {
    const calls = [90, 90, 90, 90, 90, 70, 70, 70, 70, 70].map((score, index) => call({
      assessmentId: `healthy-decline-${index}`,
      repEmail: "healthy@example.com",
      repName: "Healthy Rep",
      callType: "Call 1",
      score,
      meetingStartAt: `2026-07-${String(10 + index).padStart(2, "0")}T12:00:00.000Z`,
    }));

    const summary = deriveRepSummaries(calls)[0];
    expect(summary.call1Trend).toMatchObject({ label: "Stable", delta: -20, recentMean: 70 });
    expect(summary.needsReview).toBe(false);
  });
});

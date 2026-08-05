import { describe, expect, it } from "vitest";
import { deriveRepSummaries, type RepScoreCall } from "@/lib/rep-scoring/data";

function call(overrides: Partial<RepScoreCall> & Pick<RepScoreCall, "assessmentId" | "repEmail" | "repName" | "callType" | "score">): RepScoreCall {
  return {
    id: overrides.assessmentId,
    idempotencyKey: overrides.assessmentId,
    repId: overrides.repEmail,
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
      ...[50, 55, 45].map((score, index) => call({ assessmentId: `low-${index}`, repEmail: "low@example.com", repName: "Low", callType: "Call 1", score })),
      ...[80, 85, 90].map((score, index) => call({ assessmentId: `high-${index}`, repEmail: "high@example.com", repName: "High", callType: "Call 1", score })),
    ];

    const summaries = deriveRepSummaries(calls);
    expect(summaries.map((summary) => summary.repName)).toEqual(["Low", "High"]);
    expect(summaries[0]).toMatchObject({ overallScore: 50, needsReview: true, rank: 1 });
    expect(summaries[1]).toMatchObject({ overallScore: 85, needsReview: false, rank: 2 });
  });

  it("does not manufacture weaknesses for a rep whose recurring dimensions meet expectations", () => {
    const calls = [0, 1, 2].map((index) => call({
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
    const calls = [0, 1, 2].map((index) => call({
      assessmentId: `mixed-${index}`,
      repEmail: "mixed@example.com",
      repName: "Mixed Rep",
      callType: "Call 1",
      score: 72,
      dimensions: [
        { key: "discovery", band: "Needs Improvement" },
        { key: "qualification", band: "Excellent" },
        { key: "authority", band: "Excellent" },
      ],
    }));

    const summary = deriveRepSummaries(calls)[0];
    expect(summary.coachingPriorities.map((pattern) => pattern.key)).toEqual(["discovery"]);
    expect(summary.strengths.map((pattern) => pattern.key)).toEqual(["authority", "qualification"]);
  });
});

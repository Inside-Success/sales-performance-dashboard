import { describe, expect, it } from "vitest";

import { buildV7ManagerSummaries, type V7ManagerCall } from "@/lib/rep-scoring/v7-manager";

function call(overrides: Partial<V7ManagerCall> = {}): V7ManagerCall {
  const score = overrides.score ?? 75;
  return {
    assessmentId: overrides.assessmentId || `assessment-${Math.random()}`,
    repEmail: overrides.repEmail || "rep@example.com",
    repName: overrides.repName || "Example Rep",
    callType: overrides.callType || "Call 1",
    meetingStartAt: overrides.meetingStartAt || "2026-08-12T12:00:00.000Z",
    score,
    dimensions: overrides.dimensions || [dimension("discovery", "Discovery", score)],
  };
}

function dimension(key: string, label: string, points: number, status = points >= 82 ? "strong" : points >= 65 ? "competent" : points >= 42 ? "partial" : "weak") {
  return { key, label, points, applicability: "applicable", criteria: [{ status }] };
}

describe("V7 manager aggregation", () => {
  it("does not manufacture a concern for the lowest rep when all absolute results are supported", () => {
    const calls = [
      ...Array.from({ length: 8 }, (_, index) => call({ repEmail: "good@example.com", repName: "Good Rep", score: 84 + (index % 2), assessmentId: `good-${index}` })),
      ...Array.from({ length: 8 }, (_, index) => call({ repEmail: "better@example.com", repName: "Better Rep", score: 91 + (index % 2), assessmentId: `better-${index}` })),
    ];

    const summaries = buildV7ManagerSummaries(calls);

    expect(summaries).toHaveLength(2);
    expect(summaries.every((summary) => summary.priority === "monitor")).toBe(true);
    expect(summaries[0].reason).toContain("No repeated performance concern");
  });

  it("prioritizes a repeated controllable skill gap with exact evidence counts", () => {
    const calls = Array.from({ length: 8 }, (_, index) => call({
      assessmentId: `weak-${index}`,
      score: index < 5 ? 52 : 70,
      dimensions: [dimension("discovery", "Discovery quality", index < 5 ? 45 : 72, index < 5 ? "partial" : "competent")],
    }));

    const [summary] = buildV7ManagerSummaries(calls);

    expect(summary.priority).toBe("needs_attention");
    expect(summary.reason).toContain("Discovery quality");
    expect(summary.reason).toContain("5 of 8 Call 1 calls");
    expect(summary.repeatedConcerns[0].assessmentIds).toHaveLength(5);
  });

  it("uses recent direction only when two comparable three-call windows exist", () => {
    const scores = [48, 50, 52, 75, 76, 78];
    const calls = scores.map((score, index) => call({
      assessmentId: `trend-${index}`,
      score,
      meetingStartAt: new Date(Date.UTC(2026, 7, 12 - index)).toISOString(),
      dimensions: [dimension("discovery", "Discovery quality", 72, "competent")],
    }));

    const [summary] = buildV7ManagerSummaries(calls);

    expect(summary.priority).toBe("needs_attention");
    expect(summary.call1Direction.label).toBe("Declining");
    expect(summary.call1Direction.delta).toBeLessThanOrEqual(-12);
  });

  it("weights Call 1 and Call 2 equally instead of allowing volume to dominate", () => {
    const calls = [
      ...Array.from({ length: 10 }, (_, index) => call({ assessmentId: `c1-${index}`, callType: "Call 1", score: 90 })),
      ...Array.from({ length: 5 }, (_, index) => call({ assessmentId: `c2-${index}`, callType: "Call 2+", score: 50, dimensions: [dimension("objections", "Objection handling", 50, "partial")] })),
    ];

    const [summary] = buildV7ManagerSummaries(calls);

    expect(summary.call1Score).toBe(90);
    expect(summary.call2Score).toBe(50);
    expect(summary.overallScore).toBe(70);
    expect(summary.priority).toBe("needs_attention");
  });
});

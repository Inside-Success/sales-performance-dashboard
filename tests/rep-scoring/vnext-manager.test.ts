import { describe, expect, it } from "vitest";

import { buildVNextManagerSummaries } from "@/lib/rep-scoring/vnext-manager";
import type { V7ManagerCall } from "@/lib/rep-scoring/v7-manager";

function call(index: number, score: number, callType: V7ManagerCall["callType"] = "Call 2+"): V7ManagerCall {
  return {
    assessmentId: `call-${index}`,
    repEmail: "rep@example.com",
    repName: "Test Rep",
    callType,
    meetingStartAt: `2026-08-${String(20 + index).padStart(2, "0")}T12:00:00Z`,
    score,
    dimensions: [],
  };
}

describe("buildVNextManagerSummaries", () => {
  it("ignores Call 1 records completely", () => {
    const [summary] = buildVNextManagerSummaries([call(1, 10, "Call 1"), call(2, 80)]);
    expect(summary).toMatchObject({ overallScore: 80, totalCalls: 1, call1Calls: 0, call2Calls: 1 });
  });

  it("uses only the five latest Call 2 scores", () => {
    const [summary] = buildVNextManagerSummaries([10, 20, 30, 40, 50, 100].map((score, index) => call(index, score)));
    expect(summary.overallScore).toBe(48);
  });

  it("sorts the manager list from lowest score to highest", () => {
    const low = { ...call(1, 35), repEmail: "low@example.com", repName: "Low Rep" };
    const high = { ...call(2, 85), repEmail: "high@example.com", repName: "High Rep" };
    expect(buildVNextManagerSummaries([high, low]).map((summary) => summary.repName)).toEqual(["Low Rep", "High Rep"]);
  });
});

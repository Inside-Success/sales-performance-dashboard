import { describe, expect, it } from "vitest";
import { CALL2_CURRENT_VERSION, CALL2_PREVIOUS_VERSION, scorecardVersion, isCall2Version } from "@/lib/rep-scoring/scorer-version";
describe("forward-only scoring cohorts", () => {
  it("keeps current and historical cohorts distinct", () => {
    expect(scorecardVersion()).toBe(CALL2_CURRENT_VERSION);
    expect(scorecardVersion(true)).toBe(CALL2_PREVIOUS_VERSION);
    expect(scorecardVersion()).not.toBe(scorecardVersion(true));
  });
  it("uses Call 2 aggregation only for explicitly supported versions", () => {
    expect(isCall2Version(CALL2_CURRENT_VERSION)).toBe(true);
    expect(isCall2Version(CALL2_PREVIOUS_VERSION)).toBe(true);
    expect(isCall2Version("other")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("V6.1 calibration release boundaries", () => {
  it("keeps V6.1 isolated, admin-only, and explicitly blocks backfill and Coaching release", () => {
    const page = readFileSync("src/app/manager/rep-scoring/v6-1-calibration/page.tsx", "utf8");
    expect(page).toContain("requireRepScoringAdmin");
    expect(page).toContain("no backfill and no Coaching score release");
    expect(page).toContain("The exact V6 sample");
  });

  it("loads only the two immutable V6.1 scorer versions", () => {
    const data = readFileSync("src/lib/rep-scoring/v6-calibration.ts", "utf8");
    expect(data).toContain("rep-reviewer-v6.1-calibration-r1c");
    expect(data).toContain("rep-reviewer-v6.1-calibration-r2c");
    expect(data).toContain("getV61CalibrationData");
    expect(data).toContain('cache: "no-store"');
  });

  it("makes score, outcome, and critical-finding agreement visible", () => {
    const data = readFileSync("src/lib/rep-scoring/v6-calibration.ts", "utf8");
    const page = readFileSync("src/app/manager/rep-scoring/v6-1-calibration/page.tsx", "utf8");
    expect(data).toContain("outcomeMatch");
    expect(data).toContain('assessment.callType === "Call 1" ? assessment.disposition : assessment.outcome');
    expect(data).toContain("criticalMatch");
    expect(data).toContain("actionStable");
    expect(page).toContain("Action stable");
    expect(page).toContain("at least 11 of 12");
    expect(page).toContain("decisionsAgree === 12");
    expect(page).toContain("criticalDecisionsAgree === 12");
  });

  it("shows criteria and second-judgment provenance on every call", () => {
    const detail = readFileSync("src/app/manager/rep-scoring/v6-1-calibration/call/[sourceRecordId]/page.tsx", "utf8");
    expect(detail).toContain("dimension.criteria");
    expect(detail).toContain("Second judgment applied");
    expect(detail).toContain("Derived outcome");
  });
});

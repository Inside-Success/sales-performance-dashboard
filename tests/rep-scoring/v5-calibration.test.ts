import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("V5 calibration release boundaries", () => {
  it("keeps calibration on a separate hidden route with an explicit no-backfill warning", () => {
    const page = readFileSync("src/app/manager/rep-scoring/v5-calibration/page.tsx", "utf8");
    expect(page).toContain("No full backfill has started");
    expect(page).toContain("6 Call 1");
    expect(page).toContain("6 Call 2");
    expect(page).toContain("requireRepScoringAdmin");
  });

  it("loads only the immutable V5 calibration scorer version", () => {
    const data = readFileSync("src/lib/rep-scoring/v5-calibration.ts", "utf8");
    expect(data).toContain('rep-reviewer-v5-calibration-1');
    expect(data).toContain("filterByFormula");
    expect(data).toContain('cache: "no-store"');
  });

  it("shows reliability and opportunity before execution checkpoints", () => {
    const detail = readFileSync("src/app/manager/rep-scoring/v5-calibration/call/[assessmentId]/page.tsx", "utf8");
    expect(detail.indexOf("Can this transcript be graded?")).toBeLessThan(detail.indexOf("Script-aligned checkpoints"));
    expect(detail.indexOf("Was this prospect realistically closable?")).toBeLessThan(detail.indexOf("Script-aligned checkpoints"));
  });
});

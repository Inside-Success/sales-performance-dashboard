import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("V6.2 validation review boundaries", () => {
  it("keeps the review route admin-only and separates validation from the preserved calibration", () => {
    const page = readFileSync("src/app/manager/rep-scoring/v6-2-calibration/page.tsx", "utf8");
    expect(page).toContain("requireRepScoringAdmin");
    expect(page).toContain('sampleReason.includes("backfill_validation_100")');
    expect(page).toContain("These successful calls count toward the later backfill");
    expect(page).toContain("Show the preserved original 12-call calibration");
  });

  it("shows the actual evidence mix and score-distribution checks", () => {
    const page = readFileSync("src/app/manager/rep-scoring/v6-2-calibration/page.tsx", "utf8");
    expect(page).toContain("`${call1.length} Call 1 · ${call2.length} Call 2`");
    expect(page).toContain('label="Median score"');
    expect(page).toContain('label="Score range"');
    expect(page).toContain("medianScore");
  });
});

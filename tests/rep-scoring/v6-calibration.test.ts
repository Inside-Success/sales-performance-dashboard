import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("V6 calibration release boundaries", () => {
  it("keeps V6 on a separate admin-only route and blocks backfill claims", () => {
    const page = readFileSync("src/app/manager/rep-scoring/v6-calibration/page.tsx", "utf8");
    expect(page).toContain("requireRepScoringAdmin");
    expect(page).toContain("No one-week backfill has started");
    expect(page).toContain("12 unique calls");
    expect(page).toContain("both scoring rounds");
  });

  it("loads only the two immutable V6 calibration versions", () => {
    const data = readFileSync("src/lib/rep-scoring/v6-calibration.ts", "utf8");
    expect(data).toContain("rep-reviewer-v6-calibration-r1");
    expect(data).toContain("rep-reviewer-v6-calibration-r2");
    expect(data).toContain("OR({Scorer Version}");
    expect(data).toContain('cache: "no-store"');
  });

  it("pairs scores by source call and makes stability review explicit", () => {
    const data = readFileSync("src/lib/rep-scoring/v6-calibration.ts", "utf8");
    const detail = readFileSync("src/app/manager/rep-scoring/v6-calibration/call/[sourceRecordId]/page.tsx", "utf8");
    expect(data).toContain("sourceRecordId");
    expect(data).toContain("delta <= 10 && bandMatch");
    expect(detail).toContain("difference above 10 points or a band change");
    expect(detail).toContain("Transcript");
    expect(detail).toContain("Prospect opportunity");
  });
});

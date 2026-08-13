import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("V6.3 250-call checkpoint boundaries", () => {
  it("keeps the page hidden, admin gated, and isolated from the manager production route", () => {
    const page = readFileSync("src/app/manager/rep-scoring/v6-3-calibration/page.tsx", "utf8");
    expect(page).toContain("requireRepScoringAdmin");
    expect(page).toContain("V6.3 cost-controlled checkpoint");
    expect(page).toContain("no remaining backlog is authorized or running");
    expect(page).toContain('call.sampleReason === "v6_3_checkpoint_250"');
    expect(page).toContain("CHECKPOINT_TARGET = 250");
  });

  it("documents realistic deterministic anchors and prospect-neutral scoring", () => {
    const page = readFileSync("src/app/manager/rep-scoring/v6-3-calibration/page.tsx", "utf8");
    expect(page).toContain("Exceptional 100 · Met 85 · Partial 55 · Missed 15 · Harmful 0");
    expect(page).toContain("source mix was preserved");
  });

  it("loads only the isolated V6.3 scorer version and includes quarantine progress", () => {
    const loader = readFileSync("src/lib/rep-scoring/v6-calibration.ts", "utf8");
    expect(loader).toContain('rep-reviewer-v6.3-realistic-fair-1');
    expect(loader).toContain('REP_SCORING_QUARANTINE_TABLE');
    expect(loader).toContain('quarantineRows');
  });

  it("retains V6.3 as an isolated rollback loader after the manager view moves to V7.1", () => {
    const loader = readFileSync("src/lib/rep-scoring/data.ts", "utf8");
    const page = readFileSync("src/app/manager/rep-scoring/page.tsx", "utf8");
    expect(loader).toContain('REP_SCORING_MANAGER_SCORER_VERSION || V6_3_SCORER_VERSION');
    expect(loader).toContain('REP_SCORING_LEDGER_TABLE || "processing_ledger"');
    expect(loader).toContain('V6_3_HISTORICAL_TARGET = 1_268');
    expect(page).toContain("getV7ScorecardOverview");
    expect(page).toContain("AI Closer Scorecard");
    expect(page).not.toContain("V6.3");
    expect(page).not.toContain("V5 historical validation");
  });
});

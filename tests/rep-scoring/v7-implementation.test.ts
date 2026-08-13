import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("V7 scorer safeguards", () => {
  const primary = read("n8n/rep-scoring-v7/prepare-evidence-bound-request.js");
  const selective = read("n8n/rep-scoring-v7/prepare-selective-review.js");
  const scoring = read("n8n/rep-scoring-v7/validate-evidence-and-compute-score.js");

  it("does not treat refusal, progression, or sale as proof of good execution", () => {
    expect(primary).toContain("A sale, advancement, or polite ending never proves");
    expect(primary).toContain("I do not want to move forward");
    expect(primary).toContain("not_currently_closable requires an evidenced blocker");
  });

  it("uses deterministic criterion anchors after evidence validation", () => {
    expect(scoring).toContain("exceptional:100,strong:84,competent:68,partial:45,weak:20,missed:0,harmful:0");
    expect(scoring).toContain("coverage+specificity+material_gap+confidence+evidence");
    expect(primary).toContain("Ordinary script compliance is competent, not strong");
    expect(scoring).toContain("transcriptNorm.includes(quote)");
    expect(scoring).toContain("minimumDimensions=source.callType==='Call 1'?4:5");
  });

  it("selectively verifies material risk without double-reviewing ordinary strong calls", () => {
    expect(selective).toContain("unclosable_classification_requires_verification");
    expect(selective).toContain("material_pressure_risk");
    expect(selective).toContain("exceptional_claim_requires_verification");
    expect(selective).toContain("no_material_risk_gate");
    expect(selective).not.toContain("top_heavy_primary_assessment");
  });
});

describe("V7 manager presentation safeguards", () => {
  const overview = read("src/app/manager/rep-scoring/v7-validation/page.tsx");
  const rep = read("src/app/manager/rep-scoring/v7-validation/rep/[repKey]/page.tsx");
  const call = read("src/app/manager/rep-scoring/v7-validation/call/[assessmentId]/page.tsx");
  const data = read("src/lib/rep-scoring/v7-validation.ts");

  it("uses targeted V7-only reads", () => {
    expect(data).toContain("{Scorer Version}");
    expect(data).toContain("{Assessment ID}");
    expect(data).toContain("{Scored Rep Email}");
    expect(data).not.toContain("processing_ledger");
    expect(data).not.toContain("scoring_runs");
    expect(data).toContain("canonicalScoreRecords");
    expect(data).toContain("if (identities.size !== 1 || scores.size !== 1) continue");
  });

  it("provides immediate route loading and link prefetching", () => {
    expect(overview).toContain("prefetch");
    expect(rep).toContain("prefetch");
    expect(read("src/app/manager/rep-scoring/v7-validation/loading.tsx")).toContain("Skeleton");
  });

  it("does not expose raw JSON or render empty technical sections", () => {
    for (const source of [overview, rep, call]) {
      expect(source).not.toMatch(/JSON\.stringify|Raw Model|raw JSON/i);
    }
    expect(call).toContain("call.criticalFindings.length ?");
    expect(call).toContain("call.strengths.length ?");
    expect(call).not.toContain("No behavior checks were stored");
  });

  it("uses a simple production scorecard sorted from lowest score with details behind each row", () => {
    const production = read("src/app/manager/rep-scoring/page.tsx");
    const table = read("src/app/manager/rep-scoring/closer-scorecard-table.tsx");
    const progress = read("src/app/manager/rep-scoring/v7-validation/route-progress.tsx");
    const productionRep = read("src/app/manager/rep-scoring/rep/[repKey]/page.tsx");
    const productionCall = read("src/app/manager/rep-scoring/call/[assessmentId]/page.tsx");
    expect(production).toContain("AI Closer Scorecard");
    expect(production).toContain("getV7ScorecardOverview");
    expect(table).toContain("a.overallScore - b.overallScore");
    expect(table).toContain("15+ calls");
    expect(table).not.toContain("V7 shadow validation");
    expect(table).not.toContain("Historical backfill");
    expect(progress).toContain('startsWith("/manager/rep-scoring")');
    expect(productionRep).toContain("Calls behind this score");
    expect(productionCall).toContain("Manager takeaway");
    expect(productionCall).not.toMatch(/JSON\.stringify|raw JSON/i);
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { V7_CHECKPOINT_BOUNDARY, V7_CHECKPOINT_RUN_KEY, V7_CHECKPOINT_TARGET } from "@/lib/rep-scoring/v7-run-lock";

describe("V7 atomic checkpoint contract", () => {
  it("pins the approved checkpoint boundary and exact additional-call count", () => {
    expect(V7_CHECKPOINT_BOUNDARY).toBe("2026-08-03T04:00:00.000Z");
    expect(V7_CHECKPOINT_TARGET).toBe(250);
    expect(V7_CHECKPOINT_RUN_KEY).toContain("checkpoint-250");
  });
  it("requires an atomic unique run key and exact selected count before dispatch", () => {
    const source = readFileSync("src/lib/rep-scoring/v7-run-lock.ts", "utf8");
    expect(source).toContain("run_key text primary key");
    expect(source).toContain("on conflict (run_key) do update");
    expect(source).toContain("and target_calls = ${selectedCalls}");
    expect(source).toContain("and selected_calls = 0");
  });
  it("does not allow a dispatched run to be silently reopened", () => {
    const source = readFileSync("src/lib/rep-scoring/v7-run-lock.ts", "utf8");
    expect(source).toContain("rep_scoring_v7_runs.state = 'failed'");
    expect(source).not.toContain("rep_scoring_v7_runs.state = 'dispatched' and rep_scoring_v7_runs.lease_expires_at < now()");
  });
  it("keeps each top-level scoring execution at ten calls and splits 20 plus 5 waves", () => {
    const source = readFileSync("n8n/rep-scoring-v7/build-checkpoint-manifest.js", "utf8");
    expect(source).toContain("context.workerBatchSize");
    expect(source).toContain("batch.batchSize > 10");
    expect(source).toContain("batches.length < context.firstWaveBatches ? 1 : 2");
  });
  it("allows one atomic run to reserve the complete approved source window", () => {
    const source = readFileSync("src/lib/rep-scoring/v7-run-lock.ts", "utf8");
    expect(source).toContain("input.targetCalls > 2000");
    expect(source).toContain("targetCalls must be an integer from 1 to 2000");
  });
});

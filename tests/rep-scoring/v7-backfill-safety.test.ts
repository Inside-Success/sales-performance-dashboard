import { describe, expect, it } from "vitest";

import { calculateV7BackfillProgress, canAcquireV7Work, partitionV7WorkerBatches, planV7Retry, v7IdempotencyKey } from "@/lib/rep-scoring/v7-backfill-safety";

describe("V7 backfill safety contract", () => {
  it("creates immutable scorer-version idempotency keys", () => {
    const first = v7IdempotencyKey("rec-123", "rep-reviewer-v7-shadow-1");
    expect(first).toBe(v7IdempotencyKey("rec-123", "rep-reviewer-v7-shadow-1"));
    expect(first).not.toBe(v7IdempotencyKey("rec-123", "rep-reviewer-v7-shadow-2"));
  });

  it("never puts more than ten calls in one top-level execution", () => {
    expect(partitionV7WorkerBatches(Array.from({ length: 23 }, (_, index) => index), 20).map((batch) => batch.length)).toEqual([10, 10, 3]);
  });

  it("reclaims only pending, retry-ready, or expired work", () => {
    const now = new Date("2026-08-13T00:00:00.000Z");
    expect(canAcquireV7Work(undefined, now)).toBe(true);
    expect(canAcquireV7Work({ state: "leased", attempt: 1, leaseExpiresAt: "2026-08-12T23:59:00.000Z" }, now)).toBe(true);
    expect(canAcquireV7Work({ state: "leased", attempt: 1, leaseExpiresAt: "2026-08-13T00:01:00.000Z" }, now)).toBe(false);
    expect(canAcquireV7Work({ state: "completed", attempt: 1 }, now)).toBe(false);
  });

  it("uses bounded deterministic backoff and dead-letters exhausted work", () => {
    const now = new Date("2026-08-13T00:00:00.000Z");
    const retry = planV7Retry("stable-key", 2, true, now);
    expect(retry.state).toBe("retry_wait");
    expect(retry.delaySeconds).toBeGreaterThanOrEqual(60);
    expect(retry.delaySeconds).toBeLessThanOrEqual(75);
    expect(planV7Retry("stable-key", 4, true, now).state).toBe("dead_letter");
    expect(planV7Retry("stable-key", 1, false, now).state).toBe("dead_letter");
  });

  it("counts only scores and fair exclusions as finalized progress", () => {
    expect(calculateV7BackfillProgress([
      { state: "completed", attempt: 1 },
      { state: "fair_exclusion", attempt: 1 },
      { state: "leased", attempt: 1 },
      { state: "retry_wait", attempt: 2 },
      { state: "dead_letter", attempt: 4 },
      { state: "pending", attempt: 0 },
    ])).toEqual({ eligible: 6, finalized: 2, completed: 1, fairExclusions: 1, inFlight: 1, retrying: 1, deadLetter: 1, pending: 1, percent: 33.3 });
  });
});

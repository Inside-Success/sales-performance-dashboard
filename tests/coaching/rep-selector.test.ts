import { describe, expect, it } from "vitest";
import { activeCoachingReps } from "@/lib/coaching-rep-selector";
import type { RepSummary } from "@/lib/types";

const now = Date.parse("2026-10-01T12:00:00Z");
const day = 24 * 60 * 60 * 1000;
const rep = (name: string, days: number): RepSummary => ({
  rep_name: name, rep_slug: name.toLowerCase(), call_count: 150,
  latest_call_date: new Date(now - days * day).toISOString(),
});

describe("official coaching selector activity", () => {
  it("includes the exact 60-day boundary but hides older, missing and invalid dates", () => {
    const reps = [rep("Recent", 59), rep("Boundary", 60), rep("Old", 60.00001),
      { ...rep("Missing", 0), latest_call_date: null },
      { ...rep("Invalid", 0), latest_call_date: "invalid" }];
    expect(activeCoachingReps(reps, now).map(r => r.rep_name)).toEqual(["Boundary", "Recent"]);
  });

  it("keeps all-time counts and does not modify the complete roster", () => {
    const reps = [rep("Zulu", 2), rep("alice", 1), rep("Older", 61)];
    const original = JSON.stringify(reps);
    const choices = activeCoachingReps(reps, now);
    expect(choices.map(r => r.rep_name)).toEqual(["alice", "Zulu"]);
    expect(choices[0].call_count).toBe(150);
    expect(JSON.stringify(reps)).toBe(original);
  });

  it("automatically restores a returning rep when a new official report arrives", () => {
    const previous = rep("Returning", 61);
    expect(activeCoachingReps([previous], now)).toEqual([]);
    expect(activeCoachingReps([{ ...previous, latest_call_date: new Date(now).toISOString() }], now)).toHaveLength(1);
  });

  it("retains more than 80 qualifying names", () => {
    const reps = Array.from({ length: 155 }, (_, i) => rep(`Rep ${String(i).padStart(3, "0")}`, 1));
    expect(activeCoachingReps(reps, now)).toHaveLength(155);
  });
});

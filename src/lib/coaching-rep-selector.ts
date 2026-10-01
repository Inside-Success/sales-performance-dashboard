import type { RepSummary } from "@/lib/types";

const ACTIVITY_WINDOW_MS = 60 * 24 * 60 * 60 * 1000;

// Only official Call 2 coaching summaries belong here. This filters choices,
// never the report query or the all-time report counts in each summary.
export function activeCoachingReps(reps: RepSummary[], now = Date.now()): RepSummary[] {
  const cutoff = now - ACTIVITY_WINDOW_MS;
  return reps
    .filter((rep) => rep.latest_call_date && Date.parse(rep.latest_call_date) >= cutoff)
    .sort((a, b) => a.rep_name.localeCompare(b.rep_name, undefined, { sensitivity: "base" }));
}

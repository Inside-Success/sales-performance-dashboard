import type { V7Direction, V7ManagerCall, V7RepSummary } from "@/lib/rep-scoring/v7-manager";

const WINDOW_SIZE = 5;

export function buildVNextManagerSummaries(calls: V7ManagerCall[]): V7RepSummary[] {
  const byRep = new Map<string, V7ManagerCall[]>();
  for (const call of calls) {
    if (call.callType !== "Call 2+" || !Number.isFinite(call.score)) continue;
    const key = call.repEmail.trim().toLowerCase() || call.repName.trim().toLowerCase();
    if (!key) continue;
    byRep.set(key, [...(byRep.get(key) || []), call]);
  }

  return [...byRep.values()].map(buildSummary).sort((a, b) =>
    a.overallScore - b.overallScore || b.totalCalls - a.totalCalls || a.repName.localeCompare(b.repName),
  );
}

function buildSummary(calls: V7ManagerCall[]): V7RepSummary {
  const sorted = [...calls].sort((a, b) => dateValue(b.meetingStartAt) - dateValue(a.meetingStartAt));
  const first = sorted[0];
  const score = round(mean(sorted.slice(0, WINDOW_SIZE).map((call) => call.score)));
  const direction = scoreDirection(sorted);
  const enoughEvidence = sorted.length >= 3;

  let priority: V7RepSummary["priority"] = "monitor";
  let priorityLabel = "No priority concern";
  let reason = `Call 2 execution averages ${score.toFixed(1)} across the latest ${Math.min(WINDOW_SIZE, sorted.length)} scored calls.`;
  let action = "Continue normal monitoring.";
  if (!enoughEvidence) {
    priority = "not_enough_evidence";
    priorityLabel = "More evidence needed";
    reason = `${sorted.length} scored Call 2 ${sorted.length === 1 ? "is" : "calls are"} available; this is not enough for a stable rep-level conclusion.`;
    action = "Review individual calls only; wait for at least three scored Call 2s before judging the rep.";
  } else if (score < 55) {
    priority = "needs_attention";
    priorityLabel = "Needs manager attention";
    action = "Review the lowest recent Call 2s and coach the repeated controllable gap.";
  } else if (score < 70) {
    priority = "coaching_focus";
    priorityLabel = "Coaching opportunity";
    action = "Review the lowest recent Call 2s and choose one skill for routine coaching.";
  }

  return {
    repEmail: first.repEmail,
    repName: first.repName,
    totalCalls: sorted.length,
    overallScore: score,
    call1Score: null,
    call1Calls: 0,
    call2Score: score,
    call2Calls: sorted.length,
    priority,
    priorityLabel,
    reason,
    action,
    evidenceLabel: sorted.length >= 5 ? "Strong Call 2 evidence" : sorted.length >= 3 ? "Supported Call 2 evidence" : "Early Call 2 evidence",
    repeatedConcerns: [],
    strengths: [],
    call1Direction: emptyDirection(),
    call2Direction: direction,
  };
}

function scoreDirection(calls: V7ManagerCall[]): V7Direction {
  const recent = calls.slice(0, 3).map((call) => call.score);
  const previous = calls.slice(3, 6).map((call) => call.score);
  if (recent.length < 3 || previous.length < 3) return emptyDirection();
  const recentAverage = round(mean(recent));
  const previousAverage = round(mean(previous));
  const delta = round(recentAverage - previousAverage);
  if (delta <= -10) return { label: "Declining", delta, recentAverage, previousAverage };
  if (delta >= 10) return { label: "Improving", delta, recentAverage, previousAverage };
  return { label: "Stable", delta, recentAverage, previousAverage };
}

function emptyDirection(): V7Direction {
  return { label: "Not enough history", delta: null, recentAverage: null, previousAverage: null };
}

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function dateValue(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

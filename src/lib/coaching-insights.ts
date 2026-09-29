import { readReviewedCoaching } from "@/lib/reviewed-coaching";
import { coachingEvidence } from "@/lib/coaching-presentation";

export type InsightCall = {
  id: string; rep_name: string; rep_slug: string; client_name: string | null;
  call_date: string | null; one_line_verdict: string | null; what_to_improve: unknown;
  objections_surfaced: unknown; source_payload: unknown; source_id: string | null;
  report_type: "official" | "manual";
};
const themes = [
  { key: "budget", label: "Budget & cash timing", pattern: /\b(budget|afford|funds|cash|financ\w*|money|paycheck|pay cheque)\b/i },
  { key: "value", label: "Value & expected return", pattern: /\b(roi|return on|worth|value|benefit|leads|revenue)\b/i },
  { key: "trust", label: "Trust & proof", pattern: /\b(trust|scam|legitim\w*|skeptic\w*|proof|references|credib\w*)\b/i },
  { key: "timing", label: "Timing & availability", pattern: /\b(time|timing|schedule|busy|availability|travel|filming)\b/i },
  { key: "decision", label: "Other people involved", pattern: /\b(spouse|husband|wife|partner|advisor|attorney|lawyer|decision.maker)\b/i },
  { key: "terms", label: "Package & agreement questions", pattern: /\b(agreement|contract|package|license|licensing|payment plan|installment|instalment)\b/i },
];
const training = [
  { key: "questions", label: "Answering buyer questions", pattern: /\b(question|answer|explain|clarif\w*|understand\w*)\b/i },
  { key: "listen", label: "Listening & handling concerns", pattern: /\b(listen\w*|pressure|repeat\w*|interrupt\w*|concern|objection|constraint)\b/i },
  { key: "close", label: "Commitment & next steps", pattern: /\b(close|closing|commit\w*|next step|follow.up|callback|deadline|confirm\w*)\b/i },
  { key: "tailor", label: "Connecting value to the buyer", pattern: /\b(tailor\w*|goal|story|value|benefit|connect\w*)\b/i },
];
function strings(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((x): x is string => typeof x === "string");
  return typeof value === "string" && value.trim() ? [value] : [];
}
function substantive(value: string) { return !/^\s*(?:\d+[.)]\s*)?(?:no (?:specific|substantive|explicit|clear|additional)|not applicable)/i.test(value); }
export function summarizeCoachingInsights(calls: InsightCall[]) {
  const topicRows = themes.map(t => ({ key: t.key, label: t.label, calls: [] as { call: InsightCall; evidence: string }[] }));
  const trainingRows = training.map(t => ({ key: t.key, label: t.label, calls: [] as { call: InsightCall; evidence: string }[] }));
  let structured = 0, withImprovements = 0;
  for (const call of calls) {
    const reviewed = readReviewedCoaching(call.source_payload, call.source_id);
    if (reviewed) structured++;
    const blockers = reviewed ? reviewed.blockers.map(x => x.observation) : strings(call.objections_surfaced).filter(substantive);
    const improvements = reviewed ? reviewed.improvements.map(x => x.observation + " " + x.better_action) : strings(call.what_to_improve).filter(substantive);
    if (improvements.length) withImprovements++;
    for (const [definitions, rows, observations] of [[themes, topicRows, blockers], [training, trainingRows, improvements]] as const) {
      definitions.forEach((topic, index) => {
        const match = observations.find(text => topic.pattern.test(text));
        if (match) rows[index].calls.push({ call, evidence: coachingEvidence(match).text });
      });
    }
  }
  return { total: calls.length, structured, withImprovements,
    topics: topicRows.filter(x => x.calls.length).sort((a,b) => b.calls.length-a.calls.length),
    training: trainingRows.filter(x => x.calls.length).sort((a,b) => b.calls.length-a.calls.length) };
}

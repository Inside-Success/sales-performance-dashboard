import { readReviewedCoaching } from "@/lib/reviewed-coaching";
import { groupRecentImprovements } from "@/lib/coaching-dashboard-sections";
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
  { key: "trust", label: "Trust & proof", pattern: /\b(trust|scam|legitim\w*|skeptic\w*|proof|references|case studies|credib\w*)\b/i },
  { key: "timing", label: "Timing & availability", pattern: /\b(timing|schedule|busy|availability|travel|filming|time constraint|time to (?:review|decide|think)|not (?:ready|available)|need(?:s|ed)? (?:more )?time)\b/i },
  { key: "decision", label: "Other people involved", pattern: /\b(spouse|husband|wife|partner|advisor|attorney|lawyer|mentor|board|team|marketing department|decision.maker)\b/i },
  { key: "terms", label: "Package & agreement questions", pattern: /\b(review|read|sign|signature|question|clarif\w*|understand\w*|unsure)\b.{0,100}\b(agreement|contract|license|licensing|payment plan|installments?|instalments?|package)\b|\b(agreement|contract|license|licensing|payment plan|installments?|instalments?|package)\b.{0,100}\b(review|terms|conditions?|questions?|details?|clarif\w*|understand\w*|unsure)\b/i },
];
const training = [
  { key: "questions", label: "Answering buyer questions", pattern: /\b(answer|explain|clarif\w*|direct question)\b/i },
  { key: "listen", label: "Listening & handling concerns", pattern: /\b(listen\w*|pressure|interrupt\w*|acknowledge|explore|probe|repeat(?:ed)? (?:the )?(?:pitch|script))\b/i },
  { key: "close", label: "Commitment & next steps", pattern: /\b(close|closing|commit\w*|next step|follow.up|callback|deadline|confirm\w*)\b/i },
  { key: "tailor", label: "Connecting value to the buyer", pattern: /\b(tailor\w*|goal|story|value|benefit|connect\w*)\b/i },
];
function strings(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((x): x is string => typeof x === "string");
  return typeof value === "string" && value.trim() ? [value] : [];
}
export function substantive(value: string) {
  return !/^\s*(?:\d+[.)]\s*)?(?:no (?:supported|specific|substantive|explicit|clear|additional|meaningful|major|further)|none\b|n\/a\b|not applicable|nothing to improve)/i.test(value);
}
// Match an actual concern clause, not an incidental word in a negated summary.
// Resolution is deliberately not inferred: a mention is not an open blocker.
export function concernMatches(value: string, pattern: RegExp) {
  return value.split(/(?<=[.!?;])\s+|\n+/).some(clause => {
    if (!substantive(clause)) return false;
    const cleaned = clause.replace(/\b(?:rather than|not necessarily|not|no)\s+(?:an?\s+)?(?:funding|budget|value|trust|timing)(?:\s+or\s+(?:funding|budget|value|trust|timing))*\s+(?:objection|issue|concern)s?\b/gi, '').replace(/\bno (?:budget|pricing|price|timing|trust|contract|package|financial)(?:-related)? (?:concerns?|objections?|issues?|problems?)\b/gi, '');
    return pattern.test(cleaned);
  });
}
export function summarizeCoachingInsights(calls: InsightCall[]) {
  const topicRows = themes.map(t => ({ key: t.key, label: t.label, calls: [] as { call: InsightCall; evidence: string }[] }));
  const trainingRows = training.map(t => ({ key: t.key, label: t.label, calls: [] as { call: InsightCall; evidence: string }[] }));
  let structured = 0, withImprovements = 0;
  for (const call of calls) {
    const reviewed = readReviewedCoaching(call.source_payload, call.source_id);
    if (reviewed) structured++;
    const blockers = reviewed ? reviewed.blockers.map(x => x.observation) : strings(call.objections_surfaced).filter(substantive);
    const improvements = reviewed ? reviewed.improvements.map(x => x.observation + " " + x.better_action) : groupRecentImprovements(call.what_to_improve).filter(substantive).map(text=>text.split('\n').filter(line=>!/^\s*(?:Possible effect|Why it matters):/i.test(line)).join(' '));
    if (improvements.length) withImprovements++;
    for (const [definitions, rows, observations] of [[themes, topicRows, blockers], [training, trainingRows, improvements]] as const) {
      definitions.forEach((topic, index) => {
        const match = observations.find(text => concernMatches(text, topic.pattern));
        if (match) rows[index].calls.push({ call, evidence: coachingEvidence(match).text });
      });
    }
  }
  const unmatched = calls.flatMap(call => {
    const reviewed=readReviewedCoaching(call.source_payload,call.source_id);
    const observations=reviewed ? reviewed.blockers.map(x=>x.observation) : strings(call.objections_surfaced).filter(substantive);
    return observations.length && !themes.some(theme=>observations.some(text=>concernMatches(text,theme.pattern))) ? [{call,evidence:coachingEvidence(observations.join(' ')).text}] : [];
  });
  if(unmatched.length)topicRows.push({key:'other',label:'Other reported concerns',calls:unmatched});
  return { total: calls.length, structured, withImprovements, unmatchedConcerns:unmatched.length,
    topics: topicRows.filter(x => x.calls.length).sort((a,b) => b.calls.length-a.calls.length),
    training: trainingRows.filter(x => x.calls.length).sort((a,b) => b.calls.length-a.calls.length) };
}

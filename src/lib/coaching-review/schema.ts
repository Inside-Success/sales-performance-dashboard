import { z } from "zod";

export const REVIEW_RUN_ID = "objection-review-2026-10-20";
export const categories = [
  "Cost and payment barriers", "Perceived value/benefits", "Confidence in ISTV",
  "Contract/Terms concerns", "Offer suitability / Fit for the applicant",
  "Practical feasibility and constraints", "Portrayal and publicity concerns",
  "Approval", "Commitment and Priority concerns", "Other objection",
] as const;
const text = z.string().trim().min(1).max(1800);
const ids = z.array(z.string().regex(/^T\d{4}$/)).min(1).max(30);
const point = z.object({ title: text, observation: text, why_it_matters: text, action: text, evidence_ids: ids, counterevidence_ids: z.array(z.string().regex(/^T\d{4}$/)).max(30) }).strict();
export const reportSchema = z.object({
  version: z.literal("objection-review-v1"),
  show: z.string().trim().min(1).max(80).describe("Show name only, inferred from actual call rather than a conflicting meeting title. No package commentary."),
  summary: z.string().trim().min(1).max(360).describe("One or two short sentences: the most useful overall coaching takeaway. Do not predict a lost sale or recap the report."),
  outcome: z.object({ payment: z.enum(["confirmed", "not_confirmed", "unclear"]), summary: text, evidence_ids: ids }).strict(),
  objections: z.array(z.object({
    category: z.enum(categories), title: text, concern: text,
    handling: z.enum(["handled_well", "could_be_handled_better", "not_enough_evidence"]),
    resolution: z.enum(["resolved", "partly_resolved", "unresolved", "unclear"]),
    response: text, assessment: text,
    recommendation: z.string().max(1800), suggested_words: z.string().max(1200),
    evidence_ids: ids, counterevidence_ids: z.array(z.string().regex(/^T\d{4}$/)).max(30),
  }).strict()).max(20),
  no_objections_reason: z.string().max(1200),
  not_raised: z.array(z.enum([categories[0],categories[1],categories[2],categories[3],categories[4],categories[5],categories[6],categories[7],categories[8]])).max(9),
  improvements: z.array(point).max(8),
  no_improvements_reason: z.string().max(1200),
  rudy: z.object({ title: text, advice: text, principle: text, source_id: z.enum(["call1", "call2", "greenlight"]), evidence_ids: ids }).strict(),
  strengths: z.array(z.object({ title: text, observation: text, why_it_matters: text, evidence_ids: ids }).strict()).max(6),
}).strict().superRefine((r, ctx) => {
  const issue = (message: string) => ctx.addIssue({code:"custom", message});
  const raised = new Set(r.objections.map(o=>o.category));
  if(new Set(r.not_raised).size !== r.not_raised.length) issue("Duplicate absent category");
  for(const c of r.not_raised) if(raised.has(c)) issue("Raised category marked absent");
  const absent = new Set<string>(r.not_raised);
  for(const c of categories.slice(0,9)) if(!raised.has(c) && !absent.has(c)) issue("Category not accounted for");
  if(r.objections.length === 0 && !r.no_objections_reason.trim()) issue("Explain why no objections are established");
  if(r.objections.length > 0 && r.no_objections_reason.trim()) issue("Contradictory no-objection statement");
  if(r.improvements.length === 0 && !r.no_improvements_reason.trim()) issue("Explain no supported improvement");
  if(r.improvements.length > 0 && r.no_improvements_reason.trim()) issue("Contradictory no-improvement statement");
  for(const o of r.objections) {
    if(o.handling==="could_be_handled_better" && !o.recommendation.trim()) issue("Improvement requires advice");
    if(o.handling!=="could_be_handled_better" && (o.recommendation.trim() || o.suggested_words.trim())) issue("Do not manufacture advice for sound or uncertain handling");
  }
});
export type CoachingReview = z.infer<typeof reportSchema>;
export type EvidenceBlock = { id: string; text: string };
export function validateEvidence(report: CoachingReview, blocks: EvidenceBlock[]) {
  const known = new Set(blocks.map(b=>b.id));
  const refs = [report.outcome, ...report.objections, ...report.improvements, report.rudy, ...report.strengths];
  for(const ref of refs) {
    for(const id of [...ref.evidence_ids, ...("counterevidence_ids" in ref ? ref.counterevidence_ids : [])])
      if(!known.has(id)) throw new Error("Unknown evidence reference: " + id);
  }
  return report;
}

import "server-only";
import { neon } from "@neondatabase/serverless";
import { z } from "zod";
import { requireRepScoringAdmin } from "@/lib/rep-scoring/access";
import { reportSchema, REVIEW_RUN_ID, validateEvidence } from "./schema";

const metaSchema = z.object({
  number: z.number().int().min(1).max(10), call_id: z.number().int().positive(),
  rep: z.string().min(1), prospect: z.string().min(1), date: z.string().datetime(),
});
export const savedReviewSchema = z.object({
  meta: metaSchema, report: reportSchema,
  evidence: z.array(z.object({id:z.string().regex(/^T\d{4}$/),text:z.string().min(1)})),
});
export type SavedReview = z.infer<typeof savedReviewSchema>;

function database() {
  if(!process.env.DATABASE_URL) throw new Error("Review storage unavailable");
  return neon(process.env.DATABASE_URL);
}
export async function getReviewList() {
  await requireRepScoringAdmin();
  const rows = await database()`select output->'meta' as meta, output->'report'->>'show' as show
    from prompt_benchmark_outputs where run_id=${REVIEW_RUN_ID}
    and ai_eval->>'published'='true' order by (output->'meta'->>'number')::int`;
  return rows.map(r=>({ ...metaSchema.parse(r.meta), show:z.string().min(1).parse(r.show) }));
}
export async function getReview(number: number): Promise<SavedReview | null> {
  await requireRepScoringAdmin();
  if(!Number.isInteger(number)||number<1||number>10) return null;
  const rows = await database()`select output from prompt_benchmark_outputs
    where run_id=${REVIEW_RUN_ID} and ai_eval->>'published'='true'
    and output->'meta'->>'number'=${String(number)} limit 1`;
  if(!rows.length) return null;
  const result=savedReviewSchema.parse(rows[0].output);
  validateEvidence(result.report,result.evidence);
  return result;
}

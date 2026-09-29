import { z } from "zod";

const evidence = z.array(z.string().max(40)).max(20);
const finding = z.object({ id: z.string().max(100), observation: z.string().min(1).max(3000), evidence });
export const reviewedCoachingSchema = z.object({
  version: z.literal("coaching-review-v1"),
  source_id: z.string().min(1).max(200),
  outcome: z.object({ payment: z.enum(["confirmed", "not_confirmed", "unclear"]), summary: z.string().min(1).max(3000), evidence }),
  improvements: z.array(finding.extend({ priority: z.enum(["material", "optional"]), title: z.string().max(180).optional(), possible_effect: z.string().min(1).max(3000), better_action: z.string().min(1).max(3000) })).max(30),
  strengths: z.array(finding.extend({ why_useful: z.string().max(3000).optional() })).max(30),
  blockers: z.array(finding).max(30),
  next_steps: z.array(finding).max(30),
});
export type ReviewedCoaching = z.infer<typeof reviewedCoachingSchema>;

// Optional enrichment must never make an otherwise valid legacy report undeliverable.
export function readReviewedCoaching(payload: unknown, sourceId?: string | null): ReviewedCoaching | null {
  if (!payload || typeof payload !== "object") return null;
  const value = (payload as Record<string, unknown>).reviewed_coaching_v1;
  const parsed = reviewedCoachingSchema.safeParse(value);
  if (!parsed.success || (sourceId && parsed.data.source_id !== sourceId)) return null;
  return parsed.data;
}

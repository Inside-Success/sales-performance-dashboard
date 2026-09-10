export const SCORE_CUTOFF = "2026-09-01T04:00:00.000Z";
export const SCORE_REVIEW_REVISION = "bounded-claims-2026-09-10";

export function currentScoreFields(fields: Record<string, unknown>): boolean {
  if (fields["Scorer Version"] !== "magic-mike-call2-evidence-score-v2") return false;
  if (!(Date.parse(String(fields["Meeting Start At"] || "")) >= Date.parse(SCORE_CUTOFF))) return false;
  try {
    const raw = fields["Call Context JSON"];
    const context = typeof raw === "string" ? JSON.parse(raw) : raw;
    const review = context?.scoring_evidence?.review?.factual_review;
    return review?.revision === SCORE_REVIEW_REVISION && review?.status === "passed";
  } catch { return false; }
}

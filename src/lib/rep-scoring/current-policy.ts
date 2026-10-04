import { CALL2_CURRENT_VERSION, CALL2_PREVIOUS_VERSION } from "./scorer-version";

// Previous rubric (v2): September 1 ET onward, bounded factual review passed.
export const SCORE_CUTOFF = "2026-09-01T04:00:00.000Z";
export const SCORE_REVIEW_REVISION = "bounded-claims-2026-09-10";
// Current rubric (v3, Raul's Call 2 procedure): every stored v3 row is
// forward-only, so only the review revision and status gate it.
export const CURRENT_REVIEW_REVISION = "raul-procedure-2026-09-18";

function passedReview(fields: Record<string, unknown>, revision: string): boolean {
  try {
    const raw = fields["Call Context JSON"];
    const context = typeof raw === "string" ? JSON.parse(raw) : raw;
    const review = context?.scoring_evidence?.review?.factual_review;
    return review?.revision === revision && review?.status === "passed";
  } catch { return false; }
}

// A score row is displayable only under the policy of its own version.
// Unknown versions, failed reviews and superseded revisions are never shown.
export function currentScoreFields(fields: Record<string, unknown>): boolean {
  const version = fields["Scorer Version"];
  if (version === CALL2_CURRENT_VERSION) return passedReview(fields, CURRENT_REVIEW_REVISION);
  if (version === CALL2_PREVIOUS_VERSION) {
    if (!(Date.parse(String(fields["Meeting Start At"] || "")) >= Date.parse(SCORE_CUTOFF))) return false;
    return passedReview(fields, SCORE_REVIEW_REVISION);
  }
  return false;
}

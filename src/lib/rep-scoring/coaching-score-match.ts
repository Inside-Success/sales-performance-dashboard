export const COACHING_SCORE_SCORER_VERSION = "rep-reviewer-v7.1-shadow-1";

export type CoachingScoreCandidate = {
  id: string;
  sourceRecordId: string;
  automationKey: string;
  scorerVersion: string;
  callType: string;
  status: string;
  score: number | null;
  internalInconsistency: boolean;
};

export type CoachingCallScore = {
  assessmentId: string;
  score: number;
};

export function selectExactCoachingCallScore({
  sourceRecordId,
  automationKey,
  candidates,
}: {
  sourceRecordId: string;
  automationKey: string;
  candidates: CoachingScoreCandidate[];
}): CoachingCallScore | null {
  if (!sourceRecordId || !automationKey) return null;

  const matches = candidates.filter((candidate) =>
    candidate.sourceRecordId === sourceRecordId
      && candidate.automationKey === automationKey
      && candidate.scorerVersion === COACHING_SCORE_SCORER_VERSION
      && candidate.callType === "Call 2+"
      && candidate.status.toLowerCase() === "scored"
      && !candidate.internalInconsistency
      && candidate.score !== null
      && Number.isFinite(candidate.score)
      && candidate.score >= 0
      && candidate.score <= 100,
  );

  if (!matches.length) return null;
  const assessmentIds = new Set(matches.map((candidate) => candidate.id));
  const scores = new Set(matches.map((candidate) => candidate.score));
  // Exact duplicate retry rows may collapse only when both immutable identity
  // and score agree. Any conflict stays withheld from Coaching.
  if (assessmentIds.size !== 1 || scores.size !== 1) return null;
  return { assessmentId: matches[0].id, score: matches[0].score as number };
}

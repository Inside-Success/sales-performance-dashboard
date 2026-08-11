export const COACHING_SCORE_SCORER_VERSION = "rep-reviewer-v6.3-realistic-fair-1";

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

  // Duplicate rows are withheld even when they agree. One source call must
  // resolve to one immutable assessment before anything is shown to a rep.
  if (matches.length !== 1) return null;
  return { assessmentId: matches[0].id, score: matches[0].score as number };
}

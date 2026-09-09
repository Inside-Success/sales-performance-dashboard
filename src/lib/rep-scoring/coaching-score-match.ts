import { CALL2_CURRENT_VERSION } from "./scorer-version";
export const COACHING_SCORE_SCORER_VERSION = CALL2_CURRENT_VERSION;

export type CoachingScoreCandidate = {
  id: string;
  sourceRecordId: string;
  automationKey: string;
  repEmail?: string;
  callDate?: string;
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
  repEmail,
  callDate,
}: {
  sourceRecordId: string;
  automationKey: string;
  candidates: CoachingScoreCandidate[];
  repEmail?: string;
  callDate?: string;
}): CoachingCallScore | null {
  if (!sourceRecordId || !repEmail || !callDate || !Number.isFinite(Date.parse(callDate))) return null;
  // Source identity, immutable versioned ID, rep identity and call time must all agree.
  // The current score store does not contain the legacy Automation Key/Status fields.
  void automationKey;

  if (candidates.some(candidate => candidate.sourceRecordId === sourceRecordId && candidate.scorerVersion === COACHING_SCORE_SCORER_VERSION && candidate.id !== `${COACHING_SCORE_SCORER_VERSION}:${sourceRecordId}`)) return null;
  const matches = candidates.filter((candidate) =>
    candidate.sourceRecordId === sourceRecordId
      && candidate.id === `${COACHING_SCORE_SCORER_VERSION}:${sourceRecordId}`
      && candidate.repEmail?.trim().toLowerCase() === repEmail.trim().toLowerCase()
      && Date.parse(candidate.callDate || "") === Date.parse(callDate)
      && candidate.scorerVersion === COACHING_SCORE_SCORER_VERSION
      && candidate.callType === "Call 2+"
      && (candidate.status === "" || candidate.status.toLowerCase() === "scored")
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

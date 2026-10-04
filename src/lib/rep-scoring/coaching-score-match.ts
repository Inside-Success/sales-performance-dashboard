import { CALL2_CURRENT_VERSION, CALL2_PREVIOUS_VERSION } from "./scorer-version";
export const COACHING_SCORE_SCORER_VERSION = CALL2_CURRENT_VERSION;
// A coaching report shows the score of the rubric that was current when its
// call was scored: v3 for new calls, v2 for reports scored before the v3
// release. Nothing older is ever shown to reps.
export const COACHING_SCORE_SCORER_VERSIONS = [CALL2_CURRENT_VERSION, CALL2_PREVIOUS_VERSION] as const;

export type CoachingScoreCandidate = {
  id: string;
  latestReviewed?: boolean;
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

  for (const version of COACHING_SCORE_SCORER_VERSIONS) {
    const result = selectForVersion(version, sourceRecordId, candidates, repEmail, callDate);
    if (result === "conflict") return null;
    if (result) return result;
  }
  return null;
}

function selectForVersion(version: string, sourceRecordId: string, candidates: CoachingScoreCandidate[], repEmail: string, callDate: string): CoachingCallScore | "conflict" | null {
  const expectedId = `${version}:${sourceRecordId}`;
  if (candidates.some(candidate => candidate.sourceRecordId === sourceRecordId && candidate.scorerVersion === version && candidate.id !== expectedId)) return "conflict";
  const matches = candidates.filter((candidate) =>
    candidate.latestReviewed === true
      && candidate.sourceRecordId === sourceRecordId
      && candidate.id === expectedId
      && candidate.repEmail?.trim().toLowerCase() === repEmail.trim().toLowerCase()
      && Date.parse(candidate.callDate || "") === Date.parse(callDate)
      && candidate.scorerVersion === version
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
  if (assessmentIds.size !== 1 || scores.size !== 1) return "conflict";
  return { assessmentId: matches[0].id, score: matches[0].score as number };
}

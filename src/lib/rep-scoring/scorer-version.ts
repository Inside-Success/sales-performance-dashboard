// Call 2 scorer versions. Each version is a separate cohort: scores from
// different rubrics are never averaged together. v1 (August) and v2
// (September 1 until the v3 release) remain stored in Airtable untouched.
export const CALL2_LEGACY_VERSION = "magic-mike-call2-evidence-score-v1";
export const CALL2_PREVIOUS_VERSION = "magic-mike-call2-evidence-score-v2";
export const CALL2_CURRENT_VERSION = "magic-mike-call2-evidence-score-v3";
export const CALL2_VERSIONS = [CALL2_LEGACY_VERSION, CALL2_PREVIOUS_VERSION, CALL2_CURRENT_VERSION] as const;
export function isCall2Version(version: string) {
  return (CALL2_VERSIONS as readonly string[]).includes(version);
}
export function scorecardVersion(historical = false) {
  return historical ? CALL2_PREVIOUS_VERSION : CALL2_CURRENT_VERSION;
}

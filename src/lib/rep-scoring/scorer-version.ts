export const CALL2_PREVIOUS_VERSION = "magic-mike-call2-evidence-score-v1";
export const CALL2_CURRENT_VERSION = "magic-mike-call2-evidence-score-v2";
export function isCall2Version(version: string) {
  return version === CALL2_PREVIOUS_VERSION || version === CALL2_CURRENT_VERSION;
}
export function scorecardVersion(historical = false) {
  void historical;
  return CALL2_CURRENT_VERSION;
}

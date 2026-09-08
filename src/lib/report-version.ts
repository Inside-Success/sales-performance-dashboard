// Generation identity avoids mislabeling delayed or in-flight reports at cutover.
export const ENHANCED_COACHING_VERSION = "magic-mike-call2-coaching-2026-09-08";

export type ReportVersion = "legacy" | "enhanced";

export function getReportVersion(coachingVersion: unknown): ReportVersion {
  return coachingVersion === ENHANCED_COACHING_VERSION ? "enhanced" : "legacy";
}

export function isEnhancedReport(coachingVersion: unknown) {
  return getReportVersion(coachingVersion) === "enhanced";
}

export function getReportVersionLabel(version: ReportVersion) {
  return version === "enhanced" ? "Enhanced" : "Legacy";
}

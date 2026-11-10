// Generation identity avoids mislabeling delayed or in-flight reports at cutover.
export const ENHANCED_COACHING_VERSION = "magic-mike-objection-coaching-2026-10-29";

export const LEGACY_FOUNDATIONS_COACHING_VERSION = "magic-mike-foundations-candidate-2026-11-06";
export const FOUNDATIONS_COACHING_VERSION = "magic-mike-tyler-coaching-2026-11-10";
// Forward-only switch. Deploying readers alone must not relabel existing reports.
const activeGeneration = [FOUNDATIONS_COACHING_VERSION, LEGACY_FOUNDATIONS_COACHING_VERSION].includes(process.env.NEXT_PUBLIC_COACHING_GENERATION || "")
  ? FOUNDATIONS_COACHING_VERSION : ENHANCED_COACHING_VERSION;

export type ReportVersion = "legacy" | "enhanced";

export function getReportVersion(coachingVersion: unknown, generation: string = activeGeneration): ReportVersion {
  return coachingVersion === generation ? "enhanced" : "legacy";
}

export function isEnhancedReport(coachingVersion: unknown) {
  return getReportVersion(coachingVersion) === "enhanced";
}

export function getReportVersionLabel(version: ReportVersion) {
  return version === "enhanced" ? "Enhanced" : "Legacy";
}

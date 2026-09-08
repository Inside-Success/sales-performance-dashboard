import { describe, expect, it } from "vitest";
import { ENHANCED_COACHING_VERSION, getReportVersion, isEnhancedReport } from "@/lib/report-version";

describe("coaching generation labels", () => {
  it("labels only the released coaching generation Enhanced", () => {
    expect(getReportVersion(ENHANCED_COACHING_VERSION)).toBe("enhanced");
    expect(isEnhancedReport(ENHANCED_COACHING_VERSION)).toBe(true);
  });
  it("keeps old, missing, malformed and unknown generation markers Legacy", () => {
    for (const marker of [undefined, null, "", "magic-mike-manual-candidate-2026-06-17", "2026-09-09T12:00:00Z", {}, true, "future-unverified-version"]) {
      expect(getReportVersion(marker)).toBe("legacy");
      expect(isEnhancedReport(marker)).toBe(false);
    }
  });
});

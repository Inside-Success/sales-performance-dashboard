import { describe, expect, it } from "vitest";
import { ENHANCED_COACHING_VERSION, getReportVersion, isEnhancedReport } from "@/lib/report-version";

describe("coaching generation labels", () => {
  it("labels only the released coaching generation Enhanced", () => {
    expect(getReportVersion(ENHANCED_COACHING_VERSION)).toBe("enhanced");
    expect(isEnhancedReport(ENHANCED_COACHING_VERSION)).toBe(true);
  });
  it("keeps old, missing, malformed and unknown generation markers Legacy", () => {
    for (const marker of [undefined, null, "", "magic-mike-call2-coaching-2026-09-08", "magic-mike-manual-candidate-2026-06-17", "2026-09-09T12:00:00Z", {}, true, "future-unverified-version"]) {
      expect(getReportVersion(marker)).toBe("legacy");
      expect(isEnhancedReport(marker)).toBe(false);
    }
  });
});

// A future explicit cutover changes labels by generation, never by completion time.
it("keeps delayed old-generation reports legacy after an explicit foundations cutover",()=>{
 expect(getReportVersion("magic-mike-objection-coaching-2026-10-29","magic-mike-foundations-candidate-2026-11-06")).toBe("legacy");
 expect(getReportVersion("magic-mike-foundations-candidate-2026-11-06","magic-mike-foundations-candidate-2026-11-06")).toBe("enhanced");
});
it('labels the Tyler release separately without moving historical reports into the new generation',()=>{
 expect(getReportVersion('magic-mike-tyler-coaching-2026-11-10','magic-mike-tyler-coaching-2026-11-10')).toBe('enhanced');
 expect(getReportVersion('magic-mike-foundations-candidate-2026-11-06','magic-mike-tyler-coaching-2026-11-10')).toBe('legacy');
});

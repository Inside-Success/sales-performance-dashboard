import { describe, expect, it } from "vitest";
import { resolveManualReportStatus } from "@/lib/manual-reports";
import type { ManualFeedbackReport } from "@/lib/types";

const report = (status: ManualFeedbackReport["status"], updatedAt = "2026-09-08T12:00:00Z") =>
  ({ status, created_at: updatedAt, updated_at: updatedAt, refusal_reason: null }) as ManualFeedbackReport;

describe("manual coaching callback window", () => {
  it("continues waiting while evidence checks run beyond five minutes", () => {
    expect(resolveManualReportStatus(report("processing"), new Date("2026-09-08T12:10:00Z")).status).toBe("processing");
  });
  it("still reports a missing callback after fifteen minutes", () => {
    expect(resolveManualReportStatus(report("processing"), new Date("2026-09-08T12:16:00Z")).status).toBe("failed");
  });
  it("uses the latest update and preserves terminal results", () => {
    expect(resolveManualReportStatus(report("processing", "2026-09-08T12:10:00Z"), new Date("2026-09-08T12:20:00Z")).status).toBe("processing");
    for (const status of ["completed", "refused", "failed", "needs_transcript_paste"] as const) {
      expect(resolveManualReportStatus(report(status), new Date("2026-09-09T12:00:00Z")).status).toBe(status);
    }
  });
});

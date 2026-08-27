import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("manager dashboard population and presentation rules", () => {
  it("uses an automatic 30-day activity cohort instead of a maintained roster", () => {
    const databaseSource = source("src/lib/db.ts");
    const salesSource = source("src/lib/sales-correlation.ts");

    expect(databaseSource).toContain("coalesce(call_date, created_at) >= now() - interval '30 days'");
    expect(salesSource).toContain("const ACTIVE_REP_DAYS = 30");
    expect(salesSource).toContain("inactiveRepCount");
  });

  it("keeps supporting detail available without putting it in the default manager view", () => {
    expect(source("src/app/manager/usage/page.tsx")).toContain("Operational details");
    expect(source("src/app/manager/sales-correlation/page.tsx")).toContain(
      "Detailed analysis and rep table",
    );
  });

  it("shows an auditable engaged-report count instead of an invalid rate", () => {
    const pageSource = source("src/app/manager/sales-correlation/page.tsx");
    const analyticsSource = source("src/lib/sales-correlation.ts");

    expect(pageSource).toContain('label="Reports engaged"');
    expect(pageSource).not.toContain('label="Engaged rate"');
    expect(analyticsSource).toContain("totalEngagedReports");
    expect(analyticsSource).not.toContain("avgUsageRate");
  });

  it("removes financial estimates from the visible rep no-show experience", () => {
    const pageSource = source("src/app/manager/rep-no-show/page.tsx");
    const chatSource = source("src/lib/rep-no-show-chat.ts");

    expect(pageSource).not.toContain("Opportunity at risk");
    expect(pageSource).not.toContain("formatCurrency");
    expect(chatSource).toContain("Do not estimate financial impact");
    expect(chatSource).not.toContain("Average package value assumption");
  });
});

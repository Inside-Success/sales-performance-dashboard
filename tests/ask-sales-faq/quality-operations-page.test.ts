import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(
  new URL("../../src/app/ask-sales-faq/admin/page.tsx", import.meta.url),
  "utf8",
);
const dbSource = readFileSync(
  new URL("../../src/lib/db.ts", import.meta.url),
  "utf8",
);

describe("Ask Sales quality and operations simplification", () => {
  it("uses manual review language and removes the retired automated review console", () => {
    expect(pageSource).toContain("Manual review only");
    expect(pageSource).toContain("old nightly AI quality audit is retired");
    expect(pageSource).not.toContain("QualityReviewConsole");
    expect(pageSource).not.toContain("Investigation queue");
  });

  it("keeps safe routes visible without classifying them as attention items", () => {
    expect(pageSource).toContain("These are not failures");
    expect(pageSource).toContain("Safe routes remain in the conversation log below");

    const reviewCountEnd = dbSource.indexOf("::int as review_items");
    const reviewCountStart = dbSource.lastIndexOf("count(*) filter (", reviewCountEnd);
    const reviewCountSql = dbSource.slice(reviewCountStart, reviewCountEnd);
    expect(reviewCountSql).not.toContain("or needs_route");
    expect(reviewCountSql).not.toContain("route_from_approved_article");
    expect(reviewCountSql).toContain("f.rating = 'down'");
  });

  it("keeps technical trace fields available but collapsed", () => {
    expect(pageSource).toContain("<summary className=\"cursor-pointer font-bold text-slate-600\">Technical details</summary>");
    expect(pageSource).toContain("Knowledge source");
  });
});

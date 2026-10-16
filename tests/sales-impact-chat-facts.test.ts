import { expect, it } from "vitest";
import { analyzeSalesImpact } from "../src/lib/sales-impact-analysis";
import {
  buildSalesImpactPresetAnswer,
  buildCurrentSalesImpactChatMessages,
} from "../src/lib/sales-analytics-chat";
it("keeps the no-open baseline distinct from all-users and subsequent sales distinct from before/after", () => {
  const a = analyzeSalesImpact(
    [],
    [],
    [],
    30,
    new Date("2026-10-14T16:00:00Z"),
  );
  a.groups = [
    { key: "high", count: 7, average: 8071, median: 7500 },
    { key: "low", count: 12, average: 5625, median: 2500 },
    { key: "medium", count: 1, average: 1000, median: 1000 },
    { key: "none", count: 58, average: 10116, median: 3000 },
  ];
  a.beforeAfter = {
    count: 27,
    before: 10176,
    after: 18037,
    difference: 7861,
    medianDifference: 7500,
    waiting: 7,
  };
  a.subsequent = {
    count: 23,
    before: 4022,
    after: 2830,
    difference: -1192,
    medianDifference: -667,
    waiting: 0,
  };
  const answer = buildSalesImpactPresetAnswer(a, "Summarize this page.")!;
  expect(answer).toContain("0 opens: $10,116 (58 matched reps)");
  expect(answer).toContain(
    "$2,830 in the 14 days after open weeks versus $4,022 after no-open weeks",
  );
  expect(answer).not.toContain("all-user average");
  expect(answer).toContain("$7,861 difference");
  const context = JSON.parse(
    buildCurrentSalesImpactChatMessages(a, [])[1].content.split("\n")[1],
  );
  expect(context.samePeriod21PlusVsNoOpen.baseline).toBe(
    "reps with no recorded own opens",
  );
  expect(context.subsequent.next14DaysAfterOpenWeeks).toBe(2830);
  expect(context.subsequent.before).toBeUndefined();
  expect(buildSalesImpactPresetAnswer(a, "Explain a specific rep")).toBeNull();
});

import { describe, expect, it } from "vitest";
import {
  analyzeSalesImpact,
  miamiDay,
  shiftDay,
  type ImpactReport,
  type ImpactSale,
} from "../src/lib/sales-impact-analysis";
const now = new Date("2026-10-14T16:00:00Z");
const report = (
  id: number,
  name = "Alice",
  date = "2026-09-01T16:00:00Z",
): ImpactReport => ({
  id,
  rep_name: name,
  rep_slug: name.toLowerCase(),
  created_at: date,
  call_date: "2026-10-01T16:00:00Z",
});
const sale = (
  dateKey: string,
  amount: number,
  repName = "Alice",
  paymentStatus = "Paid",
  paymentType = "New",
): ImpactSale => ({
  dateKey,
  amount,
  repName,
  repSlug: repName.toLowerCase(),
  paymentStatus,
  paymentType,
});
const open = (
  report_id: number,
  date = "2026-10-01T16:00:00Z",
  name = "alice",
) => ({ report_id, created_at: date, rep_slug: name });
describe("sales impact read model", () => {
  it("uses complete Miami days across DST and excludes today", () => {
    expect(miamiDay("2026-10-14T02:00:00Z")).toBe("2026-10-13");
    expect(shiftDay("2026-11-01", 1)).toBe("2026-11-02");
    const a = analyzeSalesImpact(
      [report(1)],
      [],
      [sale("2026-10-13", 50), sale("2026-10-14", 500)],
      7,
      now,
    );
    expect([a.start, a.end, a.reps[0].revenue]).toEqual([
      "2026-10-07",
      "2026-10-13",
      50,
    ]);
  });
  it("counts distinct own opens, rejects peer, pre-availability, future and invalid events", () => {
    const a = analyzeSalesImpact(
      [report(1), report(2)],
      [
        open(1),
        open(1),
        open(2),
        open(1, undefined, "bob"),
        open(1, "2026-08-01T16:00:00Z"),
        open(1, "2026-10-15T16:00:00Z"),
        open(1, "invalid"),
      ],
      [sale("2026-10-01", 100)],
      30,
      now,
    );
    expect(a.reps[0].opened).toBe(2);
    expect(a.reps[0].activeDays).toBe(1);
  });
  it("distinguishes unmatched sales identities from matched genuine zeros", () => {
    const a = analyzeSalesImpact(
      [report(1), report(2, "Bob"), report(3, "Carol")],
      [],
      [sale("2026-08-01", 5, "Bob"), sale("2026-10-01", 100, "Carol")],
      30,
      now,
    );
    expect(a.reps.find((r) => r.name === "Alice")?.revenue).toBeNull();
    expect(a.reps.find((r) => r.name === "Bob")?.revenue).toBe(0);
    expect(a.excludedUnmatched).toBe(1);
    expect(a.groups.find((g) => g.key === "none")?.average).toBe(50);
  });
  it("includes only finite positive New + Paid cash", () => {
    const a = analyzeSalesImpact(
      [report(1)],
      [],
      [
        sale("2026-10-01", 100),
        sale("2026-10-01", 500, "Alice", "Pending"),
        sale("2026-10-01", 700, "Alice", "Paid", "Recurring"),
        sale("2026-10-01", 900, "Alice", "Paid", "InitialRemaining"),
        sale("2026-10-01", NaN),
      ],
      30,
      now,
    );
    expect(a.reps[0].revenue).toBe(100);
    expect(a.reps[0].payments).toBe(1);
  });
  it("uses fixed boundaries independently of revenue, matching, repeated opens and other reps", () => {
    const counts = [0, 1, 5, 6, 20, 21, 100];
    const reports = counts.flatMap((n, i) =>
      Array.from({ length: Math.max(1, n) }, (_, j) =>
        report(i * 1000 + j, `Rep ${i}`),
      ),
    );
    const events = counts.flatMap((n, i) =>
      Array.from({ length: n }, (_, j) =>
        open(i * 1000 + j, undefined, `rep-${i}`),
      ),
    );
    events.push(...events);
    const a = analyzeSalesImpact(
      reports,
      events,
      counts
        .slice(0, -1)
        .map((_, i) => sale("2026-10-01", (6 - i) * 100, `Rep ${i}`)),
      30,
      now,
    );
    expect(
      counts.map((_, i) => a.reps.find((r) => r.name === `Rep ${i}`)?.group),
    ).toEqual(["none", "low", "low", "medium", "medium", "high", "high"]);
    expect(a.groups.map((g) => [g.key, g.count, g.average])).toEqual([
      ["none", 1, 600],
      ["low", 2, 450],
      ["medium", 2, 250],
      ["high", 1, 100],
    ]);
    expect(a.reps.find((r) => r.name === "Rep 6")?.revenue).toBeNull();
  });
  it("keeps empty groups null, matched zero-sales reps included, and a singleton sensitivity unavailable", () => {
    const a = analyzeSalesImpact(
      [report(1)],
      [open(1)],
      [sale("2026-08-01", 1)],
      30,
      now,
    );
    expect(a.groups.find((g) => g.key === "low")).toMatchObject({
      count: 1,
      average: 0,
      median: 0,
    });
    expect(a.groups.find((g) => g.key === "high")).toMatchObject({
      count: 0,
      average: null,
      median: null,
    });
    expect(a.sensitivity.highWithoutLargest).toBeNull();
  });
  it("distinguishes five of ten from five of fifty without old reports inflating coverage", () => {
    const reports = [10, 50].flatMap((n, i) =>
      Array.from({ length: n }, (_, j) =>
        report(i * 100 + j, i ? "Bob" : "Alice", "2026-10-07T04:00:00Z"),
      ),
    );
    reports.push(report(999), report(998, "Alice", "2026-10-14T04:00:00Z"));
    const events = [0, 1].flatMap((i) =>
      Array.from({ length: 5 }, (_, j) =>
        open(i * 100 + j, "2026-10-13T23:59:00Z", i ? "bob" : "alice"),
      ),
    );
    events.push(
      open(999, "2026-10-13T23:59:00Z"),
      open(0, "2026-10-13T23:59:00Z"),
      open(5, "2026-10-14T04:00:00Z"),
      open(6, "2026-10-13T23:59:00Z", "bob"),
    );
    const a = analyzeSalesImpact(reports, events, [], 7, now);
    expect(a.reps.find((r) => r.name === "Alice")).toMatchObject({
      opened: 6,
      received: 10,
      receivedOpened: 5,
      receivedOpenRate: 0.5,
      group: "medium",
    });
    expect(a.reps.find((r) => r.name === "Bob")).toMatchObject({
      opened: 5,
      received: 50,
      receivedOpened: 5,
      receivedOpenRate: 0.1,
      group: "low",
    });
    const b = analyzeSalesImpact([report(1)], [open(1)], [], 30, now);
    expect(b.reps[0]).toMatchObject({
      opened: 1,
      received: 0,
      receivedOpened: 0,
      receivedOpenRate: null,
    });
  });
  it("compares equal completed periods and excludes the first-open day", () => {
    const a = analyzeSalesImpact(
      [report(1)],
      [open(1, "2026-09-10T16:00:00Z")],
      [
        sale("2026-08-01", 1),
        sale("2026-09-09", 100),
        sale("2026-09-10", 999),
        sale("2026-09-11", 300),
      ],
      7,
      now,
    );
    expect(a.beforeAfter).toMatchObject({
      count: 1,
      before: 100,
      after: 300,
      difference: 200,
    });
  });
  it("does not treat incomplete follow-up or unavailable history as zero", () => {
    const a = analyzeSalesImpact(
      [report(1)],
      [open(1, "2026-10-10T16:00:00Z")],
      [sale("2026-08-01", 1)],
      7,
      now,
    );
    expect(a.beforeAfter).toMatchObject({
      count: 0,
      before: null,
      after: null,
      waiting: 1,
    });
    const b = analyzeSalesImpact(
      [report(1)],
      [open(1, "2026-09-10T16:00:00Z")],
      [sale("2026-09-11", 1)],
      7,
      now,
    );
    expect(b.beforeAfter.count).toBe(0);
  });
  it("uses usage first, then disjoint 14-day outcome blocks and pairs each rep equally", () => {
    const a = analyzeSalesImpact(
      [report(1, "Alice", "2026-07-01T16:00:00Z")],
      [open(1, "2026-07-20T16:00:00Z"), open(1, "2026-09-03T16:00:00Z")],
      [sale("2026-07-01", 1), sale("2026-09-12", 300), sale("2026-10-01", 100)],
      30,
      now,
    );
    // Blocks begin July 22, Aug 12, Sept 2, Sept 23. Sept 3 usage precedes Sept 9–22 sales.
    expect(a.subsequent.count).toBe(1);
    expect(a.subsequent.after).toBe(300);
    expect(a.subsequent.before).toBeCloseTo(100 / 3);
  });
  it("preserves stored report route slugs while normalizing known sales aliases", () => {
    const r = { ...report(1, "Ollie McFarl"), rep_slug: "ollie-mcfarl" };
    const a = analyzeSalesImpact(
      [r],
      [],
      [sale("2026-10-01", 100, "Ollie McFarlane")],
      30,
      now,
    );
    expect(a.reps[0]).toMatchObject({
      slug: "ollie-mcfarlane",
      reportSlug: "ollie-mcfarl",
      revenue: 100,
    });
  });
  it("does not classify a newly available today-only report as historical non-use", () => {
    expect(
      analyzeSalesImpact(
        [report(1, "Alice", "2026-10-14T10:00:00Z")],
        [],
        [sale("2026-10-01", 100)],
        30,
        now,
      ).reps,
    ).toHaveLength(0);
  });
});

it("normalizes database bigint report identifiers before cohort intersection", () => {
  const r = {
    ...report(1, "Alice", "2026-10-07T16:00:00Z"),
    id: "1" as unknown as number,
  };
  const e = {
    ...open(1, "2026-10-08T16:00:00Z"),
    report_id: "1" as unknown as number,
  };
  const a = analyzeSalesImpact(
    [r],
    [e, open(1, "2026-10-08T17:00:00Z")],
    [],
    7,
    now,
  );
  expect(a.reps[0]).toMatchObject({
    opened: 1,
    received: 1,
    receivedOpened: 1,
    receivedOpenRate: 1,
  });
});

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
    expect(a.groups[2].average).toBe(50);
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
  it("defines top-third groups by opens rather than revenue", () => {
    const reports = ["Alice", "Bob", "Carol", "Dan"].map((n, i) =>
      report(i + 1, n),
    );
    const events = [open(1), open(2), open(3), open(1, "2026-10-02T16:00:00Z")];
    // Repeat opening the same report does not change the count; days used break a tie.
    const a = analyzeSalesImpact(
      reports,
      events,
      reports.map((r) => sale("2026-10-01", r.id * 10000, r.rep_name)),
      30,
      now,
    );
    expect(a.reps.find((r) => r.group === "high")?.name).toBe("Alice");
    expect(a.groups[0].count).toBe(1);
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

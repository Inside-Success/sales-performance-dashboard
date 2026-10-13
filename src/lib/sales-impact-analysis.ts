import { slugify } from "./slug";

export type ImpactReport = {
  id: number;
  rep_slug: string;
  rep_name: string;
  created_at: string;
  call_date: string | null;
};
export type ImpactOpen = {
  report_id: number;
  rep_slug: string;
  created_at: string;
};
export type ImpactSale = {
  dateKey: string;
  repSlug: string;
  repName: string;
  amount: number;
  paymentStatus: string;
  paymentType: string;
};
export type ImpactGroup = "high" | "some" | "none";
export type ImpactRep = {
  slug: string;
  reportSlug: string;
  name: string;
  opened: number;
  received: number;
  activeDays: number;
  group: ImpactGroup;
  revenue: number | null;
  payments: number | null;
  firstOpen: string | null;
  before: number | null;
  after: number | null;
  waiting: boolean;
  trend: { label: string; revenue: number; opened: number }[];
};
export type ImpactComparison = {
  count: number;
  before: number | null;
  after: number | null;
  difference: number | null;
  medianDifference: number | null;
  waiting: number;
};
export type ImpactAnalysis = {
  days: number;
  start: string;
  end: string;
  reps: ImpactRep[];
  groups: {
    key: ImpactGroup;
    count: number;
    average: number | null;
    median: number | null;
  }[];
  beforeAfter: ImpactComparison;
  subsequent: ImpactComparison;
  excludedUnmatched: number;
  matched: number;
  opened: number;
  coverageStart: string | null;
  sensitivity: {
    highWithoutLargest: number | null;
    allUsers: number | null;
    none: number | null;
  };
  headline: string;
};

const DAY = 86400000;
const miamiFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export function miamiDay(value: string | Date) {
  const parts = miamiFormatter.formatToParts(new Date(value));
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function shiftDay(day: string, offset: number) {
  return new Date(Date.parse(day + "T12:00:00Z") + offset * DAY)
    .toISOString()
    .slice(0, 10);
}
export function impactRepKey(name: string) {
  const slug = slugify(name.replace(/\s+Success$/i, "").trim());
  return slug === "ollie-mcfarl" ? "ollie-mcfarlane" : slug;
}
function mean(values: number[]) {
  return values.length
    ? values.reduce((a, b) => a + b, 0) / values.length
    : null;
}
function median(values: number[]) {
  const s = [...values].sort((a, b) => a - b),
    n = s.length;
  return n ? (s[Math.floor(n / 2)] + s[Math.floor((n - 1) / 2)]) / 2 : null;
}
function summarizePairs(
  pairs: [number, number][],
  waiting = 0,
): ImpactComparison {
  const before = mean(pairs.map((p) => p[0])),
    after = mean(pairs.map((p) => p[1]));
  return {
    count: pairs.length,
    before,
    after,
    difference: before === null || after === null ? null : after - before,
    medianDifference: median(pairs.map((p) => p[1] - p[0])),
    waiting,
  };
}

/** Pure read model. Periods are complete Miami calendar days; no provider calls or source writes. */
export function analyzeSalesImpact(
  reports: ImpactReport[],
  events: ImpactOpen[],
  sales: ImpactSale[],
  days = 30,
  now = new Date(),
): ImpactAnalysis {
  const today = miamiDay(now),
    end = shiftDay(today, -1),
    start = shiftDay(today, -days),
    activeStart = shiftDay(today, -30);
  const preparedReports = reports
    .filter((r) => Number.isFinite(Date.parse(r.created_at)))
    .map((r) => ({
      ...r,
      key: impactRepKey(r.rep_name || r.rep_slug),
      createdDay: miamiDay(r.created_at),
      callDay: miamiDay(
        r.call_date && Number.isFinite(Date.parse(r.call_date))
          ? r.call_date
          : r.created_at,
      ),
    }));
  const reportById = new Map(preparedReports.map((r) => [Number(r.id), r]));
  const knownSales = new Set(
    sales.map((s) => impactRepKey(s.repName || s.repSlug)),
  );
  const paid = sales
    .filter(
      (s) =>
        s.paymentStatus.trim().toLowerCase() === "paid" &&
        s.paymentType.trim().toLowerCase() === "new" &&
        Number.isFinite(s.amount) &&
        s.amount > 0,
    )
    .map((s) => ({ ...s, key: impactRepKey(s.repName || s.repSlug) }));
  const sourceStart = sales.map((s) => s.dateKey).sort()[0] || null;
  const opens = events.flatMap((e) => {
    const report = reportById.get(Number(e.report_id));
    if (
      !report ||
      !Number.isFinite(Date.parse(e.created_at)) ||
      Date.parse(e.created_at) < Date.parse(report.created_at) ||
      Date.parse(e.created_at) > now.getTime() ||
      impactRepKey(e.rep_slug) !== impactRepKey(report.rep_slug)
    )
      return [];
    return [
      {
        ...e,
        rep_slug: impactRepKey(report.rep_name || report.rep_slug),
        day: miamiDay(e.created_at),
      },
    ];
  });
  const coverageStart = opens.map((e) => e.day).sort()[0] || null;
  const roster = new Map<string, { name: string; reportSlug: string }>();
  for (const r of preparedReports)
    if (r.callDay >= activeStart && r.callDay <= today && r.createdDay <= end)
      roster.set(r.key, { name: r.rep_name, reportSlug: r.rep_slug });
  const salesByRep = new Map<string, typeof paid>();
  for (const sale of paid) {
    const rows = salesByRep.get(sale.key) || [];
    rows.push(sale);
    salesByRep.set(sale.key, rows);
  }
  const opensByRep = new Map<string, typeof opens>();
  for (const open of opens) {
    const rows = opensByRep.get(open.rep_slug) || [];
    rows.push(open);
    opensByRep.set(open.rep_slug, rows);
  }
  const revenue = (slug: string, from: string, to: string) =>
    (salesByRep.get(slug) || [])
      .filter((s) => s.dateKey >= from && s.dateKey <= to)
      .reduce((sum, s) => sum + s.amount, 0);
  const count = (slug: string, from: string, to: string) =>
    (salesByRep.get(slug) || []).filter(
      (s) => s.dateKey >= from && s.dateKey <= to,
    ).length;
  const reps: ImpactRep[] = [...roster].map(([slug, { name, reportSlug }]) => {
    const own = opensByRep.get(slug) || [],
      windowOpens = own.filter((e) => e.day >= start && e.day <= end);
    const firstOpen = own.map((e) => e.day).sort()[0] || null;
    const afterStart = firstOpen ? shiftDay(firstOpen, 1) : null,
      afterEnd = firstOpen ? shiftDay(firstOpen, days) : null,
      beforeStart = firstOpen ? shiftDay(firstOpen, -days) : null;
    const matched = knownSales.has(slug),
      complete = !!(
        matched &&
        firstOpen &&
        afterEnd &&
        beforeStart &&
        afterEnd <= end &&
        sourceStart &&
        beforeStart >= sourceStart
      );
    const trend = Array.from({ length: 8 }, (_, i) => {
      const from = shiftDay(today, -7 * (8 - i)),
        to = shiftDay(from, 6);
      return {
        label: from,
        revenue: revenue(slug, from, to),
        opened: new Set(
          own
            .filter((e) => e.day >= from && e.day <= to)
            .map((e) => e.report_id),
        ).size,
      };
    });
    return {
      slug,
      reportSlug,
      name,
      opened: new Set(windowOpens.map((e) => e.report_id)).size,
      received: preparedReports.filter(
        (r) => r.key === slug && r.createdDay >= start && r.createdDay <= end,
      ).length,
      activeDays: new Set(windowOpens.map((e) => e.day)).size,
      group: "none",
      revenue: matched ? revenue(slug, start, end) : null,
      payments: matched ? count(slug, start, end) : null,
      firstOpen,
      before: complete
        ? revenue(slug, beforeStart!, shiftDay(firstOpen!, -1))
        : null,
      after: complete ? revenue(slug, afterStart!, afterEnd!) : null,
      waiting: !!(matched && afterEnd && afterEnd > end),
      trend,
    };
  });
  // Predefined top-third rule uses only deduplicated opens, never sales results.
  const users = reps
    .filter((r) => r.revenue !== null && r.opened > 0)
    .sort(
      (a, b) =>
        b.opened - a.opened ||
        b.activeDays - a.activeDays ||
        a.slug.localeCompare(b.slug),
    );
  const highN = Math.ceil(users.length / 3);
  users.forEach((r, i) => {
    r.group = i < highN ? "high" : "some";
  });
  for (const r of reps.filter((r) => r.revenue === null && r.opened > 0))
    r.group = "some";
  const groups = (["high", "some", "none"] as ImpactGroup[]).map((key) => {
    const values = reps
      .filter((r) => r.group === key && r.revenue !== null)
      .map((r) => r.revenue!);
    return {
      key,
      count: values.length,
      average: mean(values),
      median: median(values),
    };
  });
  const beforeAfter = summarizePairs(
    reps
      .filter((r) => r.before !== null && r.after !== null)
      .map((r) => [r.before!, r.after!] as [number, number]),
    reps.filter((r) => r.waiting).length,
  );
  // Paired within-rep check: non-overlapping 21-day blocks (7 usage days + 14 outcome days).
  const subsequentPairs: [number, number][] = [];
  for (const rep of reps.filter((r) => r.revenue !== null)) {
    const used: number[] = [],
      unused: number[] = [];
    for (let block = 0; block < 4; block++) {
      const from = shiftDay(today, -21 * (block + 1)),
        usageEnd = shiftDay(from, 6),
        outcomeEnd = shiftDay(from, 20);
      if (
        !coverageStart ||
        from < coverageStart ||
        !sourceStart ||
        from < sourceStart
      )
        continue;
      const available = preparedReports.some(
        (r) => r.key === rep.slug && r.createdDay <= from,
      );
      if (!available) continue;
      const hasOpen = (opensByRep.get(rep.slug) || []).some(
        (e) => e.day >= from && e.day <= usageEnd,
      );
      (hasOpen ? used : unused).push(
        revenue(rep.slug, shiftDay(usageEnd, 1), outcomeEnd),
      );
    }
    if (used.length && unused.length)
      subsequentPairs.push([mean(unused)!, mean(used)!]);
  }
  const subsequent = summarizePairs(subsequentPairs);
  const high = groups[0],
    none = groups[2],
    gap =
      high.average !== null && none.average !== null
        ? high.average - none.average
        : null;
  const dollars = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(Math.abs(n));
  const headline =
    gap === null
      ? "More matched usage and sales data is needed for a comparison."
      : gap > 0
        ? `High-usage reps averaged ${dollars(gap)} more in new paid revenue than reps with no recorded own opens.`
        : gap < 0
          ? `High-usage reps averaged ${dollars(gap)} less in new paid revenue than reps with no recorded own opens.`
          : "High-usage and no-open reps averaged the same new paid revenue.";
  const highSales = reps
    .filter((r) => r.group === "high" && r.revenue !== null)
    .map((r) => r.revenue!)
    .sort((a, b) => b - a);
  return {
    days,
    start,
    end,
    reps: reps.sort(
      (a, b) =>
        (b.revenue ?? -1) - (a.revenue ?? -1) || a.name.localeCompare(b.name),
    ),
    groups,
    beforeAfter,
    subsequent,
    excludedUnmatched: reps.filter((r) => r.revenue === null).length,
    matched: reps.filter((r) => r.revenue !== null).length,
    opened: reps.reduce((s, r) => s + r.opened, 0),
    coverageStart,
    sensitivity: {
      highWithoutLargest: mean(highSales.slice(1)),
      allUsers: mean(users.map((r) => r.revenue!)),
      none: none.average,
    },
    headline,
  };
}

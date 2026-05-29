import { getSalesCorrelationUsageData } from "@/lib/db";
import { slugify } from "@/lib/slug";
import type { SalesCorrelationUsageEvent } from "@/lib/types";

const DEFAULT_SALES_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1lBdE_LUKI8rzTvYc5vztSwKROJ7uIAOb5mNT9s4PeLA/gviz/tq?tqx=out:csv&sheet=Main";
const HISTORY_DAYS = 120;
const LAG_DAYS = 14;

export const SALES_CORRELATION_WINDOWS = [7, 14, 30, 90] as const;
export type SalesCorrelationWindow = (typeof SALES_CORRELATION_WINDOWS)[number];
export type UsageGroupKey = "high" | "medium" | "low";

type SalesPaymentRow = {
  date: Date;
  dateKey: string;
  paymentStatus: string;
  paymentType: string;
  amount: number;
  repName: string;
  repSlug: string;
  showName: string;
  contractSigned: boolean;
};

export type SalesCorrelationRep = {
  repName: string;
  repSlug: string;
  usageGroup: UsageGroupKey;
  generatedReports: number;
  viewedReports: number;
  viewedReportsWindow: number;
  reportViewsWindow: number;
  reportViewsAll: number;
  reportClicksWindow: number;
  repSelectionsWindow: number;
  linkClicksWindow: number;
  usageSignalsWindow: number;
  usageSignalsAll: number;
  usageRate: number;
  newPaidRevenueWindow: number;
  newPaidDealsWindow: number;
  totalPaidRevenueWindow: number;
  recurringPaidRevenueWindow: number;
  contractSignedWindow: number;
  newPaidRevenueAll: number;
  beforeUsageNewRevenue: number;
  afterUsageNewRevenue: number;
  firstActivityAt: string | null;
  lastActivityAt: string | null;
  hasUsageData: boolean;
  hasSalesData: boolean;
};

export type SalesCorrelationGroup = {
  key: UsageGroupKey;
  label: string;
  description: string;
  repCount: number;
  activeReps: number;
  totalNewRevenue: number;
  avgNewRevenue: number;
  totalNewDeals: number;
  avgNewDeals: number;
  avgUsageRate: number;
  totalUsageSignals: number;
};

export type SalesCorrelationWeeklyPoint = {
  weekStart: string;
  label: string;
  usageSignals: number;
  activeReps: number;
  newPaidRevenue: number;
  newPaidDeals: number;
};

export type SalesCorrelationLaggedImpact = {
  correlation: number | null;
  pairCount: number;
  activeWeekCount: number;
  inactiveWeekCount: number;
  avgRevenueAfterActiveWeek: number;
  avgRevenueAfterInactiveWeek: number;
  lagDays: number;
};

export type SalesCorrelationSummary = {
  periodDays: SalesCorrelationWindow;
  generatedAt: string;
  salesRowsRead: number;
  paidRowsRead: number;
  newPaidRowsRead: number;
  latestSalesDate: string | null;
  usageConfigured: boolean;
  sheetConfigured: boolean;
  usageError?: string;
  sheetError?: string;
  totalNewRevenue: number;
  totalNewDeals: number;
  totalRecurringRevenue: number;
  repsWithUsage: number;
  repsWithNewSales: number;
  matchedRepCount: number;
  correlation: number | null;
  correlationPairs: number;
  insight: string;
};

export type SalesCorrelationAnalytics = {
  summary: SalesCorrelationSummary;
  groups: SalesCorrelationGroup[];
  reps: SalesCorrelationRep[];
  weekly: SalesCorrelationWeeklyPoint[];
  laggedImpact: SalesCorrelationLaggedImpact;
  unmatchedSalesReps: SalesCorrelationRep[];
};

export function normalizeSalesCorrelationWindow(value: string | string[] | undefined): SalesCorrelationWindow {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsed = Number(rawValue);
  return SALES_CORRELATION_WINDOWS.includes(parsed as SalesCorrelationWindow)
    ? (parsed as SalesCorrelationWindow)
    : 30;
}

export async function getSalesCorrelationAnalytics(
  periodDays: SalesCorrelationWindow = 30,
): Promise<SalesCorrelationAnalytics> {
  const generatedAt = new Date();
  const windowEnd = addDays(startOfUtcDay(generatedAt), 1);
  const windowStart = addDays(windowEnd, -periodDays);

  const [usageData, salesResult] = await Promise.all([
    getSalesCorrelationUsageData(HISTORY_DAYS, periodDays),
    getSalesRows(),
  ]);

  const salesRows = salesResult.rows;
  const paidRows = salesRows.filter(isPaidRow);
  const newPaidRows = paidRows.filter(isNewPaymentRow);
  const salesByRep = groupSalesRowsByRep(salesRows);
  const usageByRep = new Map(usageData.rows.map((row) => [row.rep_slug, row]));
  const salesRepNames = getSalesRepNames(salesRows);
  const repSlugs = new Set([...usageByRep.keys(), ...salesByRep.keys()]);

  const baseReps = Array.from(repSlugs)
    .map((repSlug) => {
      const usage = usageByRep.get(repSlug);
      const repSalesRows = salesByRep.get(repSlug) || [];
      const repName = usage?.rep_name || salesRepNames.get(repSlug) || repSlug;
      const windowSales = summarizeSalesRows(repSalesRows, windowStart, windowEnd);
      const allSales = summarizeSalesRows(repSalesRows);
      const firstActivityAt = usage?.first_activity_at || null;
      const beforeAfter = summarizeBeforeAfterUsage(repSalesRows, firstActivityAt, periodDays);
      const generatedReports = usage?.generated_reports || 0;
      const viewedReports = usage?.viewed_reports || 0;
      const usageSignalsWindow =
        (usage?.report_views_window || 0) +
        (usage?.report_clicks_window || 0) +
        (usage?.rep_selections_window || 0) +
        (usage?.link_clicks_window || 0);

      return {
        repName,
        repSlug,
        usageGroup: "low" as UsageGroupKey,
        generatedReports,
        viewedReports,
        viewedReportsWindow: usage?.viewed_reports_window || 0,
        reportViewsWindow: usage?.report_views_window || 0,
        reportViewsAll: usage?.report_views_all || 0,
        reportClicksWindow: usage?.report_clicks_window || 0,
        repSelectionsWindow: usage?.rep_selections_window || 0,
        linkClicksWindow: usage?.link_clicks_window || 0,
        usageSignalsWindow,
        usageSignalsAll: usage?.usage_events_all || 0,
        usageRate: generatedReports ? viewedReports / generatedReports : 0,
        newPaidRevenueWindow: windowSales.newPaidRevenue,
        newPaidDealsWindow: windowSales.newPaidDeals,
        totalPaidRevenueWindow: windowSales.totalPaidRevenue,
        recurringPaidRevenueWindow: windowSales.recurringPaidRevenue,
        contractSignedWindow: windowSales.contractSigned,
        newPaidRevenueAll: allSales.newPaidRevenue,
        beforeUsageNewRevenue: beforeAfter.beforeNewPaidRevenue,
        afterUsageNewRevenue: beforeAfter.afterNewPaidRevenue,
        firstActivityAt,
        lastActivityAt: usage?.last_activity_at || null,
        hasUsageData: Boolean(usage),
        hasSalesData: repSalesRows.length > 0,
      };
    })
    .filter(
      (rep) =>
        rep.generatedReports > 0 ||
        rep.usageSignalsWindow > 0 ||
        rep.newPaidRevenueWindow > 0 ||
        rep.totalPaidRevenueWindow > 0 ||
        rep.newPaidRevenueAll > 0,
    );

  const groupBySlug = assignUsageGroups(baseReps);
  const reps = baseReps
    .map((rep) => ({
      ...rep,
      usageGroup: groupBySlug.get(rep.repSlug) || "low",
    }))
    .sort(sortRepRows);
  const groups = buildGroups(reps);
  const correlationPairs = reps
    .filter((rep) => rep.generatedReports > 0 || rep.usageSignalsWindow > 0 || rep.newPaidRevenueWindow > 0)
    .map((rep) => [rep.usageSignalsWindow, rep.newPaidRevenueWindow] as [number, number]);
  const correlation = pearson(correlationPairs);
  const weekly = buildWeeklyPoints(usageData.events, newPaidRows, generatedAt);
  const laggedImpact = buildLaggedImpact(reps, usageData.events, newPaidRows, generatedAt);
  const latestSalesDate = getLatestSalesDate(salesRows);
  const unmatchedSalesReps = reps
    .filter((rep) => rep.hasSalesData && !rep.hasUsageData && rep.newPaidRevenueWindow > 0)
    .sort((a, b) => b.newPaidRevenueWindow - a.newPaidRevenueWindow)
    .slice(0, 12);

  return {
    summary: {
      periodDays,
      generatedAt: generatedAt.toISOString(),
      salesRowsRead: salesRows.length,
      paidRowsRead: paidRows.length,
      newPaidRowsRead: newPaidRows.length,
      latestSalesDate: latestSalesDate ? latestSalesDate.toISOString() : null,
      usageConfigured: usageData.configured,
      sheetConfigured: salesResult.configured,
      usageError: usageData.error,
      sheetError: salesResult.error,
      totalNewRevenue: sum(reps.map((rep) => rep.newPaidRevenueWindow)),
      totalNewDeals: sum(reps.map((rep) => rep.newPaidDealsWindow)),
      totalRecurringRevenue: sum(reps.map((rep) => rep.recurringPaidRevenueWindow)),
      repsWithUsage: reps.filter((rep) => rep.usageSignalsWindow > 0).length,
      repsWithNewSales: reps.filter((rep) => rep.newPaidRevenueWindow > 0).length,
      matchedRepCount: reps.filter((rep) => rep.hasUsageData && rep.hasSalesData).length,
      correlation,
      correlationPairs: correlationPairs.length,
      insight: buildInsight(groups, correlation, correlationPairs.length, periodDays),
    },
    groups,
    reps,
    weekly,
    laggedImpact,
    unmatchedSalesReps,
  };
}

async function getSalesRows(): Promise<{
  configured: boolean;
  rows: SalesPaymentRow[];
  error?: string;
}> {
  const csvUrl = process.env.SALES_PERFORMANCE_CSV_URL || DEFAULT_SALES_CSV_URL;

  try {
    const response = await fetch(csvUrl, {
      cache: "no-store",
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      throw new Error(`Google Sheet read failed with status ${response.status}`);
    }

    return {
      configured: true,
      rows: parseSalesRows(await response.text()),
    };
  } catch (error) {
    console.error(error);
    return {
      configured: false,
      rows: [],
      error: "Sales sheet could not be read. The page only reads the Google Sheet and never writes to it.",
    };
  }
}

function parseSalesRows(csv: string): SalesPaymentRow[] {
  const table = parseCsv(csv);
  const [headers, ...rows] = table;
  if (!headers?.length) return [];

  const headerMap = new Map(headers.map((header, index) => [normalizeHeader(header), index]));
  const dateIndex = requireColumn(headerMap, "date");
  const statusIndex = requireColumn(headerMap, "payment status");
  const typeIndex = requireColumn(headerMap, "payment type (new/recurring)");
  const amountIndex = requireColumn(headerMap, "amount");
  const repIndex = requireColumn(headerMap, "sales rep");
  const showIndex = headerMap.get("show name") ?? -1;
  const contractIndex = headerMap.get("contract signed") ?? -1;

  return rows.flatMap((row) => {
    const repName = (row[repIndex] || "").trim();
    const date = parseSheetDate(row[dateIndex] || "");
    const amount = parseMoney(row[amountIndex] || "");

    if (!repName || !date || amount <= 0) return [];

    return {
      date,
      dateKey: toDateKey(date),
      paymentStatus: (row[statusIndex] || "").trim(),
      paymentType: (row[typeIndex] || "").trim(),
      amount,
      repName,
      repSlug: slugify(repName),
      showName: showIndex >= 0 ? (row[showIndex] || "").trim() : "",
      contractSigned: contractIndex >= 0 ? /^true$/i.test((row[contractIndex] || "").trim()) : false,
    };
  });
}

function parseCsv(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
      continue;
    }

    value += char;
  }

  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }

  return rows;
}

function requireColumn(headerMap: Map<string, number>, columnName: string) {
  const index = headerMap.get(columnName);
  if (typeof index !== "number") {
    throw new Error(`Missing required sales sheet column: ${columnName}`);
  }
  return index;
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function parseSheetDate(value: string) {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseMoney(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return 0;

  const isNegative = trimmed.startsWith("(") && trimmed.endsWith(")");
  const numeric = Number(trimmed.replace(/[,$()\s]/g, ""));
  if (Number.isNaN(numeric)) return 0;

  return isNegative ? -numeric : numeric;
}

function groupSalesRowsByRep(rows: SalesPaymentRow[]) {
  const map = new Map<string, SalesPaymentRow[]>();

  for (const row of rows) {
    const existing = map.get(row.repSlug) || [];
    existing.push(row);
    map.set(row.repSlug, existing);
  }

  return map;
}

function getSalesRepNames(rows: SalesPaymentRow[]) {
  const names = new Map<string, string>();

  for (const row of rows) {
    if (!names.has(row.repSlug)) {
      names.set(row.repSlug, row.repName);
    }
  }

  return names;
}

function summarizeSalesRows(rows: SalesPaymentRow[], start?: Date, end?: Date) {
  const scopedRows = rows.filter((row) => isInRange(row.date, start, end));
  const paidRows = scopedRows.filter(isPaidRow);
  const newPaidRows = paidRows.filter(isNewPaymentRow);
  const recurringPaidRows = paidRows.filter((row) => /^recurring$/i.test(row.paymentType));

  return {
    totalPaidRevenue: sum(paidRows.map((row) => row.amount)),
    newPaidRevenue: sum(newPaidRows.map((row) => row.amount)),
    newPaidDeals: newPaidRows.length,
    recurringPaidRevenue: sum(recurringPaidRows.map((row) => row.amount)),
    contractSigned: scopedRows.filter((row) => row.contractSigned).length,
  };
}

function summarizeBeforeAfterUsage(
  rows: SalesPaymentRow[],
  firstActivityAt: string | null,
  periodDays: number,
) {
  if (!firstActivityAt) {
    return {
      beforeNewPaidRevenue: 0,
      afterNewPaidRevenue: 0,
    };
  }

  const firstActivity = new Date(firstActivityAt);
  if (Number.isNaN(firstActivity.getTime())) {
    return {
      beforeNewPaidRevenue: 0,
      afterNewPaidRevenue: 0,
    };
  }

  const activityDay = startOfUtcDay(firstActivity);
  const beforeStart = addDays(activityDay, -periodDays);
  const afterEnd = addDays(activityDay, periodDays);
  const newPaidRows = rows.filter(isPaidRow).filter(isNewPaymentRow);

  return {
    beforeNewPaidRevenue: sum(
      newPaidRows
        .filter((row) => row.date >= beforeStart && row.date < activityDay)
        .map((row) => row.amount),
    ),
    afterNewPaidRevenue: sum(
      newPaidRows
        .filter((row) => row.date >= activityDay && row.date < afterEnd)
        .map((row) => row.amount),
    ),
  };
}

function assignUsageGroups(reps: Omit<SalesCorrelationRep, "usageGroup">[]) {
  const groupBySlug = new Map<string, UsageGroupKey>();
  const active = reps
    .filter((rep) => rep.usageSignalsWindow > 0)
    .sort((a, b) => b.usageSignalsWindow - a.usageSignalsWindow);

  const highCount = active.length ? Math.max(1, Math.ceil(active.length / 3)) : 0;

  active.forEach((rep, index) => {
    groupBySlug.set(rep.repSlug, index < highCount ? "high" : "medium");
  });

  for (const rep of reps) {
    if (!groupBySlug.has(rep.repSlug)) {
      groupBySlug.set(rep.repSlug, "low");
    }
  }

  return groupBySlug;
}

function buildGroups(reps: SalesCorrelationRep[]): SalesCorrelationGroup[] {
  return [
    buildGroup(reps, "high", "High usage", "Top third of active reps in this window."),
    buildGroup(reps, "medium", "Some usage", "Active reps outside the top usage group."),
    buildGroup(reps, "low", "Low or no usage", "No recent official usage signals."),
  ];
}

function buildGroup(
  reps: SalesCorrelationRep[],
  key: UsageGroupKey,
  label: string,
  description: string,
): SalesCorrelationGroup {
  const groupReps = reps.filter((rep) => rep.usageGroup === key);
  const generatedReps = groupReps.filter((rep) => rep.generatedReports > 0);
  const totalNewRevenue = sum(groupReps.map((rep) => rep.newPaidRevenueWindow));
  const totalNewDeals = sum(groupReps.map((rep) => rep.newPaidDealsWindow));

  return {
    key,
    label,
    description,
    repCount: groupReps.length,
    activeReps: groupReps.filter((rep) => rep.usageSignalsWindow > 0).length,
    totalNewRevenue,
    avgNewRevenue: groupReps.length ? totalNewRevenue / groupReps.length : 0,
    totalNewDeals,
    avgNewDeals: groupReps.length ? totalNewDeals / groupReps.length : 0,
    avgUsageRate: generatedReps.length
      ? sum(generatedReps.map((rep) => rep.usageRate)) / generatedReps.length
      : 0,
    totalUsageSignals: sum(groupReps.map((rep) => rep.usageSignalsWindow)),
  };
}

function buildWeeklyPoints(
  usageEvents: SalesCorrelationUsageEvent[],
  newPaidRows: SalesPaymentRow[],
  now: Date,
): SalesCorrelationWeeklyPoint[] {
  const weekStarts = getRecentWeekStarts(now, 8);

  return weekStarts.map((weekStart) => {
    const weekEnd = addDays(weekStart, 7);
    const eventsInWeek = usageEvents.filter(
      (event) => {
        const date = new Date(event.created_at);
        return eventCountsTowardUsage(event) && date >= weekStart && date < weekEnd;
      },
    );
    const salesInWeek = newPaidRows.filter((row) => row.date >= weekStart && row.date < weekEnd);
    const activeReps = new Set(eventsInWeek.map((event) => event.rep_slug));

    return {
      weekStart: weekStart.toISOString(),
      label: formatWeekLabel(weekStart),
      usageSignals: eventsInWeek.length,
      activeReps: activeReps.size,
      newPaidRevenue: sum(salesInWeek.map((row) => row.amount)),
      newPaidDeals: salesInWeek.length,
    };
  });
}

function buildLaggedImpact(
  reps: SalesCorrelationRep[],
  usageEvents: SalesCorrelationUsageEvent[],
  newPaidRows: SalesPaymentRow[],
  now: Date,
): SalesCorrelationLaggedImpact {
  const repSlugs = reps
    .filter((rep) => rep.generatedReports > 0 || rep.usageSignalsAll > 0 || rep.newPaidRevenueAll > 0)
    .map((rep) => rep.repSlug);
  const weekStarts = getRecentWeekStarts(now, 8).filter(
    (weekStart) => addDays(addDays(weekStart, 7), LAG_DAYS) <= addDays(startOfUtcDay(now), 1),
  );
  const pairs: Array<[number, number]> = [];
  let activeRevenueTotal = 0;
  let inactiveRevenueTotal = 0;
  let activeWeekCount = 0;
  let inactiveWeekCount = 0;

  for (const repSlug of repSlugs) {
    for (const weekStart of weekStarts) {
      const weekEnd = addDays(weekStart, 7);
      const salesEnd = addDays(weekEnd, LAG_DAYS);
      const usageSignals = usageEvents.filter((event) => {
        const date = new Date(event.created_at);
        return event.rep_slug === repSlug && eventCountsTowardUsage(event) && date >= weekStart && date < weekEnd;
      }).length;
      const nextRevenue = sum(
        newPaidRows
          .filter((row) => row.repSlug === repSlug && row.date >= weekEnd && row.date < salesEnd)
          .map((row) => row.amount),
      );

      pairs.push([usageSignals, nextRevenue]);
      if (usageSignals > 0) {
        activeWeekCount += 1;
        activeRevenueTotal += nextRevenue;
      } else {
        inactiveWeekCount += 1;
        inactiveRevenueTotal += nextRevenue;
      }
    }
  }

  return {
    correlation: pearson(pairs),
    pairCount: pairs.length,
    activeWeekCount,
    inactiveWeekCount,
    avgRevenueAfterActiveWeek: activeWeekCount ? activeRevenueTotal / activeWeekCount : 0,
    avgRevenueAfterInactiveWeek: inactiveWeekCount ? inactiveRevenueTotal / inactiveWeekCount : 0,
    lagDays: LAG_DAYS,
  };
}

function buildInsight(
  groups: SalesCorrelationGroup[],
  correlation: number | null,
  pairCount: number,
  periodDays: number,
) {
  const high = groups.find((group) => group.key === "high");
  const low = groups.find((group) => group.key === "low");

  if (!high?.repCount || !low?.repCount || pairCount < 3) {
    return `There is not enough matched usage and new sales data yet to call a reliable pattern for the last ${periodDays} days.`;
  }

  const difference = high.avgNewRevenue - low.avgNewRevenue;
  const correlationText = describeCorrelation(correlation);

  if (difference > 0) {
    return `High-usage reps are currently averaging ${formatCurrencyPlain(difference)} more new paid revenue than low/no-usage reps over the last ${periodDays} days. ${correlationText}`;
  }

  if (difference < 0) {
    return `High-usage reps are not ahead of low/no-usage reps in new paid revenue for the last ${periodDays} days. ${correlationText}`;
  }

  return `High-usage and low/no-usage reps are even on average new paid revenue for the last ${periodDays} days. ${correlationText}`;
}

function describeCorrelation(value: number | null) {
  if (value === null) return "The correlation sample is still too small.";
  if (value >= 0.5) return "The usage-to-sales relationship is strongly positive.";
  if (value >= 0.25) return "The usage-to-sales relationship is moderately positive.";
  if (value > 0.05) return "The usage-to-sales relationship is slightly positive.";
  if (value >= -0.05) return "The current correlation is mostly flat.";
  return "The current correlation is negative, so this should be reviewed before drawing conclusions.";
}

function pearson(pairs: Array<[number, number]>) {
  const scopedPairs = pairs.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (scopedPairs.length < 3) return null;

  const xs = scopedPairs.map(([x]) => x);
  const ys = scopedPairs.map(([, y]) => y);
  const meanX = sum(xs) / xs.length;
  const meanY = sum(ys) / ys.length;
  const numerator = sum(scopedPairs.map(([x, y]) => (x - meanX) * (y - meanY)));
  const denominatorX = Math.sqrt(sum(xs.map((x) => (x - meanX) ** 2)));
  const denominatorY = Math.sqrt(sum(ys.map((y) => (y - meanY) ** 2)));

  if (!denominatorX || !denominatorY) return null;
  return numerator / (denominatorX * denominatorY);
}

function sortRepRows(a: SalesCorrelationRep, b: SalesCorrelationRep) {
  return (
    b.newPaidRevenueWindow - a.newPaidRevenueWindow ||
    b.usageSignalsWindow - a.usageSignalsWindow ||
    b.generatedReports - a.generatedReports ||
    a.repName.localeCompare(b.repName)
  );
}

function isPaidRow(row: SalesPaymentRow) {
  return row.paymentStatus.trim().toLowerCase() === "paid";
}

function isNewPaymentRow(row: SalesPaymentRow) {
  return row.paymentType.trim().toLowerCase() === "new";
}

function eventCountsTowardUsage(event: SalesCorrelationUsageEvent) {
  return event.event_name !== "dashboard_home_viewed";
}

function isInRange(date: Date, start?: Date, end?: Date) {
  if (start && date < start) return false;
  if (end && date >= end) return false;
  return true;
}

function getLatestSalesDate(rows: SalesPaymentRow[]) {
  return rows.reduce<Date | null>((latest, row) => {
    if (!latest || row.date > latest) return row.date;
    return latest;
  }, null);
}

function getRecentWeekStarts(now: Date, count: number) {
  const currentWeek = getWeekStart(startOfUtcDay(now));
  return Array.from({ length: count }, (_, index) => addDays(currentWeek, -7 * (count - index - 1)));
}

function getWeekStart(date: Date) {
  const day = date.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return addDays(startOfUtcDay(date), mondayOffset);
}

function formatWeekLabel(weekStart: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(weekStart);
}

function formatCurrencyPlain(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

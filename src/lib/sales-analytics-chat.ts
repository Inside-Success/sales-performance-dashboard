import type { SalesCorrelationAnalytics } from "@/lib/sales-correlation";
import {
  IMPACT_GROUP_LABELS,
  type ImpactAnalysis,
} from "@/lib/sales-impact-analysis";

export function buildCurrentSalesImpactChatMessages(
  analytics: ImpactAnalysis,
  history: SalesAnalyticsChatMessage[],
) {
  const high = analytics.groups.find((g) => g.key === "high")!;
  const none = analytics.groups.find((g) => g.key === "none")!;
  return [
    {
      role: "system" as const,
      content:
        "You explain the current Magic Mike Sales Impact page to managers. Use only the supplied snapshot. Answer in 1–3 short sentences or up to four bullets. Usage means distinct own official reports opened, without a ten-second requirement; it does not mean learning was proven. New paid revenue is recorded cash, not contracted value or sales attributed to individual calls. State association, never causal lift or ROI. Never treat a null sales match or incomplete comparison as zero. Fixed groups are 0, 1–5, 6–20 and 21+ distinct own opens. Never use relative rankings or a top-third definition. Compare every group with its matched sample size. Report coverage is receivedOpened / reportsReceived: both received and opened in the selected period; zero received means unavailable. Old-report opens count in reportsOpened but not receivedOpened. Report coverage is not all-call coverage or time spent learning. Show the sample size when discussing a comparison, and mention conflicting evidence when relevant. When summarizing, lead with completed beforeAfter pairs when available, then mention the same-period groups and subsequent-sales check, including conflicting findings. The 21-plus-group gap compares 21+ opens with zero opens, never the all-users average. Empty groups have no comparison; small groups are descriptive only. The subsequent-sales check compares next-14-day sales after open weeks versus after no-open weeks; it is not a before/after-first-use comparison. Before/after and subsequent-sales comparisons are observational. RPC is not available. Do not give compliance, legal, report coaching or personnel decisions. If the snapshot cannot answer, say so.",
    },
    {
      role: "user" as const,
      content:
        "Current verified page snapshot:\n" +
        JSON.stringify({
          ...analytics,
          subsequent: {
            reps: analytics.subsequent.count,
            windowDays: 84,
            next14DaysAfterNoOpenWeeks: analytics.subsequent.before,
            next14DaysAfterOpenWeeks: analytics.subsequent.after,
            openMinusNoOpen: analytics.subsequent.difference,
            medianDifference: analytics.subsequent.medianDifference,
          },
          samePeriod21PlusVsNoOpen: {
            baseline: "reps with no recorded own opens",
            difference:
              high.average === null || none.average === null
                ? null
                : high.average - none.average,
          },
          repColumns: [
            "name",
            "reportsOpened",
            "reportsReceived",
            "receivedOpened",
            "receivedOpenRate",
            "newPaidRevenue",
            "group",
            "firstRecordedOpen",
            "before",
            "after",
            "waiting",
            "weeklyRevenue",
            "weeklyOpens",
          ],
          weekDates: analytics.reps[0]?.trend.map((t) => t.label) || [],
          reps: analytics.reps.map((rep) => [
            rep.name,
            rep.opened,
            rep.received,
            rep.receivedOpened,
            rep.receivedOpenRate,
            rep.revenue,
            rep.group,
            rep.firstOpen,
            rep.before,
            rep.after,
            rep.waiting,
            rep.revenue === null ? null : rep.trend.map((t) => t.revenue),
            rep.trend.map((t) => t.opened),
          ]),
        }),
    },
    ...history,
  ];
}

export type SalesAnalyticsChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export function buildSalesAnalyticsChatMessages(
  analytics: SalesCorrelationAnalytics,
  history: SalesAnalyticsChatMessage[],
) {
  return [
    {
      role: "system" as const,
      content: [
        "You are the Magic Mike Sales Impact analyst for Inside Success TV managers.",
        "Answer only questions about the supplied Magic Mike sales-impact analytics page data.",
        "Use only the supplied analytics snapshot. If the answer is not in the snapshot, say the page does not show that.",
        "Default to concise manager-ready answers: 1-3 sentences, or up to 4 bullets when a list is useful.",
        "Give a detailed breakdown only when the user explicitly asks for detail, a ranking, comparison, or action plan.",
        "Be careful with causation. Say correlation, signal, association, or directional pattern. Do not claim Magic Mike caused sales increases.",
        "Always evaluate actual usage data age separately from the selected window. A 30-day or 90-day selected window is not enough if the actual tracked usage history is only a few days old.",
        "If actual usage tracking age is under 14 days, say it is too early for reliable conclusions, even when the selected page window is 30 or 90 days.",
        "Prioritize New + Paid sales. Treat recurring revenue as secondary context.",
        "Keep official Magic Mike usage separate from self-submitted feedback. Do not mix manual feedback into this analysis.",
        "Do not provide sales coaching advice, call transcript analysis, compliance feedback, legal guidance, or policy review.",
        "If asked about irrelevant topics, redirect to the sales-impact analytics page.",
        "Format cleanly with short paragraphs or simple markdown bullets. Do not return a wall of text.",
      ].join("\n"),
    },
    {
      role: "user" as const,
      content: buildAnalyticsContext(analytics),
    },
    ...history.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  ];
}

function buildAnalyticsContext(analytics: SalesCorrelationAnalytics) {
  const { summary, groups, reps, weekly, laggedImpact, unmatchedSalesReps } =
    analytics;
  const topReps = reps.slice(0, 120);

  return [
    "Current Magic Mike Sales Impact page snapshot:",
    `Selected period: last ${summary.periodDays} days`,
    `Generated at: ${summary.generatedAt}`,
    `Sales sheet configured: ${summary.sheetConfigured}`,
    `Usage database configured: ${summary.usageConfigured}`,
    `Official usage tracking started at: ${summary.firstUsageActivityAt || "not available"}`,
    `Latest official usage activity: ${summary.lastUsageActivityAt || "not available"}`,
    `Actual official usage tracking age: ${summary.usageTrackingAgeDays} days`,
    `Effective official usage coverage inside selected window: ${summary.effectiveUsageWindowDays} of ${summary.periodDays} days`,
    `Usage data maturity: ${summary.usageDataMaturity}`,
    `Valid sales rows read: ${summary.salesRowsRead}`,
    `Paid rows read: ${summary.paidRowsRead}`,
    `New paid rows read: ${summary.newPaidRowsRead}`,
    `Latest sales date: ${summary.latestSalesDate || "not available"}`,
    `Total new paid revenue: ${formatCurrency(summary.totalNewRevenue)}`,
    `Total new paid deals: ${summary.totalNewDeals}`,
    `Total recurring revenue, secondary context: ${formatCurrency(summary.totalRecurringRevenue)}`,
    `Reps with usage: ${summary.repsWithUsage}`,
    `Reps with new sales: ${summary.repsWithNewSales}`,
    `Matched rep count: ${summary.matchedRepCount}`,
    `Usage-sales correlation: ${formatNullableNumber(summary.correlation)}`,
    `Correlation samples: ${summary.correlationPairs}`,
    `Executive readout: ${summary.insight}`,
    "",
    "Usage groups:",
    ...groups.map((group) =>
      [
        `${group.label}:`,
        `rep count ${group.repCount}`,
        `active reps ${group.activeReps}`,
        `total new revenue ${formatCurrency(group.totalNewRevenue)}`,
        `average new revenue ${formatCurrency(group.avgNewRevenue)}`,
        `total new deals ${group.totalNewDeals}`,
        `average new deals ${formatNumber(group.avgNewDeals)}`,
        `distinct reports engaged in the selected window ${group.totalEngagedReports}`,
        `usage signals ${group.totalUsageSignals}`,
      ].join(" "),
    ),
    "",
    "Lagged impact:",
    `Correlation after usage weeks: ${formatNullableNumber(laggedImpact.correlation)}`,
    `Rep-week comparisons: ${laggedImpact.pairCount}`,
    `Active usage weeks: ${laggedImpact.activeWeekCount}`,
    `No-usage weeks: ${laggedImpact.inactiveWeekCount}`,
    `Average next revenue after usage week: ${formatCurrency(laggedImpact.avgRevenueAfterActiveWeek)}`,
    `Average next revenue after no-usage week: ${formatCurrency(laggedImpact.avgRevenueAfterInactiveWeek)}`,
    `Lag days: ${laggedImpact.lagDays}`,
    "",
    "Weekly usage and new sales:",
    ...weekly.map(
      (point) =>
        `${point.label}: usage signals ${point.usageSignals}, active reps ${point.activeReps}, new paid revenue ${formatCurrency(point.newPaidRevenue)}, new paid deals ${point.newPaidDeals}`,
    ),
    "",
    "Rep sales impact rows:",
    ...topReps.map((rep) =>
      [
        rep.repName,
        `group ${groupLabel(rep.usageGroup)}`,
        `generated reports ${rep.generatedReports}`,
        `viewed reports ${rep.viewedReports}`,
        `views in window ${rep.reportViewsWindow}`,
        `usage signals in window ${rep.usageSignalsWindow}`,
        `distinct reports engaged in the selected window ${rep.viewedReportsWindow}`,
        `new paid revenue ${formatCurrency(rep.newPaidRevenueWindow)}`,
        `new paid deals ${rep.newPaidDealsWindow}`,
        `recurring paid revenue ${formatCurrency(rep.recurringPaidRevenueWindow)}`,
        `before first usage revenue ${formatCurrency(rep.beforeUsageNewRevenue)}`,
        `after first usage revenue ${formatCurrency(rep.afterUsageNewRevenue)}`,
        `last activity ${rep.lastActivityAt || "no usage yet"}`,
      ].join(" | "),
    ),
    "",
    "Sales reps with new paid sales but no matching official usage:",
    unmatchedSalesReps.length
      ? unmatchedSalesReps
          .map(
            (rep) =>
              `${rep.repName}: ${formatCurrency(rep.newPaidRevenueWindow)} new paid sales`,
          )
          .join("\n")
      : "None shown.",
    "",
    "Interpretation guardrails:",
    "This page is an early directional analytics view, not causal proof.",
    "Small samples can move sharply, especially in the 7-day window.",
    "If actual official usage tracking age is less than the selected period, say the selected window is only partially populated.",
    "If usage data maturity is early, do not say there is enough data for reliable manager decisions.",
    "Use the 30-day and 90-day windows for more stable manager decisions.",
  ].join("\n");
}

function groupLabel(group: string) {
  if (group === "high") return "High usage";
  if (group === "medium") return "Some usage";
  return "Low/no usage";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
  }).format(value);
}

function formatNullableNumber(value: number | null) {
  return value === null ? "not enough data" : value.toFixed(2);
}

/** Preset numerical summaries come directly from the page facts, without an LLM reinterpreting baselines. */
export function buildSalesImpactPresetAnswer(
  a: ImpactAnalysis,
  question: string,
): string | null {
  const q = question
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/, "");
  const cash = (v: number | null) =>
    v === null ? "not available" : formatCurrency(v);
  const c = a.beforeAfter,
    s = a.subsequent,
    high = a.groups.find((g) => g.key === "high")!,
    none = a.groups.find((g) => g.key === "none")!;
  const before = c.count
    ? `For ${c.count} reps with complete ${a.days}-day periods around their first recorded coaching open, average new paid revenue was ${cash(c.before)} before and ${cash(c.after)} after (${cash(c.difference)} difference; median change ${cash(c.medianDifference)}).`
    : "No complete matched before/after comparison is available yet.";
  const gap =
    high.average === null || none.average === null
      ? null
      : high.average - none.average;
  const groups = `In the chart period (${a.start} to ${a.end}), average new paid revenue per rep by reports opened: ${a.groups.map((g) => `${IMPACT_GROUP_LABELS[g.key]}: ${g.count ? `${cash(g.average)} (${g.count} matched reps)` : "no reps in this period"}`).join("; ")}.${gap === null ? " No complete 21+/zero-open comparison is available." : ` The 21+ versus zero-open difference is ${cash(gap)} per rep.`}`;
  const subsequent = s.count
    ? `Across the last 12 weeks, ${s.count} matched reps averaged ${cash(s.after)} in the 14 days after open weeks versus ${cash(s.before)} after no-open weeks (${cash(s.difference)} difference).`
    : "There are no complete same-rep open-week/no-open-week comparisons yet.";
  const limit =
    "These are observational associations, not proof that coaching caused the sales difference.";
  if (q === "summarize this page")
    return `- ${before}\n- ${groups}\n- ${subsequent}\n\n${limit}`;
  if (
    q === "how do sales compare by reports opened" ||
    q === "are high-usage reps selling more"
  )
    return `${groups}\n\n${limit}`;
  if (q === "what changed after reps started using coaching")
    return `${before} First recorded opens occur on different dates for different reps. ${c.waiting ? `${c.waiting} reps are waiting for a complete follow-up period. ` : ""}${limit}`;
  if (q === "is this enough data to trust")
    return `The page has ${a.matched} matched active reps and ${c.count} complete before/after pairs. ${a.excludedUnmatched} unmatched sales identities are excluded from revenue comparisons, rather than treated as zero. This is useful descriptive evidence; sample sizes and other sales factors limit conclusions. ${limit}`;
  return null;
}

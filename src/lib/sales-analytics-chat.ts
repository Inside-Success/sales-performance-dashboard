import type { SalesCorrelationAnalytics } from "@/lib/sales-correlation";

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
  const { summary, groups, reps, weekly, laggedImpact, unmatchedSalesReps } = analytics;
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
        `average usage rate ${formatPercent(group.avgUsageRate)}`,
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
    ...weekly.map((point) =>
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
        `usage rate ${formatPercent(rep.usageRate)}`,
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
          .map((rep) => `${rep.repName}: ${formatCurrency(rep.newPaidRevenueWindow)} new paid sales`)
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

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatNullableNumber(value: number | null) {
  return value === null ? "not enough data" : value.toFixed(2);
}

import type { RepNoShowAnalytics } from "@/lib/rep-no-show";

export type RepNoShowChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export function buildRepNoShowChatMessages(
  analytics: RepNoShowAnalytics,
  history: RepNoShowChatMessage[],
) {
  return [
    {
      role: "system" as const,
      content: [
        "You are the Magic Mike rep no-show analyst for Inside Success TV managers.",
        "Answer only questions about the supplied rep no-show dashboard snapshot.",
        "Use only the supplied snapshot. If the answer is not in the snapshot, say the page does not show that.",
        "Default to concise manager-ready answers: 1-3 sentences, or up to 4 bullets when a list is useful.",
        "This page is attendance visibility for rep no-shows, not compliance review or legal analysis.",
        "Keep call number context clear. Rep no-shows can occur on any tracked call.",
        "Use the exact configured assumptions for close rate and minimum package value.",
        "Use phrases like estimated opportunity at risk, potential revenue protected, no-shows surfaced, and visibility created.",
        "Do not say confirmed sales were missed or saved. Do not claim Magic Mike caused revenue changes.",
        "If no-shows decreased, describe the reduction as potential revenue protected using the page formula.",
        "If the snapshot says prior comparison is unavailable, do not compare against older periods.",
        "If Airtable is not configured or no data is available, say that clearly and do not invent data.",
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

function buildAnalyticsContext(analytics: RepNoShowAnalytics) {
  const { summary, topReps, noShowLog, weekly } = analytics;
  const chatNoShowRows = noShowLog.slice(0, 50);

  return [
    "Current Magic Mike Rep No-Show Impact snapshot:",
    `Selected period: last ${summary.periodDays} days`,
    `Generated at: ${summary.generatedAt}`,
    `Call 1 tracking started at: ${summary.trackingStartedAt}`,
    `Effective period start after tracking cutoff: ${summary.effectivePeriodStart}`,
    `Prior-period comparison available: ${summary.comparisonAvailable}`,
    `Airtable read configured: ${summary.configured}`,
    `Data error: ${summary.error || "none"}`,
    `Records read from Airtable: ${summary.recordsRead}`,
    `Tracked sales calls in period: ${summary.eligibleCalls}`,
    `Tracked sales calls in previous period: ${summary.previousEligibleCalls}`,
    `Rep no-shows in period: ${summary.repNoShows}`,
    `Rep no-shows in previous period: ${summary.previousRepNoShows}`,
    `No-show count change vs previous period: ${summary.comparisonAvailable ? summary.weekOverWeekChange : "not available because Call 1 tracking was not active for the full prior period"}`,
    `Call 1 rep no-shows in period: ${summary.call1NoShows}`,
    `Call 2+ rep no-shows in period: ${summary.call2PlusNoShows}`,
    `Rep no-show rate in period: ${formatPercent(summary.noShowRate)}`,
    `Previous no-show rate: ${formatPercent(summary.previousNoShowRate)}`,
    `Close-rate assumption: ${formatPercent(summary.closeRate)}`,
    `Minimum package value assumption: ${formatCurrency(summary.minPackageValue)}`,
    `Estimated opportunity at risk: ${formatCurrency(summary.estimatedOpportunityAtRisk)}`,
    `Avoided no-shows vs previous period: ${summary.avoidedNoShows}`,
    `Estimated revenue protected: ${formatCurrency(summary.estimatedRevenueProtected)}`,
    "",
    "Top reps by no-show count:",
    topReps.length
      ? topReps
          .map((rep) =>
            [
              rep.repName,
              `tracked calls ${rep.eligibleCalls}`,
              `rep no-shows ${rep.noShows}`,
              `Call 1 no-shows ${rep.call1NoShows}`,
              `rate ${formatPercent(rep.noShowRate)}`,
              `estimated opportunity ${formatCurrency(rep.estimatedOpportunityAtRisk)}`,
              `latest ${rep.latestNoShowAt || "not available"}`,
            ].join(" | "),
          )
          .join("\n")
      : "No rep no-shows shown for the selected period.",
    "",
    `All detected no-show log count since tracking activation: ${noShowLog.length}`,
    "No-show log rows included below, newest first:",
    chatNoShowRows.length
      ? chatNoShowRows
          .map((call) =>
            [
              call.callDate || "date unavailable",
              call.repName,
              call.clientName,
              call.callNumber,
              call.attendanceStatus || "status unavailable",
              call.attendanceReason || "reason unavailable",
            ].join(" | "),
          )
          .join("\n")
      : "No rep no-shows have been detected since tracking activation.",
    noShowLog.length > chatNoShowRows.length
      ? `Additional no-show log rows not included in chat context: ${noShowLog.length - chatNoShowRows.length}`
      : "",
    "",
    "Weekly trend:",
    ...weekly.map((point) =>
      `${point.label}: tracked calls ${point.eligibleCalls}, rep no-shows ${point.noShows}, estimated opportunity ${formatCurrency(point.estimatedOpportunityAtRisk)}`,
    ),
    "",
    "Formula:",
    "Estimated opportunity at risk = rep no-shows x close-rate assumption x minimum package value.",
    "Estimated revenue protected = avoided no-shows vs previous period x close-rate assumption x minimum package value.",
    "Older records before the Call 1 tracking start are excluded from rate, trend, and prior-period comparison.",
    "",
    "Interpretation guardrails:",
    "These are conservative estimates, not confirmed missed sales.",
    "The manager should use this page for awareness, accountability, and follow-up prioritization.",
  ].join("\n");
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

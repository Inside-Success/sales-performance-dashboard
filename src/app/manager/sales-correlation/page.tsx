import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Clock3,
  DollarSign,
  Eye,
  FileSpreadsheet,
  LineChart,
  MousePointerClick,
  ShieldCheck,
  Target,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SalesAnalyticsChatPanel } from "@/components/dashboard/sales-analytics-chat-panel";
import { SalesImpactScatter } from "@/components/dashboard/sales-impact-scatter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMiamiDateTime } from "@/lib/format";
import {
  getSalesCorrelationAnalytics,
  normalizeSalesCorrelationWindow,
  SALES_CORRELATION_WINDOWS,
  type SalesCorrelationAnalytics,
  type SalesCorrelationGroup,
  type SalesCorrelationRep,
  type SalesCorrelationWeeklyPoint,
  type UsageGroupKey,
} from "@/lib/sales-correlation";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sales Impact | Magic Mike Bot",
  robots: {
    index: false,
    follow: false,
  },
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const numberFormatter = new Intl.NumberFormat("en-US");

export default async function SalesCorrelationPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string | string[] }>;
}) {
  const { days } = await searchParams;
  const periodDays = normalizeSalesCorrelationWindow(days);
  const analytics = await getSalesCorrelationAnalytics(periodDays);

  return (
    <main className="dashboard-page min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <header className="dashboard-card dashboard-hero rounded-2xl border bg-card/95 p-5 md:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="gap-1">
                  <ShieldCheck className="size-3.5" />
                  Hidden manager view
                </Badge>
                <Badge variant="outline" className="gap-1 bg-background/70">
                  <FileSpreadsheet className="size-3.5" />
                  Google Sheet read-only
                </Badge>
                {!analytics.summary.usageConfigured ? (
                  <Badge variant="destructive">Database not connected</Badge>
                ) : null}
                {!analytics.summary.sheetConfigured ? (
                  <Badge variant="destructive">Sales sheet unavailable</Badge>
                ) : null}
              </div>
              <h1 className="text-3xl font-semibold tracking-normal md:text-4xl">
                Magic Mike Sales Impact
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Read-only sales data is compared with official Magic Mike usage so managers can
                see whether dashboard adoption is moving with new paid sales.
              </p>
            </div>

            <div className="flex flex-col gap-2 text-sm text-muted-foreground lg:items-end">
              <PeriodSelector selectedDays={analytics.summary.periodDays} />
              <div className="inline-flex items-center gap-2 rounded-lg border bg-background/75 px-3 py-2">
                <Clock3 className="size-4 text-foreground" />
                Updated {formatMiamiDateTime(analytics.summary.generatedAt)}
              </div>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                <Link href="/manager/usage" className={cn(buttonVariants({ variant: "outline" }), "w-fit")}>
                  Usage dashboard
                </Link>
                <Link href="/" className={cn(buttonVariants({ variant: "outline" }), "w-fit")}>
                  Open dashboard
                </Link>
              </div>
            </div>
          </div>
        </header>

        <StatusMessages analytics={analytics} />

        <ExecutiveInsight analytics={analytics} />

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            icon={DollarSign}
            title="New paid revenue"
            value={formatCurrency(analytics.summary.totalNewRevenue)}
            description={`${formatNumber(analytics.summary.totalNewDeals)} new paid deals`}
          />
          <MetricCard
            icon={Users}
            title="Reps with usage"
            value={formatNumber(analytics.summary.repsWithUsage)}
            description={`${formatNumber(analytics.summary.matchedRepCount)} matched to sales sheet`}
          />
          <MetricCard
            icon={LineChart}
            title="Usage-sales correlation"
            value={formatCorrelation(analytics.summary.correlation)}
            description={`${formatNumber(analytics.summary.correlationPairs)} rep samples`}
          />
          <MetricCard
            icon={CalendarDays}
            title="Sales rows read"
            value={formatNumber(analytics.summary.salesRowsRead)}
            description={analytics.summary.latestSalesDate ? `Latest ${formatShortDate(analytics.summary.latestSalesDate)}` : "No sales rows"}
          />
        </section>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.7fr)]">
          <UsageGroupsCard groups={analytics.groups} periodDays={analytics.summary.periodDays} />
          <BeforeAfterCard reps={analytics.reps} periodDays={analytics.summary.periodDays} />
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.85fr)]">
          <WeeklyTrendCard weekly={analytics.weekly} />
          <LaggedImpactCard analytics={analytics} />
        </section>

        <section className="grid gap-5">
          <ScatterCard reps={analytics.reps} />
          <RepImpactTable reps={analytics.reps} periodDays={analytics.summary.periodDays} />
        </section>

        {analytics.unmatchedSalesReps.length ? (
          <UnmatchedSalesRepsCard reps={analytics.unmatchedSalesReps} />
        ) : null}

        <p className="text-xs leading-5 text-muted-foreground">
          This page shows association, not guaranteed causation. New paid sales are the primary KPI;
          recurring revenue is kept secondary so old deals do not overstate Magic Mike impact.
        </p>
        <SalesAnalyticsChatPanel periodDays={analytics.summary.periodDays} />
      </div>
    </main>
  );
}

function PeriodSelector({ selectedDays }: { selectedDays: number }) {
  return (
    <div className="inline-flex rounded-lg border bg-background/75 p-1">
      {SALES_CORRELATION_WINDOWS.map((days) => (
        <Link
          key={days}
          href={`/manager/sales-correlation?days=${days}`}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            selectedDays === days
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {days}d
        </Link>
      ))}
    </div>
  );
}

function StatusMessages({ analytics }: { analytics: SalesCorrelationAnalytics }) {
  const messages = [analytics.summary.usageError, analytics.summary.sheetError].filter(Boolean);
  if (!messages.length) return null;

  return (
    <div className="grid gap-2">
      {messages.map((message) => (
        <div
          key={message}
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {message}
        </div>
      ))}
    </div>
  );
}

function ExecutiveInsight({ analytics }: { analytics: SalesCorrelationAnalytics }) {
  const high = analytics.groups.find((group) => group.key === "high");
  const low = analytics.groups.find((group) => group.key === "low");

  return (
    <Card className="dashboard-card border bg-card/95">
      <CardContent className="grid gap-4 pt-1 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-center">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <TrendingUp className="size-3.5" />
              Executive readout
            </Badge>
            <Badge variant="outline">
              Last {analytics.summary.periodDays} days
            </Badge>
            <Badge variant="outline">
              Usage data {formatUsageHistory(
                analytics.summary.effectiveUsageWindowDays,
                analytics.summary.periodDays,
              )}
            </Badge>
          </div>
          <h2 className="text-2xl font-semibold tracking-normal">
            {analytics.summary.insight}
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
            This uses official coaching usage only. Self-submitted feedback and compliance signals are not mixed into this view.
          </p>
        </div>
        <div className="grid gap-2 rounded-xl border bg-background/70 p-3">
          <MiniStat
            label="High usage avg new sales"
            value={formatCurrency(high?.avgNewRevenue || 0)}
          />
          <MiniStat
            label="Low/no usage avg new sales"
            value={formatCurrency(low?.avgNewRevenue || 0)}
          />
          <MiniStat
            label="Recurring revenue tracked separately"
            value={formatCurrency(analytics.summary.totalRecurringRevenue)}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function MetricCard({
  icon: Icon,
  title,
  value,
  description,
}: {
  icon: LucideIcon;
  title: string;
  value: string;
  description: string;
}) {
  return (
    <Card className="dashboard-card border bg-card/95">
      <CardContent className="flex items-start justify-between gap-3 pt-1">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-semibold tracking-normal">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <span className="grid size-9 shrink-0 place-items-center rounded-lg border bg-background text-primary">
          <Icon className="size-4" />
        </span>
      </CardContent>
    </Card>
  );
}

function UsageGroupsCard({
  groups,
  periodDays,
}: {
  groups: SalesCorrelationGroup[];
  periodDays: number;
}) {
  const maxAverage = Math.max(1, ...groups.map((group) => group.avgNewRevenue));

  return (
    <Card className="dashboard-card border bg-card/95">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <Users className="size-4" />
          Usage Groups
        </CardTitle>
        <CardDescription>
          Reps are grouped by official Magic Mike usage in the last {periodDays} days.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {groups.map((group) => (
          <div key={group.key} className="rounded-xl border bg-background/70 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className={cn("size-2.5 rounded-full", groupDotClass(group.key))} />
                  <h3 className="font-semibold">{group.label}</h3>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{group.description}</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-semibold">{formatCurrency(group.avgNewRevenue)}</p>
                <p className="text-xs text-muted-foreground">avg new revenue</p>
              </div>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full", groupBarClass(group.key))}
                style={{ width: `${Math.max(3, Math.round((group.avgNewRevenue / maxAverage) * 100))}%` }}
              />
            </div>
            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-4">
              <MiniStat label="Reps" value={formatNumber(group.repCount)} />
              <MiniStat label="Usage signals" value={formatNumber(group.totalUsageSignals)} />
              <MiniStat label="New deals" value={formatNumber(group.totalNewDeals)} />
              <MiniStat label="View rate" value={formatPercent(group.avgUsageRate)} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function BeforeAfterCard({
  reps,
  periodDays,
}: {
  reps: SalesCorrelationRep[];
  periodDays: number;
}) {
  const eligible = reps.filter((rep) => rep.firstActivityAt);
  const avgBefore = eligible.length
    ? sum(eligible.map((rep) => rep.beforeUsageNewRevenue)) / eligible.length
    : 0;
  const avgAfter = eligible.length
    ? sum(eligible.map((rep) => rep.afterUsageNewRevenue)) / eligible.length
    : 0;
  const delta = avgAfter - avgBefore;

  return (
    <Card className="dashboard-card border bg-card/95">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <ArrowUpRight className="size-4" />
          Before vs After Usage
        </CardTitle>
        <CardDescription>
          Same-length windows around each rep&apos;s first official usage signal.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <SignalBox label={`${periodDays}d before first usage`} value={formatCurrency(avgBefore)} />
          <SignalBox label={`${periodDays}d after first usage`} value={formatCurrency(avgAfter)} />
        </div>
        <div className="rounded-xl border bg-background/70 p-4">
          <p className="text-sm text-muted-foreground">Average change</p>
          <p className={cn("mt-2 text-3xl font-semibold", delta >= 0 ? "text-primary" : "text-destructive")}>
            {delta >= 0 ? "+" : ""}
            {formatCurrency(delta)}
          </p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Based on {formatNumber(eligible.length)} reps with at least one tracked official usage signal.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function WeeklyTrendCard({ weekly }: { weekly: SalesCorrelationWeeklyPoint[] }) {
  const maxRevenue = Math.max(1, ...weekly.map((point) => point.newPaidRevenue));
  const maxUsage = Math.max(1, ...weekly.map((point) => point.usageSignals));

  return (
    <Card className="dashboard-card border bg-card/95">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="size-4" />
          Weekly Usage and New Sales
        </CardTitle>
        <CardDescription>
          A simple weekly read of usage signals alongside new paid revenue.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {weekly.map((point) => (
          <div key={point.weekStart} className="grid grid-cols-[4.5rem_minmax(0,1fr)_6.5rem] items-center gap-3">
            <span className="text-xs text-muted-foreground">{point.label}</span>
            <div className="grid gap-1">
              <div className="h-3 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary/85"
                  style={{ width: `${Math.round((point.newPaidRevenue / maxRevenue) * 100)}%` }}
                />
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted/80">
                <div
                  className="h-full rounded-full bg-accent-foreground/70"
                  style={{ width: `${Math.round((point.usageSignals / maxUsage) * 100)}%` }}
                />
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium">{formatCurrency(point.newPaidRevenue)}</p>
              <p className="text-[0.7rem] text-muted-foreground">
                {formatNumber(point.usageSignals)} signals
              </p>
            </div>
          </div>
        ))}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-primary" />
            New paid revenue
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-accent-foreground/70" />
            Usage signals
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function LaggedImpactCard({ analytics }: { analytics: SalesCorrelationAnalytics }) {
  const lag = analytics.laggedImpact;
  const delta = lag.avgRevenueAfterActiveWeek - lag.avgRevenueAfterInactiveWeek;

  return (
    <Card className="dashboard-card border bg-card/95">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <Activity className="size-4" />
          Lagged Impact Check
        </CardTitle>
        <CardDescription>
          Compares usage weeks with new sales in the following {lag.lagDays} days.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <SignalBox
          label="Correlation after usage weeks"
          value={formatCorrelation(lag.correlation)}
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <SignalBox
            label="Avg next revenue after usage week"
            value={formatCurrency(lag.avgRevenueAfterActiveWeek)}
          />
          <SignalBox
            label="Avg next revenue after no-usage week"
            value={formatCurrency(lag.avgRevenueAfterInactiveWeek)}
          />
        </div>
        <div className="rounded-xl border bg-background/70 p-4">
          <p className="text-sm text-muted-foreground">Difference</p>
          <p className={cn("mt-2 text-3xl font-semibold", delta >= 0 ? "text-primary" : "text-destructive")}>
            {delta >= 0 ? "+" : ""}
            {formatCurrency(delta)}
          </p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {formatNumber(lag.pairCount)} rep-week comparisons.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ScatterCard({ reps }: { reps: SalesCorrelationRep[] }) {
  return (
    <Card className="dashboard-card border bg-card/95">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <Target className="size-4" />
          Usage vs New Sales
        </CardTitle>
        <CardDescription>
          Each dot is a rep. Higher and farther right is better.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SalesImpactScatter reps={reps} />
      </CardContent>
    </Card>
  );
}

function RepImpactTable({
  reps,
  periodDays,
}: {
  reps: SalesCorrelationRep[];
  periodDays: number;
}) {
  const visibleReps = reps;

  return (
    <Card className="dashboard-card border bg-card/95">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <Eye className="size-4" />
          Rep Sales Impact
        </CardTitle>
        <CardDescription>
          Official usage and new paid sales for the last {periodDays} days.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {visibleReps.length ? (
          <div className="dashboard-scroll max-h-[42rem] overflow-y-auto rounded-xl border">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card shadow-xs">
                <TableRow>
                  <TableHead>Rep</TableHead>
                  <TableHead className="text-right">Usage</TableHead>
                  <TableHead className="text-right">New sales</TableHead>
                  <TableHead className="text-right">Before/after</TableHead>
                  <TableHead>Last activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleReps.map((rep) => (
                  <TableRow key={rep.repSlug}>
                    <TableCell>
                      <div className="font-medium">{rep.repName}</div>
                      <Badge variant="outline" className="mt-1">
                        {groupLabel(rep.usageGroup)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="font-medium">{formatNumber(rep.reportViewsWindow)} views</div>
                      <div className="text-xs text-muted-foreground">
                        {formatNumber(rep.usageSignalsWindow)} signals, {formatPercent(rep.usageRate)} viewed
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="font-medium">{formatCurrency(rep.newPaidRevenueWindow)}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatNumber(rep.newPaidDealsWindow)} deals
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="font-medium">
                        {formatCurrency(rep.afterUsageNewRevenue - rep.beforeUsageNewRevenue)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatCurrency(rep.beforeUsageNewRevenue)} to {formatCurrency(rep.afterUsageNewRevenue)}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {rep.lastActivityAt ? formatMiamiDateTime(rep.lastActivityAt) : "No usage yet"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <EmptyPanel text="No rep-level sales or usage data is available yet." />
        )}
      </CardContent>
    </Card>
  );
}

function UnmatchedSalesRepsCard({ reps }: { reps: SalesCorrelationRep[] }) {
  return (
    <Card className="dashboard-card border bg-card/95">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <MousePointerClick className="size-4" />
          Sales Reps Not Matched To Dashboard Usage
        </CardTitle>
        <CardDescription>
          These names had new paid sales in the sheet but no matching official Magic Mike usage row.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {reps.map((rep) => (
            <div key={rep.repSlug} className="rounded-lg border bg-background/70 p-3">
              <div className="font-medium">{rep.repName}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {formatCurrency(rep.newPaidRevenueWindow)} new paid sales
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SignalBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-background/70 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-normal">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-background/70 px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed bg-background/60 p-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function groupLabel(group: UsageGroupKey) {
  if (group === "high") return "High usage";
  if (group === "medium") return "Some usage";
  return "Low/no usage";
}

function groupDotClass(group: UsageGroupKey) {
  if (group === "high") return "bg-primary";
  if (group === "medium") return "bg-accent-foreground";
  return "bg-muted-foreground";
}

function groupBarClass(group: UsageGroupKey) {
  if (group === "high") return "bg-primary";
  if (group === "medium") return "bg-accent-foreground/75";
  return "bg-muted-foreground/65";
}

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function formatNumber(value: number) {
  return numberFormatter.format(Math.round(value));
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatCorrelation(value: number | null) {
  if (value === null) return "n/a";
  return value.toFixed(2);
}

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatUsageHistory(effectiveDays: number, periodDays: number) {
  if (!effectiveDays) return "not available";
  if (effectiveDays >= periodDays) return `${periodDays}d covered`;
  return `${effectiveDays}d of ${periodDays}d`;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

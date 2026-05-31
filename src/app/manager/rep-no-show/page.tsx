import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  Clock3,
  DollarSign,
  ShieldCheck,
  UserX,
  Users,
  type LucideIcon,
} from "lucide-react";
import { RepNoShowLogCard } from "@/components/dashboard/rep-no-show-log-card";
import { RepNoShowChatPanel } from "@/components/dashboard/rep-no-show-chat-panel";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  getRepNoShowAnalytics,
  normalizeRepNoShowWindow,
  REP_NO_SHOW_WINDOWS,
  type RepNoShowAnalytics,
  type RepNoShowRepRow,
} from "@/lib/rep-no-show";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rep No-Show Impact | Magic Mike Bot",
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

export default async function RepNoShowPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string | string[] }>;
}) {
  const { days } = await searchParams;
  const periodDays = normalizeRepNoShowWindow(days);
  const analytics = await getRepNoShowAnalytics(periodDays);

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
                  <UserX className="size-3.5" />
                  Operations visibility
                </Badge>
                <Badge variant="outline" className="bg-background/70">
                  Tracking since {formatShortDate(analytics.summary.trackingStartedAt)}
                </Badge>
                {!analytics.summary.configured ? (
                  <Badge variant="destructive">Airtable not connected</Badge>
                ) : null}
              </div>
              <h1 className="text-3xl font-semibold tracking-normal md:text-4xl">
                Rep No-Show Impact
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Track rep no-shows across sales calls, estimate opportunity at risk, and review
                every detected no-show from one manager view.
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
                  Usage
                </Link>
                <Link href="/manager/sales-correlation" className={cn(buttonVariants({ variant: "outline" }), "w-fit")}>
                  Sales impact
                </Link>
              </div>
            </div>
          </div>
        </header>

        <StatusMessage analytics={analytics} />

        <ExecutiveReadout analytics={analytics} />

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            icon={UserX}
            title="Rep no-shows"
            value={formatNumber(analytics.summary.repNoShows)}
            description={getPeriodDescription(analytics)}
          />
          <MetricCard
            icon={Users}
            title="No-show rate"
            value={formatPercent(analytics.summary.noShowRate)}
            description={`${formatNumber(analytics.summary.eligibleCalls)} tracked calls`}
          />
          <MetricCard
            icon={DollarSign}
            title="Opportunity at risk"
            value={formatCurrency(analytics.summary.estimatedOpportunityAtRisk)}
            description={`${formatPercent(analytics.summary.closeRate)} close rate x ${formatCurrency(analytics.summary.minPackageValue)}`}
          />
          <MetricCard
            icon={CalendarDays}
            title="Call breakdown"
            value={`${formatNumber(analytics.summary.call1NoShows)} / ${formatNumber(analytics.summary.call2PlusNoShows)}`}
            description="Call 1 / Call 2+"
          />
        </section>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)]">
          <TrendCard analytics={analytics} />
          <TopRepsCard reps={analytics.topReps} />
        </section>

        <RepNoShowLogCard
          calls={analytics.noShowLog}
          trackingStartedAt={analytics.summary.trackingStartedAt}
        />

        <p className="max-w-4xl text-xs leading-5 text-muted-foreground">
          Estimates are directional and conservative. The current formula uses rep no-shows x
          close-rate assumption x minimum package value. It should be described as opportunity at
          risk, not confirmed missed sales.
        </p>

        <RepNoShowChatPanel periodDays={analytics.summary.periodDays} />
      </div>
    </main>
  );
}

function PeriodSelector({ selectedDays }: { selectedDays: number }) {
  return (
    <div className="inline-flex rounded-lg border bg-background/75 p-1">
      {REP_NO_SHOW_WINDOWS.map((days) => (
        <Link
          key={days}
          href={`/manager/rep-no-show?days=${days}`}
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

function StatusMessage({ analytics }: { analytics: RepNoShowAnalytics }) {
  if (!analytics.summary.error) return null;

  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm leading-6 text-destructive">
      {analytics.summary.error}
    </div>
  );
}

function ExecutiveReadout({ analytics }: { analytics: RepNoShowAnalytics }) {
  const change = analytics.summary.weekOverWeekChange;
  const improved = change < 0;
  const flat = change === 0;
  const comparisonAvailable = analytics.summary.comparisonAvailable;

  return (
    <Card className="dashboard-card border bg-card/95">
      <CardContent className="grid gap-4 pt-1 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-center">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <AlertTriangle className="size-3.5" />
              Executive readout
            </Badge>
            <Badge variant="outline">Last {analytics.summary.periodDays} days</Badge>
            <Badge variant="outline">{formatPercent(analytics.summary.closeRate)} close-rate assumption</Badge>
          </div>
          <h2 className="max-w-3xl text-2xl font-semibold leading-tight tracking-normal">
            {getExecutiveHeadline(analytics)}
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
            Counts use reliable attendance signals captured after rep no-show tracking was
            activated. Older incomplete periods are excluded from rates and trends.
          </p>
        </div>

        <div className="rounded-xl border bg-background/80 p-4 shadow-xs">
          {comparisonAvailable ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
                  Change vs prior period
                </p>
                <Badge variant={improved ? "secondary" : flat ? "outline" : "destructive"}>
                  {improved ? "Improved" : flat ? "Flat" : "Higher"}
                </Badge>
              </div>
              <p className={cn("mt-3 flex items-center gap-2 text-3xl font-semibold tracking-normal", improved && "text-primary", !improved && !flat && "text-destructive")}>
                {improved ? <ArrowDownRight className="size-6" /> : <ArrowUpRight className="size-6" />}
                {change > 0 ? "+" : ""}
                {formatNumber(change)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Previous period had {formatNumber(analytics.summary.previousRepNoShows)} rep no-shows.
              </p>
              <div className="mt-4 rounded-lg border bg-card/80 px-3 py-2">
                <p className="text-xs text-muted-foreground">Potential revenue protected</p>
                <p className="mt-1 text-xl font-semibold">
                  {formatCurrency(analytics.summary.estimatedRevenueProtected)}
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
                  Baseline status
                </p>
                <Badge variant="outline">Building</Badge>
              </div>
              <p className="mt-3 text-2xl font-semibold tracking-normal">No fair prior comparison yet</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Rep no-show tracking started {formatShortDate(analytics.summary.trackingStartedAt)}.
                Older periods are hidden so the trend does not compare against incomplete detection.
              </p>
              <div className="mt-4 rounded-lg border bg-card/80 px-3 py-2">
                <p className="text-xs text-muted-foreground">Comparable baseline</p>
                <p className="mt-1 text-xl font-semibold">Pending</p>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <Card className="dashboard-card border bg-card/95">
      <CardContent className="flex items-start justify-between gap-3 pt-1">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-2 break-words text-3xl font-semibold tracking-normal">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <span className="grid size-9 shrink-0 place-items-center rounded-lg border bg-background text-primary">
          <Icon className="size-4" />
        </span>
      </CardContent>
    </Card>
  );
}

function TrendCard({ analytics }: { analytics: RepNoShowAnalytics }) {
  const { weekly } = analytics;
  const maxNoShows = Math.max(1, ...weekly.map((point) => point.noShows));

  return (
    <Card className="dashboard-card border bg-card/95">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="size-4" />
          Trend Since Activation
        </CardTitle>
        <CardDescription>
          Only reliable tracking dates from {formatShortDate(analytics.summary.trackingStartedAt)} onward.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {weekly.length ? (
          <div className="grid gap-3">
            {weekly.map((point) => (
              <div key={point.weekStart} className="grid grid-cols-[4.5rem_minmax(0,1fr)_3rem] items-center gap-3 text-sm">
                <span className="text-xs text-muted-foreground">{point.label}</span>
                <div className="h-8 overflow-hidden rounded-md border bg-background">
                  <div
                    className="h-full rounded-md bg-primary/80"
                    style={{ width: point.noShows > 0 ? `${Math.max(8, (point.noShows / maxNoShows) * 100)}%` : 0 }}
                  />
                </div>
                <span className="text-right font-medium">{formatNumber(point.noShows)}</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState text="No tracked days are available yet." />
        )}
      </CardContent>
    </Card>
  );
}

function TopRepsCard({ reps }: { reps: RepNoShowRepRow[] }) {
  return (
    <Card className="dashboard-card border bg-card/95">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <Users className="size-4" />
          Reps To Watch
        </CardTitle>
        <CardDescription>Sorted by rep no-show count in the selected period.</CardDescription>
      </CardHeader>
      <CardContent>
        {reps.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rep</TableHead>
                <TableHead className="text-right">No-shows</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Risk</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reps.map((rep) => (
                <TableRow key={rep.repSlug}>
                  <TableCell>
                    <div className="font-medium">{rep.repName}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatNumber(rep.call1NoShows)} Call 1 / {formatNumber(rep.eligibleCalls)} tracked calls
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatNumber(rep.noShows)}</TableCell>
                  <TableCell className="text-right">{formatPercent(rep.noShowRate)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(rep.estimatedOpportunityAtRisk)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState text="No rep no-shows found for this period." />
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border bg-background/80 p-4 text-sm leading-6 text-muted-foreground">
      {text}
    </div>
  );
}

function getExecutiveHeadline(analytics: RepNoShowAnalytics) {
  if (analytics.summary.error) {
    return "Connect read-only Airtable access to show live rep no-show impact.";
  }

  if (analytics.summary.repNoShows === 0) {
    return `No rep no-shows surfaced ${getPeriodPhrase(analytics)}.`;
  }

  return `${formatNumber(analytics.summary.repNoShows)} rep no-shows surfaced ${getPeriodPhrase(analytics)}, with ${formatCurrency(analytics.summary.estimatedOpportunityAtRisk)} in estimated opportunity at risk.`;
}

function getPeriodDescription(analytics: RepNoShowAnalytics) {
  const requestedStart = new Date(analytics.summary.generatedAt);
  requestedStart.setUTCDate(requestedStart.getUTCDate() - analytics.summary.periodDays);
  const effectiveStart = new Date(analytics.summary.effectivePeriodStart);

  if (Number.isFinite(effectiveStart.getTime()) && effectiveStart > requestedStart) {
    return `Since ${formatShortDate(analytics.summary.effectivePeriodStart)}`;
  }

  return `Last ${analytics.summary.periodDays} days`;
}

function getPeriodPhrase(analytics: RepNoShowAnalytics) {
  const requestedStart = new Date(analytics.summary.generatedAt);
  requestedStart.setUTCDate(requestedStart.getUTCDate() - analytics.summary.periodDays);
  const effectiveStart = new Date(analytics.summary.effectivePeriodStart);

  if (Number.isFinite(effectiveStart.getTime()) && effectiveStart > requestedStart) {
    return `since ${formatShortDate(analytics.summary.effectivePeriodStart)}`;
  }

  return `in the last ${analytics.summary.periodDays} days`;
}

function formatShortDate(value: string | Date | null | undefined) {
  if (!value) return "tracking start";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "tracking start";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

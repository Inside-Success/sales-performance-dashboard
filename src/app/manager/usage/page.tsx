import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  BarChart3,
  CalendarDays,
  Clock3,
  Eye,
  FileText,
  MousePointerClick,
  Search,
  Send,
  ShieldCheck,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
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
import { getUsageAnalytics } from "@/lib/db";
import { formatDate, formatMiamiDateTime } from "@/lib/format";
import type {
  UsageDailyPoint,
  UsageEventBreakdown,
  UsageRecentEvent,
  UsageRepEngagement,
  UsageUnviewedReport,
} from "@/lib/types";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Usage Analytics | Magic Mike Bot",
  robots: {
    index: false,
    follow: false,
  },
};

const numberFormatter = new Intl.NumberFormat("en-US");

export default async function ManagerUsagePage() {
  const analytics = await getUsageAnalytics();
  const { totals } = analytics;
  const hasEvents = totals.events_30d > 0;

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
                {!analytics.configured ? (
                  <Badge variant="destructive">Database not connected</Badge>
                ) : null}
              </div>
              <h1 className="text-3xl font-semibold tracking-normal md:text-4xl">
                Magic Mike Bot Usage
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Report-level dashboard activity for managers. This view tracks anonymous sessions,
                selected reps, viewed reports, and report link clicks without recording viewer identity.
              </p>
            </div>

            <div className="flex flex-col gap-2 text-sm text-muted-foreground lg:items-end">
              <div className="inline-flex items-center gap-2 rounded-lg border bg-background/75 px-3 py-2">
                <Clock3 className="size-4 text-foreground" />
                Updated {formatMiamiDateTime(analytics.generatedAt)}
              </div>
              <Link href="/" className={cn(buttonVariants({ variant: "outline" }), "w-fit")}>
                Open dashboard
              </Link>
            </div>
          </div>
        </header>

        {analytics.error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {analytics.error}
          </div>
        ) : null}

        {!analytics.configured ? (
          <div className="rounded-lg border bg-card p-4 text-sm leading-6 text-muted-foreground">
            Connect `DATABASE_URL` before this page can show live usage.
          </div>
        ) : null}

        {!hasEvents && analytics.configured ? (
          <div className="rounded-lg border bg-card p-4 text-sm leading-6 text-muted-foreground">
            Usage tracking starts from the deployment that includes this page. Older dashboard visits
            are not backfilled.
          </div>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Events today"
            value={totals.events_today}
            description="All tracked dashboard activity"
            icon={Activity}
          />
          <MetricCard
            title="Active sessions"
            value={totals.sessions_7d}
            description="Anonymous sessions in 7 days"
            icon={Users}
          />
          <MetricCard
            title="Report views"
            value={totals.report_views_7d}
            description="Reports opened in 7 days"
            icon={Eye}
          />
          <MetricCard
            title="Rep selections"
            value={totals.rep_selections_7d}
            description="Rep filter picks in 7 days"
            icon={Search}
          />
          <MetricCard
            title="Link clicks"
            value={totals.link_clicks_7d}
            description="Docs, Zoom, and transcripts"
            icon={MousePointerClick}
          />
          <MetricCard
            title="Manual submits"
            value={totals.manual_submissions_7d}
            description="Manual feedback requests"
            icon={Send}
          />
          <MetricCard
            title="Events in 7 days"
            value={totals.events_7d}
            description="Short-term activity pulse"
            icon={TrendingUp}
          />
          <MetricCard
            title="Events in 30 days"
            value={totals.events_30d}
            description="Rolling monthly activity"
            icon={CalendarDays}
          />
        </section>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
          <DailyActivityCard daily={analytics.daily} />
          <EventBreakdownCard events={analytics.eventBreakdown} />
        </section>

        <RepEngagementCard reps={analytics.repEngagement} />

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(380px,0.9fr)]">
          <UnviewedReportsCard reports={analytics.unviewedReports} />
          <RecentEventsCard events={analytics.recentEvents} />
        </section>
      </div>
    </main>
  );
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: number;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <Card className="dashboard-card border bg-card/95">
      <CardContent className="flex items-start justify-between gap-3 pt-1">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-semibold tracking-normal">
            {formatNumber(value)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <span className="grid size-9 shrink-0 place-items-center rounded-lg border bg-background text-primary">
          <Icon className="size-4" />
        </span>
      </CardContent>
    </Card>
  );
}

function DailyActivityCard({ daily }: { daily: UsageDailyPoint[] }) {
  const maxEvents = Math.max(1, ...daily.map((point) => point.total_events));

  return (
    <Card className="dashboard-card border bg-card/95">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="size-4" />
          Daily Activity
        </CardTitle>
        <CardDescription>Last 14 days of tracked dashboard events.</CardDescription>
      </CardHeader>
      <CardContent>
        {daily.length ? (
          <div className="grid gap-3">
            {daily.map((point) => (
              <div
                key={point.day}
                className="grid grid-cols-[3.5rem_minmax(0,1fr)_3rem] items-center gap-3"
              >
                <span className="text-xs text-muted-foreground">{formatDayLabel(point.day)}</span>
                <div className="h-8 overflow-hidden rounded-lg bg-muted">
                  <div
                    className="flex h-full items-center rounded-lg bg-primary/85 px-2 text-xs font-medium text-primary-foreground"
                    style={{ width: getBarWidth(point.total_events, maxEvents) }}
                    aria-label={`${point.total_events} events, ${point.report_views} report views`}
                  />
                </div>
                <span className="text-right text-sm font-medium">{formatNumber(point.total_events)}</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyPanel text="No activity has been recorded yet." />
        )}
      </CardContent>
    </Card>
  );
}

function EventBreakdownCard({ events }: { events: UsageEventBreakdown[] }) {
  return (
    <Card className="dashboard-card border bg-card/95">
      <CardHeader className="border-b">
        <CardTitle>Event Mix</CardTitle>
        <CardDescription>Tracked actions from the last 7 days.</CardDescription>
      </CardHeader>
      <CardContent>
        {events.length ? (
          <div className="grid gap-2">
            {events.map((event) => (
              <div
                key={event.event_name}
                className="flex items-center justify-between gap-3 rounded-lg border bg-background/70 px-3 py-2"
              >
                <span className="min-w-0 truncate text-sm">{formatEventName(event.event_name)}</span>
                <Badge variant="secondary">{formatNumber(event.count)}</Badge>
              </div>
            ))}
          </div>
        ) : (
          <EmptyPanel text="No tracked actions in the last 7 days." />
        )}
      </CardContent>
    </Card>
  );
}

function RepEngagementCard({ reps }: { reps: UsageRepEngagement[] }) {
  return (
    <Card className="dashboard-card border bg-card/95">
      <CardHeader className="border-b">
        <CardTitle>Rep Report Engagement</CardTitle>
        <CardDescription>
          Official report views are counted by the report opened, not by identifying who opened it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {reps.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rep</TableHead>
                <TableHead className="text-right">Reports</TableHead>
                <TableHead className="text-right">Viewed</TableHead>
                <TableHead className="text-right">Views</TableHead>
                <TableHead>Engagement</TableHead>
                <TableHead>Last activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reps.map((rep) => {
                const linkClicks = rep.doc_clicks + rep.zoom_clicks + rep.transcript_clicks;

                return (
                  <TableRow key={rep.rep_slug}>
                    <TableCell>
                      <span className="font-medium">{rep.rep_name}</span>
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(rep.generated_reports)}</TableCell>
                    <TableCell className="text-right">
                      {formatNumber(rep.viewed_reports)}
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({formatPercent(getViewRate(rep))})
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(rep.report_views)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="outline">{formatNumber(rep.rep_selections)} picks</Badge>
                        <Badge variant="outline">{formatNumber(linkClicks)} link clicks</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {rep.last_activity_at ? formatMiamiDateTime(rep.last_activity_at) : "No activity"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <EmptyPanel text="No reps are available to summarize yet." />
        )}
      </CardContent>
    </Card>
  );
}

function UnviewedReportsCard({ reports }: { reports: UsageUnviewedReport[] }) {
  return (
    <Card className="dashboard-card border bg-card/95">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <FileText className="size-4" />
          Unviewed Official Reports
        </CardTitle>
        <CardDescription>Official reports generated more than 48 hours ago with no view recorded.</CardDescription>
      </CardHeader>
      <CardContent>
        {reports.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Report</TableHead>
                <TableHead>Rep</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((report) => (
                <TableRow key={report.id}>
                  <TableCell>
                    <Link
                      href={`/call/${report.id}?from=manager-usage`}
                      className="font-medium hover:underline"
                    >
                      {report.client_name || `Report ${report.id}`}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Meeting {formatDate(report.call_date)}
                    </p>
                  </TableCell>
                  <TableCell>{report.rep_name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatMiamiDateTime(report.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyPanel text="No unviewed reports older than 48 hours." />
        )}
      </CardContent>
    </Card>
  );
}

function RecentEventsCard({ events }: { events: UsageRecentEvent[] }) {
  return (
    <Card className="dashboard-card border bg-card/95">
      <CardHeader className="border-b">
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Latest tracked events, newest first.</CardDescription>
      </CardHeader>
      <CardContent>
        {events.length ? (
          <div className="grid gap-2">
            {events.map((event) => (
              <div key={event.id} className="rounded-lg border bg-background/70 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{formatEventName(event.event_name)}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {event.target_rep_name || event.target_rep_slug || event.path || "Dashboard"}
                    </p>
                  </div>
                  <Badge variant="outline">{event.source || "dashboard"}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {formatMiamiDateTime(event.created_at)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyPanel text="No recent usage events yet." />
        )}
      </CardContent>
    </Card>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed bg-background/60 p-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function getViewRate(rep: UsageRepEngagement) {
  if (!rep.generated_reports) return 0;
  return rep.viewed_reports / rep.generated_reports;
}

function getBarWidth(value: number, max: number) {
  if (!value) return "0%";
  return `${Math.max(10, Math.round((value / max) * 100))}%`;
}

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatDayLabel(day: string) {
  const date = new Date(`${day}T00:00:00`);
  if (Number.isNaN(date.getTime())) return day;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatEventName(eventName: string) {
  return eventName
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

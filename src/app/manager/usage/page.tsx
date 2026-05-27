import type { Metadata } from "next";
import Link from "next/link";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Eye,
  FileText,
  MousePointerClick,
  Send,
  ShieldCheck,
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
  UsageManualSummary,
  UsageOfficialSummary,
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
  const hasEvents = analytics.totals.events_30d > 0;

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
                Official coaching reports and self-submitted feedback are tracked separately, so
                managers can read adoption without mixing the two workflows.
              </p>
            </div>

            <div className="flex flex-col gap-2 text-sm text-muted-foreground lg:items-end">
              <div className="grid w-full gap-2 sm:grid-cols-2 lg:w-auto">
                <HeaderStat
                  icon={Users}
                  label="Official reps"
                  value={analytics.official.total_reps}
                />
                <HeaderStat
                  icon={FileText}
                  label="Official feedback"
                  value={analytics.official.total_reports}
                />
              </div>
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
            title="Official views today"
            value={analytics.official.report_views_today}
            description="Official coaching reports opened"
            icon={Eye}
          />
          <MetricCard
            title="Official views this week"
            value={analytics.official.report_views_7d}
            description="Report opens in the last 7 days"
            icon={BarChart3}
          />
          <MetricCard
            title="Active sessions"
            value={analytics.official.active_sessions_7d}
            description="Anonymous official-dashboard sessions"
            icon={Users}
          />
          <MetricCard
            title="Reps with activity"
            value={analytics.official.reps_with_activity_7d}
            description="Reps tied to official usage signals"
            icon={CheckCircle2}
          />
        </section>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(340px,0.7fr)]">
          <DailyReportViewsCard daily={analytics.daily} />
          <OfficialSignalCard official={analytics.official} />
        </section>

        <RepEngagementCard reps={analytics.repEngagement} />

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(380px,0.9fr)]">
          <UnviewedReportsCard reports={analytics.unviewedReports} />
          <ManualUsageCard manual={analytics.manual} />
        </section>
      </div>
    </main>
  );
}

function HeaderStat({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
}) {
  return (
    <div className="flex min-w-36 items-center justify-between gap-3 rounded-lg border bg-background/75 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <Icon className="size-4 shrink-0 text-foreground" />
        <span className="truncate text-xs text-muted-foreground">{label}</span>
      </div>
      <span className="text-base font-semibold text-foreground">{formatNumber(value)}</span>
    </div>
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

function DailyReportViewsCard({ daily }: { daily: UsageDailyPoint[] }) {
  const maxViews = Math.max(
    1,
    ...daily.map((point) => point.official_report_views + point.manual_report_views),
  );

  return (
    <Card className="dashboard-card border bg-card/95">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="size-4" />
          Daily Report Views
        </CardTitle>
        <CardDescription>
          Official coaching views are primary. Self-submitted views are shown separately.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {daily.length ? (
          <div className="grid gap-3">
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full bg-primary" />
                Official coaching
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full bg-accent-foreground/70" />
                Self-submitted
              </span>
            </div>
            {daily.map((point) => {
              const totalViews = point.official_report_views + point.manual_report_views;

              return (
                <div
                  key={point.day}
                  className="grid grid-cols-[3.5rem_minmax(0,1fr)_6.5rem] items-center gap-3"
                >
                  <span className="text-xs text-muted-foreground">{formatDayLabel(point.day)}</span>
                  <div
                    className="flex h-8 overflow-hidden rounded-lg bg-muted"
                    aria-label={`${point.official_report_views} official views and ${point.manual_report_views} self-submitted views`}
                  >
                    <div
                      className="h-full bg-primary/85"
                      style={{ width: getStackWidth(point.official_report_views, maxViews) }}
                    />
                    <div
                      className="h-full bg-accent-foreground/70"
                      style={{ width: getStackWidth(point.manual_report_views, maxViews) }}
                    />
                  </div>
                  <span className="text-right text-sm font-medium">
                    {formatNumber(totalViews)}
                    <span className="ml-1 text-xs text-muted-foreground">views</span>
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyPanel text="No report views have been recorded yet." />
        )}
      </CardContent>
    </Card>
  );
}

function OfficialSignalCard({ official }: { official: UsageOfficialSummary }) {
  return (
    <Card className="dashboard-card border bg-card/95">
      <CardHeader className="border-b">
        <CardTitle>Official Coaching Signals</CardTitle>
        <CardDescription>Secondary usage signals, kept out of the main scorecards.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <SignalRow
          icon={CalendarDays}
          label="Official views in 30 days"
          value={official.report_views_30d}
        />
        <SignalRow
          icon={MousePointerClick}
          label="Report link clicks in 7 days"
          value={official.link_clicks_7d}
        />
        <SignalRow
          icon={Users}
          label="Rep filter picks in 7 days"
          value={official.rep_selections_7d}
        />
        <div className="rounded-lg border bg-background/70 px-3 py-2">
          <p className="text-xs text-muted-foreground">Last official activity</p>
          <p className="mt-1 text-sm font-medium">
            {official.last_activity_at ? formatMiamiDateTime(official.last_activity_at) : "No activity yet"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function RepEngagementCard({ reps }: { reps: UsageRepEngagement[] }) {
  return (
    <Card className="dashboard-card border bg-card/95">
      <CardHeader className="border-b">
        <CardTitle>Official Rep Engagement</CardTitle>
        <CardDescription>
          This table only uses official coaching reports. It does not include self-submitted feedback.
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
                <TableHead>Secondary signals</TableHead>
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
          <EmptyPanel text="No official reps are available to summarize yet." />
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
          <EmptyPanel text="No unviewed official reports older than 48 hours." />
        )}
      </CardContent>
    </Card>
  );
}

function ManualUsageCard({ manual }: { manual: UsageManualSummary }) {
  return (
    <Card className="dashboard-card border bg-card/95">
      <CardHeader className="border-b">
        <CardTitle>Self-Submitted Feedback</CardTitle>
        <CardDescription>
          Manual submissions are tracked separately from official coaching reports.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <SignalRow icon={FileText} label="Total self-submitted reports" value={manual.total_reports} />
          <SignalRow icon={CheckCircle2} label="Completed reports" value={manual.completed_reports} />
          <SignalRow icon={Send} label="Submissions in 7 days" value={manual.submissions_7d} />
          <SignalRow icon={Eye} label="Manual report views in 7 days" value={manual.report_views_7d} />
        </div>
        <div className="grid gap-2 rounded-lg border bg-background/70 p-3">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">Form/list opens</span>
            <span className="font-medium">{formatNumber(manual.page_opens_7d)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">Anonymous sessions</span>
            <span className="font-medium">{formatNumber(manual.active_sessions_7d)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">Manual link clicks</span>
            <span className="font-medium">{formatNumber(manual.link_clicks_7d)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">Active pending/processing</span>
            <span className="font-medium">{formatNumber(manual.pending_reports)}</span>
          </div>
        </div>
        <div className="rounded-lg border bg-background/70 px-3 py-2">
          <p className="text-xs text-muted-foreground">Last self-submitted activity</p>
          <p className="mt-1 text-sm font-medium">
            {manual.last_activity_at ? formatMiamiDateTime(manual.last_activity_at) : "No activity yet"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function SignalRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-background/70 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-muted text-foreground">
          <Icon className="size-3.5" />
        </span>
        <span className="min-w-0 text-sm text-muted-foreground">{label}</span>
      </div>
      <span className="text-lg font-semibold">{formatNumber(value)}</span>
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

function getViewRate(rep: UsageRepEngagement) {
  if (!rep.generated_reports) return 0;
  return rep.viewed_reports / rep.generated_reports;
}

function getStackWidth(value: number, max: number) {
  if (!value) return "0%";
  return `${Math.round((value / max) * 100)}%`;
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

import { RepNoShowPeriodSelect } from "@/components/dashboard/rep-no-show-period-select";
import {
  normalizeAttendanceDay,
  type AttendanceDay,
} from "@/lib/rep-no-show-calendar";
import { RepNoShowRepsCard } from "@/components/dashboard/rep-no-show-reps-card";
import { LinkPending } from "@/components/dashboard/link-pending";
import { requireRepScoringAdmin } from "@/lib/rep-scoring/access";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDownRight,
  CalendarDays,
  Clock3,
  ShieldCheck,
  UserX,
  Users,
  type LucideIcon,
} from "lucide-react";
import { RepNoShowLogCard } from "@/components/dashboard/rep-no-show-log-card";
import { RepNoShowChatPanel } from "@/components/dashboard/rep-no-show-chat-panel";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatMiamiDateTime } from "@/lib/format";
import {
  getRepNoShowAnalytics,
  normalizeRepNoShowWindow,
  type RepNoShowAnalytics,
} from "@/lib/rep-no-show";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sales Call Rep No-Shows | Magic Mike Bot",
  description:
    "Hidden manager view for tracking rep no-shows across sales calls.",
  robots: {
    index: false,
    follow: false,
  },
};

const numberFormatter = new Intl.NumberFormat("en-US");

export default async function RepNoShowPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string | string[]; day?: string }>;
}) {
  await requireRepScoringAdmin();
  const { days, day } = await searchParams;
  const calendarDay = normalizeAttendanceDay(day);
  const periodDays = normalizeRepNoShowWindow(days);
  const analytics = await getRepNoShowAnalytics(periodDays, false, calendarDay);

  return (
    <main className="magic-page magic-no-show-theme">
      <div className="mx-auto flex w-full max-w-[84rem] flex-col gap-6 px-5 py-6 sm:px-8">
        <header className="magic-card magic-hero p-5 md:p-7">
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
                  Tracking since{" "}
                  {formatShortDate(analytics.summary.trackingStartedAt)}
                </Badge>
                {!analytics.summary.configured ? (
                  <Badge variant="destructive">Airtable not connected</Badge>
                ) : null}
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
                Sales Call Rep No-Shows
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Track rep no-shows across sales calls and review every detected
                no-show from one manager view.
              </p>
            </div>

            <div className="flex flex-col gap-2 text-sm text-muted-foreground lg:items-end">
              <PeriodSelector
                selectedDays={analytics.summary.periodDays}
                calendarDay={calendarDay}
              />
              <div className="inline-flex items-center gap-2 rounded-lg border bg-background/75 px-3 py-2">
                <Clock3 className="size-4 text-foreground" />
                {analytics.summary.error
                  ? "Data unavailable"
                  : `Source read ${formatMiamiDateTime(analytics.summary.generatedAt)}`}
              </div>
            </div>
          </div>
        </header>

        <StatusMessage analytics={analytics} />

        {!analytics.summary.error ? (
          <>
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
                icon={ArrowDownRight}
                title="Change vs prior period"
                value={
                  analytics.summary.comparisonAvailable
                    ? `${analytics.summary.weekOverWeekChange > 0 ? "+" : ""}${formatNumber(analytics.summary.weekOverWeekChange)}`
                    : "Not available"
                }
                description={
                  analytics.summary.comparisonAvailable
                    ? `Previously ${formatNumber(analytics.summary.previousRepNoShows)} no-shows`
                    : calendarDay === "today"
                      ? "Today is still in progress"
                      : "Not enough comparable history"
                }
              />
              <MetricCard
                icon={CalendarDays}
                title="Call breakdown"
                value={`${formatNumber(analytics.summary.call1NoShows)} Call 1`}
                description={`${formatNumber(analytics.summary.call2PlusNoShows)} Call 2+ no-shows`}
              />
            </section>

            <section className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)]">
              <TrendCard analytics={analytics} />
              <RepNoShowRepsCard
                key={`${analytics.summary.generatedAt}-${calendarDay || periodDays}`}
                reps={analytics.topReps}
                calls={analytics.noShowLog}
                periodLabel={getPeriodDescription(analytics)}
              />
            </section>

            <RepNoShowLogCard
              key={`${analytics.summary.generatedAt}-${calendarDay || periodDays}`}
              calls={analytics.noShowLog.filter(
                (call) =>
                  call.callDate &&
                  Date.parse(call.callDate) >=
                    Date.parse(analytics.summary.effectivePeriodStart),
              )}
              historyCount={
                analytics.historyCount ?? analytics.noShowLog.length
              }
              trackingStartedAt={analytics.summary.trackingStartedAt}
              periodStart={analytics.summary.effectivePeriodStart}
              periodDays={analytics.summary.periodDays}
              calendarDay={calendarDay}
              readAt={analytics.summary.generatedAt}
              referenceAt={new Date().toISOString()}
            />

            <RepNoShowChatPanel
              key={`${calendarDay || periodDays}`}
              periodDays={analytics.summary.periodDays}
              calendarDay={calendarDay}
            />
          </>
        ) : null}
      </div>
    </main>
  );
}

function PeriodSelector({
  selectedDays,
  calendarDay,
}: {
  selectedDays: number;
  calendarDay?: AttendanceDay;
}) {
  return (
    <div className="flex w-full flex-wrap items-center gap-1 rounded-xl border bg-background/75 p-1 sm:w-auto">
      {(["today", "yesterday"] as const).map((day) => (
        <Link
          key={day}
          href={`/manager/rep-no-show?day=${day}`}
          aria-current={calendarDay === day ? "page" : undefined}
          className={cn(
            "inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-red-600",
            calendarDay === day
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted",
          )}
        >
          {day === "today" ? "Today" : "Yesterday"}
          <LinkPending />
        </Link>
      ))}
      <RepNoShowPeriodSelect
        selectedDays={calendarDay ? undefined : selectedDays}
      />
    </div>
  );
}

function StatusMessage({ analytics }: { analytics: RepNoShowAnalytics }) {
  if (!analytics.summary.error) return null;

  return (
    <div
      role="alert"
      className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm leading-6 text-destructive"
    >
      Data unavailable. {analytics.summary.error} No attendance totals are shown
      because the source could not be read.
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
  value: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <Card className="magic-card">
      <CardContent className="flex items-start justify-between gap-3 pt-1">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-2 break-words text-3xl font-semibold tracking-normal">
            {value}
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

function TrendCard({ analytics }: { analytics: RepNoShowAnalytics }) {
  const { weekly } = analytics;
  const maxNoShows = Math.max(1, ...weekly.map((point) => point.noShows));

  return (
    <Card className="magic-card">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="size-4" />
          Recent weekly trend
        </CardTitle>
        <CardDescription>
          Latest eight weeks. Weeks without attendance records are omitted; zero
          means tracked calls with no detected rep no-shows.
          {analytics.weeklyReadAt ? (
            <span className="mt-1 block text-xs">
              Weekly source read {formatMiamiDateTime(analytics.weeklyReadAt)}.
            </span>
          ) : null}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {weekly.length ? (
          <div className="grid gap-3">
            {weekly.map((point) => (
              <div
                key={point.weekStart}
                className="grid grid-cols-[4.5rem_minmax(0,1fr)_3rem] items-center gap-3 text-sm"
              >
                <span className="text-xs text-muted-foreground">
                  {point.label}
                </span>
                <div className="h-8 overflow-hidden rounded-md border bg-background">
                  <div
                    className="h-full rounded-md bg-primary/80"
                    style={{
                      width:
                        point.noShows > 0
                          ? `${Math.max(8, (point.noShows / maxNoShows) * 100)}%`
                          : 0,
                    }}
                  />
                </div>
                <span className="text-right font-medium">
                  {formatNumber(point.noShows)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            text={
              analytics.summary.calendarDay && !analytics.weeklyReadAt
                ? "Weekly history is being refreshed; daily results above are available."
                : "No tracked days are available yet."
            }
          />
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

function getPeriodDescription(analytics: RepNoShowAnalytics) {
  if (analytics.summary.calendarDay)
    return `${analytics.summary.calendarDay === "today" ? "Today" : "Yesterday"} · ${analytics.summary.calendarDate} (Miami)`;
  if (
    analytics.summary.effectivePeriodStart ===
    analytics.summary.trackingStartedAt
  ) {
    return `Since ${formatShortDate(analytics.summary.effectivePeriodStart)}`;
  }

  return `Last ${analytics.summary.periodDays} days`;
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

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

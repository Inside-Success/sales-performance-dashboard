import {
  BarChart3,
  Bot,
  CircleAlert,
  CheckCircle2,
  Eye,
  FileText,
  History,
  MessageCircleQuestion,
  MousePointerClick,
  Send,
  Timer,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { formatMiamiDateTime } from "@/lib/format";
import type {
  UsageChatRep,
  UsageChatSummary,
  UsageDailyPoint,
  UsageLegacySummary,
  UsageManualSummary,
  UsageOfficialSummary,
  UsageUnmappedUser,
} from "@/lib/types";



const numberFormatter = new Intl.NumberFormat("en-US");

export default async function UsageDiagnostics() {
  const analytics = await getUsageAnalytics();
  return <div className="grid gap-5">
    <p className="text-sm text-muted-foreground">Supporting diagnostics use their labelled periods. They do not change the own-report totals above.</p>
    <DailyReportViewsCard daily={analytics.daily} />
    <OfficialSignalCard official={analytics.official} />
    <UnmappedUsersCard users={analytics.unmappedUsers} />
    <ManualUsageCard manual={analytics.manual} />
    <LegacyUsageCard legacy={analytics.legacy} />
    <ChatUsageCard chat={analytics.chat} reps={analytics.chatReps} />
  </div>;
}

function DailyReportViewsCard({ daily }: { daily: UsageDailyPoint[] }) {
  const maxViews = Math.max(
    1,
    ...daily.map((point) => point.official_report_views + point.manual_report_views),
  );

  return (
    <Card className="magic-card border-slate-200 bg-white/90">
      <CardHeader className="border-b border-slate-100">
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="size-4 text-[#DC2626]" />
          Daily Report Activity
        </CardTitle>
        <CardDescription>
          Official bars count verified 10-second engagements. Self-submitted views remain separate.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {daily.length ? (
          <div className="grid gap-3">
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full bg-[#DC2626]" />
                Official engaged
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full bg-slate-400" />
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
                    className="flex h-8 overflow-hidden rounded-xl bg-slate-100"
                    aria-label={`${point.official_report_views} official engagements and ${point.manual_report_views} self-submitted views`}
                  >
                    <div
                      className="h-full bg-[#DC2626]"
                      style={{ width: getStackWidth(point.official_report_views, maxViews) }}
                    />
                    <div
                      className="h-full bg-slate-400"
                      style={{ width: getStackWidth(point.manual_report_views, maxViews) }}
                    />
                  </div>
                  <span className="text-right text-sm font-semibold text-slate-800">
                    {formatNumber(totalViews)}
                    <span className="ml-1 text-xs text-slate-400">events</span>
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyPanel text="No verified report activity has been recorded yet." />
        )}
      </CardContent>
    </Card>
  );
}

function OfficialSignalCard({ official }: { official: UsageOfficialSummary }) {
  return (
    <Card className="magic-card border-slate-200 bg-white/90">
      <CardHeader className="border-b border-slate-100">
        <CardTitle>Verified Coaching Signals</CardTitle>
        <CardDescription>Signed-in official report activity only. Legacy anonymous rows are excluded.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <SignalRow
          icon={Eye}
          label="Official opens in 7 days"
          value={official.report_views_7d}
        />
        <SignalRow
          icon={Timer}
          label="Reading minutes in 7 days"
          value={Math.round(official.engagement_seconds_7d / 60)}
        />
        <SignalRow
          icon={CircleAlert}
          label="Unmapped signed-in users"
          value={official.unmapped_users_30d}
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

function UnmappedUsersCard({ users }: { users: UsageUnmappedUser[] }) {
  return (
    <Card className="magic-card border-slate-200 bg-white/90">
      <CardHeader className="border-b border-slate-100">
        <CardTitle className="flex items-center gap-2">
          <CircleAlert className="size-4 text-[#DC2626]" />
          Unmapped Signed-In Users
        </CardTitle>
        <CardDescription>
          These users are allowed to sign in, but their Google identity did not safely match a rep.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {users.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead className="text-right">Events</TableHead>
                <TableHead className="text-right">Engaged</TableHead>
                <TableHead>Last activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.viewer_email}>
                  <TableCell>
                    <span className="font-medium">{user.viewer_name || user.viewer_email}</span>
                    <p className="mt-1 text-xs text-muted-foreground">{user.viewer_email}</p>
                  </TableCell>
                  <TableCell className="text-right">{formatNumber(user.events_30d)}</TableCell>
                  <TableCell className="text-right">
                    {formatNumber(user.report_engagements_30d)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.last_activity_at ? formatMiamiDateTime(user.last_activity_at) : "No activity"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyPanel text="No unmapped signed-in users in the last 30 days." />
        )}
      </CardContent>
    </Card>
  );
}

function LegacyUsageCard({ legacy }: { legacy: UsageLegacySummary }) {
  return (
    <Card className="magic-card border-slate-200 bg-white/90">
      <CardHeader className="border-b border-slate-100">
        <CardTitle className="flex items-center gap-2">
          <History className="size-4 text-[#DC2626]" />
          Legacy Anonymous Usage
        </CardTitle>
        <CardDescription>
          Historical pre-login rows are preserved here, but excluded from verified rep metrics.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <SignalRow icon={FileText} label="Legacy events in 30 days" value={legacy.events_30d} />
        <SignalRow icon={Eye} label="Legacy report opens" value={legacy.report_views_30d} />
        <SignalRow icon={Users} label="Legacy sessions" value={legacy.sessions_30d} />
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-2">
          <p className="text-xs font-medium text-slate-500">Last legacy activity</p>
          <p className="mt-1 text-sm font-semibold text-slate-950">
            {legacy.last_activity_at ? formatMiamiDateTime(legacy.last_activity_at) : "No legacy activity"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ManualUsageCard({ manual }: { manual: UsageManualSummary }) {
  return (
    <Card className="magic-card border-slate-200 bg-white/90">
      <CardHeader className="border-b border-slate-100">
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
        <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-slate-500">Form/list opens</span>
            <span className="font-semibold text-slate-950">{formatNumber(manual.page_opens_7d)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-slate-500">Anonymous sessions</span>
            <span className="font-semibold text-slate-950">{formatNumber(manual.active_sessions_7d)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-slate-500">Manual link clicks</span>
            <span className="font-semibold text-slate-950">{formatNumber(manual.link_clicks_7d)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-slate-500">Active pending/processing</span>
            <span className="font-semibold text-slate-950">{formatNumber(manual.pending_reports)}</span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-2">
          <p className="text-xs font-medium text-slate-500">Last self-submitted activity</p>
          <p className="mt-1 text-sm font-semibold text-slate-950">
            {manual.last_activity_at ? formatMiamiDateTime(manual.last_activity_at) : "No activity yet"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ChatUsageCard({
  chat,
  reps,
}: {
  chat: UsageChatSummary;
  reps: UsageChatRep[];
}) {
  const reportsAskedAbout =
    chat.official_reports_with_questions_7d + chat.manual_reports_with_questions_7d;

  return (
    <Card className="magic-card border-slate-200 bg-white/90">
      <CardHeader className="border-b border-slate-100">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-slate-950">
              <Bot className="size-4 text-[#DC2626]" />
              Ask Magic Mike Chat Usage
            </CardTitle>
            <CardDescription>
              Supplemental signal only. These chatbot events do not change verified engagement or sales impact scores.
            </CardDescription>
          </div>
          <Badge variant="outline" className="w-fit rounded-full border-slate-200 bg-slate-50 text-slate-500">
            Low-priority signal
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SignalRow icon={Bot} label="Chat opens in 7 days" value={chat.opens_7d} />
          <SignalRow
            icon={MessageCircleQuestion}
            label="Questions asked in 7 days"
            value={chat.questions_7d}
          />
          <SignalRow icon={CheckCircle2} label="Answers delivered" value={chat.answers_7d} />
          <SignalRow icon={CircleAlert} label="Chat errors" value={chat.errors_7d} />
        </div>

        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">Reps using chat</p>
            <p className="mt-1 text-xl font-extrabold tracking-normal text-slate-950">
              {formatNumber(chat.reps_using_chat_7d)}
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">Reports asked about</p>
            <p className="mt-1 text-xl font-extrabold tracking-normal text-slate-950">
              {formatNumber(reportsAskedAbout)}
            </p>
            <p className="mt-1 text-xs font-medium text-slate-500">
              {formatNumber(chat.official_reports_with_questions_7d)} official,{" "}
              {formatNumber(chat.manual_reports_with_questions_7d)} self-submitted
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">Last chat activity</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-950">
              {chat.last_activity_at ? formatMiamiDateTime(chat.last_activity_at) : "No chat activity yet"}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-medium leading-5 text-slate-500">
            Chat tracking stores event counts and safe context only, such as report type and whether a starter prompt was used. It does not store the question text.
          </p>
        </div>

        {reps.length ? (
          <div className="dashboard-scroll overflow-x-auto rounded-2xl border border-slate-200">
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow>
                  <TableHead>Rep</TableHead>
                  <TableHead className="text-right">Questions</TableHead>
                  <TableHead className="text-right">Opens</TableHead>
                  <TableHead className="text-right">Answers</TableHead>
                  <TableHead className="text-right">Errors</TableHead>
                  <TableHead>Report context</TableHead>
                  <TableHead>Last activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reps.map((rep) => (
                  <TableRow key={rep.rep_slug}>
                    <TableCell>
                      <span className="font-medium text-slate-950">{rep.rep_name}</span>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatNumber(rep.questions_7d)}
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(rep.opens_7d)}</TableCell>
                    <TableCell className="text-right">{formatNumber(rep.answers_7d)}</TableCell>
                    <TableCell className="text-right">{formatNumber(rep.errors_7d)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="outline">
                          {formatNumber(rep.official_reports_asked_7d)} official
                        </Badge>
                        <Badge variant="outline">
                          {formatNumber(rep.manual_reports_asked_7d)} self-submitted
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {rep.last_activity_at ? formatMiamiDateTime(rep.last_activity_at) : "No activity"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <EmptyPanel text="No Ask Magic Mike chat usage has been recorded in the last 7 days." />
        )}
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
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#FEF2F2] text-[#DC2626]">
          <Icon className="size-3.5" />
        </span>
        <span className="min-w-0 text-sm font-medium text-slate-500">{label}</span>
      </div>
      <span className="text-lg font-bold text-slate-950">{formatNumber(value)}</span>
    </div>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center text-sm font-medium text-slate-500">
      {text}
    </div>
  );
}

function getStackWidth(value: number, max: number) {
  if (!value) return "0%";
  return `${Math.round((value / max) * 100)}%`;
}

function formatNumber(value: number) {
  return numberFormatter.format(value);
}



function formatDayLabel(day: string) {
  const date = new Date(`${day}T00:00:00`);
  if (Number.isNaN(date.getTime())) return day;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

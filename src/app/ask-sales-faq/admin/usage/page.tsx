import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Activity,
  CalendarDays,
  MessageCircleQuestion,
  Repeat2,
  UserCheck,
  UserMinus,
  Users,
  View,
} from "lucide-react";
import { auth } from "@/auth";
import { AskSalesAdminHeader } from "@/components/ask-sales-faq/admin-navigation";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { normalizeAskSalesFaqAnalyticsDays } from "@/lib/ask-sales-faq/admin-analytics";
import { getAskSalesFaqAccess, isAskSalesFaqAdmin } from "@/lib/ask-sales-faq/access";
import type { AskSalesFaqUsageUser } from "@/lib/ask-sales-faq/types";
import { getAskSalesFaqUsageOverview } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ask Sales Rep Adoption | Magic Mike Bot",
  robots: { index: false, follow: false },
};

export default async function AskSalesFaqUsagePage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string | string[] }>;
}) {
  const session = await auth();
  const access = getAskSalesFaqAccess(session);

  if (!access.ok || !isAskSalesFaqAdmin(access.viewerEmail)) notFound();

  const days = normalizeAskSalesFaqAnalyticsDays((await searchParams).days, 30);
  const overview = await getAskSalesFaqUsageOverview(days);
  const { summary } = overview;

  return (
    <main className="magic-page min-h-[calc(100dvh-72px)] bg-[#f8fafc]">
      <div className="mx-auto flex w-full max-w-[88rem] flex-col gap-5 px-5 pb-16 pt-8 sm:px-8">
        <AskSalesAdminHeader
          active="usage"
          title="Rep adoption"
          description="Track who has tried Ask Sales, who returns, and who has signed in to Magic Mike but has not yet asked a question. Coaching-report usage remains completely separate."
          generatedAt={overview.generatedAt}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-600">Ask Sales activity window</p>
            <p className="mt-1 text-xs text-slate-500">Known users combine signed-in dashboard activity, stored rep emails, and Ask Sales identities. Ask Sales admins are excluded.</p>
          </div>
          <div className="flex rounded-full border border-slate-200 bg-white p-1 shadow-sm">
            {[7, 30, 90].map((window) => (
              <Link key={window} href={`/ask-sales-faq/admin/usage?days=${window}`} className={`rounded-full px-3 py-1.5 text-xs font-extrabold transition-colors ${days === window ? "bg-[#DC2626] text-white" : "text-slate-500 hover:bg-slate-100"}`}>
                {window} days
              </Link>
            ))}
          </div>
        </div>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={Users} label="Known signed-in users" value={summary.knownUsers} helper="Dashboard identities and stored rep emails, excluding Ask Sales admins." />
          <MetricCard icon={UserCheck} label="Activated" value={`${summary.adoptionRate}%`} helper={`${summary.activatedUsers} people have asked at least one question.`} tone="good" />
          <MetricCard icon={Activity} label="Active reps" value={summary.active7d} helper={`${summary.active30d} active in the last 30 days.`} tone="good" />
          <MetricCard icon={Repeat2} label="Returning users" value={summary.returningUsers} helper="People with Ask Sales activity on at least two different days." />
          <MetricCard icon={MessageCircleQuestion} label={`Questions, ${days}d`} value={summary.questionsInWindow} helper={`${summary.averageQuestionsPerActiveUser} questions per active user.`} />
          <MetricCard icon={UserMinus} label="Not activated" value={summary.neverUsed} helper="Known dashboard users who have not submitted an Ask Sales question." tone={summary.neverUsed ? "warning" : "good"} />
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]">
          <DailyUsagePanel daily={overview.daily} />
          <AdoptionPanel summary={summary} />
        </section>

        <section className="magic-card overflow-hidden">
          <div className="border-b border-slate-100 p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-extrabold text-slate-950">Rep adoption detail</h2>
                <p className="mt-1 text-sm text-slate-500">Usage only—this does not score rep performance or mix in coaching-report engagement.</p>
              </div>
              <Badge variant="outline" className="w-fit border-slate-200 bg-slate-50">{overview.users.length} known users</Badge>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rep / user</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Questions</TableHead>
                  <TableHead className="text-right">Active days</TableHead>
                  <TableHead className="text-right">Grounded / routed</TableHead>
                  <TableHead className="text-right">Avg. latency</TableHead>
                  <TableHead>Last use</TableHead>
                  <TableHead className="text-right">Review</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overview.users.map((user) => <UsageRow key={user.viewerEmail} user={user} windowDays={days} />)}
                {!overview.users.length ? <TableRow><TableCell colSpan={8} className="py-10 text-center text-sm text-slate-500">No signed-in identities are available yet.</TableCell></TableRow> : null}
              </TableBody>
            </Table>
          </div>
        </section>

        <p className="pb-2 text-xs font-medium text-slate-400">
          The denominator is the strongest available dashboard identity set, not a claim that every company employee is an eligible sales rep. If access later moves to a canonical roster, this page can switch sources without changing Ask Sales activity history.
        </p>
      </div>
    </main>
  );
}

function MetricCard({ icon: Icon, label, value, helper, tone = "default" }: { icon: typeof Users; label: string; value: string | number; helper: string; tone?: "default" | "good" | "warning" }) {
  const iconTone = tone === "good" ? "bg-emerald-50 text-emerald-600" : tone === "warning" ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600";
  return <article className="magic-card p-4"><div className="flex items-center justify-between gap-3"><span className="text-sm font-bold text-slate-600">{label}</span><span className={`grid size-9 place-items-center rounded-xl ${iconTone}`}><Icon className="size-4" /></span></div><p className="mt-4 text-3xl font-extrabold text-slate-950">{value}</p><p className="mt-2 text-xs font-medium leading-5 text-slate-500">{helper}</p></article>;
}

function DailyUsagePanel({ daily }: { daily: Array<{ day: string; questions: number; activeUsers: number }> }) {
  const maxQuestions = Math.max(1, ...daily.map((point) => point.questions));
  return (
    <section className="magic-card overflow-hidden">
      <div className="border-b border-slate-100 p-5"><h2 className="text-lg font-extrabold text-slate-950">Daily Ask Sales activity</h2><p className="mt-1 text-sm text-slate-500">Question volume with distinct active users shown alongside it.</p></div>
      <div className="space-y-3 p-5">
        {daily.map((point) => <div key={point.day} className="grid grid-cols-[4.5rem_minmax(0,1fr)_5.5rem] items-center gap-3"><span className="text-xs font-semibold text-slate-500">{formatDay(point.day)}</span><div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-red-500 to-red-300" style={{ width: `${(point.questions / maxQuestions) * 100}%` }} /></div><span className="text-right text-xs font-bold text-slate-600">{point.questions} Q · {point.activeUsers} reps</span></div>)}
      </div>
    </section>
  );
}

function AdoptionPanel({ summary }: { summary: { knownUsers: number; activatedUsers: number; neverUsed: number; active7d: number; active30d: number; returningUsers: number } }) {
  const activatedWidth = summary.knownUsers ? (summary.activatedUsers / summary.knownUsers) * 100 : 0;
  return (
    <section className="magic-card overflow-hidden">
      <div className="border-b border-slate-100 p-5"><h2 className="text-lg font-extrabold text-slate-950">Adoption snapshot</h2><p className="mt-1 text-sm text-slate-500">Activation and repeat use are intentionally kept separate.</p></div>
      <div className="space-y-4 p-5">
        <div><div className="flex justify-between text-sm font-bold text-slate-600"><span>Activated</span><span>{summary.activatedUsers}/{summary.knownUsers}</span></div><div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${activatedWidth}%` }} /></div></div>
        <SnapshotRow icon={CalendarDays} label="Active in 7 days" value={summary.active7d} />
        <SnapshotRow icon={Activity} label="Active in 30 days" value={summary.active30d} />
        <SnapshotRow icon={Repeat2} label="Used on 2+ days" value={summary.returningUsers} />
        <SnapshotRow icon={UserMinus} label="Never asked" value={summary.neverUsed} />
      </div>
    </section>
  );
}

function SnapshotRow({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: number }) {
  return <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"><span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600"><Icon className="size-4 text-red-500" />{label}</span><strong className="text-slate-950">{value}</strong></div>;
}

function UsageRow({ user, windowDays }: { user: AskSalesFaqUsageUser; windowDays: number }) {
  return (
    <TableRow>
      <TableCell className="min-w-60"><div className="font-bold text-slate-800">{user.viewerName || user.viewerEmail}</div><div className="mt-1 text-xs text-slate-500">{user.viewerEmail}</div><div className="mt-1 flex gap-1">{user.knownFromDashboard ? <Badge variant="outline" className="text-[10px]">Dashboard</Badge> : null}{user.knownFromRepRoster ? <Badge variant="outline" className="text-[10px]">Rep roster</Badge> : null}</div></TableCell>
      <TableCell><StatusBadge status={user.status} /></TableCell>
      <TableCell className="text-right"><strong>{user.questionsInWindow}</strong><div className="text-xs text-slate-400">{windowDays}d · {user.questionsAllTime} total</div></TableCell>
      <TableCell className="text-right">{user.activeDays}</TableCell>
      <TableCell className="text-right"><span className="font-semibold text-emerald-600">{user.groundedAnswersInWindow}</span><span className="text-slate-300"> / </span><span className="font-semibold text-amber-600">{user.routesInWindow}</span>{user.failuresInWindow ? <div className="text-xs font-semibold text-red-600">{user.failuresInWindow} failure{user.failuresInWindow === 1 ? "" : "s"}</div> : null}</TableCell>
      <TableCell className="text-right">{formatSeconds(user.averageLatencyMs)}</TableCell>
      <TableCell className="min-w-36 text-sm text-slate-600">{user.lastAskedAt ? formatDate(user.lastAskedAt) : "Never"}</TableCell>
      <TableCell className="text-right">
        {user.questionsAllTime > 0 && user.repReviewKey ? (
          <Link
            href={`/ask-sales-faq/admin/usage/${user.repReviewKey}?days=all&returnDays=${windowDays}`}
            className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 text-xs font-extrabold text-slate-700 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700"
          >
            <View className="size-3.5" />
            View Q&amp;A
          </Link>
        ) : <span className="text-xs text-slate-300">—</span>}
      </TableCell>
    </TableRow>
  );
}

function StatusBadge({ status }: { status: AskSalesFaqUsageUser["status"] }) {
  const config = status === "active" ? ["Active", "border-emerald-200 bg-emerald-50 text-emerald-700"] : status === "new" ? ["New", "border-blue-200 bg-blue-50 text-blue-700"] : status === "returning" ? ["Returning", "border-purple-200 bg-purple-50 text-purple-700"] : status === "dormant" ? ["Dormant", "border-amber-200 bg-amber-50 text-amber-700"] : ["Not activated", "border-slate-200 bg-slate-50 text-slate-600"];
  return <Badge variant="outline" className={config[1]}>{config[0]}</Badge>;
}

function formatSeconds(ms: number) { return ms ? `${(ms / 1000).toFixed(ms >= 10_000 ? 0 : 1)}s` : "—"; }
function formatDay(value: string) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(`${value}T12:00:00Z`)); }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date); }

import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownRight,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileWarning,
  Gauge,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRepScoringAdmin } from "@/lib/rep-scoring/access";
import { getRepScoringDashboardData, type RepRollup } from "@/lib/rep-scoring/data";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rep Performance Review | Magic Mike Bot",
  description: "Private evidence-backed coaching view for authorized managers.",
  robots: { index: false, follow: false },
};

const numberFormatter = new Intl.NumberFormat("en-US");

export default async function ManagerRepScoringPage() {
  await requireRepScoringAdmin();
  const data = await getRepScoringDashboardData();

  return (
    <main className="magic-page">
      <div className="mx-auto flex w-full max-w-[84rem] flex-col gap-5 px-5 pb-16 pt-8 sm:px-8">
        <header className="magic-card magic-hero p-5 md:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="magic-kicker"><ShieldCheck className="size-3.5" />Admin only</span>
                <Badge variant="outline" className="rounded-full border-amber-200 bg-amber-50 text-amber-800">
                  {data.shadowMode ? "Shadow review" : "Manager review"}
                </Badge>
                {data.killSwitch ? <Badge variant="destructive">Scoring paused</Badge> : null}
              </div>
              <h1 className="text-[34px] font-extrabold leading-tight tracking-normal text-slate-950 md:text-[44px]">
                Rep performance review
              </h1>
              <p className="mt-3 max-w-2xl text-[15px] font-medium leading-7 text-slate-500">
                Start with the people who may need coaching. Scores guide review; the call evidence explains why.
              </p>
            </div>
            <div className="flex flex-col gap-2 text-sm text-slate-500 lg:items-end">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-2">
                <Clock3 className="size-4 text-[#DC2626]" />Loaded {formatDateTime(data.generatedAt)}
              </div>
              <Link href="/coaching" className={cn(buttonVariants({ variant: "outline" }), "h-9 w-fit rounded-full border-slate-200 bg-white hover:bg-[#FEF2F2] hover:text-[#B91C1C]")}>Open coaching</Link>
            </div>
          </div>
        </header>

        {data.error ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            <strong>Safe unavailable state:</strong> {data.error} No production coaching data was changed.
          </div>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard icon={AlertTriangle} title="Needs review" value={data.summary.needsReview} description="Combined evidence says look closer" tone="red" />
          <MetricCard icon={ArrowDownRight} title="Declining" value={data.summary.declining} description="Recent calls below personal baseline" tone="amber" />
          <MetricCard icon={Users} title="Reps tracked" value={data.summary.repsTracked} description="Separate Call 1 and Call 2+ views" />
          <MetricCard icon={Gauge} title="Calls scored" value={data.summary.scoredCalls} description={`${numberFormatter.format(data.summary.quarantinedCalls)} safely quarantined`} />
        </section>

        <PriorityTable rollups={data.rollups} />
        <RecentCalls calls={data.recentCalls.slice(0, 20)} />

        <p className="max-w-4xl text-xs leading-5 text-slate-500">
          This private page reads only the isolated rep-scoring base. It does not edit Magic Mike reports, source call records, Slack, Google Docs, or employment decisions.
        </p>
      </div>
    </main>
  );
}

function PriorityTable({ rollups }: { rollups: RepRollup[] }) {
  return (
    <Card className="magic-card border-white/80 bg-white/95">
      <CardHeader className="gap-1">
        <CardTitle className="text-xl text-slate-950">Who to review first</CardTitle>
        <p className="text-sm leading-6 text-slate-500">High-confidence concerns appear first. Small samples stay clearly labeled.</p>
      </CardHeader>
      <CardContent>
        {rollups.length ? (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <Table>
              <TableHeader><TableRow className="bg-slate-50/80"><TableHead>Rep</TableHead><TableHead>Call type</TableHead><TableHead>Recent</TableHead><TableHead>Change</TableHead><TableHead>Confidence</TableHead><TableHead>Review signal</TableHead></TableRow></TableHeader>
              <TableBody>
                {rollups.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell><div className="font-semibold text-slate-950">{row.repName}</div><div className="text-xs text-slate-500">{row.tenureBand}</div></TableCell>
                    <TableCell><Badge variant="outline" className="rounded-full">{row.callType}</Badge></TableCell>
                    <TableCell><div className="font-semibold">{formatScore(row.rollingMean)}</div><div className="text-xs text-slate-500">{row.nScored} calls</div></TableCell>
                    <TableCell className={row.delta !== null && row.delta < 0 ? "font-semibold text-red-700" : "text-slate-600"}>{formatDelta(row.delta)}</TableCell>
                    <TableCell>{row.confidence}</TableCell>
                    <TableCell><PriorityBadge row={row} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <EmptyState icon={CheckCircle2} title="No rollups yet" description="The page is ready. Rep summaries will appear after the isolated shadow scoring run completes." />
        )}
      </CardContent>
    </Card>
  );
}

function RecentCalls({ calls }: { calls: Awaited<ReturnType<typeof getRepScoringDashboardData>>["recentCalls"] }) {
  return (
    <Card className="magic-card border-white/80 bg-white/95">
      <CardHeader className="gap-1"><CardTitle className="text-xl text-slate-950">Recent scored calls</CardTitle><p className="text-sm leading-6 text-slate-500">Open a call to inspect timestamps, quotes, behaviors, and scoring evidence.</p></CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        {calls.length ? calls.map((call) => (
          <Link key={call.assessmentId} href={`/manager/rep-scoring/call/${encodeURIComponent(call.assessmentId)}`} className="group rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-red-200 hover:bg-red-50/30">
            <div className="flex items-start justify-between gap-3"><div><div className="font-bold text-slate-950">{call.repName}</div><div className="mt-1 text-xs text-slate-500">{call.callType} · {formatDateTime(call.meetingStartAt || call.scoredAt)}</div></div><ExternalLink className="size-4 text-slate-400 group-hover:text-red-600" /></div>
            <div className="mt-4 flex items-end justify-between gap-3"><div><div className="text-2xl font-extrabold text-slate-950">{formatScore(call.score)}</div><div className="text-xs text-slate-500">{call.band}</div></div><Badge variant="outline" className="rounded-full">{call.status}</Badge></div>
          </Link>
        )) : <div className="md:col-span-2"><EmptyState icon={FileWarning} title="No scored calls yet" description="This stays empty until the one-week shadow run produces validated evidence." /></div>}
      </CardContent>
    </Card>
  );
}

function MetricCard({ icon: Icon, title, value, description, tone = "slate" }: { icon: LucideIcon; title: string; value: number; description: string; tone?: "slate" | "red" | "amber" }) {
  const styles = tone === "red" ? "border-red-100 bg-red-50 text-red-700" : tone === "amber" ? "border-amber-100 bg-amber-50 text-amber-700" : "border-slate-200 bg-slate-50 text-slate-700";
  return <Card className="magic-card border-white/80 bg-white/95"><CardContent className="pt-1"><div className={cn("mb-4 inline-flex size-10 items-center justify-center rounded-xl border", styles)}><Icon className="size-5" /></div><div className="text-3xl font-extrabold text-slate-950">{numberFormatter.format(value)}</div><div className="mt-1 font-semibold text-slate-800">{title}</div><p className="mt-1 text-xs leading-5 text-slate-500">{description}</p></CardContent></Card>;
}

function PriorityBadge({ row }: { row: RepRollup }) {
  const urgent = /review|high|urgent|priority/i.test(row.priority) && !/no review/i.test(row.priority);
  return <Badge variant="outline" className={cn("rounded-full", urgent ? "border-red-200 bg-red-50 text-red-700" : row.declineConcern ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-700")}>{row.priority}</Badge>;
}

function EmptyState({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center"><Icon className="mx-auto size-6 text-slate-400" /><div className="mt-3 font-semibold text-slate-900">{title}</div><p className="mx-auto mt-1 max-w-xl text-sm leading-6 text-slate-500">{description}</p></div>;
}

function formatScore(value: number | null) { return value === null ? "—" : value.toFixed(1); }
function formatDelta(value: number | null) { return value === null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(1)}`; }
function formatDateTime(value: string) { if (!value) return "Not available"; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" }).format(date); }

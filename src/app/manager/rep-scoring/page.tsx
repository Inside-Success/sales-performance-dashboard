import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileWarning,
  Hourglass,
  ShieldCheck,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRepScoringAdmin } from "@/lib/rep-scoring/access";
import { getRepScoringDashboardData, type RepRollup, type RepScoringCoverage } from "@/lib/rep-scoring/data";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rep Performance Review | Magic Mike Bot",
  description: "Private evidence-backed sales rep review for authorized managers.",
  robots: { index: false, follow: false },
};

const numberFormatter = new Intl.NumberFormat("en-US");

export default async function ManagerRepScoringPage({ searchParams }: PageProps<"/manager/rep-scoring">) {
  await requireRepScoringAdmin();
  const data = await getRepScoringDashboardData();
  const query = await searchParams;
  const requestedCallType = typeof query.callType === "string" ? query.callType : "All";
  const callType = ["Call 1", "Call 2+"].includes(requestedCallType) ? requestedCallType : "All";
  const rollups = callType === "All" ? data.rollups : data.rollups.filter((row) => row.callType === callType);
  const calls = (callType === "All" ? data.recentCalls : data.recentCalls.filter((call) => call.callType === callType))
    .filter((call) => !call.internalInconsistency)
    .slice(0, 20);
  const sourceReps = data.coverage.sourceReps ?? data.summary.repsTracked;

  return (
    <main className="magic-page">
      <div className="mx-auto flex w-full max-w-[88rem] flex-col gap-5 px-5 pb-16 pt-8 sm:px-8">
        <header className="magic-card magic-hero p-5 md:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="magic-kicker"><ShieldCheck className="size-3.5" />Admin only</span>
                <Badge variant="outline" className="rounded-full border-amber-200 bg-amber-50 text-amber-800">
                  {data.shadowMode ? "Validation in progress" : "Manager review"}
                </Badge>
                {data.killSwitch ? <Badge variant="destructive">Scoring paused</Badge> : null}
              </div>
              <h1 className="text-[34px] font-extrabold leading-tight tracking-normal text-slate-950 md:text-[44px]">
                Sales rep performance
              </h1>
              <p className="mt-3 max-w-2xl text-[15px] font-medium leading-7 text-slate-600">
                See the score, the amount of evidence behind it, and the exact skill to coach. Call 1 and Call 2+ are assessed separately.
              </p>
            </div>
            <div className="flex flex-col gap-2 text-sm text-slate-500 lg:items-end">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-2">
                <Clock3 className="size-4 text-[#DC2626]" />Page loaded {formatDateTime(data.generatedAt)}
              </div>
              <Link href="/coaching" className={cn(buttonVariants({ variant: "outline" }), "h-9 w-fit rounded-full border-slate-200 bg-white hover:bg-[#FEF2F2] hover:text-[#B91C1C]")}>Open coaching</Link>
            </div>
          </div>
        </header>

        {data.shadowMode ? (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            <strong>Validation in progress.</strong> Each score is tied to exact call evidence. A rep enters “Needs manager review” only after at least three valid calls of the same type; this view is still a supporting signal, not a personnel decision.
          </div>
        ) : null}

        {data.error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900">
            <strong>Data unavailable:</strong> {data.error} No production coaching data was changed.
          </div>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard icon={AlertTriangle} title="Needs manager review" value={data.summary.needsReview} description="Enough evidence plus a supported low or declining signal" tone="red" />
          <MetricCard icon={UserCheck} title="Reps ready to assess" value={data.summary.enoughEvidence} description="At least 3 valid calls of the same type" tone="green" />
          <MetricCard icon={Users} title="Still gathering evidence" value={data.summary.gatheringEvidence} description={`Of ${numberFormatter.format(sourceReps)} reps with eligible calls`} tone="amber" />
          <MetricCard icon={CheckCircle2} title="Valid calls analyzed" value={data.summary.scoredCalls} description="Evidence-verified calls in the fixed reporting period" tone="green" />
        </section>

        <EvidenceStatusPanel coverage={data.coverage} readyReps={data.summary.enoughEvidence} gatheringReps={data.summary.gatheringEvidence} />

        <HowToRead />

        <nav className="flex flex-wrap gap-2" aria-label="Call type filter">
          {["All", "Call 1", "Call 2+"].map((option) => (
            <Link
              key={option}
              href={option === "All" ? "/manager/rep-scoring" : `/manager/rep-scoring?callType=${encodeURIComponent(option)}`}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-bold transition",
                callType === option ? "border-red-600 bg-red-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-red-200 hover:text-red-700",
              )}
            >
              {option}
            </Link>
          ))}
        </nav>

        <RepReviewTable rollups={rollups} />
        <RecentCalls calls={calls} />
        <ProcessingDetails coverage={data.coverage} excludedCalls={data.summary.quarantinedCalls} />

        <p className="max-w-4xl text-xs leading-5 text-slate-500">
          This private page reads only the isolated rep-scoring base. It does not edit Magic Mike reports, source call records, Slack, Google Docs, or employment decisions.
        </p>
      </div>
    </main>
  );
}

function EvidenceStatusPanel({ coverage, readyReps, gatheringReps }: { coverage: RepScoringCoverage; readyReps: number; gatheringReps: number }) {
  if (!coverage.available) {
    return (
      <Card className="magic-card border-blue-100 bg-blue-50/80">
        <CardContent className="flex gap-3 p-5 text-sm leading-6 text-blue-950">
          <Hourglass className="mt-0.5 size-5 shrink-0" />
          <div><strong>Evidence collection is being initialized.</strong><br />Rows will appear only after a call has a valid score backed by exact transcript evidence.</div>
        </CardContent>
      </Card>
    );
  }

  const sourceReps = coverage.sourceReps ?? readyReps + gatheringReps;
  const readinessPercent = sourceReps ? Math.round((readyReps / sourceReps) * 1000) / 10 : 0;

  return (
    <Card className="magic-card overflow-hidden border-white/80 bg-white/95">
      <CardHeader className="gap-1 border-b border-slate-100">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-xl text-slate-950">Is there enough evidence to assess each rep?</CardTitle>
            <p className="mt-1 text-sm leading-6 text-slate-500">Reporting period: {formatWindow(coverage.windowStart, coverage.windowEnd)} · updated {formatDateTime(coverage.measuredAt)}</p>
          </div>
          <Badge variant="outline" className={cn("rounded-full px-3 py-1", readinessPercent >= 95 ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900")}>
            {numberFormatter.format(readyReps)} of {numberFormatter.format(sourceReps)} reps ready
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-5">
        <div className="h-3 overflow-hidden rounded-full bg-slate-100" aria-label="Rep evidence readiness">
          <div className="h-full rounded-full bg-red-600" style={{ width: `${Math.min(100, Math.max(0, readinessPercent))}%` }} />
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-700">
          A rep is ready only after at least three valid scores for the same call type. One or two calls remain clearly labeled as an early signal. New batches are spread across the team and use each group&apos;s newest calls first.
        </p>
      </CardContent>
    </Card>
  );
}

function ProcessingDetails({ coverage, excludedCalls }: { coverage: RepScoringCoverage; excludedCalls: number }) {
  if (!coverage.available) return null;
  return (
    <details className="magic-card rounded-2xl border border-slate-200 bg-white/90 p-5 text-sm text-slate-700">
      <summary className="cursor-pointer font-bold text-slate-900">Data processing details</summary>
      <p className="mt-3 leading-6 text-slate-600">These figures explain the pipeline; managers do not need them to rank reps. Every count below uses the same fixed reporting period.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <CoverageStat label="Source calls found" value={coverage.sourceCandidates} helper="Passed the source quality gates" />
        <CoverageStat label="Attempts completed" value={coverage.completed} helper="Scored or safely excluded before this run" />
        <CoverageStat label="Processing" value={coverage.inProgress} helper="Currently held by an active workflow lease" />
        <CoverageStat label="Waiting" value={coverage.awaiting} helper="Eligible calls not attempted yet" />
        <CoverageStat label="Next balanced batch" value={coverage.selectedForRun} helper="Spread across least-assessed rep and call-type groups" />
        <CoverageStat label="Excluded from scores" value={excludedCalls} helper="Calls in this period that failed evidence validation" />
      </div>
      <p className={cn("mt-4 text-xs leading-5", coverage.reconciled ? "text-emerald-700" : "text-amber-800")}>
        {coverage.reconciled ? "Reconciled: source calls = completed attempts + processing + waiting." : "The latest snapshot did not reconcile; treat it as diagnostic only until the next successful run."}
      </p>
    </details>
  );
}

function CoverageStat({ label, value, helper }: { label: string; value: number | null; helper: string }) {
  return <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"><div className="text-2xl font-extrabold text-slate-950">{value === null ? "—" : numberFormatter.format(value)}</div><div className="mt-1 text-sm font-bold text-slate-800">{label}</div><div className="mt-1 text-xs leading-5 text-slate-500">{helper}</div></div>;
}

function HowToRead() {
  return (
    <Card className="magic-card border-white/80 bg-white/95">
      <CardContent className="grid gap-4 p-5 md:grid-cols-3">
        <ReadStep number="1" title="Read the score" body="0–24 Unacceptable · 25–49 Needs Improvement · 50–69 Developing · 70–84 Meets Expectations · 85–100 Excellent." />
        <ReadStep number="2" title="Check the evidence amount" body="One or two calls are an early signal. A manager review signal begins only after at least three scored calls of the same type." />
        <ReadStep number="3" title="Open the rep" body="Use the coaching priority and the quoted call evidence to decide what should be observed or trained next." />
      </CardContent>
    </Card>
  );
}

function ReadStep({ number, title, body }: { number: string; title: string; body: string }) {
  return <div className="flex gap-3"><div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-red-600 text-sm font-extrabold text-white">{number}</div><div><div className="font-extrabold text-slate-900">{title}</div><p className="mt-1 text-sm leading-6 text-slate-600">{body}</p></div></div>;
}

function RepReviewTable({ rollups }: { rollups: RepRollup[] }) {
  return (
    <Card className="magic-card border-white/80 bg-white/95">
      <CardHeader className="gap-1">
        <CardTitle className="text-xl text-slate-950">Rep scores and coaching priorities</CardTitle>
        <p className="text-sm leading-6 text-slate-500">Lowest supported scores appear first. Every row states exactly how many calls support it.</p>
      </CardHeader>
      <CardContent>
        {rollups.length ? (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <Table>
              <TableHeader><TableRow className="bg-slate-50/80"><TableHead>Rep</TableHead><TableHead>Call type</TableHead><TableHead>Score</TableHead><TableHead>Evidence</TableHead><TableHead>Coaching priority</TableHead><TableHead>Recent direction</TableHead><TableHead><span className="sr-only">Open</span></TableHead></TableRow></TableHeader>
              <TableBody>
                {rollups.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell><div className="font-semibold text-slate-950">{row.repName}</div><div className="text-xs text-slate-500">{row.nScored === 1 ? "1 scored call" : `${row.nScored} scored calls`}</div></TableCell>
                    <TableCell><Badge variant="outline" className="rounded-full">{row.callType}</Badge></TableCell>
                    <TableCell><div className="text-lg font-extrabold text-slate-950">{formatScore(row.rollingMean)}</div><div className="text-xs font-semibold text-slate-500">{scoreBand(row.rollingMean)}</div></TableCell>
                    <TableCell><EvidenceBadge row={row} /></TableCell>
                    <TableCell><div className="max-w-[15rem] text-sm font-semibold text-slate-800">{row.coachingPriority}</div><div className="mt-1 text-xs text-slate-500">Strongest: {row.strongestArea}</div></TableCell>
                    <TableCell className={row.delta !== null && row.delta < 0 ? "font-semibold text-red-700" : "text-slate-600"}>{row.delta === null ? "No baseline yet" : formatDelta(row.delta)}</TableCell>
                    <TableCell><Link href={`/manager/rep-scoring/rep/${encodeURIComponent(row.repId || row.repEmail)}`} className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-bold text-red-700 hover:underline">View rep <ExternalLink className="size-3.5" /></Link></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <EmptyState icon={CheckCircle2} title="No rep scores in this view" description="Choose another call type or wait for the isolated scoring run to complete." />
        )}
      </CardContent>
    </Card>
  );
}

function EvidenceBadge({ row }: { row: RepRollup }) {
  if (row.nScored < 3) return <Badge variant="outline" className="whitespace-nowrap rounded-full border-amber-200 bg-amber-50 text-amber-900">{row.confidence}</Badge>;
  if (isReviewPriority(row.priority)) return <Badge variant="outline" className="whitespace-nowrap rounded-full border-red-200 bg-red-50 text-red-700">{row.priority}</Badge>;
  return <Badge variant="outline" className="whitespace-nowrap rounded-full border-emerald-200 bg-emerald-50 text-emerald-800">{row.confidence}</Badge>;
}

function RecentCalls({ calls }: { calls: Awaited<ReturnType<typeof getRepScoringDashboardData>>["recentCalls"] }) {
  return (
    <Card className="magic-card border-white/80 bg-white/95">
      <CardHeader className="gap-1"><CardTitle className="text-xl text-slate-950">Recent scored calls</CardTitle><p className="text-sm leading-6 text-slate-500">Each card is one call—not the rep’s weekly result. Open it to see the formula and exact evidence.</p></CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        {calls.length ? calls.map((call) => (
          <Link key={call.assessmentId} href={`/manager/rep-scoring/call/${encodeURIComponent(call.assessmentId)}`} className="group rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-red-200 hover:bg-red-50/30">
            <div className="flex items-start justify-between gap-3"><div><div className="font-bold text-slate-950">{call.repName}</div><div className="mt-1 text-xs text-slate-500">One {call.callType} call · {formatDateTime(call.meetingStartAt || call.scoredAt)}</div></div><ExternalLink className="size-4 text-slate-400 group-hover:text-red-600" /></div>
            <div className="mt-4 flex items-end justify-between gap-3"><div><div className="text-2xl font-extrabold text-slate-950">{formatScore(call.score)}</div><div className="text-xs font-semibold text-slate-500">{call.band}</div></div><Badge variant="outline" className="rounded-full">Evidence verified</Badge></div>
          </Link>
        )) : <div className="md:col-span-2"><EmptyState icon={FileWarning} title="No valid scored calls" description="This stays empty until the isolated workflow produces evidence-verified scores." /></div>}
      </CardContent>
    </Card>
  );
}

function MetricCard({ icon: Icon, title, value, description, tone = "slate" }: { icon: LucideIcon; title: string; value: number; description: string; tone?: "slate" | "red" | "amber" | "green" }) {
  const styles = tone === "red" ? "border-red-100 bg-red-50 text-red-700" : tone === "amber" ? "border-amber-100 bg-amber-50 text-amber-800" : tone === "green" ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-700";
  return <Card className="magic-card border-white/80 bg-white/95"><CardContent className="pt-1"><div className={cn("mb-4 inline-flex size-10 items-center justify-center rounded-xl border", styles)}><Icon className="size-5" /></div><div className="text-3xl font-extrabold text-slate-950">{numberFormatter.format(value)}</div><div className="mt-1 font-semibold text-slate-800">{title}</div><p className="mt-1 text-xs leading-5 text-slate-500">{description}</p></CardContent></Card>;
}

function EmptyState({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center"><Icon className="mx-auto size-6 text-slate-400" /><div className="mt-3 font-semibold text-slate-900">{title}</div><p className="mx-auto mt-1 max-w-xl text-sm leading-6 text-slate-500">{description}</p></div>;
}

function isReviewPriority(value: string) { return /review|high|urgent|priority/i.test(value) && !/no review/i.test(value); }
function formatScore(value: number | null) { return value === null ? "—" : value.toFixed(1); }
function formatDelta(value: number | null) { return value === null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(1)}`; }
function scoreBand(value: number | null) { if (value === null) return "Not scored"; if (value < 25) return "Unacceptable"; if (value < 50) return "Needs Improvement"; if (value < 70) return "Developing"; if (value < 85) return "Meets Expectations"; return "Excellent"; }
function formatDateTime(value: string) { if (!value) return "Not available"; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" }).format(date); }
function formatWindow(start: string, end: string) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return "Current seven-day period";
  const formatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });
  const endInclusive = new Date(endDate.getTime() - 1);
  return `${formatter.format(startDate)}–${formatter.format(endInclusive)}`;
}

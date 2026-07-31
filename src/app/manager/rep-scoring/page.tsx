import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock3, ExternalLink, ShieldCheck, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRepScoringAdmin } from "@/lib/rep-scoring/access";
import { getRepScoringDashboardData, type RepPerformanceSummary, type RepScoringCoverage } from "@/lib/rep-scoring/data";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rep Performance Review | Magic Mike Bot",
  description: "Private evidence-backed sales rep review for authorized managers.",
  robots: { index: false, follow: false },
};

const numberFormatter = new Intl.NumberFormat("en-US");

export default async function ManagerRepScoringPage() {
  await requireRepScoringAdmin();
  const data = await getRepScoringDashboardData();
  const waiting = data.coverage.awaiting ?? 0;

  return (
    <main className="magic-page">
      <div className="mx-auto flex w-full max-w-[92rem] flex-col gap-5 px-5 pb-16 pt-8 sm:px-8">
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
              <h1 className="text-[34px] font-extrabold leading-tight tracking-normal text-slate-950 md:text-[44px]">Sales rep performance</h1>
              <p className="mt-3 max-w-2xl text-[15px] font-medium leading-7 text-slate-600">
                One cumulative result per rep, ordered from lowest score to highest. Open any rep to see the coaching priorities and exact call evidence behind the result.
              </p>
            </div>
            <div className="flex flex-col gap-2 text-sm text-slate-500 lg:items-end">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-2"><Clock3 className="size-4 text-red-600" />Updated {formatDateTime(data.coverage.measuredAt || data.generatedAt)}</div>
              <Link href="/coaching" className={cn(buttonVariants({ variant: "outline" }), "h-9 w-fit rounded-full border-slate-200 bg-white hover:bg-red-50 hover:text-red-700")}>Open coaching</Link>
            </div>
          </div>
        </header>

        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          <strong>How to use this page:</strong> start with the lowest scores, check how many calls support the result, then open the rep before deciding what to coach. This is a management signal, not an automatic employment decision.
        </div>

        {data.error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900"><strong>Data unavailable:</strong> {data.error}</div> : null}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric title="Needs attention" value={data.summary.needsReview} helper="Supported score below 60 or a clear recent decline" tone="red" icon={AlertTriangle} />
          <Metric title="Reps with a score" value={data.repSummaries.length} helper="Every scored rep is shown below, even with limited evidence" tone="green" icon={Users} />
          <Metric title="Valid calls analyzed" value={data.summary.scoredCalls} helper="Evidence-verified calls accumulated since the fixed start" tone="green" icon={CheckCircle2} />
          <Metric title="Calls waiting" value={waiting} helper="The isolated workflow processes another safe batch each hour" tone="amber" icon={Clock3} />
        </section>

        <CatchUpProgress coverage={data.coverage} />
        <MethodSummary coverage={data.coverage} />
        <RepTable reps={data.repSummaries} />
        <ProcessingDetails coverage={data.coverage} excludedCalls={data.summary.quarantinedCalls} />

        <p className="max-w-4xl text-xs leading-5 text-slate-500">This private page reads only the isolated rep-scoring base. It does not edit source calls, Magic Mike coaching reports, Slack, Google content, or employment records.</p>
      </div>
    </main>
  );
}

function CatchUpProgress({ coverage }: { coverage: RepScoringCoverage }) {
  if (!coverage.available) return null;
  const waiting = Math.max(0, coverage.awaiting ?? 0);
  const complete = Math.max(0, Math.min(100, coverage.percentComplete ?? 0));
  const observedRate = Math.max(0, coverage.processedLastHour);
  const processingNow = Math.max(0, (coverage.inProgress ?? 0) + (coverage.selectedForRun ?? 0));
  const estimatedHours = waiting > 0 && observedRate > 0 ? Math.ceil(waiting / observedRate) : null;

  if (waiting === 0) {
    return <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-950"><div className="flex items-center gap-2 font-extrabold"><CheckCircle2 className="size-5" />Call analysis is up to date</div><p className="mt-1 leading-6">New eligible calls will continue to be collected and analyzed automatically each hour.</p></div>;
  }

  return (
    <Card className="magic-card border-amber-200 bg-gradient-to-br from-amber-50 to-white">
      <CardHeader className="gap-1 pb-3"><CardTitle className="flex items-center gap-2 text-xl text-slate-950"><Clock3 className="size-5 text-amber-700" />Historical call catch-up</CardTitle><p className="text-sm leading-6 text-slate-600">The system is working through the existing call queue in isolated background batches. You do not need to keep this page open.</p></CardHeader>
      <CardContent>
        <div className="h-3 overflow-hidden rounded-full bg-amber-100"><div className="h-full rounded-full bg-red-600 transition-[width]" style={{ width: `${complete}%` }} /></div>
        <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs font-semibold text-slate-600"><span>{complete.toFixed(1)}% complete</span><span>{numberFormatter.format(waiting)} calls remaining</span></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ProgressStat label="Analyzed" value={coverage.completed} helper="Completed attempts" />
          <ProgressStat label="Valid scores last hour" value={observedRate} helper="Evidence-verified calls" />
          <ProgressStat label="Processing now" value={processingNow} helper="Safely leased or newly released" />
          <ProgressStat label="Estimated finish" value={estimatedHours === null ? "Calculating" : estimatedHours <= 1 ? "Within an hour" : `About ${estimatedHours} hours`} helper={observedRate ? "Based on valid scores in the latest hour" : "Available after workers complete"} />
        </div>
        <p className="mt-4 text-xs leading-5 text-slate-500">One coordinator starts each hour and can release up to {numberFormatter.format(coverage.hourlyBatchLimit ?? 200)} calls to failure-isolated workers. Individual failures are retried or quarantined without stopping other batches.</p>
      </CardContent>
    </Card>
  );
}

function ProgressStat({ label, value, helper }: { label: string; value: number | string | null; helper: string }) {
  return <div className="rounded-xl border border-white bg-white/90 p-4"><div className="text-xl font-extrabold text-slate-950">{typeof value === "number" ? numberFormatter.format(value) : value ?? "—"}</div><div className="mt-1 text-sm font-bold text-slate-800">{label}</div><div className="mt-1 text-xs text-slate-500">{helper}</div></div>;
}

function MethodSummary({ coverage }: { coverage: RepScoringCoverage }) {
  return (
    <Card className="magic-card border-white/80 bg-white/95">
      <CardContent className="grid gap-4 p-5 md:grid-cols-3">
        <ReadStep number="1" title="Time period" body={`All eligible calls from ${formatStart(coverage.windowStart)} onward. New calls are added every hour and old results do not expire.`} />
        <ReadStep number="2" title="Overall score" body="Call 1 and Call 2+ each count for half when both are available. If only one type exists, the page clearly marks the result as partial." />
        <ReadStep number="3" title="Evidence" body="Three total scored calls support an initial assessment. Eight or more provide moderate evidence; fifteen or more provide strong evidence." />
      </CardContent>
    </Card>
  );
}

function ReadStep({ number, title, body }: { number: string; title: string; body: string }) {
  return <div className="flex gap-3"><div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-red-600 text-sm font-extrabold text-white">{number}</div><div><div className="font-extrabold text-slate-900">{title}</div><p className="mt-1 text-sm leading-6 text-slate-600">{body}</p></div></div>;
}

function RepTable({ reps }: { reps: RepPerformanceSummary[] }) {
  return (
    <Card className="magic-card border-white/80 bg-white/95">
      <CardHeader className="gap-1"><CardTitle className="text-xl text-slate-950">Rep ranking and coaching priorities</CardTitle><p className="text-sm leading-6 text-slate-500">Lowest overall score first. Results with fewer than three calls are visible but marked as early.</p></CardHeader>
      <CardContent>
        {reps.length ? (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <Table>
              <TableHeader><TableRow className="bg-slate-50/80"><TableHead className="w-16">Rank</TableHead><TableHead>Rep</TableHead><TableHead>Overall</TableHead><TableHead>Call 1</TableHead><TableHead>Call 2+</TableHead><TableHead>Evidence</TableHead><TableHead>Coach first</TableHead><TableHead>Direction</TableHead><TableHead><span className="sr-only">Open</span></TableHead></TableRow></TableHeader>
              <TableBody>
                {reps.map((rep) => (
                  <TableRow key={rep.id} className={rep.needsReview ? "bg-red-50/30" : undefined}>
                    <TableCell className="text-lg font-extrabold text-slate-400">{rep.rank ?? "—"}</TableCell>
                    <TableCell><div className="font-semibold text-slate-950">{rep.repName}</div><div className="text-xs text-slate-500">{rep.nScored} scored {rep.nScored === 1 ? "call" : "calls"}</div></TableCell>
                    <TableCell><div className="text-xl font-extrabold text-slate-950">{formatScore(rep.overallScore)}</div><div className="text-xs font-semibold text-slate-500">{scoreBand(rep.overallScore)}</div></TableCell>
                    <TableCell><TypeScore score={rep.call1Score} count={rep.call1Count} /></TableCell>
                    <TableCell><TypeScore score={rep.call2Score} count={rep.call2Count} /></TableCell>
                    <TableCell><EvidenceBadge rep={rep} /></TableCell>
                    <TableCell><div className="max-w-[14rem] text-sm font-semibold text-slate-800">{rep.coachingPriorities[0]?.label || "More evidence needed"}</div><div className="mt-1 text-xs text-slate-500">{rep.reviewReason}</div></TableCell>
                    <TableCell className={rep.trendLabel === "Declining" ? "font-semibold text-red-700" : "text-slate-600"}>{rep.trendLabel}{rep.delta === null ? "" : ` (${rep.delta > 0 ? "+" : ""}${rep.delta.toFixed(1)})`}</TableCell>
                    <TableCell><Link href={`/manager/rep-scoring/rep/${encodeURIComponent(rep.repId || rep.repEmail)}`} className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-bold text-red-700 hover:underline">View rep <ExternalLink className="size-3.5" /></Link></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-600">No valid rep scores are available yet.</div>}
      </CardContent>
    </Card>
  );
}

function TypeScore({ score, count }: { score: number | null; count: number }) {
  return <div><div className="font-extrabold text-slate-900">{formatScore(score)}</div><div className="text-xs text-slate-500">{count ? `${count} ${count === 1 ? "call" : "calls"}` : "No calls yet"}</div></div>;
}

function EvidenceBadge({ rep }: { rep: RepPerformanceSummary }) {
  if (rep.nScored < 3) return <Badge variant="outline" className="whitespace-nowrap rounded-full border-amber-200 bg-amber-50 text-amber-900">Early · {rep.nScored} {rep.nScored === 1 ? "call" : "calls"}</Badge>;
  if (rep.needsReview) return <Badge variant="outline" className="whitespace-nowrap rounded-full border-red-200 bg-red-50 text-red-700">Needs attention</Badge>;
  return <Badge variant="outline" className="whitespace-nowrap rounded-full border-emerald-200 bg-emerald-50 text-emerald-800">{rep.confidence}</Badge>;
}

function ProcessingDetails({ coverage, excludedCalls }: { coverage: RepScoringCoverage; excludedCalls: number }) {
  if (!coverage.available) return null;
  return (
    <details className="magic-card rounded-2xl border border-slate-200 bg-white/90 p-5 text-sm text-slate-700">
      <summary className="cursor-pointer font-bold text-slate-900">Technical processing details</summary>
      <p className="mt-3 leading-6 text-slate-600">Managers normally do not need these figures. They are included for audit and troubleshooting.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <CoverageStat label="Eligible source calls" value={coverage.sourceCandidates} />
        <CoverageStat label="Completed attempts" value={coverage.completed} />
        <CoverageStat label="Processing now" value={coverage.inProgress} />
        <CoverageStat label="Waiting" value={coverage.awaiting} />
        <CoverageStat label="Next hourly batch" value={coverage.selectedForRun} />
        <CoverageStat label="Excluded after validation" value={excludedCalls} />
      </div>
    </details>
  );
}

function CoverageStat({ label, value }: { label: string; value: number | null }) { return <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"><div className="text-2xl font-extrabold text-slate-950">{value === null ? "—" : numberFormatter.format(value)}</div><div className="mt-1 text-sm font-bold text-slate-800">{label}</div></div>; }

function Metric({ icon: Icon, title, value, helper, tone }: { icon: typeof Users; title: string; value: number; helper: string; tone: "red" | "amber" | "green" }) {
  const style = tone === "red" ? "border-red-100 bg-red-50 text-red-700" : tone === "amber" ? "border-amber-100 bg-amber-50 text-amber-800" : "border-emerald-100 bg-emerald-50 text-emerald-700";
  return <Card className="magic-card border-white/80 bg-white/95"><CardContent className="pt-1"><div className={cn("mb-4 inline-flex size-10 items-center justify-center rounded-xl border", style)}><Icon className="size-5" /></div><div className="text-3xl font-extrabold text-slate-950">{numberFormatter.format(value)}</div><div className="mt-1 font-semibold text-slate-800">{title}</div><p className="mt-1 text-xs leading-5 text-slate-500">{helper}</p></CardContent></Card>;
}

function formatScore(value: number | null) { return value === null ? "—" : value.toFixed(1); }
function scoreBand(value: number | null) { if (value === null) return "Not scored"; if (value < 25) return "Unacceptable"; if (value < 50) return "Needs Improvement"; if (value < 70) return "Developing"; if (value < 85) return "Meets Expectations"; return "Excellent"; }
function formatStart(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "the fixed launch period" : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "America/New_York" }).format(date); }
function formatDateTime(value: string) { if (!value) return "not available"; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" }).format(date); }

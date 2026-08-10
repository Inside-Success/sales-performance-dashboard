import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock3, Flag, ShieldCheck, Users } from "lucide-react";
import { RepRankingTable } from "@/app/manager/rep-scoring/rep-ranking-table";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRepScoringAdmin } from "@/lib/rep-scoring/access";
import { getRepScoringDashboardData, type RepScoringCoverage } from "@/lib/rep-scoring/data";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sales Call Execution Review | Magic Mike Bot",
  description: "Private evidence-backed sales rep review for authorized managers.",
  robots: { index: false, follow: false },
};

const numberFormatter = new Intl.NumberFormat("en-US");

export default async function ManagerRepScoringPage() {
  await requireRepScoringAdmin();
  const data = await getRepScoringDashboardData();
  const reviewReadyReps = data.repSummaries.filter((rep) => rep.nScored >= 3);
  const supportedConcerns = reviewReadyReps.filter((rep) => rep.reviewStatus === "needs_attention").length;
  const criticalCalls = data.repSummaries.reduce((total, rep) => total + rep.criticalEvents.length, 0);
  const strongEvidenceReps = data.repSummaries.filter((rep) => rep.nScored >= 15).length;
  const isV5Shadow = data.scorerVersion.startsWith("rep-reviewer-v5-shadow");
  const numericScores = data.recentCalls.flatMap((call) => call.score === null || call.internalInconsistency ? [] : [call.score]);
  const scoreDistribution = [
    { label: "Below 40", count: numericScores.filter((score) => score < 40).length, tone: "bg-red-600" },
    { label: "40–59", count: numericScores.filter((score) => score >= 40 && score < 60).length, tone: "bg-orange-500" },
    { label: "60–74", count: numericScores.filter((score) => score >= 60 && score < 75).length, tone: "bg-amber-500" },
    { label: "75–89", count: numericScores.filter((score) => score >= 75 && score < 90).length, tone: "bg-blue-500" },
    { label: "90–100", count: numericScores.filter((score) => score >= 90).length, tone: "bg-emerald-600" },
  ];

  return (
    <main className="magic-page">
      <div className="mx-auto flex w-full max-w-[88rem] flex-col gap-5 px-5 pb-16 pt-8 sm:px-8">
        <header className="magic-card magic-hero p-5 md:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="magic-kicker"><ShieldCheck className="size-3.5" />Admin only</span>
                <Badge variant="outline" className="rounded-full border-slate-200 bg-white/80 text-slate-700">{isV5Shadow ? "V5 shadow validation" : "Manager review"}</Badge>
                {!isV5Shadow && data.killSwitch ? <Badge variant="destructive">Scoring paused</Badge> : null}
              </div>
              <h1 className="text-[34px] font-extrabold leading-tight tracking-normal text-slate-950 md:text-[44px]">Sales call execution review</h1>
              <p className="mt-3 max-w-2xl text-[15px] font-medium leading-7 text-slate-600">Start with the lowest evidence-supported results, then open a rep to verify the recurring findings and exact call evidence.</p>
            </div>
            <div className="flex flex-col gap-2 text-sm text-slate-500 lg:items-end">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-2"><Clock3 className="size-4 text-red-600" />Updated {formatDateTime(data.coverage.measuredAt || data.generatedAt)}</div>
              <Link href="/coaching" className={cn(buttonVariants({ variant: "outline" }), "h-9 w-fit rounded-full border-slate-200 bg-white hover:bg-red-50 hover:text-red-700")}>Open coaching</Link>
            </div>
          </div>
        </header>

        {data.error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900"><strong>Data unavailable:</strong> {data.error}</div> : null}

        {isV5Shadow ? <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950"><strong>V5 validation is cost-capped.</strong> These results use the script-aligned, fairness-first scorer. Transcript reliability, lead opportunity and external factors are checked before rep execution is scored. The testing sample stops at 1,500 finalized calls; provider and balance failures remain retryable and do not count as completed evidence.</div> : null}

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Metric title="Needs attention" value={supportedConcerns} helper="Supported low or declining signal; open the evidence before acting" tone="red" icon={AlertTriangle} />
          <Metric title="Critical calls to verify" value={criticalCalls} helper="Separate call-level flags; not a rep-performance verdict" tone="amber" icon={Flag} />
          <Metric title="Strong evidence" value={strongEvidenceReps} helper="At least 15 valid calls; this is the default manager view" tone="green" icon={Users} />
          <Metric title="Valid calls analyzed" value={data.summary.scoredCalls} helper={`Speaker-verified assessments since ${formatStart(data.coverage.windowStart)}`} tone="green" icon={CheckCircle2} />
        </section>

        <CatchUpProgress coverage={data.coverage} />
        {isV5Shadow ? <ScoreDistribution buckets={scoreDistribution} total={numericScores.length} withheld={data.summary.withheldCalls} /> : null}
        <RepRankingTable reps={data.repSummaries} />

        <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm leading-6 text-slate-600">
          <strong className="text-slate-900">How to use it:</strong> begin with the 15+ call list, review the reason beside the lowest results, then open only the reps you need to investigate. A score alone does not create a concern. Critical call flags are shown separately because one call is not proof of overall rep performance.
          <span className="mt-2 block"><strong className="text-slate-900">What this measures:</strong> observable sales-call execution in available transcripts. It does not measure lead quality, territory, attendance outside the recorded call, revenue attribution, or every part of a rep&apos;s job. Calls with unresolved speaker identity or unsupported evidence are excluded, not converted into low scores.</span>
        </section>

        <p className="max-w-4xl text-xs leading-5 text-slate-500">Scores support manager investigation; they are not automatic employment decisions. This page reads only the isolated rep-scoring base and does not edit source calls, coaching reports, Slack, Google content or employment records.</p>
      </div>
    </main>
  );
}

function CatchUpProgress({ coverage }: { coverage: RepScoringCoverage }) {
  if (!coverage.available) return null;
  const waiting = Math.max(0, coverage.remainingToTarget ?? coverage.awaiting ?? 0);
  if (waiting === 0) return null;
  const complete = Math.max(0, Math.min(100, coverage.percentComplete ?? 0));
  const scheduledBatchLimit = Math.max(1, coverage.hourlyBatchLimit ?? 80);

  return (
    <Card className="magic-card border-amber-200 bg-gradient-to-br from-amber-50 to-white">
      <CardHeader className="gap-1 pb-3"><CardTitle className="flex items-center gap-2 text-xl text-slate-950"><Clock3 className="size-5 text-amber-700" />V5 testing sample progress</CardTitle><p className="text-sm leading-6 text-slate-600">The workflow is configured to stop at 1,500 finalized calls. Provider and balance failures stay retryable and are excluded from this progress.</p></CardHeader>
      <CardContent>
        <div className="h-3 overflow-hidden rounded-full bg-amber-100"><div className="h-full rounded-full bg-red-600" style={{ width: `${complete}%` }} /></div>
        <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs font-semibold text-slate-600"><span>Approximately {complete.toFixed(1)}% of the 1,500-call test sample finalized</span><span>About {numberFormatter.format(waiting)} calls remaining to the test target</span></div>
        <p className="mt-3 text-xs leading-5 text-slate-500">{coverage.processedLastHour ? `${numberFormatter.format(coverage.processedLastHour)} valid scores were added in the last hour. ` : "When active, workers check for unfinished calls every 15 minutes. "}Each clear run can admit up to {numberFormatter.format(scheduledBatchLimit)} calls across eight isolated workers. The balance gate, no-overlap guard and hard target prevent unsafe or unnecessary dispatches.{coverage.retryableProviderFailures ? ` ${numberFormatter.format(coverage.retryableProviderFailures)} provider-failed attempts remain eligible for a later retry.` : ""}</p>
      </CardContent>
    </Card>
  );
}

function ScoreDistribution({ buckets, total, withheld }: { buckets: Array<{ label: string; count: number; tone: string }>; total: number; withheld: number }) {
  const largest = Math.max(1, ...buckets.map((bucket) => bucket.count));
  return <Card className="magic-card border-white/80 bg-white/95"><CardHeader className="gap-1 pb-3"><CardTitle className="text-xl text-slate-950">Is V5 separating stronger and weaker calls?</CardTitle><p className="text-sm leading-6 text-slate-600">This distribution is the calibration check. A useful system should not force every call into the same narrow score range.</p></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-5">{buckets.map((bucket) => <div key={bucket.label} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="text-2xl font-extrabold text-slate-950">{numberFormatter.format(bucket.count)}</div><div className="mt-1 text-xs font-semibold text-slate-600">{bucket.label}</div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"><div className={`h-full rounded-full ${bucket.tone}`} style={{ width: `${(bucket.count / largest) * 100}%` }} /></div></div>)}</div><p className="mt-3 text-xs leading-5 text-slate-500">{numberFormatter.format(total)} numeric V5 scores are visible. {numberFormatter.format(withheld)} additional calls were withheld from rep averages because reliability or verifier agreement was insufficient.</p></CardContent></Card>;
}

function Metric({ icon: Icon, title, value, helper, tone }: { icon: typeof Users; title: string; value: number; helper: string; tone: "red" | "amber" | "green" }) {
  const style = tone === "red" ? "border-red-100 bg-red-50 text-red-700" : tone === "amber" ? "border-amber-100 bg-amber-50 text-amber-800" : "border-emerald-100 bg-emerald-50 text-emerald-700";
  return <Card className="magic-card border-white/80 bg-white/95"><CardContent className="pt-1"><div className={cn("mb-4 inline-flex size-10 items-center justify-center rounded-xl border", style)}><Icon className="size-5" /></div><div className="text-3xl font-extrabold text-slate-950">{numberFormatter.format(value)}</div><div className="mt-1 font-semibold text-slate-800">{title}</div><p className="mt-1 text-xs leading-5 text-slate-500">{helper}</p></CardContent></Card>;
}

function formatStart(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "the fixed launch date" : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "America/New_York" }).format(date); }
function formatDateTime(value: string) { if (!value) return "not available"; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" }).format(date); }

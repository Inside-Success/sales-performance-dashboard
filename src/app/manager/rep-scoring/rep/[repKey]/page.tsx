import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, ExternalLink, Quote, ShieldCheck, Target, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRepScoringAdmin } from "@/lib/rep-scoring/access";
import { getRepScoringDashboardData, type RepDimensionPattern, type RepPerformanceSummary, type RepRollup, type RepScoreCall } from "@/lib/rep-scoring/data";
import { normalizeDimensions } from "@/lib/rep-scoring/presentation";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rep Review | Magic Mike Bot",
  robots: { index: false, follow: false },
};

export default async function RepDetailPage({ params }: PageProps<"/manager/rep-scoring/rep/[repKey]">) {
  await requireRepScoringAdmin();
  const { repKey: encodedRepKey } = await params;
  const repKey = decodeURIComponent(encodedRepKey).toLowerCase();
  const data = await getRepScoringDashboardData();
  const summary = data.repSummaries.find((rep) => [rep.repId, rep.repEmail].some((value) => value.toLowerCase() === repKey));
  const rollups = data.rollups.filter((row) => [row.repId, row.repEmail].some((value) => value.toLowerCase() === repKey));
  const calls = data.recentCalls
    .filter((call) => !call.internalInconsistency && [call.repId, call.repEmail].some((value) => value.toLowerCase() === repKey))
    .sort((a, b) => Date.parse(b.meetingStartAt || b.scoredAt) - Date.parse(a.meetingStartAt || a.scoredAt));
  if (!summary || !calls.length) notFound();
  const examples = getPriorityExamples(calls, summary.coachingPriorities);

  return (
    <main className="magic-page">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-5 pb-16 pt-8 sm:px-8">
        <Link href="/manager/rep-scoring" className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-slate-600 hover:text-red-700"><ArrowLeft className="size-4" />Back to all reps</Link>

        <header className="magic-card magic-hero p-5 md:p-7">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="mb-3 flex flex-wrap gap-2"><Badge variant="outline" className="gap-1 rounded-full border-red-100 bg-red-50 text-red-700"><ShieldCheck className="size-3.5" />Admin only</Badge><StatusBadge summary={summary} /></div>
              <h1 className="text-3xl font-extrabold text-slate-950 md:text-4xl">{summary.repName}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Cumulative performance since {formatStart(data.coverage.windowStart)}. The overall score balances Call 1 and Call 2+ equally when both are available.</p>
            </div>
            <div className="grid min-w-[17rem] grid-cols-3 gap-2">
              <HeroStat label="Overall" value={formatScore(summary.overallScore)} />
              <HeroStat label="Rank" value={summary.rank ? `#${summary.rank}` : "—"} />
              <HeroStat label="Calls" value={String(summary.nScored)} />
            </div>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-2">
          <CallTypeSummary title="Call 1" score={summary.call1Score} count={summary.call1Count} row={rollups.find((row) => row.callType === "Call 1")} />
          <CallTypeSummary title="Call 2+" score={summary.call2Score} count={summary.call2Count} row={rollups.find((row) => row.callType === "Call 2+")} />
        </section>

        <Card className="magic-card border-white/80 bg-white/95">
          <CardHeader className="gap-1"><CardTitle className="text-xl text-slate-950">What to coach first</CardTitle><p className="text-sm leading-6 text-slate-500">Recurring skill patterns across this rep&apos;s analyzed calls, ordered from weakest to strongest.</p></CardHeader>
          <CardContent className="grid gap-3 lg:grid-cols-3">
            {summary.coachingPriorities.length ? summary.coachingPriorities.map((pattern, index) => <PriorityCard key={pattern.key} index={index + 1} pattern={pattern} example={examples.get(pattern.key)} />) : <p className="text-sm text-slate-600">More scored calls are needed before recurring coaching patterns can be shown.</p>}
          </CardContent>
        </Card>

        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <TrendCard summary={summary} calls={calls} />
          <Card className="magic-card border-white/80 bg-white/95">
            <CardHeader className="gap-1"><CardTitle className="text-xl text-slate-950">What is working well</CardTitle><p className="text-sm leading-6 text-slate-500">The strongest recurring skills in the analyzed calls.</p></CardHeader>
            <CardContent className="space-y-3">
              {summary.strengths.map((pattern) => <div key={pattern.key} className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4"><div className="flex items-center gap-2 font-extrabold text-slate-900"><CheckCircle2 className="size-5 text-emerald-700" />{pattern.label}</div><p className="mt-2 text-sm text-slate-600">Average {pattern.average.toFixed(1)} across {pattern.observations} scored observations.</p></div>)}
            </CardContent>
          </Card>
        </section>

        <Card className="magic-card border-white/80 bg-white/95">
          <CardHeader className="gap-1"><CardTitle className="text-xl text-slate-950">Calls behind this result</CardTitle><p className="text-sm leading-6 text-slate-500">Open a call to verify the formula, dimension scores, transcript quotes, and context. New calls are added hourly.</p></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {calls.slice(0, 24).map((call) => <CallCard key={call.assessmentId} call={call} />)}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-slate-200 bg-white/90 p-3 text-center"><div className="text-2xl font-extrabold text-slate-950">{value}</div><div className="text-xs font-semibold text-slate-500">{label}</div></div>; }

function StatusBadge({ summary }: { summary: RepPerformanceSummary }) {
  if (summary.nScored < 3) return <Badge variant="outline" className="rounded-full border-amber-200 bg-amber-50 text-amber-900">Early result</Badge>;
  if (summary.needsReview) return <Badge variant="outline" className="rounded-full border-red-200 bg-red-50 text-red-700">Needs attention</Badge>;
  return <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-800">{summary.confidence}</Badge>;
}

function CallTypeSummary({ title, score, count, row }: { title: string; score: number | null; count: number; row?: RepRollup }) {
  return (
    <Card className="magic-card border-white/80 bg-white/95">
      <CardHeader className="gap-2"><div className="flex items-start justify-between gap-3"><div><Badge variant="outline" className="rounded-full">{title}</Badge><CardTitle className="mt-3 text-3xl text-slate-950">{formatScore(score)} <span className="text-base font-semibold text-slate-500">{scoreBand(score)}</span></CardTitle></div><Badge variant="outline" className={cn("rounded-full", count >= 3 ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900")}>{count ? `${count} ${count === 1 ? "call" : "calls"}` : "No calls yet"}</Badge></div></CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <Insight icon={Target} label="Coach first" value={row?.coachingPriority || "More evidence needed"} tone="red" />
        <Insight icon={TrendingUp} label="Strongest area" value={row?.strongestArea || "More evidence needed"} tone="green" />
      </CardContent>
    </Card>
  );
}

function PriorityCard({ index, pattern, example }: { index: number; pattern: RepDimensionPattern; example?: PriorityExample }) {
  return <div className="rounded-2xl border border-red-100 bg-red-50/60 p-4"><div className="flex items-center gap-2"><span className="flex size-7 items-center justify-center rounded-full bg-red-600 text-xs font-extrabold text-white">{index}</span><div className="font-extrabold text-slate-900">{pattern.label}</div></div><p className="mt-3 text-sm text-slate-600">Average {pattern.average.toFixed(1)} across {pattern.observations} scored observations.</p>{example ? <div className="mt-3 rounded-xl bg-white/80 p-3 text-xs leading-5 text-slate-600"><Quote className="mb-2 size-4 text-red-500" />{example.quote || example.reason}<Link href={`/manager/rep-scoring/call/${encodeURIComponent(example.assessmentId)}`} className="mt-2 block font-bold text-red-700 hover:underline">Open supporting call</Link></div> : null}</div>;
}

function TrendCard({ summary, calls }: { summary: RepPerformanceSummary; calls: RepScoreCall[] }) {
  const Icon = summary.trendLabel === "Declining" ? TrendingDown : TrendingUp;
  return <Card className="magic-card border-white/80 bg-white/95"><CardHeader className="gap-1"><CardTitle className="flex items-center gap-2 text-xl text-slate-950"><Icon className={cn("size-5", summary.trendLabel === "Declining" ? "text-red-600" : "text-emerald-700")} />Recent direction: {summary.trendLabel}</CardTitle><p className="text-sm leading-6 text-slate-500">The latest five calls are compared with the previous five only when both groups contain enough evidence.</p></CardHeader><CardContent className="space-y-2">{calls.slice(0, 10).map((call) => <div key={call.assessmentId} className="grid grid-cols-[5rem_1fr_3rem] items-center gap-3 text-xs"><span className="font-semibold text-slate-600">{call.callType}</span><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-red-500" style={{ width: `${Math.max(0, Math.min(100, call.score ?? 0))}%` }} /></div><span className="text-right font-bold text-slate-900">{formatScore(call.score)}</span></div>)}</CardContent></Card>;
}

function Insight({ icon: Icon, label, value, tone }: { icon: typeof Target; label: string; value: string; tone: "red" | "green" }) { return <div className={cn("rounded-xl border p-4", tone === "red" ? "border-red-100 bg-red-50/70" : "border-emerald-100 bg-emerald-50/70")}><Icon className={cn("size-5", tone === "red" ? "text-red-600" : "text-emerald-700")} /><div className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{label}</div><div className="mt-1 font-extrabold text-slate-900">{value}</div></div>; }

function CallCard({ call }: { call: RepScoreCall }) { return <Link href={`/manager/rep-scoring/call/${encodeURIComponent(call.assessmentId)}`} className="group rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-red-200 hover:bg-red-50/30"><div className="flex items-start justify-between gap-3"><div><Badge variant="outline" className="rounded-full">{call.callType}</Badge><div className="mt-3 text-2xl font-extrabold text-slate-950">{formatScore(call.score)} <span className="text-sm font-semibold text-slate-500">{call.band}</span></div><div className="mt-2 text-xs text-slate-500">{formatDateTime(call.meetingStartAt || call.scoredAt)}{call.showName ? ` · ${call.showName}` : ""}</div></div><ExternalLink className="size-4 text-slate-400 group-hover:text-red-600" /></div></Link>; }

type PriorityExample = { assessmentId: string; quote: string; reason: string };
function getPriorityExamples(calls: RepScoreCall[], priorities: RepDimensionPattern[]) {
  const wanted = new Set(priorities.map((pattern) => pattern.key));
  const examples = new Map<string, PriorityExample>();
  for (const call of calls) {
    for (const dimension of normalizeDimensions(call.callType, call.dimensions)) {
      if (!wanted.has(dimension.key) || examples.has(dimension.key)) continue;
      const evidence = dimension.evidence[0];
      if (evidence?.quote || dimension.reason) examples.set(dimension.key, { assessmentId: call.assessmentId, quote: evidence?.quote || "", reason: dimension.reason });
    }
  }
  return examples;
}

function formatScore(value: number | null) { return value === null ? "—" : value.toFixed(1); }
function scoreBand(value: number | null) { if (value === null) return "Not scored"; if (value < 25) return "Unacceptable"; if (value < 50) return "Needs Improvement"; if (value < 70) return "Developing"; if (value < 85) return "Meets Expectations"; return "Excellent"; }
function formatStart(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "the fixed launch period" : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "America/New_York" }).format(date); }
function formatDateTime(value: string) { if (!value) return "Not available"; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" }).format(date); }

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, ExternalLink, Flag, ShieldCheck, Target, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRepScoringAdmin } from "@/lib/rep-scoring/access";
import { getRepScoringDashboardData, type RepDimensionPattern, type RepPerformanceSummary, type RepScoreCall } from "@/lib/rep-scoring/data";
import { normalizeDimensions } from "@/lib/rep-scoring/presentation";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rep Review | Magic Mike Bot",
  robots: { index: false, follow: false },
};

type RepDetailPageProps = {
  params: Promise<{ repKey: string }>;
};

export default async function RepDetailPage({ params }: RepDetailPageProps) {
  await requireRepScoringAdmin();
  const { repKey: encodedRepKey } = await params;
  const repKey = decodeURIComponent(encodedRepKey).toLowerCase();
  const data = await getRepScoringDashboardData();
  const summary = data.repSummaries.find((rep) => [rep.repId, rep.repEmail].some((value) => value.toLowerCase() === repKey));
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
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Overall performance across the valid calls reviewed. Call 1 and Call 2+ count equally when both are available.</p>
            </div>
            <div className="grid min-w-[14rem] grid-cols-2 gap-2">
              <HeroStat label="Overall" value={formatScore(summary.overallScore)} />
              <HeroStat label="Valid calls" value={String(summary.nScored)} />
            </div>
          </div>
        </header>

        <ManagerSummary summary={summary} />

        {summary.criticalEvents.map((event) => <CriticalEventCard key={`${event.assessmentId}:${event.name}`} event={event} />)}

        {summary.excludedCalls ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><strong>Coverage note:</strong> {summary.excludedCalls} of {summary.attemptedCalls} attempted calls were excluded because identity or evidence could not be verified. The score uses only the {summary.nScored} valid calls.</div> : null}

        <section className="grid gap-4 lg:grid-cols-2">
          <CallTypeSummary title="Call 1" score={summary.call1Score} count={summary.call1Count} />
          <CallTypeSummary title="Call 2+" score={summary.call2Score} count={summary.call2Count} />
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <SupportedConcerns summary={summary} examples={examples} />
          <SupportedStrengths summary={summary} />
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <TrendCard summary={summary} calls={calls} />
          <NextAction summary={summary} examples={examples} />
        </section>

        <details className="magic-card rounded-2xl border border-slate-200 bg-white/95 p-5">
          <summary className="cursor-pointer font-extrabold text-slate-950">View analyzed calls ({calls.length})</summary>
          <p className="mt-2 text-sm leading-6 text-slate-500">Open a call only when you need to verify its score, dimensions and quoted transcript evidence.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">{calls.slice(0, 24).map((call) => <CallCard key={call.assessmentId} call={call} />)}</div>
          {calls.length > 24 ? <p className="mt-4 text-xs text-slate-500">Showing the 24 most recent calls. The cumulative score uses all {calls.length} valid calls.</p> : null}
        </details>
      </div>
    </main>
  );
}

function ManagerSummary({ summary }: { summary: RepPerformanceSummary }) {
  return (
    <Card className="magic-card border-white/80 bg-white/95">
      <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
        <div className="max-w-3xl">
          <div className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Manager summary</div>
          <p className="mt-2 text-lg font-semibold leading-7 text-slate-900">{summarySentence(summary)}</p>
        </div>
        <div className="shrink-0 text-sm font-semibold text-slate-600">{summary.confidence}</div>
      </CardContent>
    </Card>
  );
}

function SupportedConcerns({ summary, examples }: { summary: RepPerformanceSummary; examples: Map<string, PriorityExample> }) {
  return (
    <Card className="magic-card border-white/80 bg-white/95">
      <CardHeader className="gap-1"><CardTitle className="text-xl text-slate-950">Supported coaching concerns</CardTitle><p className="text-sm leading-6 text-slate-500">Only concerns that repeat across enough calls appear here. The list is never forced to contain a fixed number.</p></CardHeader>
      <CardContent className="space-y-3">
        {summary.coachingPriorities.length ? summary.coachingPriorities.map((pattern) => <PriorityCard key={pattern.key} pattern={pattern} example={examples.get(pattern.key)} />) : summary.nScored < 3 ? <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4"><div className="flex items-center gap-2 font-extrabold text-slate-900"><AlertTriangle className="size-5 text-amber-700" />Not enough evidence to establish a recurring concern</div><p className="mt-2 text-sm leading-6 text-slate-600">Wait for at least three valid calls before drawing a recurring skill conclusion.</p></div> : <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4"><div className="flex items-center gap-2 font-extrabold text-slate-900"><CheckCircle2 className="size-5 text-emerald-700" />No recurring weakness is currently supported</div><p className="mt-2 text-sm leading-6 text-slate-600">This does not mean the rep is perfect; it means the analyzed calls do not justify labeling a recurring weakness.</p></div>}
      </CardContent>
    </Card>
  );
}

function SupportedStrengths({ summary }: { summary: RepPerformanceSummary }) {
  return (
    <Card className="magic-card border-white/80 bg-white/95">
      <CardHeader className="gap-1"><CardTitle className="text-xl text-slate-950">Supported strengths</CardTitle><p className="text-sm leading-6 text-slate-500">Recurring dimensions that meet or exceed expectations.</p></CardHeader>
      <CardContent className="space-y-3">
        {summary.strengths.length ? summary.strengths.map((pattern) => <div key={pattern.key} className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4"><div className="flex items-center gap-2 font-extrabold text-slate-900"><CheckCircle2 className="size-5 text-emerald-700" />{pattern.label}</div><p className="mt-2 text-sm text-slate-600">Average {pattern.average.toFixed(1)} across {pattern.observations} scored observations.</p></div>) : <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">No recurring strength has enough supporting observations yet.</p>}
      </CardContent>
    </Card>
  );
}

function NextAction({ summary, examples }: { summary: RepPerformanceSummary; examples: Map<string, PriorityExample> }) {
  const concern = summary.coachingPriorities[0];
  const example = concern ? examples.get(concern.key) : undefined;
  return (
    <Card className="magic-card border-white/80 bg-white/95">
      <CardHeader className="gap-1"><CardTitle className="flex items-center gap-2 text-xl text-slate-950"><Target className="size-5 text-red-600" />Recommended next step</CardTitle></CardHeader>
      <CardContent>
        <p className="text-sm font-semibold leading-6 text-slate-800">{nextAction(summary)}</p>
        {example ? <Link href={`/manager/rep-scoring/call/${encodeURIComponent(example.assessmentId)}`} className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-red-700 hover:underline">Open supporting call <ExternalLink className="size-3.5" /></Link> : null}
      </CardContent>
    </Card>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-slate-200 bg-white/90 p-3 text-center"><div className="text-2xl font-extrabold text-slate-950">{value}</div><div className="text-xs font-semibold text-slate-500">{label}</div></div>; }

function StatusBadge({ summary }: { summary: RepPerformanceSummary }) {
  if (summary.reviewStatus === "early_evidence") return <Badge variant="outline" className="rounded-full border-amber-200 bg-amber-50 text-amber-900">Early evidence</Badge>;
  if (summary.reviewStatus === "needs_attention") return <Badge variant="outline" className="rounded-full border-red-200 bg-red-50 text-red-700">Needs attention</Badge>;
  if (summary.reviewStatus === "coaching_focus") return <Badge variant="outline" className="rounded-full border-amber-200 bg-amber-50 text-amber-900">Manager priority</Badge>;
  return <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-800">No priority concern</Badge>;
}

function CallTypeSummary({ title, score, count }: { title: string; score: number | null; count: number }) {
  return <Card className="magic-card border-white/80 bg-white/95"><CardContent className="flex items-center justify-between gap-4 p-5"><div><Badge variant="outline" className="rounded-full">{title}</Badge><div className="mt-3 text-3xl font-extrabold text-slate-950">{formatScore(score)} <span className="text-base font-semibold text-slate-500">{scoreBand(score)}</span></div></div><div className="text-right"><div className="text-lg font-extrabold text-slate-900">{count}</div><div className="text-xs text-slate-500">valid {count === 1 ? "call" : "calls"}</div></div></CardContent></Card>;
}

function PriorityCard({ pattern, example }: { pattern: RepDimensionPattern; example?: PriorityExample }) {
  return <div className="rounded-2xl border border-red-100 bg-red-50/60 p-4"><div className="flex items-center gap-2"><AlertTriangle className="size-5 text-red-600" /><div className="font-extrabold text-slate-900">{pattern.label}</div></div><p className="mt-3 text-sm text-slate-600">Average {pattern.average.toFixed(1)} across {pattern.observations} observations; {pattern.weakObservations} were Needs Improvement or Unacceptable.</p>{example ? <div className="mt-3 rounded-xl bg-white/80 p-3 text-xs leading-5 text-slate-600"><div className="mb-1 font-bold text-slate-800">Weakest supporting example</div>{example.reason || example.quote}<Link href={`/manager/rep-scoring/call/${encodeURIComponent(example.assessmentId)}`} className="mt-2 block font-bold text-red-700 hover:underline">Open this exact call</Link></div> : null}</div>;
}

function CriticalEventCard({ event }: { event: RepPerformanceSummary["criticalEvents"][number] }) {
  return (
    <Card className="magic-card border-amber-200 bg-amber-50/80">
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 font-extrabold text-amber-950"><Flag className="size-5" />Critical call to verify</div>
            <p className="mt-2 text-sm font-semibold text-slate-900">{event.name}</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">This is a separate call-level flag, not proof that the rep is underperforming overall.{event.reason ? ` ${event.reason}` : ""}</p>
            {event.quote ? <blockquote className="mt-3 rounded-xl bg-white/80 p-3 text-sm italic leading-6 text-slate-700">{event.speaker ? `${event.speaker}: ` : ""}{event.quote}{event.timestamp ? ` (${event.timestamp})` : ""}</blockquote> : null}
          </div>
          <Link href={`/manager/rep-scoring/call/${encodeURIComponent(event.assessmentId)}`} className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-amber-900 hover:underline">Open exact flagged call <ExternalLink className="size-3.5" /></Link>
        </div>
      </CardContent>
    </Card>
  );
}

function TrendCard({ summary, calls }: { summary: RepPerformanceSummary; calls: RepScoreCall[] }) {
  const declining = summary.call1Trend.label === "Declining" || summary.call2Trend.label === "Declining";
  const Icon = declining ? TrendingDown : TrendingUp;
  return <Card className="magic-card border-white/80 bg-white/95"><CardHeader className="gap-1"><CardTitle className="flex items-center gap-2 text-xl text-slate-950"><Icon className={cn("size-5", declining ? "text-red-600" : "text-emerald-700")} />Recent direction by call type</CardTitle><p className="text-sm leading-6 text-slate-500">Call 1 and Call 2+ are never mixed. Each compares its latest five valid calls with its previous five.</p></CardHeader><CardContent className="space-y-4"><TrendSummary label="Call 1" trend={summary.call1Trend} /><TrendSummary label="Call 2+" trend={summary.call2Trend} /><div className="space-y-2 border-t border-slate-100 pt-4">{calls.slice(0, 10).map((call) => <div key={call.assessmentId} className="grid grid-cols-[5rem_1fr_3rem] items-center gap-3 text-xs"><span className="font-semibold text-slate-600">{call.callType}</span><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-red-500" style={{ width: `${Math.max(0, Math.min(100, call.score ?? 0))}%` }} /></div><span className="text-right font-bold text-slate-900">{formatScore(call.score)}</span></div>)}</div></CardContent></Card>;
}

function TrendSummary({ label, trend }: { label: string; trend: RepPerformanceSummary["call1Trend"] }) {
  return <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"><span className="font-bold text-slate-900">{label}</span><span className={trend.label === "Declining" ? "font-bold text-red-700" : "font-semibold text-slate-600"}>{trend.label}{trend.delta === null ? "" : ` (${trend.delta > 0 ? "+" : ""}${trend.delta.toFixed(1)})`}</span></div>;
}

function CallCard({ call }: { call: RepScoreCall }) { return <Link href={`/manager/rep-scoring/call/${encodeURIComponent(call.assessmentId)}`} className="group rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-red-200 hover:bg-red-50/30"><div className="flex items-start justify-between gap-3"><div><Badge variant="outline" className="rounded-full">{call.callType}</Badge><div className="mt-3 text-2xl font-extrabold text-slate-950">{formatScore(call.score)} <span className="text-sm font-semibold text-slate-500">{call.band}</span></div><div className="mt-2 text-xs text-slate-500">{formatDateTime(call.meetingStartAt || call.scoredAt)}{call.showName ? ` · ${call.showName}` : ""}</div></div><ExternalLink className="size-4 text-slate-400 group-hover:text-red-600" /></div></Link>; }

type PriorityExample = { assessmentId: string; quote: string; reason: string; points: number };
function getPriorityExamples(calls: RepScoreCall[], priorities: RepDimensionPattern[]) {
  const wanted = new Set(priorities.map((pattern) => pattern.key));
  const examples = new Map<string, PriorityExample>();
  for (const call of calls) {
    for (const dimension of normalizeDimensions(call.callType, call.dimensions)) {
      if (!wanted.has(dimension.key) || dimension.points === null) continue;
      const evidence = dimension.evidence[0];
      const current = examples.get(dimension.key);
      if ((evidence?.quote || dimension.reason) && (!current || dimension.points < current.points)) examples.set(dimension.key, { assessmentId: call.assessmentId, quote: evidence?.quote || "", reason: dimension.reason, points: dimension.points });
    }
  }
  return examples;
}

function summarySentence(summary: RepPerformanceSummary) {
  if (summary.nScored < 3) return `Only ${summary.nScored} valid ${summary.nScored === 1 ? "call is" : "calls are"} available, so no stable conclusion should be made yet.`;
  const concern = summary.coachingPriorities[0]?.label;
  if (summary.needsReview && concern) return `The overall result needs manager review. The clearest recurring concern is ${concern.toLowerCase()}, supported by ${summary.nScored} valid calls.`;
  if (summary.needsReview) return `The overall score or recent decline needs manager review, but no recurring skill weakness meets the evidence rule yet.`;
  if (concern) return `The overall result is not below the review threshold. ${concern} is a supported coaching focus, not a complete judgment of the rep.`;
  return `No recurring weakness is currently supported across ${summary.nScored} valid calls. Continue normal monitoring as new evidence arrives.`;
}

function nextAction(summary: RepPerformanceSummary) {
  if (summary.nScored < 3) return "Wait for more valid calls before assigning a corrective coaching priority.";
  const concern = summary.coachingPriorities[0]?.label;
  if (concern) return `Review the supporting evidence for ${concern.toLowerCase()}, coach only what the call evidence confirms, and compare the next five valid calls.`;
  if (summary.needsReview) return "Review the score and recent calls before coaching. The current data does not support naming a recurring skill weakness.";
  return "No corrective coaching action is supported right now. Continue normal observation and revisit when new calls materially change the result.";
}

function formatScore(value: number | null) { return value === null ? "—" : value.toFixed(1); }
function scoreBand(value: number | null) { if (value === null) return "Not scored"; if (value < 25) return "Unacceptable"; if (value < 50) return "Needs Improvement"; if (value < 70) return "Developing"; if (value < 85) return "Meets Expectations"; return "Excellent"; }
function formatDateTime(value: string) { if (!value) return "Not available"; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" }).format(date); }

import { getScoreClientLabels } from "@/lib/rep-scoring/client-labels";
import { scorecardVersion } from "@/lib/rep-scoring/scorer-version";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRepScoringAdmin } from "@/lib/rep-scoring/access";
import { getV7Rep } from "@/lib/rep-scoring/v7-validation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Closer Review | Magic Mike Bot", robots: { index: false, follow: false } };

export default async function CloserReviewPage({ params, searchParams }: { params: Promise<{ repKey: string }>; searchParams: Promise<{ history?: string }> }) {
  await requireRepScoringAdmin();
  const { repKey } = await params;
  await searchParams;
  const historical = false;
  const data = await getV7Rep(decodeURIComponent(repKey), scorecardVersion(historical));
  if (!data) notFound();
  const { summary, calls, call2Only } = data;
  const clientLabels = await getScoreClientLabels(calls.map(call => call.sourceRecordId));
  const lowestCalls = [...calls].sort((a, b) => (a.score ?? 101) - (b.score ?? 101));

  return (
    <main className="magic-page">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-5 pb-16 pt-8 sm:px-8">
        <Link prefetch href={historical ? "/manager/rep-scoring?history=1" : "/manager/rep-scoring"} className="inline-flex w-fit items-center gap-2 text-sm font-bold text-slate-600 hover:text-red-700"><ArrowLeft className="size-4" />Back to scorecard</Link>

        <header className="magic-card magic-hero p-5 md:p-7">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div><h1 className="text-3xl font-extrabold text-slate-950 md:text-4xl">{summary.repName}</h1><p className="mt-2 text-sm text-slate-600">{summary.totalCalls} reviewed calls. {call2Only ? `Average uses the latest ${Math.min(5, summary.totalCalls)} scored Call 2s.` : ""}</p></div>
            <div className="rounded-2xl border border-slate-200 bg-white px-7 py-4 text-center"><div className="text-4xl font-extrabold text-slate-950">{summary.overallScore.toFixed(1)}</div><div className="text-sm font-semibold text-slate-500">{call2Only ? "Latest-call average" : "Overall score"}</div></div>
          </div>
        </header>

        {!call2Only ? <section className="grid gap-4 md:grid-cols-2"><CallType title="Call 1" score={summary.call1Score} count={summary.call1Calls} /><CallType title="Call 2+" score={summary.call2Score} count={summary.call2Calls} /></section> : null}
        {summary.totalCalls < 3 ? <p className="text-sm text-slate-600">Fewer than three scored calls: review individual calls before drawing conclusions about the rep.</p> : null}
        {summary.repeatedConcerns.length || summary.strengths.length ? <section className="grid gap-4 lg:grid-cols-2">
          {summary.repeatedConcerns.length ? <Card className="magic-card bg-white"><CardHeader><CardTitle>Recurring areas to improve</CardTitle></CardHeader><CardContent>{summary.repeatedConcerns.map(pattern => <p key={pattern.key} className="mb-3 text-sm">{pattern.label}: below standard in {pattern.concernObservations} of {pattern.observations} {pattern.callType} calls.</p>)}</CardContent></Card> : null}
          {summary.strengths.length ? <Card className="magic-card bg-white"><CardHeader><CardTitle>Recurring strengths</CardTitle></CardHeader><CardContent>{summary.strengths.map(pattern => <p key={pattern.key} className="mb-3 text-sm">{pattern.label}: average {pattern.average.toFixed(1)} across {pattern.observations} {pattern.callType} calls.</p>)}</CardContent></Card> : null}
        </section> : null}

        <Card className="magic-card bg-white"><CardHeader><CardTitle>Calls behind this score</CardTitle><p className="text-sm leading-6 text-slate-500">Lowest-scoring calls appear first.</p></CardHeader><CardContent className="grid gap-3 md:grid-cols-2">{lowestCalls.map((call) => <Link prefetch={false} key={call.assessmentId} href={`/manager/rep-scoring/call/${encodeURIComponent(call.assessmentId)}`} className="flex items-center justify-between rounded-xl border border-slate-200 p-4 transition hover:border-red-200 hover:bg-red-50/30"><div><Badge variant="outline" className="rounded-full">{call.callType}</Badge>{clientLabels[call.sourceRecordId] ? <div className="mt-2 font-semibold">{clientLabels[call.sourceRecordId]}</div> : null}<div className="mt-2 text-xs text-slate-500">{formatDate(call.meetingStartAt)}</div></div><div className="flex items-center gap-3"><div className="text-2xl font-extrabold text-slate-950">{call.score?.toFixed(1)}</div><ArrowRight className="size-4 text-slate-400" /></div></Link>)}</CardContent></Card>
      </div>
    </main>
  );
}

function CallType({ title, score, count }: { title: string; score: number | null; count: number }) {
  return <Card className="magic-card bg-white"><CardContent className="flex items-center justify-between p-5"><div><Badge variant="outline" className="rounded-full">{title}</Badge><div className="mt-3 text-3xl font-extrabold text-slate-950">{score === null ? "—" : score.toFixed(1)}</div></div><div className="text-right"><div className="font-extrabold text-slate-900">{count}</div><div className="text-sm text-slate-500">reviewed calls</div></div></CardContent></Card>;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "America/New_York" }).format(date);
}

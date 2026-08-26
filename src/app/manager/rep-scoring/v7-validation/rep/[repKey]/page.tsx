import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, Target } from "lucide-react";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRepScoringAdmin } from "@/lib/rep-scoring/access";
import { getV7Rep, V7_SCORER_VERSION } from "@/lib/rep-scoring/v7-validation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Rep Validation Review | Magic Mike Bot", robots: { index: false, follow: false } };

export default async function V7RepPage({ params }: { params: Promise<{ repKey: string }> }) {
  await requireRepScoringAdmin();
  const { repKey } = await params;
  const data = await getV7Rep(decodeURIComponent(repKey), V7_SCORER_VERSION);
  if (!data) notFound();
  const { summary, calls } = data;

  return <main className="magic-page"><div className="mx-auto flex max-w-6xl flex-col gap-5 px-5 pb-16 pt-8 sm:px-8">
    <Link prefetch href="/manager/rep-scoring/v7-validation" className="inline-flex w-fit items-center gap-2 text-sm font-bold text-slate-600 hover:text-red-700"><ArrowLeft className="size-4" />Back to all reps</Link>
    <header className="magic-card magic-hero p-5 md:p-7"><div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between"><div><Badge variant="outline" className={priorityStyle(summary.priority)}>{summary.priorityLabel}</Badge><h1 className="mt-3 text-3xl font-extrabold text-slate-950 md:text-4xl">{summary.repName}</h1><p className="mt-2 text-sm text-slate-600">{summary.evidenceLabel} across {summary.totalCalls} scored calls.</p></div><div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-center"><div className="text-4xl font-extrabold text-slate-950">{summary.overallScore.toFixed(1)}</div><div className="text-sm font-semibold text-slate-500">Overall execution</div></div></div></header>

    <Card className="magic-card bg-white"><CardContent className="p-5"><div className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Manager summary</div><p className="mt-2 text-lg font-semibold leading-7 text-slate-900">{summary.reason}</p><div className={`mt-4 flex items-start gap-2 rounded-xl p-4 text-sm font-semibold leading-6 ${summary.priority === "monitor" ? "bg-emerald-50 text-emerald-950" : summary.priority === "not_enough_evidence" ? "bg-slate-50 text-slate-800" : "bg-red-50 text-red-900"}`}><Target className="mt-0.5 size-5 shrink-0" />{summary.action}</div></CardContent></Card>

    <section className="grid gap-4 lg:grid-cols-2"><CallType title="Call 1" score={summary.call1Score} count={summary.call1Calls} direction={summary.call1Direction.label} /><CallType title="Call 2+" score={summary.call2Score} count={summary.call2Calls} direction={summary.call2Direction.label} /></section>

    <section className="grid gap-4 lg:grid-cols-2"><Card className="magic-card bg-white"><CardHeader><CardTitle>Repeated areas to improve</CardTitle></CardHeader><CardContent className="space-y-3">{summary.repeatedConcerns.length ? summary.repeatedConcerns.map((pattern) => <div key={pattern.key} className="rounded-xl border border-red-100 bg-red-50/60 p-4"><div className="font-extrabold text-slate-950">{pattern.label}</div><p className="mt-2 text-sm leading-6 text-slate-600">Below the competent standard in {pattern.concernObservations} of {pattern.observations} {pattern.callType} calls.</p><div className="mt-3 flex flex-wrap gap-2">{pattern.assessmentIds.slice(0, 3).map((assessmentId) => <Link prefetch key={assessmentId} href={`/manager/rep-scoring/v7-validation/call/${encodeURIComponent(assessmentId)}`} className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-red-700">Open supporting call <ArrowRight className="size-3" /></Link>)}</div></div>) : <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950"><div className="flex items-center gap-2 font-extrabold"><CheckCircle2 className="size-5" />No repeated weakness is supported</div><p className="mt-2">The available calls do not justify assigning a recurring weakness.</p></div>}</CardContent></Card><Card className="magic-card bg-white"><CardHeader><CardTitle>Repeated strengths</CardTitle></CardHeader><CardContent className="space-y-3">{summary.strengths.length ? summary.strengths.map((pattern) => <div key={pattern.key} className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4"><div className="font-extrabold text-slate-950">{pattern.label}</div><p className="mt-2 text-sm text-slate-600">Average {pattern.average.toFixed(1)} across {pattern.observations} {pattern.callType} calls.</p></div>) : <p className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">No strength has enough repeated evidence yet.</p>}</CardContent></Card></section>

    <Card className="magic-card bg-white"><CardHeader><CardTitle>Calls to review</CardTitle><p className="text-sm leading-6 text-slate-500">Lowest scores appear first so you can verify the most important evidence quickly.</p></CardHeader><CardContent className="grid gap-3 md:grid-cols-2">{[...calls].sort((a, b) => (a.score ?? 101) - (b.score ?? 101)).map((call) => <Link prefetch key={call.assessmentId} href={`/manager/rep-scoring/v7-validation/call/${encodeURIComponent(call.assessmentId)}`} className="flex items-center justify-between rounded-xl border border-slate-200 p-4 transition hover:border-red-200 hover:bg-red-50/30"><div><div className="font-bold text-slate-900">{call.callType}</div><div className="mt-1 text-xs text-slate-500">{formatDate(call.meetingStartAt)}</div></div><div className="text-right"><div className="text-2xl font-extrabold text-slate-950">{call.score?.toFixed(1)}</div><div className="text-xs text-slate-500">{call.band}</div></div></Link>)}</CardContent></Card>
  </div></main>;
}

function CallType({ title, score, count, direction }: { title: string; score: number | null; count: number; direction: string }) { return <Card className="magic-card bg-white"><CardContent className="flex items-center justify-between p-5"><div><Badge variant="outline" className="rounded-full">{title}</Badge><div className="mt-3 text-3xl font-extrabold text-slate-950">{score === null ? "—" : score.toFixed(1)}</div></div><div className="text-right"><div className="font-extrabold text-slate-900">{count} calls</div><div className="mt-1 text-sm text-slate-500">{direction}</div></div></CardContent></Card>; }
function priorityStyle(priority: string) { return priority === "needs_attention" ? "rounded-full border-red-200 bg-red-50 text-red-700" : priority === "coaching_focus" ? "rounded-full border-amber-200 bg-amber-50 text-amber-900" : priority === "monitor" ? "rounded-full border-emerald-200 bg-emerald-50 text-emerald-800" : "rounded-full border-slate-200 bg-slate-50 text-slate-700"; }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" }).format(date); }

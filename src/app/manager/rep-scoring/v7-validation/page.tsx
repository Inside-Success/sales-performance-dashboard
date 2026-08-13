import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock3, ShieldCheck, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRepScoringAdmin } from "@/lib/rep-scoring/access";
import { getV7ValidationOverview, V7_VALIDATION_TARGET, type V7Assessment } from "@/lib/rep-scoring/v7-validation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New Scoring Validation | Magic Mike Bot", robots: { index: false, follow: false } };

export default async function V7ValidationPage() {
  await requireRepScoringAdmin();
  const data = await getV7ValidationOverview();
  const calls = data.assessments.filter((call) => call.score !== null);
  const call1 = calls.filter((call) => call.callType === "Call 1");
  const call2 = calls.filter((call) => call.callType === "Call 2+");
  const finalQuarantines = data.quarantines.filter((row) => !row.retryable);
  const retryableFailures = data.quarantines.filter((row) => row.retryable);
  const terminal = calls.length + finalQuarantines.length;
  const progress = Math.min(100, Math.round((terminal / V7_VALIDATION_TARGET) * 1000) / 10);
  const remaining = Math.max(0, V7_VALIDATION_TARGET - terminal);
  const scores = calls.flatMap((call) => call.score === null ? [] : [call.score]);
  const exactHundreds = scores.filter((score) => score === 100).length;
  const scoreRange = scores.length ? Math.max(...scores) - Math.min(...scores) : 0;
  const representedBands = new Set(calls.map((call) => call.band)).size;
  const needsAttention = data.repSummaries.filter((rep) => rep.priority === "needs_attention");
  const managerPriorities = data.repSummaries.filter((rep) => ["needs_attention", "coaching_focus"].includes(rep.priority));
  const minimumTypeCoverage = Math.max(10, Math.floor(V7_VALIDATION_TARGET * 0.35));

  return <main className="magic-page"><div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-5 pb-16 pt-8 sm:px-8">
    <header className="magic-card magic-hero p-5 md:p-7"><div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between"><div className="max-w-3xl"><div className="mb-3 flex flex-wrap gap-2"><Badge variant="outline" className="gap-1 rounded-full border-red-100 bg-red-50 text-red-700"><ShieldCheck className="size-3.5" />Admin only</Badge><Badge variant="outline" className="rounded-full border-blue-200 bg-blue-50 text-blue-800">Isolated validation</Badge></div><h1 className="text-3xl font-extrabold text-slate-950 md:text-4xl">Scoring quality check</h1><p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-slate-600">This test checks whether call scores are fair, varied, and useful for identifying supported manager priorities. The live manager dashboard and Coaching scores remain unchanged.</p></div><div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500"><Clock3 className="size-4 text-red-600" />Updated {formatDateTime(data.generatedAt)}</div></div></header>

    {data.error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-950"><strong>Results unavailable:</strong> {data.error}</div> : null}

    <section className={`rounded-2xl border p-5 ${terminal >= V7_VALIDATION_TARGET ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}><div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700" /><div className="w-full"><div className="font-extrabold text-slate-950">{terminal >= V7_VALIDATION_TARGET ? `${terminal} final results; ${V7_VALIDATION_TARGET}-call target reached` : `${terminal} of ${V7_VALIDATION_TARGET} calls have a final validation result`}</div><p className="mt-1 text-sm leading-6 text-slate-600">{calls.length} scored · {finalQuarantines.length} fairly excluded · {remaining} remaining{retryableFailures.length ? ` · ${retryableFailures.length} temporary failures will retry` : ""}</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-red-600 transition-all" style={{ width: `${progress}%` }} /></div><div className="mt-2 text-xs font-bold text-slate-600">{progress.toFixed(1)}% complete</div></div></div></section>

    <section className="grid gap-3 md:grid-cols-3"><Metric value={`${call1.length} / ${call2.length}`} label="Call 1 / Call 2+" detail="Both call types must be represented before approval." /><Metric value={scores.length ? `${median(scores).toFixed(1)}` : "—"} label="Median score" detail={scores.length ? `Range ${Math.min(...scores).toFixed(1)}–${Math.max(...scores).toFixed(1)} · ${exactHundreds} exact 100s` : "Waiting for results."} /><Metric value={String(needsAttention.length)} label="Supported rep concerns" detail="Absolute evidence only; no forced bottom percentage." /></section>

    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><Gate label="Balanced call coverage" passed={call1.length >= minimumTypeCoverage && call2.length >= minimumTypeCoverage} detail={`${call1.length} Call 1 and ${call2.length} Call 2+ scored`} /><Gate label="Usable-call completion" passed={terminal >= Math.ceil(V7_VALIDATION_TARGET * 0.8)} detail={`${terminal} final results; temporary failures ${retryableFailures.length}`} /><Gate label="Score spread" passed={scores.length >= Math.ceil(V7_VALIDATION_TARGET * 0.7) && scoreRange >= 20 && representedBands >= 3} detail={`${scoreRange.toFixed(1)}-point range across ${representedBands} performance levels`} /><Gate label="High-score restraint" passed={scores.length >= Math.ceil(V7_VALIDATION_TARGET * 0.7) && exactHundreds / scores.length <= 0.05} detail={`${exactHundreds} of ${scores.length || 0} scores are exactly 100`} /></section>

    {managerPriorities.length ? <Card className="magic-card bg-white"><CardHeader><CardTitle>Manager preview</CardTitle><p className="text-sm leading-6 text-slate-500">Serious concerns and routine coaching opportunities remain separate. Open a rep to see the repeated issue and exact calls.</p></CardHeader><CardContent className="grid gap-3">{managerPriorities.map((rep) => <Link prefetch href={`/manager/rep-scoring/v7-validation/rep/${encodeURIComponent(rep.repEmail)}`} key={rep.repEmail} className="flex flex-col gap-3 rounded-2xl border border-red-100 bg-red-50/50 p-4 transition hover:border-red-300 md:flex-row md:items-center md:justify-between"><div><div className="flex flex-wrap items-center gap-2"><div className="font-extrabold text-slate-950">{rep.repName}</div><Badge variant="outline" className="rounded-full bg-white">{rep.priorityLabel}</Badge></div><p className="mt-1 text-sm leading-6 text-slate-600">{rep.reason}</p><div className="mt-2 text-xs font-bold text-red-700">{rep.action}</div></div><div className="flex shrink-0 items-center gap-3"><div className="text-right"><div className="text-2xl font-extrabold text-slate-950">{rep.overallScore.toFixed(1)}</div><div className="text-xs text-slate-500">{rep.totalCalls} calls</div></div><ArrowRight className="size-5 text-red-600" /></div></Link>)}</CardContent></Card> : null}

    <Card className="magic-card bg-white"><CardHeader><CardTitle>Calls to inspect</CardTitle><p className="text-sm leading-6 text-slate-500">Lowest scores appear first. Open low, middle, and high calls to verify the score against exact transcript evidence.</p></CardHeader><CardContent className="grid gap-3 md:grid-cols-2">{[...calls].sort((a, b) => (a.score ?? 101) - (b.score ?? 101)).map((call) => <CallRow key={call.assessmentId} call={call} />)}{!calls.length ? <p className="text-sm text-slate-500">Validation results are still processing.</p> : null}</CardContent></Card>

    {data.quarantines.length ? <Card className="magic-card bg-white"><CardHeader><CardTitle>Calls not scored</CardTitle><p className="text-sm leading-6 text-slate-500">These calls were excluded instead of receiving an unsupported score.</p></CardHeader><CardContent className="space-y-2">{Object.entries(countReasons(data.quarantines.map((row) => row.reason))).map(([reason, count]) => <div key={reason} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm"><span>{humanize(reason)}</span><strong>{count}</strong></div>)}</CardContent></Card> : null}
  </div></main>;
}

function Metric({ value, label, detail }: { value: string; label: string; detail: string }) { return <Card className="magic-card bg-white"><CardContent className="p-5"><div className="text-3xl font-extrabold text-slate-950">{value}</div><div className="mt-1 font-bold text-slate-800">{label}</div><p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p></CardContent></Card>; }
function Gate({ label, passed, detail }: { label: string; passed: boolean; detail: string }) { return <div className={`rounded-2xl border p-4 ${passed ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}><div className="flex items-center gap-2 font-extrabold text-slate-900">{passed ? <CheckCircle2 className="size-5 text-emerald-700" /> : <TriangleAlert className="size-5 text-amber-700" />}{label}</div><p className="mt-2 text-xs leading-5 text-slate-600">{detail}</p></div>; }
function CallRow({ call }: { call: V7Assessment }) { return <Link prefetch href={`/manager/rep-scoring/v7-validation/call/${encodeURIComponent(call.assessmentId)}`} className="group rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-red-200 hover:bg-red-50/30"><div className="flex items-start justify-between gap-3"><div><div className="font-extrabold text-slate-950">{call.repName}</div><div className="mt-1 text-xs text-slate-500">{call.callType} · {formatDateTime(call.meetingStartAt)}</div><p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{call.mainFinding}</p></div><div className="text-right"><div className="text-2xl font-extrabold text-slate-950">{call.score?.toFixed(1)}</div><div className="text-xs text-slate-500">{call.band}</div><ArrowRight className="ml-auto mt-3 size-4 text-slate-400 group-hover:text-red-600" /></div></div></Link>; }
function median(values: number[]) { const sorted = [...values].sort((a, b) => a - b); const middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2; }
function countReasons(values: string[]) { return values.reduce<Record<string, number>>((counts, value) => { counts[value] = (counts[value] || 0) + 1; return counts; }, {}); }
function humanize(value: string) { return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatDateTime(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" }).format(date); }

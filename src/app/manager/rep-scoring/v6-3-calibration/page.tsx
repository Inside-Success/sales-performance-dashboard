import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, FlaskConical, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRepScoringAdmin } from "@/lib/rep-scoring/access";
import { getV63CalibrationData, type V6Assessment } from "@/lib/rep-scoring/v6-calibration";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "V6.3 250-Call Checkpoint | Magic Mike Bot", robots: { index: false, follow: false } };

const CHECKPOINT_TARGET = 250;
const CHECKPOINT_STARTED_AT = Date.parse("2026-08-10T22:41:47.000Z");

export default async function V63CalibrationPage() {
  await requireRepScoringAdmin();
  const data = await getV63CalibrationData();
  const calls = data.assessments.filter((call) => call.sampleReason === "v6_3_checkpoint_250");
  const initialCalibration = data.assessments.filter((call) => call.sampleReason === "v6_3_balanced_multiday_30");
  const checkpointQuarantines = data.quarantineRows.filter((row) => {
    const createdAt = Date.parse(row.createdAt);
    return Number.isFinite(createdAt) && createdAt >= CHECKPOINT_STARTED_AT;
  });
  const quarantineReasons = checkpointQuarantines.reduce<Record<string, number>>((counts, row) => {
    counts[row.reason] = (counts[row.reason] || 0) + 1;
    return counts;
  }, {});
  const terminal = Math.min(CHECKPOINT_TARGET, calls.length + checkpointQuarantines.length);
  const progress = Math.min(100, (terminal / CHECKPOINT_TARGET) * 100);
  const call1 = calls.filter((call) => call.callType === "Call 1");
  const call2 = calls.filter((call) => call.callType === "Call 2+");
  const scores = calls.flatMap((call) => call.score === null ? [] : [call.score]);
  const exactHundreds = scores.filter((score) => score === 100).length;
  const selective = calls.filter((call) => call.materialReviewRequired).length;
  const statusCounts = calls.flatMap((call) => call.dimensions.flatMap((dimension) => dimension.criteria)).reduce<Record<string, number>>((counts, criterion) => { counts[criterion.status] = (counts[criterion.status] || 0) + 1; return counts; }, {});

  return <main className="magic-page"><div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 pb-16 pt-8 sm:px-8">
    <header className="magic-card magic-hero p-6 md:p-8"><div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between"><div className="max-w-4xl"><div className="mb-4 flex flex-wrap gap-2"><Badge variant="outline" className="gap-1 rounded-full border-red-100 bg-red-50 text-red-700"><ShieldCheck className="size-3.5" />Admin only</Badge><Badge variant="outline" className="gap-1 rounded-full border-violet-200 bg-violet-50 text-violet-800"><FlaskConical className="size-3.5" />V6.3 cost-controlled checkpoint</Badge></div><h1 className="text-4xl font-extrabold text-slate-950 md:text-5xl">First 250 calls, then a quality decision</h1><p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">This is the approved checkpoint before any larger backfill. Five bounded lanes process recent calls without exceeding five concurrent scoring workers. The system stops after exactly 250 new attempts.</p></div><div className="flex flex-wrap gap-2"><Link href="/manager/rep-scoring/v6-2-calibration" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Preserved V6.2 <ArrowRight className="size-4" /></Link><Link href="/manager/rep-scoring" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Current manager view <ArrowRight className="size-4" /></Link></div></div></header>

    <div className={`rounded-2xl border p-5 text-sm leading-6 ${terminal >= CHECKPOINT_TARGET ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-amber-200 bg-amber-50 text-amber-950"}`}><div className="flex gap-3"><CheckCircle2 className="mt-0.5 size-5 shrink-0" /><div className="w-full"><strong>{terminal >= CHECKPOINT_TARGET ? "The 250-call checkpoint has reached a terminal result for every selected call." : `${terminal} of ${CHECKPOINT_TARGET} selected calls have reached a terminal result.`}</strong> Successful scores and fair transcript quarantines both count toward completion; no remaining backlog is authorized or running.<div className="mt-3 h-2 overflow-hidden rounded-full bg-white/80"><div className="h-full rounded-full bg-red-600 transition-all" style={{ width: `${progress}%` }} /></div><div className="mt-2 text-xs font-semibold">{progress.toFixed(1)}% complete</div></div></div></div>
    {data.error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-950"><strong>Could not load V6.3 data:</strong> {data.error}</div> : null}

    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Checkpoint progress" value={`${terminal}/${CHECKPOINT_TARGET}`} detail={`${calls.length} scored · ${checkpointQuarantines.length} quarantined`} /><Metric label="Scored call mix" value={`${call1.length} / ${call2.length}`} detail="Call 1 / Call 2+; source mix was preserved" /><Metric label="Median score" value={median(scores)?.toFixed(1) ?? "Pending"} detail={scores.length ? `Range ${Math.min(...scores).toFixed(1)}–${Math.max(...scores).toFixed(1)}` : "Waiting for scored calls"} /><Metric label="Selective reviews" value={`${selective}/${calls.length || CHECKPOINT_TARGET}`} detail={`${exactHundreds} exact 100s · verifier only when gated`} /></section>

    <div className="grid gap-4 lg:grid-cols-2"><Card className="magic-card bg-white"><CardHeader><CardTitle>Deterministic anchors</CardTitle></CardHeader><CardContent className="text-sm leading-7 text-slate-700">Exceptional 100 · Met 85 · Partial 55 · Missed 15 · Harmful 0. Not-applicable and not-observable criteria are excluded rather than treated as failures.</CardContent></Card><Card className="magic-card bg-white"><CardHeader><CardTitle>What the checkpoint is measuring</CardTitle></CardHeader><CardContent className="text-sm leading-7 text-slate-700">{statusCounts.exceptional || 0} exceptional, {statusCounts.met || 0} met, {statusCounts.partial || 0} partial, and {statusCounts.missed || 0} missed criterion judgments. {formatReasons(quarantineReasons)}. The original {initialCalibration.length}-score calibration remains preserved separately.</CardContent></Card></div>

    <CalibrationSection title="Call 1 — fit and progression" calls={call1} /><CalibrationSection title="Call 2 — execution and factual outcome" calls={call2} />
    <footer className="text-xs leading-5 text-slate-500">Loaded {formatDateTime(data.generatedAt)} · V6.2 and the original V6.3 calibration remain unchanged as rollback and comparison paths.</footer>
  </div></main>;
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) { return <Card className="magic-card border-white/80 bg-white/95"><CardContent className="p-5"><div className="text-3xl font-extrabold text-slate-950">{value}</div><div className="mt-1 font-bold text-slate-800">{label}</div><p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p></CardContent></Card>; }
function CalibrationSection({ title, calls }: { title: string; calls: V6Assessment[] }) { return <Card className="magic-card bg-white"><CardHeader><CardTitle className="text-2xl">{title}</CardTitle></CardHeader><CardContent className="grid gap-4 lg:grid-cols-2">{calls.length ? [...calls].sort((a, b) => (a.score ?? 999) - (b.score ?? 999)).map((call) => <CallCard key={call.assessmentId} call={call} />) : <p className="col-span-full rounded-xl bg-slate-50 p-5 text-sm text-slate-500">Results are still processing.</p>}</CardContent></Card>; }
function CallCard({ call }: { call: V6Assessment }) { const action = call.callType === "Call 1" ? call.disposition : call.outcome; return <article className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-extrabold text-slate-950">{call.repName}</h2><p className="mt-1 text-xs text-slate-500">{formatDateTime(call.meetingStartAt)}</p></div><div className="text-right"><div className="text-3xl font-extrabold text-slate-950">{call.score?.toFixed(1) ?? "—"}</div><div className="text-xs text-slate-500">{call.band}</div></div></div><div className="mt-4 flex flex-wrap gap-2"><Badge variant="outline">{humanize(action || "unknown")}</Badge><Badge variant="outline">{call.materialReviewRequired ? "Selective verifier" : "Single assessment"}</Badge></div><div className="mt-4 rounded-xl bg-slate-50 p-4"><div className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Main finding</div><p className="mt-2 text-sm font-semibold leading-6 text-slate-800">{call.mainFinding}</p></div><Link href={`/manager/rep-scoring/v6-3-calibration/call/${encodeURIComponent(call.sourceRecordId)}`} className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-red-700">Review criteria and evidence <ArrowRight className="size-4" /></Link></article>; }
function median(values: number[]) { if (!values.length) return null; const sorted = [...values].sort((a, b) => a - b); const middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2; }
function formatReasons(reasons: Record<string, number>) { const entries = Object.entries(reasons); return entries.length ? entries.map(([reason, count]) => `${count} ${humanize(reason)}`).join(" · ") : "No checkpoint quarantines yet"; }
function humanize(value: string) { return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatDateTime(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" }).format(date); }

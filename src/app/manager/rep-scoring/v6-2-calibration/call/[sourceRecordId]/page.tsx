import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ExternalLink, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRepScoringAdmin } from "@/lib/rep-scoring/access";
import { getV62CalibrationData } from "@/lib/rep-scoring/v6-calibration";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "V6.2 Call Evidence | Magic Mike Bot", robots: { index: false, follow: false } };

export default async function V62CallPage({ params }: { params: Promise<{ sourceRecordId: string }> }) {
  await requireRepScoringAdmin();
  const { sourceRecordId } = await params;
  const data = await getV62CalibrationData();
  const call = data.assessments.find((row) => row.sourceRecordId === decodeURIComponent(sourceRecordId));
  if (!call) return <main className="magic-page"><div className="mx-auto max-w-4xl px-5 py-12"><Link href="/manager/rep-scoring/v6-2-calibration" className="text-sm font-bold text-red-700">← Back to V6.2</Link><div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950">This exact V6.2 result is not ready yet.</div></div></main>;
  const action = call.callType === "Call 1" ? call.disposition : call.outcome;
  return <main className="magic-page"><div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 pb-16 pt-8 sm:px-8">
    <Link href="/manager/rep-scoring/v6-2-calibration" className="inline-flex items-center gap-2 text-sm font-bold text-red-700"><ArrowLeft className="size-4" />Back to final calibration</Link>
    <header className="magic-card magic-hero p-6 md:p-8"><div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between"><div><div className="mb-3 flex flex-wrap gap-2"><Badge variant="outline" className="gap-1 rounded-full border-red-100 bg-red-50 text-red-700"><ShieldCheck className="size-3.5" />Admin only</Badge><Badge variant="outline" className="rounded-full">{call.callType}</Badge><Badge variant="outline" className="rounded-full">{call.materialReviewRequired ? "Selective verifier used" : "Single AI assessment"}</Badge></div><h1 className="text-4xl font-extrabold text-slate-950">{call.repName}</h1><p className="mt-2 text-sm text-slate-500">{formatDateTime(call.meetingStartAt)}{call.showName ? ` · ${call.showName}` : ""}</p></div><div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-center"><div className="text-4xl font-extrabold text-slate-950">{call.score?.toFixed(1) ?? "—"}</div><div className="text-sm text-slate-500">{call.band}</div></div></div></header>
    <section className="grid gap-4 md:grid-cols-3"><Info label={call.callType === "Call 1" ? "Disposition" : "Outcome"} value={humanize(action || "unknown")} /><Info label="Opportunity" value={humanize(call.opportunity)} /><Info label="Transcript" value={humanize(call.gradeability)} /></section>
    <Card className="magic-card bg-white"><CardHeader><CardTitle>Main finding</CardTitle></CardHeader><CardContent><p className="leading-7 text-slate-700">{call.mainFinding}</p>{call.transcriptUrl ? <a href={call.transcriptUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-red-700">Open source transcript <ExternalLink className="size-4" /></a> : null}</CardContent></Card>
    <section className="grid gap-4">{call.dimensions.map((dimension) => <Card key={dimension.key} className="magic-card bg-white"><CardHeader><div className="flex items-start justify-between gap-4"><div><CardTitle>{dimension.label}</CardTitle><p className="mt-1 text-sm text-slate-500">{humanize(dimension.applicability)} · {humanize(dimension.confidence)} confidence</p></div><div className="text-2xl font-extrabold text-slate-950">{dimension.points?.toFixed(1) ?? "—"}</div></div></CardHeader><CardContent className="grid gap-3">{dimension.criteria.map((criterion) => <div key={criterion.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-slate-900">{criterion.label}</strong><Badge variant="outline" className="rounded-full">{humanize(criterion.status)}</Badge></div><p className="mt-2 text-sm leading-6 text-slate-600">{criterion.reason}</p>{criterion.evidence.length ? <div className="mt-3 space-y-2">{criterion.evidence.slice(0, 2).map((evidence, index) => <blockquote key={`${criterion.id}-${index}`} className="rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700"><span className="font-bold">{evidence.timestamp} · {evidence.speaker}:</span> “{evidence.quote}”</blockquote>)}</div> : null}</div>)}</CardContent></Card>)}</section>
  </div></main>;
}
function Info({ label, value }: { label: string; value: string }) { return <Card className="magic-card bg-white"><CardContent className="p-5"><div className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">{label}</div><div className="mt-2 text-lg font-extrabold text-slate-900">{value}</div></CardContent></Card>; }
function humanize(value: string) { return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatDateTime(value: string) { if (!value) return "Date unavailable"; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" }).format(date); }

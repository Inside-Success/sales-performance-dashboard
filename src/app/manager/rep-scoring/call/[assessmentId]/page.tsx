import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, ExternalLink, Quote, TriangleAlert } from "lucide-react";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRepScoringAdmin } from "@/lib/rep-scoring/access";
import { getV7Assessment, type V7Evidence, type V7Finding } from "@/lib/rep-scoring/v7-validation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Call Score Review | Magic Mike Bot", robots: { index: false, follow: false } };

export default async function CallScorePage({ params }: { params: Promise<{ assessmentId: string }> }) {
  await requireRepScoringAdmin();
  const { assessmentId } = await params;
  const call = await getV7Assessment(decodeURIComponent(assessmentId));
  if (!call) notFound();
  const concerns = call.improvements.length ? call.improvements : call.dimensions.flatMap((dimension) => {
    const criterion = dimension.criteria.find((item) => ["partial", "weak", "missed", "harmful"].includes(item.status));
    return criterion ? [{ label: dimension.label, reason: criterion.reason, evidence: criterion.evidence }] : [];
  });

  return (
    <main className="magic-page">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-5 pb-16 pt-8 sm:px-8">
        <Link prefetch href={`/manager/rep-scoring/rep/${encodeURIComponent(call.repEmail || call.repName)}`} className="inline-flex w-fit items-center gap-2 text-sm font-bold text-slate-600 hover:text-red-700"><ArrowLeft className="size-4" />Back to {call.repName}</Link>

        <header className="magic-card magic-hero p-5 md:p-7"><div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between"><div><Badge variant="outline" className="rounded-full">{call.callType}</Badge><h1 className="mt-3 text-3xl font-extrabold text-slate-950 md:text-4xl">{call.repName}</h1><p className="mt-2 text-sm text-slate-500">{formatDate(call.meetingStartAt)}{call.showName ? ` · ${call.showName}` : ""}</p></div><div className="rounded-2xl border border-slate-200 bg-white px-7 py-4 text-center"><div className="text-4xl font-extrabold text-slate-950">{call.score?.toFixed(1) ?? "—"}</div><div className="text-sm font-semibold text-slate-500">Call score</div></div></div></header>

        <Card className="magic-card bg-white"><CardContent className="p-5"><div className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Manager takeaway</div><p className="mt-2 text-lg font-semibold leading-7 text-slate-900">{call.mainFinding}</p></CardContent></Card>

        <section className="grid gap-4 md:grid-cols-2"><ContextCard label="Prospect opportunity" value={humanize(call.opportunity)} detail={call.opportunityReason} /><ContextCard label={call.callType === "Call 1" ? "Correct progression" : "Recorded outcome"} value={humanize(call.callType === "Call 1" ? call.disposition : call.outcome)} detail={call.outcomeReason || "Based on verified call evidence."} /></section>

        {concerns.length ? <FindingSection title="What needs improvement" findings={concerns} concern /> : <Card className="magic-card border-emerald-100 bg-emerald-50/70"><CardContent className="flex gap-3 p-5"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700" /><div><div className="font-extrabold text-slate-950">No material weakness was supported on this call</div><p className="mt-1 text-sm leading-6 text-slate-600">This does not mean perfect execution; it means the transcript did not support a material deficiency.</p></div></CardContent></Card>}
        {call.strengths.length ? <FindingSection title="What was done well" findings={call.strengths} /> : null}

        <details className="magic-card rounded-2xl border border-slate-200 bg-white p-5"><summary className="cursor-pointer font-extrabold text-slate-950">View complete scoring breakdown</summary><p className="mt-2 text-sm leading-6 text-slate-500">Open this only when you need to audit how the score was calculated.</p><div className="mt-4 space-y-3">{call.dimensions.map((dimension) => <div key={dimension.key} className="rounded-xl border border-slate-200 p-4"><div className="flex items-center justify-between gap-3"><div className="font-extrabold text-slate-950">{dimension.label}</div><div className="text-xl font-extrabold text-slate-950">{dimension.points?.toFixed(1) ?? "Not scored"}</div></div>{dimension.reason ? <p className="mt-2 text-sm leading-6 text-slate-600">{dimension.reason}</p> : null}</div>)}</div></details>

        {call.transcriptUrl ? <a href={call.transcriptUrl} target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:border-red-200 hover:text-red-700">Open source transcript <ExternalLink className="size-4" /></a> : null}
      </div>
    </main>
  );
}

function ContextCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <Card className="magic-card bg-white"><CardContent className="p-5"><div className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">{label}</div><div className="mt-2 text-lg font-extrabold text-slate-950">{value}</div>{detail ? <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p> : null}</CardContent></Card>;
}

function FindingSection({ title, findings, concern = false }: { title: string; findings: V7Finding[]; concern?: boolean }) {
  const Icon = concern ? TriangleAlert : CheckCircle2;
  return <Card className="magic-card bg-white"><CardHeader><CardTitle className="flex items-center gap-2"><Icon className={concern ? "size-5 text-red-600" : "size-5 text-emerald-700"} />{title}</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-2">{findings.map((finding, index) => <div key={`${finding.label}:${index}`} className={concern ? "rounded-xl border border-red-100 bg-red-50/50 p-4" : "rounded-xl border border-emerald-100 bg-emerald-50/50 p-4"}><div className="font-extrabold text-slate-950">{finding.label}</div>{finding.reason ? <p className="mt-2 text-sm leading-6 text-slate-600">{finding.reason}</p> : null}{finding.evidence.slice(0, 2).map((evidence, evidenceIndex) => <Evidence key={evidenceIndex} value={evidence} />)}</div>)}</CardContent></Card>;
}

function Evidence({ value }: { value: V7Evidence }) {
  return <blockquote className="mt-3 rounded-lg bg-white p-3 text-sm leading-6 text-slate-700"><div className="mb-1 text-xs font-bold text-slate-500">{value.timestamp}{value.speaker ? ` · ${value.speaker}` : ""}</div><div className="flex gap-2"><Quote className="mt-1 size-4 shrink-0 text-red-500" /><span className="italic">{value.quote}</span></div></blockquote>;
}

function humanize(value: string) { return (value || "Not available").replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" }).format(date); }

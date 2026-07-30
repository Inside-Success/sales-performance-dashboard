import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Quote, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRepScoringAdmin } from "@/lib/rep-scoring/access";
import { getRepScoringDashboardData } from "@/lib/rep-scoring/data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Call Evidence | Magic Mike Bot",
  robots: { index: false, follow: false },
};

export default async function RepScoringCallPage({ params }: { params: Promise<{ assessmentId: string }> }) {
  await requireRepScoringAdmin();
  const { assessmentId } = await params;
  const data = await getRepScoringDashboardData();
  const call = data.recentCalls.find((candidate) => candidate.assessmentId === decodeURIComponent(assessmentId));
  if (!call) notFound();

  return (
    <main className="magic-page">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-5 pb-16 pt-8 sm:px-8">
        <Link href="/manager/rep-scoring" className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-slate-600 hover:text-red-700"><ArrowLeft className="size-4" />Back to rep review</Link>
        <header className="magic-card magic-hero p-5 md:p-7">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div><div className="mb-3 flex flex-wrap gap-2"><Badge variant="outline" className="gap-1 rounded-full border-red-100 bg-red-50 text-red-700"><ShieldCheck className="size-3.5" />Admin evidence</Badge><Badge variant="outline" className="rounded-full">{call.callType}</Badge><Badge variant="outline" className="rounded-full">{call.callStage}</Badge></div><h1 className="text-3xl font-extrabold text-slate-950 md:text-4xl">{call.repName}</h1><p className="mt-2 text-sm text-slate-500">{formatDateTime(call.meetingStartAt || call.scoredAt)}{call.showName ? ` · ${call.showName}` : ""}</p></div>
            <div className="rounded-2xl border border-slate-200 bg-white/85 px-5 py-4 text-right"><div className="text-4xl font-extrabold text-slate-950">{call.score === null ? "—" : call.score.toFixed(1)}</div><div className="mt-1 text-sm font-semibold text-slate-600">{call.band}</div></div>
          </div>
        </header>

        {call.internalInconsistency ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">This assessment contains an internal inconsistency and should be manually checked before use.</div> : null}

        <section className="grid gap-5 lg:grid-cols-2">
          <EvidenceCard title="Dimension scoring" items={call.dimensions} empty="No dimension evidence was stored." />
          <EvidenceCard title="Behavior checks" items={call.behaviours} empty="No behavior checks were stored." />
          <EvidenceCard title="Critical events" items={call.criticalEvents} empty="No critical event was detected." />
          <EvidenceCard title="Observations" items={call.observations} empty="No separate observations were recorded." />
        </section>

        <EvidenceCard title="Supporting evidence" items={call.evidence} empty="No supporting evidence was stored." />

        {call.transcriptUrl ? <a href={call.transcriptUrl} target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-red-200 hover:text-red-700">Open source transcript <ExternalLink className="size-4" /></a> : null}
      </div>
    </main>
  );
}

function EvidenceCard({ title, items, empty }: { title: string; items: unknown[]; empty: string }) {
  return <Card className="magic-card border-white/80 bg-white/95"><CardHeader><CardTitle className="text-xl text-slate-950">{title}</CardTitle></CardHeader><CardContent className="grid gap-3">{items.length ? items.map((item, index) => <EvidenceItem key={index} value={item} />) : <p className="text-sm leading-6 text-slate-500">{empty}</p>}</CardContent></Card>;
}

function EvidenceItem({ value }: { value: unknown }) {
  if (typeof value === "string") return <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">{value}</div>;
  if (!value || typeof value !== "object") return null;
  const object = value as Record<string, unknown>;
  const title = text(object.dimension || object.behaviour || object.behavior || object.event || object.label || object.name || object.status || "Evidence");
  const quote = text(object.quote || object.evidence_quote || object.excerpt);
  const detail = text(object.reason || object.rationale || object.explanation || object.notes || object.observation || object.band || object.result);
  const timestamp = text(object.timestamp || object.time);
  const speaker = text(object.speaker);
  return <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="font-bold text-slate-900">{title}</div>{timestamp ? <Badge variant="outline" className="rounded-full">{timestamp}</Badge> : null}</div>{detail ? <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p> : null}{quote ? <blockquote className="mt-3 flex gap-2 rounded-xl bg-slate-50 p-3 text-sm italic leading-6 text-slate-700"><Quote className="mt-1 size-4 shrink-0 text-red-500" /><span>{speaker ? `${speaker}: ` : ""}{quote}</span></blockquote> : null}</div>;
}

function text(value: unknown) { return value === null || value === undefined ? "" : String(value).trim(); }
function formatDateTime(value: string) { if (!value) return "Date not available"; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" }).format(date); }

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Quote, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRepScoringAdmin } from "@/lib/rep-scoring/access";
import { getV5CalibrationData, type V5Checkpoint, type V5Evidence, type V5Finding } from "@/lib/rep-scoring/v5-calibration";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "V5 Calibration Evidence | Magic Mike Bot",
  robots: { index: false, follow: false },
};

type PageProps = { params: Promise<{ assessmentId: string }> };

export default async function V5CalibrationCallPage({ params }: PageProps) {
  await requireRepScoringAdmin();
  const { assessmentId } = await params;
  const data = await getV5CalibrationData();
  const call = data.calls.find((candidate) => candidate.assessmentId === decodeURIComponent(assessmentId));
  if (!call) notFound();

  return (
    <main className="magic-page">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-5 pb-16 pt-8 sm:px-8">
        <Link href="/manager/rep-scoring/v5-calibration" className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-slate-600 hover:text-red-700"><ArrowLeft className="size-4" />Back to V5 calibration</Link>
        <header className="magic-card magic-hero p-6 md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div><div className="mb-3 flex flex-wrap gap-2"><Badge variant="outline" className="rounded-full border-violet-200 bg-violet-50 text-violet-800">V5 calibration</Badge><Badge variant="outline" className="rounded-full">{call.callType}</Badge></div><h1 className="text-4xl font-extrabold text-slate-950">{call.repName}</h1><p className="mt-2 text-sm text-slate-500">{formatDateTime(call.meetingStartAt)}{call.showName ? ` · ${call.showName}` : ""}</p></div>
            <div className="rounded-2xl border border-slate-200 bg-white/90 px-5 py-4 text-right"><div className="text-4xl font-extrabold text-slate-950">{call.score === null ? "—" : call.score.toFixed(1)}</div><div className="mt-1 text-sm font-bold text-slate-700">{call.band}</div><div className="mt-1 text-xs text-slate-500">Calibration only</div></div>
          </div>
        </header>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950"><div className="flex gap-3"><ShieldAlert className="mt-0.5 size-5 shrink-0" /><div><strong>Human calibration required.</strong> This assessment is evidence for testing V5, not a manager verdict and not a personnel decision.</div></div></div>

        <section className="grid gap-5 lg:grid-cols-2">
          <ContextCard title="1. Can this transcript be graded?" badge={humanize(call.gradeability)} text={call.reliabilityReason || "No reliability explanation was returned."} items={call.reliabilityIssues} />
          <ContextCard title="2. Was this prospect realistically closable?" badge={humanize(call.opportunity)} text={call.opportunityReason || "No opportunity explanation was returned."} items={call.disposition ? [`Correct progression decision: ${call.disposition}`] : []} />
        </section>

        <ContextCard title="3. What was outside the rep's control?" badge={`${call.externalFactors.length} supported factor${call.externalFactors.length === 1 ? "" : "s"}`} text={call.externalFactors.length ? "These factors provide context but do not mathematically change the rep execution score." : "No supported external factor was identified."} items={call.externalFactors} />

        <Card className="magic-card border-white/80 bg-white/95"><CardHeader className="gap-1"><CardTitle className="text-2xl text-slate-950">4. Script-aligned checkpoints</CardTitle><p className="text-sm leading-6 text-slate-500">Only applicable, observable, rep-controlled checkpoints contribute to the calibration score.</p></CardHeader><CardContent className="grid gap-4">{call.checkpoints.map((checkpoint) => <CheckpointCard key={checkpoint.key} checkpoint={checkpoint} />)}</CardContent></Card>

        <section className="grid gap-5 lg:grid-cols-2"><FindingCard title="5. Supported strengths" findings={call.strengths} empty="No supported strength was forced for this call." tone="green" /><FindingCard title="Supported improvements" findings={call.improvements} empty="No supported improvement was forced for this call." tone="amber" /></section>
        <FindingCard title="Critical findings" findings={call.criticalFindings} empty="No evidence-verified critical finding was identified." tone="red" />

        {call.validationWarnings.length ? <ContextCard title="Verifier warnings" badge={humanize(call.validationStatus)} text="These items need human attention before accepting the assessment." items={call.validationWarnings} /> : null}

        <div className="flex flex-wrap items-center gap-3">{call.transcriptUrl ? <a href={call.transcriptUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-red-200 hover:text-red-700">Open source transcript <ExternalLink className="size-4" /></a> : null}<details className="text-xs text-slate-500"><summary className="cursor-pointer font-semibold">Technical audit details</summary><div className="mt-2 rounded-xl bg-slate-950 p-3 font-mono leading-5 text-slate-200">Assessment: {call.assessmentId}<br />Scorer: {call.scorerVersion}<br />Validation: {call.validationStatus}<br />Finalized: {formatDateTime(call.scoredAt)}</div></details></div>
      </div>
    </main>
  );
}

function ContextCard({ title, badge, text, items }: { title: string; badge: string; text: string; items: string[] }) {
  return <Card className="magic-card border-white/80 bg-white/95"><CardHeader className="gap-2"><div className="flex flex-wrap items-start justify-between gap-3"><CardTitle className="text-xl text-slate-950">{title}</CardTitle><Badge variant="outline" className="rounded-full">{badge}</Badge></div></CardHeader><CardContent><p className="text-sm leading-6 text-slate-700">{text}</p>{items.length ? <ul className="mt-3 grid gap-2 text-sm leading-6 text-slate-600">{items.map((item, index) => <li key={`${item}-${index}`} className="rounded-xl bg-slate-50 px-3 py-2">{item}</li>)}</ul> : null}</CardContent></Card>;
}

function CheckpointCard({ checkpoint }: { checkpoint: V5Checkpoint }) {
  const statusStyle = checkpoint.status === "completed" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : checkpoint.status === "partial" ? "border-amber-200 bg-amber-50 text-amber-900" : checkpoint.status === "missed" ? "border-red-200 bg-red-50 text-red-700" : "border-slate-200 bg-slate-50 text-slate-700";
  return <article className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-extrabold text-slate-950">{checkpoint.label}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{checkpoint.reason || "No explanation returned."}</p></div><div className="flex flex-wrap gap-2"><Badge variant="outline" className="rounded-full">{humanize(checkpoint.applicability)}</Badge><Badge variant="outline" className={cn("rounded-full", statusStyle)}>{humanize(checkpoint.status)}</Badge>{checkpoint.weight !== null ? <Badge variant="outline" className="rounded-full">{Math.round(checkpoint.weight * 100)}% weight</Badge> : null}</div></div><div className="mt-4 grid gap-3">{checkpoint.evidence.length ? checkpoint.evidence.map((evidence, index) => <EvidenceBlock key={`${evidence.timestamp}-${index}`} evidence={evidence} />) : <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">No quote was required because this checkpoint was not scored.</p>}</div></article>;
}

function FindingCard({ title, findings, empty, tone }: { title: string; findings: V5Finding[]; empty: string; tone: "green" | "amber" | "red" }) {
  const style = tone === "green" ? "border-emerald-100 bg-emerald-50/50" : tone === "amber" ? "border-amber-100 bg-amber-50/50" : "border-red-100 bg-red-50/50";
  return <Card className={cn("magic-card", style)}><CardHeader><CardTitle className="text-xl text-slate-950">{title}</CardTitle></CardHeader><CardContent className="grid gap-3">{findings.length ? findings.map((finding, index) => <div key={`${finding.label}-${index}`} className="rounded-xl border border-white/80 bg-white p-4"><div className="font-extrabold text-slate-900">{finding.label}</div>{finding.reason ? <p className="mt-2 text-sm leading-6 text-slate-600">{finding.reason}</p> : null}{finding.evidence.map((evidence, evidenceIndex) => <EvidenceBlock key={`${evidence.timestamp}-${evidenceIndex}`} evidence={evidence} />)}</div>) : <p className="text-sm leading-6 text-slate-600">{empty}</p>}</CardContent></Card>;
}

function EvidenceBlock({ evidence }: { evidence: V5Evidence }) {
  return <blockquote className="mt-3 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700"><div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">{evidence.timestamp ? <Badge variant="outline" className="rounded-full bg-white">{evidence.timestamp}</Badge> : null}{evidence.speaker ? <span>{evidence.speaker}</span> : null}</div><div className="flex gap-2"><Quote className="mt-1 size-4 shrink-0 text-red-500" /><span className="italic">{evidence.quote}</span></div></blockquote>;
}

function humanize(value: string) { return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatDateTime(value: string) { if (!value) return "Not available"; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" }).format(date); }

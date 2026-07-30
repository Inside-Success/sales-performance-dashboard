import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, ExternalLink, Info, Quote, ShieldCheck, Target, TrendingUp, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRepScoringAdmin } from "@/lib/rep-scoring/access";
import { getRepScoringDashboardData } from "@/lib/rep-scoring/data";
import { getCallInsights, humanize, normalizeBehaviours, normalizeDimensions, type EvidenceQuote, type ScoreDimension } from "@/lib/rep-scoring/presentation";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Call Evidence | Magic Mike Bot",
  robots: { index: false, follow: false },
};

export default async function RepScoringCallPage({ params }: PageProps<"/manager/rep-scoring/call/[assessmentId]">) {
  await requireRepScoringAdmin();
  const { assessmentId } = await params;
  const data = await getRepScoringDashboardData();
  const call = data.recentCalls.find((candidate) => candidate.assessmentId === decodeURIComponent(assessmentId));
  if (!call) notFound();
  const dimensions = normalizeDimensions(call.callType, call.dimensions);
  const behaviours = normalizeBehaviours(call.behaviours);
  const insights = getCallInsights(call.callType, call.dimensions);

  return (
    <main className="magic-page">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-5 pb-16 pt-8 sm:px-8">
        <Link href="/manager/rep-scoring" className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-slate-600 hover:text-red-700"><ArrowLeft className="size-4" />Back to rep performance</Link>
        <header className="magic-card magic-hero p-5 md:p-7">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="mb-3 flex flex-wrap gap-2"><Badge variant="outline" className="gap-1 rounded-full border-red-100 bg-red-50 text-red-700"><ShieldCheck className="size-3.5" />Admin evidence</Badge><Badge variant="outline" className="rounded-full">{call.callType}</Badge><Badge variant="outline" className="rounded-full">{humanize(call.callStage)}</Badge></div>
              <h1 className="text-3xl font-extrabold text-slate-950 md:text-4xl">{call.repName}</h1>
              <p className="mt-2 text-sm text-slate-500">One call · {formatDateTime(call.meetingStartAt || call.scoredAt)}{call.showName ? ` · ${call.showName}` : ""}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/90 px-5 py-4 text-right"><div className="text-4xl font-extrabold text-slate-950">{call.score === null ? "—" : call.score.toFixed(1)}</div><div className="mt-1 text-sm font-bold text-slate-700">{call.band}</div><div className="mt-1 text-xs text-slate-500">This call only</div></div>
          </div>
        </header>

        {call.internalInconsistency ? <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-950"><strong>Excluded from rep averages:</strong> this older assessment contains an internal evidence inconsistency and must not be used as a performance result.</div> : null}

        <section className="grid gap-4 md:grid-cols-2">
          <InsightCard icon={Target} label="Coach first" value={insights.coachingPriority} description="Lowest-scoring dimension on this call" tone="red" />
          <InsightCard icon={TrendingUp} label="Strongest area" value={insights.strongestArea} description="Highest-scoring dimension on this call" tone="green" />
        </section>

        <Card className="magic-card border-blue-100 bg-blue-50/70">
          <CardContent className="flex gap-3 p-5 text-sm leading-6 text-blue-950"><Info className="mt-0.5 size-5 shrink-0" /><div><strong>How the score was calculated:</strong> DeepSeek assigned a factual level to every applicable dimension. The workflow converted those levels to points and applied the weights shown below. DeepSeek did not choose the final number.</div></CardContent>
        </Card>

        <Card className="magic-card border-white/80 bg-white/95">
          <CardHeader className="gap-1"><CardTitle className="text-xl text-slate-950">Dimension scoring</CardTitle><p className="text-sm leading-6 text-slate-500">Every contribution is visible, so the total can be checked.</p></CardHeader>
          <CardContent className="grid gap-4">
            {dimensions.length ? dimensions.map((dimension) => <DimensionCard key={dimension.key} dimension={dimension} />) : <p className="text-sm text-slate-500">No dimension evidence was stored.</p>}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-950 px-4 py-3 text-white"><span className="text-sm font-bold">Weighted total</span><span className="text-2xl font-extrabold">{call.score === null ? "—" : call.score.toFixed(1)} / 100</span></div>
          </CardContent>
        </Card>

        <section className="grid gap-5 lg:grid-cols-2">
          <Card className="magic-card border-white/80 bg-white/95">
            <CardHeader className="gap-1"><CardTitle className="text-xl text-slate-950">Behavior checks</CardTitle><p className="text-sm leading-6 text-slate-500">Specific actions observed—or not observed—in the transcript.</p></CardHeader>
            <CardContent className="grid gap-3">
              {behaviours.length ? behaviours.map((behaviour, index) => <div key={`${behaviour.name}-${index}`} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div className="font-bold text-slate-900">{behaviour.label}</div><StatusBadge status={behaviour.status} /></div>{behaviour.validationNote ? <p className="mt-2 text-xs font-semibold text-red-700">Evidence validation: {humanize(behaviour.validationNote)}</p> : null}{behaviour.quote ? <EvidenceBlock evidence={{ timestamp: behaviour.timestamp, speaker: behaviour.speaker, quote: behaviour.quote }} /> : <p className="mt-2 text-sm text-slate-500">No verified supporting quote was recorded.</p>}</div>) : <p className="text-sm text-slate-500">No behavior checks were stored.</p>}
            </CardContent>
          </Card>
          <CallContext context={call.callContext} />
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <GenericEvidenceCard title="Critical events" items={call.criticalEvents} empty="No critical event was detected." />
          <GenericEvidenceCard title="Other factual observations" items={call.observations} empty="No separate observations were recorded." />
        </section>

        <div className="flex flex-wrap items-center gap-3">
          {call.transcriptUrl ? <a href={call.transcriptUrl} target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-red-200 hover:text-red-700">Open source transcript <ExternalLink className="size-4" /></a> : null}
          <details className="text-xs text-slate-500"><summary className="cursor-pointer font-semibold">Technical audit details</summary><div className="mt-2 rounded-xl bg-slate-950 p-3 font-mono leading-5 text-slate-200">Scorer: {call.scorerVersion || "—"}<br />Prompt: {call.promptVersion || "—"}<br />Rubric: {call.rubricVersion || "—"}<br />Weights: {call.weightsVersion || "—"}<br />Config: {call.configVersion || "—"}<br />Model: {call.model || "—"}</div></details>
        </div>
      </div>
    </main>
  );
}

function DimensionCard({ dimension }: { dimension: ScoreDimension }) {
  if (dimension.applicability === "not_applicable") return <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="flex justify-between gap-3"><div className="font-extrabold text-slate-900">{dimension.label}</div><Badge variant="outline" className="rounded-full">Not applicable</Badge></div>{dimension.reason ? <p className="mt-2 text-sm leading-6 text-slate-600">{dimension.reason}</p> : null}</div>;
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><h2 className="text-lg font-extrabold text-slate-950">{dimension.label}</h2>{dimension.reason ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{dimension.reason}</p> : null}</div>
        <div className="flex shrink-0 flex-wrap items-center gap-2"><BandBadge band={dimension.band} /><Badge variant="outline" className="rounded-full">{dimension.weight === null ? "Weight unavailable" : `${Math.round(dimension.weight * 100)}% weight`}</Badge></div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="grid gap-2">{dimension.evidence.length ? dimension.evidence.map((evidence, index) => <EvidenceBlock key={`${evidence.timestamp}-${index}`} evidence={evidence} />) : <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">No verified evidence quote was stored.</p>}</div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-right"><div className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Score contribution</div><div className="mt-1 text-xl font-extrabold text-slate-950">{dimension.contribution === null ? "—" : dimension.contribution.toFixed(1)}</div><div className="text-xs text-slate-500">{dimension.points ?? "—"} points × {dimension.weight === null ? "—" : `${Math.round(dimension.weight * 100)}%`}</div></div>
      </div>
    </article>
  );
}

function EvidenceBlock({ evidence }: { evidence: EvidenceQuote }) {
  return <blockquote className="rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700"><div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">{evidence.timestamp ? <Badge variant="outline" className="rounded-full bg-white">{evidence.timestamp}</Badge> : null}{evidence.speaker ? <span>{evidence.speaker}</span> : null}</div><div className="flex gap-2"><Quote className="mt-1 size-4 shrink-0 text-red-500" /><span className="italic">{evidence.quote}</span></div></blockquote>;
}

function CallContext({ context }: { context: Record<string, unknown> }) {
  const entries = Object.entries(context).filter(([, value]) => value !== null && value !== undefined && String(value).trim());
  return <Card className="magic-card border-white/80 bg-white/95"><CardHeader className="gap-1"><CardTitle className="text-xl text-slate-950">Call context</CardTitle><p className="text-sm leading-6 text-slate-500">Facts that help a manager interpret the score.</p></CardHeader><CardContent className="grid gap-3">{entries.length ? entries.map(([key, value]) => <div key={key} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">{humanize(key)}</div><p className="mt-2 text-sm leading-6 text-slate-700">{formatValue(value)}</p></div>) : <p className="text-sm leading-6 text-slate-500">No additional call context was stored. Treat this as a data limitation.</p>}</CardContent></Card>;
}

function GenericEvidenceCard({ title, items, empty }: { title: string; items: unknown[]; empty: string }) {
  return <Card className="magic-card border-white/80 bg-white/95"><CardHeader><CardTitle className="text-xl text-slate-950">{title}</CardTitle></CardHeader><CardContent className="grid gap-3">{items.length ? items.map((item, index) => <GenericEvidenceItem key={index} value={item} />) : <p className="text-sm leading-6 text-slate-500">{empty}</p>}</CardContent></Card>;
}

function GenericEvidenceItem({ value }: { value: unknown }) {
  if (typeof value === "string") return <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">{value}</div>;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const object = value as Record<string, unknown>;
  const title = text(object.name || object.type || object.event || object.label || "Observation");
  const detail = text(object.summary || object.reason || object.explanation || object.notes || object.observation);
  const quote = text(object.quote || object.evidence_quote || object.excerpt);
  const timestamp = text(object.timestamp || object.time);
  const speaker = text(object.speaker);
  return <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="font-bold text-slate-900">{humanize(title)}</div>{timestamp ? <Badge variant="outline" className="rounded-full">{timestamp}</Badge> : null}</div>{detail ? <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p> : null}{quote ? <EvidenceBlock evidence={{ timestamp, speaker, quote }} /> : null}</div>;
}

function InsightCard({ icon: Icon, label, value, description, tone }: { icon: typeof Target; label: string; value: string; description: string; tone: "red" | "green" }) {
  return <Card className={cn("magic-card", tone === "red" ? "border-red-100 bg-red-50/80" : "border-emerald-100 bg-emerald-50/80")}><CardContent className="p-5"><Icon className={cn("size-5", tone === "red" ? "text-red-600" : "text-emerald-700")} /><div className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{label}</div><div className="mt-1 text-lg font-extrabold text-slate-950">{value}</div><p className="mt-1 text-xs leading-5 text-slate-500">{description}</p></CardContent></Card>;
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const met = normalized === "met";
  const notMet = normalized === "not_met";
  return <Badge variant="outline" className={cn("gap-1 rounded-full", met ? "border-emerald-200 bg-emerald-50 text-emerald-800" : notMet ? "border-red-200 bg-red-50 text-red-700" : "border-slate-200 bg-slate-50 text-slate-700")}>{met ? <CheckCircle2 className="size-3" /> : notMet ? <XCircle className="size-3" /> : <Info className="size-3" />}{humanize(status)}</Badge>;
}

function BandBadge({ band }: { band: string }) {
  const style = band === "Excellent" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : band === "Meets Expectations" ? "border-blue-200 bg-blue-50 text-blue-800" : band === "Developing" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-red-200 bg-red-50 text-red-700";
  return <Badge variant="outline" className={cn("rounded-full", style)}>{band || "Not scored"}</Badge>;
}

function text(value: unknown) { return value === null || value === undefined ? "" : String(value).trim(); }
function formatValue(value: unknown) { if (typeof value === "string") return value; try { return JSON.stringify(value); } catch { return String(value); } }
function formatDateTime(value: string) { if (!value) return "Date not available"; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" }).format(date); }

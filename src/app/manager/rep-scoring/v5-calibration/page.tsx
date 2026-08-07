import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, FlaskConical, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRepScoringAdmin } from "@/lib/rep-scoring/access";
import { getV5CalibrationData, type V5CalibrationCall } from "@/lib/rep-scoring/v5-calibration";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "V5 Calibration | Magic Mike Bot",
  robots: { index: false, follow: false },
};

export default async function V5CalibrationPage() {
  await requireRepScoringAdmin();
  const data = await getV5CalibrationData();
  const call1 = data.calls.filter((call) => call.callType === "Call 1");
  const call2 = data.calls.filter((call) => call.callType === "Call 2+");
  const complete = call1.length === 6 && call2.length === 6;

  return (
    <main className="magic-page">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 pb-16 pt-8 sm:px-8">
        <header className="magic-card magic-hero p-6 md:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-4xl">
              <div className="mb-4 flex flex-wrap gap-2">
                <Badge variant="outline" className="gap-1 rounded-full border-red-100 bg-red-50 text-red-700"><ShieldCheck className="size-3.5" />Admin only</Badge>
                <Badge variant="outline" className="gap-1 rounded-full border-violet-200 bg-violet-50 text-violet-800"><FlaskConical className="size-3.5" />V5 human calibration</Badge>
              </div>
              <h1 className="text-4xl font-extrabold text-slate-950 md:text-5xl">Fairness-first call review</h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">Review these 12 calls before V5 is allowed to score the wider history. Each assessment separates transcript reliability, prospect opportunity, and the rep-controlled execution.</p>
            </div>
            <Link href="/manager/rep-scoring" className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-red-200 hover:text-red-700">Current V4 manager view <ArrowRight className="size-4" /></Link>
          </div>
        </header>

        <div className={cn("rounded-2xl border p-5 text-sm leading-6", complete ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-amber-200 bg-amber-50 text-amber-950")}>
          <div className="flex gap-3">{complete ? <CheckCircle2 className="mt-0.5 size-5 shrink-0" /> : <AlertTriangle className="mt-0.5 size-5 shrink-0" />}<div><strong>{complete ? "Calibration set ready for your review." : "Calibration processing is not complete yet."}</strong> {call1.length} of 6 Call 1 assessments and {call2.length} of 6 Call 2 assessments are available. No full backfill has started, and these results must not be used for personnel decisions.</div></div>
        </div>

        {data.error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-950"><strong>Could not load calibration data:</strong> {data.error}</div> : null}

        <CalibrationSection title="Call 1 — progression decision" description="A good result can be advancing a suitable prospect or correctly rejecting an unsuitable one." calls={call1} />
        <CalibrationSection title="Call 2 — value, terms, objections, and close" description="The review judges execution in context. Difficult prospects may reasonably require more time or repetition." calls={call2} />

        <footer className="text-xs leading-5 text-slate-500">Scorer: {data.scorerVersion} · Loaded {formatDateTime(data.generatedAt)} · V4 remains available as the rollback version.</footer>
      </div>
    </main>
  );
}

function CalibrationSection({ title, description, calls }: { title: string; description: string; calls: V5CalibrationCall[] }) {
  return (
    <Card className="magic-card border-white/80 bg-white/95">
      <CardHeader className="gap-1"><CardTitle className="text-2xl text-slate-950">{title}</CardTitle><p className="text-sm leading-6 text-slate-500">{description}</p></CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-2">
        {calls.length ? calls.map((call) => <CalibrationCard key={call.assessmentId} call={call} />) : <p className="col-span-full rounded-xl bg-slate-50 p-5 text-sm text-slate-500">No V5 assessments have been finalized for this call type yet.</p>}
      </CardContent>
    </Card>
  );
}

function CalibrationCard({ call }: { call: V5CalibrationCall }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div><h2 className="text-lg font-extrabold text-slate-950">{call.repName}</h2><p className="mt-1 text-xs text-slate-500">{formatDateTime(call.meetingStartAt)}{call.showName ? ` · ${call.showName}` : ""}</p></div>
        <div className="text-right"><div className="text-3xl font-extrabold text-slate-950">{call.score === null ? "—" : call.score.toFixed(1)}</div><div className="text-xs font-semibold text-slate-500">{call.band}</div></div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2"><GradeabilityBadge value={call.gradeability} /><OpportunityBadge value={call.opportunity} />{call.validationStatus !== "verified" ? <Badge variant="outline" className="rounded-full border-amber-200 bg-amber-50 text-amber-900">Human check needed</Badge> : null}</div>
      <div className="mt-4 rounded-xl bg-slate-50 p-4"><div className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Main finding</div><p className="mt-2 text-sm font-semibold leading-6 text-slate-800">{call.mainFinding}</p></div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><div className="font-extrabold text-emerald-800">Supported strengths</div><div className="mt-1 text-slate-600">{call.strengths.length}</div></div><div><div className="font-extrabold text-amber-800">Supported improvements</div><div className="mt-1 text-slate-600">{call.improvements.length}</div></div></div>
      <Link href={`/manager/rep-scoring/v5-calibration/call/${encodeURIComponent(call.assessmentId)}`} className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-red-700 hover:text-red-800">Review evidence <ArrowRight className="size-4" /></Link>
    </article>
  );
}

function GradeabilityBadge({ value }: { value: V5CalibrationCall["gradeability"] }) {
  const style = value === "gradeable" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : value === "partially_gradeable" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-red-200 bg-red-50 text-red-700";
  return <Badge variant="outline" className={cn("rounded-full", style)}>{humanize(value)}</Badge>;
}

function OpportunityBadge({ value }: { value: V5CalibrationCall["opportunity"] }) {
  return <Badge variant="outline" className="rounded-full border-blue-200 bg-blue-50 text-blue-800">Prospect: {humanize(value)}</Badge>;
}

function humanize(value: string) { return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatDateTime(value: string) { if (!value) return "Date unavailable"; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" }).format(date); }

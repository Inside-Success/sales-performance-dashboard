import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock3, SearchCheck, TriangleAlert, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRepScoringAdmin } from "@/lib/rep-scoring/access";
import { getV7ValidationOverview, type V7Assessment } from "@/lib/rep-scoring/v7-validation";
import type { V7RepSummary } from "@/lib/rep-scoring/v7-manager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sales Rep Performance | Magic Mike Bot", robots: { index: false, follow: false } };

export default async function V7ValidationPage() {
  await requireRepScoringAdmin();
  const data = await getV7ValidationOverview();
  const calls = data.assessments.filter((call) => call.score !== null);
  const supported = data.repSummaries.filter((rep) => rep.priority !== "not_enough_evidence");
  const needsAttention = supported.filter((rep) => rep.priority === "needs_attention");
  const coaching = supported.filter((rep) => rep.priority === "coaching_focus");
  const monitoring = supported.filter((rep) => rep.priority === "monitor");
  const early = data.repSummaries.filter((rep) => rep.priority === "not_enough_evidence");
  const managerQueue = [...needsAttention, ...coaching];

  return <main className="magic-page"><div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-5 pb-16 pt-8 sm:px-8">
    <header className="magic-card magic-hero p-5 md:p-7"><div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between"><div className="max-w-3xl"><Badge variant="outline" className="rounded-full border-red-100 bg-red-50 text-red-700">Manager view</Badge><h1 className="mt-3 text-3xl font-extrabold text-slate-950 md:text-4xl">Sales rep performance</h1><p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-slate-600">Start with the reps who have repeated, evidence-supported execution gaps. Open a rep to see the exact skill, affected calls, and recommended next action.</p></div><div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500"><Clock3 className="size-4 text-red-600" />Updated {formatDateTime(data.generatedAt)}</div></div></header>

    {data.error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-950"><strong>Results unavailable:</strong> {data.error}</div> : null}

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric icon="alert" value={needsAttention.length} label="Needs manager attention" detail="Repeated or materially low execution supported by multiple calls." /><Metric icon="coach" value={coaching.length} label="Coaching opportunities" detail="Useful routine coaching, without evidence of a serious recurring concern." /><Metric icon="clear" value={monitoring.length} label="No priority concern" detail="Enough evidence is available and no recurring weakness is supported." /><Metric icon="people" value={early.length} label="More evidence needed" detail="Individual calls can be reviewed, but a rep-level judgment would be premature." /></section>

    <Card className="magic-card bg-white"><CardHeader><CardTitle>Who should I review first?</CardTitle><p className="text-sm leading-6 text-slate-500">The strongest supported concerns appear first. No rep is added merely for ranking near the bottom.</p></CardHeader><CardContent className="space-y-3">{managerQueue.length ? managerQueue.map((rep) => <ManagerRow key={rep.repEmail || rep.repName} rep={rep} />) : <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5"><div className="flex items-center gap-2 font-extrabold text-emerald-950"><CheckCircle2 className="size-5" />No supported manager priority right now</div><p className="mt-2 text-sm leading-6 text-emerald-900">Continue routine monitoring. The system will add a rep here only when repeated evidence supports it.</p></div>}</CardContent></Card>

    <Card className="magic-card bg-white"><CardHeader><CardTitle>All reps with enough evidence</CardTitle><p className="text-sm leading-6 text-slate-500">Sorted by manager priority and then lowest supported score.</p></CardHeader><CardContent className="grid gap-3">{supported.map((rep) => <ManagerRow key={rep.repEmail || rep.repName} rep={rep} compact />)}{!supported.length ? <p className="text-sm text-slate-500">More scored calls are needed before rep-level results can be shown.</p> : null}</CardContent></Card>

    {early.length ? <details className="magic-card rounded-2xl border border-slate-200 bg-white p-5"><summary className="cursor-pointer font-extrabold text-slate-950">Reps still gathering evidence ({early.length})</summary><p className="mt-2 text-sm leading-6 text-slate-500">These reps are deliberately kept out of the manager queue until enough calls support a fair conclusion.</p><div className="mt-4 grid gap-3 md:grid-cols-2">{early.map((rep) => <ManagerRow key={rep.repEmail || rep.repName} rep={rep} compact />)}</div></details> : null}

    <details className="magic-card rounded-2xl border border-slate-200 bg-white p-5"><summary className="cursor-pointer font-extrabold text-slate-950">Inspect individual calls ({calls.length})</summary><p className="mt-2 text-sm leading-6 text-slate-500">Use this only when you need to verify a score against the transcript evidence.</p><div className="mt-4 grid gap-3 md:grid-cols-2">{[...calls].sort((a, b) => (a.score ?? 101) - (b.score ?? 101)).map((call) => <CallRow key={call.assessmentId} call={call} />)}</div></details>
  </div></main>;
}

function Metric({ icon, value, label, detail }: { icon: "alert" | "coach" | "clear" | "people"; value: number; label: string; detail: string }) {
  const Icon = icon === "alert" ? TriangleAlert : icon === "coach" ? SearchCheck : icon === "people" ? Users : CheckCircle2;
  const color = icon === "alert" ? "text-red-600 bg-red-50" : icon === "coach" ? "text-amber-700 bg-amber-50" : "text-emerald-700 bg-emerald-50";
  return <Card className="magic-card bg-white"><CardContent className="p-5"><div className={`mb-4 flex size-10 items-center justify-center rounded-xl ${color}`}><Icon className="size-5" /></div><div className="text-3xl font-extrabold text-slate-950">{value}</div><div className="mt-1 font-bold text-slate-800">{label}</div><p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p></CardContent></Card>;
}
function ManagerRow({ rep, compact = false }: { rep: V7RepSummary; compact?: boolean }) {
  return <Link prefetch href={`/manager/rep-scoring/v7-validation/rep/${encodeURIComponent(rep.repEmail || rep.repName)}`} className="group flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 transition hover:border-red-200 hover:bg-red-50/30 md:flex-row md:items-center md:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><div className="font-extrabold text-slate-950">{rep.repName}</div><Badge variant="outline" className={priorityStyle(rep.priority)}>{rep.priorityLabel}</Badge></div><p className={`mt-1 text-sm leading-6 text-slate-600 ${compact ? "line-clamp-2" : ""}`}>{rep.reason}</p>{!compact && rep.priority !== "monitor" && rep.priority !== "not_enough_evidence" ? <p className="mt-2 text-xs font-bold text-red-700">Next: {rep.action}</p> : null}</div><div className="flex shrink-0 items-center gap-3"><div className="text-right"><div className="text-2xl font-extrabold text-slate-950">{rep.overallScore.toFixed(1)}</div><div className="text-xs text-slate-500">{rep.totalCalls} calls</div></div><ArrowRight className="size-5 text-slate-400 group-hover:text-red-600" /></div></Link>;
}
function CallRow({ call }: { call: V7Assessment }) { return <Link prefetch href={`/manager/rep-scoring/v7-validation/call/${encodeURIComponent(call.assessmentId)}`} className="group rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-red-200 hover:bg-red-50/30"><div className="flex items-start justify-between gap-3"><div><div className="font-extrabold text-slate-950">{call.repName}</div><div className="mt-1 text-xs text-slate-500">{call.callType} · {formatDateTime(call.meetingStartAt)}</div><p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{call.mainFinding}</p></div><div className="text-right"><div className="text-2xl font-extrabold text-slate-950">{call.score?.toFixed(1)}</div><div className="text-xs text-slate-500">{call.band}</div><ArrowRight className="ml-auto mt-3 size-4 text-slate-400 group-hover:text-red-600" /></div></div></Link>; }
function priorityStyle(priority: string) { return priority === "needs_attention" ? "rounded-full border-red-200 bg-red-50 text-red-700" : priority === "coaching_focus" ? "rounded-full border-amber-200 bg-amber-50 text-amber-900" : priority === "monitor" ? "rounded-full border-emerald-200 bg-emerald-50 text-emerald-800" : "rounded-full border-slate-200 bg-slate-50 text-slate-700"; }
function formatDateTime(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" }).format(date); }

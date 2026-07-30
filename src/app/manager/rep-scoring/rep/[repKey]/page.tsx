import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, ShieldCheck, Target, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRepScoringAdmin } from "@/lib/rep-scoring/access";
import { getRepScoringDashboardData, type RepRollup, type RepScoreCall } from "@/lib/rep-scoring/data";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rep Review | Magic Mike Bot",
  robots: { index: false, follow: false },
};

export default async function RepDetailPage({ params }: PageProps<"/manager/rep-scoring/rep/[repKey]">) {
  await requireRepScoringAdmin();
  const { repKey: encodedRepKey } = await params;
  const repKey = decodeURIComponent(encodedRepKey).toLowerCase();
  const data = await getRepScoringDashboardData();
  const rollups = data.rollups.filter((row) => [row.repId, row.repEmail].some((value) => value.toLowerCase() === repKey));
  const calls = data.recentCalls
    .filter((call) => !call.internalInconsistency && [call.repId, call.repEmail].some((value) => value.toLowerCase() === repKey))
    .sort((a, b) => Date.parse(b.meetingStartAt || b.scoredAt) - Date.parse(a.meetingStartAt || a.scoredAt));
  if (!rollups.length && !calls.length) notFound();
  const repName = rollups[0]?.repName || calls[0]?.repName || "Rep";

  return (
    <main className="magic-page">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-5 pb-16 pt-8 sm:px-8">
        <Link href="/manager/rep-scoring" className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-slate-600 hover:text-red-700"><ArrowLeft className="size-4" />Back to all reps</Link>
        <header className="magic-card magic-hero p-5 md:p-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="mb-3 flex flex-wrap gap-2"><Badge variant="outline" className="gap-1 rounded-full border-red-100 bg-red-50 text-red-700"><ShieldCheck className="size-3.5" />Admin only</Badge><Badge variant="outline" className="rounded-full border-amber-200 bg-amber-50 text-amber-900">Validation in progress</Badge></div>
              <h1 className="text-3xl font-extrabold text-slate-950 md:text-4xl">{repName}</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">Score and coaching evidence from the current rolling seven-day window. Call 1 and Call 2+ are never combined.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/90 px-5 py-4"><div className="text-3xl font-extrabold text-slate-950">{calls.length}</div><div className="text-sm font-semibold text-slate-600">scored {calls.length === 1 ? "call" : "calls"}</div></div>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-2">
          {rollups.map((row) => <CallTypeSummary key={row.id} row={row} />)}
        </section>

        <Card className="magic-card border-white/80 bg-white/95">
          <CardHeader className="gap-1"><CardTitle className="text-xl text-slate-950">Calls behind these results</CardTitle><p className="text-sm leading-6 text-slate-500">Open a call to verify the dimension scores, formula, quotes, and call context.</p></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {calls.map((call) => <CallCard key={call.assessmentId} call={call} />)}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function CallTypeSummary({ row }: { row: RepRollup }) {
  const enough = row.nScored >= 3;
  return (
    <Card className="magic-card border-white/80 bg-white/95">
      <CardHeader className="gap-2">
        <div className="flex items-start justify-between gap-3"><div><Badge variant="outline" className="rounded-full">{row.callType}</Badge><CardTitle className="mt-3 text-2xl text-slate-950">{formatScore(row.rollingMean)} <span className="text-base font-semibold text-slate-500">{scoreBand(row.rollingMean)}</span></CardTitle></div><Badge variant="outline" className={cn("rounded-full", enough ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900")}>{row.confidence}</Badge></div>
        <p className="text-sm leading-6 text-slate-600">Based on {row.nScored} {row.callType} {row.nScored === 1 ? "call" : "calls"}. {enough ? "There is enough evidence to begin comparing patterns." : "This is an early signal, not a stable rep conclusion."}</p>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <Insight icon={Target} label="Coach first" value={row.coachingPriority} tone="red" />
        <Insight icon={TrendingUp} label="Strongest area" value={row.strongestArea} tone="green" />
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2"><div className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Recent direction</div><div className="mt-2 font-semibold text-slate-900">{row.delta === null ? "No personal baseline yet" : `${row.delta > 0 ? "+" : ""}${row.delta.toFixed(1)} points versus baseline`}</div><p className="mt-1 text-xs leading-5 text-slate-500">A direction is shown only after both recent and earlier call windows contain enough data.</p></div>
      </CardContent>
    </Card>
  );
}

function Insight({ icon: Icon, label, value, tone }: { icon: typeof Target; label: string; value: string; tone: "red" | "green" }) {
  return <div className={cn("rounded-xl border p-4", tone === "red" ? "border-red-100 bg-red-50/70" : "border-emerald-100 bg-emerald-50/70")}><Icon className={cn("size-5", tone === "red" ? "text-red-600" : "text-emerald-700")} /><div className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{label}</div><div className="mt-1 font-extrabold text-slate-900">{value}</div></div>;
}

function CallCard({ call }: { call: RepScoreCall }) {
  return <Link href={`/manager/rep-scoring/call/${encodeURIComponent(call.assessmentId)}`} className="group rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-red-200 hover:bg-red-50/30"><div className="flex items-start justify-between gap-3"><div><Badge variant="outline" className="rounded-full">{call.callType}</Badge><div className="mt-3 text-2xl font-extrabold text-slate-950">{formatScore(call.score)} <span className="text-sm font-semibold text-slate-500">{call.band}</span></div><div className="mt-2 text-xs text-slate-500">{formatDateTime(call.meetingStartAt || call.scoredAt)}{call.showName ? ` · ${call.showName}` : ""}</div></div><ExternalLink className="size-4 text-slate-400 group-hover:text-red-600" /></div></Link>;
}

function formatScore(value: number | null) { return value === null ? "—" : value.toFixed(1); }
function scoreBand(value: number | null) { if (value === null) return "Not scored"; if (value < 25) return "Unacceptable"; if (value < 50) return "Needs Improvement"; if (value < 70) return "Developing"; if (value < 85) return "Meets Expectations"; return "Excellent"; }
function formatDateTime(value: string) { if (!value) return "Not available"; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" }).format(date); }

import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock3, Flag, ShieldCheck, Users } from "lucide-react";
import { RepRankingTable } from "@/app/manager/rep-scoring/rep-ranking-table";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireRepScoringAdmin } from "@/lib/rep-scoring/access";
import { getRepScoringDashboardData } from "@/lib/rep-scoring/data";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sales Call Execution Review | Magic Mike Bot",
  description: "Private evidence-backed sales rep review for authorized managers.",
  robots: { index: false, follow: false },
};

const numberFormatter = new Intl.NumberFormat("en-US");

export default async function ManagerRepScoringPage() {
  await requireRepScoringAdmin();
  const data = await getRepScoringDashboardData();
  const reviewReadyReps = data.repSummaries.filter((rep) => rep.nScored >= 3);
  const supportedConcerns = reviewReadyReps.filter((rep) => rep.reviewStatus === "needs_attention").length;
  const managerPriorities = reviewReadyReps.filter((rep) => rep.reviewStatus === "needs_attention" || rep.reviewStatus === "coaching_focus").length;
  const criticalCalls = data.repSummaries.reduce((total, rep) => total + rep.criticalEvents.length, 0);
  const strongEvidenceReps = data.repSummaries.filter((rep) => rep.nScored >= 15).length;

  return (
    <main className="magic-page">
      <div className="mx-auto flex w-full max-w-[88rem] flex-col gap-5 px-5 pb-16 pt-8 sm:px-8">
        <header className="magic-card magic-hero p-5 md:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="magic-kicker"><ShieldCheck className="size-3.5" />Admin only</span>
              </div>
              <h1 className="text-[34px] font-extrabold leading-tight tracking-normal text-slate-950 md:text-[44px]">Sales rep performance</h1>
              <p className="mt-3 max-w-2xl text-[15px] font-medium leading-7 text-slate-600">Start with the reps at the top. Open a rep to see what needs attention and the calls that support it.</p>
            </div>
            <div className="flex flex-col gap-2 text-sm text-slate-500 lg:items-end">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-2"><Clock3 className="size-4 text-red-600" />Updated {formatDateTime(data.coverage.measuredAt || data.generatedAt)}</div>
              <Link href="/coaching" className={cn(buttonVariants({ variant: "outline" }), "h-9 w-fit rounded-full border-slate-200 bg-white hover:bg-red-50 hover:text-red-700")}>Open coaching</Link>
            </div>
          </div>
        </header>

        {data.error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900"><strong>Data unavailable:</strong> {data.error}</div> : null}

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Metric title="Reps to review" value={managerPriorities} helper={`${supportedConcerns} have a repeated concern; review the remaining priorities before acting`} tone="red" icon={AlertTriangle} />
          <Metric title="Critical calls" value={criticalCalls} helper="Individual calls that should be checked by a manager" tone="amber" icon={Flag} />
          <Metric title="Reps with 15+ calls" value={strongEvidenceReps} helper="The default view uses the reps with the most evidence" tone="green" icon={Users} />
          <Metric title="Calls reviewed" value={data.summary.scoredCalls} helper="Calls with enough verified evidence to assess" tone="green" icon={CheckCircle2} />
        </section>

        <RepRankingTable reps={data.repSummaries} />

        <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm leading-6 text-slate-600">
          <strong className="text-slate-900">How to use this page:</strong> start with the lowest-ranked reps, read the main finding, then open the rep before deciding what coaching or follow-up is needed. A score is a starting point, not a decision by itself.
        </section>

        <p className="max-w-4xl text-xs leading-5 text-slate-500">Use the call evidence to confirm any concern. Lead quality and circumstances outside the recorded call may also affect the outcome.</p>
      </div>
    </main>
  );
}

function Metric({ icon: Icon, title, value, helper, tone }: { icon: typeof Users; title: string; value: number; helper: string; tone: "red" | "amber" | "green" }) {
  const style = tone === "red" ? "border-red-100 bg-red-50 text-red-700" : tone === "amber" ? "border-amber-100 bg-amber-50 text-amber-800" : "border-emerald-100 bg-emerald-50 text-emerald-700";
  return <Card className="magic-card border-white/80 bg-white/95"><CardContent className="pt-1"><div className={cn("mb-4 inline-flex size-10 items-center justify-center rounded-xl border", style)}><Icon className="size-5" /></div><div className="text-3xl font-extrabold text-slate-950">{numberFormatter.format(value)}</div><div className="mt-1 font-semibold text-slate-800">{title}</div><p className="mt-1 text-xs leading-5 text-slate-500">{helper}</p></CardContent></Card>;
}

function formatDateTime(value: string) { if (!value) return "not available"; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" }).format(date); }

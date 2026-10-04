import { scorecardVersion } from "@/lib/rep-scoring/scorer-version";
import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { CloserScorecardTable } from "@/app/manager/rep-scoring/closer-scorecard-table";
import { requireRepScoringAdmin } from "@/lib/rep-scoring/access";
import { getV7ScorecardOverview } from "@/lib/rep-scoring/v7-validation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AI Closer Scorecard | Magic Mike Bot",
  description: "Private closer scorecard for authorized managers.",
  robots: { index: false, follow: false },
};

export default async function ManagerRepScoringPage({ searchParams }: { searchParams: Promise<{ history?: string }> }) {
  await requireRepScoringAdmin();
  const params = await searchParams;
  // The previous rubric's scores (September 1 until the Call 2 procedure
  // rubric went live) stay stored and readable, but never mix with current scores.
  const historical = params?.history === "1";
  const data = await getV7ScorecardOverview(scorecardVersion(historical));

  return (
    <main className="magic-page">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-5 pb-16 pt-8 sm:px-8">
        <header className="magic-card magic-hero p-5 md:p-7">
          <div className="max-w-3xl">
            <div className="magic-kicker"><ShieldCheck className="size-3.5" />Manager access</div>
            <h1 className="mt-3 text-[34px] font-extrabold leading-tight tracking-normal text-slate-950 md:text-[44px]">AI Closer Scorecard{historical ? " — previous rubric" : ""}</h1>
            <p className="mt-3 max-w-2xl text-[15px] font-medium leading-7 text-slate-600">Review closer scores and open the calls behind them.</p>
            {data.call2Only ? <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Eligible Call 2 sales calls only.</p> : null}
          </div>
        </header>

        {data.error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900"><strong>Scorecard unavailable:</strong> {data.error}</div> : null}

        {historical ? (
          <p className="text-sm text-slate-600">Scores from the previous rubric (calls from September 1 until the Call 2 procedure rubric went live). Kept for comparison only and never averaged with current scores. <Link prefetch={false} href="/manager/rep-scoring" className="font-bold text-red-700 hover:underline">Back to current scores</Link></p>
        ) : (
          <p className="text-sm text-slate-600">Calls scored under the current Call 2 procedure rubric. Each call also shows a procedure checklist (recording disclosure, greenlight length, Rudy&apos;s video, assumptive close, value, urgency, payment options, handoff). <Link prefetch={false} href="/manager/rep-scoring?history=1" className="font-bold text-red-700 hover:underline">Previous rubric scores</Link></p>
        )}
        <CloserScorecardTable reps={data.repSummaries} call2Only={data.call2Only} historical={historical} />

        <p className="max-w-4xl text-xs leading-5 text-slate-500">Scores summarize the calls reviewed and help prioritize investigation. Open a closer to verify the supporting calls before taking action.</p>
      </div>
    </main>
  );
}

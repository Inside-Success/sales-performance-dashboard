import { scorecardVersion } from "@/lib/rep-scoring/scorer-version";
import type { Metadata } from "next";
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
  await searchParams;
  const historical = false;
  const data = await getV7ScorecardOverview(scorecardVersion(historical));

  return (
    <main className="magic-page">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-5 pb-16 pt-8 sm:px-8">
        <header className="magic-card magic-hero p-5 md:p-7">
          <div className="max-w-3xl">
            <div className="magic-kicker"><ShieldCheck className="size-3.5" />Manager access</div>
            <h1 className="mt-3 text-[34px] font-extrabold leading-tight tracking-normal text-slate-950 md:text-[44px]">AI Closer Scorecard</h1>
            <p className="mt-3 max-w-2xl text-[15px] font-medium leading-7 text-slate-600">Review closer scores and open the calls behind them. Lowest scores appear first.</p>
            {data.call2Only ? <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Eligible Call 2 sales calls only.</p> : null}
          </div>
        </header>

        {data.error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900"><strong>Scorecard unavailable:</strong> {data.error}</div> : null}

        <p className="text-sm text-slate-600">Calls from September 1 onward, using the latest reviewed scoring rubric. </p>
        <CloserScorecardTable reps={data.repSummaries} call2Only={data.call2Only} historical={historical} />

        <p className="max-w-4xl text-xs leading-5 text-slate-500">Scores summarize the calls reviewed and help prioritize investigation. Open a closer to verify the supporting calls before taking action.</p>
      </div>
    </main>
  );
}

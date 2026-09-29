import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, MessageSquareText, Target } from "lucide-react";
import { requireRepScoringAdmin } from "@/lib/rep-scoring/access";
import { getCoachingInsightCalls } from "@/lib/coaching-insights-data";
import { summarizeCoachingInsights } from "@/lib/coaching-insights";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Coaching insights | Magic Mike Bot", robots: { index: false, follow: false } };
export default async function CoachingInsightsPage({ searchParams }: { searchParams: Promise<{ days?: string; rep?: string; type?: string }> }) {
  await requireRepScoringAdmin();
  const params = await searchParams;
  const days = [7,30,90].includes(Number(params.days)) ? Number(params.days) : 30;
  const type = params.type === "manual" ? "manual" : "official";
  let calls: Awaited<ReturnType<typeof getCoachingInsightCalls>> = [];
  let unavailable = false;
  try { calls = await getCoachingInsightCalls(days,type); } catch { unavailable = true; }
  const reps = [...new Map(calls.map(c => [c.rep_slug,c.rep_name])).entries()].sort((a,b)=>a[1].localeCompare(b[1]));
  const selected = params.rep ? calls.filter(c => c.rep_slug === params.rep) : calls;
  const data = summarizeCoachingInsights(selected);
  return <main className="magic-page"><div className="mx-auto max-w-6xl space-y-6 px-5 pb-16 pt-8 sm:px-8">
    <header className="magic-card magic-hero p-6 md:p-8">
      <div className="magic-kicker"><Target className="size-4" aria-hidden="true" />Manager coaching</div>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 md:text-4xl">Where your team needs support</h1>
      <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">See recurring buyer concerns and coaching opportunities. Open the calls behind each theme to plan your next training.</p>
    </header>
    <form className="magic-card flex flex-wrap items-end gap-4 p-5">
      <label className="flex min-w-36 flex-1 flex-col gap-2 text-sm font-semibold text-slate-700">Period<select name="days" defaultValue={days} className="h-11 rounded-xl border border-slate-200 bg-white px-3"><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select></label>
      <label className="flex min-w-44 flex-1 flex-col gap-2 text-sm font-semibold text-slate-700">Reports<select name="type" defaultValue={type} className="h-11 rounded-xl border border-slate-200 bg-white px-3"><option value="official">Official calls</option><option value="manual">Self-submitted calls</option></select></label>
      <label className="flex min-w-44 flex-1 flex-col gap-2 text-sm font-semibold text-slate-700">Rep<select name="rep" defaultValue={params.rep || ""} className="h-11 rounded-xl border border-slate-200 bg-white px-3"><option value="">All reps</option>{reps.map(([slug,name])=><option key={slug} value={slug}>{name}</option>)}</select></label>
      <button className="min-h-11 rounded-xl bg-[#c43132] px-6 font-semibold text-white shadow-sm transition-colors hover:bg-[#a9292a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700" type="submit">Apply filters</button>
    </form>
    {unavailable ? <div role="alert" className="magic-card border-red-200 p-6 text-red-800">Coaching insights could not be loaded. Please try again. Missing data is not shown as zero.</div> : <>
    <div className="grid gap-4 sm:grid-cols-3">{[[data.total,"Calls reviewed"],[data.withImprovements,"Calls with coaching actions"],[data.topics.length,"Buyer concern themes"]].map(([value,label])=><div className="magic-card p-5" key={label}><p className="text-sm font-medium text-slate-600">{label}</p><p className="mt-2 text-3xl font-bold tabular-nums text-slate-950">{value}</p></div>)}</div>
    <p className="text-sm leading-6 text-slate-500">Counts are calls mentioning a theme in their coaching report. One call can appear under several themes. Resolved concerns can still appear; these are not counts of lost deals or proof of a rep mistake.</p>
    {data.total === 0 ? <section className="magic-card p-8 text-center"><h2 className="text-xl font-bold">No completed reports in this selection</h2><p className="mt-2 text-slate-600">Try another period or choose all reps.</p></section> : <div className="grid items-start gap-6 lg:grid-cols-2">
      <ThemeList title="What buyers are asking about" description="Use these patterns to prepare relevant answers and examples." rows={data.topics} total={data.total} />
      <ThemeList title="Where to focus coaching" description="Themes in the report’s recommended improvements." rows={data.training} total={data.total} />
    </div>}
    <p className="text-xs leading-5 text-slate-500">Based on available completed reports, not every recorded meeting. {data.structured} of {data.total} reports include the new structured coaching record; older reports use their saved text. Theme matching is a simple text grouping and may miss synonyms. Verify the examples before deciding on training.</p>
    </>}
  </div></main>;
}
function ThemeList({title,description,rows,total}: { title:string;description:string;rows:ReturnType<typeof summarizeCoachingInsights>["topics"];total:number }) {
  return <section className="magic-card p-5 md:p-6"><h2 className="text-xl font-bold text-slate-950">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{description}</p><div className="mt-5 space-y-3">{rows.length ? rows.map(row=><details key={row.key} className="group rounded-2xl border border-slate-200 bg-white open:bg-slate-50/60"><summary className="cursor-pointer rounded-2xl p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"><span className="ml-1 font-semibold text-slate-900">{row.label}</span><span className="mt-2 block pl-5 text-sm text-slate-600">{row.calls.length} calls · {Math.round(row.calls.length/total*100)}% of this selection <span className="ml-2 text-red-700">View calls</span></span></summary><ul className="max-h-[32rem] space-y-4 overflow-y-auto px-4 pb-4">{row.calls.slice(0,8).map(({call,evidence})=><li key={call.id} className="rounded-xl border border-slate-100 bg-white p-4"><Link href={call.report_type === "official" ? `/call/${call.id}` : `/self-report/${call.id}`} className="flex items-center justify-between gap-3 font-semibold text-slate-900 hover:text-red-700"><span>{call.rep_name} · {call.client_name || "Call report"}</span><ArrowUpRight className="size-4 shrink-0" aria-hidden="true" /></Link><p className="mt-2 text-sm leading-6 text-slate-600">{evidence}</p></li>)}</ul>{row.calls.length > 8 ? <p className="px-4 pb-4 text-xs leading-5 text-slate-500">Showing the latest 8 of {row.calls.length} matching calls. Narrow the period or select a rep to focus your review.</p> : null}</details>) : <p className="flex gap-2 py-4 text-sm text-slate-600"><MessageSquareText className="size-5 shrink-0" aria-hidden="true" />No matching themes in these reports. This does not mean every call was perfect.</p>}</div></section>;
}

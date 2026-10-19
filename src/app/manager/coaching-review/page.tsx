import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getReviewList } from "@/lib/coaching-review/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title:"AI Coaching Report Review | Magic Mike Bot", robots:{index:false,follow:false} };
export default async function ReviewListPage() {
  const reports=await getReviewList();
  return <main className="magic-page"><div className="mx-auto max-w-5xl space-y-6 px-5 pb-16 pt-6 sm:px-8">
    <header className="magic-card magic-hero p-6 md:p-8">
      <p className="magic-kicker">Leadership review</p>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 md:text-4xl">AI Coaching Report Review</h1>
      <p className="mt-3 max-w-2xl leading-7 text-slate-600">Ten real calls. A new objection-first coaching format for Mike and Rich to evaluate.</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">These review copies are separate from the coaching reports reps receive.</p>
    </header>
    <div className="flex items-center justify-between gap-4"><h2 className="text-xl font-bold text-slate-950">Choose a report</h2><span className="text-sm text-slate-500">{reports.length} ready to review</span></div>
    {reports.length ? <ol className="grid gap-4 md:grid-cols-2">{reports.map(r=><li key={r.number}>
      <Link href={`/manager/coaching-review/${r.number}`} className="magic-card group flex h-full gap-4 p-5 transition-colors hover:border-red-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-700">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-red-50 font-bold tabular-nums text-red-700">{String(r.number).padStart(2,"0")}</span>
        <div className="min-w-0 flex-1"><h3 className="font-bold text-slate-950">{r.rep}</h3><p className="mt-1 text-slate-700">Call with {r.prospect}</p><p className="mt-2 text-sm leading-6 text-slate-500">{r.show}<br/>{formatDate(r.date)}</p><span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-red-700">Open report <ArrowRight className="size-4" aria-hidden="true"/></span></div>
      </Link>
    </li>)}</ol> : <div className="magic-card p-6 text-slate-600">The review set is not published yet.</div>}
  </div></main>;
}
function formatDate(date:string) { return new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric",timeZone:"America/New_York"}).format(new Date(date)); }

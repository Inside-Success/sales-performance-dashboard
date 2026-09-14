import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import UsageDiagnostics from '@/components/dashboard/usage-diagnostics';
import UsageOverviewTable from '@/components/dashboard/usage-overview-table';
import { getUsageOverview } from '@/lib/usage-overview-data';
import { parseUsagePeriod, usagePercent } from '@/lib/usage-overview';
import { formatMiamiDateTime } from '@/lib/format';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Rep usage | Magic Mike Bot',robots:{index:false,follow:false}};

export default async function ManagerUsagePage({searchParams}:{searchParams:Promise<{days?:string;details?:string}>}) {
  const params=await searchParams;
  const period=parseUsagePeriod(params.days);
  const data=await getUsageOverview(period);
  const rate = usagePercent(data.opened, data.available);
  const currentPromptRate = data.comparison ? usagePercent(data.comparison.current.opened, data.comparison.current.available) : null;
  const previousPromptRate = data.comparison ? usagePercent(data.comparison.previous.opened, data.comparison.previous.available) : null;
  const change = currentPromptRate !== null && previousPromptRate !== null ? currentPromptRate - previousPromptRate : null;
  const periodValue=period===null?'all':String(period);
  return <main className="magic-page"><div className="mx-auto flex w-full max-w-[84rem] flex-col gap-4 px-5 py-6 sm:px-8">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="text-3xl font-bold text-slate-950">Rep usage</h1><p className="mt-1 text-sm text-slate-500">Coaching activity by rep</p></div>
      <nav aria-label="Report availability period" className="flex gap-2">{[{value:'7',label:'7 days'},{value:'30',label:'30 days'},{value:'all',label:'All time'}].map(p=><Link key={p.value} aria-current={periodValue===p.value?'page':undefined} href={`/manager/usage?days=${p.value}`} className={`rounded-lg border px-4 py-2 text-sm ${periodValue===p.value?'bg-red-600 text-white':'bg-white'}`}>{p.label}</Link>)}</nav>
    </header>
    <p className="text-sm text-slate-500">{period===null?'All reports':`Reports received in the last ${period} days`} · Assigned rep’s activity only</p>
    {data.error?<p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4">{data.error}</p>:<>
      <section aria-label="Coaching access summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[{label:'Coaching reports opened',value:rate===null?'—':`${rate}%`,help:`${data.opened} of ${data.available} reports`},
          {label:'Engaged (10+ seconds)',value:String(data.engaged),help:`of ${data.available} reports`},
          {label:'Reps opening feedback',value:`${data.repsOpening} of ${data.repsWithReports}`,help:'Opened at least one report'},
          {label:'Unopened after 2 days',value:String(data.overdue),help:'Reports to follow up on'}].map(m=><div key={m.label} className="magic-card p-5"><p className="text-sm text-slate-600">{m.label}</p><p className="my-2 text-3xl font-bold">{m.value}</p><p className="text-xs text-slate-500">{m.help}</p></div>)}
      </section>
      {data.comparison ? <section aria-label="Opening trend" className="magic-card p-4 text-sm">
        <p className="font-semibold">Opened within 2 days: {currentPromptRate===null?'No eligible reports':`${currentPromptRate}%`}
          {change!==null?<span className="ml-2 font-normal">({change>0?'+':''}{change} points vs. previous {period} days)</span>:null}</p>
        <details className="mt-1 text-xs text-slate-500"><summary className="w-fit cursor-pointer">Comparison details</summary><p className="mt-2">{data.comparison.current.opened} of {data.comparison.current.available} reports vs. {data.comparison.previous.opened} of {data.comparison.previous.available} previously. Each group spans {period} days; the latest ends 2 days ago. Only opens within the first 48 hours count.{previousPromptRate===null?' No previous-period reports to compare.':''}</p></details>
      </section>:null}
      <UsageOverviewTable reps={data.reps} generatedAt={data.generatedAt} />
    </>}
    <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-500"><p>Reps with calls in the last 30 days.</p><p>Updated {formatMiamiDateTime(data.generatedAt)}</p></div>
    <details className="magic-card p-4"><summary className="cursor-pointer text-sm">How this is counted</summary><div className="mt-3 space-y-2 text-sm text-slate-500"><p>Reports count once. Opens and engagement must come from the assigned rep. Last opened includes older reports. Engagement means 10+ seconds on a report, not proof of reading.</p><p>Never opened: no recorded own-feedback opens, with overdue reports. Inactive 7+ days: opened feedback before, but not in 7 days, with overdue reports. Overdue means still unopened after 2 days.</p></div></details>
    {params.details==='1'?<section className="magic-card p-5"><div className="mb-4 flex justify-between"><h2 className="font-semibold">Technical and historical details</h2><Link className="text-sm underline" href={`/manager/usage?days=${periodValue}`}>Hide details</Link></div><Suspense fallback={<p>Loading supporting details…</p>}><UsageDiagnostics /></Suspense></section>:<Link className="w-fit text-sm text-slate-500 underline" href={`/manager/usage?days=${periodValue}&details=1`}>Technical and historical details</Link>}
  </div></main>;
}

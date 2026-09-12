import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import UsageDiagnostics from '@/components/dashboard/usage-diagnostics';
import UsageOverviewTable from '@/components/dashboard/usage-overview-table';
import { getUsageOverview } from '@/lib/usage-overview-data';
import { parseUsagePeriod } from '@/lib/usage-overview';
import { formatMiamiDateTime } from '@/lib/format';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Rep usage | Magic Mike Bot',robots:{index:false,follow:false}};

export default async function ManagerUsagePage({searchParams}:{searchParams:Promise<{days?:string;details?:string}>}) {
  const params=await searchParams;
  const period=parseUsagePeriod(params.days);
  const data=await getUsageOverview(period);
  const periodValue=period===null?'all':String(period);
  return <main className="magic-page"><div className="mx-auto flex w-full max-w-[84rem] flex-col gap-5 px-5 py-8 sm:px-8">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="text-3xl font-bold text-slate-950">Rep usage</h1><p className="mt-1 text-sm text-slate-500">Who is opening their coaching?</p></div>
      <nav aria-label="Report availability period" className="flex gap-2">{[{value:'7',label:'7 days'},{value:'30',label:'30 days'},{value:'all',label:'All time'}].map(p=><Link key={p.value} aria-current={periodValue===p.value?'page':undefined} href={`/manager/usage?days=${p.value}`} className={`rounded-lg border px-4 py-2 text-sm ${periodValue===p.value?'bg-red-600 text-white':'bg-white'}`}>{p.label}</Link>)}</nav>
    </header>
    <p className="text-sm text-slate-500">Reports made available {period===null?'across all recorded history':`in the last ${period} days`}, opened by their owner as of now.</p>
    {data.error?<p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4">{data.error}</p>:<>
      <section aria-label="Coaching access summary" className="grid gap-3 sm:grid-cols-3">
        {[{label:'Reps opening their reports',value:`${data.repsOpening} / ${data.repsWithReports}`,help:'Reps with reports in this period'},
          {label:'Own reports opened',value:`${data.opened} / ${data.available}`,help:'Opened / available'},
          {label:'Unopened after 48 hours',value:String(data.overdue),help:'Older reports to follow up on'}].map(m=><div key={m.label} className="magic-card p-5"><p className="text-sm text-slate-600">{m.label}</p><p className="my-2 text-3xl font-bold">{m.value}</p><p className="text-xs text-slate-500">{m.help}</p></div>)}
      </section>
      <UsageOverviewTable reps={data.reps} />
    </>}
    <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-500"><p>Current reps: official calls in the last 30 days. Dashboard opens only; Slack reading is not measured.</p><p>Updated {formatMiamiDateTime(data.generatedAt)}</p></div>
    <details className="magic-card p-4"><summary className="cursor-pointer text-sm">How this is counted</summary><p className="mt-3 text-sm text-slate-500">Each official report counts once. Only an open recorded under the owning rep counts toward their own reports; managers and other reps cannot clear it. Last coaching opened is the rep’s latest recorded official-report open, including older reports. An open does not prove the report was read. Engagement and visits to other reps’ reports are available under View.</p></details>
    {params.details==='1'?<section className="magic-card p-5"><div className="mb-4 flex justify-between"><h2 className="font-semibold">Technical and historical details</h2><Link className="text-sm underline" href={`/manager/usage?days=${periodValue}`}>Hide details</Link></div><Suspense fallback={<p>Loading supporting details…</p>}><UsageDiagnostics /></Suspense></section>:<Link className="w-fit text-sm text-slate-500 underline" href={`/manager/usage?days=${periodValue}&details=1`}>Technical and historical details</Link>}
  </div></main>;
}

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
  const periodValue=period===null?'all':String(period);
  return <main className="magic-page"><div className="mx-auto flex w-full max-w-[84rem] flex-col gap-4 px-5 py-6 sm:px-8">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="text-3xl font-bold text-slate-950">Rep usage</h1></div>
      <nav aria-label="Report availability period" className="flex gap-2">{[{value:'7',label:'7 days'},{value:'30',label:'30 days'},{value:'all',label:'All time'}].map(p=><Link key={p.value} aria-current={periodValue===p.value?'page':undefined} href={`/manager/usage?days=${p.value}`} className={`rounded-lg border px-4 py-2 text-sm ${periodValue===p.value?'bg-red-600 text-white':'bg-white'}`}>{p.label}</Link>)}</nav>
    </header>
    {data.error?<p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4">{data.error}</p>:<>
      <section aria-label="Coaching access summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[{label:'Reports opened',value:data.opened.toLocaleString(),help:`of ${data.available.toLocaleString()} received`},
          {label:'Open rate',value:rate===null?'—':`${rate}%`,help:'Own coaching reports'},
          {label:'Reps opening feedback',value:`${data.repsOpening} of ${data.repsWithReports}`,help:'Opened at least one report'}].map(m=><div key={m.label} className="magic-card p-5"><p className="text-sm text-slate-600">{m.label}</p><p className="my-2 text-3xl font-bold">{m.value}</p><p className="text-xs text-slate-500">{m.help}</p></div>)}
      </section>
      <UsageOverviewTable reps={data.reps} periodLabel={period===null?'All time':`Last ${period} days`} />
    </>}
    <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-500"><p>Reps with calls in the last 30 days.</p><p>Updated {formatMiamiDateTime(data.generatedAt)}</p></div>
    {params.details==='1'?<section className="magic-card p-5"><div className="mb-4 flex justify-between"><h2 className="font-semibold">Technical and historical details</h2><Link className="text-sm underline" href={`/manager/usage?days=${periodValue}`}>Hide details</Link></div><Suspense fallback={<p>Loading supporting details…</p>}><UsageDiagnostics /></Suspense></section>:<Link className="w-fit text-sm text-slate-500 underline" href={`/manager/usage?days=${periodValue}&details=1`}>Technical and historical details</Link>}
  </div></main>;
}

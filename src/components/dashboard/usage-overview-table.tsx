'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { UsageRepOverview } from '@/lib/usage-overview';
import { formatMiamiDateTime } from '@/lib/format';

export default function UsageOverviewTable({ reps }: { reps:UsageRepOverview[] }) {
  const [search,setSearch]=useState('');
  const [unopenedOnly,setUnopenedOnly]=useState(false);
  const visible=reps.filter(r=>(!unopenedOnly || r.opened<r.available) && r.name.toLowerCase().includes(search.trim().toLowerCase()));
  return <section className="magic-card overflow-hidden" aria-label="Rep coaching access">
    <div className="flex flex-wrap items-center gap-3 border-b p-4">
      <input aria-label="Search reps" placeholder="Search reps" value={search} onChange={e=>setSearch(e.target.value)} className="min-w-0 basis-full rounded-lg border px-3 py-2 sm:basis-auto sm:flex-1" />
      <div className="flex gap-2">{[{value:false,label:'All reps'},{value:true,label:'Has unopened reports'}].map(o=><button key={o.label} aria-pressed={unopenedOnly===o.value} onClick={()=>setUnopenedOnly(o.value)} className={`rounded-lg border px-3 py-2 text-sm ${unopenedOnly===o.value?'bg-red-600 text-white':'bg-white'}`}>{o.label}</button>)}</div>
    </div>
    <p className="px-4 pt-3 text-xs text-slate-500">{visible.length} of {reps.length} current reps · Most overdue reports first</p>
    <div className="overflow-x-auto"><table className="w-full text-sm">
      <thead><tr className="border-b text-left"><th className="p-4">Rep</th><th className="p-4 text-right">Reports available</th><th className="p-4 text-right">Own reports opened</th><th className="p-4">Last coaching opened</th><th className="p-4">Details</th></tr></thead>
      <tbody>{visible.map(rep=><tr key={rep.slug} className="border-b align-top last:border-0">
        <th scope="row" className="p-4 text-left font-medium">{rep.name}</th>
        <td className="p-4 text-right">{rep.available}</td><td className="p-4 text-right">{rep.opened}{rep.overdue>0?<span className="mt-1 block text-xs text-amber-800">{rep.overdue} unopened over 48h</span>:null}</td>
        <td className="p-4 whitespace-nowrap">{rep.lastOpened?formatMiamiDateTime(rep.lastOpened):'No recorded opens'}</td>
        <td className="p-4"><details><summary className="cursor-pointer text-red-700">View</summary><div className="mt-3 min-w-56 max-w-sm space-y-3">
          <p>Own reports engaged (10+ secs): <strong>{rep.engaged}</strong></p>
          <p>Other reps’ reports opened in period: <strong>{rep.otherOpened}</strong></p>
          {rep.unopened.length?<><p className="font-semibold">Unopened reports ({rep.unopened.length})</p><ul className="max-h-72 space-y-3 overflow-y-auto">{rep.unopened.map(report=><li key={report.id}><Link className="underline" href={`/call/${report.id}`}>{report.client}</Link><span className="block text-xs text-slate-500">Available {formatMiamiDateTime(report.availableAt)}{report.overdue?' · Over 48h':' · New'}</span></li>)}</ul></>:<p>{rep.available?'All available reports opened.':'No reports available in this period.'}</p>}
        </div></details></td>
      </tr>)}</tbody>
    </table></div>
    {!visible.length?<p className="p-6 text-slate-500">No reps match these filters.</p>:null}
  </section>;
}

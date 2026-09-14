'use client';
import { useState } from 'react';
import Link from 'next/link';
import { matchesUsageFilter, usagePercent, type UsageFilter, type UsageRepOverview } from '@/lib/usage-overview';
import { formatMiamiDateTime } from '@/lib/format';

export default function UsageOverviewTable({ reps, generatedAt }: { reps:UsageRepOverview[]; generatedAt:string }) {
  const [search,setSearch]=useState('');
  const [filter,setFilter]=useState<UsageFilter>('all');
  const visible=reps.filter(r=>matchesUsageFilter(r,filter,Date.parse(generatedAt)) && r.name.toLowerCase().includes(search.trim().toLowerCase()));
  return <section className="magic-card overflow-hidden" aria-label="Rep coaching access">
    <div className="flex flex-wrap items-center gap-3 border-b p-4">
      <input aria-label="Search reps" placeholder="Search reps" value={search} onChange={e=>setSearch(e.target.value)} className="min-w-0 basis-full rounded-lg border px-3 py-2 sm:basis-auto sm:flex-1" />
      <label className="flex items-center gap-2 text-sm">Show
        <select aria-label="Rep activity filter" value={filter} onChange={e=>setFilter(e.target.value as UsageFilter)} className="max-w-full rounded-lg border bg-white px-3 py-2">
          <option value="all">All reps</option><option value="unopened">Has unopened reports</option>
          <option value="never">Never opened feedback</option><option value="inactive">Previously active, now inactive</option><option value="regular">Regular users</option>
        </select>
      </label>
    </div>
    <p className="px-4 pt-3 text-xs text-slate-600">{filter==='never'?'No recorded own-feedback opens, with reports waiting over 2 days.':filter==='inactive'?'Opened feedback before, but not in the last 7 days, with reports waiting over 2 days.':filter==='regular'?'Active in every week they received reports, with at least 3 such weeks in the last 4.':'Compare each rep’s opening rate, time spent and weekly consistency. Expand details for reports to follow up on.'}</p>
    <p className="px-4 pt-3 text-xs text-slate-500">{visible.length} of {reps.length} current reps · Most overdue reports first · Weeks: ✓ opened feedback · ○ no open · – no reports</p>
    <div className="overflow-x-auto"><table className="w-full text-sm">
      <thead><tr className="border-b text-left"><th className="p-4">Rep</th><th className="p-4 text-right">Reports received</th><th className="p-4 text-right">Opened</th><th className="p-4 text-right">Engaged<br /><span className="font-normal">10+ seconds</span></th><th className="p-4">Consistency<br /><span className="font-normal">Last 4 weeks</span></th><th className="p-4">Last opened</th><th className="p-4">Details</th></tr></thead>
      <tbody>{visible.map(rep=><tr key={rep.slug} className="border-b align-top last:border-0">
        <th scope="row" className="p-4 text-left font-medium">{rep.name}</th>
        <td className="p-4 text-right">{rep.available}</td><td className="p-4 text-right"><strong>{rep.available?`${usagePercent(rep.opened,rep.available)}%`:"—"}</strong><span className="block text-xs text-slate-500">{rep.opened} of {rep.available}</span>{rep.overdue>0?<span className="mt-1 block text-xs text-amber-800">{rep.overdue} unopened after 2 days</span>:null}</td>
        <td className="p-4 text-right">{rep.engaged}</td>
        <td className="p-4"><span className="whitespace-nowrap">{rep.eligibleWeeks?`${rep.activeWeeks} of ${rep.eligibleWeeks} weeks`:'No reports in 4 weeks'}</span>
          <div className="mt-2 flex gap-1" aria-label="Weekly activity, oldest to newest">{rep.weekActivity.map((active,i)=><span key={i} role="img" aria-label={`Week ${i+1}: ${active===null?'No reports':active?'Opened feedback':'No feedback opened'}`} title={`Week ${i+1}: ${active===null?'No reports':active?'Opened feedback':'No feedback opened'}`} className={`flex h-6 w-6 items-center justify-center rounded text-xs ${active===null?'bg-slate-100 text-slate-500':active?'bg-emerald-100 text-emerald-900':'bg-amber-100 text-amber-900'}`}>{active===null?'–':active?'✓':'○'}</span>)}</div>
        </td>
        <td className="p-4 whitespace-nowrap">{rep.lastOwnOpened?formatMiamiDateTime(rep.lastOwnOpened):'No recorded opens'}</td>
        <td className="p-4"><details><summary className="cursor-pointer text-red-700">View details</summary><div className="mt-3 min-w-56 max-w-sm space-y-3">
          <p>Consistency: ✓ opened own feedback · ○ no open · – no reports received (not counted). Weeks run oldest to newest.</p>
          <p>Other reps’ reports opened in period: <strong>{rep.otherOpened}</strong></p>
          {rep.unopened.length?<><p className="font-semibold">Unopened reports ({rep.unopened.length})</p><ul className="max-h-72 space-y-3 overflow-y-auto">{rep.unopened.map(report=><li key={report.id}><Link className="underline" href={`/call/${report.id}`}>{report.client}</Link><span className="block text-xs text-slate-500">Available {formatMiamiDateTime(report.availableAt)}{report.overdue?' · Unopened after 2 days':' · New'}</span></li>)}</ul></>:<p>{rep.available?'All available reports opened.':'No reports available in this period.'}</p>}
        </div></details></td>
      </tr>)}</tbody>
    </table></div>
    {!visible.length?<p className="p-6 text-slate-500">No reps match these filters.</p>:null}
  </section>;
}

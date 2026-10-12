'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Dialog } from '@base-ui/react/dialog';
import { ArrowDown, ArrowUp, ArrowUpDown, ArrowUpRight, X } from 'lucide-react';
import { sortUsageReps, usagePercent, type UsageSort, type UsageRepOverview } from '@/lib/usage-overview';
import { formatMiamiDateTime } from '@/lib/format';

const columns: { key: UsageSort; label: string }[] = [
  { key: 'name', label: 'Rep' }, { key: 'available', label: 'Reports received' },
  { key: 'opened', label: 'Reports opened' }, { key: 'rate', label: 'Open rate' },
  { key: 'lastOwnOpened', label: 'Last opened' },
];

export default function UsageOverviewTable({ reps, periodLabel }: { reps: UsageRepOverview[]; periodLabel: string }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState<UsageSort>('rate');
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const selected = reps.find(rep => rep.slug === selectedSlug);
  const [reportFilter, setReportFilter] = useState('all');
  const visible = sortUsageReps(reps.filter(rep => rep.name.toLowerCase().includes(search.trim().toLowerCase())
    && (filter === 'all' || (filter === 'opened' ? rep.opened > 0 : rep.available > rep.opened))), sort, direction);
  const reports = selected?.reports.filter(report => reportFilter === 'all'
    || (reportFilter === 'opened' ? !!report.openedAt : !report.openedAt)) || [];

  function changeSort(column: UsageSort) {
    if (sort === column) setDirection(value => value === 'asc' ? 'desc' : 'asc');
    else { setSort(column); setDirection(column === 'name' || column === 'rate' ? 'asc' : 'desc'); }
  }

  return <Dialog.Root open={!!selected} onOpenChange={open => { if (!open) setSelectedSlug(null); }}>
    <section className="magic-card overflow-hidden" aria-label="Rep coaching access">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4 sm:p-5">
        <input aria-label="Search reps" placeholder="Search reps" value={search} onChange={event => setSearch(event.target.value)} className="min-h-11 min-w-0 basis-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-red-600 sm:basis-auto sm:flex-1" />
        <select aria-label="Rep activity filter" value={filter} onChange={event => setFilter(event.target.value)} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
          <option value="all">All reps</option><option value="opened">Opened feedback</option><option value="unopened">Has unopened reports</option>
        </select>
        <span className="text-sm text-slate-500" aria-live="polite">{visible.length} {visible.length === 1 ? 'rep' : 'reps'}</span>
      </div>
      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead className="bg-slate-50/70"><tr className="border-b border-slate-100">
          {columns.map(column => <th key={column.key} scope="col" aria-sort={sort === column.key ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'} className={column.key === 'name' || column.key === 'lastOwnOpened' ? 'text-left' : 'text-right'}>
            <button type="button" onClick={() => changeSort(column.key)} className={`inline-flex min-h-12 items-center gap-2 whitespace-nowrap px-4 py-3 font-semibold outline-none hover:text-red-700 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-600 ${sort === column.key ? 'text-red-700' : 'text-slate-600'}`}>
              {column.label}{sort !== column.key ? <ArrowUpDown aria-hidden="true" className="size-3.5 text-slate-400" /> : direction === 'asc' ? <ArrowUp aria-hidden="true" className="size-3.5" /> : <ArrowDown aria-hidden="true" className="size-3.5" />}
            </button>
          </th>)}<th scope="col" className="px-4 text-right"><span className="sr-only">Report details</span></th>
        </tr></thead>
        <tbody>{visible.map(rep => <tr key={rep.slug} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
          <th scope="row" className="p-4 text-left font-semibold text-slate-900">{rep.name}</th>
          <td className="p-4 text-right tabular-nums">{rep.available.toLocaleString()}</td>
          <td className="p-4 text-right font-semibold tabular-nums">{rep.opened.toLocaleString()}</td>
          <td className="p-4 text-right tabular-nums">{rep.available ? `${usagePercent(rep.opened, rep.available)}%` : '—'}</td>
          <td className="whitespace-nowrap p-4 text-slate-600">{rep.lastOwnOpened ? formatMiamiDateTime(rep.lastOwnOpened) : 'No recorded opens'}</td>
          <td className="p-4 text-right"><Dialog.Trigger onClick={() => { setSelectedSlug(rep.slug); setReportFilter('all'); }} aria-label={`View reports for ${rep.name}`} className="inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-full border border-red-100 bg-red-50 px-3 py-2 font-medium text-red-700 hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-red-600">View reports <ArrowUpRight aria-hidden="true" className="size-4" /></Dialog.Trigger></td>
        </tr>)}</tbody>
      </table></div>
      {!visible.length ? <p className="p-8 text-center text-slate-500">No reps match these filters.</p> : null}
    </section>
    {selected ? <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm" />
      <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 flex max-h-[90dvh] w-[calc(100%_-_1.5rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5 sm:p-6">
          <div><Dialog.Title className="text-xl font-bold text-slate-950">{selected.name}</Dialog.Title><Dialog.Description className="mt-1 text-sm text-slate-500">{periodLabel} · Own coaching reports</Dialog.Description></div>
          <Dialog.Close aria-label="Close rep reports" className="grid size-11 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-red-600"><X aria-hidden="true" className="size-5" /></Dialog.Close>
        </div>
        <div className="grid grid-cols-3 gap-3 px-5 py-5 sm:px-6">
          {[{ label: 'Received', value: selected.available }, { label: 'Opened', value: selected.opened }, { label: 'Open rate', value: selected.available ? `${usagePercent(selected.opened, selected.available)}%` : '—' }].map(item => <div key={item.label} className="rounded-2xl bg-slate-50 p-3 sm:p-4"><p className="text-xs text-slate-500">{item.label}</p><p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{item.value}</p></div>)}
        </div>
        <div className="flex items-center justify-between gap-3 px-5 pb-4 sm:px-6"><h3 className="font-semibold">Reports <span className="font-normal text-slate-500">({reports.length})</span></h3><select aria-label="Report status" value={reportFilter} onChange={event => setReportFilter(event.target.value)} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"><option value="all">All reports</option><option value="opened">Opened</option><option value="unopened">Not opened</option></select></div>
        <div className="min-h-0 overflow-y-auto border-t border-slate-100 px-5 sm:px-6">
          {reports.length ? <ul className="divide-y divide-slate-100">{reports.map(report => <li key={report.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="min-w-0 flex-1"><Link href={`/call/${report.id}`} className="inline-flex items-center gap-1.5 font-medium text-slate-900 underline decoration-slate-300 underline-offset-4 hover:text-red-700">{report.client}<ArrowUpRight aria-hidden="true" className="size-4 shrink-0" /></Link><p className="mt-1 text-xs text-slate-500">Received {formatMiamiDateTime(report.availableAt)}</p>{report.openedAt ? <p className="mt-1 text-xs text-slate-500">First opened {formatMiamiDateTime(report.openedAt)}</p> : null}</div>
            <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${report.openedAt ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{report.openedAt ? 'Opened' : 'Not opened'}</span>
          </li>)}</ul> : <p className="py-10 text-center text-sm text-slate-500">No {reportFilter === 'unopened' ? 'unopened ' : reportFilter === 'opened' ? 'opened ' : ''}reports in this period.</p>}
        </div>
      </Dialog.Popup>
    </Dialog.Portal> : null}
  </Dialog.Root>;
}

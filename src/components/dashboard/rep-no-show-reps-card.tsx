"use client";

import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { ChevronRight, ExternalLink, Users, X } from "lucide-react";
import type { RepNoShowCall, RepNoShowRepRow } from "@/lib/rep-no-show";
import { formatMiamiDateTime } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function RepNoShowRepsCard({ reps, calls, periodLabel }: { reps: RepNoShowRepRow[]; calls: RepNoShowCall[]; periodLabel: string }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<RepNoShowRepRow | null>(null);
  const [limit, setLimit] = useState(100);
  const matches = reps.filter(rep => rep.repName.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const details = selected ? calls.filter(call => call.repSlug === selected.repSlug) : [];
  return <Dialog.Root open={Boolean(selected)} onOpenChange={open => { if (!open) setSelected(null); }}>
    <Card className="magic-card">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2"><Users className="size-4" />Rep No-Show Summary</CardTitle>
        <CardDescription>Select a rep to view missed calls. Highest counts first.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="border-b p-4"><Input aria-label="Search reps with no-shows" placeholder="Search reps…" value={query} onChange={event => setQuery(event.target.value)} /><p className="mt-2 text-xs text-muted-foreground">{matches.length} of {reps.length} reps · {periodLabel}</p></div>
        <div className="dashboard-scroll max-h-[38rem] overflow-auto">
          {matches.map(rep => <Dialog.Trigger key={rep.repSlug} render={<button type="button" />} onClick={() => { setSelected(rep); setLimit(100); }} className="group flex min-h-16 w-full items-center justify-between gap-3 border-b px-4 py-3 text-left transition-colors hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-500" aria-label={`View ${rep.repName}'s no-shows`}>
            <span className="min-w-0"><span className="block font-medium">{rep.repName}</span><span className="block text-xs text-muted-foreground">{rep.eligibleCalls.toLocaleString()} tracked calls · {Math.round(rep.noShowRate * 100)}% no-show rate</span></span>
            <span className="flex shrink-0 items-center gap-3"><span className="text-right"><strong className="block">{rep.noShows}</strong><span className="text-xs text-muted-foreground">no-shows</span></span><ChevronRight className="size-4 text-red-600" /></span>
          </Dialog.Trigger>)}
          {!matches.length && <p className="p-5 text-sm text-muted-foreground">{reps.length ? "No reps match this search." : "No rep no-shows found for this period."}</p>}
        </div>
      </CardContent>
    </Card>
    <Dialog.Portal><Dialog.Backdrop className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-sm" />
      <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 flex max-h-[88dvh] w-[calc(100%_-_1.5rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="border-b p-5 pr-16 sm:p-6 sm:pr-16"><Dialog.Title className="text-2xl font-bold text-slate-950">{selected?.repName}</Dialog.Title><Dialog.Description className="mt-1 text-sm text-slate-500">Detected rep no-shows · {periodLabel} · Miami time</Dialog.Description><Dialog.Close render={<Button variant="ghost" size="icon" />} className="absolute right-3 top-3 min-h-11 min-w-11" aria-label="Close rep no-shows"><X className="size-5" /></Dialog.Close></div>
        {selected && <div className="grid grid-cols-2 gap-3 border-b bg-slate-50 px-5 py-4 sm:grid-cols-4 sm:px-6">
          {[['No-shows',selected.noShows],['Call 1',selected.call1NoShows],['Call 2+',selected.noShows-selected.call1NoShows],['No-show rate',`${Math.round(selected.noShowRate*100)}%`]].map(([label,value])=><div key={label}><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-xl font-semibold text-slate-950">{value}</p></div>)}
          <p className="col-span-full text-xs text-slate-500">Out of {selected.eligibleCalls.toLocaleString()} tracked calls in this period.</p>
        </div>}
        <div className="dashboard-scroll overflow-y-auto bg-slate-50/60 p-4 sm:p-6"><div className="space-y-3">
          {details.slice(0,limit).map(call=><article key={call.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold text-slate-950">{call.clientName}</h3><p className="mt-1 text-sm text-slate-500">{formatMiamiDateTime(call.callDate)}</p></div><span className="rounded-full border border-red-100 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">{call.callNumber}</span></div>
            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">{readableReason(call.attendanceReason)}</p>
            <div className="mt-3 flex flex-wrap gap-2">{[[call.transcriptLink,'Open transcript'],[call.meetingLink,'Open Zoom recording']].map(([href,label])=>href?<a key={label} href={href} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm font-medium text-red-700 hover:bg-red-50">{label}<ExternalLink className="size-3.5" /></a>:<span key={label} className="text-xs text-slate-500">{label === 'Open transcript' ? 'Transcript unavailable' : 'Recording unavailable'}</span>)}</div>
          </article>)}
          {!details.length && <p className="text-sm text-slate-600">No matching evidence is available in this saved period.</p>}
          {details.length>limit && <Button variant="outline" onClick={()=>setLimit(value=>value+100)}>Show 100 more calls</Button>}
        </div></div>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>;
}

function readableReason(raw: string) {
  const attendance = raw.match(/attendance_status\s*=\s*(?:sales_)?rep_no_show\s*:\s*([^|]+)/i);
  const decision = raw.match(/(?:sales_)?rep_no_show\s*:\s*([^|]+)/i);
  return (attendance?.[1] || decision?.[1] || raw || "No additional detection reason was saved.").replace(/\s+/g, " ").trim();
}

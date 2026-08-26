"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { V7RepSummary } from "@/lib/rep-scoring/v7-manager";

const callFilters = [
  { label: "15+ calls", value: 15 },
  { label: "8+ calls", value: 8 },
  { label: "3+ calls", value: 3 },
  { label: "All reps", value: 0 },
];

export function CloserScorecardTable({ reps, call2Only = false }: { reps: V7RepSummary[]; call2Only?: boolean }) {
  const [minimumCalls, setMinimumCalls] = useState(call2Only ? 3 : 15);
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const visibleReps = useMemo(() => [...reps]
    .filter((rep) => rep.totalCalls >= minimumCalls)
    .filter((rep) => !normalizedQuery || `${rep.repName} ${rep.repEmail}`.toLowerCase().includes(normalizedQuery))
    .sort((a, b) => a.overallScore - b.overallScore || b.totalCalls - a.totalCalls || a.repName.localeCompare(b.repName)), [minimumCalls, normalizedQuery, reps]);

  return (
    <section className="magic-card overflow-hidden bg-white">
      <div className="border-b border-slate-200 p-5 md:p-6">
        <h2 className="text-xl font-extrabold text-slate-950">Closer scores</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">Lowest score first. Open a closer only when you want to review the calls behind the score.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
          <label className="relative block">
            <span className="sr-only">Search closers</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search closer" className="h-10 bg-white pl-9" />
          </label>
          <div className="flex flex-wrap gap-2" aria-label="Minimum calls reviewed">
            {callFilters.map((filter) => (
              <Button key={filter.value} type="button" size="sm" variant={minimumCalls === filter.value ? "default" : "outline"} onClick={() => setMinimumCalls(filter.value)} className={minimumCalls === filter.value ? "rounded-full bg-red-600 hover:bg-red-700" : "rounded-full"}>
                {filter.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 text-sm text-slate-600 md:px-6">
        <span><strong className="text-slate-950">{visibleReps.length}</strong> closers shown</span>
        <span>Score: 0–100</span>
      </div>

      {visibleReps.length ? (
        <div className="overflow-x-auto">
          <Table className="min-w-[680px]">
            <TableHeader>
              <TableRow className="bg-slate-50/80">
                <TableHead>Closer</TableHead>
                <TableHead className="w-40">Score</TableHead>
                <TableHead className="w-44">Calls reviewed</TableHead>
                <TableHead className="w-36"><span className="sr-only">Review</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleReps.map((rep) => (
                <TableRow key={rep.repEmail || rep.repName}>
                  <TableCell className="font-bold text-slate-950">{rep.repName}</TableCell>
                  <TableCell><span className="text-2xl font-extrabold tabular-nums text-slate-950">{rep.overallScore.toFixed(1)}</span></TableCell>
                  <TableCell><span className="font-bold text-slate-900">{rep.totalCalls}</span> <span className="text-slate-500">calls</span></TableCell>
                  <TableCell className="text-right">
                    <Link prefetch={false} href={`/manager/rep-scoring/rep/${encodeURIComponent(rep.repEmail || rep.repName)}`} className="inline-flex items-center gap-1 text-sm font-bold text-red-700 hover:underline">
                      Review <ArrowRight className="size-4" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : <div className="p-10 text-center text-sm text-slate-600">No closers match this search and call filter.</div>}
    </section>
  );
}

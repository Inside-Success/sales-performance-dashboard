"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ExternalLink, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { RepPerformanceSummary } from "@/lib/rep-scoring/data";
import { cn } from "@/lib/utils";

type EvidenceFilter = "strong" | "moderate" | "initial" | "all";
type StatusFilter = "all" | "attention" | "clear";

const evidenceOptions: Array<{ value: EvidenceFilter; label: string; minimum: number }> = [
  { value: "strong", label: "15+ calls", minimum: 15 },
  { value: "moderate", label: "8+ calls", minimum: 8 },
  { value: "initial", label: "3+ calls", minimum: 3 },
  { value: "all", label: "All evidence", minimum: 0 },
];

export function RepRankingTable({ reps }: { reps: RepPerformanceSummary[] }) {
  const [evidence, setEvidence] = useState<EvidenceFilter>("strong");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const evidenceCounts = useMemo(() => Object.fromEntries(evidenceOptions.map((option) => [option.value, reps.filter((rep) => rep.nScored >= option.minimum).length])), [reps]);
  const minimumCalls = evidenceOptions.find((option) => option.value === evidence)?.minimum ?? 15;
  const normalizedQuery = query.trim().toLowerCase();
  const visibleReps = useMemo(() => reps.filter((rep) => {
    if (rep.nScored < minimumCalls) return false;
    if (status === "attention" && !rep.needsReview) return false;
    if (status === "clear" && rep.needsReview) return false;
    if (normalizedQuery && !`${rep.repName} ${rep.repEmail}`.toLowerCase().includes(normalizedQuery)) return false;
    return true;
  }), [minimumCalls, normalizedQuery, reps, status]);

  return (
    <Card className="magic-card border-white/80 bg-white/95">
      <CardHeader className="gap-1">
        <CardTitle className="text-xl text-slate-950">Rep performance</CardTitle>
        <p className="text-sm leading-6 text-slate-500">Lowest supported score first. The default view uses at least 15 valid calls so managers can start with the most reliable comparisons.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Evidence</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {evidenceOptions.map((option) => (
                <Button key={option.value} type="button" size="sm" variant={evidence === option.value ? "default" : "outline"} onClick={() => setEvidence(option.value)} className={cn("rounded-full", evidence === option.value && "bg-red-600 hover:bg-red-700")}>
                  {option.label} ({evidenceCounts[option.value]})
                </Button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <label className="relative block">
              <span className="sr-only">Search reps</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by rep name or email" className="h-10 bg-white pl-9" />
            </label>
            <div className="flex flex-wrap gap-2">
              <FilterButton active={status === "all"} onClick={() => setStatus("all")}>All results</FilterButton>
              <FilterButton active={status === "attention"} onClick={() => setStatus("attention")}>Needs attention</FilterButton>
              <FilterButton active={status === "clear"} onClick={() => setStatus("clear")}>No supported concern</FilterButton>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
          <span><strong className="text-slate-900">{visibleReps.length}</strong> reps shown</span>
          <span>Scores are cumulative from the fixed launch date.</span>
        </div>

        {visibleReps.length ? (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80">
                  <TableHead>Rep</TableHead>
                  <TableHead>Overall score</TableHead>
                  <TableHead>Evidence</TableHead>
                  <TableHead>Main finding</TableHead>
                  <TableHead>Recent direction</TableHead>
                  <TableHead><span className="sr-only">Open</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleReps.map((rep) => (
                  <TableRow key={rep.id} className={rep.needsReview ? "bg-red-50/30" : undefined}>
                    <TableCell>
                      <div className="font-semibold text-slate-950">{rep.repName}</div>
                      <div className="text-xs text-slate-500">{rep.coverageLabel}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xl font-extrabold text-slate-950">{formatScore(rep.overallScore)}</div>
                      <div className="text-xs font-semibold text-slate-500">{scoreBand(rep.overallScore)}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-bold text-slate-900">{rep.nScored} calls</div>
                      <div className="text-xs text-slate-500">{rep.confidence}</div>
                    </TableCell>
                    <TableCell>
                      <FindingBadge rep={rep} />
                      <div className="mt-2 max-w-[18rem] text-sm font-semibold text-slate-800">{mainFinding(rep)}</div>
                    </TableCell>
                    <TableCell className={rep.trendLabel === "Declining" ? "font-semibold text-red-700" : "text-slate-600"}>
                      {rep.trendLabel}{rep.delta === null ? "" : ` (${rep.delta > 0 ? "+" : ""}${rep.delta.toFixed(1)})`}
                    </TableCell>
                    <TableCell>
                      <Link href={`/manager/rep-scoring/rep/${encodeURIComponent(rep.repId || rep.repEmail)}`} className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-bold text-red-700 hover:underline">Review <ExternalLink className="size-3.5" /></Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-600">No reps match these filters.</div>
        )}
      </CardContent>
    </Card>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <Button type="button" size="sm" variant={active ? "secondary" : "ghost"} onClick={onClick} className={cn("rounded-full", active && "bg-slate-900 text-white hover:bg-slate-800 hover:text-white")}>{children}</Button>;
}

function FindingBadge({ rep }: { rep: RepPerformanceSummary }) {
  if (rep.needsReview) return <Badge variant="outline" className="rounded-full border-red-200 bg-red-50 text-red-700">Needs attention</Badge>;
  if (rep.coachingPriorities.length) return <Badge variant="outline" className="rounded-full border-amber-200 bg-amber-50 text-amber-900">Coaching opportunity</Badge>;
  return <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-800">No supported concern</Badge>;
}

function mainFinding(rep: RepPerformanceSummary) {
  const concern = rep.coachingPriorities[0]?.label;
  if (concern) return concern;
  if (rep.needsReview) return rep.reviewReason;
  return rep.strengths[0] ? `Strongest area: ${rep.strengths[0].label}` : "Continue normal monitoring";
}

function formatScore(value: number | null) { return value === null ? "—" : value.toFixed(1); }
function scoreBand(value: number | null) { if (value === null) return "Not scored"; if (value < 25) return "Unacceptable"; if (value < 50) return "Needs Improvement"; if (value < 70) return "Developing"; if (value < 85) return "Meets Expectations"; return "Excellent"; }

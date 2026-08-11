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
type StatusFilter = "all" | "attention" | "focus" | "event" | "clear";

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
  const minimumCalls = evidenceOptions.find((option) => option.value === evidence)?.minimum ?? 3;
  const normalizedQuery = query.trim().toLowerCase();
  const visibleReps = useMemo(() => reps.filter((rep) => {
    if (rep.nScored < minimumCalls) return false;
    if (status === "attention" && rep.reviewStatus !== "needs_attention") return false;
    if (status === "focus" && rep.reviewStatus !== "coaching_focus") return false;
    if (status === "event" && !rep.criticalEvents.length) return false;
    if (status === "clear" && rep.reviewStatus !== "no_recurring_concern") return false;
    if (normalizedQuery && !`${rep.repName} ${rep.repEmail}`.toLowerCase().includes(normalizedQuery)) return false;
    return true;
  }), [minimumCalls, normalizedQuery, reps, status]);

  return (
    <Card className="magic-card border-white/80 bg-white/95">
      <CardHeader className="gap-1">
        <CardTitle className="text-xl text-slate-950">Rep call-execution results</CardTitle>
        <p className="text-sm leading-6 text-slate-500">Lowest score first. The default shows reps with at least 15 valid calls; broaden the evidence filter when you need earlier signals.</p>
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
              <FilterButton active={status === "focus"} onClick={() => setStatus("focus")}>Manager priority</FilterButton>
              <FilterButton active={status === "event"} onClick={() => setStatus("event")}>Critical call</FilterButton>
              <FilterButton active={status === "clear"} onClick={() => setStatus("clear")}>No priority concern</FilterButton>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
          <span><strong className="text-slate-900">{visibleReps.length}</strong> reps shown</span>
          <span>Scores are cumulative from the fixed launch date.</span>
        </div>

        {visibleReps.length ? (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <Table className="min-w-[1120px] table-fixed">
              <TableHeader>
                <TableRow className="bg-slate-50/80">
                  <TableHead className="w-[17%]">Rep</TableHead>
                  <TableHead className="w-[12%]">Overall score</TableHead>
                  <TableHead className="w-[17%]">Evidence</TableHead>
                  <TableHead className="w-[29%]">Main finding</TableHead>
                  <TableHead className="w-[17%]">Recent direction</TableHead>
                  <TableHead className="w-[8%]"><span className="sr-only">Open</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleReps.map((rep) => (
                  <TableRow key={rep.id} className={rep.needsReview ? "bg-red-50/30" : rep.criticalEvents.length ? "bg-amber-50/30" : undefined}>
                    <TableCell className="align-top">
                      <div className="font-semibold text-slate-950">{rep.repName}</div>
                      <div className="text-xs text-slate-500">{rep.coverageLabel}</div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="text-xl font-extrabold text-slate-950">{formatScore(rep.overallScore)}</div>
                      <div className="text-xs font-semibold text-slate-500">{scoreBand(rep.overallScore)}</div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="font-bold text-slate-900">{rep.nScored} calls</div>
                      <div className="text-xs text-slate-500">{rep.confidence}{rep.excludedCalls ? ` · ${rep.excludedCalls} excluded` : ""}</div>
                    </TableCell>
                    <TableCell className="align-top">
                      <FindingBadge rep={rep} />
                      {rep.criticalEvents.length ? <Badge variant="outline" className="ml-1 rounded-full border-amber-200 bg-amber-50 text-amber-900">{rep.criticalEvents.length} critical {rep.criticalEvents.length === 1 ? "call" : "calls"}</Badge> : null}
                      <div className="mt-2 whitespace-normal break-words text-sm font-semibold leading-5 text-slate-800">{mainFinding(rep)}</div>
                    </TableCell>
                    <TableCell className="align-top"><RecentDirection rep={rep} /></TableCell>
                    <TableCell className="align-top">
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

function RecentDirection({ rep }: { rep: RepPerformanceSummary }) {
  return <div className="space-y-1 text-xs"><TrendLine label="Call 1" trend={rep.call1Trend} /><TrendLine label="Call 2+" trend={rep.call2Trend} /></div>;
}

function TrendLine({ label, trend }: { label: string; trend: RepPerformanceSummary["call1Trend"] }) {
  const delta = trend.delta === null ? "" : ` ${trend.delta > 0 ? "+" : ""}${trend.delta.toFixed(1)}`;
  return <div className={trend.label === "Declining" ? "font-bold text-red-700" : "text-slate-600"}><span className="font-semibold text-slate-800">{label}:</span> {trend.label}{delta}</div>;
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <Button type="button" size="sm" variant={active ? "secondary" : "ghost"} onClick={onClick} className={cn("rounded-full", active && "bg-slate-900 text-white hover:bg-slate-800 hover:text-white")}>{children}</Button>;
}

function FindingBadge({ rep }: { rep: RepPerformanceSummary }) {
  if (rep.reviewStatus === "early_evidence") return <Badge variant="outline" className="rounded-full border-slate-200 bg-slate-50 text-slate-700">Early evidence</Badge>;
  if (rep.reviewStatus === "needs_attention") return <Badge variant="outline" className="rounded-full border-red-200 bg-red-50 text-red-700">Needs attention</Badge>;
  if (rep.reviewStatus === "coaching_focus") return <Badge variant="outline" className="rounded-full border-amber-200 bg-amber-50 text-amber-900">Manager priority</Badge>;
  return <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-800">No priority concern</Badge>;
}

function mainFinding(rep: RepPerformanceSummary) {
  if (rep.needsReview) return rep.reviewReason;
  if (rep.relativeReviewPriority) return rep.reviewReason;
  const concern = rep.coachingPriorities[0]?.label;
  if (concern) return concern;
  if (rep.criticalEvents.length) return "Performance is not flagged; verify the separate call event";
  return rep.strengths[0] ? `Strongest area: ${rep.strengths[0].label}` : "Continue normal monitoring";
}

function formatScore(value: number | null) { return value === null ? "—" : value.toFixed(1); }
function scoreBand(value: number | null) { if (value === null) return "Not scored"; if (value < 25) return "Unacceptable"; if (value < 50) return "Needs Improvement"; if (value < 70) return "Developing"; if (value < 85) return "Meets Expectations"; return "Excellent"; }

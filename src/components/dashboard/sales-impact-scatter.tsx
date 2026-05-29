"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SalesCorrelationRep, UsageGroupKey } from "@/lib/sales-correlation";
import { cn } from "@/lib/utils";

type ScatterFilter = "all" | UsageGroupKey;

const FILTERS: Array<{ key: ScatterFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "high", label: "High" },
  { key: "medium", label: "Some" },
  { key: "low", label: "Low/no" },
];

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const numberFormatter = new Intl.NumberFormat("en-US");

export function SalesImpactScatter({ reps }: { reps: SalesCorrelationRep[] }) {
  const [filter, setFilter] = useState<ScatterFilter>("all");
  const eligibleReps = useMemo(
    () => reps.filter((rep) => rep.usageSignalsWindow > 0 || rep.newPaidRevenueWindow > 0),
    [reps],
  );
  const filteredReps = useMemo(
    () =>
      eligibleReps
        .filter((rep) => filter === "all" || rep.usageGroup === filter)
        .slice(0, 90),
    [eligibleReps, filter],
  );
  const [selectedSlug, setSelectedSlug] = useState<string | null>(filteredReps[0]?.repSlug || null);
  const selectedRep =
    filteredReps.find((rep) => rep.repSlug === selectedSlug) || filteredReps[0] || null;
  const maxUsage = Math.max(1, ...filteredReps.map((rep) => rep.usageSignalsWindow));
  const maxRevenue = Math.max(1, ...filteredReps.map((rep) => rep.newPaidRevenueWindow));

  if (!eligibleReps.length) {
    return (
      <div className="rounded-lg border border-dashed bg-background/60 p-6 text-center text-sm text-muted-foreground">
        No usage or new paid sales points are available for this window.
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((item) => (
            <Button
              key={item.key}
              type="button"
              variant={filter === item.key ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setFilter(item.key);
                setSelectedSlug(null);
              }}
            >
              {item.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <LegendDot className="bg-primary" label="High usage" />
          <LegendDot className="bg-accent-foreground" label="Some usage" />
          <LegendDot className="bg-muted-foreground" label="Low/no usage" />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="relative min-h-96 overflow-hidden rounded-xl border bg-background/75 p-4">
          <div className="absolute inset-x-12 bottom-12 top-8 rounded-lg bg-[linear-gradient(to_right,color-mix(in_oklch,var(--border)_55%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklch,var(--border)_55%,transparent)_1px,transparent_1px)] bg-[size:25%_25%]" />
          <div className="absolute inset-x-12 bottom-12 top-8 border-l border-b border-border" />
          <span className="absolute bottom-4 left-12 text-xs text-muted-foreground">
            Usage signals
          </span>
          <span className="absolute left-4 top-8 text-xs text-muted-foreground">
            New paid sales
          </span>
          <span className="absolute bottom-4 right-12 text-xs font-medium text-muted-foreground">
            {formatNumber(maxUsage)}
          </span>
          <span className="absolute left-4 top-16 text-xs font-medium text-muted-foreground">
            {formatCurrency(maxRevenue)}
          </span>

          <div className="absolute inset-x-12 bottom-12 top-8">
            {filteredReps.map((rep) => {
              const left = (rep.usageSignalsWindow / maxUsage) * 100;
              const bottom = (rep.newPaidRevenueWindow / maxRevenue) * 100;
              const isSelected = selectedRep?.repSlug === rep.repSlug;

              return (
                <button
                  key={rep.repSlug}
                  type="button"
                  title={`${rep.repName}: ${formatNumber(rep.usageSignalsWindow)} usage signals, ${formatCurrency(rep.newPaidRevenueWindow)} new sales`}
                  className={cn(
                    "absolute size-4 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-background shadow-sm outline-none transition-all hover:scale-125 focus-visible:ring-3 focus-visible:ring-ring/50",
                    dotClass(rep.usageGroup),
                    isSelected && "z-10 scale-150 ring-3 ring-ring/40",
                  )}
                  style={{
                    left: `${left}%`,
                    bottom: `${bottom}%`,
                  }}
                  onClick={() => setSelectedSlug(rep.repSlug)}
                  aria-label={`${rep.repName}, ${formatNumber(rep.usageSignalsWindow)} usage signals, ${formatCurrency(rep.newPaidRevenueWindow)} new sales`}
                />
              );
            })}
          </div>

          <div className="absolute right-4 top-4 rounded-lg border bg-card/95 px-3 py-2 text-xs text-muted-foreground shadow-xs">
            Click a point for details
          </div>
        </div>

        <div className="rounded-xl border bg-background/70 p-4">
          {selectedRep ? (
            <div className="grid gap-3">
              <div>
                <Badge variant="secondary">{groupLabel(selectedRep.usageGroup)}</Badge>
                <h3 className="mt-2 text-lg font-semibold">{selectedRep.repName}</h3>
              </div>
              <ScatterStat label="New paid sales" value={formatCurrency(selectedRep.newPaidRevenueWindow)} />
              <ScatterStat label="New deals" value={formatNumber(selectedRep.newPaidDealsWindow)} />
              <ScatterStat label="Usage signals" value={formatNumber(selectedRep.usageSignalsWindow)} />
              <ScatterStat label="Report views" value={formatNumber(selectedRep.reportViewsWindow)} />
              <ScatterStat label="Report view rate" value={formatPercent(selectedRep.usageRate)} />
              <p className="text-xs leading-5 text-muted-foreground">
                This point is a directional signal only. Use more time before treating it as proof.
              </p>
            </div>
          ) : (
            <p className="text-sm leading-6 text-muted-foreground">
              Select a point to see the rep behind it.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn("size-2 rounded-full", className)} />
      {label}
    </span>
  );
}

function ScatterStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-card/70 px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}

function dotClass(group: UsageGroupKey) {
  if (group === "high") return "bg-primary";
  if (group === "medium") return "bg-accent-foreground";
  return "bg-muted-foreground";
}

function groupLabel(group: UsageGroupKey) {
  if (group === "high") return "High usage";
  if (group === "medium") return "Some usage";
  return "Low/no usage";
}

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function formatNumber(value: number) {
  return numberFormatter.format(Math.round(value));
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

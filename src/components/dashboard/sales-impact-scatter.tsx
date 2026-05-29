"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
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

const GROUP_STYLES: Record<UsageGroupKey, { dot: string; badge: string }> = {
  high: {
    dot: "bg-primary",
    badge: "border-primary/25 bg-primary/10 text-primary",
  },
  medium: {
    dot: "bg-chart-3",
    badge: "border-chart-3/40 bg-chart-3/15 text-foreground",
  },
  low: {
    dot: "bg-muted-foreground",
    badge: "border-muted-foreground/25 bg-muted text-muted-foreground",
  },
};

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
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const selectedRep = selectedSlug
    ? filteredReps.find((rep) => rep.repSlug === selectedSlug) || null
    : null;
  const maxUsage = Math.max(1, ...filteredReps.map((rep) => rep.usageSignalsWindow));
  const maxRevenue = Math.max(1, ...filteredReps.map((rep) => rep.newPaidRevenueWindow));

  function selectRep(event: MouseEvent<HTMLButtonElement>, repSlug: string) {
    event.stopPropagation();
    setSelectedSlug(repSlug);
  }

  useEffect(() => {
    function clearSelection(event: globalThis.MouseEvent) {
      if (
        event.target instanceof Element &&
        event.target.closest("[data-sales-scatter-point='true']")
      ) {
        return;
      }

      setSelectedSlug(null);
    }

    document.addEventListener("click", clearSelection);
    return () => document.removeEventListener("click", clearSelection);
  }, []);

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
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <LegendDot className={GROUP_STYLES.high.dot} label="High usage" />
          <LegendDot className={GROUP_STYLES.medium.dot} label="Some usage" />
          <LegendDot className={GROUP_STYLES.low.dot} label="Low/no usage" />
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
                  data-sales-scatter-point="true"
                  title={`${rep.repName}: ${formatNumber(rep.usageSignalsWindow)} usage signals, ${formatCurrency(rep.newPaidRevenueWindow)} new sales`}
                  className={cn(
                    "absolute size-4 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-background shadow-sm outline-none transition-all hover:scale-125 focus-visible:ring-3 focus-visible:ring-ring/50",
                    GROUP_STYLES[rep.usageGroup].dot,
                    isSelected && "z-10 scale-150 ring-3 ring-ring/40",
                  )}
                  style={{
                    left: `${left}%`,
                    bottom: `${bottom}%`,
                  }}
                  onClick={(event) => selectRep(event, rep.repSlug)}
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
                <Badge variant="outline" className={GROUP_STYLES[selectedRep.usageGroup].badge}>
                  {groupLabel(selectedRep.usageGroup)}
                </Badge>
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
            <div className="flex min-h-full flex-col justify-center rounded-lg border border-dashed bg-card/55 p-4 text-center">
              <p className="font-medium">No rep selected</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Click a dot in the graph to view that rep&apos;s sales and usage details.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border bg-background/70 px-2 py-1">
      <span className={cn("size-2.5 rounded-full", className)} />
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

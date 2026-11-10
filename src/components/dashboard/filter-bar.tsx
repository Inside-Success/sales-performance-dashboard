import Link from "next/link";
import { Search } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { DashboardFilters, RepSummary } from "@/lib/types";

type FilterBarProps = {
  filters: DashboardFilters;
  reps: RepSummary[];
  repLocked?: boolean;
  clearHref?: string;
};

export function FilterBar({ filters, reps, repLocked = false, clearHref = "/" }: FilterBarProps) {
  const activeFilters = getActiveFilters(filters, reps, repLocked);

  return (
    <section className="dashboard-card rounded-xl border bg-card/95 p-3 backdrop-blur lg:sticky lg:top-[calc(4.25rem+var(--magic-admin-offset,0px))] lg:z-30">
      <form method="get" className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_160px_160px_140px_140px_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            name="q"
            defaultValue={filters.q}
            placeholder="Search coaching notes, clients, reps"
          />
        </div>

        {!repLocked ? (
          <select
            className="h-9 rounded-md border border-input bg-card px-3 text-sm shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            name="rep"
            defaultValue={filters.rep || ""}
            aria-label="Filter by rep"
          >
            <option value="">All reps</option>
            {reps.map((rep) => (
              <option key={rep.rep_slug} value={rep.rep_slug}>
                {rep.rep_name}
              </option>
            ))}
          </select>
        ) : null}

        <Input name="client" defaultValue={filters.client} placeholder="Client" />
        <Input name="from" defaultValue={filters.from} type="date" aria-label="From date" />
        <Input name="to" defaultValue={filters.to} type="date" aria-label="To date" />
        <Button type="submit">Apply</Button>
        {activeFilters.length ? (
          <Link href={clearHref} className={cn(buttonVariants({ variant: "outline" }), "h-8")}>
            Clear
          </Link>
        ) : null}
      </form>

      {activeFilters.length ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
          <span className="text-xs font-medium uppercase text-muted-foreground">Active filters</span>
          {activeFilters.map((filter) => (
            <Badge key={filter} variant="secondary" className="rounded-md">
              {filter}
            </Badge>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function getActiveFilters(filters: DashboardFilters, reps: RepSummary[], repLocked: boolean) {
  const activeFilters: string[] = [];

  if (filters.q) activeFilters.push(`Search: ${filters.q}`);
  if (filters.rep && !repLocked) {
    activeFilters.push(`Rep: ${reps.find((rep) => rep.rep_slug === filters.rep)?.rep_name || filters.rep}`);
  }
  if (filters.client) activeFilters.push(`Client: ${filters.client}`);
  if (filters.from) activeFilters.push(`From: ${filters.from}`);
  if (filters.to) activeFilters.push(`To: ${filters.to}`);

  return activeFilters;
}

import Link from "next/link";
import { CalendarDays, Search, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DashboardFilters } from "@/lib/types";
import { cn } from "@/lib/utils";

type ReportFiltersProps = {
  action: string;
  filters: DashboardFilters;
  repSlug?: string;
  clearHref: string;
};

export function ReportFilters({ action, filters, repSlug, clearHref }: ReportFiltersProps) {
  const hasFilters = Boolean(filters.q || filters.date);

  return (
    <form action={action} className="rounded-lg border bg-card/80 p-3">
      {repSlug ? <input type="hidden" name="rep" value={repSlug} /> : null}
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-end">
        <label className="grid gap-1.5 text-xs font-medium uppercase text-muted-foreground">
          Find a report
          <span className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="q"
              defaultValue={filters.q || ""}
              placeholder="Client, meeting title, or date"
              className="pl-8"
            />
          </span>
        </label>

        <label className="grid gap-1.5 text-xs font-medium uppercase text-muted-foreground">
          Meeting date
          <span className="relative">
            <CalendarDays className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input name="date" type="date" defaultValue={filters.date || ""} className="pl-8" />
          </span>
        </label>

        <div className="flex gap-2">
          <button type="submit" className={buttonVariants({ size: "default" })}>
            Search
          </button>
          {hasFilters ? (
            <Link
              href={clearHref}
              className={cn(buttonVariants({ variant: "outline", size: "icon" }), "shrink-0")}
              aria-label="Clear filters"
            >
              <X className="size-4" />
            </Link>
          ) : null}
        </div>
      </div>
    </form>
  );
}

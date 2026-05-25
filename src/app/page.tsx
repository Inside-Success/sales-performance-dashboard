import { ArrowDownWideNarrow, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CallCard } from "@/components/dashboard/call-card";
import { RepPicker } from "@/components/dashboard/rep-picker";
import { ReportFilters } from "@/components/dashboard/report-filters";
import { getDashboardData } from "@/lib/db";
import { readFilters, type RawSearchParams } from "@/lib/search-params";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const filters = readFilters(await searchParams);
  const selectedRepSlug = filters.rep;
  const { calls, reps, configured, error } = await getDashboardData(
    selectedRepSlug ? { ...filters, rep: selectedRepSlug } : {},
  );
  const selectedRepName =
    reps.find((rep) => rep.rep_slug === selectedRepSlug)?.rep_name || calls[0]?.rep_name || "";
  const hasSelectedRep = Boolean(selectedRepSlug);

  return (
    <main className="dashboard-page min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <header className="dashboard-card dashboard-hero rounded-2xl border bg-card/95 p-5 md:p-6">
          <div className="max-w-2xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Inside Success TV</Badge>
              {!configured ? <Badge variant="destructive">Database not connected</Badge> : null}
            </div>
            <h1 className="text-3xl font-semibold tracking-normal md:text-4xl">
              Magic Mike Bot (Formerly Lil Rudy)
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Newest feedback reports by rep.
            </p>
          </div>

          <div className="mt-6 rounded-xl border bg-background/80 p-3">
            <RepPicker reps={reps} selectedRepSlug={selectedRepSlug} />
          </div>

          {hasSelectedRep ? (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <Badge variant="outline" className="gap-1 rounded-md bg-background/70">
                <ArrowDownWideNarrow className="size-3.5" />
                Newest meetings first
              </Badge>
            </div>
          ) : null}
        </header>

        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {!configured ? (
          <div className="rounded-lg border bg-card p-4 text-sm leading-6 text-muted-foreground">
            Connect `DATABASE_URL` and `INGEST_SECRET` in Vercel, then run `scripts/schema.sql` or let the ingest route create the table on first post.
          </div>
        ) : null}

        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">
                {hasSelectedRep ? `${selectedRepName || "Selected rep"}'s calls` : "Choose a rep"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {hasSelectedRep
                  ? `${calls.length} ${calls.length === 1 ? "report" : "reports"} found.`
                  : "The call list appears after a rep is selected."}
              </p>
            </div>
          </div>

          {hasSelectedRep ? (
            <>
              <ReportFilters
                action="/"
                filters={filters}
                repSlug={selectedRepSlug}
                clearHref={`/?rep=${encodeURIComponent(selectedRepSlug || "")}`}
              />
              {calls.length ? (
                <div className="grid gap-3">
                  {calls.map((call) => <CallCard key={call.id} call={call} compact showRep={false} />)}
                </div>
              ) : (
                <EmptyState repName={selectedRepName} hasFilters={Boolean(filters.q || filters.date)} />
              )}
            </>
          ) : (
            <SelectionState />
          )}
        </section>
      </div>
    </main>
  );
}

function SelectionState() {
  return (
    <div className="rounded-xl border bg-card/80 p-8 text-center">
      <UserRound className="mx-auto mb-3 size-8 text-muted-foreground" />
      <h3 className="text-base font-semibold">No rep selected</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        Feedback reports are grouped by rep.
      </p>
    </div>
  );
}

function EmptyState({ repName, hasFilters }: { repName: string; hasFilters?: boolean }) {
  return (
    <div className="rounded-xl border bg-card/80 p-8 text-center">
      <h3 className="text-base font-semibold">No reports found</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {hasFilters
          ? "No reports match that search."
          : repName
            ? `${repName} does not have dashboard reports yet.`
            : "This rep does not have dashboard reports yet."}
      </p>
    </div>
  );
}

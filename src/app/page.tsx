import { Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CallCard } from "@/components/dashboard/call-card";
import { RepPicker } from "@/components/dashboard/rep-picker";
import { ReportFilters } from "@/components/dashboard/report-filters";
import { TrackUsageEvent } from "@/components/dashboard/usage-tracker";
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
    <main className="magic-page">
      <TrackUsageEvent
        eventName="dashboard_home_viewed"
        eventData={{
          source: "official_dashboard",
          target_rep_slug: selectedRepSlug || null,
          target_rep_name: selectedRepName || null,
        }}
      />
      <div className="mx-auto w-full max-w-3xl px-5 pb-24 pt-12 sm:px-8 sm:pt-16">
        <header className="mb-9">
          {!configured ? <Badge variant="destructive">Database not connected</Badge> : null}
          <h1 className="text-[38px] font-extrabold leading-[1.05] tracking-normal text-slate-900 sm:text-[48px]">
            Stop losing deals you could have closed.
          </h1>
          <ul className="mt-6 space-y-2 text-[17px] font-medium leading-[1.8] text-slate-500">
            <li className="flex items-start gap-2.5">
              <span className="mt-[13px] size-1.5 shrink-0 rounded-full bg-[#DC2626]" />
              <span>Magic Mike gives custom, call-by-call coaching feedback.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-[13px] size-1.5 shrink-0 rounded-full bg-[#DC2626]" />
              <span>Trained on Rudy&apos;s proven strategies and winning calls from the top closers.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-[13px] size-1.5 shrink-0 rounded-full bg-[#DC2626]" />
              <span>
                Spend just <strong className="font-bold text-[#DC2626]">1 min</strong> reviewing each call, so you know exactly where to improve, and start closing more $.
              </span>
            </li>
          </ul>
        </header>

        {error ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {!configured ? (
          <div className="magic-card p-4 text-sm leading-6 text-muted-foreground">
            Connect `DATABASE_URL` and `INGEST_SECRET` in Vercel, then run `scripts/schema.sql` or let the ingest route create the table on first post.
          </div>
        ) : null}

        <section className="magic-card magic-selector-card">
          <div className="border-b border-slate-100 p-5 sm:p-7">
            <RepPicker reps={reps} selectedRepSlug={selectedRepSlug} />
          </div>
          {hasSelectedRep ? (
            <div className="space-y-4 p-5 sm:p-7">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  {calls.length} report{calls.length === 1 ? "" : "s"}
                </span>
                <span className="text-[13px] font-semibold text-slate-400">Newest first</span>
              </div>
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
            </div>
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
    <div className="px-6 py-20 text-center sm:px-10">
      <span className="relative mx-auto mb-8 grid size-28 place-items-center rounded-[30px] bg-[#FEF2F2] text-[#DC2626]">
        <Inbox className="size-12" strokeWidth={2.4} />
        <span className="absolute -right-3 -top-3 grid size-10 place-items-center rounded-full bg-white text-slate-300 shadow-sm">
          ✦
        </span>
      </span>
      <h3 className="text-[24px] font-extrabold tracking-normal text-slate-900">No rep selected</h3>
      <p className="mx-auto mt-4 max-w-sm text-[16px] font-medium leading-8 text-slate-500">
        Choose a rep above to see their newest feedback reports. Reports are grouped by rep — the call list appears as soon as one is selected.
      </p>
    </div>
  );
}

function EmptyState({ repName, hasFilters }: { repName: string; hasFilters?: boolean }) {
  return (
    <div className="p-10 text-center">
      <h3 className="text-base font-semibold text-slate-950">No reports found</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        {hasFilters
          ? "No reports match that search."
          : repName
            ? `${repName} does not have dashboard reports yet.`
            : "This rep does not have dashboard reports yet."}
      </p>
    </div>
  );
}

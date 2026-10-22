import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, ChevronDown, Search } from "lucide-react";
import { getClosedSales } from "@/lib/closed-sales/data";
import { categories } from "@/lib/closed-sales/schema";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Closed Sales Library | Magic Mike Bot",
  robots: { index: false, follow: false },
};
const inputClass =
  "mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-base text-slate-900 focus-visible:outline-2 focus-visible:outline-red-600";
const linkClass =
  "inline-flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 font-semibold text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-600";
function date(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  }).format(new Date(value.length === 10 ? `${value}T12:00:00Z` : value));
}
function SourceLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={linkClass}
    >
      {children}
      <ExternalLink className="size-4 shrink-0" aria-hidden="true" />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
export default async function ClosedSalesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const data = await getClosedSales(await searchParams);
  if (!data)
    return (
      <main className="magic-page">
        <div className="mx-auto max-w-6xl p-6">
          <h1 className="text-3xl font-bold">Closed Sales Library</h1>
          <p className="mt-4">The library has not been published yet.</p>
        </div>
      </main>
    );
  const { filters } = data;
  function pageLink(page: number) {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.rep) params.set("rep", filters.rep);
    if (filters.category) params.set("category", filters.category);
    if (filters.reports) params.set("reports", "available");
    params.set("page", String(page));
    return `/manager/closed-sales?${params}`;
  }
  return (
    <main className="magic-page">
      <div className="mx-auto max-w-6xl space-y-6 px-5 pb-16 pt-6 sm:px-8">
        <header className="magic-card magic-hero p-6 md:p-8">
          <p className="magic-kicker">Sales call library</p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 md:text-4xl">
            Closed Sales Library
          </h1>
          <p className="mt-3 max-w-3xl leading-7 text-slate-600">
            Find sales conversations and existing coaching reports from Pay Me
            submissions. Choose a sale to see its recordings and source.
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Entries posted {date(data.from)}–{date(data.through)} ·{" "}
            {data.entries.toLocaleString()} sales entries · Collected{" "}
            {date(data.capturedAt)}
          </p>
        </header>
        <form
          key={JSON.stringify(filters)}
          className="magic-card space-y-4 p-5"
          action="/manager/closed-sales"
        >
          <div className="grid gap-4 md:grid-cols-3">
            <label className="text-sm font-semibold text-slate-700">
              Search client, rep or show
              <input
                type="search"
                name="q"
                defaultValue={filters.q}
                className={inputClass}
                placeholder="Search the library"
                maxLength={100}
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Show category
              <select
                name="category"
                defaultValue={filters.category}
                className={inputClass}
              >
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Sales rep
              <select
                name="rep"
                defaultValue={filters.rep}
                className={inputClass}
              >
                <option value="">All reps</option>
                {data.reps.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                name="reports"
                value="available"
                defaultChecked={filters.reports}
                className="size-4 accent-red-600"
              />
              With an existing coaching report
            </label>
            <button className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-600 px-5 font-semibold text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600">
              <Search className="size-4" aria-hidden="true" />
              Apply filters
            </button>
            <Link href="/manager/closed-sales" className={linkClass}>
              Clear
            </Link>
          </div>
        </form>
        <p className="text-sm text-slate-600" aria-live="polite">
          {data.total.toLocaleString()} matching sales entries
        </p>
        <div className="space-y-3">
          {data.rows.map((s) => (
            <details key={s.id} className="magic-card group overflow-hidden">
              <summary className="flex min-h-16 cursor-pointer list-none items-center gap-4 p-5 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-red-600 [&::-webkit-details-marker]:hidden">
                <div className="min-w-0 flex-1">
                  <h2 className="break-words text-lg font-bold text-slate-950">
                    {s.client}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {s.rep} · {s.show || "Show not specified"} · {date(s.date)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs font-medium">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                      {s.category}
                    </span>
                    {s.package && (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                        {s.package}
                      </span>
                    )}
                    <span className="rounded-full bg-red-50 px-3 py-1 text-red-700">
                      {s.recordings.length} recordings · {s.reports.length}{" "}
                      reports
                    </span>
                  </div>
                </div>
                <span className="flex shrink-0 items-center gap-2 text-sm font-semibold text-red-700">
                  <span className="hidden sm:inline">View calls</span>
                  <ChevronDown
                    className="size-5 transition-transform group-open:rotate-180 motion-reduce:transition-none"
                    aria-hidden="true"
                  />
                </span>
              </summary>
              <div className="space-y-5 border-t border-slate-100 p-5">
                <p className="text-sm leading-6 text-slate-600">
                  {s.reviewNote}
                </p>
                {s.reports.length > 0 && (
                  <section>
                    <h3 className="font-bold text-slate-950">
                      Existing coaching reports
                    </h3>
                    <ul className="mt-3 space-y-3">
                      {s.reports.map((r) => (
                        <li
                          key={r.id}
                          className="rounded-xl border border-slate-200 p-4"
                        >
                          <p className="font-semibold text-slate-900">
                            {date(r.date)} ·{" "}
                            {r.closingCandidate
                              ? "Sales conversation to review"
                              : "Related conversation"}
                          </p>
                          <p className="mt-1 text-sm leading-6 text-slate-600">
                            {r.outcome}
                          </p>
                          <p className="mt-2 text-xs text-slate-500">
                            {r.match === "recording"
                              ? "Matched by recording link"
                              : "Matched by rep, client name and sale date; confirm the conversation before using it as a closing example."}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            <Link href={`/call/${r.id}`} className={linkClass}>
                              Open coaching report
                            </Link>
                            {r.recording && (
                              <SourceLink href={r.recording}>
                                Recording
                              </SourceLink>
                            )}
                            {r.transcript && (
                              <SourceLink href={r.transcript}>
                                Transcript
                              </SourceLink>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                <section>
                  <h3 className="font-bold text-slate-950">
                    Recordings submitted with this sale
                  </h3>
                  {s.recordings.length ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {s.recordings.map((r) => (
                        <SourceLink key={r.url} href={r.url}>
                          {r.label}
                        </SourceLink>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-600">
                      No recording link was supplied in the sales entry.
                    </p>
                  )}
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Recording numbers are the source form’s labels. They do not
                    establish which call closed the sale. Zoom may require
                    sign-in or a recording passcode.
                  </p>
                </section>
                <div className="border-t border-slate-100 pt-3">
                  {s.sources.map((url, i) => (
                    <SourceLink key={url} href={url}>
                      {s.sources.length > 1
                        ? `Sales entry ${i + 1}`
                        : "Open sales entry and replies"}
                    </SourceLink>
                  ))}
                </div>
              </div>
            </details>
          ))}
        </div>
        {!data.rows.length && (
          <div className="magic-card p-6 text-slate-600">
            No sales entries match these filters. Try another rep or clear the
            filters.
          </div>
        )}
        {data.pages > 1 && (
          <nav
            aria-label="Library pages"
            className="flex items-center justify-between gap-3"
          >
            <div>
              {filters.page > 1 && (
                <Link href={pageLink(filters.page - 1)} className={linkClass}>
                  Previous
                </Link>
              )}
            </div>
            <span className="text-sm text-slate-600">
              Page {filters.page} of {data.pages}
            </span>
            <div>
              {filters.page < data.pages && (
                <Link href={pageLink(filters.page + 1)} className={linkClass}>
                  Next
                </Link>
              )}
            </div>
          </nav>
        )}
      </div>
    </main>
  );
}

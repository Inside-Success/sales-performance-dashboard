"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, Search, ArrowUp, ArrowDown } from "lucide-react";
import type {
  ImpactAnalysis,
  ImpactGroup,
  ImpactRep,
} from "@/lib/sales-impact-analysis";
const money = (n: number | null) =>
  n === null
    ? "Not matched"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(n);
const labels: Record<ImpactGroup, string> = {
  high: "High usage",
  some: "Some usage",
  none: "No recorded opens",
};
const colors: Record<ImpactGroup, string> = {
  high: "#c43132",
  some: "#c78b43",
  none: "#94a3b8",
};
export function SalesImpactOverview({
  data,
  children,
}: {
  data: ImpactAnalysis;
  children?: ReactNode;
}) {
  const [filter, setFilter] = useState<"all" | ImpactGroup>("all"),
    [selected, setSelected] = useState<string | null>(null),
    [query, setQuery] = useState(""),
    [showAll, setShowAll] = useState(false);
  const [sort, setSort] = useState<"name" | "opened" | "revenue">("revenue"),
    [direction, setDirection] = useState<"asc" | "desc">("desc");
  const points = data.reps.filter((r) => r.revenue !== null),
    visible = points.filter((r) => filter === "all" || r.group === filter);
  const maxOpened = Math.max(1, ...points.map((r) => r.opened)),
    maxRevenue = Math.max(1, ...points.map((r) => r.revenue!));
  const rep = data.reps.find((r) => r.slug === selected) || null;
  const rows = data.reps
    .filter((r) => r.name.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => {
      if (sort === "revenue" && a.revenue === null)
        return b.revenue === null ? a.name.localeCompare(b.name) : 1;
      if (sort === "revenue" && b.revenue === null) return -1;
      const delta =
        sort === "name"
          ? a.name.localeCompare(b.name)
          : Number(a[sort]) - Number(b[sort]);
      return (
        delta * (direction === "asc" ? 1 : -1) || a.name.localeCompare(b.name)
      );
    });
  function toggleSort(column: typeof sort) {
    if (sort === column) setDirection(direction === "asc" ? "desc" : "asc");
    else {
      setSort(column);
      setDirection(column === "name" ? "asc" : "desc");
    }
  }
  function pick(slug: string) {
    setSelected(slug);
    document
      .getElementById("sales-impact-rep")
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  return (
    <>
      <section
        className="magic-card p-5 sm:p-7"
        aria-label="Usage and sales comparison"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-950">
              Coaching use and sales
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Each dot is a rep. Right means more own coaching reports opened;
              up means more new paid revenue.
            </p>
          </div>
          <div
            className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1"
            aria-label="Scatterplot usage group"
          >
            {(["all", "high", "some", "none"] as const).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={filter === k}
                onClick={() => setFilter(k)}
                className={`min-h-10 rounded-lg px-3 text-xs font-semibold ${filter === k ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:bg-white/70"}`}
              >
                {k === "all"
                  ? "All reps"
                  : k === "none"
                    ? "No opens"
                    : labels[k]}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_19rem]">
          <div>
            <div
              className="relative h-80 sm:h-96"
              role="group"
              aria-label="Interactive sales scatterplot"
            >
              <div className="absolute bottom-10 left-16 right-5 top-7 border-b border-l border-slate-300 bg-[linear-gradient(to_right,rgba(203,213,225,0.4)_1px,transparent_1px),linear-gradient(to_bottom,rgba(203,213,225,0.4)_1px,transparent_1px)] bg-[size:25%_25%]">
                {visible.map((r) => (
                  <button
                    key={r.slug}
                    type="button"
                    onClick={() => setSelected(r.slug)}
                    title={`${r.name}: ${r.opened} reports opened, ${money(r.revenue)}`}
                    aria-label={`${r.name}, ${r.opened} reports opened, ${money(r.revenue)} new paid revenue`}
                    aria-pressed={selected === r.slug}
                    className={`absolute -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-white shadow-sm transition-transform hover:scale-150 focus:z-20 focus:outline-2 focus:outline-offset-4 focus:outline-red-600 ${selected === r.slug ? "z-10 size-4 ring-4 ring-red-100" : "size-3"}`}
                    style={{
                      left: `${(r.opened / maxOpened) * 100}%`,
                      bottom: `${(r.revenue! / maxRevenue) * 100}%`,
                      backgroundColor: colors[r.group],
                    }}
                  />
                ))}
              </div>
              {[0, 0.5, 1].map((f) => (
                <span
                  key={f}
                  className="absolute left-0 w-14 text-right text-[11px] text-slate-500"
                  style={{ bottom: `calc(40px + (100% - 68px) * ${f})` }}
                >
                  {money(maxRevenue * f)}
                </span>
              ))}
              <span className="absolute bottom-0 left-16 text-xs font-medium text-slate-500">
                Reports opened
              </span>
              <span className="absolute bottom-0 right-5 text-xs text-slate-500">
                {maxOpened}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600">
              {(["high", "some", "none"] as const).map((k) => (
                <span className="inline-flex items-center gap-2" key={k}>
                  <span
                    className="size-2.5 rounded-full"
                    style={{ background: colors[k] }}
                  />
                  {labels[k]}
                </span>
              ))}
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-400">
              {visible.length} reps shown. Zero-sales reps remain included.
              Search the table to select overlapping dots.
            </p>
          </div>
          <aside
            id="sales-impact-rep"
            className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5"
            aria-live="polite"
          >
            {rep ? (
              <RepDetail rep={rep} />
            ) : (
              <>
                <p className="text-sm font-semibold text-slate-950">
                  Select a rep to see their results
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Click a dot or choose a rep in the table below.
                </p>
                <div className="mt-6 space-y-5">
                  {data.groups.map((g) => (
                    <div key={g.key}>
                      <div className="flex justify-between gap-2 text-sm">
                        <span className="font-medium text-slate-600">
                          {labels[g.key]}
                        </span>
                        <span className="font-bold text-slate-950">
                          {g.average === null ? "—" : money(g.average)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        {g.count} matched reps · average new paid revenue
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </aside>
        </div>
      </section>
      {children}
      <section
        className="magic-card overflow-hidden"
        aria-label="Individual rep results"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-5 sm:p-6">
          <div>
            <h2 className="text-xl font-bold text-slate-950">Find a rep</h2>
            <p className="mt-1 text-sm text-slate-500">
              Open their sales and coaching summary.
            </p>
          </div>
          <label className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
            <Search className="size-4 text-slate-400" aria-hidden="true" />
            <input
              aria-label="Search sales impact reps"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowAll(false);
              }}
              placeholder="Search reps…"
              className="w-48 bg-transparent py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-red-200"
            />
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[570px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                {(["name", "opened", "revenue"] as const).map((k) => (
                  <th
                    key={k}
                    className="px-5 py-3"
                    aria-sort={
                      sort === k
                        ? direction === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <button
                      onClick={() => toggleSort(k)}
                      className="inline-flex min-h-10 items-center gap-2 font-semibold"
                    >
                      {k === "name"
                        ? "Rep"
                        : k === "opened"
                          ? "Reports opened"
                          : "New paid revenue"}
                      {sort === k ? (
                        direction === "asc" ? (
                          <ArrowUp className="size-3" />
                        ) : (
                          <ArrowDown className="size-3" />
                        )
                      ) : null}
                    </button>
                  </th>
                ))}
                <th className="px-5 py-3">
                  <span className="sr-only">Open rep summary</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {(showAll ? rows : rows.slice(0, 10)).map((r) => (
                <tr
                  key={r.slug}
                  className="border-t border-slate-100 hover:bg-slate-50/60"
                >
                  <td className="px-5 py-4 font-semibold text-slate-900">
                    {r.name}
                  </td>
                  <td className="px-5 py-4 tabular-nums">{r.opened}</td>
                  <td className="px-5 py-4 tabular-nums">{money(r.revenue)}</td>
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => pick(r.slug)}
                      aria-label={`View sales impact for ${r.name}`}
                      className="inline-flex min-h-10 items-center gap-2 font-semibold text-[#c43132]"
                    >
                      View rep{" "}
                      <ArrowUpRight className="size-4" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length ? (
          <p className="p-6 text-sm text-slate-500">
            No reps match this search.
          </p>
        ) : null}
        <div className="flex justify-between p-5 text-sm text-slate-500">
          <span>{rows.length} reps</span>
          {rows.length > 10 ? (
            <button
              className="font-semibold text-[#c43132]"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? "Show fewer" : "Show all reps"}
            </button>
          ) : null}
        </div>
      </section>
    </>
  );
}
function RepDetail({ rep }: { rep: ImpactRep }) {
  const max = Math.max(1, ...rep.trend.map((t) => t.revenue));
  return (
    <>
      <h3 className="text-lg font-bold text-slate-950">{rep.name}</h3>
      <p className="mt-1 text-xs text-slate-500">
        {rep.revenue === null
          ? "Sales identity not matched"
          : labels[rep.group]}
      </p>
      <dl className="mt-5 grid grid-cols-2 gap-4">
        <div>
          <dt className="text-xs text-slate-500">Reports opened</dt>
          <dd className="mt-1 text-2xl font-bold">{rep.opened}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">New paid revenue</dt>
          <dd className="mt-1 text-xl font-bold">{money(rep.revenue)}</dd>
        </div>
      </dl>
      <p className="mt-5 text-xs font-semibold text-slate-600">
        Eight complete weeks of sales
      </p>
      <div className="mt-2 space-y-2">
        {rep.trend.map((t) => (
          <div
            key={t.label}
            className="grid grid-cols-[2.5rem_1fr_4rem] items-center gap-2 text-[10px]"
          >
            <span className="text-slate-400">{t.label.slice(5)}</span>
            <div className="h-2 rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-[#c43132]"
                style={{ width: `${(t.revenue / max) * 100}%` }}
              />
            </div>
            <span className="text-right text-slate-500">
              {rep.revenue === null ? "—" : money(t.revenue)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-5 border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500">
        {rep.before !== null && rep.after !== null
          ? `Complete before/after comparison: ${money(rep.before)} → ${money(rep.after)}.`
          : rep.waiting
            ? "Before/after comparison is waiting for a complete follow-up period."
            : "No complete before/after comparison is available for this rep."}
      </div>
      <Link
        href={`/rep/${rep.reportSlug}`}
        className="mt-4 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[#c43132]"
      >
        Open coaching reports{" "}
        <ArrowUpRight className="size-4" aria-hidden="true" />
      </Link>
    </>
  );
}

import React from "react";
import Link from "next/link";
import publication from "@/lib/ask-sales-faq/admin/knowledge-publication.json";
import { REVAMP_KNOWLEDGE_VERSION } from "@/lib/ask-sales-faq/revamp/knowledge";
import type { ReactNode } from "react";
import type { Filters } from "@/lib/ask-sales-faq/admin/filters";
import { filterQuery } from "@/lib/ask-sales-faq/admin/filters";
export function AdminLayout({
  active,
  children,
}: {
  active: "conversations" | "usage";
  children: ReactNode;
}) {
  return (
    <main className="min-h-[calc(100dvh-72px)] bg-slate-50 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-red-700">
              Ask Sales · Admin
            </p>
            <h1 className="mt-2 text-3xl font-extrabold text-slate-950">
              {active === "conversations" ? "Conversations" : "Usage"}
            </h1>
            <p className="mt-2 text-slate-600">
              {active === "conversations"
                ? "See what people ask, read the full exchange, and review problems."
                : "Understand who uses Ask Sales and whether they return."}
            </p>
          </div>
          <Link
            href="/ask-sales-faq"
            className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold"
          >
            Back to chatbot →
          </Link>
        </header>
        <nav
          aria-label="Ask Sales administration"
          className="flex gap-2 border-b border-slate-200"
        >
          {(["conversations", "usage"] as const).map((x) => (
            <Link
              key={x}
              aria-current={active === x ? "page" : undefined}
              href={
                x === "usage"
                  ? "/ask-sales-faq/admin/usage"
                  : "/ask-sales-faq/admin"
              }
              className={`border-b-2 px-5 py-3 font-bold ${active === x ? "border-red-600 text-red-700" : "border-transparent text-slate-500"}`}
            >
              {x === "usage" ? "Usage" : "Conversations"}
            </Link>
          ))}
        </nav>
        {children}
        <footer className="border-t pt-4 text-xs leading-6 text-slate-500">
          Knowledge last updated:{" "}
          {publication.knowledgeVersion === REVAMP_KNOWLEDGE_VERSION
            ? `${publication.publishedDateMiami} (Miami date)`
            : "publication date not recorded for this version"}
          . Admin access only. Knowledge updates are handled through the weekly
          review process; these pages do not publish chatbot knowledge.
        </footer>
      </div>
    </main>
  );
}
export function DateFilters({
  f,
  usage = false,
  reps = [],
}: {
  f: Filters;
  usage?: boolean;
  reps?: { key: string; email: string; name: string | null }[];
}) {
  const field =
    "min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm";
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <span className="font-semibold">Date range</span>
        <Link
          className="text-red-700 underline"
          href={`?days=7&admins=${f.includeAdmins ? "1" : "0"}`}
        >
          Last 7 days
        </Link>
        <Link
          className="text-red-700 underline"
          href={`?days=30&admins=${f.includeAdmins ? "1" : "0"}`}
        >
          Last 30 days
        </Link>
        <span className="text-xs text-slate-500">
          Dates use Miami time · up to one year
        </span>
      </div>
      <form className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-xs font-semibold">
          From
          <input
            aria-label="From date"
            type="date"
            name="start"
            defaultValue={f.start}
            required
            className={field}
          />
        </label>
        <label className="grid gap-1 text-xs font-semibold">
          Through
          <input
            aria-label="Through date"
            type="date"
            name="end"
            defaultValue={f.end}
            required
            className={field}
          />
        </label>
        <label className="grid min-w-40 flex-1 gap-1 text-xs font-semibold">
          {usage ? "Find a person" : "Search conversations"}
          <input
            name="q"
            defaultValue={f.q}
            placeholder={usage ? "Name or email" : "Question, answer or name"}
            className={field}
          />
        </label>
        {!usage && (
          <label className="grid gap-1 text-xs font-semibold">
            Person
            <select
              name="rep"
              defaultValue={f.rep}
              className={`${field} max-w-60`}
            >
              <option value="">All people</option>
              {reps.map((r) => (
                <option key={r.email} value={r.key}>
                  {r.name || r.email}
                </option>
              ))}
            </select>
          </label>
        )}
        {usage ? (
          <>
            <label className="grid gap-1 text-xs font-semibold">
              Activity
              <select name="usage" defaultValue={f.usage} className={field}>
                <option value="all">All known people</option>
                <option value="used">Used in this period</option>
                <option value="never">Never used</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold">
              Sort by
              <select name="sort" defaultValue={f.sort} className={field}>
                <option value="questions">Questions asked</option>
                <option value="days">Days used</option>
                <option value="recent">Most recent use</option>
                <option value="name">Name</option>
              </select>
            </label>
          </>
        ) : (
          <>
            <input type="hidden" name="filter" value={f.filter} />
            <label className="grid gap-1 text-xs font-semibold">
              Review status
              <select name="review" defaultValue={f.review} className={field}>
                <option value="all">All</option>
                <option value="pending">Not reviewed / new activity</option>
                <option value="reviewed">Reviewed</option>
              </select>
            </label>
          </>
        )}
        <label className="flex min-h-10 items-center gap-2 text-xs">
          <input
            type="checkbox"
            name="admins"
            value="1"
            defaultChecked={f.includeAdmins}
          />
          Include admin activity
        </label>
        <button className="min-h-10 rounded-lg bg-slate-900 px-5 text-sm font-bold text-white">
          Apply
        </button>
      </form>
      <p className="mt-3 text-xs text-slate-500">
        Admin accounts are excluded by default. Unlabelled test activity cannot
        be reliably separated from real use.
      </p>
    </section>
  );
}
export function Metric({
  label,
  value,
  description,
  href,
}: {
  label: string;
  value: string | number;
  description: string;
  href?: string;
}) {
  const body = (
    <>
      <p className="text-sm font-semibold text-slate-600">{label}</p>
      <p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">
        {value}
      </p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{description}</p>
    </>
  );
  return href ? (
    <Link
      className="rounded-2xl border bg-white p-5 hover:border-red-300"
      href={href}
    >
      {body}
    </Link>
  ) : (
    <div className="rounded-2xl border bg-white p-5">{body}</div>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed p-10 text-center text-sm text-slate-500">
      {children}
    </div>
  );
}
export function LoadError() {
  return (
    <div
      role="alert"
      className="rounded-xl border border-amber-300 bg-amber-50 p-6"
    >
      <h2 className="font-bold">We couldn’t load the data</h2>
      <p className="mt-2 text-sm">
        This is not a report of zero activity. Please reload the page. The
        chatbot is separate from this view.
      </p>
    </div>
  );
}
export function PageLinks({
  f,
  total,
  path,
}: {
  f: Filters;
  total: number;
  path: string;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span>
        {total} conversations · page {f.page}
      </span>
      <div className="flex gap-4">
        {f.page > 1 && (
          <Link
            className="font-semibold text-red-700"
            href={`${path}?${filterQuery(f, { page: f.page - 1 })}`}
          >
            ← Previous
          </Link>
        )}
        {f.page * 30 < total && (
          <Link
            className="font-semibold text-red-700"
            href={`${path}?${filterQuery(f, { page: f.page + 1 })}`}
          >
            Next →
          </Link>
        )}
      </div>
    </div>
  );
}

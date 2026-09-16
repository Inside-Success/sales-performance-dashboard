
import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import {
  getAskSalesFaqAccess,
  isAskSalesFaqAdmin,
} from "@/lib/ask-sales-faq/access";
import {
  parseFilters,
  filterQuery,
  issueLabels,
  type Params,
} from "@/lib/ask-sales-faq/admin/filters";
import { getConversationOverview } from "@/lib/ask-sales-faq/admin/store";
import {
  AdminLayout,
  DateFilters,
  Metric,
  Empty,
  LoadError,
  PageLinks,
} from "@/components/ask-sales-faq/admin/layout";
import { formatMiamiDateTime } from "@/lib/format";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Ask Sales Conversations | Magic Mike Bot",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const access = getAskSalesFaqAccess(await auth());
  if (!access.ok || !isAskSalesFaqAdmin(access.viewerEmail)) notFound();
  const f = parseFilters(await searchParams);
  let data;
  try {
    data = await getConversationOverview(f);
  } catch {
    return (
      <AdminLayout active="conversations">
        <LoadError />
      </AdminLayout>
    );
  }
  const { metrics: m, rows, reps } = data;
  return (
    <AdminLayout active="conversations">
      <DateFilters key={filterQuery(f)} f={f} reps={reps} />
      <section
        aria-label="Conversation summary"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Metric
          label="Questions asked"
          value={m.questions}
          description="User questions during this period."
        />
        <Metric
          label="People using it"
          value={m.people}
          description="People who asked a question."
        />
        <Metric
          label="Feedback received"
          value={m.up + m.down}
          description={`${m.up} helpful · ${m.down} unhelpful. Unrated answers are not scored.`}
          href={`?${filterQuery(f, { filter: "down" })}`}
        />
        <Metric
          label="Failed responses"
          value={m.failures}
          description="Technical failures—not an answer accuracy score."
          href={`?${filterQuery(f, { filter: "failed" })}`}
        />
      </section>
      <section className="space-y-4">
        <nav aria-label="Conversation filters" className="flex flex-wrap gap-2">
          {[
            ["all", "All conversations"],
            ["attention", "Needs attention"],
            ["down", "Unhelpful feedback"],
            ["failed", "Failed responses"],
            ["unanswered", "Unanswered / partial"],
          ].map(([key, label]) => (
            <Link
              key={key}
              aria-current={f.filter === key ? "page" : undefined}
              href={`?${filterQuery(f, { filter: key })}`}
              className={`rounded-full border px-4 py-2 text-sm font-semibold ${f.filter === key ? "border-red-200 bg-red-50 text-red-800" : "bg-white text-slate-600"}`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <p className="text-xs text-slate-500">
          Flags identify items to review; they do not prove an answer is wrong.
          Summary cards follow dates and person filters; search and review
          filters narrow the list below.
        </p>
        {!rows.length ? (
          <Empty>
            No conversations match these filters. Try a wider date range or
            include admin activity.
          </Empty>
        ) : (
          <div className="divide-y overflow-hidden rounded-2xl border bg-white">
            {rows.map((r) => (
              <Link
                key={r.id}
                href={`/ask-sales-faq/admin/conversations/${encodeURIComponent(r.id)}?${filterQuery(f)}`}
                className="block p-5 transition-colors hover:bg-slate-50"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-slate-900">
                    {r.name || r.email}
                  </span>
                  <span className="text-xs text-slate-500">
                    {formatMiamiDateTime(r.last_at)}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-700">
                  {r.title || "Untitled conversation"}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-slate-500">
                    {r.questions} questions · {r.messages} messages in period
                  </span>
                  {issueLabels(r).map((label) => (
                    <span
                      key={label}
                      className="rounded-full bg-amber-50 px-2 py-1 text-amber-900"
                    >
                      {label}
                    </span>
                  ))}
                  <span className="ml-auto text-slate-500">
                    {r.reviewed ? "Reviewed" : "Not reviewed / new activity"} ·
                    Read conversation →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
        <PageLinks
          f={f}
          total={rows[0]?.total || 0}
          path="/ask-sales-faq/admin"
        />
      </section>
    </AdminLayout>
  );
}

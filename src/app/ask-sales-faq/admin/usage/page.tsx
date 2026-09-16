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
  type Params,
} from "@/lib/ask-sales-faq/admin/filters";
import { getUsage } from "@/lib/ask-sales-faq/admin/store";
import {
  AdminLayout,
  DateFilters,
  Metric,
  Empty,
  LoadError,
} from "@/components/ask-sales-faq/admin/layout";
import { formatMiamiDateTime } from "@/lib/format";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Ask Sales Usage | Magic Mike Bot",
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
    data = await getUsage({ ...f, rep: "" });
  } catch {
    return (
      <AdminLayout active="usage">
        <LoadError />
      </AdminLayout>
    );
  }
  const users = data.users
    .filter(
      (u) =>
        (!f.q ||
          `${u.name || ""} ${u.email}`
            .toLowerCase()
            .includes(f.q.toLowerCase())) &&
        (f.usage === "all" ||
          (f.usage === "used" ? u.questions > 0 : u.total === 0)),
    )
    .sort((a, b) =>
      f.sort === "name"
        ? (a.name || a.email).localeCompare(b.name || b.email)
        : f.sort === "days"
          ? b.days - a.days
          : f.sort === "recent"
            ? (Date.parse(b.last_at || "") || 0) -
              (Date.parse(a.last_at || "") || 0)
            : b.questions - a.questions,
    );
  const totalQuestions = data.users.reduce((s, u) => s + u.questions, 0),
    peak = Math.max(1, ...data.daily.map((d) => d.questions));
  return (
    <AdminLayout active="usage">
      <DateFilters key={filterQuery(f)} f={f} usage />
      <section
        aria-label="Usage summary"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Metric
          label="People who used it"
          value={data.users.filter((u) => u.questions > 0).length}
          description="Asked a question in the selected period."
        />
        <Metric
          label="Questions asked"
          value={totalQuestions}
          description="User questions in the selected period."
        />
        <Metric
          label="Returning users"
          value={data.users.filter((u) => u.days > 1).length}
          description="Used it on at least two days in this period."
        />
        <Metric
          label="Haven’t tried it"
          value={data.users.filter((u) => u.total === 0).length}
          description="Known people with no retained question history."
        />
      </section>
      <section className="rounded-2xl border bg-white p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold">Activity over time</h2>
          <span className="text-xs text-slate-500">
            Questions per day · hover or focus a bar for people count
          </span>
        </div>
        {!data.daily.length ? (
          <Empty>No questions during this period.</Empty>
        ) : (
          <>
            <div
              className="mt-5 flex h-40 items-end gap-1 overflow-x-auto border-b"
              aria-label="Daily question activity"
            >
              {data.daily.map((d) => (
                <div
                  key={d.day}
                  tabIndex={0}
                  title={`${d.day}: ${d.questions} questions, ${d.people} people`}
                  aria-label={`${d.day}: ${d.questions} questions, ${d.people} people`}
                  className="group relative min-w-3 flex-1 rounded-t bg-red-400 focus:bg-red-700 hover:bg-red-700"
                  style={{
                    height: `${Math.max(3, (d.questions / peak) * 100)}%`,
                  }}
                >
                  <span className="sr-only">
                    {d.day}: {d.questions} questions from {d.people} people
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-xs text-slate-500">
              <span>{f.start}</span>
              <span>{f.end}</span>
            </div>
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer text-slate-600">
                View daily numbers
              </summary>
              <div className="mt-3 max-h-56 overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      <th className="p-2">Date</th>
                      <th>Questions</th>
                      <th>People</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.daily.map((d) => (
                      <tr key={d.day} className="border-t">
                        <td className="p-2">{d.day}</td>
                        <td>{d.questions}</td>
                        <td>{d.people}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
      </section>
      <section className="overflow-hidden rounded-2xl border bg-white">
        <div className="border-b p-5">
          <h2 className="text-lg font-bold">People · {users.length}</h2>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-500">
            This list combines recent dashboard/call activity and retained Ask
            Sales users. It is not a complete employee roster. Usage is not a
            performance rating. Cards and chart show the entire date range;
            search and activity filters narrow this list.
          </p>
        </div>
        {!users.length ? (
          <Empty>No people match these filters.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[660px] text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="p-4">Person</th>
                  <th className="p-4">Questions</th>
                  <th className="p-4">Days used</th>
                  <th className="p-4">Most recent use</th>
                  <th className="p-4">
                    <span className="sr-only">Conversations</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.email} className="border-t">
                    <td className="p-4">
                      <span className="font-semibold">{u.name || u.email}</span>
                      {u.name && (
                        <span className="mt-1 block text-xs text-slate-500">
                          {u.email}
                        </span>
                      )}
                    </td>
                    <td className="p-4">{u.questions}</td>
                    <td className="p-4">{u.days}</td>
                    <td className="p-4 text-slate-500">
                      {u.last_at
                        ? formatMiamiDateTime(u.last_at)
                        : "No recorded use"}
                    </td>
                    <td className="p-4">
                      {u.total > 0 && (
                        <Link
                          className="whitespace-nowrap font-semibold text-red-700"
                          href={`/ask-sales-faq/admin?${filterQuery(f, { rep: u.repKey, q: "", filter: "all", review: "all" })}`}
                        >
                          View conversations →
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminLayout>
  );
}

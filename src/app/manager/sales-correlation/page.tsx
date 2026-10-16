import { requireRepScoringAdmin } from "@/lib/rep-scoring/access";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, TrendingUp } from "lucide-react";
import { getSalesImpactAnalytics } from "@/lib/sales-impact-data";
import {
  normalizeSalesCorrelationWindow,
  SALES_CORRELATION_WINDOWS,
} from "@/lib/sales-correlation";
import { SalesImpactOverview } from "@/components/dashboard/sales-impact-overview";
import { SalesAnalyticsChatPanel } from "@/components/dashboard/sales-analytics-chat-panel";
import { formatMiamiDateTime } from "@/lib/format";
import {
  IMPACT_GROUP_LABELS,
  type ImpactComparison,
} from "@/lib/sales-impact-analysis";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "AI Coaching Sales Impact | Magic Mike Bot",
  robots: { index: false, follow: false },
};
const money = (n: number | null) =>
  n === null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(n);
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  await requireRepScoringAdmin();
  const { days } = await searchParams,
    period = normalizeSalesCorrelationWindow(days);
  let data: Awaited<ReturnType<typeof getSalesImpactAnalytics>>;
  try {
    data = await getSalesImpactAnalytics(period);
  } catch (error) {
    console.error("Sales Impact read failed", error);
    return (
      <main className="magic-page p-8">
        <section role="alert" className="magic-card mx-auto max-w-3xl p-8">
          <h1 className="text-2xl font-bold">
            Sales impact is temporarily unavailable
          </h1>
          <p className="mt-3 text-slate-600">
            The data could not be loaded. Missing results are not shown as zero.
            Please try again.
          </p>
        </section>
      </main>
    );
  }
  const a = data.analysis;
  const paired = a.beforeAfter;
  const pairedHeadline = paired.count
    ? `Reps averaged ${money(Math.abs(paired.difference ?? 0))} ${(paired.difference ?? 0) >= 0 ? "more" : "less"} after their first recorded coaching open.`
    : a.headline;
  return (
    <main className="magic-page">
      <div className="mx-auto max-w-[84rem] space-y-5 px-5 pb-16 pt-8 sm:px-8">
        <header className="magic-card magic-hero p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <div className="magic-kicker">
                <TrendingUp className="size-4" aria-hidden="true" />
                Manager insights
              </div>
              <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
                AI Coaching Sales Impact
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                See how opening Magic Mike coaching relates to sales results.
              </p>
            </div>
            <div className="space-y-3">
              <nav
                aria-label="Sales impact period"
                className="grid grid-cols-2 rounded-xl border border-slate-200 bg-white p-1 sm:flex"
              >
                {SALES_CORRELATION_WINDOWS.map((d) => (
                  <Link
                    key={d}
                    aria-current={period === d ? "page" : undefined}
                    href={`?days=${d}`}
                    className={`rounded-lg px-3 py-2 text-center text-sm font-semibold ${period === d ? "bg-[#c43132] text-white" : "text-slate-500 hover:bg-slate-50"}`}
                  >
                    {d} days
                  </Link>
                ))}
              </nav>
              <Link
                href="/manager/usage?days=30"
                className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-red-700"
              >
                Rep usage <ArrowUpRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </header>
        {data.warning ? (
          <div
            role="status"
            className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
          >
            {data.warning}
          </div>
        ) : null}
        <section className="magic-card border-l-4 border-l-[#c43132] p-6 sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            What the data shows
          </p>
          <h2 className="mt-2 text-xl font-bold leading-snug text-slate-950 sm:text-2xl">
            {pairedHeadline}
          </h2>
          <p className="mt-3 text-sm text-slate-500">
            {paired.count
              ? `${paired.count} reps with complete ${period}-day before/after periods · ${money(paired.before)} → ${money(paired.after)} average new paid revenue.`
              : "No complete before/after comparison yet."}
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Chart period: {a.start} to {a.end} · Complete Miami days · An
            association, not proof that coaching caused the difference.
          </p>
          {a.coverageStart && a.coverageStart > a.start ? (
            <p className="mt-2 text-xs text-amber-800">
              Recorded own-report opens begin {a.coverageStart}; usage does not
              cover this entire sales period.
            </p>
          ) : null}
        </section>
        <SalesImpactOverview data={a}>
          <section className="grid gap-5 lg:grid-cols-2">
            <Comparison
              title="Before and after first recorded use"
              description={`${period} complete days before and after the first recorded open. The opening day is excluded.`}
              comparison={a.beforeAfter}
            />
            <Comparison
              title="Sales after a coaching week"
              description="Last 12 weeks: compare each rep’s next 14 days after weeks with opens versus weeks without opens."
              comparison={a.subsequent}
            />
          </section>
        </SalesImpactOverview>
        <details className="magic-card p-5 sm:p-6">
          <summary className="cursor-pointer text-sm font-semibold text-slate-600">
            How this comparison works
          </summary>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-500">
            <p>
              Usage counts distinct own official coaching reports opened in the
              selected period. Repeat opens count once; there is no ten-second
              requirement. Self-submitted reports, other reps’ reports and
              anonymous activity are excluded from this measure.
            </p>
            <p>
              Fixed groups are 0, 1–5, 6–20 and 21+ opens (20 belongs to 6–20).
              Group membership depends only on distinct reports opened, never
              sales results. The comparison uses reps with official call
              activity in the last 30 days and an exact normalized sales-name
              match. {a.matched} matched reps; {a.excludedUnmatched} unmatched
              reps are listed separately and not treated as zero-sales reps.
            </p>
            <p>
              In each rep summary, report coverage counts only reports received
              in this period that were also opened during it, divided by all
              official reports received in that same period. Five of ten is 50%;
              five of fifty is 10%. Older-report opens do not enter that
              numerator. With no reports received, coverage is unavailable, not
              0%. Reports are not a denominator for every sales call, and
              coverage does not measure time spent or learning.
            </p>
            <p>
              Revenue is the amount of New + Paid entries in the existing sales
              Sheet. It is cash recorded in the period, not contracted value or
              revenue attributed to a particular call. The Sheet is read-only.{" "}
              {data.syncedAt
                ? `Last successful sales read: ${formatMiamiDateTime(data.syncedAt)}.`
                : ""}
            </p>
            <p>
              Same-rep before/after results require complete periods and
              available sales history. The following-sales check uses up to four
              non-overlapping 21-day blocks across the previous 84 days; it
              includes only reps with both a usage and a no-usage block and
              available coaching before the block. Observational comparisons can
              also reflect call volume, experience, offer changes and lead mix.
            </p>
            <p>
              Group medians:{" "}
              {a.groups
                .map(
                  (g) =>
                    `${IMPACT_GROUP_LABELS[g.key]}: ${money(g.median)} (${g.count} reps)`,
                )
                .join("; ")}
              . The 21+ group average without its largest sale-total rep is{" "}
              {money(a.sensitivity.highWithoutLargest)}. All matched reps with
              opens average {money(a.sensitivity.allUsers)}. These checks are
              shown regardless of whether they favour coaching.
            </p>
          </div>
        </details>
        <SalesAnalyticsChatPanel periodDays={period} />
      </div>
    </main>
  );
}
function Comparison({
  title,
  description,
  comparison: c,
}: {
  title: string;
  description: string;
  comparison: ImpactComparison;
}) {
  return (
    <section className="magic-card p-6">
      <h2 className="text-lg font-bold text-slate-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
      {c.count ? (
        <>
          <div className="mt-5 flex items-baseline gap-3">
            <p
              className={`text-3xl font-extrabold tabular-nums ${(c.difference ?? 0) >= 0 ? "text-emerald-700" : "text-slate-900"}`}
            >
              {(c.difference ?? 0) > 0 ? "+" : ""}
              {money(c.difference)}
            </p>
            <span className="text-sm text-slate-500">average difference</span>
          </div>
          <p className="mt-2 text-sm text-slate-500">
            {money(c.before)} → {money(c.after)} · {c.count} reps
          </p>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            Typical rep’s change: {money(c.medianDifference)}. This does not
            establish causation.
          </p>
        </>
      ) : (
        <p className="mt-5 text-sm text-slate-500">
          Not enough complete matched comparisons yet.
        </p>
      )}
      {c.waiting ? (
        <p className="mt-3 text-xs text-slate-500">
          {c.waiting} reps are waiting for a complete follow-up period.
        </p>
      ) : null}
    </section>
  );
}

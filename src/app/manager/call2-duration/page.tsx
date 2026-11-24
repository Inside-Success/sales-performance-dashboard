import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { calls, choices, clock, medianClock } from "./data";
import { Player } from "./player";
import { saveMark } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Call 2 timing | Magic Mike",
  robots: { index: false, follow: false },
};
const path = "/manager/call2-duration";

export default async function CallTiming({
  searchParams,
}: {
  searchParams: Promise<{
    edit?: string;
    rep?: string;
    changed?: string;
    saved?: string;
  }>;
}) {
  const [all, query] = await Promise.all([calls(), searchParams]);
  const reps = [...new Set(all.map((row) => row.summary.rep))].sort();
  const rows = all.filter((row) => !query.rep || row.summary.rep === query.rep);
  const pullbackTimes = rows.flatMap(({ review, summary }) => {
    const signal = review ? review.signal : summary.signal;
    return signal ? [summary.total - signal.at] : [];
  });
  const editing = rows.find((row) => row.occurrence === query.edit);
  const options = editing ? await choices(editing.occurrence) : [];
  return (
    <main className="magic-page">
      <div className="mx-auto max-w-4xl space-y-5 px-4 py-8 sm:px-8">
        <header>
          <h1 className="text-3xl font-extrabold text-slate-950">
            Call 2 timing
          </h1>
          <p className="mt-2 text-slate-600">
            Pilot calls · Review when cast first pulled back and what happened
            next.
          </p>
        </header>
        <section
          aria-label="Pilot overview"
          className="magic-card space-y-4 p-5"
        >
          <h2 className="text-xl font-bold">
            {query.rep || "Pilot overview"} · {rows.length}{" "}
            {rows.length === 1 ? "call" : "calls"}
          </h2>
          <dl className="grid gap-4 sm:grid-cols-3">
            {[
              [
                "Median time cast stayed",
                medianClock(
                  rows.flatMap((r) =>
                    r.summary.attendance === null ? [] : [r.summary.attendance],
                  ),
                ),
              ],
              [
                "Calls with a marked pullback",
                String(pullbackTimes.length) + " of " + rows.length,
              ],
              [
                "Median time from pullback to call end",
                medianClock(pullbackTimes),
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-sm text-slate-600">{label}</dt>
                <dd className="text-2xl font-bold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-sm text-slate-600">
            Times are minutes and seconds. Pullback timing runs from the cast
            member’s first sign of reluctance to the end of the meeting.
          </p>
        </section>
        {query.changed && (
          <p role="status">
            This call changed. Review its latest mark before saving.
          </p>
        )}
        <form className="flex flex-wrap items-center gap-3">
          <label htmlFor="rep">Rep</label>
          <select
            id="rep"
            name="rep"
            defaultValue={query.rep || ""}
            className="min-h-11 rounded-lg border bg-white px-3"
          >
            <option value="">All reps</option>
            {reps.map((rep) => (
              <option key={rep}>{rep}</option>
            ))}
          </select>
          <button className="min-h-11 px-3 font-semibold text-red-700">
            Filter
          </button>
        </form>
        {rows.length === 0 && <p>No pilot calls in this view.</p>}
        {rows.map((row) => {
          const s = row.summary;
          const cue = row.review ? row.review.signal : s.signal;
          const date = new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "numeric",
            timeZone: "America/New_York",
          }).format(new Date(s.date));
          return (
            <article
              key={row.occurrence}
              id={"call-" + row.occurrence}
              className="magic-card space-y-4 p-5 sm:p-6"
            >
              <header>
                <h2 className="text-xl font-bold">{s.cast}</h2>
                <p className="text-sm text-slate-600">
                  {s.rep} · {s.show} · {date}
                </p>
              </header>
              <dl className="flex flex-wrap gap-x-8 gap-y-3">
                {[
                  ["Call length", clock(s.total)],
                  [
                    "Cast present",
                    s.attendance === null ? "Unverified" : clock(s.attendance),
                  ],
                  [
                    "Time from pullback to call end",
                    cue ? clock(s.total - cue.at) : "—",
                  ],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-sm text-slate-600">{label}</dt>
                    <dd className="text-lg font-semibold tabular-nums">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
              {cue ? (
                <div>
                  <h3 className="text-sm font-semibold">
                    Cast’s first sign of reluctance
                  </h3>
                  <blockquote className="border-l-2 border-red-300 pl-3">
                    <span className="mr-2 font-semibold tabular-nums">
                      {clock(cue.at)}
                    </span>
                    “{cue.text}”
                  </blockquote>
                  <h3 className="mt-3 text-sm font-semibold">
                    Rep’s next reply
                  </h3>
                  {row.reply ? (
                    <blockquote className="border-l-2 border-slate-300 pl-3">
                      “{row.reply}”
                    </blockquote>
                  ) : (
                    <p>
                      The transcript does not identify a rep reply at this
                      moment. Listen to the exchange to review it.
                    </p>
                  )}
                </div>
              ) : (
                <p>No pullback heard.</p>
              )}
              <p className="text-sm text-slate-700">
                <strong>Call outcome</strong> · {s.outcome}
              </p>
              <form action={saveMark} className="space-y-2 border-t pt-3">
                <input type="hidden" name="id" value={row.occurrence} />
                <input type="hidden" name="digest" value={row.digest} />
                <input type="hidden" name="revision" value={row.revision} />
                <input type="hidden" name="cue" value={cue?.id ?? "none"} />
                <input type="hidden" name="rep" value={query.rep || ""} />
                <fieldset>
                  <legend className="font-semibold">
                    {cue
                      ? "Was this the first moment cast started to pull back?"
                      : "Did you hear cast pull back?"}
                  </legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(cue
                      ? [
                          ["right", "Right moment"],
                          ["early", "Marked too early"],
                          ["late", "Marked too late"],
                          ["none", "No pullback"],
                        ]
                      : [
                          ["none", "No pullback"],
                          ["missed", "I heard a pullback"],
                        ]
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="submit"
                        name="feedback"
                        value={value}
                        aria-pressed={row.review?.feedback === value}
                        className="min-h-10 rounded-lg border px-3 text-sm aria-pressed:bg-slate-900 aria-pressed:text-white"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </fieldset>
                {query.saved === row.occurrence && (
                  <p role="status">Feedback saved.</p>
                )}
              </form>
              <div className="flex flex-wrap gap-x-6">
                <Player
                  key={String(cue?.id ?? "none")}
                  occurrence={row.occurrence}
                  start={Math.max(0, (cue?.playback ?? 0) - 3)}
                  marked={Boolean(cue)}
                />
                <Link
                  prefetch={false}
                  href={
                    path +
                    "?" +
                    new URLSearchParams({
                      edit: row.occurrence,
                      ...(query.rep ? { rep: query.rep } : {}),
                    }) +
                    "#review"
                  }
                  className="inline-flex min-h-11 items-center text-slate-700 underline"
                >
                  Choose a different transcript line
                </Link>
              </div>
              {editing?.occurrence === row.occurrence && (
                <form
                  id="review"
                  action={saveMark}
                  className="space-y-2 border-t pt-4"
                >
                  <input type="hidden" name="id" value={row.occurrence} />
                  <input type="hidden" name="digest" value={row.digest} />
                  <input type="hidden" name="revision" value={row.revision} />
                  <input type="hidden" name="rep" value={query.rep || ""} />
                  <label className="block font-semibold" htmlFor="cue">
                    First signal from cast
                  </label>
                  <select
                    id="cue"
                    name="cue"
                    className="min-h-11 w-full rounded-lg border bg-white px-2"
                    defaultValue={cue?.id ?? "none"}
                  >
                    <option value="none">No pullback heard</option>
                    {options.map((c) => (
                      <option key={c.id} value={c.id}>
                        {clock(c.at)} · {c.text}
                      </option>
                    ))}
                  </select>
                  <button className="min-h-11 rounded-lg bg-slate-900 px-4 font-medium text-white">
                    Save review
                  </button>
                </form>
              )}
            </article>
          );
        })}
      </div>
    </main>
  );
}

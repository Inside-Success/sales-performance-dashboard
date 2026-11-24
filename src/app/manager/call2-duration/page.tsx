import React from "react";
import type { Metadata } from "next";
import { calls, clock, medianClock, timeWithCast } from "./data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Call 2 Cast Tracker | Magic Mike",
  robots: { index: false, follow: false },
};

function RepReply({ saved }: { saved: string }) {
  // Some Zoom transcripts assign the video's welcome to the rep. Require
  // both the live handoff and the presentation opening before cutting a turn.
  const reply = saved.split(/(?<=play the video for you[.!?])\s+(?=hello,? welcome back\b)/i, 1)[0];
  const quoteClass = "border-l-2 border-slate-300 pl-3";
  if (reply.length <= 180) {
    return <blockquote className={quoteClass}>“{reply}”</blockquote>;
  }

  const prefix = reply.slice(0, 180);
  const sentenceEnd = Array.from(prefix.matchAll(/[.!?](?=\s)/g)).find(
    (match) => match.index >= 60,
  )?.index;
  const cut = sentenceEnd !== undefined && sentenceEnd >= 60
    ? sentenceEnd + 1
    : prefix.lastIndexOf(" ");
  const preview = reply.slice(0, cut > 0 ? cut : 180);
  return (
    <div className="group/reply">
      <blockquote className={quoteClass + " group-has-[details[open]]/reply:hidden"}>
        “{preview}{sentenceEnd === undefined ? "…" : ""}”
      </blockquote>
      <details className="group">
        <summary className="w-fit cursor-pointer py-1 text-sm font-semibold text-red-700 underline">
          <span className="group-open:hidden">Show full reply</span>
          <span className="hidden group-open:inline">Show less</span>
        </summary>
        <blockquote className={quoteClass}>“{reply}”</blockquote>
      </details>
    </div>
  );
}

export default async function CallTiming({
  searchParams,
}: {
  searchParams: Promise<{
    rep?: string;
  }>;
}) {
  const [all, query] = await Promise.all([calls(), searchParams]);
  const reps = [...new Set(all.map((row) => row.summary.rep))].sort();
  const rows = all.filter((row) => !query.rep || row.summary.rep === query.rep);
  const times = rows.map(timeWithCast).filter((seconds) => seconds !== null);
  const marked = rows.filter((row) => (row.review ?? row.summary).signal).length;
  return (
    <main className="magic-page">
      <div className="mx-auto max-w-4xl space-y-5 px-4 py-8 sm:px-8">
        <header>
          <h1 className="text-3xl font-extrabold text-slate-950">
            Call 2 Cast Tracker
          </h1>
          <p className="mt-2 text-slate-600">
            Call 2 pilot · See how long each rep stayed with the cast member after their first objection.
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
          <dl className="grid gap-4 sm:grid-cols-2">
            {[
              ["Median time reps stayed after an objection", medianClock(times)],
              ["Calls with an objection", marked + " of " + rows.length],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-sm text-slate-600">{label}</dt>
                <dd className="text-2xl font-bold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-sm text-slate-600">
            Time counts only the minutes and seconds both people were on Zoom after the first sign the cast member was reluctant to move forward.
          </p>
        </section>
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
          const shared = timeWithCast(row);
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
                  ...(cue ? [["Rep time with cast after objection", shared === null ? "Unverified" : clock(shared)]] : []),
                  ["Call length", clock(s.total)],
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
                    Cast’s first sign of an objection
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
                    <RepReply saved={row.reply} />
                  ) : (
                    <p>
                      The transcript does not identify a rep reply at this
                      moment.
                    </p>
                  )}
                </div>
              ) : (
                <p>No objection identified.</p>
              )}
              <p className="text-sm text-slate-700">
                <strong>Call outcome</strong> · {s.outcome}
              </p>
              {(row.transcript_doc_id || row.verified_recording_url) && (
                <div className="flex flex-wrap gap-x-6">
                  {row.transcript_doc_id && (
                    <a
                      className="inline-flex min-h-11 items-center text-red-700 underline"
                      href={`https://docs.google.com/document/d/${encodeURIComponent(row.transcript_doc_id)}/edit`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open transcript
                    </a>
                  )}
                  {row.verified_recording_url && (
                    <a
                      className="inline-flex min-h-11 items-center text-red-700 underline"
                      href={row.verified_recording_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Watch Zoom recording
                    </a>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </main>
  );
}

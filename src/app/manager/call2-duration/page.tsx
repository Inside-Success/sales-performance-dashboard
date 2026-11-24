import { TranscriptEvidence } from "@/components/dashboard/transcript-evidence";
import React from "react";
import type { Metadata } from "next";
import { calls, clock, PAGE_SIZE, timeWithCast } from "./data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Call 2 Rep Tracker | Magic Mike",
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
    page?: string;
  }>;
}) {
  const query = await searchParams;
  const page = /^\d{1,6}$/.test(query.page ?? "") ? Math.max(1, Number(query.page)) : 1;
  const { rows, reps, total, measured, median } = await calls(query.rep, page);
  const building = Boolean(query.rep) && measured < 10;
  const pageHref = (n: number) => "?" + new URLSearchParams({ rep: query.rep ?? "", page: String(n) });
  return (
    <main className="magic-page">
      <div className="mx-auto max-w-4xl space-y-5 px-4 py-8 sm:px-8">
        <header>
          <h1 className="text-3xl font-extrabold text-slate-950">
            Call 2 Rep Tracker
          </h1>
          <p className="mt-2 text-slate-600">
            How long each rep stayed on the call after the cast member raised a clear objection.
          </p>
        </header>
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
          <button type="submit" className="min-h-11 cursor-pointer rounded-lg bg-red-700 px-5 font-semibold text-white hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700">
            Apply
          </button>
        </form>
        <section
          aria-label="Call overview"
          className="magic-card space-y-4 p-5"
        >
          <h2 className="text-xl font-bold">
            {query.rep || "Team overview"} · {total}{" "}
            {total === 1 ? "call" : "calls"}
          </h2>
          <dl className="grid gap-4 sm:grid-cols-2">
            {[
              ["Median rep time after an objection", building ? "Building sample" : median === null ? "—" : clock(median)],
              ["Calls with a measured objection", measured + " of " + total],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-sm text-slate-600">{label}</dt>
                <dd className="text-2xl font-bold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-sm text-slate-600">
            {building ? "The median appears after 10 calls with a measured objection." : "Rep time starts at the first clear objection and counts only the time both people were on Zoom."}
          </p>
        </section>
        {rows.length === 0 && <p>No calls on this page.</p>}
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
                <h2 className="text-xl font-bold">{s.rep}</h2>
                <p className="text-sm text-slate-600">
                  Call with {s.cast} · {s.show} · {date}
                </p>
              </header>
              <dl className="flex flex-wrap gap-x-8 gap-y-3">
                {[
                  ...(cue ? [["Time the rep stayed after the objection", shared === null ? "Unverified" : clock(shared)]] : []),
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
              {row.transcript_doc_id && !cue && (
                <TranscriptEvidence evidence={[]} reportType="call2" reportId={row.occurrence} transcriptUrl={`https://docs.google.com/document/d/${encodeURIComponent(row.transcript_doc_id)}/edit`} />
              )}
              {cue ? (
                <div>
                  <h3 className="text-sm font-semibold">
                    Cast member’s first clear objection
                  </h3>
                  <blockquote className="border-l-2 border-red-300 pl-3">
                    <span className="mr-2 font-semibold tabular-nums">
                      {clock(cue.at)}
                    </span>
                    “{cue.text}”
                  </blockquote>
                  {row.transcript_doc_id && (
                    <TranscriptEvidence quote={cue.text} evidence={[clock(cue.at)]} reportType="call2" reportId={row.occurrence} transcriptUrl={`https://docs.google.com/document/d/${encodeURIComponent(row.transcript_doc_id)}/edit`} />
                  )}
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
        {(page > 1 || page * PAGE_SIZE < total) && (
          <nav aria-label="Call pages" className="flex gap-6">
            {page > 1 && <a className="text-red-700 underline" href={pageHref(page - 1)}>Newer calls</a>}
            {page * PAGE_SIZE < total && <a className="text-red-700 underline" href={pageHref(page + 1)}>Older calls</a>}
          </nav>
        )}
      </div>
    </main>
  );
}

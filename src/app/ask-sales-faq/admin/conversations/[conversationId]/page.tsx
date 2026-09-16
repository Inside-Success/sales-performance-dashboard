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
import { getConversation, getReview } from "@/lib/ask-sales-faq/admin/store";
import {
  AdminLayout,
  LoadError,
} from "@/components/ask-sales-faq/admin/layout";
import { AnswerMarkdown } from "@/components/ask-sales-faq/answer-markdown";
import { ReviewForm } from "@/components/ask-sales-faq/admin/review-form";
import { formatMiamiDateTime } from "@/lib/format";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Conversation review | Magic Mike Bot",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ conversationId: string }>;
  searchParams: Promise<Params>;
}) {
  const access = getAskSalesFaqAccess(await auth());
  if (!access.ok || !isAskSalesFaqAdmin(access.viewerEmail)) notFound();
  const { conversationId } = await params;
  const f = parseFilters(await searchParams);
  let data, review;
  try {
    [data, review] = await Promise.all([
      getConversation(conversationId),
      getReview(conversationId),
    ]);
  } catch {
    return (
      <AdminLayout active="conversations">
        <LoadError />
      </AdminLayout>
    );
  }
  if (!data) notFound();
  const through =
    data.messages
      .map((m) => m.event_at)
      .sort()
      .at(-1) || new Date().toISOString();
  const reviewed = Boolean(
    review?.reviewed &&
      Date.parse(review.reviewed_through) >= Date.parse(through),
  );
  return (
    <AdminLayout active="conversations">
      <Link
        className="text-sm font-semibold text-red-700"
        href={`/ask-sales-faq/admin?${filterQuery(f)}`}
      >
        ← Back to conversations
      </Link>
      <header>
        <h2 className="text-xl font-bold">
          {data.conversation.name || data.conversation.email}
        </h2>
        <p className="mt-1 break-words text-sm text-slate-500">
          {data.conversation.title}
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Full conversation, including messages outside the selected date range.
          Sensitive information may have been redacted when saved.
        </p>
      </header>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-label="Full conversation" className="min-w-0 space-y-4">
          {data.messages.map((m) => (
            <article
              key={m.id}
              className={`min-w-0 rounded-2xl border p-5 ${m.role === "user" ? "ml-4 bg-slate-100" : "bg-white"}`}
            >
              <div className="mb-3 flex flex-wrap justify-between gap-2 text-xs">
                <strong>
                  {m.role === "user"
                    ? data.conversation.name || "User"
                    : m.role === "assistant"
                      ? "Ask Sales"
                      : "System notice"}
                </strong>
                <time className="text-slate-500">
                  {formatMiamiDateTime(m.date)}
                </time>
              </div>
              <AnswerMarkdown text={m.text} />
              {m.failed && (
                <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                  {m.error_class?.includes("timeout")
                    ? "The response timed out."
                    : "The response encountered a technical problem."}
                </p>
              )}
              {m.unanswered && (
                <p className="mt-3 text-sm text-amber-900">
                  The bot could not fully answer this question. Review the
                  context before deciding whether that was appropriate.
                </p>
              )}
              {m.rating && (
                <p className="mt-3 border-t pt-3 text-sm">
                  {m.rating === "up"
                    ? "👍 Marked helpful"
                    : "👎 Marked unhelpful"}
                  {m.comment && ` — ${m.comment}`}
                </p>
              )}
              {m.source !== null &&
                typeof m.source === "object" &&
                "expandableDetails" in m.source &&
                typeof m.source.expandableDetails === "string" && (
                  <details className="mt-3 rounded-lg border p-3">
                    <summary className="cursor-pointer text-sm font-semibold">
                      Sources
                    </summary>
                    <div className="mt-3">
                      <AnswerMarkdown text={m.source.expandableDetails} />
                    </div>
                  </details>
                )}
              {m.source_label && (
                <p className="mt-3 text-xs text-slate-500">
                  Source: {m.source_label}
                </p>
              )}
              {m.role === "assistant" && (
                <details className="mt-3 text-xs text-slate-500">
                  <summary className="cursor-pointer">
                    Technical details
                  </summary>
                  <dl className="mt-2 space-y-1">
                    <div>Model: {m.model || "Not recorded"}</div>
                    <div>
                      Response time:{" "}
                      {m.latency_ms === null
                        ? "Not recorded"
                        : `${(m.latency_ms / 1000).toFixed(1)} seconds`}
                    </div>
                    {m.error_class && <div>Error: {m.error_class}</div>}
                  </dl>
                </details>
              )}
            </article>
          ))}
        </section>
        <aside className="rounded-2xl border bg-white p-5 lg:sticky lg:top-4">
          <h2 className="mb-4 font-bold">Internal review</h2>
          <ReviewForm
            key={`${review?.version || 0}-${through}`}
            id={conversationId}
            version={review?.version || 0}
            reviewed={reviewed}
            note={review?.note || ""}
            through={through}
          />
          {review && (
            <p className="mt-3 break-words text-xs text-slate-500">
              Last saved by {review.actor} ·{" "}
              {formatMiamiDateTime(review.updated_at)}
            </p>
          )}
        </aside>
      </div>
    </AdminLayout>
  );
}

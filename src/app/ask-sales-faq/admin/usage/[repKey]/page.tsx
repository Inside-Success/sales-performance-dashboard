import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  History,
  MessageCircleQuestion,
  Route,
  ShieldAlert,
  ThumbsDown,
} from "lucide-react";
import { auth } from "@/auth";
import { AskSalesAdminHeader } from "@/components/ask-sales-faq/admin-navigation";
import { Badge } from "@/components/ui/badge";
import { normalizeAskSalesFaqAnalyticsDays } from "@/lib/ask-sales-faq/admin-analytics";
import {
  decodeAskSalesFaqRepHistoryCursor,
  isAskSalesFaqRepReviewKey,
  normalizeAskSalesFaqRepHistoryDays,
} from "@/lib/ask-sales-faq/admin-rep-review";
import { getAskSalesFaqAccess, isAskSalesFaqAdmin } from "@/lib/ask-sales-faq/access";
import type { AskSalesFaqRepHistoryItem } from "@/lib/ask-sales-faq/types";
import { getAskSalesFaqRepHistory, getAskSalesFaqUsageOverview } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ask Sales Rep Q&A Review | Magic Mike Bot",
  robots: { index: false, follow: false },
};

export default async function AskSalesFaqRepHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ repKey: string }>;
  searchParams: Promise<{
    days?: string | string[];
    cursor?: string | string[];
    returnDays?: string | string[];
  }>;
}) {
  const session = await auth();
  const access = getAskSalesFaqAccess(session);
  if (!access.ok || !isAskSalesFaqAdmin(access.viewerEmail)) notFound();

  const { repKey } = await params;
  if (!isAskSalesFaqRepReviewKey(repKey)) notFound();

  const query = await searchParams;
  const rawCursor = firstValue(query.cursor);
  const cursor = decodeAskSalesFaqRepHistoryCursor(rawCursor);
  if (rawCursor && !cursor) notFound();

  const windowDays = normalizeAskSalesFaqRepHistoryDays(query.days);
  const returnDays = normalizeAskSalesFaqAnalyticsDays(query.returnDays, 30);
  const usage = await getAskSalesFaqUsageOverview(returnDays);
  const rep = usage.users.find((user) => user.repReviewKey === repKey);
  if (!rep) notFound();

  const history = await getAskSalesFaqRepHistory(rep.viewerEmail, {
    viewerName: rep.viewerName,
    windowDays,
    cursor,
    limit: 25,
  });
  if (!history) notFound();

  const windowLabel = windowDays ? `Last ${windowDays} days` : "All time";
  const name = rep.viewerName || rep.viewerEmail;

  return (
    <main className="magic-page min-h-[calc(100dvh-72px)] bg-[#f8fafc]">
      <div className="mx-auto flex w-full max-w-[88rem] flex-col gap-5 px-5 pb-16 pt-8 sm:px-8">
        <AskSalesAdminHeader
          active="usage"
          title="Rep Q&A review"
          description={`Read-only Ask Sales question and answer history for ${name}. This audit remains separate from Coaching usage and does not alter chatbot data.`}
          generatedAt={history.generatedAt}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={`/ask-sales-faq/admin/usage?days=${returnDays}`}
            className="inline-flex h-9 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700"
          >
            <ArrowLeft className="size-4" />
            Back to rep adoption
          </Link>
          <WindowPicker repKey={repKey} activeDays={windowDays} returnDays={returnDays} />
        </div>

        <section className="magic-card p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-red-600">Admin-only identity</p>
              <h2 className="mt-2 text-xl font-extrabold text-slate-950">{name}</h2>
              <p className="mt-1 text-sm text-slate-500">{rep.viewerEmail}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="border-slate-200 bg-slate-50">{windowLabel}</Badge>
              <Badge variant="outline" className="border-slate-200 bg-slate-50">{rep.questionsAllTime} all-time question{rep.questionsAllTime === 1 ? "" : "s"}</Badge>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard icon={MessageCircleQuestion} label="Questions" value={history.summary.questions} helper={windowLabel} />
          <MetricCard icon={CheckCircle2} label="Grounded answers" value={history.summary.groundedAnswers} helper="Approved policy or governed evidence" tone="good" />
          <MetricCard icon={Route} label="Safe routes" value={history.summary.routes} helper="Routed instead of guessed" tone={history.summary.routes ? "warning" : "default"} />
          <MetricCard icon={ShieldAlert} label="Runtime failures" value={history.summary.failures} helper="Technical or protected-state outcomes" tone={history.summary.failures ? "warning" : "good"} />
          <MetricCard icon={ThumbsDown} label="Feedback" value={`${history.summary.thumbsDown}/${history.summary.feedbackCount}`} helper="Thumbs down / all submitted" tone={history.summary.thumbsDown ? "warning" : "good"} />
        </section>

        <section className="magic-card overflow-hidden">
          <div className="border-b border-slate-100 p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-extrabold text-slate-950">Question and answer history</h2>
                <p className="mt-1 text-sm text-slate-500">Newest first. Each answer includes its stored route, source, validation, provider, latency, feedback, and V3 stage timing context when available.</p>
              </div>
              <Badge variant="outline" className="w-fit border-slate-200 bg-slate-50">Up to 25 per page</Badge>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {history.items.length ? history.items.map((item, index) => (
              <HistoryItem key={item.id} item={item} number={index + 1} />
            )) : (
              <div className="p-8 text-center">
                <History className="mx-auto size-8 text-slate-300" />
                <p className="mt-3 text-sm font-bold text-slate-700">No saved questions in this window.</p>
                <p className="mt-1 text-xs text-slate-500">Choose All time to review every retained Ask Sales exchange for this user.</p>
              </div>
            )}
          </div>
        </section>

        <Pagination
          repKey={repKey}
          windowDays={windowDays}
          returnDays={returnDays}
          currentCursor={rawCursor}
          nextCursor={history.nextCursor}
        />

        <p className="pb-2 text-xs font-medium text-slate-400">
          This page reads redacted content already retained in Neon. It does not write to conversations, feedback, Slack, Sheets, n8n, or the Coaching usage system.
        </p>
      </div>
    </main>
  );
}

function WindowPicker({ repKey, activeDays, returnDays }: { repKey: string; activeDays: 7 | 30 | 90 | null; returnDays: number }) {
  const windows: Array<{ value: "all" | 7 | 30 | 90; label: string }> = [
    { value: "all", label: "All" },
    { value: 7, label: "7d" },
    { value: 30, label: "30d" },
    { value: 90, label: "90d" },
  ];

  return (
    <div className="flex rounded-full border border-slate-200 bg-white p-1 shadow-sm" aria-label="Question history window">
      {windows.map((window) => {
        const active = window.value === "all" ? activeDays === null : activeDays === window.value;
        return (
          <Link
            key={window.value}
            href={`/ask-sales-faq/admin/usage/${repKey}?days=${window.value}&returnDays=${returnDays}`}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-3 py-1.5 text-xs font-extrabold transition-colors ${active ? "bg-[#DC2626] text-white" : "text-slate-500 hover:bg-slate-100"}`}
          >
            {window.label}
          </Link>
        );
      })}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, helper, tone = "default" }: { icon: typeof History; label: string; value: string | number; helper: string; tone?: "default" | "good" | "warning" }) {
  const iconTone = tone === "good" ? "bg-emerald-50 text-emerald-600" : tone === "warning" ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600";
  return (
    <article className="magic-card p-4">
      <div className="flex items-center justify-between gap-3"><span className="text-sm font-bold text-slate-600">{label}</span><span className={`grid size-9 place-items-center rounded-xl ${iconTone}`}><Icon className="size-4" /></span></div>
      <p className="mt-4 text-3xl font-extrabold text-slate-950">{value}</p>
      <p className="mt-2 text-xs font-medium leading-5 text-slate-500">{helper}</p>
    </article>
  );
}

function HistoryItem({ item, number }: { item: AskSalesFaqRepHistoryItem; number: number }) {
  const outcomeTone = item.errorClass
    ? "border-red-200 bg-red-50 text-red-700"
    : item.needsRoute
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <article className="p-5 md:p-6">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-extrabold text-slate-400">#{number}</span>
        <Badge variant="outline" className={outcomeTone}>{humanize(item.outcome || "answer")}</Badge>
        {item.conversationStatus !== "active" ? <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">Conversation {item.conversationStatus}</Badge> : null}
        {item.feedback ? <Badge variant="outline" className={item.feedback.rating === "down" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}>Thumbs {item.feedback.rating}</Badge> : null}
        <span className="inline-flex items-center gap-1 text-slate-400"><Clock3 className="size-3.5" />{formatDateTime(item.createdAt)}</span>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <ContentBlock label="Question" value={item.question || "Question text was not available for this retained answer."} />
        <ContentBlock label="Answer" value={item.answer} />
      </div>

      {item.feedback?.comment ? (
        <div className="mt-5 rounded-xl border border-red-100 bg-red-50/70 p-4">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-red-600">Rep feedback</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{item.feedback.comment}</p>
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs sm:grid-cols-2 xl:grid-cols-4">
        <Meta label="Source" value={item.sourceLabel || item.sourceMode || "—"} />
        <Meta label="Provider / model" value={item.provider ? `${item.provider}${item.model ? ` / ${item.model}` : ""}` : "—"} />
        <Meta label="Latency" value={formatSeconds(item.latencyMs)} />
        <Meta label="Validation" value={item.validationVerdict || "—"} />
        <Meta label="Confidence" value={typeof item.confidenceScore === "number" ? `${item.confidenceScore}% (${item.confidenceLabel || "unlabeled"})` : item.confidenceLabel || "—"} />
        <Meta label="Pipeline" value={item.pipelineVersion || "—"} />
        <Meta label="Selected policies" value={String(item.selectedPolicyCount)} />
        <Meta label="Source reviewed" value={item.sourceLastReviewed || "—"} />
      </div>

      {item.routeReason || item.errorClass ? (
        <div className="mt-4 space-y-2 text-sm text-slate-600">
          {item.routeReason ? <p><strong className="text-slate-800">Route reason:</strong> {item.routeReason}</p> : null}
          {item.errorClass ? <p><strong className="text-red-700">Error class:</strong> {item.errorClass}</p> : null}
        </div>
      ) : null}

      {item.stageTimings ? (
        <details className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
          <summary className="cursor-pointer font-extrabold text-slate-700">V3 stage timings</summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(item.stageTimings).map(([stage, timing]) => (
              <div key={stage} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2"><span>{humanize(stage)}</span><strong>{formatSeconds(timing)}</strong></div>
            ))}
          </div>
        </details>
      ) : null}
    </article>
  );
}

function ContentBlock({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-400">{label}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">{value}</p></div>;
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div><p className="font-bold uppercase tracking-[0.1em] text-slate-400">{label}</p><p className="mt-1 break-words font-semibold text-slate-700">{value}</p></div>;
}

function Pagination({ repKey, windowDays, returnDays, currentCursor, nextCursor }: { repKey: string; windowDays: 7 | 30 | 90 | null; returnDays: number; currentCursor: string | null; nextCursor: string | null }) {
  if (!currentCursor && !nextCursor) return null;
  const days = windowDays || "all";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {currentCursor ? <Link href={`/ask-sales-faq/admin/usage/${repKey}?days=${days}&returnDays=${returnDays}`} className="inline-flex h-9 items-center rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">Back to newest</Link> : <span />}
      {nextCursor ? <Link href={`/ask-sales-faq/admin/usage/${repKey}?days=${days}&returnDays=${returnDays}&cursor=${encodeURIComponent(nextCursor)}`} className="inline-flex h-9 items-center rounded-full bg-slate-950 px-4 text-sm font-extrabold text-white transition-colors hover:bg-red-700">Older questions</Link> : null}
    </div>
  );
}

function firstValue(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] || null : value || null; }
function formatSeconds(ms: number) { return ms ? `${(ms / 1000).toFixed(ms >= 10_000 ? 0 : 1)}s` : "—"; }
function formatDateTime(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date); }
function humanize(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase()); }

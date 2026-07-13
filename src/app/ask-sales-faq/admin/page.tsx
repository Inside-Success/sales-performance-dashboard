import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  Activity,
  Bot,
  CheckCircle2,
  Clock3,
  Gauge,
  MessageCircleWarning,
  Route,
  ShieldAlert,
  ThumbsDown,
} from "lucide-react";
import { auth } from "@/auth";
import { AskSalesAdminHeader } from "@/components/ask-sales-faq/admin-navigation";
import { Badge } from "@/components/ui/badge";
import { normalizeAskSalesFaqAnalyticsDays, percentOf } from "@/lib/ask-sales-faq/admin-analytics";
import { getAskSalesFaqAccess, isAskSalesFaqAdmin } from "@/lib/ask-sales-faq/access";
import type { AskSalesFaqAdminLogItem } from "@/lib/ask-sales-faq/types";
import { getAskSalesFaqAdminOverview } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ask Sales Quality & Operations | Magic Mike Bot",
  robots: { index: false, follow: false },
};

export default async function AskSalesFaqAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string | string[] }>;
}) {
  const session = await auth();
  const access = getAskSalesFaqAccess(session);

  if (!access.ok) return <AccessBlock message={access.message} />;
  if (!isAskSalesFaqAdmin(access.viewerEmail)) {
    return <AccessBlock message="This page is limited to Ask Sales administrators." />;
  }

  const days = normalizeAskSalesFaqAnalyticsDays((await searchParams).days, 7);
  const overview = await getAskSalesFaqAdminOverview(18, days);
  const { summary } = overview;
  const groundedRate = percentOf(summary.groundedAnswers, summary.questions);
  const routeRate = percentOf(summary.routes, summary.questions);
  const deepseekRate = percentOf(summary.deepseekAnswers, summary.deepseekAnswers + summary.anthropicAnswers);
  const negativeFeedbackRate = percentOf(summary.thumbsDown, summary.feedbackCount);

  return (
    <main className="magic-page min-h-[calc(100dvh-72px)] bg-[#f8fafc]">
      <div className="mx-auto flex w-full max-w-[88rem] flex-col gap-5 px-5 pb-16 pt-8 sm:px-8">
        <AskSalesAdminHeader
          active="quality"
          title="Quality & operations"
          description="Monitor grounded answers, safe routes, feedback, provider health, and the small set of exchanges that genuinely need investigation."
          generatedAt={overview.generatedAt}
        />

        <WindowPicker activeDays={overview.windowDays} baseHref="/ask-sales-faq/admin" />

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard icon={Activity} label={`Questions, ${days}d`} value={summary.questions} helper="Saved assistant exchanges in the selected window." />
          <MetricCard icon={CheckCircle2} label="Grounded answer rate" value={`${groundedRate}%`} helper={`${summary.groundedAnswers} evidence or approved-policy answers.`} tone="good" />
          <MetricCard icon={Route} label="Safe routes" value={summary.routes} helper={`${routeRate}% of exchanges were routed instead of guessed.`} tone={summary.routes ? "warning" : "default"} />
          <MetricCard icon={Clock3} label="Response time" value={formatSeconds(summary.medianLatencyMs)} helper={`Median; ${formatSeconds(summary.p95LatencyMs)} at p95.`} />
          <MetricCard icon={Bot} label="DeepSeek primary" value={`${deepseekRate}%`} helper={`${summary.anthropicAnswers} Claude fallback answer${summary.anthropicAnswers === 1 ? "" : "s"}.`} tone="good" />
          <MetricCard icon={ThumbsDown} label="Negative feedback" value={`${summary.thumbsDown}/${summary.feedbackCount}`} helper={`${negativeFeedbackRate}% of submitted feedback was negative.`} tone={summary.thumbsDown ? "warning" : "good"} />
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(22rem,0.6fr)]">
          <TrendPanel daily={overview.daily} />
          <OutcomePanel
            grounded={summary.groundedAnswers}
            conversation={summary.conversationReplies}
            routes={summary.routes}
            failures={summary.failures}
            reviewItems={summary.reviewItems}
            outcomes={overview.outcomes}
          />
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
          <LogPanel
            title="Investigation queue"
            description="Only negative feedback, safe routes, coverage boundaries, and runtime failures appear here. Successful V3 evidence answers are no longer treated as misses."
            icon={<MessageCircleWarning className="size-5" />}
            items={overview.recentMisses}
            emptyText="No recent exchanges require investigation."
            mode="review"
          />
          <LogPanel
            title="Recent feedback"
            description="Rep ratings and comments, kept separate from automatic runtime classification."
            icon={<ThumbsDown className="size-5" />}
            items={overview.recentFeedback}
            emptyText="No feedback has been recorded yet."
            mode="feedback"
          />
        </section>

        <LogPanel
          title="Recent answer audit"
          description="A compact trace of the latest decisions, including source mode, V3 validation, policies selected, latency, provider, and model. Confidence is shown on its correct 0–100 scale."
          icon={<Gauge className="size-5" />}
          items={overview.recentAnswers}
          emptyText="No answers have been logged yet."
          mode="answer"
          compact
        />

        <p className="pb-2 text-xs font-medium text-slate-400">
          Grounded rate measures observed answer mode, not independently reviewed factual accuracy. Feedback coverage and the investigation queue remain the human quality signals.
        </p>
      </div>
    </main>
  );
}

function AccessBlock({ message }: { message: string }) {
  return (
    <main className="magic-page grid min-h-[calc(100dvh-72px)] place-items-center bg-[#f8fafc] px-4 py-6">
      <section className="magic-card w-full max-w-xl p-6">
        <span className="mb-4 grid size-10 place-items-center rounded-xl bg-red-50 text-red-600"><ShieldAlert className="size-5" /></span>
        <h1 className="text-2xl font-extrabold text-slate-950">Ask Sales administration</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{message}</p>
      </section>
    </main>
  );
}

function WindowPicker({ activeDays, baseHref }: { activeDays: number; baseHref: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm font-semibold text-slate-500">Reporting window</p>
      <div className="flex rounded-full border border-slate-200 bg-white p-1 shadow-sm">
        {[7, 30, 90].map((days) => (
          <Link
            key={days}
            href={`${baseHref}?days=${days}`}
            className={`rounded-full px-3 py-1.5 text-xs font-extrabold transition-colors ${activeDays === days ? "bg-[#DC2626] text-white" : "text-slate-500 hover:bg-slate-100"}`}
          >
            {days} days
          </Link>
        ))}
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, helper, tone = "default" }: { icon: typeof Activity; label: string; value: string | number; helper: string; tone?: "default" | "good" | "warning" }) {
  const iconTone = tone === "good" ? "bg-emerald-50 text-emerald-600" : tone === "warning" ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600";
  return (
    <article className="magic-card p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-bold text-slate-600">{label}</span>
        <span className={`grid size-9 place-items-center rounded-xl ${iconTone}`}><Icon className="size-4" /></span>
      </div>
      <p className="mt-4 text-3xl font-extrabold text-slate-950">{value}</p>
      <p className="mt-2 text-xs font-medium leading-5 text-slate-500">{helper}</p>
    </article>
  );
}

function TrendPanel({ daily }: { daily: Array<{ day: string; questions: number; groundedAnswers: number; routes: number; failures: number }> }) {
  const max = Math.max(1, ...daily.map((point) => point.questions));
  return (
    <section className="magic-card overflow-hidden">
      <div className="border-b border-slate-100 p-5">
        <h2 className="text-lg font-extrabold text-slate-950">Daily answer flow</h2>
        <p className="mt-1 text-sm text-slate-500">Volume and outcome mix across the selected period.</p>
      </div>
      <div className="space-y-3 p-5">
        {daily.map((point) => (
          <div key={point.day} className="grid grid-cols-[4.5rem_minmax(0,1fr)_3rem] items-center gap-3">
            <span className="text-xs font-semibold text-slate-500">{formatDay(point.day)}</span>
            <div className="flex h-3 overflow-hidden rounded-full bg-slate-100" title={`${point.questions} questions; ${point.groundedAnswers} grounded; ${point.routes} routed; ${point.failures} failures`}>
              <span className="bg-emerald-500" style={{ width: `${(point.groundedAnswers / max) * 100}%` }} />
              <span className="bg-amber-400" style={{ width: `${(point.routes / max) * 100}%` }} />
              <span className="bg-red-500" style={{ width: `${(point.failures / max) * 100}%` }} />
              <span className="bg-slate-300" style={{ width: `${(Math.max(0, point.questions - point.groundedAnswers - point.routes - point.failures) / max) * 100}%` }} />
            </div>
            <span className="text-right text-xs font-extrabold text-slate-700">{point.questions}</span>
          </div>
        ))}
        <div className="flex flex-wrap gap-4 pt-2 text-xs font-semibold text-slate-500">
          <Legend color="bg-emerald-500" label="Grounded" /><Legend color="bg-amber-400" label="Routed" /><Legend color="bg-red-500" label="Failure" /><Legend color="bg-slate-300" label="Conversation/other" />
        </div>
      </div>
    </section>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className={`size-2 rounded-full ${color}`} />{label}</span>;
}

function OutcomePanel({ grounded, conversation, routes, failures, reviewItems, outcomes }: { grounded: number; conversation: number; routes: number; failures: number; reviewItems: number; outcomes: Array<{ outcome: string; count: number }> }) {
  return (
    <section className="magic-card overflow-hidden">
      <div className="border-b border-slate-100 p-5">
        <h2 className="text-lg font-extrabold text-slate-950">Operational pulse</h2>
        <p className="mt-1 text-sm text-slate-500">Counts remain separate so a safe route is never mistaken for a failure.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 p-5">
        <Pulse label="Grounded" value={grounded} tone="good" /><Pulse label="Conversation" value={conversation} /><Pulse label="Safe routes" value={routes} tone="warning" /><Pulse label="Failures" value={failures} tone={failures ? "danger" : "good"} />
        <div className="col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-3"><span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Needs investigation</span><strong className="text-xl text-slate-950">{reviewItems}</strong></div>
        </div>
        <details className="col-span-2 text-xs text-slate-500">
          <summary className="cursor-pointer font-bold text-slate-600">Exact outcome breakdown</summary>
          <div className="mt-3 space-y-2">{outcomes.map((item) => <div key={item.outcome} className="flex justify-between gap-3"><span>{humanizeOutcome(item.outcome)}</span><strong>{item.count}</strong></div>)}</div>
        </details>
      </div>
    </section>
  );
}

function Pulse({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "good" | "warning" | "danger" }) {
  const color = tone === "good" ? "text-emerald-600" : tone === "warning" ? "text-amber-600" : tone === "danger" ? "text-red-600" : "text-slate-950";
  return <div className="rounded-xl border border-slate-200 p-3"><div className={`text-2xl font-extrabold ${color}`}>{value}</div><div className="mt-1 text-xs font-semibold text-slate-500">{label}</div></div>;
}

function LogPanel({ title, description, icon, items, emptyText, mode, compact = false }: { title: string; description: string; icon: ReactNode; items: AskSalesFaqAdminLogItem[]; emptyText: string; mode: "review" | "feedback" | "answer"; compact?: boolean }) {
  return (
    <section className="magic-card overflow-hidden">
      <div className="border-b border-slate-100 p-5"><div className="flex items-center gap-2"><span className="grid size-9 place-items-center rounded-xl bg-red-50 text-red-600">{icon}</span><h2 className="text-lg font-extrabold text-slate-950">{title}</h2></div><p className="mt-2 text-sm leading-6 text-slate-500">{description}</p></div>
      <div className={compact ? "grid divide-y divide-slate-100 lg:grid-cols-2 lg:divide-x lg:divide-y-0" : "divide-y divide-slate-100"}>
        {items.length ? items.map((item) => <LogItem key={`${mode}-${item.id}`} item={item} mode={mode} compact={compact} />) : <div className="p-6 text-sm text-slate-500">{emptyText}</div>}
      </div>
    </section>
  );
}

function LogItem({ item, mode, compact }: { item: AskSalesFaqAdminLogItem; mode: "review" | "feedback" | "answer"; compact: boolean }) {
  return (
    <article className="min-w-0 p-5">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="outline" className={item.rating === "down" || item.errorClass ? "border-red-200 bg-red-50 text-red-700" : item.needsRoute ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 bg-slate-50 text-slate-700"}>{item.rating ? `Thumbs ${item.rating}` : humanizeOutcome(item.outcome || "answer")}</Badge>
        {item.reviewCategory ? <Badge variant="outline">{item.reviewCategory}</Badge> : null}
        {item.provider ? <Badge variant="outline">{item.provider}{item.model ? ` / ${item.model}` : ""}</Badge> : null}
        <span className="text-slate-400">{formatDateTime(item.createdAt)}</span>
      </div>
      <div className="mt-3 space-y-3">
        <Field label="Rep" value={item.viewerEmail} />
        <Field label="Question" value={item.question} clamp={compact} />
        <Field label="Answer" value={item.answer} clamp />
        {mode !== "feedback" && item.reviewAction ? <Field label="Review next" value={item.reviewAction} /> : null}
        {item.comment ? <Field label="Rep comment" value={item.comment} /> : null}
        {item.routeReason ? <Field label="Route reason" value={item.routeReason} /> : null}
        <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-slate-500">
          {item.sourceMode ? <span>Source: {item.sourceMode}</span> : null}
          {typeof item.confidenceScore === "number" ? <span>Confidence: {item.confidenceScore}%</span> : null}
          {item.validationVerdict ? <span>Validation: {item.validationVerdict}</span> : null}
          {typeof item.selectedPolicyCount === "number" ? <span>Policies: {item.selectedPolicyCount}</span> : null}
          {item.pipelineVersion ? <span>Pipeline: {item.pipelineVersion}</span> : null}
          {item.latencyMs ? <span>Latency: {formatSeconds(item.latencyMs)}</span> : null}
        </div>
      </div>
    </article>
  );
}

function Field({ label, value, clamp = false }: { label: string; value: string | null | undefined; clamp?: boolean }) {
  if (!value) return null;
  return <div><div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</div><p className={`mt-1 text-sm leading-6 text-slate-700 ${clamp ? "line-clamp-3" : ""}`}>{value}</p></div>;
}

function formatSeconds(ms: number) { return ms ? `${(ms / 1000).toFixed(ms >= 10_000 ? 0 : 1)}s` : "—"; }
function formatDay(value: string) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(`${value}T12:00:00Z`)); }
function formatDateTime(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date); }
function humanizeOutcome(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase()); }

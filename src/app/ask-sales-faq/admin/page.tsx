import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  Activity,
  CheckCircle2,
  MessageCircleWarning,
  Route,
  ThumbsDown,
} from "lucide-react";
import { auth } from "@/auth";
import { AskSalesAdminHeader } from "@/components/ask-sales-faq/admin-navigation";
import { Badge } from "@/components/ui/badge";
import { normalizeAskSalesFaqAnalyticsDays } from "@/lib/ask-sales-faq/admin-analytics";
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

  if (!access.ok || !isAskSalesFaqAdmin(access.viewerEmail)) notFound();

  const params = await searchParams;
  const days = normalizeAskSalesFaqAnalyticsDays(params.days, 7);
  const overview = await getAskSalesFaqAdminOverview(20, days);
  const { summary } = overview;
  const answered = summary.groundedAnswers + summary.conversationReplies;

  return (
    <main className="magic-page min-h-[calc(100dvh-72px)] bg-[#f8fafc]">
      <div className="mx-auto flex w-full max-w-[88rem] flex-col gap-5 px-5 pb-16 pt-8 sm:px-8">
        <AskSalesAdminHeader
          active="quality"
          title="Quality & operations"
          description="A simple view of real Ask Sales conversations. Review is manual and only happens when you request it."
          generatedAt={overview.generatedAt}
        />

        <section className="magic-card flex flex-col gap-3 border-emerald-200 bg-emerald-50/70 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-extrabold text-emerald-950">Production logging is active</h2>
            <p className="mt-1 text-sm leading-6 text-emerald-800">
              The old nightly AI quality audit is retired. These logs stay available for a manual review whenever enough new data has accumulated.
            </p>
          </div>
          <span className="w-fit rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-extrabold text-emerald-700">
            Manual review only
          </span>
        </section>

        <WindowPicker activeDays={overview.windowDays} baseHref="/ask-sales-faq/admin" />

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={Activity} label={`Questions, ${days}d`} value={summary.questions} helper="Saved assistant exchanges." />
          <MetricCard icon={CheckCircle2} label="Answered" value={answered} helper="Grounded answers and natural conversation replies." tone="good" />
          <MetricCard icon={Route} label="Safely routed" value={summary.routes} helper="Questions routed instead of guessed. These are not failures." tone={summary.routes ? "warning" : "default"} />
          <MetricCard icon={MessageCircleWarning} label="Needs attention" value={summary.reviewItems} helper="Only technical failures or answers with thumbs-down feedback." tone={summary.reviewItems ? "warning" : "good"} />
        </section>

        <LogPanel
          title="Needs attention"
          description="Only clear signals are shown here: a technical failure or a rep's thumbs-down. Safe routes remain in the conversation log below."
          icon={<MessageCircleWarning className="size-5" />}
          items={overview.recentMisses}
          emptyText="Nothing currently needs attention."
          mode="attention"
        />

        <LogPanel
          title="Recent conversations"
          description="The latest real questions and responses, including answered questions, natural conversation, and safe routes."
          icon={<Activity className="size-5" />}
          items={overview.recentAnswers}
          emptyText="No conversations have been logged yet."
          mode="conversation"
        />

        <details className="magic-card overflow-hidden">
          <summary className="cursor-pointer p-5 text-lg font-extrabold text-slate-950">
            Recent rep feedback <span className="ml-2 text-sm font-semibold text-slate-500">{summary.feedbackCount} in this window</span>
          </summary>
          <div className="border-t border-slate-100">
            <LogPanel
              title="Feedback details"
              description="Thumbs-up, thumbs-down, and any written comments submitted by reps."
              icon={<ThumbsDown className="size-5" />}
              items={overview.recentFeedback}
              emptyText="No feedback has been recorded yet."
              mode="feedback"
              nested
            />
          </div>
        </details>

        <p className="pb-2 text-xs font-medium text-slate-400">
          These counts describe system behavior; they do not replace a human factual review of the underlying answers and sources.
        </p>
      </div>
    </main>
  );
}

function WindowPicker({ activeDays, baseHref }: { activeDays: number; baseHref: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm font-semibold text-slate-500">Time window</p>
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

function LogPanel({ title, description, icon, items, emptyText, mode, nested = false }: { title: string; description: string; icon: ReactNode; items: AskSalesFaqAdminLogItem[]; emptyText: string; mode: "attention" | "feedback" | "conversation"; nested?: boolean }) {
  return (
    <section className={nested ? "overflow-hidden bg-white" : "magic-card overflow-hidden"}>
      <div className="border-b border-slate-100 p-5">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-red-50 text-red-600">{icon}</span>
          <h2 className="text-lg font-extrabold text-slate-950">{title}</h2>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
      </div>
      <div className="divide-y divide-slate-100">
        {items.length
          ? items.map((item) => <LogItem key={`${mode}-${item.id}`} item={item} mode={mode} />)
          : <div className="p-6 text-sm text-slate-500">{emptyText}</div>}
      </div>
    </section>
  );
}

function LogItem({ item, mode }: { item: AskSalesFaqAdminLogItem; mode: "attention" | "feedback" | "conversation" }) {
  const isProblem = item.rating === "down" || Boolean(item.errorClass);
  return (
    <article className="min-w-0 p-5">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="outline" className={isProblem ? "border-red-200 bg-red-50 text-red-700" : item.needsRoute ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}>
          {item.rating ? `Thumbs ${item.rating}` : humanizeOutcome(item.outcome || "answer")}
        </Badge>
        <span className="text-slate-400">{formatDateTime(item.createdAt)}</span>
      </div>

      <div className="mt-3 space-y-3">
        <Field label="Rep" value={item.viewerEmail} />
        <Field label="Question" value={item.question} />
        <Field label="Answer" value={item.answer} />
        {item.sourceLabel ? <Field label="Knowledge source" value={item.sourceLabel} /> : null}
        {item.comment ? <Field label="Rep comment" value={item.comment} /> : null}
        {item.routeReason ? <Field label="Why it was routed" value={item.routeReason} /> : null}
        {mode === "attention" && item.reviewAction ? <Field label="Suggested review" value={item.reviewAction} /> : null}
      </div>

      <details className="mt-4 text-xs text-slate-500">
        <summary className="cursor-pointer font-bold text-slate-600">Technical details</summary>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
          {item.provider ? <span>Provider: {item.provider}{item.model ? ` / ${item.model}` : ""}</span> : null}
          {item.sourceMode ? <span>Source mode: {item.sourceMode}</span> : null}
          {typeof item.confidenceScore === "number" ? <span>Confidence: {item.confidenceScore}%</span> : null}
          {item.validationVerdict ? <span>Validation: {item.validationVerdict}</span> : null}
          {typeof item.selectedPolicyCount === "number" ? <span>Policies: {item.selectedPolicyCount}</span> : null}
          {item.pipelineVersion ? <span>Pipeline: {item.pipelineVersion}</span> : null}
          {item.knowledgeVersion ? <span>Knowledge: {item.knowledgeVersion}</span> : null}
          {item.latencyMs ? <span>Latency: {formatSeconds(item.latencyMs)}</span> : null}
          {item.errorClass ? <span>Error: {item.errorClass}</span> : null}
        </div>
      </details>
    </article>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return <div><div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</div><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{value}</p></div>;
}

function formatSeconds(ms: number) { return ms ? `${(ms / 1000).toFixed(ms >= 10_000 ? 0 : 1)}s` : "—"; }
function formatDateTime(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date); }
function humanizeOutcome(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase()); }

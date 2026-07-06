import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Database,
  MessageCircleWarning,
  ShieldAlert,
  ShieldCheck,
  ThumbsDown,
} from "lucide-react";
import { auth } from "@/auth";
import { Badge } from "@/components/ui/badge";
import { getAskSalesFaqAccess, isAskSalesFaqAdmin } from "@/lib/ask-sales-faq/access";
import type { AskSalesFaqAdminLogItem, AskSalesFaqAdminMetric } from "@/lib/ask-sales-faq/types";
import { getAskSalesFaqAdminOverview } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ask Sales FAQ Admin | Magic Mike Bot",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AskSalesFaqAdminPage() {
  const session = await auth();
  const access = getAskSalesFaqAccess(session);

  if (!access.ok) {
    return <AccessBlock title="Ask Sales FAQ Admin" message={access.message} />;
  }

  if (!isAskSalesFaqAdmin(access.viewerEmail)) {
    return (
      <AccessBlock
        title="Ask Sales FAQ Admin"
        message="This page is limited to Ask Sales FAQ admins during beta testing."
      />
    );
  }

  const overview = await getAskSalesFaqAdminOverview(25);

  return (
    <main className="magic-page min-h-[calc(100dvh-72px)] bg-[#f8fafc] px-4 py-5 text-slate-950 sm:px-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <header className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-red-100 bg-red-50 text-red-700">
                  Hidden beta admin
                </Badge>
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                  Read-only Neon review
                </span>
              </div>
              <h1 className="text-2xl font-extrabold tracking-normal text-slate-950">Ask Sales FAQ Admin</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Review misses, thumbs-down feedback, and recent answer decisions. This page does not delete or change FAQ
                records; normal chat deletion only hides the chat from the rep sidebar while backend records remain saved.
              </p>
            </div>
            <Link
              href="/ask-sales-faq"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
            >
              <ArrowLeft className="size-4" />
              Back to chat
            </Link>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {overview.metrics.map((metric) => (
            <MetricCard key={metric.label} metric={metric} />
          ))}
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <AdminPanel
            title="Needs Review"
            description="New misses, routed answers, and low-confidence outcomes. Use this list to decide what needs a KB article, correction, or owner confirmation."
            icon={<MessageCircleWarning className="size-5" />}
            items={overview.recentMisses}
            emptyText="No routed or missed answers are waiting in the review queue."
            mode="miss"
          />
          <AdminPanel
            title="Recent Feedback"
            description="Thumbs up/down ratings saved in Neon. Thumbs down requires a rep comment and is mirrored to the Google Sheet when the webhook is healthy."
            icon={<ThumbsDown className="size-5" />}
            items={overview.recentFeedback}
            emptyText="No feedback has been recorded yet."
            mode="feedback"
          />
        </section>

        <AdminPanel
          title="Recent Answer Decisions"
          description="A quick audit trail of the latest assistant answers, including source mode, confidence, routing, provider, and model."
          icon={<Database className="size-5" />}
          items={overview.recentAnswers}
          emptyText="No assistant answers have been logged yet."
          mode="answer"
        />

        <p className="pb-3 text-xs text-slate-400">Generated {formatDateTime(overview.generatedAt)}</p>
      </div>
    </main>
  );
}

function AccessBlock({ title, message }: { title: string; message: string }) {
  return (
    <main className="magic-page grid min-h-[calc(100dvh-72px)] place-items-center bg-[#f8fafc] px-4 py-6">
      <section className="w-full max-w-xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-lg bg-[#FEF2F2] text-[#DC2626]">
            <ShieldAlert className="size-5" />
          </span>
          <Badge variant="outline" className="border-slate-200 bg-white">
            Hidden admin route
          </Badge>
        </div>
        <h1 className="text-2xl font-extrabold tracking-normal text-slate-950">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{message}</p>
      </section>
    </main>
  );
}

function MetricCard({ metric }: { metric: AskSalesFaqAdminMetric }) {
  const toneClass =
    metric.tone === "good"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : metric.tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-slate-200 bg-slate-50 text-slate-700";
  const Icon = metric.tone === "good" ? ShieldCheck : metric.tone === "warning" ? AlertTriangle : Database;

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-sm font-bold text-slate-600">{metric.label}</span>
        <span className={`grid size-9 place-items-center rounded-lg border ${toneClass}`}>
          <Icon className="size-4" />
        </span>
      </div>
      <div className="text-3xl font-extrabold tracking-normal text-slate-950">{metric.value}</div>
      <p className="mt-2 text-xs leading-5 text-slate-500">{metric.helper}</p>
    </article>
  );
}

function AdminPanel({
  title,
  description,
  icon,
  items,
  emptyText,
  mode,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  items: AskSalesFaqAdminLogItem[];
  emptyText: string;
  mode: "miss" | "feedback" | "answer";
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-lg bg-red-50 text-red-600">{icon}</span>
          <h2 className="text-lg font-extrabold tracking-normal text-slate-950">{title}</h2>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
      </div>
      <div className="divide-y divide-slate-100">
        {items.length ? (
          items.map((item) => <LogItem key={`${mode}-${item.id}`} item={item} mode={mode} />)
        ) : (
          <div className="px-5 py-8 text-sm text-slate-500">{emptyText}</div>
        )}
      </div>
    </section>
  );
}

function LogItem({ item, mode }: { item: AskSalesFaqAdminLogItem; mode: "miss" | "feedback" | "answer" }) {
  return (
    <article className="px-5 py-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="outline" className={badgeClass(item, mode)}>
          {badgeText(item, mode)}
        </Badge>
        {item.sourceMode ? <Badge variant="outline">Source: {item.sourceMode}</Badge> : null}
        {item.confidenceLabel ? (
          <Badge variant="outline">
            {item.confidenceLabel}
            {typeof item.confidenceScore === "number" ? ` ${Math.round(item.confidenceScore * 100)}%` : ""}
          </Badge>
        ) : null}
        {item.provider ? <Badge variant="outline">{[item.provider, item.model].filter(Boolean).join(" / ")}</Badge> : null}
        {item.reviewCategory ? (
          <Badge variant="outline" className={reviewBadgeClass(item.reviewCategory)}>
            {item.reviewCategory}
          </Badge>
        ) : null}
        <span className="text-slate-400">{formatDateTime(item.createdAt)}</span>
      </div>

      <div className="mt-3 space-y-3">
        <Field label="Rep" value={item.viewerEmail} />
        <Field label="Question" value={item.question} />
        {mode !== "miss" ? <Field label="Answer" value={item.answer} clamp /> : null}
        {mode === "miss" ? <Field label="Answer" value={item.answer} clamp /> : null}
        {item.sourceLabel ? <Field label="Source" value={item.sourceLabel} /> : null}
        {item.reviewAction ? <Field label="Review action" value={item.reviewAction} /> : null}
        {item.comment ? <Field label="Comment" value={item.comment} /> : null}
        {item.routeReason ? <Field label="Route reason" value={item.routeReason} /> : null}
      </div>
    </article>
  );
}

function Field({ label, value, clamp = false }: { label: string; value: string | null | undefined; clamp?: boolean }) {
  if (!value) return null;

  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</div>
      <p className={`mt-1 text-sm leading-6 text-slate-700 ${clamp ? "line-clamp-3" : ""}`}>{value}</p>
    </div>
  );
}

function badgeText(item: AskSalesFaqAdminLogItem, mode: "miss" | "feedback" | "answer") {
  if (mode === "feedback") return item.rating === "down" ? "Thumbs down" : "Thumbs up";
  if (mode === "miss") return item.status ? `${item.status}: ${item.decision || "needs review"}` : item.decision || "needs review";
  return item.needsRoute ? item.outcome || "routed" : item.outcome || "answer";
}

function badgeClass(item: AskSalesFaqAdminLogItem, mode: "miss" | "feedback" | "answer") {
  if (mode === "feedback") {
    return item.rating === "down" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (mode === "miss" || item.needsRoute) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function reviewBadgeClass(category: string) {
  if (category === "Wording cleanup") return "border-red-200 bg-red-50 text-red-700";
  if (category === "Rich/owner approval gap") return "border-purple-200 bg-purple-50 text-purple-700";
  if (category === "Approved-topic matching") return "border-blue-200 bg-blue-50 text-blue-700";
  if (category === "Runtime reliability") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

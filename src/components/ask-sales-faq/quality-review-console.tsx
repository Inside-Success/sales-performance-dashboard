"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  DatabaseZap,
  RefreshCw,
  Route,
  ShieldAlert,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatMiamiDateTime } from "@/lib/format";
import type {
  AskSalesQualityCaseRow,
  AskSalesQualityCaseStatus,
} from "@/lib/ask-sales-faq/quality-review-store";

type Overview = {
  generatedAt: string;
  auditStart: string;
  knowledgeVersion: string;
  cases: AskSalesQualityCaseRow[];
  summary: {
    needsReview: number;
    confirmedKnowledgeGap: number;
    confirmedRuntimeIssue: number;
    needsOwner: number;
    deferred: number;
    resolved: number;
    total: number;
    audited: number;
    looksCorrect: number;
    lastAuditedAt: string | null;
  };
  filters: { status: AskSalesQualityCaseStatus | "active" | "resolved" | "all" };
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

type QualityAction = "answer_correct" | "knowledge_gap" | "runtime_issue" | "needs_owner" | "defer" | "mark_fixed" | "ignore";

export function QualityReviewConsole({ overview }: { overview: Overview }) {
  const router = useRouter();
  const [message, setMessage] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const start = overview.pagination.total ? (overview.pagination.page - 1) * overview.pagination.pageSize + 1 : 0;
  const end = Math.min(overview.pagination.page * overview.pagination.pageSize, overview.pagination.total);

  function refresh() {
    startTransition(() => router.refresh());
  }

  return (
    <section className="magic-card overflow-hidden">
      <div className="border-b border-slate-100 p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="size-5 text-red-600" />
              <h2 className="text-lg font-extrabold text-slate-950">Chatbot quality review</h2>
            </div>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
              Daily review of real rep questions, negative feedback, routes, grounding failures, and likely answer problems. Similar findings are grouped into one case. Admin and test-account questions are excluded.
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-400">
              Reviewing messages since {formatMiamiDateTime(overview.auditStart)} · {overview.summary.audited} exchanges audited · {overview.summary.looksCorrect} closed automatically as supportable
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-slate-200 bg-slate-50">V3 {overview.knowledgeVersion}</Badge>
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
              No automatic KB changes
            </Badge>
            <button type="button" disabled={isPending} onClick={refresh} className="inline-flex h-9 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-xs font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              <RefreshCw className={`size-3.5 ${isPending ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <QualityMetric label="Needs review" value={overview.summary.needsReview} icon={AlertTriangle} tone="warning" />
          <QualityMetric label="Confirmed gaps" value={overview.summary.confirmedKnowledgeGap} icon={DatabaseZap} tone="warning" />
          <QualityMetric label="Runtime issues" value={overview.summary.confirmedRuntimeIssue} icon={Wrench} tone="warning" />
          <QualityMetric label="Needs owner" value={overview.summary.needsOwner} icon={CircleHelp} tone="default" />
          <QualityMetric label="Resolved" value={overview.summary.resolved} icon={CheckCircle2} tone="good" />
        </div>

        <QualityFilters overview={overview} />
      </div>

      {message ? (
        <div className={`border-b px-5 py-3 text-sm font-semibold ${message.tone === "good" ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-red-100 bg-red-50 text-red-700"}`}>
          {message.text}
        </div>
      ) : null}

      <div className="border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs font-semibold text-slate-500">
        Showing {start}-{end} of {overview.pagination.total} grouped quality cases. One case can represent several similar exchanges from multiple reps.
      </div>

      <div className="divide-y divide-slate-100">
        {overview.cases.map((item) => (
          <QualityCaseCard
            key={item.id}
            item={item}
            onDone={(text, tone) => {
              setMessage({ text, tone });
              refresh();
            }}
          />
        ))}
        {!overview.cases.length ? (
          <div className="p-8 text-center">
            <CheckCircle2 className="mx-auto size-8 text-emerald-400" />
            <p className="mt-3 text-sm font-extrabold text-slate-700">No quality cases match this view.</p>
          </div>
        ) : null}
      </div>

      <QualityPagination overview={overview} />
    </section>
  );
}

function QualityCaseCard({ item, onDone }: { item: AskSalesQualityCaseRow; onDone: (text: string, tone: "good" | "bad") => void }) {
  const [note, setNote] = useState(item.reviewer_note || "");
  const [busy, setBusy] = useState(false);
  const active = ["needs_review", "confirmed_knowledge_gap", "confirmed_runtime_issue", "needs_owner", "deferred"].includes(item.status);

  async function act(action: QualityAction) {
    const highImpact = ["knowledge_gap", "runtime_issue", "needs_owner"].includes(action);
    if (highImpact && !note.trim()) {
      onDone("Add a short reviewer note before confirming the problem type.", "bad");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/ask-sales-faq/admin/quality-review/cases/${encodeURIComponent(item.id)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expectedVersion: item.version, action, note: note || null }),
      });
      const body = await response.json().catch(() => ({}));
      onDone(
        response.ok
          ? `${item.title}: review decision recorded. The chatbot and knowledge base were not changed.`
          : body.message || "The review decision failed safely.",
        response.ok ? "good" : "bad",
      );
    } catch {
      onDone("The review server could not be reached. Nothing was changed.", "bad");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="p-5 md:p-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <QualityStatusBadge status={item.status} />
            <SeverityBadge severity={item.severity} />
            <Badge variant="outline">{humanize(item.issue_type)}</Badge>
            <Badge variant="outline">{item.occurrence_count} exchange{item.occurrence_count === 1 ? "" : "s"}</Badge>
            <Badge variant="outline">{item.affected_rep_count} rep{item.affected_rep_count === 1 ? "" : "s"}</Badge>
            <span className="inline-flex items-center gap-1 text-xs text-slate-400">
              <Clock3 className="size-3.5" />
              Last seen {formatMiamiDateTime(item.last_seen_at)}
            </span>
          </div>
          <h3 className="mt-3 text-lg font-extrabold text-slate-950">{item.title}</h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{item.summary}</p>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <ContentBlock label="Representative question" value={item.question || "Question text was not available."} />
            <ContentBlock label="Chatbot answer" value={item.answer} />
          </div>

          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-amber-700">Why it was flagged</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{item.rationale}</p>
            {item.expected_behavior ? (
              <>
                <p className="mt-3 text-[11px] font-extrabold uppercase tracking-[0.14em] text-emerald-700">Expected behavior to verify</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{item.expected_behavior}</p>
              </>
            ) : null}
          </div>

          <div className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs sm:grid-cols-2 xl:grid-cols-4">
            <Meta label="Outcome" value={humanize(item.outcome || "unknown")} />
            <Meta label="Route" value={item.needs_route ? item.route_reason || "Safe route returned" : "Direct answer"} />
            <Meta label="Runtime" value={item.error_class || "No stored runtime error"} />
            <Meta label="Audit confidence" value={`${Math.round(item.evaluation_confidence * 100)}%`} />
          </div>

          {item.feedback_rating === "down" ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-red-600">Negative rep feedback</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{item.feedback_comment || "No comment was retained."}</p>
            </div>
          ) : null}

          {item.related_candidates.length ? (
            <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-blue-700">Possibly related source updates</p>
              <div className="mt-2 space-y-2">
                {item.related_candidates.map((candidate) => (
                  <Link
                    key={candidate.id}
                    href={`/ask-sales-faq/admin/knowledge-refresh?q=${encodeURIComponent(candidate.title)}`}
                    className="block text-sm font-bold text-blue-800 hover:underline"
                  >
                    {candidate.title} · {humanize(candidate.status)}
                  </Link>
                ))}
              </div>
              <p className="mt-2 text-xs leading-5 text-blue-700">This is a review aid only. A related source proposal still requires its own evidence and approval.</p>
            </div>
          ) : null}
        </div>

        <div className="w-full shrink-0 rounded-xl border border-slate-200 bg-white p-4 xl:w-80">
          {active ? (
            <>
              <label className="block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Reviewer note</label>
              <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} maxLength={2000} placeholder="Record what is wrong, the correct source, or why the answer was acceptable." className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-red-300" />
              <div className="mt-3 grid gap-2">
                <button type="button" disabled={busy} onClick={() => act("answer_correct")} className="h-10 rounded-lg bg-emerald-600 px-3 text-sm font-extrabold text-white disabled:opacity-50">Answer was acceptable</button>
                <button type="button" disabled={busy} onClick={() => act("knowledge_gap")} className="h-10 rounded-lg border border-blue-200 bg-blue-50 px-3 text-sm font-extrabold text-blue-800 disabled:opacity-50">Confirm knowledge gap</button>
                <button type="button" disabled={busy} onClick={() => act("runtime_issue")} className="h-10 rounded-lg border border-amber-200 bg-amber-50 px-3 text-sm font-extrabold text-amber-800 disabled:opacity-50">Confirm runtime issue</button>
                <div className="grid grid-cols-2 gap-2">
                  <SmallAction disabled={busy} label="Needs owner" onClick={() => act("needs_owner")} />
                  <SmallAction disabled={busy} label="Review later" onClick={() => act("defer")} />
                  <SmallAction disabled={busy} label="Mark fixed" onClick={() => act("mark_fixed")} />
                  <SmallAction disabled={busy} label="Ignore/test" onClick={() => act("ignore")} />
                </div>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">Confirming a gap or runtime issue creates no production change. It keeps the case visible until a separately reviewed fix is released.</p>
            </>
          ) : (
            <div className="text-sm leading-6 text-slate-600">
              <div className="font-extrabold text-slate-800">Resolved audit record</div>
              <p className="mt-1">{item.reviewer_note || "This case is preserved for history."}</p>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function QualityFilters({ overview }: { overview: Overview }) {
  const views: Array<[Overview["filters"]["status"], string, number]> = [
    ["active", "Needs action", overview.summary.needsReview + overview.summary.confirmedKnowledgeGap + overview.summary.confirmedRuntimeIssue + overview.summary.needsOwner],
    ["needs_review", "Unreviewed", overview.summary.needsReview],
    ["confirmed_knowledge_gap", "Knowledge gaps", overview.summary.confirmedKnowledgeGap],
    ["confirmed_runtime_issue", "Runtime issues", overview.summary.confirmedRuntimeIssue],
    ["needs_owner", "Needs owner", overview.summary.needsOwner],
    ["resolved", "Resolved", overview.summary.resolved],
    ["all", "All", overview.summary.total],
  ];
  return (
    <nav className="mt-5 flex flex-wrap gap-2" aria-label="Quality review status">
      {views.map(([value, label, count]) => (
        <Link key={value} href={`/ask-sales-faq/admin?qualityStatus=${value}`} className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${overview.filters.status === value ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
          {label} ({count})
        </Link>
      ))}
    </nav>
  );
}

function QualityPagination({ overview }: { overview: Overview }) {
  const previous = Math.max(1, overview.pagination.page - 1);
  const next = Math.min(overview.pagination.totalPages, overview.pagination.page + 1);
  const href = (page: number) => `/ask-sales-faq/admin?qualityStatus=${overview.filters.status}${page > 1 ? `&qualityPage=${page}` : ""}`;
  return (
    <div className="flex items-center justify-between border-t border-slate-100 p-4">
      <Link aria-disabled={overview.pagination.page <= 1} href={href(previous)} className={`inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-extrabold ${overview.pagination.page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-slate-50"}`}>
        <ChevronLeft className="size-4" /> Previous
      </Link>
      <span className="text-xs font-semibold text-slate-500">Page {overview.pagination.page} of {overview.pagination.totalPages}</span>
      <Link aria-disabled={overview.pagination.page >= overview.pagination.totalPages} href={href(next)} className={`inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-extrabold ${overview.pagination.page >= overview.pagination.totalPages ? "pointer-events-none opacity-40" : "hover:bg-slate-50"}`}>
        Next <ChevronRight className="size-4" />
      </Link>
    </div>
  );
}

function QualityMetric({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof Route; tone: "default" | "good" | "warning" }) {
  const color = tone === "good" ? "text-emerald-600" : tone === "warning" ? "text-amber-600" : "text-slate-900";
  return <article className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between gap-2"><span className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">{label}</span><Icon className={`size-4 ${color}`} /></div><div className={`mt-3 text-2xl font-extrabold ${color}`}>{value}</div></article>;
}

function QualityStatusBadge({ status }: { status: AskSalesQualityCaseStatus }) {
  const color = status === "resolved_correct" || status === "fixed"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : status === "confirmed_runtime_issue" || status === "confirmed_knowledge_gap"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-amber-200 bg-amber-50 text-amber-700";
  return <Badge variant="outline" className={color}>{humanize(status)}</Badge>;
}

function SeverityBadge({ severity }: { severity: "low" | "medium" | "high" }) {
  const color = severity === "high" ? "border-red-200 bg-red-50 text-red-700" : severity === "medium" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 bg-slate-50 text-slate-600";
  return <Badge variant="outline" className={color}>{severity} priority</Badge>;
}

function ContentBlock({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-400">{label}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">{value}</p></div>;
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div><p className="font-bold uppercase tracking-[0.1em] text-slate-400">{label}</p><p className="mt-1 break-words font-semibold text-slate-700">{value}</p></div>;
}

function SmallAction({ disabled, label, onClick }: { disabled: boolean; label: string; onClick: () => void }) {
  return <button type="button" disabled={disabled} onClick={onClick} className="h-9 rounded-lg border border-slate-200 text-xs font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{label}</button>;
}

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

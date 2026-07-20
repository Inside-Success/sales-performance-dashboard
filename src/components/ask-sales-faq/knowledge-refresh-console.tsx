"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  ExternalLink,
  FileCheck2,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { KnowledgeInboxCard } from "@/components/ask-sales-faq/knowledge-inbox-card";
import { formatMiamiDateTime } from "@/lib/format";
import type {
  KnowledgeRefreshCandidateRow,
  KnowledgeRefreshConflictResolution,
  KnowledgeRefreshQueueView,
  KnowledgeRefreshReleaseRow,
  KnowledgeRefreshSourceRow,
} from "@/lib/ask-sales-faq/knowledge-refresh-store";

type Overview = {
  generatedAt: string;
  knowledgeVersion: string;
  publishEnabled: boolean;
  sources: KnowledgeRefreshSourceRow[];
  candidates: KnowledgeRefreshCandidateRow[];
  releases: KnowledgeRefreshReleaseRow[];
  summary: {
    needs_review: number;
    needs_owner: number;
    approved_content: number;
    deferred: number;
    duplicate: number;
    rejected: number;
    stale: number;
    total: number;
  };
  filters: { view: KnowledgeRefreshQueueView; query: string; sourceKind: string; conflictLevel: string };
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  latestRun: {
    run_id: string;
    started_at: string;
    completed_at: string;
    changed_sources: number;
    unchanged_sources: number;
    unavailable_sources: number;
    new_proposals: number;
    prior_drafts_replaced: number;
  } | null;
};

type ReviewAction = "approve_content" | "reject" | "defer" | "needs_owner" | "duplicate" | "engineering_required";
type BatchAction = Exclude<ReviewAction, "approve_content">;
const subscribeToHydration = () => () => {};

export function KnowledgeRefreshConsole({ overview }: { overview: Overview }) {
  const router = useRouter();
  const [reviewSelected, setReviewSelected] = useState<string[]>([]);
  const [releaseSelected, setReleaseSelected] = useState<string[]>([]);
  const [batchAction, setBatchAction] = useState<BatchAction>("defer");
  const [batchNote, setBatchNote] = useState("");
  const [busyReleaseId, setBusyReleaseId] = useState<string | null>(null);
  const [preparingRelease, setPreparingRelease] = useState(false);
  const [message, setMessage] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [releaseMessage, setReleaseMessage] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const cardsReady = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  const [isPending, startTransition] = useTransition();
  const available = overview.sources.filter((source) => source.availability === "available" || source.availability === "replacement_active").length;
  const unavailable = overview.sources.filter((source) => source.availability === "unavailable").length;
  const approved = overview.candidates.filter((candidate) => candidate.status === "approved_content");
  const readyApproved = approved.filter((candidate) => candidate.release_readiness?.ready);
  const selectedReadyCount = readyApproved.filter((candidate) => releaseSelected.includes(candidate.id)).length;
  const reviewable = overview.candidates.filter((candidate) => ["needs_review", "needs_owner", "deferred"].includes(candidate.status));
  const selectedCandidates = reviewable.filter((candidate) => reviewSelected.includes(candidate.id));

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function prepareRelease() {
    const selectedReadyIds = readyApproved.filter((candidate) => releaseSelected.includes(candidate.id)).map((candidate) => candidate.id);
    if (!selectedReadyIds.length || preparingRelease) return;
    if (!window.confirm(`Build a validation preview for ${selectedReadyIds.length} ready draft${selectedReadyIds.length === 1 ? "" : "s"}? This will not publish to production.`)) return;
    setReleaseMessage(null);
    setPreparingRelease(true);
    try {
      const response = await fetch("/api/ask-sales-faq/admin/knowledge-refresh/releases", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ candidateIds: selectedReadyIds }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) return setReleaseMessage({ tone: "bad", text: body.message || "The preview was not built. Production remains unchanged." });
      setReleaseSelected([]);
      setReleaseMessage({ tone: "good", text: `Preview ${body.releaseId} passed every draft check and is open in Release history below. Production was not changed.` });
      refresh();
    } catch {
      setReleaseMessage({ tone: "bad", text: "The preview server could not be reached. Production was not changed." });
    } finally {
      setPreparingRelease(false);
    }
  }

  async function returnApprovedForCorrection(candidate: KnowledgeRefreshCandidateRow) {
    if (!window.confirm(`Send “${candidate.title}” back for correction? This removes its approval but does not change production knowledge.`)) return;
    setReleaseMessage(null);
    try {
      const reasons = candidate.release_readiness?.reasons.join(" ") || "Release readiness checks require correction.";
      const response = await fetch(`/api/ask-sales-faq/admin/knowledge-refresh/candidates/${encodeURIComponent(candidate.id)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedVersion: candidate.version,
          action: "needs_owner",
          note: `Returned from the approved queue before release: ${reasons}`.slice(0, 2000),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) return setReleaseMessage({ tone: "bad", text: body.message || "The draft was not moved. Production remains unchanged." });
      setReleaseSelected((current) => current.filter((id) => id !== candidate.id));
      setReleaseMessage({ tone: "good", text: `${candidate.title} was sent back for correction. Production was not changed.` });
      refresh();
    } catch {
      setReleaseMessage({ tone: "bad", text: "The review server could not be reached. Production was not changed." });
    }
  }

  async function applyBatchDecision() {
    if (!selectedCandidates.length) return;
    const label = batchAction.replaceAll("_", " ");
    if (!window.confirm(`Record “${label}” for ${selectedCandidates.length} selected proposal${selectedCandidates.length === 1 ? "" : "s"}? This cannot approve or publish content.`)) return;
    setMessage(null);
    try {
      const response = await fetch("/api/ask-sales-faq/admin/knowledge-refresh/candidates/batch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          candidates: selectedCandidates.map((candidate) => ({ candidateId: candidate.id, expectedVersion: candidate.version })),
          action: batchAction,
          note: batchNote || null,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) return setMessage({ tone: "bad", text: body.message || "The batch decision failed safely." });
      setReviewSelected([]);
      setBatchNote("");
      setMessage({ tone: "good", text: `${body.updatedCount} proposal${body.updatedCount === 1 ? "" : "s"} updated. Nothing was approved or published.` });
      refresh();
    } catch {
      setMessage({ tone: "bad", text: "The batch review server could not be reached. No decision was recorded." });
    }
  }

  async function recomputeGovernance() {
    if (!window.confirm("Recheck conflict labels for the current actionable queue against the deployed V3 registry? Candidate decisions and production knowledge will not change.")) return;
    setMessage(null);
    try {
      const response = await fetch("/api/ask-sales-faq/admin/knowledge-refresh/maintenance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "recompute_governance" }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) return setMessage({ tone: "bad", text: body.message || "Conflict labels were not refreshed." });
      setMessage({ tone: "good", text: `Rechecked ${body.reviewedCount} actionable proposals; ${body.updatedCount} conflict labels changed. Production knowledge was untouched.` });
      refresh();
    } catch {
      setMessage({ tone: "bad", text: "Conflict labels could not be refreshed. Candidate decisions and production knowledge were untouched." });
    }
  }

  async function runReleaseAction(release: KnowledgeRefreshReleaseRow, action: "create_pull_requests" | "publish_verified_release") {
    const publishing = action === "publish_verified_release";
    const prompt = publishing
      ? "Publish this verified release? The publisher will recheck both repository release workflows, merge only passing pull requests, wait for the production deployment, and verify the exact knowledge version."
      : "Create synchronized governed release pull requests? This prepares reviewed Git changes and runs release checks, but it will not change production.";
    if (!window.confirm(prompt)) return;
    setBusyReleaseId(release.id);
    setMessage(null);
    try {
      const response = await fetch(`/api/ask-sales-faq/admin/knowledge-refresh/releases/${encodeURIComponent(release.id)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) return setMessage({ tone: "bad", text: body.message || "The governed release action failed safely. Production was not changed." });
      setMessage({
        tone: "good",
        text: publishing
          ? "Verified publication is running. Refresh shortly to see the production verification result."
          : "Release pull requests are being created. Production remains unchanged until you use the separate final publish action.",
      });
      refresh();
    } catch {
      setMessage({ tone: "bad", text: "The governed publisher could not be reached. Production was not changed." });
    } finally {
      setBusyReleaseId(null);
    }
  }

  const start = overview.pagination.total ? (overview.pagination.page - 1) * overview.pagination.pageSize + 1 : 0;
  const end = Math.min(overview.pagination.page * overview.pagination.pageSize, overview.pagination.total);

  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Metric label="Needs review" value={overview.summary.needs_review} tone={overview.summary.needs_review ? "warning" : "good"} />
        <Metric label="Needs owner" value={overview.summary.needs_owner} tone={overview.summary.needs_owner ? "warning" : "default"} />
        <Metric label="Baseline screened" value={overview.summary.deferred} tone="good" />
        <Metric label="Duplicates" value={overview.summary.duplicate} tone="good" />
        <Metric label="Content approved" value={overview.summary.approved_content} tone="good" />
        <Metric label="Sources healthy" value={`${available}/${overview.sources.length}`} tone={unavailable ? "warning" : "good"} />
      </section>

      <section className="magic-card p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-emerald-600" />
              <h2 className="text-lg font-extrabold text-slate-950">Latest daily refresh</h2>
            </div>
            {overview.latestRun ? (
              <>
                <p className="mt-2 text-sm font-semibold text-slate-700">
                  Completed successfully at {formatMiamiDateTime(overview.latestRun.completed_at)}.
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Older drafts were preserved in the archive. They were not deleted or silently merged.
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-slate-500">No completed refresh run is available yet.</p>
            )}
          </div>
          {overview.latestRun ? (
            <div className="grid min-w-0 gap-2 sm:grid-cols-3 xl:w-[44rem] xl:grid-cols-5">
              <RunStat label="Sources changed" value={overview.latestRun.changed_sources} />
              <RunStat label="Unchanged" value={overview.latestRun.unchanged_sources} />
              <RunStat label="Unavailable" value={overview.latestRun.unavailable_sources} tone={overview.latestRun.unavailable_sources ? "warning" : "default"} />
              <RunStat label="New drafts" value={overview.latestRun.new_proposals} />
              <RunStat label="Older drafts archived" value={overview.latestRun.prior_drafts_replaced} />
            </div>
          ) : null}
        </div>
      </section>

      <section className="magic-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2"><ShieldCheck className="size-5 text-emerald-600" /><h2 className="text-lg font-extrabold text-slate-950">Production safety boundary</h2></div>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">Screening, deferring, or marking duplicates only organizes preserved proposals. Approval is always individual. Even content approval creates only a release manifest; the live V3 registry still requires reviewed Git changes, tests, deployment checks, and production verification.</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-slate-200 bg-slate-50">V3 {overview.knowledgeVersion}</Badge>
            <Badge variant="outline" className={overview.publishEnabled ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}>{overview.publishEnabled ? "Publication integration enabled" : "Direct publication disabled"}</Badge>
            <button type="button" disabled={isPending} onClick={refresh} className="inline-flex h-9 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-xs font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw className={`size-3.5 ${isPending ? "animate-spin" : ""}`} /> Refresh</button>
          </div>
        </div>
      </section>

      {message ? <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${message.tone === "good" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>{message.text}</div> : null}

      <details className="magic-card overflow-hidden">
        <summary className="cursor-pointer p-5 text-lg font-extrabold text-slate-950">Daily source health <span className="ml-2 text-sm font-semibold text-slate-500">{available}/{overview.sources.length} healthy · 9:00 PM Miami</span></summary>
        <div className="grid gap-px border-t border-slate-100 bg-slate-100 sm:grid-cols-2 xl:grid-cols-3">{overview.sources.map((source) => <SourceCard key={source.id} source={source} />)}</div>
      </details>

      <section className="magic-card overflow-hidden">
        <div className="border-b border-slate-100 p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-slate-950">Useful updates to review</h2>
              <p className="mt-1 text-sm text-slate-500">Showing {start}-{end} of {overview.pagination.total}. Each card is one proposed answer. If it is not useful, choose Ignore.</p>
            </div>
            <button type="button" onClick={recomputeGovernance} className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-slate-200 px-3 text-xs font-extrabold text-slate-700 hover:bg-slate-50"><ShieldAlert className="size-3.5" /> Recheck conflict labels</button>
          </div>
          <QueueFilters overview={overview} />
        </div>

        {reviewable.length ? (
          <div className="border-b border-slate-100 bg-slate-50 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <label className="inline-flex items-center gap-2 text-xs font-extrabold text-slate-700"><input type="checkbox" className="size-4 accent-red-600" checked={reviewable.length > 0 && reviewable.every((candidate) => reviewSelected.includes(candidate.id))} onChange={(event) => setReviewSelected(event.target.checked ? reviewable.map((candidate) => candidate.id) : [])} /> Select this page</label>
              <select value={batchAction} onChange={(event) => setBatchAction(event.target.value as BatchAction)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"><option value="defer">Move out of active queue</option><option value="needs_owner">Needs policy owner</option><option value="duplicate">Mark duplicate</option><option value="engineering_required">Needs engineering</option><option value="reject">Reject proposal</option></select>
              <input value={batchNote} onChange={(event) => setBatchNote(event.target.value)} maxLength={2000} placeholder="Required audit note for the selected group" className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700" />
              <button type="button" disabled={!selectedCandidates.length || !batchNote.trim()} onClick={applyBatchDecision} className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-extrabold text-white disabled:cursor-not-allowed disabled:bg-slate-300">Apply to {selectedCandidates.length}</button>
            </div>
            <p className="mt-2 text-xs text-slate-500">Bulk approval is intentionally unavailable. Batch actions are version-checked, audited, and cannot publish knowledge.</p>
          </div>
        ) : null}

        <div className="divide-y divide-slate-100">
          {cardsReady ? overview.candidates.map((candidate) => (
            <KnowledgeInboxCard
              key={candidate.id}
              candidate={candidate}
              selected={reviewSelected.includes(candidate.id)}
              onSelected={(checked) => setReviewSelected((current) => checked ? [...new Set([...current, candidate.id])] : current.filter((id) => id !== candidate.id))}
              onDone={(text, tone) => { setMessage({ text, tone }); refresh(); }}
            />
          )) : overview.candidates.length ? <div className="p-8 text-center text-sm text-slate-500">Loading proposal details…</div> : null}
          {cardsReady && !overview.candidates.length ? <div className="p-8 text-center text-sm text-slate-500">No proposals match these filters.</div> : null}
        </div>
        <Pagination overview={overview} />
      </section>

      {overview.filters.view === "approved" ? (
        <section className="magic-card overflow-hidden">
          <div className="border-b border-slate-100 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-lg font-extrabold text-slate-950">Release approved updates</h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">Only green, complete drafts can be selected. A test preview changes no chatbot answer.</p>
                <p className="mt-2 text-xs font-bold text-slate-600">{readyApproved.length} ready · {approved.length - readyApproved.length} need correction</p>
              </div>
              <button type="button" onClick={prepareRelease} disabled={!selectedReadyCount || preparingRelease} className="inline-flex h-10 items-center gap-2 rounded-full bg-[#DC2626] px-4 text-sm font-extrabold text-white disabled:bg-slate-300"><FileCheck2 className="size-4" /> {preparingRelease ? "Checking…" : `Build test preview (${selectedReadyCount})`}</button>
            </div>
            <ol className="mt-4 grid gap-2 text-xs leading-5 text-slate-600 md:grid-cols-4">
              <li className="rounded-lg bg-slate-50 p-3"><span className="font-extrabold text-slate-900">1. Select green drafts</span><br />Red drafts stay out.</li>
              <li className="rounded-lg bg-slate-50 p-3"><span className="font-extrabold text-slate-900">2. Build preview</span><br />No production change.</li>
              <li className="rounded-lg bg-slate-50 p-3"><span className="font-extrabold text-slate-900">3. Create release PRs</span><br />Wait for both checks.</li>
              <li className="rounded-lg bg-slate-50 p-3"><span className="font-extrabold text-slate-900">4. Publish verified release</span><br />Live only after Production verified.</li>
            </ol>
            {releaseMessage ? <div aria-live="polite" className={`mt-4 rounded-xl border px-4 py-3 text-sm font-semibold ${releaseMessage.tone === "good" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>{releaseMessage.text}</div> : null}
          </div>
          <div className="divide-y divide-slate-100">{approved.map((candidate) => {
            const readiness = candidate.release_readiness;
            const ready = Boolean(readiness?.ready);
            return <article key={candidate.id} className={`p-5 ${ready ? "bg-white" : "bg-red-50/30"}`}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <label className={`flex min-w-0 items-start gap-3 ${ready ? "cursor-pointer" : "cursor-not-allowed"}`}>
                  <input aria-label={`Select ${candidate.title} for preview`} type="checkbox" disabled={!ready} className="mt-1 size-4 accent-red-600 disabled:opacity-40" checked={ready && releaseSelected.includes(candidate.id)} onChange={(event) => setReleaseSelected((current) => event.target.checked ? [...new Set([...current, candidate.id])] : current.filter((id) => id !== candidate.id))} />
                  <span className="min-w-0">
                    <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-extrabold ${ready ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-white text-red-700"}`}>{ready ? "Ready for preview" : "Needs correction"}</span>
                    <span className="mt-2 block font-extrabold text-slate-800">{candidate.title}</span>
                    <span className="mt-1 block text-sm leading-6 text-slate-600">{candidate.proposed_policy}</span>
                    {readiness?.summary ? <span className="mt-2 block text-xs font-semibold text-slate-500">{readiness.summary}</span> : null}
                  </span>
                </label>
                {!ready ? <div className="w-full shrink-0 rounded-xl border border-red-200 bg-white p-3 lg:w-96"><div className="text-xs font-extrabold text-red-700">Why it cannot be released yet</div><ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-5 text-slate-600">{(readiness?.reasons.length ? readiness.reasons : ["Refresh this page so the release checks can be loaded."]).map((reason) => <li key={reason}>{reason}</li>)}</ul><button type="button" onClick={() => returnApprovedForCorrection(candidate)} className="mt-3 h-9 rounded-full border border-slate-300 bg-white px-3 text-xs font-extrabold text-slate-800 hover:bg-slate-50">Send back for correction</button></div> : null}
              </div>
            </article>;
          })}{!approved.length ? <div className="p-6 text-sm text-slate-500">No content-approved drafts are waiting for a preview.</div> : null}</div>
        </section>
      ) : null}

      <ReleaseHistory releases={overview.releases} publishEnabled={overview.publishEnabled} busyReleaseId={busyReleaseId} onAction={runReleaseAction} />
    </>
  );
}

function QueueFilters({ overview }: { overview: Overview }) {
  const views: Array<[KnowledgeRefreshQueueView, string, number]> = [
    ["actionable", "New or changed", overview.summary.needs_review + overview.summary.needs_owner],
    ["approved", "Approved", overview.summary.approved_content],
    ["resolved", "Reviewed", overview.summary.deferred + overview.summary.duplicate + overview.summary.rejected],
    ["stale", "Replaced archive", overview.summary.stale],
    ["all", "All", overview.summary.total],
  ];
  return <div className="mt-5 space-y-3"><nav className="flex flex-wrap gap-2">{views.map(([view, label, count]) => <a key={view} href={queueHref(overview, { view, page: 1 })} className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${overview.filters.view === view ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>{label} ({count})</a>)}</nav><form method="get" className="grid gap-2 md:grid-cols-[minmax(0,1fr)_180px_180px_auto]"><input type="hidden" name="view" value={overview.filters.view} /><label className="relative"><Search className="absolute left-3 top-2.5 size-4 text-slate-400" /><input name="q" defaultValue={overview.filters.query} placeholder="Search title, policy, source…" className="h-9 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm text-slate-700" /></label><select name="source" defaultValue={overview.filters.sourceKind} className="h-9 rounded-lg border border-slate-200 px-3 text-sm text-slate-700"><option value="all">All sources</option><option value="slack_channel">Slack</option><option value="google_doc">Google Docs</option><option value="google_sheet">Google Sheets</option></select><select name="conflict" defaultValue={overview.filters.conflictLevel} className="h-9 rounded-lg border border-slate-200 px-3 text-sm text-slate-700"><option value="all">All conflict levels</option><option value="none">No conflict</option><option value="possible">Possible</option><option value="direct">Direct</option><option value="blocked">Blocked topic</option></select><button className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-xs font-extrabold text-slate-700 hover:bg-slate-50">Apply filters</button></form></div>;
}

// Preserved temporarily for audit-diff readability while the Daily Knowledge Inbox replaces the legacy card.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function CandidateReview({ candidate, selected, onSelected, onDone }: { candidate: KnowledgeRefreshCandidateRow; selected: boolean; onSelected: (checked: boolean) => void; onDone: (text: string, tone: "good" | "bad") => void }) {
  const [note, setNote] = useState(candidate.review_note || "");
  const [resolution, setResolution] = useState<KnowledgeRefreshConflictResolution | "">(candidate.conflict_resolution || "");
  const [busy, setBusy] = useState(false);
  const conflictNeedsDecision = candidate.conflict_level === "direct" || candidate.conflict_level === "blocked";
  const blockedReviewReady = candidate.conflict_level !== "blocked" || (candidate.blocked_topics.length > 0 && candidate.blocked_topics.every((topic) => topic.reviewReady));
  const combinesMultipleDecisions = candidate.conflict_level === "blocked" && candidate.blocked_topics.length > 1;
  const resolutionReady = !conflictNeedsDecision || ["supersede", "scoped_coexistence"].includes(resolution);
  const noteReady = !conflictNeedsDecision || note.trim().length > 0;
  const approvalReady = resolutionReady && noteReady && blockedReviewReady && !combinesMultipleDecisions;
  const blockedHasCurrentPolicy = candidate.blocked_topics.some((topic) => topic.currentPolicies.length > 0);
  const canReview = ["needs_review", "needs_owner", "deferred"].includes(candidate.status);

  async function act(action: ReviewAction) {
    if (action === "approve_content" && !window.confirm("Approve this proposal as content-ready for a governed release? This will not publish it to production.")) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/ask-sales-faq/admin/knowledge-refresh/candidates/${encodeURIComponent(candidate.id)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedVersion: candidate.version, action, note: note || null, conflictResolution: resolution || null }) });
      const body = await response.json().catch(() => ({}));
      onDone(response.ok ? `${candidate.title}: decision recorded. Production was not changed.` : body.message || "The decision failed safely.", response.ok ? "good" : "bad");
    } catch {
      onDone("The review server could not be reached. No decision was recorded.", "bad");
    } finally { setBusy(false); }
  }

  return (
    <article className="p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {canReview ? <input aria-label={`Select ${candidate.title}`} type="checkbox" className="size-4 accent-red-600" checked={selected} onChange={(event) => onSelected(event.target.checked)} /> : null}
            <StatusBadge status={candidate.status} />
            <ConflictBadge level={candidate.conflict_level} />
            <Badge variant="outline">AI confidence {Math.round(candidate.ai_confidence * 100)}%</Badge>
            <Badge variant="outline" className="border-slate-200 bg-white">{candidate.source_label}</Badge>
            <Badge variant="outline" className={candidate.change_kind === "updated" ? "border-blue-200 bg-blue-50 text-blue-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}>
              {candidate.change_kind === "updated" ? "Updated from an earlier draft" : "New policy draft"}
            </Badge>
            <span className="text-xs text-slate-400">{formatDate(candidate.created_at)}</span>
          </div>
          <h3 className="mt-3 text-lg font-extrabold text-slate-950">{candidate.title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{candidate.summary}</p>
          {candidate.conflict_level === "blocked" ? (
            candidate.blocked_topics.length > 1
              ? <BlockedConflictSummary topics={candidate.blocked_topics} proposedPolicy={candidate.proposed_policy} />
              : <div className="mt-4 space-y-4">{candidate.blocked_topics.map((topic) => <BlockedConflictPanel key={topic.id} topic={topic} proposedPolicy={candidate.proposed_policy} />)}</div>
          ) : (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Proposed governed policy</div><p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-800">{candidate.proposed_policy}</p></div>
          )}
          {candidate.review_note ? <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800"><span className="font-extrabold">Audit note:</span> {candidate.review_note}</div> : null}
          {candidate.previous_candidate_title ? (
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <span className="font-extrabold text-slate-800">Previous version:</span> {candidate.previous_candidate_title}. The previous draft remains in the replaced archive.
            </div>
          ) : null}
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Detail label="Why it may matter" value={candidate.rationale} />
            <Detail label="Conflict check" value={candidate.conflict_level === "blocked" ? `${candidate.blocked_topics.length} related governed conflict${candidate.blocked_topics.length === 1 ? "" : "s"}. Review the plain-language comparison shown above.` : candidate.conflict_summary} />
            <Detail label="Product scopes" value={candidate.product_scopes.join(", ")} />
            <Detail label="Decision key / effective date" value={`${candidate.decision_key || "New or unclassified"} · ${candidate.effective_date || "Not stated"}`} />
          </div>
          <details className="mt-4 rounded-xl border border-slate-200 p-4">
            <summary className="cursor-pointer text-sm font-extrabold text-slate-700">Source evidence and governed-policy matches</summary>
            <div className="mt-3 space-y-3">
              {candidate.evidence_quotes.map((quote, index) => <blockquote key={index} className="border-l-2 border-red-200 pl-3 text-sm italic leading-6 text-slate-600">“{quote}”</blockquote>)}
              {candidate.related_policies.length ? <div className="grid gap-3 lg:grid-cols-2">{candidate.related_policies.map((policy, index) => <PolicyMatchCard key={String(policy.id || index)} policy={policy} />)}</div> : <p className="text-sm text-slate-500">No close governed policy was found.</p>}
              <a href={candidate.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-bold text-red-600 hover:underline">Open read-only source <ExternalLink className="size-3.5" /></a>
            </div>
          </details>
        </div>
        {canReview ? (
          <div className="w-full shrink-0 space-y-3 rounded-xl border border-slate-200 bg-white p-4 xl:w-80">
            <label className="block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Reviewer note{conflictNeedsDecision ? " (required)" : ""}</label>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} rows={4} placeholder="Record who confirmed this rule, its scope, and any exceptions." className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-red-300" />
            {conflictNeedsDecision ? <><label className="block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Required conflict decision</label><select value={resolution} onChange={(event) => setResolution(event.target.value as KnowledgeRefreshConflictResolution | "")} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"><option value="">Choose before approval</option><option value="supersede">{candidate.conflict_level === "blocked" && !blockedHasCurrentPolicy ? "Adopt proposal as the new official rule" : "Replace the current approved rule"}</option><option value="scoped_coexistence">Approve with explicit scope or conditions</option><option value="existing_remains">Existing rule remains</option><option value="owner_needed">Policy owner needed</option><option value="historical_case">Historical case only</option><option value="engineering_required">Engineering change required</option></select></> : null}
            <button type="button" onClick={() => act("approve_content")} disabled={busy || !approvalReady} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 text-sm font-extrabold text-white disabled:bg-slate-300"><CheckCircle2 className="size-4" /> Approve individually</button>
            {combinesMultipleDecisions ? <p className="text-xs leading-5 text-red-700">Approval is disabled because this draft combines {candidate.blocked_topics.length} separate policy decisions. Keep it with Needs owner or Defer until the automation separates it into one decision per proposal.</p> : !blockedReviewReady ? <p className="text-xs leading-5 text-red-700">Approval is unavailable because governed comparison evidence is missing. Use Needs owner or Defer.</p> : !resolutionReady ? <p className="text-xs leading-5 text-slate-500">Choose how the conflict should be resolved before approval.</p> : !noteReady ? <p className="text-xs leading-5 text-slate-500">Add a reviewer note describing authority and scope before approval.</p> : null}
            <div className="grid grid-cols-2 gap-2"><ActionButton disabled={busy} onClick={() => act("needs_owner")} label="Needs owner" /><ActionButton disabled={busy} onClick={() => act("defer")} label="Defer" /><ActionButton disabled={busy} onClick={() => act("duplicate")} label="Duplicate" /><ActionButton disabled={busy} onClick={() => act("engineering_required")} label="Engineering" /></div>
            <button type="button" onClick={() => act("reject")} disabled={busy} className="h-9 w-full rounded-lg border border-red-200 text-xs font-extrabold text-red-700 hover:bg-red-50 disabled:opacity-50">Reject proposal</button>
          </div>
        ) : <div className="w-full shrink-0 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600 xl:w-80"><div className="font-extrabold text-slate-800">Preserved audit record</div><p className="mt-1">This item is outside the active queue. It remains searchable and was not added to production knowledge.</p></div>}
      </div>
    </article>
  );
}

function BlockedConflictSummary({ topics, proposedPolicy }: { topics: KnowledgeRefreshCandidateRow["blocked_topics"]; proposedPolicy: string }) {
  return (
    <section className="mt-4 rounded-xl border border-red-200 bg-red-50/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-5 text-red-600" />
          <h4 className="font-extrabold text-slate-950">{topics.length} separate policy conflicts were found</h4>
        </div>
        <Badge variant="outline" className="border-red-200 bg-white text-red-700">Approval disabled until separated</Badge>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-700">
        This draft combines more than one decision. Review the proposed wording below, then open the conflict details only if you need the underlying evidence.
      </p>
      <div className="mt-4 rounded-lg border border-emerald-200 bg-white p-3">
        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700">Combined proposal</div>
        <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-800">{proposedPolicy}</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {topics.map((topic) => <Badge key={topic.id} variant="outline" className="border-slate-200 bg-white text-slate-700">{topic.title}</Badge>)}
      </div>
      <details className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
        <summary className="cursor-pointer text-sm font-extrabold text-slate-700">Compare the {topics.length} conflicts and source evidence</summary>
        <div className="mt-4 space-y-4">
          {topics.map((topic) => <BlockedConflictPanel key={topic.id} topic={topic} proposedPolicy={proposedPolicy} />)}
        </div>
      </details>
    </section>
  );
}

function BlockedConflictPanel({ topic, proposedPolicy }: { topic: KnowledgeRefreshCandidateRow["blocked_topics"][number]; proposedPolicy: string }) {
  const hasCurrentPolicy = topic.currentPolicies.length > 0;
  const weakMatch = topic.matchStrength === "weak";
  return <section className={`rounded-xl border p-4 ${weakMatch ? "border-amber-300 bg-amber-50/50" : "border-red-200 bg-red-50/40"}`}><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><AlertTriangle className={`size-5 ${weakMatch ? "text-amber-600" : "text-red-600"}`} /><h4 className="font-extrabold text-slate-950">{weakMatch ? "Automated match needs review" : "Conflict explained"}: {topic.title}</h4></div><Badge variant="outline" className={weakMatch ? "border-amber-300 bg-white text-amber-800" : hasCurrentPolicy ? "border-amber-200 bg-amber-50 text-amber-800" : "border-red-200 bg-white text-red-700"}>{weakMatch ? "Weak topic match · approval blocked" : hasCurrentPolicy ? "Current approved policy exists" : "No approved current policy"}</Badge></div><p className="mt-2 text-sm leading-6 text-slate-700">{topic.explanation}</p><div className="mt-4 grid gap-3 lg:grid-cols-2"><div className="rounded-lg border border-slate-200 bg-white p-3"><div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Current approved policy</div>{hasCurrentPolicy ? <div className="mt-2 space-y-3">{topic.currentPolicies.map((policy) => <div key={policy.id}><div className="text-sm font-extrabold text-slate-800">{policy.title}</div><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600">{policy.decision}</p></div>)}</div> : <p className="mt-2 text-sm leading-6 text-slate-600">None. The topic is blocked because the existing governed evidence has not yet been resolved into one official answer.</p>}</div><div className="rounded-lg border border-emerald-200 bg-white p-3"><div className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700">New proposal</div><p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-800">{proposedPolicy}</p></div></div><div className="mt-4"><div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Existing governed evidence</div>{topic.evidence.length ? <div className="mt-2 space-y-2">{topic.evidence.map((evidence) => <article key={evidence.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div className="text-sm font-extrabold text-slate-800">{evidence.heading}</div><span className="text-xs font-semibold text-amber-800">{evidence.trustLabel} · authority {evidence.authority}</span></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{evidence.text}</p>{evidence.sourceUrl ? <a href={evidence.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-extrabold text-red-600 hover:underline">Open source message <ExternalLink className="size-3" /></a> : <p className="mt-2 text-xs text-slate-500">Source reference preserved; no safe direct link is available.</p>}</article>)}</div> : <p className="mt-2 rounded-lg border border-red-200 bg-white p-3 text-sm leading-6 text-red-700">The deployed registry records this blocker, but no comparison evidence could be resolved. Approval remains unavailable until a policy owner supplies it.</p>}</div><div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm leading-6 text-blue-900"><span className="font-extrabold">What you are deciding:</span> {weakMatch ? "whether a policy owner should correct this automated topic match before any content decision is made." : "whether the new proposal should become the official rule, should apply only in a clearly documented scope, or should wait for a policy owner."}</div><details className="mt-3"><summary className="cursor-pointer text-xs font-bold text-slate-500">Technical audit details</summary><div className="mt-2 rounded-lg bg-slate-950 p-3 font-mono text-xs text-slate-200">Blocked topic ID: {topic.id}<br />Source references: {topic.sourceIds.join(", ") || "none recorded"}</div></details></section>;
}

function PolicyMatchCard({ policy }: { policy: Record<string, unknown> }) {
  const scopes = Array.isArray(policy.productScopes) ? policy.productScopes.join(", ") : "Not recorded";
  return <article className="rounded-lg border border-slate-200 bg-slate-50 p-3"><div className="text-sm font-extrabold text-slate-800">{String(policy.title || "Related governed policy")}</div><p className="mt-1 text-sm leading-6 text-slate-600">{String(policy.decision || "No decision text recorded.")}</p><div className="mt-2 text-xs text-slate-500">Scope: {scopes} · Effective: {String(policy.effectiveAt || "Not recorded")}</div></article>;
}

function Pagination({ overview }: { overview: Overview }) { const previous = Math.max(1, overview.pagination.page - 1); const next = Math.min(overview.pagination.totalPages, overview.pagination.page + 1); return <div className="flex items-center justify-between border-t border-slate-100 p-4"><a aria-disabled={overview.pagination.page <= 1} href={queueHref(overview, { page: previous })} className={`inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-extrabold ${overview.pagination.page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-slate-50"}`}><ChevronLeft className="size-4" /> Previous</a><span className="text-xs font-semibold text-slate-500">Page {overview.pagination.page} of {overview.pagination.totalPages}</span><a aria-disabled={overview.pagination.page >= overview.pagination.totalPages} href={queueHref(overview, { page: next })} className={`inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-extrabold ${overview.pagination.page >= overview.pagination.totalPages ? "pointer-events-none opacity-40" : "hover:bg-slate-50"}`}>Next <ChevronRight className="size-4" /></a></div>; }
function queueHref(overview: Overview, changes: { view?: KnowledgeRefreshQueueView; page?: number }) { const params = new URLSearchParams(); params.set("view", changes.view || overview.filters.view); if (overview.filters.query) params.set("q", overview.filters.query); if (overview.filters.sourceKind !== "all") params.set("source", overview.filters.sourceKind); if (overview.filters.conflictLevel !== "all") params.set("conflict", overview.filters.conflictLevel); if ((changes.page || 1) > 1) params.set("page", String(changes.page)); return `/ask-sales-faq/admin/knowledge-refresh?${params}`; }
function SourceCard({ source }: { source: KnowledgeRefreshSourceRow }) { const healthy = source.availability === "available" || source.availability === "replacement_active"; const Icon = healthy ? CheckCircle2 : source.availability === "unavailable" ? AlertTriangle : CircleDashed; return <article className="min-w-0 bg-white p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><a href={source.url} target="_blank" rel="noreferrer" className="line-clamp-1 font-extrabold text-slate-800 hover:text-red-600">{source.label}</a><p className="mt-1 text-xs font-semibold text-slate-400">{source.kind.replaceAll("_", " ")}</p></div><Icon className={`size-5 shrink-0 ${healthy ? "text-emerald-500" : source.availability === "unavailable" ? "text-amber-500" : "text-slate-300"}`} /></div><div className="mt-3 text-xs leading-5 text-slate-500"><div>Last checked: {formatDate(source.last_checked_at)}</div><div>Last changed: {formatDate(source.last_changed_at)}</div>{source.last_error ? <p className="mt-2 line-clamp-2 font-semibold text-amber-700">{source.last_error}</p> : null}</div></article>; }
function ReleaseHistory({
  releases,
  publishEnabled,
  busyReleaseId,
  onAction,
}: {
  releases: KnowledgeRefreshReleaseRow[];
  publishEnabled: boolean;
  busyReleaseId: string | null;
  onAction: (release: KnowledgeRefreshReleaseRow, action: "create_pull_requests" | "publish_verified_release") => void;
}) {
  return <section className="magic-card overflow-hidden"><div className="border-b border-slate-100 p-5"><h2 className="text-lg font-extrabold text-slate-950">Release history and test previews</h2><p className="mt-1 text-sm text-slate-500">Open a preview to compare the current official answer with the proposed replacement. A preview alone never changes production.</p></div><div className="divide-y divide-slate-100">{releases.map((release, index) => {
    const faq = releasePr(release.publication, "faq");
    const dashboard = releasePr(release.publication, "dashboard");
    const preview = releasePreviewItems(release.manifest);
    const creatingAllowed = ["awaiting_final_publish", "publication_failed"].includes(release.status);
    const publishAllowed = ["prs_ready", "deployment_failed"].includes(release.status);
    const busy = busyReleaseId === release.id || ["creating_pull_requests", "publishing"].includes(release.status);
    return <article key={release.id} className="p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0"><div className="font-extrabold text-slate-800">{release.id}</div><div className="mt-1 text-xs text-slate-500">{release.candidate_ids.length} accepted draft{release.candidate_ids.length === 1 ? "" : "s"} · created by {release.created_by} · {formatDate(release.created_at)}</div>{faq || dashboard ? <div className="mt-2 flex flex-wrap gap-3 text-xs font-bold">{faq ? <a href={faq.url} target="_blank" rel="noreferrer" className="text-red-600 hover:underline">FAQ source PR #{faq.number}</a> : null}{dashboard ? <a href={dashboard.url} target="_blank" rel="noreferrer" className="text-red-600 hover:underline">Dashboard runtime PR #{dashboard.number}</a> : null}</div> : null}{release.last_error ? <p className="mt-2 max-w-3xl text-xs leading-5 text-red-700">{release.last_error}</p> : null}</div>
        <div className="flex shrink-0 flex-wrap items-center gap-2"><StatusBadge status={release.status} />{publishEnabled && creatingAllowed ? <button type="button" disabled={busy} onClick={() => onAction(release, "create_pull_requests")} className="h-9 rounded-full border border-slate-300 bg-white px-3 text-xs font-extrabold text-slate-800 hover:bg-slate-50 disabled:opacity-50">Create release PRs</button> : null}{publishEnabled && publishAllowed ? <button type="button" disabled={busy} onClick={() => onAction(release, "publish_verified_release")} className="h-9 rounded-full bg-[#DC2626] px-3 text-xs font-extrabold text-white hover:bg-red-700 disabled:opacity-50">{release.status === "deployment_failed" ? "Retry verification" : "Publish verified release"}</button> : null}</div>
      </div>
      {preview.length ? <details open={index === 0 && release.status === "awaiting_final_publish"} className="mt-4 rounded-xl border border-blue-200 bg-blue-50/40 p-4"><summary className="cursor-pointer text-sm font-extrabold text-blue-900">View test preview ({preview.length} compiled polic{preview.length === 1 ? "y" : "ies"})</summary><div className="mt-4 space-y-4">{preview.map((item, previewIndex) => <article key={`${item.title}-${previewIndex}`} className="rounded-xl border border-slate-200 bg-white p-4"><h3 className="font-extrabold text-slate-900">{item.title}</h3><div className="mt-3 grid gap-3 lg:grid-cols-2"><div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><div className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Current official answer</div>{item.currentOfficialAnswers.length ? <div className="mt-2 space-y-3">{item.currentOfficialAnswers.map((answer, answerIndex) => <div key={`${answer.title}-${answerIndex}`}><div className="text-xs font-extrabold text-slate-700">{answer.title}</div><p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-600">{answer.decision}</p></div>)}</div> : <p className="mt-2 text-xs leading-5 text-slate-600">No current policy will be removed. This is a new governed answer.</p>}</div><div className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-3"><div className="text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-700">Proposed official answer</div><p className="mt-2 whitespace-pre-wrap text-xs font-semibold leading-5 text-slate-700">{item.proposedAnswer}</p></div></div></article>)}</div><p className="mt-4 text-xs font-semibold text-blue-900">Preview only: production is unchanged. Continue only if this comparison is correct.</p></details> : null}
    </article>;
  })}{!releases.length ? <div className="p-6 text-sm text-slate-500">No release has been prepared yet.</div> : null}</div></section>;
}

type ReleasePreviewItem = {
  title: string;
  proposedAnswer: string;
  currentOfficialAnswers: Array<{ title: string; decision: string }>;
};

function releasePreviewItems(manifest: Record<string, unknown>): ReleasePreviewItem[] {
  const value = manifest.releasePreview;
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const title = typeof record.title === "string" ? record.title : "Proposed governed policy";
    const proposedAnswer = typeof record.proposedAnswer === "string" ? record.proposedAnswer : "";
    if (!proposedAnswer) return [];
    const currentOfficialAnswers = Array.isArray(record.currentOfficialAnswers)
      ? record.currentOfficialAnswers.flatMap((answer) => {
          if (!answer || typeof answer !== "object") return [];
          const current = answer as Record<string, unknown>;
          if (typeof current.decision !== "string") return [];
          return [{
            title: typeof current.title === "string" ? current.title : "Current governed policy",
            decision: current.decision,
          }];
        })
      : [];
    return [{ title, proposedAnswer, currentOfficialAnswers }];
  });
}

function releasePr(publication: Record<string, unknown>, key: "faq" | "dashboard") {
  const value = publication?.[key];
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const number = Number(record.number);
  const url = typeof record.url === "string" ? record.url : "";
  return Number.isInteger(number) && number > 0 && /^https:\/\/github\.com\/Inside-Success\//.test(url) ? { number, url } : null;
}
function Metric({ label, value, tone }: { label: string; value: string | number; tone: "default" | "good" | "warning" }) { const color = tone === "good" ? "text-emerald-600" : tone === "warning" ? "text-amber-600" : "text-slate-950"; return <article className="magic-card p-4"><div className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{label}</div><div className={`mt-3 text-3xl font-extrabold ${color}`}>{value}</div></article>; }
function Detail({ label, value }: { label: string; value: string }) { return <div><div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</div><p className="mt-1 text-sm leading-6 text-slate-600">{value}</p></div>; }
function ActionButton({ disabled, onClick, label }: { disabled: boolean; onClick: () => void; label: string }) { return <button type="button" disabled={disabled} onClick={onClick} className="h-9 rounded-lg border border-slate-200 text-xs font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{label}</button>; }
function StatusBadge({ status }: { status: string }) { return <Badge variant="outline" className="w-fit border-slate-200 bg-slate-50 text-slate-700">{status.replaceAll("_", " ")}</Badge>; }
function ConflictBadge({ level }: { level: KnowledgeRefreshCandidateRow["conflict_level"] }) { const color = level === "none" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : level === "possible" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-red-200 bg-red-50 text-red-700"; const Icon = level === "none" ? ShieldCheck : level === "possible" ? ShieldAlert : AlertTriangle; return <Badge variant="outline" className={color}><Icon className="mr-1 size-3" />{level} conflict</Badge>; }
function RunStat({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "warning" }) {
  return <div className={`rounded-xl border p-3 ${tone === "warning" ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"}`}><div className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">{label}</div><div className={`mt-2 text-xl font-extrabold ${tone === "warning" ? "text-amber-700" : "text-slate-900"}`}>{value}</div></div>;
}
function formatDate(value: string | null | undefined) { return value ? formatMiamiDateTime(value) : "Not yet"; }

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  ExternalLink,
  FileCheck2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type {
  KnowledgeRefreshCandidateRow,
  KnowledgeRefreshConflictResolution,
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
  summary: { needs_review: number; needs_owner: number; approved_content: number; stale: number };
};

type ReviewAction = "approve_content" | "reject" | "defer" | "needs_owner" | "duplicate" | "engineering_required";

export function KnowledgeRefreshConsole({ overview }: { overview: Overview }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const available = overview.sources.filter((source) => source.availability === "available" || source.availability === "replacement_active").length;
  const unavailable = overview.sources.filter((source) => source.availability === "unavailable").length;
  const approved = overview.candidates.filter((candidate) => candidate.status === "approved_content");

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function prepareRelease() {
    if (!selected.length) return;
    if (!window.confirm(`Prepare a governed release manifest for ${selected.length} approved proposal${selected.length === 1 ? "" : "s"}? This will not publish to production.`)) return;
    setMessage(null);
    try {
      const response = await fetch("/api/ask-sales-faq/admin/knowledge-refresh/releases", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ candidateIds: selected }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage({ tone: "bad", text: body.message || "Release preparation failed safely." });
        return;
      }
      setSelected([]);
      setMessage({ tone: "good", text: `Release ${body.releaseId} was prepared. Production was not changed.` });
      refresh();
    } catch {
      setMessage({ tone: "bad", text: "Release preparation could not reach the server. Production was not changed." });
    }
  }

  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Needs review" value={overview.summary.needs_review} tone={overview.summary.needs_review ? "warning" : "good"} />
        <Metric label="Needs owner" value={overview.summary.needs_owner} tone={overview.summary.needs_owner ? "warning" : "default"} />
        <Metric label="Content approved" value={overview.summary.approved_content} tone="good" />
        <Metric label="Sources healthy" value={`${available}/${overview.sources.length}`} tone={unavailable ? "warning" : "good"} />
        <Metric label="Stale proposals" value={overview.summary.stale} tone={overview.summary.stale ? "warning" : "default"} />
      </section>

      <section className="magic-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-emerald-600" />
              <h2 className="text-lg font-extrabold text-slate-950">Production safety boundary</h2>
            </div>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
              Approval records a human content decision only. Preparing a release creates an immutable implementation manifest. The live V3 knowledge registry remains unchanged until a reviewed Git change passes compilers, tests, deployment checks, and signed-in production smoke tests.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-slate-200 bg-slate-50">V3 {overview.knowledgeVersion}</Badge>
            <Badge variant="outline" className={overview.publishEnabled ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}>
              {overview.publishEnabled ? "Publication integration enabled" : "Direct publication disabled"}
            </Badge>
            <button type="button" disabled={isPending} onClick={refresh} className="inline-flex h-9 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-xs font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              <RefreshCw className={`size-3.5 ${isPending ? "animate-spin" : ""}`} /> Refresh
            </button>
          </div>
        </div>
      </section>

      {message ? <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${message.tone === "good" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>{message.text}</div> : null}

      <section className="magic-card overflow-hidden">
        <div className="border-b border-slate-100 p-5">
          <h2 className="text-lg font-extrabold text-slate-950">Daily source health</h2>
          <p className="mt-1 text-sm text-slate-500">Scheduled daily at 9:00 PM Miami time. Unavailable replacement sources remain visible and are retried on later runs.</p>
        </div>
        <div className="grid gap-px bg-slate-100 sm:grid-cols-2 xl:grid-cols-3">
          {overview.sources.map((source) => <SourceCard key={source.id} source={source} />)}
        </div>
      </section>

      <section className="magic-card overflow-hidden">
        <div className="border-b border-slate-100 p-5">
          <h2 className="text-lg font-extrabold text-slate-950">Human review queue</h2>
          <p className="mt-1 text-sm text-slate-500">AI extracts proposals; deterministic governance finds likely conflicts. An admin must verify the quoted source, scope, authority, and effective date.</p>
        </div>
        <div className="divide-y divide-slate-100">
          {overview.candidates.filter((candidate) => ["needs_review", "needs_owner", "deferred"].includes(candidate.status)).map((candidate) => (
            <CandidateReview key={candidate.id} candidate={candidate} onDone={(text, tone) => { setMessage({ text, tone }); refresh(); }} />
          ))}
          {!overview.candidates.some((candidate) => ["needs_review", "needs_owner", "deferred"].includes(candidate.status)) ? <div className="p-6 text-sm text-slate-500">No proposals currently require a decision.</div> : null}
        </div>
      </section>

      <section className="magic-card overflow-hidden">
        <div className="border-b border-slate-100 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-slate-950">Release preparation</h2>
              <p className="mt-1 text-sm text-slate-500">Select content-approved proposals to create a reviewed Git-release manifest. This action does not publish.</p>
            </div>
            <button type="button" onClick={prepareRelease} disabled={!selected.length} className="inline-flex h-10 items-center gap-2 rounded-full bg-[#DC2626] px-4 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:bg-slate-300">
              <FileCheck2 className="size-4" /> Prepare release ({selected.length})
            </button>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {approved.map((candidate) => (
            <label key={candidate.id} className="flex cursor-pointer items-start gap-3 p-5 hover:bg-slate-50">
              <input type="checkbox" className="mt-1 size-4 accent-red-600" checked={selected.includes(candidate.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, candidate.id] : current.filter((id) => id !== candidate.id))} />
              <span className="min-w-0"><span className="block font-extrabold text-slate-800">{candidate.title}</span><span className="mt-1 block text-sm leading-6 text-slate-500">{candidate.proposed_policy}</span><span className="mt-2 block text-xs font-semibold text-slate-400">Approved by {candidate.approved_by || "admin"} · {formatDate(candidate.approved_at)}</span></span>
            </label>
          ))}
          {!approved.length ? <div className="p-6 text-sm text-slate-500">No content-approved proposals are waiting for release preparation.</div> : null}
        </div>
      </section>

      <ReleaseHistory releases={overview.releases} />
    </>
  );
}

function CandidateReview({ candidate, onDone }: { candidate: KnowledgeRefreshCandidateRow; onDone: (text: string, tone: "good" | "bad") => void }) {
  const [note, setNote] = useState(candidate.review_note || "");
  const [resolution, setResolution] = useState<KnowledgeRefreshConflictResolution | "">(candidate.conflict_resolution || "");
  const [busy, setBusy] = useState(false);
  const conflictNeedsDecision = candidate.conflict_level === "direct" || candidate.conflict_level === "blocked";

  async function act(action: ReviewAction) {
    if (action === "approve_content" && !window.confirm("Approve this proposal as content-ready for a governed release? This will not publish it to production.")) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/ask-sales-faq/admin/knowledge-refresh/candidates/${encodeURIComponent(candidate.id)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expectedVersion: candidate.version, action, note: note || null, conflictResolution: resolution || null }),
      });
      const body = await response.json().catch(() => ({}));
      onDone(response.ok ? `${candidate.title}: decision recorded. Production was not changed.` : body.message || "The decision failed safely.", response.ok ? "good" : "bad");
    } catch {
      onDone("The review server could not be reached. No decision was recorded.", "bad");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={candidate.status} />
            <ConflictBadge level={candidate.conflict_level} />
            <Badge variant="outline">AI confidence {Math.round(candidate.ai_confidence * 100)}%</Badge>
            <span className="text-xs text-slate-400">{formatDate(candidate.created_at)}</span>
          </div>
          <h3 className="mt-3 text-lg font-extrabold text-slate-950">{candidate.title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{candidate.summary}</p>
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Proposed governed policy</div>
            <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-800">{candidate.proposed_policy}</p>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Detail label="Why it may matter" value={candidate.rationale} />
            <Detail label="Conflict check" value={candidate.conflict_summary} />
            <Detail label="Product scopes" value={candidate.product_scopes.join(", ")} />
            <Detail label="Decision key / effective date" value={`${candidate.decision_key || "New or unclassified"} · ${candidate.effective_date || "Not stated"}`} />
          </div>
          <details className="mt-4 rounded-xl border border-slate-200 p-4">
            <summary className="cursor-pointer text-sm font-extrabold text-slate-700">Source evidence and governed-policy matches</summary>
            <div className="mt-3 space-y-3">
              {candidate.evidence_quotes.map((quote, index) => <blockquote key={index} className="border-l-2 border-red-200 pl-3 text-sm italic leading-6 text-slate-600">“{quote}”</blockquote>)}
              {candidate.related_policies.length ? <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-3 text-xs text-slate-200">{JSON.stringify(candidate.related_policies, null, 2)}</pre> : <p className="text-sm text-slate-500">No close governed policy was found.</p>}
              <a href={candidate.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-bold text-red-600 hover:underline">Open source <ExternalLink className="size-3.5" /></a>
            </div>
          </details>
        </div>
        <div className="w-full shrink-0 space-y-3 rounded-xl border border-slate-200 bg-white p-4 xl:w-80">
          <label className="block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Reviewer note</label>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} rows={4} placeholder="Record authority, scope, exceptions, or rejection reason." className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-red-300" />
          {conflictNeedsDecision ? (
            <><label className="block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Required conflict decision</label><select value={resolution} onChange={(event) => setResolution(event.target.value as KnowledgeRefreshConflictResolution | "")} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"><option value="">Choose before approval</option><option value="supersede">Supersede existing rule</option><option value="scoped_coexistence">Coexist in an explicit scope</option><option value="existing_remains">Existing rule remains</option><option value="owner_needed">Policy owner needed</option><option value="historical_case">Historical case only</option><option value="engineering_required">Engineering change required</option></select></>
          ) : null}
          <button type="button" onClick={() => act("approve_content")} disabled={busy || (conflictNeedsDecision && !["supersede", "scoped_coexistence"].includes(resolution))} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 text-sm font-extrabold text-white disabled:bg-slate-300"><CheckCircle2 className="size-4" /> Approve content</button>
          <div className="grid grid-cols-2 gap-2">
            <ActionButton disabled={busy} onClick={() => act("needs_owner")} label="Needs owner" />
            <ActionButton disabled={busy} onClick={() => act("defer")} label="Defer" />
            <ActionButton disabled={busy} onClick={() => act("duplicate")} label="Duplicate" />
            <ActionButton disabled={busy} onClick={() => act("engineering_required")} label="Engineering" />
          </div>
          <button type="button" onClick={() => act("reject")} disabled={busy} className="h-9 w-full rounded-lg border border-red-200 text-xs font-extrabold text-red-700 hover:bg-red-50 disabled:opacity-50">Reject proposal</button>
        </div>
      </div>
    </article>
  );
}

function SourceCard({ source }: { source: KnowledgeRefreshSourceRow }) {
  const healthy = source.availability === "available" || source.availability === "replacement_active";
  const Icon = healthy ? CheckCircle2 : source.availability === "unavailable" ? AlertTriangle : CircleDashed;
  return <article className="min-w-0 bg-white p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><a href={source.url} target="_blank" rel="noreferrer" className="line-clamp-1 font-extrabold text-slate-800 hover:text-red-600">{source.label}</a><p className="mt-1 text-xs font-semibold text-slate-400">{source.kind.replaceAll("_", " ")}</p></div><Icon className={`size-5 shrink-0 ${healthy ? "text-emerald-500" : source.availability === "unavailable" ? "text-amber-500" : "text-slate-300"}`} /></div><div className="mt-3 text-xs leading-5 text-slate-500"><div>Last checked: {formatDate(source.last_checked_at)}</div><div>Last changed: {formatDate(source.last_changed_at)}</div>{source.last_error ? <p className="mt-2 line-clamp-2 font-semibold text-amber-700">{source.last_error}</p> : null}</div></article>;
}

function ReleaseHistory({ releases }: { releases: KnowledgeRefreshReleaseRow[] }) {
  return <section className="magic-card overflow-hidden"><div className="border-b border-slate-100 p-5"><h2 className="text-lg font-extrabold text-slate-950">Release history</h2><p className="mt-1 text-sm text-slate-500">Audit records for prepared and validated knowledge releases.</p></div><div className="divide-y divide-slate-100">{releases.map((release) => <article key={release.id} className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between"><div><div className="font-extrabold text-slate-800">{release.id}</div><div className="mt-1 text-xs text-slate-500">{release.candidate_ids.length} proposal{release.candidate_ids.length === 1 ? "" : "s"} · created by {release.created_by} · {formatDate(release.created_at)}</div></div><StatusBadge status={release.status} /></article>)}{!releases.length ? <div className="p-6 text-sm text-slate-500">No release has been prepared yet.</div> : null}</div></section>;
}

function Metric({ label, value, tone }: { label: string; value: string | number; tone: "default" | "good" | "warning" }) { const color = tone === "good" ? "text-emerald-600" : tone === "warning" ? "text-amber-600" : "text-slate-950"; return <article className="magic-card p-4"><div className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{label}</div><div className={`mt-3 text-3xl font-extrabold ${color}`}>{value}</div></article>; }
function Detail({ label, value }: { label: string; value: string }) { return <div><div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</div><p className="mt-1 text-sm leading-6 text-slate-600">{value}</p></div>; }
function ActionButton({ disabled, onClick, label }: { disabled: boolean; onClick: () => void; label: string }) { return <button type="button" disabled={disabled} onClick={onClick} className="h-9 rounded-lg border border-slate-200 text-xs font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{label}</button>; }
function StatusBadge({ status }: { status: string }) { return <Badge variant="outline" className="w-fit border-slate-200 bg-slate-50 text-slate-700">{status.replaceAll("_", " ")}</Badge>; }
function ConflictBadge({ level }: { level: KnowledgeRefreshCandidateRow["conflict_level"] }) { const color = level === "none" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : level === "possible" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-red-200 bg-red-50 text-red-700"; const Icon = level === "none" ? ShieldCheck : level === "possible" ? ShieldAlert : AlertTriangle; return <Badge variant="outline" className={color}><Icon className="mr-1 size-3" />{level} conflict</Badge>; }
function formatDate(value: string | null | undefined) { if (!value) return "Not yet"; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date); }

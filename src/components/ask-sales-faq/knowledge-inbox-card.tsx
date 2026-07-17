"use client";

import { useState } from "react";
import { CheckCircle2, ExternalLink, HelpCircle, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type {
  KnowledgeRefreshCandidateRow,
  KnowledgeRefreshConflictResolution,
} from "@/lib/ask-sales-faq/knowledge-refresh-store";

type ReviewAction = "approve_content" | "reject" | "needs_owner" | "duplicate";

export function KnowledgeInboxCard({
  candidate,
  selected,
  onSelected,
  onDone,
}: {
  candidate: KnowledgeRefreshCandidateRow;
  selected: boolean;
  onSelected: (checked: boolean) => void;
  onDone: (text: string, tone: "good" | "bad") => void;
}) {
  const [policy, setPolicy] = useState(candidate.proposed_policy);
  const [note, setNote] = useState(candidate.review_note || "");
  const [resolution, setResolution] = useState<KnowledgeRefreshConflictResolution | "">(
    candidate.conflict_resolution || "",
  );
  const [busy, setBusy] = useState(false);
  const canReview = ["needs_review", "needs_owner", "deferred"].includes(candidate.status);
  const policyEdited = policy.trim() !== candidate.proposed_policy.trim();
  const hardConflict = candidate.conflict_level === "direct" || candidate.conflict_level === "blocked";
  const unreliableLegacyMatch = candidate.conflict_level === "blocked" &&
    (candidate.blocked_topics.length !== 1 || candidate.blocked_topics.some((topic) => !topic.reviewReady));
  const canAccept = candidate.candidate_kind !== "knowledge_gap" &&
    !unreliableLegacyMatch &&
    policy.trim().length > 0 &&
    (!hardConflict || ["supersede", "scoped_coexistence"].includes(resolution)) &&
    (!hardConflict || note.trim().length > 0) &&
    (!policyEdited || note.trim().length > 0);
  const currentPolicies = Array.from(new Map([
    ...candidate.related_policies,
    ...candidate.blocked_topics.flatMap((topic) => topic.currentPolicies),
  ].map((item) => [String(item.id || ""), item])).values()).filter((item) => item.id);

  async function act(action: ReviewAction, conflictResolution?: KnowledgeRefreshConflictResolution | null) {
    const labels: Record<ReviewAction, string> = {
      approve_content: policyEdited ? "save the edited wording as an accepted draft" : "accept this update as a draft",
      reject: "keep the current knowledge and reject this proposal",
      needs_owner: "send this item for confirmation",
      duplicate: "ignore this item as non-actionable or duplicate",
    };
    if (!window.confirm(`Do you want to ${labels[action]}? Nothing will be published to the chatbot yet.`)) return;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/ask-sales-faq/admin/knowledge-refresh/candidates/${encodeURIComponent(candidate.id)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            expectedVersion: candidate.version,
            action,
            note: note.trim() || null,
            editedPolicy: action === "approve_content" && policyEdited ? policy.trim() : null,
            conflictResolution: conflictResolution ?? (action === "approve_content" ? resolution || null : null),
          }),
        },
      );
      const body = await response.json().catch(() => ({}));
      onDone(
        response.ok
          ? `${candidate.title}: saved. The production chatbot was not changed.`
          : body.message || "The decision failed safely.",
        response.ok ? "good" : "bad",
      );
    } catch {
      onDone("The review server could not be reached. No decision was saved.", "bad");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="p-5">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {canReview ? (
              <input
                aria-label={`Select ${candidate.title}`}
                type="checkbox"
                checked={selected}
                onChange={(event) => onSelected(event.target.checked)}
                className="size-4 accent-red-600"
              />
            ) : null}
            <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
              {candidate.candidate_kind === "knowledge_gap" ? "Repeated question without a rule" :
                candidate.candidate_kind === "rule_change" ? "Possible rule change" :
                  candidate.candidate_kind === "clarification" ? "Possible clarification" : "Possible new rule"}
            </Badge>
            <Badge variant="outline">{candidate.source_label}</Badge>
            {candidate.authority_name ? <Badge variant="outline">Named source: {candidate.authority_name}</Badge> : null}
          </div>

          <h3 className="mt-3 text-lg font-extrabold text-slate-950">{candidate.title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{candidate.summary}</p>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <section className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700">Proposed chatbot answer</div>
              <textarea
                value={policy}
                onChange={(event) => setPolicy(event.target.value)}
                rows={6}
                maxLength={6000}
                className="mt-2 w-full resize-y rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold leading-6 text-slate-800"
              />
              {policyEdited ? <p className="mt-2 text-xs font-semibold text-emerald-700">Edited wording will be rechecked before it is saved.</p> : null}
            </section>

            <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Current official answer</div>
              {currentPolicies.length ? (
                <div className="mt-2 space-y-3">
                  {currentPolicies.slice(0, 3).map((item) => (
                    <div key={String(item.id)}>
                      <div className="text-sm font-extrabold text-slate-800">{String(item.title || "Current policy")}</div>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{String(item.decision || "")}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm leading-6 text-slate-600">No existing official answer was found for this exact decision.</p>
              )}
            </section>
          </div>

          {unreliableLegacyMatch ? (
            <div className="mt-3 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              <ShieldAlert className="mt-0.5 size-5 shrink-0" />
              <p><span className="font-extrabold">The old automatic comparison is not reliable.</span> This item cannot be accepted. Choose Needs confirmation if the rule matters, or Ignore if the source and proposal are unrelated.</p>
            </div>
          ) : null}

          <details className="mt-4 rounded-xl border border-slate-200 p-4">
            <summary className="cursor-pointer text-sm font-extrabold text-slate-700">Why this appeared and source evidence</summary>
            <div className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
              <p>{candidate.rationale}</p>
              {candidate.evidence_quotes.map((quote, index) => (
                <blockquote key={index} className="border-l-2 border-red-200 pl-3 italic">“{quote}”</blockquote>
              ))}
              {candidate.authority_basis ? <p><span className="font-extrabold text-slate-800">Authority evidence:</span> {candidate.authority_basis}</p> : null}
              <a href={candidate.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-bold text-red-600 hover:underline">
                Open read-only source <ExternalLink className="size-3.5" />
              </a>
            </div>
          </details>
        </div>

        {canReview ? (
          <aside className="w-full shrink-0 space-y-3 rounded-xl border border-slate-200 bg-white p-4 xl:w-80">
            {hardConflict && !unreliableLegacyMatch ? (
              <>
                <label className="block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">How should the exact conflict be handled?</label>
                <select
                  value={resolution}
                  onChange={(event) => setResolution(event.target.value as KnowledgeRefreshConflictResolution | "")}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                >
                  <option value="">Choose one</option>
                  <option value="supersede">Replace the current answer</option>
                  <option value="scoped_coexistence">Both apply in different situations</option>
                </select>
              </>
            ) : null}
            <label className="block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Optional review note</label>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Who confirmed this, its scope, or why you made this choice."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
            />
            <button
              type="button"
              disabled={busy || !canAccept}
              onClick={() => act("approve_content")}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 text-sm font-extrabold text-white disabled:bg-slate-300"
            >
              <CheckCircle2 className="size-4" /> {policyEdited ? "Save edit and accept" : "Accept update"}
            </button>
            {candidate.candidate_kind === "knowledge_gap" ? (
              <p className="text-xs leading-5 text-slate-500">A question without an official answer cannot be accepted as policy. Ask for confirmation instead.</p>
            ) : null}
            <button type="button" disabled={busy} onClick={() => act("reject", "existing_remains")} className="h-9 w-full rounded-lg border border-slate-200 text-xs font-extrabold text-slate-700 hover:bg-slate-50">Keep current answer</button>
            <button type="button" disabled={busy} onClick={() => act("needs_owner", "owner_needed")} className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-amber-200 text-xs font-extrabold text-amber-800 hover:bg-amber-50"><HelpCircle className="size-4" /> Needs confirmation</button>
            <button type="button" disabled={busy} onClick={() => act("duplicate")} className="h-9 w-full rounded-lg border border-slate-200 text-xs font-extrabold text-slate-500 hover:bg-slate-50">Ignore</button>
            <p className="text-xs leading-5 text-slate-500">Accepting only creates a reviewed draft. It does not change the live chatbot.</p>
          </aside>
        ) : (
          <aside className="w-full shrink-0 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600 xl:w-80">
            <div className="font-extrabold text-slate-800">Review saved</div>
            <p className="mt-1">This audit record is preserved. It is not live knowledge.</p>
          </aside>
        )}
      </div>
    </article>
  );
}

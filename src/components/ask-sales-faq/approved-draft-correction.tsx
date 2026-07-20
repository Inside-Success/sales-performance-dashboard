"use client";

import { useState } from "react";
import { CheckCircle2, HelpCircle, LoaderCircle, ShieldCheck } from "lucide-react";

import { hasUnresolvedPolicyWording } from "@/lib/ask-sales-faq/knowledge-refresh-release-readiness";
import type {
  KnowledgeRefreshCandidateRow,
  KnowledgeRefreshConflictResolution,
} from "@/lib/ask-sales-faq/knowledge-refresh-store";

type CorrectionAction = "approve_content" | "reject" | "needs_owner";

export function ApprovedDraftCorrection({
  candidate,
  onDone,
}: {
  candidate: KnowledgeRefreshCandidateRow;
  onDone: (text: string, tone: "good" | "bad") => void;
}) {
  const [policy, setPolicy] = useState(candidate.proposed_policy);
  const [note, setNote] = useState(candidate.review_note || "");
  const [resolution, setResolution] = useState<KnowledgeRefreshConflictResolution | "">(
    candidate.conflict_resolution || "",
  );
  const [busyAction, setBusyAction] = useState<CorrectionAction | null>(null);
  const policyEdited = policy.trim() !== candidate.proposed_policy.trim();
  const unresolvedWording = hasUnresolvedPolicyWording(policy);
  const hardConflict = candidate.conflict_level === "direct" || candidate.conflict_level === "blocked";
  const resolutionReady = !hardConflict || ["supersede", "scoped_coexistence"].includes(resolution);
  const canSave = policyEdited && note.trim().length > 0 && !unresolvedWording && resolutionReady;
  const canKeepCurrent = note.trim().length > 0;

  async function act(action: CorrectionAction) {
    const prompts: Record<CorrectionAction, string> = {
      approve_content: "Save this corrected final rule as the approved draft? It will be rechecked, and production will remain unchanged.",
      reject: "Keep the current official answer and remove this proposal from the release queue? Production will remain unchanged.",
      needs_owner: "Send this proposal back for confirmation? Production will remain unchanged.",
    };
    if (!window.confirm(prompts[action])) return;
    setBusyAction(action);
    try {
      const response = await fetch(
        `/api/ask-sales-faq/admin/knowledge-refresh/candidates/${encodeURIComponent(candidate.id)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            expectedVersion: candidate.version,
            action,
            note: note.trim() || (action === "needs_owner" ? "Approved draft requires confirmation before release." : null),
            editedPolicy: action === "approve_content" ? policy.trim() : null,
            conflictResolution: action === "approve_content"
              ? resolution || null
              : action === "reject"
                ? "existing_remains"
                : "owner_needed",
          }),
        },
      );
      const body = await response.json().catch(() => ({}));
      onDone(
        response.ok
          ? action === "approve_content"
            ? `${candidate.title}: corrected draft saved and rechecked. Production was not changed.`
            : action === "reject"
              ? `${candidate.title}: current official answer kept. The proposal was removed from the release queue.`
              : `${candidate.title}: sent back for confirmation. Production was not changed.`
          : body.message || "The correction failed safely. Production was not changed.",
        response.ok ? "good" : "bad",
      );
    } catch {
      onDone("The review server could not be reached. Nothing was changed.", "bad");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <section className="w-full shrink-0 rounded-xl border border-red-200 bg-white p-4 lg:w-[30rem]">
      <div className="flex items-start gap-2">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-red-600" />
        <div>
          <h3 className="text-sm font-extrabold text-red-700">Correct or close this draft here</h3>
          <p className="mt-1 text-xs leading-5 text-slate-600">This red draft does not block any green draft. Its audit note is preserved, but it is not used as chatbot wording.</p>
        </div>
      </div>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-xs leading-5 text-red-700">
        {(candidate.release_readiness?.reasons.length
          ? candidate.release_readiness.reasons
          : ["Release readiness checks require a correction."]
        ).map((reason) => <li key={reason}>{reason}</li>)}
      </ul>
      {candidate.review_note ? (
        <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-900">
          <span className="font-extrabold">Your saved audit note:</span> {candidate.review_note}
          <div className="mt-1 text-blue-700">This note was saved correctly, but it does not replace Final chatbot rule below.</div>
        </div>
      ) : null}

      <label htmlFor={`approved-final-policy-${candidate.id}`} className="mt-4 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Final chatbot rule</label>
      <textarea
        id={`approved-final-policy-${candidate.id}`}
        value={policy}
        onChange={(event) => setPolicy(event.target.value)}
        rows={5}
        maxLength={6000}
        className="mt-2 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold leading-6 text-slate-800 outline-none focus:border-red-300"
      />
      <p className="mt-1 text-xs leading-5 text-slate-500">Edit this field when the proposed answer is wrong. Saving is blocked until it contains one final rule.</p>
      {unresolvedWording ? <p className="mt-1 text-xs font-semibold leading-5 text-red-700">The current wording still asks a question or gives alternatives instead of one final answer.</p> : null}

      <label htmlFor={`approved-audit-note-${candidate.id}`} className="mt-4 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Audit note (not the chatbot rule)</label>
      <textarea
        id={`approved-audit-note-${candidate.id}`}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="Who confirmed the final decision, its scope, or why the current answer should remain."
        className="mt-2 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm leading-6 text-slate-700 outline-none focus:border-red-300"
      />

      {hardConflict ? (
        <>
          <label htmlFor={`approved-conflict-${candidate.id}`} className="mt-4 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Conflict decision</label>
          <select
            id={`approved-conflict-${candidate.id}`}
            value={resolution}
            onChange={(event) => setResolution(event.target.value as KnowledgeRefreshConflictResolution | "")}
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
          >
            <option value="">Choose one before saving</option>
            <option value="supersede">Replace the current answer</option>
            <option value="scoped_coexistence">Both apply in different situations</option>
          </select>
        </>
      ) : null}

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          aria-busy={busyAction === "approve_content"}
          disabled={Boolean(busyAction) || !canSave}
          onClick={() => act("approve_content")}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 text-xs font-extrabold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {busyAction === "approve_content" ? <LoaderCircle className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} {busyAction === "approve_content" ? "Saving correction…" : "Save corrected draft"}
        </button>
        <button
          type="button"
          aria-busy={busyAction === "reject"}
          disabled={Boolean(busyAction) || !canKeepCurrent}
          onClick={() => act("reject")}
          className="h-10 rounded-lg border border-slate-300 px-3 text-xs font-extrabold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busyAction === "reject" ? <span className="inline-flex items-center gap-2"><LoaderCircle className="size-3.5 animate-spin" /> Saving decision…</span> : "Keep current answer"}
        </button>
      </div>
      <button
        type="button"
        aria-busy={busyAction === "needs_owner"}
        disabled={Boolean(busyAction)}
        onClick={() => act("needs_owner")}
        className="mt-2 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-amber-200 text-xs font-extrabold text-amber-800 hover:bg-amber-50 disabled:opacity-40"
      >
        {busyAction === "needs_owner" ? <LoaderCircle className="size-4 animate-spin" /> : <HelpCircle className="size-4" />} {busyAction === "needs_owner" ? "Saving decision…" : "Needs confirmation"}
      </button>
    </section>
  );
}

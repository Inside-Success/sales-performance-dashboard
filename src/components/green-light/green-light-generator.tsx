"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  LinkIcon,
  Loader2,
  RotateCw,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  assembleLetter,
  emptySections,
  type LetterSegment,
  otherShowMentions,
  splitLetter,
} from "@/lib/green-light/letter-sections";
import {
  GREEN_LIGHT_MIN_TRANSCRIPT_LENGTH,
  GREEN_LIGHT_SHOWS,
  type GreenLightShow,
  greenLightShowLabel,
  isZoomRecordingLink,
  parseFocusPoints,
} from "@/lib/green-light/shows";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "magic-mike-green-light-letters-v1";
const FIRST_POLL_DELAY_MS = 10000;
const POLL_INTERVAL_MS = 4000;
const MAX_WAIT_MS = 10 * 60 * 1000;

type InputType = "zoom_link" | "transcript";
type Multi = { enabled: boolean; letter_count: 1 | 2; position: 1 | 2; names: string[] };

type Draft = {
  id: string;
  prospectName: string;
  jobId: string;
  show: GreenLightShow;
  multi: Multi;
  segments: LetterSegment[];
  guestName: string;
  docTitle: string;
  warnings: string[];
  saved: { documentUrl: string; pdfUrl: string; docTitle: string; folder: string } | null;
};

type FormState = {
  show: GreenLightShow | "";
  inputType: InputType;
  zoomLink: string;
  transcript: string;
  multiEnabled: boolean;
  letterCount: 1 | 2;
  prospectName: string;
  firstName: string;
  secondName: string;
  focus: string;
  focusSecond: string;
};

const EMPTY_FORM: FormState = {
  show: "",
  inputType: "zoom_link",
  zoomLink: "",
  transcript: "",
  multiEnabled: false,
  letterCount: 2,
  prospectName: "",
  firstName: "",
  secondName: "",
  focus: "",
  focusSecond: "",
};

type Stored = { form: FormState; callTranscript: string; drafts: Draft[]; activeIndex: number; step: "details" | "review" };

class RequestError extends Error {
  code: string;
  constructor(message: string, code = "") {
    super(message);
    this.code = code;
  }
}

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
const tidyName = (value: string) => value.replace(/\s+/g, " ").trim();

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { ...init, headers: { "content-type": "application/json" }, cache: "no-store" });
  } catch {
    throw new RequestError("Could not reach Magic Mike. Check your connection and try again.", "network");
  }
  let payload: Record<string, unknown> = {};
  try {
    payload = (await response.json()) as Record<string, unknown>;
  } catch {
    payload = {};
  }
  if (!response.ok || payload.ok === false) {
    const message = typeof payload.error === "string" && payload.error ? payload.error : `Something went wrong (${response.status}). Try again; if it keeps happening, let Syed know.`;
    throw new RequestError(message, typeof payload.code === "string" ? payload.code : "");
  }
  return payload as T;
}

function readStored(): Stored | null {
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || "null") as Stored | null;
    if (!parsed || typeof parsed !== "object" || !parsed.form) return null;
    return {
      form: { ...EMPTY_FORM, ...parsed.form },
      callTranscript: typeof parsed.callTranscript === "string" ? parsed.callTranscript : "",
      drafts: Array.isArray(parsed.drafts) ? parsed.drafts : [],
      activeIndex: Number(parsed.activeIndex) || 0,
      step: parsed.step === "review" && Array.isArray(parsed.drafts) && parsed.drafts.length ? "review" : "details",
    };
  } catch {
    return null;
  }
}

const subscribeToNothing = () => () => {};

// The saved draft lives in sessionStorage, which only exists in the browser, so the generator
// itself is rendered on the client only and starts from whatever was saved.
export function GreenLightGenerator() {
  const isClient = useSyncExternalStore(subscribeToNothing, () => true, () => false);
  return isClient ? <Generator /> : <div className="magic-card p-7 text-sm font-medium text-slate-500">Loading the generator…</div>;
}

function Generator() {
  const [stored] = useState(readStored);
  const [form, setForm] = useState<FormState>(stored?.form ?? EMPTY_FORM);
  const [callTranscript, setCallTranscript] = useState(stored?.callTranscript ?? "");
  const [drafts, setDrafts] = useState<Draft[]>(stored?.drafts ?? []);
  const [activeIndex, setActiveIndex] = useState(stored ? Math.min(stored.activeIndex, Math.max(stored.drafts.length - 1, 0)) : 0);
  const [step, setStep] = useState<"details" | "review">(stored?.step ?? "details");
  const [busy, setBusy] = useState<{ title: string; detail: string } | null>(null);
  const [formError, setFormError] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [instructions, setInstructions] = useState("");
  const topRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef<HTMLElement>(null);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ form, callTranscript, drafts, activeIndex, step } satisfies Stored));
    } catch {
      // Restoring after a refresh is a convenience only.
    }
  }, [activeIndex, callTranscript, drafts, form, step]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFormError("");
  };

  const activeDraft = drafts[activeIndex] || null;
  const twoLetters = form.multiEnabled && form.letterCount === 2;

  const scrollToTop = () => window.requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));

  function validateForm() {
    if (!form.show) return "Pick the show this letter is for.";
    if (form.inputType === "zoom_link") {
      if (!form.zoomLink.trim()) return "Paste the Zoom recording link.";
      if (!isZoomRecordingLink(form.zoomLink)) return "That is not a Zoom recording link. Paste the recording share link, or use Paste transcript.";
    } else if (form.transcript.trim().length < GREEN_LIGHT_MIN_TRANSCRIPT_LENGTH) {
      return "Paste the full call transcript.";
    }
    if (!form.multiEnabled && tidyName(form.prospectName).length < 2) return "Enter the prospect's full name.";
    if (form.multiEnabled && form.letterCount === 1 && tidyName(form.prospectName).length < 2) return "Enter the name of the prospect this letter is for.";
    if (twoLetters && (tidyName(form.firstName).length < 2 || tidyName(form.secondName).length < 2)) return "Enter both prospects' full names.";
    if (twoLetters && tidyName(form.firstName).toLowerCase() === tidyName(form.secondName).toLowerCase()) return "The two prospects need different names.";
    return "";
  }

  async function waitForDraft(jobId: string) {
    const startedAt = Date.now();
    let failures = 0;
    let first = true;
    while (Date.now() - startedAt < MAX_WAIT_MS) {
      await wait(first ? FIRST_POLL_DELAY_MS : POLL_INTERVAL_MS);
      first = false;
      try {
        const result = await api<{ status: string; draft_text?: string; guest_name?: string; doc_title?: string; warnings?: string[]; error?: string }>(
          `/api/green-light/status?job_id=${encodeURIComponent(jobId)}`,
        );
        failures = 0;
        if (result.status === "complete") {
          if (!result.draft_text?.trim()) throw new RequestError("The letter came back empty. Generate it again.", "empty");
          return result;
        }
        if (result.status === "failed") throw new RequestError(result.error || "The letter could not be generated. Try again.", "failed");
      } catch (error) {
        if (error instanceof RequestError && ["signed_out", "not_allowed", "invalid", "empty", "failed"].includes(error.code)) throw error;
        failures += 1;
        if (failures >= 8) throw new RequestError("Lost contact while the letter was being written. Generate it again.", "network");
      }
    }
    throw new RequestError("The letter did not arrive within 10 minutes. Generate it again; if it keeps happening, let Syed know.", "timeout");
  }

  async function handleGenerate(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    const problem = validateForm();
    if (problem) {
      setFormError(problem);
      return;
    }
    setFormError("");
    setReviewError("");
    const show = form.show as GreenLightShow;

    try {
      let transcript = form.transcript.trim();
      if (form.inputType === "zoom_link") {
        setBusy({ title: "Getting the call from Zoom", detail: "Fetching the transcript of this recording." });
        transcript = (await api<{ transcript: string }>("/api/green-light/transcript", { method: "POST", body: JSON.stringify({ zoom_link: form.zoomLink.trim() }) })).transcript;
      }

      const requests = twoLetters
        ? [
            { prospectName: tidyName(form.firstName), position: 1 as const, focus: form.focus },
            { prospectName: tidyName(form.secondName), position: 2 as const, focus: form.focusSecond },
          ]
        : [{ prospectName: tidyName(form.prospectName), position: 1 as const, focus: form.focus }];
      const names = twoLetters ? requests.map((item) => item.prospectName) : [tidyName(form.prospectName)];

      const nextDrafts: Draft[] = [];
      for (const [index, item] of requests.entries()) {
        const many = requests.length > 1;
        setBusy({
          title: many ? `Generating letter ${index + 1} of ${requests.length}` : "Generating your letter",
          detail: `Writing ${item.prospectName}'s letter from the call. This usually takes under a minute.`,
        });
        const multi: Multi = { enabled: form.multiEnabled, letter_count: form.multiEnabled ? form.letterCount : 1, position: item.position, names: form.multiEnabled ? names : [] };
        const started = await api<{ job_id: string }>("/api/green-light/generate", {
          method: "POST",
          body: JSON.stringify({
            show,
            prospect_name: item.prospectName,
            transcript,
            input_type: form.inputType,
            focus_points: parseFocusPoints(item.focus),
            multi,
          }),
        });
        const result = await waitForDraft(started.job_id);
        nextDrafts.push({
          id: started.job_id,
          prospectName: item.prospectName,
          jobId: started.job_id,
          show,
          multi,
          segments: splitLetter(result.draft_text || "").segments,
          guestName: result.guest_name || item.prospectName,
          docTitle: result.doc_title || "",
          warnings: result.warnings || [],
          saved: null,
        });
      }

      setCallTranscript(transcript);
      setDrafts(nextDrafts);
      setActiveIndex(0);
      setInstructions("");
      setStep("review");
      scrollToTop();
    } catch (error) {
      const failure = error instanceof RequestError ? error : new RequestError("The letter could not be generated. Try again.");
      setFormError(failure.message);
    } finally {
      setBusy(null);
    }
  }

  const patchDraft = (index: number, patch: Partial<Draft>) =>
    setDrafts((current) => current.map((draft, position) => (position === index ? { ...draft, ...patch } : draft)));

  const editSegment = (segmentIndex: number, text: string) => {
    if (!activeDraft) return;
    setReviewError("");
    patchDraft(activeIndex, {
      saved: null,
      segments: activeDraft.segments.map((segment, position) => (position === segmentIndex && segment.kind === "edit" ? { ...segment, text } : segment)),
    });
  };

  function draftRequest(draft: Draft) {
    const nameSegment = draft.segments.find((segment) => segment.kind === "edit" && segment.key === "prospect_name");
    return {
      show: draft.show,
      draft_text: assembleLetter(draft.segments),
      prospect_name: tidyName(nameSegment?.text || draft.prospectName).slice(0, 120) || draft.prospectName,
      guest_name: draft.guestName.slice(0, 120),
      doc_title: draft.docTitle,
      warnings: draft.warnings,
      job_id: draft.jobId,
      multi: draft.multi,
    };
  }

  function sectionsProblem(draft: Draft) {
    const empty = emptySections(draft.segments);
    return empty.length ? `These sections are empty: ${empty.join(", ")}. Fill them in first.` : "";
  }

  async function handleRefine() {
    if (!activeDraft || busy) return;
    const request = instructions.trim();
    if (request.length < 3) {
      setReviewError("Type what you want changed first.");
      return;
    }
    const problem = sectionsProblem(activeDraft);
    if (problem) {
      setReviewError(problem);
      return;
    }
    setReviewError("");
    setBusy({ title: "Applying your change", detail: "The AI is rewriting the sections written from the call. This can take up to a minute." });
    try {
      const result = await api<{ draft_text: string; guest_name?: string; doc_title?: string; warnings?: string[] }>("/api/green-light/refine", {
        method: "POST",
        body: JSON.stringify({ ...draftRequest(activeDraft), instructions: request, transcript: callTranscript }),
      });
      patchDraft(activeIndex, {
        segments: splitLetter(result.draft_text).segments,
        guestName: result.guest_name || activeDraft.guestName,
        docTitle: result.doc_title || activeDraft.docTitle,
        warnings: result.warnings || activeDraft.warnings,
        saved: null,
      });
      setInstructions("");
    } catch (error) {
      setReviewError(error instanceof RequestError ? error.message : "The change could not be applied. Your letter was not changed.");
    } finally {
      setBusy(null);
    }
  }

  async function handleSave() {
    if (!activeDraft || busy) return;
    const problem = sectionsProblem(activeDraft);
    if (problem) {
      setReviewError(problem);
      return;
    }
    setReviewError("");
    setBusy({ title: "Creating your letter", detail: "Building the designed letter. This takes a few seconds." });
    try {
      const result = await api<{ document_url: string; pdf_url: string; doc_title: string; folder: string }>("/api/green-light/save", {
        method: "POST",
        body: JSON.stringify(draftRequest(activeDraft)),
      });
      patchDraft(activeIndex, { saved: { documentUrl: result.document_url, pdfUrl: result.pdf_url, docTitle: result.doc_title, folder: result.folder } });
      // The download step renders below the letter; bring it into view once it exists.
      window.setTimeout(() => doneRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 150);
    } catch (error) {
      setReviewError(error instanceof RequestError ? error.message : "The letter could not be created. Try again.");
    } finally {
      setBusy(null);
    }
  }

  function startNew() {
    setForm(EMPTY_FORM);
    setCallTranscript("");
    setDrafts([]);
    setActiveIndex(0);
    setInstructions("");
    setFormError("");
    setReviewError("");
    setStep("details");
    scrollToTop();
  }

  const otherShows = useMemo(() => (activeDraft ? otherShowMentions(activeDraft.show, activeDraft.segments) : []), [activeDraft]);
  const notes = activeDraft
    ? [
        ...otherShows.map((name) => `This letter is for ${greenLightShowLabel(activeDraft.show)}, but the text mentions ${name}. Check the outlined sections.`),
        ...activeDraft.warnings,
      ]
    : [];
  const nextUnsaved = drafts.findIndex((draft, index) => index !== activeIndex && !draft.saved);

  return (
    <div ref={topRef} className="flex scroll-mt-24 flex-col gap-5">
      {busy ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm" role="status" aria-live="assertive">
          <div className="magic-card w-full max-w-md bg-white p-8 text-center">
            <Loader2 className="mx-auto size-10 animate-spin text-[#DC2626]" aria-hidden="true" />
            <p className="mt-4 text-2xl font-extrabold text-slate-950">{busy.title}</p>
            <p className="mt-2 text-[15px] font-medium leading-6 text-slate-500">{busy.detail}</p>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Keep this tab open</p>
          </div>
        </div>
      ) : null}

      {step === "details" ? (
        <form onSubmit={handleGenerate} className="magic-card p-5 md:p-7" noValidate>
          <StepHeading number={1} title="Call details" />

          <FieldLabel>Show</FieldLabel>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Show">
            {GREEN_LIGHT_SHOWS.map((item) => (
              <Choice key={item.value} active={form.show === item.value} onClick={() => update("show", item.value)} role="radio">
                {item.label}
              </Choice>
            ))}
          </div>

          <FieldLabel className="mt-6">Casting call</FieldLabel>
          <div className="grid gap-2 sm:grid-cols-2">
            <ModeButton active={form.inputType === "zoom_link"} icon={<LinkIcon className="size-4" aria-hidden="true" />} label="Zoom recording link" onClick={() => update("inputType", "zoom_link")} />
            <ModeButton active={form.inputType === "transcript"} icon={<FileText className="size-4" aria-hidden="true" />} label="Paste transcript" onClick={() => update("inputType", "transcript")} />
          </div>
          {form.inputType === "zoom_link" ? (
            <div className="mt-3">
              <Input
                value={form.zoomLink}
                onChange={(event) => update("zoomLink", event.target.value)}
                placeholder="https://us06web.zoom.us/rec/share/..."
                aria-label="Zoom recording link"
                inputMode="url"
                autoComplete="off"
                className="magic-input h-11"
              />
              <p className="mt-2 text-sm font-medium text-slate-500">If the transcript isn&apos;t ready yet, use Paste transcript.</p>
            </div>
          ) : (
            <Textarea
              value={form.transcript}
              onChange={(event) => update("transcript", event.target.value)}
              placeholder="Paste the full casting call transcript here"
              aria-label="Call transcript"
              spellCheck={false}
              className="magic-input mt-3 min-h-56"
            />
          )}

          <div className="mt-6 flex items-center justify-between gap-4 rounded-[18px] border border-slate-200 bg-white p-4">
            <label htmlFor="green-light-multi" className="cursor-pointer text-[15px] font-bold text-slate-950">
              More than one prospect on this call
            </label>
            <button
              id="green-light-multi"
              type="button"
              role="switch"
              aria-checked={form.multiEnabled}
              onClick={() => update("multiEnabled", !form.multiEnabled)}
              className={cn(
                "relative h-8 w-14 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#DC2626]",
                form.multiEnabled ? "bg-[#DC2626]" : "bg-slate-300",
              )}
            >
              <span className={cn("absolute top-1 size-6 rounded-full bg-white shadow transition-all", form.multiEnabled ? "left-7" : "left-1")} />
              <span className="sr-only">{form.multiEnabled ? "On" : "Off"}</span>
            </button>
          </div>

          {form.multiEnabled ? (
            <div className="mt-3 rounded-[18px] border border-slate-200 bg-slate-50/70 p-4">
              <FieldLabel className="mt-0">Letters needed</FieldLabel>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Letters needed">
                <Choice active={form.letterCount === 1} onClick={() => update("letterCount", 1)} role="radio">One letter</Choice>
                <Choice active={form.letterCount === 2} onClick={() => update("letterCount", 2)} role="radio">One letter each</Choice>
              </div>
              {form.letterCount === 1 ? (
                <div className="mt-4">
                  <FieldLabel htmlFor="green-light-target" className="mt-0">Which prospect is this letter for?</FieldLabel>
                  <Input id="green-light-target" value={form.prospectName} onChange={(event) => update("prospectName", event.target.value)} placeholder="Full name" autoComplete="off" className="magic-input h-11" />
                </div>
              ) : (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <FieldLabel htmlFor="green-light-first" className="mt-0">First prospect&apos;s full name</FieldLabel>
                    <Input id="green-light-first" value={form.firstName} onChange={(event) => update("firstName", event.target.value)} placeholder="Full name" autoComplete="off" className="magic-input h-11" />
                  </div>
                  <div>
                    <FieldLabel htmlFor="green-light-second" className="mt-0">Second prospect&apos;s full name</FieldLabel>
                    <Input id="green-light-second" value={form.secondName} onChange={(event) => update("secondName", event.target.value)} placeholder="Full name" autoComplete="off" className="magic-input h-11" />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-6">
              <FieldLabel htmlFor="green-light-prospect" className="mt-0">Prospect&apos;s full name</FieldLabel>
              <Input id="green-light-prospect" value={form.prospectName} onChange={(event) => update("prospectName", event.target.value)} placeholder="Full name" autoComplete="off" className="magic-input h-11" />
            </div>
          )}

          {twoLetters ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <FocusBox id="green-light-focus-first" label={`Focus points for ${tidyName(form.firstName) || "the first prospect"}`} value={form.focus} onChange={(value) => update("focus", value)} />
              <FocusBox id="green-light-focus-second" label={`Focus points for ${tidyName(form.secondName) || "the second prospect"}`} value={form.focusSecond} onChange={(value) => update("focusSecond", value)} />
            </div>
          ) : (
            <div className="mt-6">
              <FocusBox id="green-light-focus" label="Focus points" value={form.focus} onChange={(value) => update("focus", value)} />
            </div>
          )}

          {formError ? <Notice tone="error" className="mt-5">{formError}</Notice> : null}

          <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
            {drafts.length ? (
              <Button type="button" variant="outline" onClick={() => setStep("review")} className="h-11 rounded-full border-slate-200 bg-white px-5">
                Back to the letter
              </Button>
            ) : null}
            <Button type="submit" disabled={Boolean(busy)} className="h-11 rounded-full bg-[#DC2626] px-6 text-[15px] font-bold text-white hover:bg-[#B91C1C]">
              <Sparkles className="size-4" aria-hidden="true" />
              {twoLetters ? "Generate letters" : "Generate letter"}
            </Button>
          </div>
        </form>
      ) : null}

      {step === "review" && activeDraft ? (
        <>
          <section className="magic-card p-5 md:p-7" aria-labelledby="green-light-review-heading">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <StepHeading number={2} title="Review and edit" id="green-light-review-heading" className="mb-0" />
              <div className="flex flex-wrap gap-2">
                {!activeDraft.saved ? (
                  <Button type="button" onClick={() => void handleSave()} disabled={Boolean(busy)} className="h-10 rounded-full bg-[#DC2626] px-5 font-bold text-white hover:bg-[#B91C1C]">
                    Create final letter
                  </Button>
                ) : null}
                <Button type="button" variant="outline" onClick={() => setStep("details")} className="h-10 rounded-full border-slate-200 bg-white px-4">
                  Change call details
                </Button>
                <Button type="button" variant="outline" onClick={startNew} className="h-10 rounded-full border-slate-200 bg-white px-4">
                  <RotateCw className="size-4" aria-hidden="true" />
                  Start a new letter
                </Button>
              </div>
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-500">
              {greenLightShowLabel(activeDraft.show)} letter for {activeDraft.prospectName}
            </p>

            {drafts.length > 1 ? (
              <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Letters">
                {drafts.map((draft, index) => (
                  <Choice key={draft.id} active={index === activeIndex} role="tab" onClick={() => { setActiveIndex(index); setReviewError(""); setInstructions(""); }}>
                    {draft.prospectName}
                    {draft.saved ? <CheckCircle2 className="size-4" aria-label="created" /> : null}
                  </Choice>
                ))}
              </div>
            ) : null}

            {notes.length ? (
              <Notice tone="warning" className="mt-5">
                <p className="font-bold">Check before sending</p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </Notice>
            ) : null}

            <div className="mt-5 rounded-[18px] border border-slate-200 bg-slate-50/70 p-4">
              <FieldLabel htmlFor="green-light-instructions" className="mt-0">Ask AI to change it <Optional /></FieldLabel>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="green-light-instructions"
                  value={instructions}
                  onChange={(event) => { setInstructions(event.target.value); setReviewError(""); }}
                  onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void handleRefine(); } }}
                  placeholder="Make the business experience shorter"
                  maxLength={1000}
                  autoComplete="off"
                  className="magic-input h-11 flex-1"
                />
                <Button type="button" variant="outline" onClick={() => void handleRefine()} disabled={Boolean(busy)} className="h-11 rounded-full border-slate-300 bg-white px-5 font-bold">
                  Apply change
                </Button>
              </div>
            </div>

            <p className="mt-5 text-sm font-medium text-slate-500">
              The outlined sections were written from the call. Click one to edit it.
            </p>
            <LetterView segments={activeDraft.segments} onEdit={editSegment} disabled={Boolean(busy)} />

            {reviewError ? <Notice tone="error" className="mt-5">{reviewError}</Notice> : null}

            {!activeDraft.saved ? (
              <div className="mt-6 flex justify-end">
                <Button type="button" onClick={() => void handleSave()} disabled={Boolean(busy)} className="h-11 rounded-full bg-[#DC2626] px-6 text-[15px] font-bold text-white hover:bg-[#B91C1C]">
                  Create final letter
                </Button>
              </div>
            ) : null}
          </section>

          {activeDraft.saved ? (
            <section ref={doneRef} className="magic-card scroll-mt-24 p-5 md:p-7" aria-labelledby="green-light-done-heading">
              <StepHeading number={3} title="Download and send" id="green-light-done-heading" />
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-emerald-600" aria-hidden="true" />
                <div>
                  <p className="text-lg font-extrabold text-slate-950">{activeDraft.saved.docTitle}</p>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    Your letter is ready. Download the PDF and attach it to your email to the prospect.
                  </p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {activeDraft.saved.pdfUrl ? (
                  <a href={activeDraft.saved.pdfUrl} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 rounded-full bg-[#DC2626] px-6 text-[15px] font-bold text-white transition-colors hover:bg-[#B91C1C]">
                    <Download className="size-4" aria-hidden="true" />
                    Download PDF
                  </a>
                ) : null}
                <a href={activeDraft.saved.documentUrl} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-[15px] font-bold text-slate-900 transition-colors hover:bg-slate-50">
                  <ExternalLink className="size-4" aria-hidden="true" />
                  Open Google Doc
                </a>
                {nextUnsaved !== -1 ? (
                  <Button type="button" variant="outline" onClick={() => { setActiveIndex(nextUnsaved); setReviewError(""); scrollToTop(); }} className="h-11 rounded-full border-slate-200 bg-white px-5 text-[15px] font-bold">
                    Next: {drafts[nextUnsaved].prospectName}&apos;s letter
                  </Button>
                ) : (
                  <Button type="button" variant="outline" onClick={startNew} className="h-11 rounded-full border-slate-200 bg-white px-5 text-[15px] font-bold">
                    <RotateCw className="size-4" aria-hidden="true" />
                    Start a new letter
                  </Button>
                )}
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function StepHeading({ number, title, id, className }: { number: number; title: string; id?: string; className?: string }) {
  return (
    <div className={cn("mb-5 flex items-center gap-3", className)}>
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#DC2626] text-sm font-extrabold text-white" aria-hidden="true">{number}</span>
      <h2 id={id} className="text-xl font-extrabold text-slate-950">{title}</h2>
    </div>
  );
}

function FieldLabel({ children, htmlFor, className }: { children: React.ReactNode; htmlFor?: string; className?: string }) {
  const classes = cn("mb-2 mt-5 block text-[15px] font-bold text-slate-950", className);
  return htmlFor ? <label htmlFor={htmlFor} className={classes}>{children}</label> : <p className={classes}>{children}</p>;
}

function Optional() {
  return <span className="ml-1 text-sm font-medium text-slate-400">Optional</span>;
}

function Choice({ active, onClick, children, role }: { active: boolean; onClick: () => void; children: React.ReactNode; role: "radio" | "tab" }) {
  return (
    <button
      type="button"
      role={role}
      {...(role === "radio" ? { "aria-checked": active } : { "aria-selected": active })}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 py-2 text-[15px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#DC2626]",
        active ? "border-[#DC2626] bg-[#DC2626] text-white" : "border-slate-200 bg-white text-slate-700 hover:border-red-300 hover:text-[#B91C1C]",
      )}
    >
      {children}
    </button>
  );
}

function ModeButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex h-11 items-center justify-center gap-2 rounded-[14px] border text-[15px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#DC2626]",
        active ? "border-red-200 bg-[#FEF2F2] text-[#B91C1C]" : "border-slate-200 bg-white text-slate-600 hover:border-red-200 hover:text-[#B91C1C]",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function FocusBox({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <FieldLabel htmlFor={id} className="mt-0">{label} <Optional /></FieldLabel>
      <Textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Up to 5 points, one per line"
        className="magic-input min-h-40"
      />
    </div>
  );
}

function Notice({ tone, className, children }: { tone: "error" | "warning"; className?: string; children: React.ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "note"}
      className={cn(
        "flex gap-3 rounded-[16px] border p-4 text-sm font-medium leading-6",
        tone === "error" ? "border-red-200 bg-[#FEF2F2] text-[#991B1B]" : "border-amber-200 bg-amber-50 text-amber-900",
        className,
      )}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function isHeadingLine(line: string) {
  const text = line.trim();
  return text.length > 2 && text.length < 70 && /[A-Z]/.test(text) && !/[a-z]/.test(text.replace(/\bTV\b/g, ""));
}

function LetterView({ segments, onEdit, disabled }: { segments: LetterSegment[]; onEdit: (index: number, text: string) => void; disabled: boolean }) {
  return (
    <div className="mt-3 rounded-[18px] border border-slate-200 bg-white px-4 py-5 md:px-8 md:py-7">
      {segments.map((segment, index) =>
        segment.kind === "fixed" ? (
          <div key={`fixed-${index}`} className="text-[15px] leading-7 text-slate-500">
            {segment.text.split("\n").map((line, lineIndex) =>
              line.trim() ? (
                <p key={lineIndex} className={isHeadingLine(line) ? "mt-4 font-extrabold tracking-wide text-slate-900 first:mt-0" : undefined}>{line}</p>
              ) : (
                <div key={lineIndex} className="h-3" aria-hidden="true" />
              ),
            )}
          </div>
        ) : (
          <EditableSection key={segment.key} segment={segment} disabled={disabled} onChange={(text) => onEdit(index, text)} />
        ),
      )}
    </div>
  );
}

function EditableSection({ segment, onChange, disabled }: { segment: Extract<LetterSegment, { kind: "edit" }>; onChange: (text: string) => void; disabled: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight + 2}px`;
  }, [segment.text]);

  const fieldClass =
    "w-full rounded-[12px] border-2 border-dashed border-red-300 bg-[#FFFBFB] px-3 py-2 text-[15px] font-medium leading-7 text-slate-950 outline-none transition-colors focus:border-solid focus:border-[#DC2626] focus:bg-white disabled:opacity-60";
  return (
    <div className="my-2">
      {segment.multiline ? (
        <textarea
          ref={ref}
          value={segment.text}
          onChange={(event) => onChange(event.target.value)}
          aria-label={segment.label}
          disabled={disabled}
          rows={1}
          className={cn(fieldClass, "block resize-none overflow-hidden")}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {segment.prefix ? <span className="text-[15px] leading-7 text-slate-500">{segment.prefix.trim()}</span> : null}
          <input
            value={segment.text}
            onChange={(event) => onChange(event.target.value)}
            aria-label={segment.label}
            disabled={disabled}
            maxLength={120}
            className={cn(fieldClass, "min-w-0 flex-1 font-bold")}
          />
        </div>
      )}
    </div>
  );
}

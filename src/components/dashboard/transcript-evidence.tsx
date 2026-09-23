"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ExternalLink, FileText, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatCoachingTimestamp } from "@/lib/coaching-presentation";
import { findTranscriptMatch, parseTranscriptLines } from "@/lib/transcript-evidence";

type TranscriptEvidenceProps = {
  evidence: string[];
  reportType: "official" | "manual";
  reportId: string;
  transcriptUrl?: string | null;
};

export function TranscriptEvidence({ evidence, reportType, reportId, transcriptUrl }: TranscriptEvidenceProps) {
  const [open, setOpen] = useState(false);
  const [selectedTime, setSelectedTime] = useState(evidence[0]);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const descriptionId = useId();
  const selectedLineRef = useRef<HTMLDivElement>(null);
  const lines = useMemo(() => parseTranscriptLines(transcript || ""), [transcript]);
  const match = useMemo(() => findTranscriptMatch(lines, selectedTime), [lines, selectedTime]);

  useEffect(() => {
    if (!open || transcript !== null) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ reportType, reportId });

    async function loadTranscript() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/report-transcript?${params}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = (await response.json()) as { transcript?: string; error?: string };
        if (!response.ok || !data.transcript) {
          throw new Error(data.error || "The transcript could not be loaded.");
        }
        setTranscript(data.transcript);
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : "The transcript could not be loaded.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadTranscript();
    return () => controller.abort();
  }, [open, reportType, reportId, transcript]);

  useEffect(() => {
    if (!open || match.index < 0) return;
    const frame = requestAnimationFrame(() => selectedLineRef.current?.scrollIntoView({ block: "center" }));
    return () => cancelAnimationFrame(frame);
  }, [open, match.index, transcript, selectedTime]);

  function showTranscript(time: string) {
    setSelectedTime(time);
    setOpen(true);
  }

  return (
    <>
      <details className="mt-3 text-sm text-slate-500">
        <summary className="w-fit cursor-pointer font-medium hover:text-[#a92728]">Transcript evidence</summary>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {evidence.map((time) => (
            <button
              key={time}
              type="button"
              onClick={() => showTranscript(time)}
              aria-label={`View transcript at ${formatCoachingTimestamp(time)}`}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-red-100 bg-red-50/70 px-2.5 font-semibold tabular-nums text-[#a92728] hover:border-red-200 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
            >
              {formatCoachingTimestamp(time)} <FileText className="size-3.5" aria-hidden="true" />
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">Select a time to read that moment in the transcript.</p>
      </details>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full gap-0 overflow-hidden border-l border-slate-200 bg-[#fcfbfb] p-0 sm:max-w-[680px]"
          aria-describedby={descriptionId}
        >
          <SheetHeader className="shrink-0 border-b border-slate-200 bg-white px-5 py-5 pr-14 sm:px-7">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#b12b2c]">Call transcript</p>
            <SheetTitle className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">
              Evidence at {formatCoachingTimestamp(selectedTime)}
            </SheetTitle>
            <SheetDescription id={descriptionId} className="text-sm leading-6 text-slate-500">
              The relevant line is highlighted below when its timestamp appears in the transcript.
            </SheetDescription>
            {evidence.length > 1 ? (
              <div className="flex flex-wrap gap-2 pt-2" aria-label="Evidence times">
                {evidence.map((time) => (
                  <button
                    key={time}
                    type="button"
                    onClick={() => setSelectedTime(time)}
                    aria-pressed={selectedTime === time}
                    className={`rounded-full border px-3 py-1.5 text-xs font-bold tabular-nums transition-colors ${selectedTime === time ? "border-[#c43132] bg-[#c43132] text-white" : "border-slate-200 bg-white text-slate-600 hover:border-red-200 hover:text-[#a92728]"}`}
                  >
                    {formatCoachingTimestamp(time)}
                  </button>
                ))}
              </div>
            ) : null}
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-7" aria-live="polite">
            {loading ? (
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                <Loader2 className="size-4 animate-spin text-[#c43132]" aria-hidden="true" /> Loading transcript…
              </div>
            ) : null}
            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800" role="alert">
                {error}
              </div>
            ) : null}
            {transcript !== null ? (
              <>
                {match.kind === "nearby" ? (
                  <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                    No exact line at {formatCoachingTimestamp(selectedTime)}. Showing the closest timestamp, {lines[match.index]?.time}.
                  </p>
                ) : null}
                {match.kind === "missing" ? (
                  <p className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-600">
                    This timestamp was not found in the transcript. You can browse the text or open the source transcript.
                  </p>
                ) : null}
                <div className="space-y-1.5 pb-8">
                  {lines.map((line, index) => (
                    <div
                      key={index}
                      ref={index === match.index ? selectedLineRef : null}
                      aria-current={index === match.index ? "location" : undefined}
                      className={`scroll-mt-8 whitespace-pre-wrap break-words rounded-xl px-3 py-2 text-[13.5px] leading-6 sm:text-sm ${index === match.index ? "border border-red-200 bg-red-50 font-medium text-slate-950 shadow-sm" : "text-slate-600"}`}
                    >
                      {line.text || "\u00a0"}
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </div>

          {transcriptUrl ? (
            <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-3 sm:px-7">
              <a
                href={transcriptUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-9 items-center gap-2 text-sm font-semibold text-[#a92728] hover:underline"
              >
                Open full source transcript <ExternalLink className="size-4" aria-hidden="true" />
              </a>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

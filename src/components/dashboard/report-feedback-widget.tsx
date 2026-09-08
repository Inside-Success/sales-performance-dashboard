"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, MessageSquareText, Send, ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { isEnhancedReport } from "@/lib/report-version";
import { cn } from "@/lib/utils";

type FeedbackRating = "positive" | "negative";
type SubmitState = "idle" | "submitting" | "sent" | "error";

type ReportFeedbackWidgetProps = {
  reportType: "official" | "manual";
  reportId: number | string;
  repName: string;
  clientName?: string | null;
  reportCoachingVersion?: unknown;
};

export function ReportFeedbackWidget({
  reportType,
  reportId,
  repName,
  clientName,
  reportCoachingVersion,
}: ReportFeedbackWidgetProps) {
  const eligible = isEnhancedReport(reportCoachingVersion);
  const [selectedRating, setSelectedRating] = useState<FeedbackRating | null>(null);
  const [status, setStatus] = useState<SubmitState>("idle");
  const [name, setName] = useState(() => repName || "");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const commentRef = useRef<HTMLTextAreaElement>(null);

  const isSubmitting = status === "submitting";
  const sent = status === "sent";
  const showNegativeForm = selectedRating === "negative" && !sent;

  useEffect(() => {
    if (!showNegativeForm) return;
    const focusTimer = window.setTimeout(() => commentRef.current?.focus(), 120);
    return () => window.clearTimeout(focusTimer);
  }, [showNegativeForm]);

  if (!eligible) return null;

  async function submitFeedback(rating: FeedbackRating) {
    const normalizedName = name.trim();
    const normalizedComment = comment.trim();

    if (rating === "negative" && (!normalizedName || !normalizedComment)) {
      setError("Name and report feedback are required.");
      return;
    }

    setSelectedRating(rating);
    setStatus("submitting");
    setError(null);

    try {
      const response = await fetch("/api/report-feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rating,
          report_type: reportType,
          report_id: String(reportId),
          respondent_name: rating === "negative" ? normalizedName : null,
          comment: rating === "negative" ? normalizedComment : null,
          page_url: window.location.href,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Feedback could not be saved.");
      }

      setStatus("sent");
    } catch (submitError) {
      setStatus("error");
      setError(submitError instanceof Error ? submitError.message : "Feedback could not be saved.");
    }
  }

  if (sent) {
    return (
      <section className="magic-card flex items-start gap-3 p-5 md:p-6">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#DC2626] text-white shadow-[0_10px_24px_-12px_rgba(220,38,38,0.9)]">
          <Check className="size-5 stroke-[3]" />
        </span>
        <div>
          <h2 className="text-[17px] font-extrabold leading-tight tracking-normal text-slate-950">
            {selectedRating === "positive" ? "Glad it helped" : "Thanks for the feedback"}
          </h2>
          <p className="mt-1 text-sm font-medium leading-6 text-slate-500">
            {selectedRating === "positive"
              ? "Thanks - your rating was saved."
              : "It helps Magic Mike get sharper on every call."}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#FEF2F2] text-[#DC2626]">
            <MessageSquareText className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[17px] font-extrabold leading-tight tracking-normal text-slate-950">
              Was this report helpful?
            </h2>
            <p className="mt-1 text-sm font-medium leading-6 text-slate-500">
              Your rating helps improve the coaching.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting || sent}
            className={cn(
              "h-11 rounded-xl px-4 text-sm font-bold transition-all active:scale-[0.98]",
              selectedRating === "positive"
                ? "border-[#DC2626] bg-[#DC2626] text-white shadow-[0_8px_20px_-10px_rgba(220,38,38,0.95)] hover:bg-[#B91C1C] hover:text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-red-200 hover:bg-[#FEF2F2] hover:text-[#B91C1C]",
            )}
            onClick={() => void submitFeedback("positive")}
            aria-label="Mark report helpful"
          >
            {isSubmitting && selectedRating === "positive" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ThumbsUp className="size-4" />
            )}
            Helpful
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting || sent}
            className={cn(
              "h-11 rounded-xl px-4 text-sm font-bold transition-all active:scale-[0.98]",
              selectedRating === "negative"
                ? "border-[#DC2626] bg-[#DC2626] text-white shadow-[0_8px_20px_-10px_rgba(220,38,38,0.95)] hover:bg-[#B91C1C] hover:text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-red-200 hover:bg-[#FEF2F2] hover:text-[#B91C1C]",
            )}
            onClick={() => {
              setSelectedRating("negative");
              setStatus("idle");
              setError(null);
              if (!name.trim()) setName(repName || "");
            }}
            aria-label="Report needs changes"
          >
            <ThumbsDown className="size-4" />
            Needs changes
          </Button>
        </div>
      </div>

      {showNegativeForm ? (
        <form
          className="mt-5 grid gap-4 border-t border-slate-200 pt-5"
          onSubmit={(event) => {
            event.preventDefault();
            void submitFeedback("negative");
          }}
        >
          <label className="grid gap-1.5 text-sm font-bold text-slate-800">
            Name
            <Input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Name"
              autoComplete="name"
              className="magic-input"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-bold text-slate-800">
            What was off in this report?
            <Textarea
              ref={commentRef}
              required
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Tell us what was inaccurate or missing - the more specific, the better."
              className="magic-input min-h-32 resize-y bg-white text-[15px] font-medium leading-7"
            />
          </label>
          {clientName ? (
            <p className="text-xs text-muted-foreground">Report: {clientName}</p>
          ) : null}
          {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-10 rounded-xl bg-[#DC2626] px-5 text-white shadow-[0_8px_20px_-10px_rgba(220,38,38,0.95)] hover:bg-[#B91C1C]"
            >
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
              {!isSubmitting ? <Send className="size-4" /> : null}
              Send feedback
            </Button>
          </div>
        </form>
      ) : null}

      {status === "error" && !showNegativeForm ? (
        <p className="mt-4 text-sm font-medium text-destructive">
          {error || "Feedback could not be saved."}
        </p>
      ) : null}
    </section>
  );
}

"use client";

import { useMemo, useState } from "react";
import { Loader2, MessageSquareText, ThumbsDown, ThumbsUp } from "lucide-react";
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
  reportCreatedAt: string | null | undefined;
};

export function ReportFeedbackWidget({
  reportType,
  reportId,
  repName,
  clientName,
  reportCreatedAt,
}: ReportFeedbackWidgetProps) {
  const eligible = useMemo(() => isEnhancedReport(reportCreatedAt), [reportCreatedAt]);
  const [selectedRating, setSelectedRating] = useState<FeedbackRating | null>(null);
  const [status, setStatus] = useState<SubmitState>("idle");
  const [name, setName] = useState(() => repName || "");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

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

  const isSubmitting = status === "submitting";
  const sent = status === "sent";
  const showNegativeForm = selectedRating === "negative" && !sent;

  return (
    <section className="magic-card overflow-hidden p-5 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#B91C1C]">
            <span className="grid size-8 place-items-center rounded-full bg-[#FEF2F2] text-[#DC2626]">
              <MessageSquareText className="size-4" />
            </span>
            Report feedback
          </div>
          <h2 className="mt-3 text-xl font-semibold tracking-normal">Was this report helpful?</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            Your response helps improve Enhanced Magic Mike reports.
          </p>
        </div>

        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            variant={selectedRating === "positive" ? "default" : "outline"}
            disabled={isSubmitting || sent}
            className={cn(
              "h-10 rounded-full px-4",
              selectedRating === "positive"
                ? "bg-[#DC2626] text-white hover:bg-[#B91C1C]"
                : "border-slate-200 bg-white hover:bg-[#FEF2F2] hover:text-[#B91C1C]",
            )}
            onClick={() => void submitFeedback("positive")}
          >
            {isSubmitting && selectedRating === "positive" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ThumbsUp className="size-4" />
            )}
            Yes
          </Button>
          <Button
            type="button"
            variant={selectedRating === "negative" ? "default" : "outline"}
            disabled={isSubmitting || sent}
            className={cn(
              "h-10 rounded-full px-4",
              selectedRating === "negative"
                ? "bg-slate-900 text-white hover:bg-slate-800"
                : "border-slate-200 bg-white hover:bg-slate-50",
            )}
            onClick={() => {
              setSelectedRating("negative");
              setStatus("idle");
              setError(null);
              if (!name.trim()) setName(repName || "");
            }}
          >
            <ThumbsDown className="size-4" />
            No
          </Button>
        </div>
      </div>

      {sent ? (
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
          {selectedRating === "positive"
            ? "Thanks - your rating was saved."
            : "Thanks - your feedback was submitted."}
        </div>
      ) : null}

      {showNegativeForm ? (
        <form
          className="mt-5 grid gap-4 rounded-[20px] border border-slate-200 bg-slate-50/80 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submitFeedback("negative");
          }}
        >
          <label className="grid gap-1.5 text-sm font-semibold">
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
          <label className="grid gap-1.5 text-sm font-semibold">
            What was off in this report?
            <Textarea
              required
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="What was off in this report?"
              className="magic-input min-h-32 resize-y"
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
              className="h-10 rounded-full bg-slate-900 px-5 text-white hover:bg-slate-800"
            >
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
              Submit feedback
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

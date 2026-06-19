"use client";

import { useMemo, useState } from "react";
import { FileText, LinkIcon, Loader2, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type InputType = "transcript" | "zoom_link";

export function PromptBenchmarkSubmitForm() {
  const [inputType, setInputType] = useState<InputType>("transcript");
  const [title, setTitle] = useState("");
  const [repName, setRepName] = useState("");
  const [clientName, setClientName] = useState("");
  const [transcriptText, setTranscriptText] = useState("");
  const [zoomLink, setZoomLink] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    run_id?: string | null;
    sheet_url?: string | null;
    dashboard_url?: string | null;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = useMemo(() => {
    if (inputType === "transcript") return transcriptText.trim().length >= 80;
    return zoomLink.trim().length > 0;
  }, [inputType, transcriptText, zoomLink]);

  async function submitBenchmark(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || isSubmitting) return;

    setError(null);
    setResult(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/prompt-benchmark/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          input_type: inputType,
          title,
          rep_name: repName,
          client_name: clientName,
          transcript_text: transcriptText,
          zoom_link: zoomLink,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Benchmark could not be submitted.");
      }

      setResult(data);
      setTranscriptText("");
      setZoomLink("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Benchmark could not be submitted.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={submitBenchmark} className="space-y-5">
      <div className="rounded-xl border bg-background/80 p-2">
        <div className="grid gap-2 sm:grid-cols-2">
          <ModeButton
            active={inputType === "transcript"}
            icon={<FileText className="size-4" />}
            label="Paste transcript"
            onClick={() => setInputType("transcript")}
          />
          <ModeButton
            active={inputType === "zoom_link"}
            icon={<LinkIcon className="size-4" />}
            label="Zoom link"
            onClick={() => setInputType("zoom_link")}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Run title">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Optional label for this benchmark"
          />
        </Field>
        <Field label="Rep / client">
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              value={repName}
              onChange={(event) => setRepName(event.target.value)}
              placeholder="Rep"
            />
            <Input
              value={clientName}
              onChange={(event) => setClientName(event.target.value)}
              placeholder="Client"
            />
          </div>
        </Field>
      </div>

      {inputType === "transcript" ? (
        <Field label="Transcript" required>
          <Textarea
            value={transcriptText}
            onChange={(event) => setTranscriptText(event.target.value)}
            placeholder="Paste the transcript here..."
            className="min-h-72"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">{transcriptText.trim().length.toLocaleString()} characters</Badge>
            <span>The benchmark workflow stores model outputs and costs, not raw transcript text.</span>
          </div>
        </Field>
      ) : (
        <Field label="Zoom recording link" required>
          <Input
            value={zoomLink}
            onChange={(event) => setZoomLink(event.target.value)}
            placeholder="https://insidesuccess.zoom.us/rec/share/..."
          />
        </Field>
      )}

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {result ? (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
          Benchmark submitted{result.run_id ? `: ${result.run_id}` : ""}.
          {result.sheet_url ? (
            <a className="ml-2 text-primary underline-offset-4 hover:underline" href={result.sheet_url}>
              Open sheet
            </a>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background/80 p-4">
        <p className="text-sm text-muted-foreground">
          This runs the isolated benchmark matrix and may take several minutes.
        </p>
        <Button type="submit" disabled={!canSubmit || isSubmitting} className="gap-1.5">
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Run benchmark
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">
        {label}
        {required ? " *" : ""}
      </span>
      {children}
    </label>
  );
}

function ModeButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-transparent bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

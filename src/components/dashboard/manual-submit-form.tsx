"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, LinkIcon, Loader2, Send, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type InputType = "transcript" | "zoom_link";

export function ManualSubmitForm() {
  const router = useRouter();
  const [inputType, setInputType] = useState<InputType>("transcript");
  const [repName, setRepName] = useState("");
  const [repEmail, setRepEmail] = useState("");
  const [clientName, setClientName] = useState("");
  const [transcriptText, setTranscriptText] = useState("");
  const [zoomLink, setZoomLink] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = useMemo(() => {
    if (!repName.trim()) return false;
    if (inputType === "transcript") return transcriptText.trim().length >= 80;
    return zoomLink.trim().length > 0;
  }, [inputType, repName, transcriptText, zoomLink]);

  async function submitReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || isSubmitting) return;

    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/manual-reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          input_type: inputType,
          rep_name: repName,
          rep_email: repEmail,
          client_name: clientName,
          transcript_text: transcriptText,
          zoom_link: zoomLink,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Report could not be submitted.");
      }

      router.push(`/self-report/${data.public_id}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Report could not be submitted.");
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={submitReport} className="space-y-5">
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-md border bg-background text-primary">
            <ShieldAlert className="size-4" />
          </span>
          <div className="space-y-1">
            <div className="text-sm font-semibold">Call 2 or later only</div>
            <p className="text-sm leading-6 text-muted-foreground">
              This tool only generates coaching reports for Call 2 or later sales calls. Call 1, internal calls, training calls, no-shows, or very short transcripts will not generate a report.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Rep name" required>
          <Input
            value={repName}
            onChange={(event) => setRepName(event.target.value)}
            placeholder="Sales rep"
            autoComplete="name"
          />
        </Field>
        <Field label="Rep email">
          <Input
            type="email"
            value={repEmail}
            onChange={(event) => setRepEmail(event.target.value)}
            placeholder="rep@company.com"
            autoComplete="email"
          />
        </Field>
        <Field label="Client name">
          <Input
            value={clientName}
            onChange={(event) => setClientName(event.target.value)}
            placeholder="Client or prospect"
          />
        </Field>
      </div>

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

      {inputType === "transcript" ? (
        <Field label="Transcript" required>
          <Textarea
            value={transcriptText}
            onChange={(event) => setTranscriptText(event.target.value)}
            placeholder="Paste the Zoom transcript here..."
            className="min-h-72"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">{transcriptText.trim().length.toLocaleString()} characters</Badge>
            <span>Raw transcript text is sent to the workflow but not stored in the dashboard database.</span>
          </div>
        </Field>
      ) : (
        <Field label="Zoom meeting or recording link" required>
          <Input
            value={zoomLink}
            onChange={(event) => setZoomLink(event.target.value)}
            placeholder="https://insidesuccess.zoom.us/rec/share/..."
          />
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            The workflow will try to retrieve the transcript first. If Zoom does not allow access, the report will ask for a pasted transcript instead.
          </p>
        </Field>
      )}

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <p className="text-sm text-muted-foreground">
          Reports usually take about 1-2 minutes and update automatically.
        </p>
        <Button type="submit" disabled={!canSubmit || isSubmitting} className="gap-1.5">
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Submit report
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

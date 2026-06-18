"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, FileText, LinkIcon, Loader2, Send, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trackUsageEvent } from "@/components/dashboard/usage-tracker";
import { cn } from "@/lib/utils";
import { slugify } from "@/lib/slug";

type InputType = "transcript" | "zoom_link";

export function ManualSubmitForm() {
  const router = useRouter();
  const [inputType, setInputType] = useState<InputType>("zoom_link");
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

      trackUsageEvent("manual_report_submitted", {
        source: "manual_submit",
        target_rep_slug: slugify(repName),
        target_rep_name: repName,
        manual_public_id: data.public_id || null,
        metadata: {
          input_type: inputType,
          has_client_name: Boolean(clientName.trim()),
        },
      });
      router.push(`/self-report/${data.public_id}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Report could not be submitted.");
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={submitReport} className="space-y-5">
      <div className="magic-soft-panel bg-white p-2">
        <div className="grid gap-2 sm:grid-cols-2">
          <ModeButton
            active={inputType === "zoom_link"}
            icon={<LinkIcon className="size-4" />}
            label="Zoom link"
            onClick={() => setInputType("zoom_link")}
          />
          <ModeButton
            active={inputType === "transcript"}
            icon={<FileText className="size-4" />}
            label="Paste transcript"
            onClick={() => setInputType("transcript")}
          />
        </div>
      </div>

      {inputType === "zoom_link" ? (
        <Field label="Recording link" required>
          <Input
            value={zoomLink}
            onChange={(event) => setZoomLink(event.target.value)}
            placeholder="https://insidesuccess.zoom.us/rec/share/..."
            className="magic-input h-11"
          />
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Paste one recording link. If a usable transcript cannot be found, submit the transcript text instead.
          </p>
        </Field>
      ) : (
        <Field label="Transcript" required>
          <Textarea
            value={transcriptText}
            onChange={(event) => setTranscriptText(event.target.value)}
            placeholder="Paste the Zoom transcript here..."
            className="magic-input min-h-72"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <Badge variant="outline">{transcriptText.trim().length.toLocaleString()} characters</Badge>
            <span>Raw transcript text is sent to the workflow but not stored in the dashboard database.</span>
          </div>
        </Field>
      )}

      <div className="magic-soft-panel bg-white p-4">
        <Field
          label="Rep name"
          required
          description="Required so this report is saved under your name in self-submitted reports."
        >
          <Input
            value={repName}
            onChange={(event) => setRepName(event.target.value)}
            placeholder="Sales rep"
            autoComplete="name"
            className="magic-input h-11"
          />
        </Field>
      </div>

      <details className="group magic-soft-panel bg-white p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl transition-colors hover:text-[#B91C1C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200">
          <span className="text-sm font-semibold">Optional details</span>
          <span className="inline-flex items-center gap-2 text-xs font-normal text-slate-500">
            <span className="group-open:hidden">Add rep email or client name</span>
            <span className="hidden group-open:inline">Hide optional details</span>
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
          </span>
        </summary>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Rep email (optional)">
            <Input
              type="email"
              value={repEmail}
              onChange={(event) => setRepEmail(event.target.value)}
              placeholder="rep@company.com"
              autoComplete="email"
              className="magic-input h-11"
            />
          </Field>
          <Field label="Client name (optional)">
            <Input
              value={clientName}
              onChange={(event) => setClientName(event.target.value)}
              placeholder="Client or prospect"
              className="magic-input h-11"
            />
          </Field>
        </div>
      </details>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <p className="text-sm font-medium text-slate-500">
          Reports usually take about 1-2 minutes and update automatically.
        </p>
        <Button
          type="submit"
          disabled={!canSubmit || isSubmitting}
          className="h-10 rounded-full bg-[#DC2626] px-5 text-white hover:bg-[#B91C1C]"
        >
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Generate feedback
        </Button>
      </div>

      <div className="rounded-[18px] border border-red-100 bg-[#FEF2F2] p-3">
        <div className="flex gap-3">
          <span className="grid size-7 shrink-0 place-items-center rounded-full border border-red-100 bg-white text-[#DC2626]">
            <ShieldAlert className="size-3.5" />
          </span>
          <div className="space-y-0.5">
            <div className="text-sm font-semibold text-slate-950">Call 2 or later only</div>
            <p className="text-xs leading-5 text-slate-600">
              Call 1, internal calls, training calls, no-shows, or very short transcripts will not generate a report.
            </p>
          </div>
        </div>
      </div>
    </form>
  );
}

function Field({
  label,
  required = false,
  description,
  children,
}: {
  label: string;
  required?: boolean;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
        {label}
        {required ? " *" : ""}
      </span>
      {children}
      {description ? (
        <span className="mt-2 block text-xs leading-5 text-slate-500">{description}</span>
      ) : null}
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
        "flex h-10 items-center justify-center gap-2 rounded-2xl border px-3 text-sm font-semibold transition-colors",
        active
          ? "border-[#DC2626] bg-[#DC2626] text-white shadow-sm"
          : "border-transparent bg-transparent text-slate-500 hover:bg-white hover:text-slate-950",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

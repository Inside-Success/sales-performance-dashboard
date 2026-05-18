"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Award,
  BookOpenText,
  CheckCircle2,
  ExternalLink,
  FileText,
  Lightbulb,
  Loader2,
  MessageSquareText,
  PencilLine,
  Target,
  TriangleAlert,
  Video,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { BulletList, JsonSection } from "@/components/dashboard/json-section";
import { formatMiamiDateTime } from "@/lib/format";
import type { ManualFeedbackReport } from "@/lib/types";
import { cn } from "@/lib/utils";

type ApiResponse = {
  ok: boolean;
  report?: ManualFeedbackReport;
  error?: string;
};

const TERMINAL_STATUSES = new Set(["completed", "refused", "needs_transcript_paste", "failed"]);

export function ManualReportStatus({ initialReport }: { initialReport: ManualFeedbackReport }) {
  const [report, setReport] = useState(initialReport);
  const [error, setError] = useState<string | null>(null);
  const reportDocLink = report.report_doc_link || report.google_doc_link;
  const transcriptLink = report.transcript_drive_link || report.transcript_link;
  const zoomLink = report.original_zoom_link || report.zoom_link;

  const isWaiting = !TERMINAL_STATUSES.has(report.status);
  const closeTitle =
    report.close_section_type === "what_made_this_close_work"
      ? "What Made This Close Work"
      : "Why No Close";

  useEffect(() => {
    if (!isWaiting) return;

    let cancelled = false;
    const loadReport = async () => {
      try {
        const response = await fetch(`/api/manual-reports/${report.public_id}`, {
          cache: "no-store",
        });
        const data = (await response.json()) as ApiResponse;

        if (!response.ok || !data.ok || !data.report) {
          throw new Error(data.error || "Report status could not be loaded.");
        }

        if (!cancelled) {
          setReport(data.report);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Report status could not be loaded.");
        }
      }
    };

    void loadReport();
    const interval = window.setInterval(loadReport, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [isWaiting, report.public_id]);

  return (
    <main className="dashboard-page min-h-screen bg-background">
      {isWaiting ? <div className="fixed inset-x-0 top-14 z-50 h-0.5 overflow-hidden bg-primary/10"><div className="loading-progress h-full bg-primary" /></div> : null}
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <article className="space-y-4">
          <header className="dashboard-card dashboard-hero rounded-2xl border bg-card/95 p-5 md:p-6">
            <Link href="/submit" className={cn(buttonVariants({ variant: "ghost" }), "mb-4 px-0")}>
              <ArrowLeft className="size-4" />
              Submit another call
            </Link>

            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={report.status} />
              <Badge variant="outline">Updated {formatMiamiDateTime(report.updated_at)}</Badge>
            </div>

            <h1 className="mt-3 text-3xl font-semibold tracking-normal">
              {report.client_name || "Self-submitted report"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {report.rep_name} sales feedback report.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <ExternalButton href={reportDocLink} label="Open Google Doc" icon={<FileText className="size-4" />} />
              <ExternalButton href={zoomLink} label="Zoom" icon={<Video className="size-4" />} />
              <ExternalButton href={transcriptLink} label="Transcript" icon={<MessageSquareText className="size-4" />} />
            </div>
          </header>

          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {isWaiting ? <PendingPanel /> : null}
          {report.status === "needs_transcript_paste" ? <NeedsTranscriptPanel reason={report.refusal_reason} /> : null}
          {report.status === "refused" ? <RefusedPanel reason={report.refusal_reason} /> : null}
          {report.status === "failed" ? <FailedPanel reason={report.refusal_reason} /> : null}

          {report.status === "completed" ? (
            <>
              <ReportSection title="Verdict" icon={<Lightbulb className="size-4" />} featured>
                <p className="text-base leading-8 md:text-lg">{report.one_line_verdict || "Not provided"}</p>
              </ReportSection>

              <ReportSection title="Biggest Strength" icon={<Award className="size-4" />}>
                <ReportText>{report.biggest_strength || "Not provided"}</ReportText>
              </ReportSection>

              <ReportSection title="What I'd Polish" icon={<PencilLine className="size-4" />}>
                <ReportText>{report.biggest_fix || "Not provided"}</ReportText>
              </ReportSection>

              <ReportSection title="Coaching Tip" icon={<Target className="size-4" />}>
                <ReportText>{report.coaching_tip || "Not provided"}</ReportText>
              </ReportSection>

              <ReportSection title="Rudy's Note" icon={<BookOpenText className="size-4" />}>
                <ReportText>{report.rudys_note || "Not provided"}</ReportText>
              </ReportSection>

              <ReportSection title="What Went Well" icon={<Award className="size-4" />}>
                <BulletList items={report.what_went_well} />
              </ReportSection>

              <ReportSection title="What To Improve" icon={<Wrench className="size-4" />}>
                <BulletList items={report.what_to_improve} />
              </ReportSection>

              <ReportSection title={closeTitle} icon={<Target className="size-4" />}>
                <JsonSection value={report.close_section} />
              </ReportSection>

              <ReportSection title="Objections Surfaced" icon={<MessageSquareText className="size-4" />}>
                <BulletList items={report.objections_surfaced} />
              </ReportSection>
            </>
          ) : null}
        </article>
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: ManualFeedbackReport["status"] }) {
  const label = useMemo(() => {
    if (status === "needs_transcript_paste") return "Needs transcript";
    return status.replace(/_/g, " ");
  }, [status]);

  const isGood = status === "completed";
  const isBad = status === "failed" || status === "refused" || status === "needs_transcript_paste";

  return (
    <Badge variant={isBad ? "destructive" : isGood ? "secondary" : "outline"} className="capitalize">
      {isGood ? <CheckCircle2 className="size-3.5" /> : null}
      {status === "pending" || status === "processing" ? <Loader2 className="size-3.5 animate-spin" /> : null}
      {label}
    </Badge>
  );
}

function PendingPanel() {
  return (
    <section className="dashboard-card rounded-xl border bg-card/95 p-6 text-center">
      <Loader2 className="mx-auto mb-3 size-8 animate-spin text-primary" />
      <h2 className="text-lg font-semibold">Your report is being generated</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
        This usually takes about 5 minutes. You can leave this page open and the report will appear automatically.
      </p>
    </section>
  );
}

function NeedsTranscriptPanel({ reason }: { reason: string | null }) {
  return (
    <MessagePanel
      title="Paste the transcript instead"
      message={reason || "The Zoom link could not provide a usable transcript. Submit the transcript text directly to generate this report."}
    />
  );
}

function RefusedPanel({ reason }: { reason: string | null }) {
  return (
    <MessagePanel
      title="Report not generated"
      message={reason || "This call does not appear to be a Call 2 or later sales call."}
    />
  );
}

function FailedPanel({ reason }: { reason: string | null }) {
  return (
    <MessagePanel
      title="Report failed"
      message={reason || "The report could not be generated. Try submitting the transcript again."}
      destructive
    />
  );
}

function MessagePanel({
  title,
  message,
  destructive = false,
}: {
  title: string;
  message: string;
  destructive?: boolean;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border p-5",
        destructive
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-primary/20 bg-primary/5",
      )}
    >
      <div className="flex gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-md border bg-background">
          <TriangleAlert className="size-4" />
        </span>
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-1 text-sm leading-6">{message}</p>
        </div>
      </div>
    </section>
  );
}

function ReportSection({
  title,
  icon,
  children,
  featured = false,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  featured?: boolean;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border bg-card/95 p-5 shadow-xs",
        featured && "border-primary/20 bg-primary/5",
      )}
    >
      <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-normal text-muted-foreground">
        <span className="grid size-7 place-items-center rounded-md border bg-background text-foreground">
          {icon}
        </span>
        {title}
      </h2>
      <div className="text-sm leading-7 text-foreground">{children}</div>
    </section>
  );
}

function ReportText({ children }: { children: React.ReactNode }) {
  return <p className="leading-7">{children}</p>;
}

function ExternalButton({
  href,
  label,
  icon,
}: {
  href: string | null;
  label: string;
  icon: React.ReactNode;
}) {
  if (!href) return null;

  return (
    <a href={href} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: "outline" }), "gap-1")}>
      {icon}
      {label}
      <ExternalLink className="size-4" />
    </a>
  );
}

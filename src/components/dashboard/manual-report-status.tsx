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
  Send,
  Target,
  TriangleAlert,
  UserRound,
  Video,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { BulletList, JsonSection } from "@/components/dashboard/json-section";
import { ReportFeedbackWidget } from "@/components/dashboard/report-feedback-widget";
import { ReportChatPanel } from "@/components/dashboard/report-chat-panel";
import { ReportVersionBadge } from "@/components/dashboard/report-version-badge";
import { TrackedExternalLink } from "@/components/dashboard/usage-tracker";
import { resolveCloseSection } from "@/lib/close-section";
import { formatMiamiDateTime } from "@/lib/format";
import { slugify } from "@/lib/slug";
import type { ManualFeedbackReport } from "@/lib/types";
import { cn } from "@/lib/utils";

type ApiResponse = {
  ok: boolean;
  report?: ManualFeedbackReport;
  error?: string;
};

const TERMINAL_STATUSES = new Set(["completed", "refused", "needs_transcript_paste", "failed"]);

export function ManualReportStatus({
  initialReport,
  reportChatEnabled = false,
}: {
  initialReport: ManualFeedbackReport;
  reportChatEnabled?: boolean;
}) {
  const [report, setReport] = useState(initialReport);
  const [error, setError] = useState<string | null>(null);
  const reportDocLink = report.report_doc_link || report.google_doc_link;
  const transcriptLink = report.transcript_drive_link || report.transcript_link;
  const zoomLink = report.original_zoom_link || report.zoom_link;
  const manualReportsHref = report.rep_name
    ? `/manual-reports?rep=${encodeURIComponent(slugify(report.rep_name))}`
    : "/manual-reports";

  const isWaiting = !TERMINAL_STATUSES.has(report.status);
  const closeSection = resolveCloseSection({
    whyNoClose: report.why_no_close,
    closeWorks: report.what_made_this_close_work,
  });
  const closeTitle =
    closeSection.type === "what_made_this_close_work"
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
    <main className="magic-page">
      {isWaiting ? <div className="fixed inset-x-0 top-16 z-50 h-0.5 overflow-hidden bg-red-100"><div className="loading-progress h-full bg-[#DC2626]" /></div> : null}
      <div className="magic-container max-w-5xl">
        <article className="space-y-4">
          <header className="magic-card magic-hero p-5 md:p-7">
            <div className="relative">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Link href={manualReportsHref} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "rounded-full px-0 text-slate-500 hover:text-[#B91C1C]")}>
                  <ArrowLeft className="size-4" />
                  Self-submitted reports
                </Link>
                <Link
                  href="/submit"
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 rounded-full border-slate-200 bg-white px-4")}
                >
                  <Send className="size-4" />
                  Get feedback
                </Link>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <ReportVersionBadge createdAt={report.created_at} />
                {report.status !== "completed" ? (
                  <>
                    <StatusBadge status={report.status} />
                    <Badge variant="outline" className="rounded-full bg-white/80 text-slate-600">
                      Updated {formatMiamiDateTime(report.updated_at)}
                    </Badge>
                  </>
                ) : null}
              </div>

              <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-normal text-slate-950 md:text-5xl">
                {report.client_name || `${report.rep_name}'s feedback`}
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
                Manual sales feedback for {report.rep_name}.
              </p>

              <div className="mt-6 grid gap-3 rounded-[20px] border border-slate-200 bg-white/80 p-4 text-sm sm:grid-cols-2">
                <MetaItem label="Rep" value={report.rep_name} icon={<UserRound className="size-4" />} />
                <MetaItem
                  label="Source"
                  value={(report.source_type || report.input_type).replace(/_/g, " ")}
                  icon={<FileText className="size-4" />}
                />
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <ExternalButton
                  href={reportDocLink}
                  label="Open Google Doc"
                  icon={<FileText className="size-4" />}
                  eventName="google_doc_clicked"
                  report={report}
                />
                <ExternalButton
                  href={zoomLink}
                  label="Zoom"
                  icon={<Video className="size-4" />}
                  eventName="zoom_clicked"
                  report={report}
                />
                <ExternalButton
                  href={transcriptLink}
                  label="Transcript"
                  icon={<MessageSquareText className="size-4" />}
                  unavailableLabel="Transcript unavailable"
                  eventName="transcript_clicked"
                  report={report}
                />
                {reportChatEnabled && report.status === "completed" ? (
                  <ReportChatPanel
                    reportType="manual"
                    reportId={report.public_id}
                    repName={report.rep_name}
                    clientName={report.client_name}
                  />
                ) : null}
              </div>
            </div>
          </header>

          {error ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
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
                <JsonSection value={closeSection.value} />
              </ReportSection>

              <ReportSection title="Objections Surfaced" icon={<MessageSquareText className="size-4" />}>
                <BulletList items={report.objections_surfaced} />
              </ReportSection>

              <ReportFeedbackWidget
                reportType="manual"
                reportId={report.public_id}
                repName={report.rep_name}
                clientName={report.client_name}
                reportCreatedAt={report.created_at}
              />
            </>
          ) : null}
        </article>
      </div>
    </main>
  );
}

function MetaItem({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="magic-icon-bubble size-8 shrink-0">{icon}</span>
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">{label}</div>
        <div className="mt-0.5 truncate font-semibold capitalize text-slate-700">{value}</div>
      </div>
    </div>
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
    <section className="magic-card p-8 text-center">
      <Loader2 className="mx-auto mb-3 size-8 animate-spin text-primary" />
      <h2 className="text-lg font-semibold text-slate-950">Your report is being generated</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
        This usually takes about 1-2 minutes. You can leave this page open and the report will appear automatically.
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
        "rounded-[20px] border p-5",
        destructive
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-red-100 bg-[#FEF2F2] text-slate-700",
      )}
    >
      <div className="flex gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full border border-red-100 bg-white text-[#DC2626]">
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
        "magic-card p-5 md:p-6",
        featured && "border-red-100 bg-[#FEF2F2]/80",
      )}
    >
      <h2 className="mb-4 flex items-center gap-2.5 text-lg font-extrabold leading-tight tracking-normal text-slate-950">
        <span className="grid size-9 place-items-center rounded-xl border border-red-100 bg-white text-[#DC2626]">
          {icon}
        </span>
        {title}
      </h2>
      <div className="text-base leading-8 text-slate-700 md:text-[17px]">{children}</div>
    </section>
  );
}

function ReportText({ children }: { children: React.ReactNode }) {
  return <p className="leading-8">{children}</p>;
}

function ExternalButton({
  href,
  label,
  icon,
  unavailableLabel,
  eventName,
  report,
}: {
  href: string | null;
  label: string;
  icon: React.ReactNode;
  unavailableLabel?: string;
  eventName: "google_doc_clicked" | "zoom_clicked" | "transcript_clicked";
  report: ManualFeedbackReport;
}) {
  if (!href) {
    if (!unavailableLabel) return null;

    return (
      <span
        aria-disabled="true"
        className={cn(buttonVariants({ variant: "outline" }), "h-10 gap-1 rounded-full border-slate-200 bg-white px-4 opacity-55")}
      >
        {icon}
        {unavailableLabel}
      </span>
    );
  }

  return (
    <TrackedExternalLink
      href={href}
      eventName={eventName}
      eventData={{
        source: "manual_report",
        target_rep_slug: slugify(report.rep_name),
        target_rep_name: report.rep_name,
        manual_public_id: report.public_id,
        metadata: {
          client_name: report.client_name,
          status: report.status,
        },
      }}
      target="_blank"
      rel="noreferrer"
      className={cn(
        buttonVariants({ variant: "outline" }),
        "h-10 gap-1 rounded-full border-slate-200 bg-white px-4 text-slate-700 hover:bg-[#FEF2F2] hover:text-[#B91C1C]",
      )}
    >
      {icon}
      {label}
      <ExternalLink className="size-4" />
    </TrackedExternalLink>
  );
}

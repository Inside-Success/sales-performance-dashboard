import Link from "next/link";
import type React from "react";
import {
  ArrowLeft,
  CalendarDays,
  ExternalLink,
  FileText,
  MessageSquareText,
  Send,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getManualFeedbackReports } from "@/lib/db";
import { formatMiamiDateTime, truncate } from "@/lib/format";
import { isManualFeedbackEnabled } from "@/lib/manual-reports";
import type { ManualFeedbackReport } from "@/lib/types";
import { cn } from "@/lib/utils";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ManualReportsPage() {
  if (!isManualFeedbackEnabled()) notFound();

  const reports = await getManualFeedbackReports();

  return (
    <main className="dashboard-page min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
        <header className="dashboard-card dashboard-hero rounded-xl border bg-card/95 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <Link href="/" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "px-0")}>
              <ArrowLeft className="size-4" />
              Home
            </Link>
            <Link href="/submit" className={buttonVariants({ variant: "outline", size: "sm" })}>
              <Send className="size-4" />
              Submit call
            </Link>
          </div>
          <Badge variant="secondary" className="mb-3">Manual feedback</Badge>
          <h1 className="text-2xl font-semibold tracking-normal md:text-3xl">
            Self-submitted feedback reports
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Completed manual coaching reports, kept separate from the official performance report list.
          </p>
          <p className="mt-3 text-xs font-medium text-muted-foreground">
            Showing {reports.length} completed {reports.length === 1 ? "report" : "reports"}.
          </p>
        </header>

        <section className="grid gap-2.5">
          {reports.length ? (
            reports.map((report) => <ManualReportCard key={report.public_id} report={report} />)
          ) : (
            <div className="rounded-xl border bg-card/80 p-8 text-center">
              <FileText className="mx-auto mb-3 size-8 text-muted-foreground" />
              <h2 className="text-base font-semibold">No completed manual reports yet</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                Completed Call 2+ reports will appear here after the workflow sends its callback.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function ManualReportCard({ report }: { report: ManualFeedbackReport }) {
  const reportDocLink = report.report_doc_link || report.google_doc_link;
  const transcriptLink = report.transcript_drive_link || report.transcript_link;
  const zoomLink = report.original_zoom_link || report.zoom_link;
  const title = report.client_name || `${report.rep_name}'s feedback`;
  const sourceLabel = report.source_type || report.input_type;

  return (
    <article className="dashboard-card rounded-lg border bg-card/95 p-4 transition-colors hover:border-primary/35">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 flex-1 space-y-1.5">
          <h2 className="text-base font-semibold leading-6">
            <Link href={`/self-report/${report.public_id}`} className="hover:underline">
              {title}
            </Link>
          </h2>

          {report.one_line_verdict ? (
            <p className="text-sm leading-6 text-muted-foreground md:max-w-2xl">
              {truncate(report.one_line_verdict, 185)}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <UserRound className="size-3.5" />
              {report.rep_name}
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3.5" />
              {formatMiamiDateTime(report.updated_at)}
            </span>
            {sourceLabel ? (
              <span className="capitalize">
                {sourceLabel.replace(/_/g, " ")}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-1.5 md:justify-end">
          <Link href={`/self-report/${report.public_id}`} className={buttonVariants({ size: "sm", variant: "outline" })}>
            Open report
          </Link>
          <ExternalButton href={reportDocLink} label="Doc" icon={<FileText className="size-4" />} />
          <ExternalButton href={transcriptLink} label="Transcript" icon={<MessageSquareText className="size-4" />} />
          <ExternalButton href={zoomLink} label="Zoom" icon={<ExternalLink className="size-4" />} />
        </div>
      </div>
    </article>
  );
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
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(buttonVariants({ size: "sm", variant: "ghost" }), "gap-1")}
    >
      {icon}
      {label}
    </a>
  );
}

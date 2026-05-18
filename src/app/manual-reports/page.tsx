import Link from "next/link";
import type React from "react";
import { ArrowLeft, Clock3, ExternalLink, FileText, MessageSquareText, UserRound } from "lucide-react";
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
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <header className="dashboard-card dashboard-hero rounded-2xl border bg-card/95 p-5 md:p-6">
          <Link href="/" className={cn(buttonVariants({ variant: "ghost" }), "mb-4 px-0")}>
            <ArrowLeft className="size-4" />
            Home
          </Link>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Manual feedback</Badge>
            <Badge variant="outline">Self-submitted</Badge>
          </div>
          <h1 className="text-3xl font-semibold tracking-normal md:text-4xl">
            Self-submitted feedback reports
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Manual reports stay separate from the official performance report list.
          </p>
        </header>

        <section className="space-y-3">
          {reports.length ? (
            reports.map((report) => <ManualReportCard key={report.public_id} report={report} />)
          ) : (
            <div className="rounded-xl border bg-card/80 p-8 text-center">
              <FileText className="mx-auto mb-3 size-8 text-muted-foreground" />
              <h2 className="text-base font-semibold">No manual reports yet</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                Self-submitted reports will appear here after the workflow sends its callback.
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

  return (
    <article className="dashboard-card rounded-lg border bg-card/95 p-4 transition-all hover:-translate-y-px hover:border-primary/40">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant={report.status === "completed" ? "secondary" : "outline"} className="capitalize">
              {report.status.replace(/_/g, " ")}
            </Badge>
            {report.source_type || report.input_type ? (
              <Badge variant="outline" className="capitalize">
                {(report.source_type || report.input_type).replace(/_/g, " ")}
              </Badge>
            ) : null}
            <span className="inline-flex items-center gap-1">
              <Clock3 className="size-3.5" />
              Updated {formatMiamiDateTime(report.updated_at)}
            </span>
            <span className="inline-flex items-center gap-1">
              <UserRound className="size-3.5" />
              {report.rep_name}
            </span>
          </div>

          <h2 className="text-base font-semibold">
            <Link href={`/self-report/${report.public_id}`} className="hover:underline">
              {report.client_name || "Self-submitted report"}
            </Link>
          </h2>

          {report.one_line_verdict ? (
            <p className="text-sm leading-6 text-muted-foreground">
              {truncate(report.one_line_verdict, 220)}
            </p>
          ) : report.refusal_reason ? (
            <p className="text-sm leading-6 text-muted-foreground">
              {truncate(report.refusal_reason, 220)}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
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

import Link from "next/link";
import type React from "react";
import {
  ArrowLeft,
  ArrowDownWideNarrow,
  CalendarDays,
  ExternalLink,
  FileText,
  MessageSquareText,
  Send,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { RepPicker } from "@/components/dashboard/rep-picker";
import { getManualFeedbackReports } from "@/lib/db";
import { formatMiamiDateTime, truncate } from "@/lib/format";
import { isManualFeedbackEnabled } from "@/lib/manual-reports";
import { slugify } from "@/lib/slug";
import type { ManualFeedbackReport, RepSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ManualReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ rep?: string | string[] }>;
}) {
  if (!isManualFeedbackEnabled()) notFound();

  const selectedRepSlug = readRepParam(await searchParams);
  const allReports = await getManualFeedbackReports(500);
  const reps = buildManualRepSummaries(allReports);
  const selectedRepName =
    reps.find((rep) => rep.rep_slug === selectedRepSlug)?.rep_name ||
    allReports.find((report) => slugify(report.rep_name) === selectedRepSlug)?.rep_name ||
    "";
  const reports = selectedRepSlug
    ? allReports.filter((report) => slugify(report.rep_name) === selectedRepSlug)
    : [];
  const hasSelectedRep = Boolean(selectedRepSlug);

  return (
    <main className="dashboard-page min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
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

          <div className="mt-5 rounded-xl border bg-background/80 p-3">
            <RepPicker reps={reps} selectedRepSlug={selectedRepSlug} basePath="/manual-reports" />
          </div>

          {hasSelectedRep ? (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <Badge variant="outline" className="gap-1 rounded-md bg-background/70">
                <ArrowDownWideNarrow className="size-3.5" />
                Newest received first
              </Badge>
            </div>
          ) : null}
        </header>

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">
              {hasSelectedRep ? `${selectedRepName || "Selected rep"}'s manual reports` : "Choose a rep"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {hasSelectedRep
                ? `${reports.length} completed manual ${reports.length === 1 ? "report" : "reports"} received by the dashboard.`
                : "The manual report list appears after a rep is selected."}
            </p>
          </div>

          {hasSelectedRep ? (
            reports.length ? (
              <div className="grid gap-3">
                {reports.map((report) => <ManualReportCard key={report.public_id} report={report} />)}
              </div>
            ) : (
              <EmptyState repName={selectedRepName} />
            )
          ) : (
            <SelectionState />
          )}
        </section>
      </div>
    </main>
  );
}

function readRepParam(searchParams: { rep?: string | string[] }) {
  const rep = searchParams.rep;
  return Array.isArray(rep) ? rep[0] : rep;
}

function buildManualRepSummaries(reports: ManualFeedbackReport[]): RepSummary[] {
  const reps = new Map<string, RepSummary>();

  for (const report of reports) {
    const repSlug = slugify(report.rep_name);
    const existing = reps.get(repSlug);
    if (!existing) {
      reps.set(repSlug, {
        rep_name: report.rep_name,
        rep_slug: repSlug,
        call_count: 1,
        latest_call_date: report.updated_at,
      });
      continue;
    }

    existing.call_count += 1;
    if (!existing.latest_call_date || new Date(report.updated_at) > new Date(existing.latest_call_date)) {
      existing.latest_call_date = report.updated_at;
    }
  }

  return [...reps.values()].sort((a, b) => a.rep_name.localeCompare(b.rep_name));
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

function SelectionState() {
  return (
    <div className="rounded-xl border bg-card/80 p-8 text-center">
      <UserRound className="mx-auto mb-3 size-8 text-muted-foreground" />
      <h3 className="text-base font-semibold">No rep selected</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        Completed manual reports are grouped by rep.
      </p>
    </div>
  );
}

function EmptyState({ repName }: { repName: string }) {
  return (
    <div className="rounded-xl border bg-card/80 p-8 text-center">
      <FileText className="mx-auto mb-3 size-8 text-muted-foreground" />
      <h3 className="text-base font-semibold">No completed manual reports found</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {repName ? `${repName} does not have completed manual reports yet.` : "This rep does not have completed manual reports yet."}
      </p>
    </div>
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

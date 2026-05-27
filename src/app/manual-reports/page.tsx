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
import { ReportFilters } from "@/components/dashboard/report-filters";
import { RepPicker } from "@/components/dashboard/rep-picker";
import { TrackedExternalLink, TrackedLink, TrackUsageEvent } from "@/components/dashboard/usage-tracker";
import { getManualFeedbackReports } from "@/lib/db";
import { formatMiamiDateTime, truncate } from "@/lib/format";
import { isManualFeedbackEnabled } from "@/lib/manual-reports";
import { readFilters, type RawSearchParams } from "@/lib/search-params";
import { slugify } from "@/lib/slug";
import type { DashboardFilters, ManualFeedbackReport, RepSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ManualReportsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  if (!isManualFeedbackEnabled()) notFound();

  const filters = readFilters(await searchParams);
  const selectedRepSlug = filters.rep;
  const allReports = await getManualFeedbackReports(500);
  const reps = buildManualRepSummaries(allReports);
  const selectedRepName =
    reps.find((rep) => rep.rep_slug === selectedRepSlug)?.rep_name ||
    allReports.find((report) => slugify(report.rep_name) === selectedRepSlug)?.rep_name ||
    "";
  const reports = selectedRepSlug
    ? filterManualReports(
        allReports.filter((report) => slugify(report.rep_name) === selectedRepSlug),
        filters,
      )
    : [];
  const hasSelectedRep = Boolean(selectedRepSlug);
  const hasFilters = Boolean(filters.q || filters.date);

  return (
    <main className="dashboard-page min-h-screen bg-background">
      <TrackUsageEvent
        eventName="manual_reports_page_viewed"
        eventData={{
          source: "manual_reports",
          target_rep_slug: selectedRepSlug || null,
          target_rep_name: selectedRepName || null,
        }}
      />
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <header className="dashboard-card dashboard-hero rounded-xl border bg-card/95 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <Link href="/" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "px-0")}>
              <ArrowLeft className="size-4" />
              Home
            </Link>
            <Link href="/submit" className={buttonVariants({ variant: "outline", size: "sm" })}>
              <Send className="size-4" />
              Get feedback
            </Link>
          </div>
          <Badge variant="secondary" className="mb-3">Self-submitted feedback</Badge>
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
                Newest completed first
              </Badge>
            </div>
          ) : null}
        </header>

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">
              {hasSelectedRep ? `${selectedRepName || "Selected rep"}'s self-submitted reports` : "Choose a rep"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {hasSelectedRep
                ? `${reports.length} completed manual ${reports.length === 1 ? "report" : "reports"} found.`
                : "The manual report list appears after a rep is selected."}
            </p>
          </div>

          {hasSelectedRep ? (
            <>
              <ReportFilters
                action="/manual-reports"
                filters={filters}
                repSlug={selectedRepSlug}
                clearHref={`/manual-reports?rep=${encodeURIComponent(selectedRepSlug || "")}`}
                searchPlaceholder="Client, report text, or date"
                dateLabel="Completed date"
              />
              {reports.length ? (
                <div className="grid gap-3">
                  {reports.map((report) => <ManualReportCard key={report.public_id} report={report} />)}
                </div>
              ) : (
                <EmptyState repName={selectedRepName} hasFilters={hasFilters} />
              )}
            </>
          ) : (
            <SelectionState />
          )}
        </section>
      </div>
    </main>
  );
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

function filterManualReports(reports: ManualFeedbackReport[], filters: DashboardFilters) {
  const query = filters.q?.trim().toLowerCase();

  return reports.filter((report) => {
    if (filters.date && getMiamiDateKey(report.updated_at) !== filters.date) return false;
    if (!query) return true;

    return buildManualSearchText(report).includes(query);
  });
}

function buildManualSearchText(report: ManualFeedbackReport) {
  return [
    report.rep_name,
    report.client_name,
    report.one_line_verdict,
    report.biggest_strength,
    report.biggest_fix,
    report.coaching_tip,
    report.rudys_note,
    report.source_type,
    report.input_type,
    report.call_status,
    formatMiamiDateTime(report.updated_at),
    getMiamiDateKey(report.updated_at),
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function getMiamiDateKey(value: string | null | undefined) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return year && month && day ? `${year}-${month}-${day}` : "";
}

function ManualReportCard({ report }: { report: ManualFeedbackReport }) {
  const reportDocLink = report.report_doc_link || report.google_doc_link;
  const transcriptLink = report.transcript_drive_link || report.transcript_link;
  const zoomLink = report.original_zoom_link || report.zoom_link;
  const title = report.client_name || `${report.rep_name}'s feedback`;
  const sourceLabel = report.source_type || report.input_type;
  const trackingData = {
    source: "manual_reports",
    target_rep_slug: slugify(report.rep_name),
    target_rep_name: report.rep_name,
    manual_public_id: report.public_id,
    metadata: {
      client_name: report.client_name,
      status: report.status,
    },
  };

  return (
    <article className="dashboard-card rounded-lg border bg-card/95 p-4 transition-colors hover:border-primary/35">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 flex-1 space-y-1.5">
          <h2 className="text-base font-semibold leading-6">
            <TrackedLink
              href={`/self-report/${report.public_id}`}
              eventName="report_card_clicked"
              eventData={trackingData}
              className="hover:underline"
            >
              {title}
            </TrackedLink>
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
              Completed {formatMiamiDateTime(report.updated_at)}
            </span>
            {sourceLabel ? (
              <span className="capitalize">
                {sourceLabel.replace(/_/g, " ")}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-1.5 md:justify-end">
          <TrackedLink
            href={`/self-report/${report.public_id}`}
            eventName="report_card_clicked"
            eventData={trackingData}
            className={buttonVariants({ size: "sm", variant: "outline" })}
          >
            Open report
          </TrackedLink>
          <ExternalButton href={reportDocLink} label="Doc" icon={<FileText className="size-4" />} eventName="google_doc_clicked" eventData={trackingData} />
          <ExternalButton href={transcriptLink} label="Transcript" icon={<MessageSquareText className="size-4" />} eventName="transcript_clicked" eventData={trackingData} />
          <ExternalButton href={zoomLink} label="Zoom" icon={<ExternalLink className="size-4" />} eventName="zoom_clicked" eventData={trackingData} />
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
        Self-submitted reports are grouped by rep.
      </p>
    </div>
  );
}

function EmptyState({ repName, hasFilters }: { repName: string; hasFilters?: boolean }) {
  return (
    <div className="rounded-xl border bg-card/80 p-8 text-center">
      <FileText className="mx-auto mb-3 size-8 text-muted-foreground" />
      <h3 className="text-base font-semibold">No completed self-submitted reports found</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {hasFilters
          ? "No self-submitted reports match that search."
          : repName
            ? `${repName} does not have completed self-submitted reports yet.`
            : "This rep does not have completed self-submitted reports yet."}
      </p>
    </div>
  );
}

function ExternalButton({
  href,
  label,
  icon,
  eventName,
  eventData,
}: {
  href: string | null;
  label: string;
  icon: React.ReactNode;
  eventName: "google_doc_clicked" | "zoom_clicked" | "transcript_clicked";
  eventData: {
    source: string;
    target_rep_slug: string;
    target_rep_name: string;
    manual_public_id: string;
    metadata: {
      client_name: string | null;
      status: ManualFeedbackReport["status"];
    };
  };
}) {
  if (!href) return null;

  return (
    <TrackedExternalLink
      href={href}
      eventName={eventName}
      eventData={eventData}
      target="_blank"
      rel="noreferrer"
      className={cn(buttonVariants({ size: "sm", variant: "ghost" }), "gap-1")}
    >
      {icon}
      {label}
    </TrackedExternalLink>
  );
}

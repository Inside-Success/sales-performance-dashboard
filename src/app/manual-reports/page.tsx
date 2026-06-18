import type React from "react";
import {
  ArrowRight,
  CalendarDays,
  ExternalLink,
  FileText,
  Inbox,
  MessageSquareText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ReportFilters } from "@/components/dashboard/report-filters";
import { ReportVersionBadge } from "@/components/dashboard/report-version-badge";
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
    <main className="magic-page">
      <TrackUsageEvent
        eventName="manual_reports_page_viewed"
        eventData={{
          source: "manual_reports",
          target_rep_slug: selectedRepSlug || null,
          target_rep_name: selectedRepName || null,
        }}
      />
      <div className="mx-auto w-full max-w-3xl px-5 pb-24 pt-12 sm:px-8 sm:pt-16">
        <header className="mb-9">
          <h1 className="text-[38px] font-extrabold leading-[1.05] tracking-normal text-slate-900 sm:text-[48px]">
            Self-submitted reports
          </h1>
          <ul className="mt-6 space-y-2 text-[17px] font-medium leading-[1.8] text-slate-500">
            <li className="flex items-start gap-2.5">
              <span className="mt-[13px] size-1.5 shrink-0 rounded-full bg-[#DC2626]" />
              <span>Review manually submitted Magic Mike coaching feedback.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-[13px] size-1.5 shrink-0 rounded-full bg-[#DC2626]" />
              <span>Keep self-submitted calls separate from official production reports.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-[13px] size-1.5 shrink-0 rounded-full bg-[#DC2626]" />
              <span>Select a rep to see their completed manual feedback reports.</span>
            </li>
          </ul>
        </header>

        <section className="magic-card magic-selector-card">
          <div className="border-b border-slate-100 p-5 sm:p-7">
            <RepPicker
              reps={reps}
              selectedRepSlug={selectedRepSlug}
              basePath="/manual-reports"
              selectedSubline="Viewing self-submitted reports"
            />
          </div>
          {hasSelectedRep ? (
            <div className="space-y-5 p-5 sm:p-7">
              <div className="flex flex-col gap-2 rounded-[20px] border border-slate-100 bg-slate-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-slate-400">
                    Viewing self-submitted reports
                  </p>
                  <h2 className="mt-1 text-[22px] font-extrabold tracking-normal text-slate-950">
                    {selectedRepName || "Selected rep"}
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2 text-[13px] font-semibold text-slate-500">
                  <span className="rounded-full border border-red-100 bg-[#FEF2F2] px-3 py-1 text-[#B91C1C]">
                    {reports.length} report{reports.length === 1 ? "" : "s"}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
                    Newest first
                  </span>
                </div>
              </div>
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
            </div>
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
    <article className="magic-card overflow-hidden transition-all hover:-translate-y-px hover:border-red-200 hover:shadow-xl">
      <div className="space-y-3 border-b border-slate-100 bg-slate-50/60 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <ReportVersionBadge createdAt={report.created_at} />
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-3.5" />
            Completed {formatMiamiDateTime(report.updated_at)}
          </span>
          {sourceLabel ? (
            <span className="capitalize">
              {sourceLabel.replace(/_/g, " ")}
            </span>
          ) : null}
          {report.status ? (
            <Badge variant="outline" className="h-6 rounded-full bg-white text-xs capitalize text-slate-500">
              {report.status.replace(/_/g, " ")}
            </Badge>
          ) : null}
        </div>

        <h2 className="text-lg font-semibold leading-7 text-slate-950">
          <TrackedLink
            href={`/self-report/${report.public_id}`}
            eventName="report_card_clicked"
            eventData={trackingData}
            className="hover:text-[#B91C1C]"
          >
            {title}
          </TrackedLink>
        </h2>

        {report.one_line_verdict ? (
          <p className="text-sm leading-6 text-slate-600">
            {truncate(report.one_line_verdict, 220)}
          </p>
        ) : null}
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <div className="grid gap-3 text-sm md:grid-cols-2">
          <SummaryBlock
            icon={<MessageSquareText className="size-4" />}
            label="Biggest Strength"
            value={report.biggest_strength}
          />
          <SummaryBlock
            icon={<FileText className="size-4" />}
            label="What I'd Polish"
            value={report.biggest_fix}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <TrackedLink
            href={`/self-report/${report.public_id}`}
            eventName="report_card_clicked"
            eventData={trackingData}
            className={cn(
              buttonVariants({ size: "sm", variant: "outline" }),
              "h-9 rounded-full border-slate-200 bg-white px-4 text-slate-700 hover:bg-[#FEF2F2] hover:text-[#B91C1C]",
            )}
          >
            Open report
            <ArrowRight className="size-3.5" />
          </TrackedLink>
          <ExternalButton href={reportDocLink} label="Doc" icon={<FileText className="size-4" />} eventName="google_doc_clicked" eventData={trackingData} />
          <ExternalButton href={transcriptLink} label="Transcript" icon={<MessageSquareText className="size-4" />} eventName="transcript_clicked" eventData={trackingData} />
          <ExternalButton href={zoomLink} label="Zoom" icon={<ExternalLink className="size-4" />} eventName="zoom_clicked" eventData={trackingData} />
        </div>
      </div>
    </article>
  );
}

function SummaryBlock({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
      <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
        {icon}
        {label}
      </div>
      <p className="leading-6 text-slate-700">{truncate(value, 150) || "Not provided"}</p>
    </div>
  );
}

function SelectionState() {
  return (
    <div className="px-6 py-20 text-center sm:px-10">
      <span className="relative mx-auto mb-8 grid size-28 place-items-center rounded-[30px] bg-[#FEF2F2] text-[#DC2626]">
        <Inbox className="size-12" strokeWidth={2.4} />
        <span className="absolute -right-3 -top-3 grid size-10 place-items-center rounded-full bg-white text-slate-300 shadow-sm">
          ✦
        </span>
      </span>
      <h3 className="text-[24px] font-extrabold tracking-normal text-slate-900">No rep selected</h3>
      <p className="mx-auto mt-4 max-w-sm text-[16px] font-medium leading-8 text-slate-500">
        The manual report list appears after a rep is selected. Self-submitted reports are grouped by rep.
      </p>
    </div>
  );
}

function EmptyState({ repName, hasFilters }: { repName: string; hasFilters?: boolean }) {
  return (
    <div className="p-10 text-center">
      <FileText className="mx-auto mb-3 size-8 text-slate-400" />
      <h3 className="text-base font-semibold text-slate-950">No completed self-submitted reports found</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
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
      className={cn(buttonVariants({ size: "sm", variant: "ghost" }), "h-9 rounded-full px-3 text-slate-500 hover:text-[#B91C1C]")}
    >
      {icon}
      {label}
    </TrackedExternalLink>
  );
}

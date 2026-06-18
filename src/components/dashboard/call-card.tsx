import {
  ArrowRight,
  CalendarDays,
  Clock3,
  ExternalLink,
  FileText,
  MessageSquareText,
  UserRound,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ReportVersionBadge } from "@/components/dashboard/report-version-badge";
import { TrackedExternalLink, TrackedLink } from "@/components/dashboard/usage-tracker";
import { formatMiamiDateTime, formatMiamiMeetingDateTime, truncate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PerformanceCall } from "@/lib/types";

type CallCardProps = {
  call: PerformanceCall;
  compact?: boolean;
  showRep?: boolean;
};

export function CallCard({ call, compact = false, showRep = true }: CallCardProps) {
  const title = call.client_name || call.meeting_title || "Unknown client";
  const meetingLine = getMeetingLine(call);
  const trackingData = getReportTrackingData(call);

  if (compact) {
    return (
      <article className="magic-card transition-all hover:-translate-y-px hover:border-red-200 hover:shadow-xl">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <ReportVersionBadge createdAt={call.created_at} />
            </div>
            <h3 className="text-base font-semibold leading-6 text-slate-950">
              <TrackedLink
                href={`/call/${call.id}`}
                eventName="report_card_clicked"
                eventData={trackingData}
                className="hover:text-[#B91C1C]"
              >
                {title}
              </TrackedLink>
            </h3>
            {meetingLine ? <p className="text-sm text-slate-500">{meetingLine}</p> : null}
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              {call.call_date ? (
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="size-3.5" />
                  Meeting {formatMiamiMeetingDateTime(call.call_date)}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="size-3.5" />
                  Received {formatMiamiDateTime(call.updated_at)}
                </span>
              )}
            </div>
          </div>

          <TrackedLink
            href={`/call/${call.id}`}
            eventName="report_card_clicked"
            eventData={trackingData}
            className={cn(
              buttonVariants({ size: "sm", variant: "outline" }),
              "h-9 rounded-full border-slate-200 bg-white px-4 text-slate-700 hover:bg-[#FEF2F2] hover:text-[#B91C1C] sm:shrink-0",
            )}
          >
            Open report
            <ArrowRight className="size-3.5" />
          </TrackedLink>
        </div>
      </article>
    );
  }

  return (
    <article className="magic-card overflow-hidden transition-all hover:-translate-y-px hover:border-red-200 hover:shadow-xl">
      <div className="space-y-3 border-b border-slate-100 bg-slate-50/60 p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <ReportVersionBadge createdAt={call.created_at} />
          {call.call_date ? (
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3.5" />
              Meeting {formatMiamiMeetingDateTime(call.call_date)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <Clock3 className="size-3.5" />
              Received {formatMiamiDateTime(call.updated_at)}
            </span>
          )}
          {showRep ? (
            <span className="inline-flex items-center gap-1">
              <UserRound className="size-3.5" />
              {call.rep_name}
            </span>
          ) : null}
        </div>
        <h3 className="text-lg font-semibold text-slate-950">
          <TrackedLink
            href={`/call/${call.id}`}
            eventName="report_card_clicked"
            eventData={trackingData}
            className="hover:text-[#B91C1C]"
          >
            {title}
          </TrackedLink>
        </h3>
        {meetingLine ? <p className="text-sm text-slate-500">{meetingLine}</p> : null}
      </div>
      <div className="space-y-4 p-5">
        {call.one_line_verdict ? (
          <p className="text-sm leading-6 text-slate-600">
            {truncate(call.one_line_verdict, 220)}
          </p>
        ) : null}

        <div className="grid gap-3 text-sm md:grid-cols-2">
          <SummaryBlock icon={<MessageSquareText className="size-4" />} label="Biggest Strength" value={call.biggest_strength} />
          <SummaryBlock icon={<FileText className="size-4" />} label="What I'd Polish" value={call.biggest_fix} />
        </div>

        <div className="flex flex-wrap gap-2">
          <TrackedLink
            href={`/call/${call.id}`}
            eventName="report_card_clicked"
            eventData={trackingData}
            className={cn(
              buttonVariants({ size: "sm", variant: "outline" }),
              "h-9 rounded-full border-slate-200 bg-white px-4 hover:bg-[#FEF2F2] hover:text-[#B91C1C]",
            )}
          >
            Open report
            <ArrowRight className="size-3.5" />
          </TrackedLink>
          {call.google_doc_link ? (
            <TrackedExternalLink
              href={call.google_doc_link}
              eventName="google_doc_clicked"
              eventData={trackingData}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ size: "sm", variant: "ghost" }), "h-9 rounded-full px-3 text-slate-500 hover:text-[#B91C1C]")}
            >
              <ExternalLink className="size-4" />
              Drive
            </TrackedExternalLink>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function getReportTrackingData(call: PerformanceCall) {
  return {
    source: "official_dashboard",
    target_rep_slug: call.rep_slug,
    target_rep_name: call.rep_name,
    report_id: call.id,
    metadata: {
      client_name: call.client_name,
      meeting_title: call.meeting_title,
    },
  };
}

function getMeetingLine(call: PerformanceCall) {
  if (!call.meeting_title) return null;

  const meetingTitle = call.meeting_title.trim();
  if (!meetingTitle || meetingTitle === call.client_name?.trim()) return null;

  return meetingTitle;
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

import { CalendarDays, Clock3, ExternalLink, FileText, MessageSquareText, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <Card className="dashboard-card rounded-lg border-border/80 bg-card/95 transition-all hover:-translate-y-px hover:border-primary/40">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-2">
            <CardTitle className="text-base">
              <TrackedLink
                href={`/call/${call.id}`}
                eventName="report_card_clicked"
                eventData={trackingData}
                className="hover:underline"
              >
                {title}
              </TrackedLink>
            </CardTitle>
            {meetingLine ? <p className="text-sm text-muted-foreground">{meetingLine}</p> : null}
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
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
            className={cn(buttonVariants({ size: "sm", variant: "outline" }), "sm:shrink-0")}
          >
            Open report
          </TrackedLink>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="dashboard-card rounded-lg border-border/80 bg-card/95 transition-all hover:-translate-y-px hover:border-primary/40">
      <CardHeader className="gap-3 border-b bg-muted/15">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
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
          {call.call_status ? <Badge variant="secondary">{call.call_status}</Badge> : null}
        </div>
        <CardTitle className={compact ? "text-base" : "text-lg"}>
          <TrackedLink
            href={`/call/${call.id}`}
            eventName="report_card_clicked"
            eventData={trackingData}
            className="hover:underline"
          >
            {title}
          </TrackedLink>
        </CardTitle>
        {meetingLine ? <p className="text-sm text-muted-foreground">{meetingLine}</p> : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {call.one_line_verdict ? (
          <p className="text-sm leading-6 text-muted-foreground">
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
            className={buttonVariants({ size: "sm", variant: "outline" })}
          >
            Open report
          </TrackedLink>
          {call.google_doc_link ? (
            <TrackedExternalLink
              href={call.google_doc_link}
              eventName="google_doc_clicked"
              eventData={trackingData}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ size: "sm", variant: "ghost" }), "gap-1")}
            >
              <ExternalLink className="size-4" />
              Drive
            </TrackedExternalLink>
          ) : null}
        </div>
      </CardContent>
    </Card>
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
    <div className="rounded-md border bg-background/80 p-3 shadow-xs">
      <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="leading-6">{truncate(value, 150) || "Not provided"}</p>
    </div>
  );
}

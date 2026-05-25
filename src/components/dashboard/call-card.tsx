import Link from "next/link";
import { CalendarDays, Clock3, ExternalLink, FileText, MessageSquareText, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMiamiDateTime, formatMiamiMeetingDateTime, truncate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PerformanceCall } from "@/lib/types";

type CallCardProps = {
  call: PerformanceCall;
  compact?: boolean;
  showRep?: boolean;
};

export function CallCard({ call, compact = false, showRep = true }: CallCardProps) {
  const title = call.meeting_title || call.client_name || "Unknown client";
  const clientLine = getClientLine(call);

  if (compact) {
    return (
      <Card className="dashboard-card rounded-lg border-border/80 bg-card/95 transition-all hover:-translate-y-px hover:border-primary/40">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-2">
            <CardTitle className="text-base">
              <Link href={`/call/${call.id}`} className="hover:underline">
                {title}
              </Link>
            </CardTitle>
            {clientLine ? <p className="text-sm text-muted-foreground">{clientLine}</p> : null}
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

          <Link href={`/call/${call.id}`} className={cn(buttonVariants({ size: "sm", variant: "outline" }), "sm:shrink-0")}>
            Open report
          </Link>
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
          <Link href={`/call/${call.id}`} className="hover:underline">
            {title}
          </Link>
        </CardTitle>
        {clientLine ? <p className="text-sm text-muted-foreground">{clientLine}</p> : null}
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
          <Link href={`/call/${call.id}`} className={buttonVariants({ size: "sm", variant: "outline" })}>
            Open report
          </Link>
          {call.google_doc_link ? (
            <a
              href={call.google_doc_link}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ size: "sm", variant: "ghost" }), "gap-1")}
            >
              <ExternalLink className="size-4" />
              Drive
            </a>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function getClientLine(call: PerformanceCall) {
  if (!call.client_name || !call.meeting_title) return null;

  const client = call.client_name.trim();
  const title = call.meeting_title.trim().toLowerCase();
  if (!client || title.includes(client.toLowerCase())) return null;

  return client;
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

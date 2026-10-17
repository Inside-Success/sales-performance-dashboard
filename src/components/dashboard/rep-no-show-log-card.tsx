"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, FileText, Search, X } from "lucide-react";
import type { RepNoShowCall } from "@/lib/rep-no-show";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  attendanceDayKey,
  miamiDayKey,
  miamiMidnight,
  type AttendanceDay,
} from "@/lib/rep-no-show-calendar";
import { formatMiamiDateTime } from "@/lib/format";

const numberFormatter = new Intl.NumberFormat("en-US");

export function RepNoShowLogCard({
  calls,
  historyCount,
  trackingStartedAt,
  periodStart,
  periodDays,
  calendarDay,
  readAt,
  referenceAt,
}: {
  calls: RepNoShowCall[];
  historyCount: number;
  trackingStartedAt: string;
  periodStart: string;
  periodDays: number;
  calendarDay?: AttendanceDay;
  readAt: string;
  referenceAt: string;
}) {
  const [query, setQuery] = useState("");
  const [visibleLimit, setVisibleLimit] = useState(100);
  const [callType, setCallType] = useState("all");
  const [logPeriod, setLogPeriod] = useState<string>(calendarDay || "selected");
  const history = logPeriod === "all";
  const needsHistory =
    history || (logPeriod !== "selected" && logPeriod !== calendarDay);
  const [remote, setRemote] = useState<{
    period: string;
    calls: RepNoShowCall[];
    readAt: string;
  } | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const loaded = needsHistory && remote?.period === logPeriod ? remote : null;
  useEffect(() => {
    if (!needsHistory || loaded) return;
    const controller = new AbortController();
    const path = `/api/admin/rep-no-show/history${logPeriod === "today" || logPeriod === "yesterday" ? `?day=${logPeriod}` : ""}`;
    fetch(path, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !Array.isArray(data.calls))
          throw new Error(
            "Attendance could not be loaded. Please switch back and try again.",
          );
        if (!controller.signal.aborted) {
          setRemote({
            period: logPeriod,
            calls: data.calls,
            readAt: data.fetchedAt || readAt,
          });
          setHistoryError(null);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setHistoryError(
            "Attendance could not be loaded. Please switch back and try again.",
          );
      });
    return () => controller.abort();
  }, [needsHistory, loaded, readAt, logPeriod]);
  const totalCount = history && loaded ? loaded.calls.length : historyCount;
  const displayedCalls = useMemo(
    () => (needsHistory ? loaded?.calls || [] : calls),
    [needsHistory, loaded, calls],
  );
  const filteredCalls = useMemo(
    () =>
      filterCalls(
        displayedCalls.filter(
          (call) =>
            (history ||
              (call.callDate &&
                (logPeriod === "today" || logPeriod === "yesterday"
                  ? miamiDayKey(call.callDate) ===
                    attendanceDayKey(logPeriod, new Date(referenceAt))
                  : Date.parse(call.callDate) >= Date.parse(periodStart)))) &&
            (callType === "all" ||
              (callType === "call1"
                ? call.callNumber.trim().toLowerCase() === "call 1"
                : call.callNumber.trim().toLowerCase() !== "call 1")),
        ),
        query,
      ),
    [
      displayedCalls,
      query,
      callType,
      history,
      periodStart,
      logPeriod,
      referenceAt,
    ],
  );

  const dayPending =
    (logPeriod === "today" || logPeriod === "yesterday") &&
    Date.parse(needsHistory ? loaded?.readAt || referenceAt : readAt) <
      miamiMidnight(miamiDayKey(referenceAt)).getTime();
  return (
    <Card className="magic-card">
      <CardHeader className="border-b">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-4" />
              Detected no-shows
            </CardTitle>
            <CardDescription>
              {history
                ? "Showing all history."
                : logPeriod === "today"
                  ? "Showing today in Miami time."
                  : logPeriod === "yesterday"
                    ? "Showing yesterday in Miami time."
                    : "Showing the selected period."}{" "}
              All history is available from {formatShortDate(trackingStartedAt)}
              .
            </CardDescription>
          </div>
          <Badge variant="outline" className="w-fit bg-background">
            {formatNumber(totalCount)} total
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-0">
        {historyCount ? (
          <>
            <div className="border-b px-4 py-3">
              <div className="mb-3 flex flex-wrap gap-3">
                <label className="text-sm font-medium">
                  Call type{" "}
                  <select
                    aria-label="Filter no-shows by call type"
                    value={callType}
                    onChange={(event) => {
                      setVisibleLimit(100);
                      setCallType(event.target.value);
                    }}
                    className="ml-2 min-h-11 rounded-lg border bg-background p-2"
                  >
                    <option value="all">All calls</option>
                    <option value="call1">Call 1</option>
                    <option value="call2">Call 2+</option>
                  </select>
                </label>
                <label className="text-sm font-medium">
                  Period{" "}
                  <select
                    aria-label="No-show log period"
                    value={logPeriod}
                    onChange={(event) => {
                      setVisibleLimit(100);
                      setHistoryError(null);
                      setLogPeriod(event.target.value);
                    }}
                    className="ml-2 min-h-11 rounded-lg border bg-background p-2"
                  >
                    {!calendarDay && (
                      <option value="selected">Last {periodDays} days</option>
                    )}
                    <option value="today">Today</option>
                    <option value="yesterday">Yesterday</option>
                    <option value="all">All history</option>
                  </select>
                </label>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full sm:max-w-md">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => {
                      setVisibleLimit(100);
                      setQuery(event.target.value);
                    }}
                    placeholder="Search rep, client, date, call, reason..."
                    className="h-11 pl-8 pr-8"
                    aria-label="Search detected no-shows"
                  />
                  {query ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className="absolute right-1.5 top-1/2 -translate-y-1/2"
                      onClick={() => {
                        setVisibleLimit(100);
                        setQuery("");
                      }}
                      aria-label="Clear no-show search"
                    >
                      <X className="size-3.5" />
                    </Button>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {dayPending
                    ? "Daily attendance is being updated."
                    : `Showing ${formatNumber(filteredCalls.length)} of ${formatNumber(totalCount)}`}
                </p>
              </div>
            </div>

            {dayPending ? (
              <p role="status" className="px-4 py-4 text-sm">
                Daily attendance is being updated. Please try again shortly.
              </p>
            ) : needsHistory && !loaded ? (
              <p
                role={historyError ? "alert" : "status"}
                className="px-4 py-4 text-sm"
              >
                {historyError || "Loading attendance…"}
              </p>
            ) : filteredCalls.length ? (
              <div className="dashboard-scroll max-h-[31.25rem] divide-y overflow-y-auto">
                {filteredCalls.slice(0, visibleLimit).map((call) => (
                  <NoShowLogRow key={call.id} call={call} />
                ))}
              </div>
            ) : (
              <div className="px-4 py-4">
                <EmptyState text="No no-shows match these filters." />
              </div>
            )}
            {filteredCalls.length > visibleLimit ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  {visibleLimit} of {formatNumber(filteredCalls.length)}{" "}
                  matching entries displayed
                </p>
                <Button
                  variant="outline"
                  className="min-h-11"
                  onClick={() => setVisibleLimit((limit) => limit + 100)}
                >
                  Show 100 more
                </Button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="px-4 py-4">
            <EmptyState text="No rep no-shows have been detected since tracking activation." />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NoShowLogRow({ call }: { call: RepNoShowCall }) {
  return (
    <div className="grid min-h-[6.25rem] gap-3 px-4 py-4 lg:grid-cols-[12rem_minmax(0,1fr)_10rem] lg:items-start">
      <div className="space-y-2">
        <p className="text-sm font-medium">
          {formatMiamiDateTime(call.callDate)}
        </p>
        <Badge variant="outline">{call.callNumber}</Badge>
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="font-medium">{call.repName}</p>
          <span className="text-xs text-muted-foreground">with</span>
          <p className="text-sm text-muted-foreground">{call.clientName}</p>
        </div>
        <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">
          {formatNoShowReason(call)}
        </p>
      </div>
      <div className="flex flex-wrap gap-2 lg:justify-end">
        <ExternalLinkButton href={call.meetingLink} label="Zoom" />
        <ExternalLinkButton href={call.transcriptLink} label="Transcript" />
      </div>
    </div>
  );
}

function ExternalLinkButton({ href, label }: { href: string; label: string }) {
  if (!href) {
    return (
      <span className="text-xs text-muted-foreground">
        {label === "Zoom" ? "No Zoom" : "No transcript"}
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex h-8 items-center gap-1 rounded-md border bg-background px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {label}
      <ExternalLink className="size-3" />
    </a>
  );
}

function filterCalls(calls: RepNoShowCall[], query: string) {
  const terms = normalizeSearch(query).split(" ").filter(Boolean);
  if (!terms.length) return calls;

  return calls.filter((call) => {
    const haystack = normalizeSearch(
      [
        call.repName,
        call.clientName,
        call.callNumber,
        call.meetingTitle,
        call.meetingId,
        call.source,
        call.attendanceStatus,
        formatNoShowReason(call),
        formatMiamiDateTime(call.callDate),
        formatShortDate(call.callDate),
      ].join(" "),
    );

    return terms.every((term) => haystack.includes(term));
  });
}

function formatNoShowReason(call: RepNoShowCall) {
  const rawReason =
    call.attendanceReason || call.attendanceStatus || "Rep absence detected";
  const attendanceReason = rawReason.match(
    /attendance_status\s*=\s*(?:sales_)?rep_no_show\s*:\s*([^|]+)/i,
  );
  const decisionReason = rawReason.match(
    /(?:sales_)?rep_no_show\s*:\s*([^|]+)/i,
  );
  const cleaned = (attendanceReason?.[1] || decisionReason?.[1] || rawReason)
    .replace(/\s+/g, " ")
    .trim();

  return truncateText(cleaned || "Rep absence detected", 190);
}

function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trim()}...`;
}

function formatShortDate(value: string | Date | null | undefined) {
  if (!value) return "tracking start";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "tracking start";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border bg-background/80 p-4 text-sm leading-6 text-muted-foreground">
      {text}
    </div>
  );
}

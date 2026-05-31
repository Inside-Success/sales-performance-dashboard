import { slugify } from "@/lib/slug";

export const REP_NO_SHOW_WINDOWS = [7, 30, 90] as const;
export type RepNoShowWindow = (typeof REP_NO_SHOW_WINDOWS)[number];

const DEFAULT_AIRTABLE_BASE_ID = "appNIvRt5uouRrcZ6";
const DEFAULT_AIRTABLE_TABLE_ID = "tblD1VHKC49agh9QZ";
const DEFAULT_CLOSE_RATE = 0.1;
const DEFAULT_MIN_PACKAGE_VALUE = 10000;
const HISTORY_DAYS = 120;
const WEEK_COUNT = 8;

const AIRTABLE_FIELDS = [
  "Meeting Title",
  "Meeting Start Date",
  "Meeting ID",
  "Meeting Link",
  "Meeting Transcript Link",
  "Rep Name",
  "Client Name",
  "Call #",
  "Processing Status",
  "Ingested At",
  "Source",
  "AI Decision Reason",
  "AI Confidence",
  "Automation Key",
];

type AirtableRecord = {
  id: string;
  createdTime?: string;
  fields: Record<string, unknown>;
};

type AirtableListResponse = {
  records?: AirtableRecord[];
  offset?: string;
  error?: {
    type?: string;
    message?: string;
  };
};

export type RepNoShowCall = {
  id: string;
  repName: string;
  repSlug: string;
  clientName: string;
  callNumber: string;
  callDate: string | null;
  meetingTitle: string;
  meetingId: string;
  meetingLink: string;
  transcriptLink: string;
  attendanceStatus: string;
  attendanceReason: string;
  source: string;
};

export type RepNoShowRepRow = {
  repName: string;
  repSlug: string;
  eligibleCalls: number;
  noShows: number;
  call1NoShows: number;
  noShowRate: number;
  estimatedOpportunityAtRisk: number;
  latestNoShowAt: string | null;
};

export type RepNoShowWeeklyPoint = {
  weekStart: string;
  label: string;
  eligibleCalls: number;
  noShows: number;
  estimatedOpportunityAtRisk: number;
};

export type RepNoShowSummary = {
  configured: boolean;
  generatedAt: string;
  periodDays: RepNoShowWindow;
  closeRate: number;
  minPackageValue: number;
  recordsRead: number;
  eligibleCalls: number;
  previousEligibleCalls: number;
  repNoShows: number;
  previousRepNoShows: number;
  call1NoShows: number;
  call2PlusNoShows: number;
  noShowRate: number;
  previousNoShowRate: number;
  weekOverWeekChange: number;
  estimatedOpportunityAtRisk: number;
  avoidedNoShows: number;
  estimatedRevenueProtected: number;
  error?: string;
};

export type RepNoShowAnalytics = {
  summary: RepNoShowSummary;
  topReps: RepNoShowRepRow[];
  recentNoShows: RepNoShowCall[];
  weekly: RepNoShowWeeklyPoint[];
};

type NormalizedCall = RepNoShowCall & {
  noShow: boolean;
};

export function normalizeRepNoShowWindow(value: string | string[] | undefined): RepNoShowWindow {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsed = Number(rawValue);
  return REP_NO_SHOW_WINDOWS.includes(parsed as RepNoShowWindow)
    ? (parsed as RepNoShowWindow)
    : 7;
}

export async function getRepNoShowAnalytics(
  periodDays: RepNoShowWindow = 7,
): Promise<RepNoShowAnalytics> {
  const generatedAt = new Date();
  const closeRate = parseRate(process.env.REP_NO_SHOW_CLOSE_RATE, DEFAULT_CLOSE_RATE);
  const minPackageValue = parseMoney(
    process.env.REP_NO_SHOW_MIN_PACKAGE_VALUE,
    DEFAULT_MIN_PACKAGE_VALUE,
  );
  const fallback = getFallbackAnalytics(generatedAt, periodDays, closeRate, minPackageValue);
  const token = getAirtableToken();

  if (!token) {
    return {
      ...fallback,
      summary: {
        ...fallback.summary,
        error: "Airtable read access is not configured for rep no-show analytics.",
      },
    };
  }

  try {
    const records = await fetchAirtableRecords(token, HISTORY_DAYS);
    const calls = records.map(normalizeAirtableRecord).filter(isEligibleCall);
    const periodEnd = generatedAt;
    const periodStart = addDays(periodEnd, -periodDays);
    const previousStart = addDays(periodStart, -periodDays);

    const currentCalls = calls.filter((call) => isInWindow(call.callDate, periodStart, periodEnd));
    const previousCalls = calls.filter((call) => isInWindow(call.callDate, previousStart, periodStart));
    const currentNoShows = currentCalls.filter((call) => call.noShow);
    const previousNoShows = previousCalls.filter((call) => call.noShow);
    const topReps = buildRepRows(currentCalls, closeRate, minPackageValue);
    const weekly = buildWeeklyTrend(calls, generatedAt, closeRate, minPackageValue);
    const weekOverWeekChange = currentNoShows.length - previousNoShows.length;
    const avoidedNoShows = Math.max(0, previousNoShows.length - currentNoShows.length);

    return {
      summary: {
        configured: true,
        generatedAt: generatedAt.toISOString(),
        periodDays,
        closeRate,
        minPackageValue,
        recordsRead: records.length,
        eligibleCalls: currentCalls.length,
        previousEligibleCalls: previousCalls.length,
        repNoShows: currentNoShows.length,
        previousRepNoShows: previousNoShows.length,
        call1NoShows: currentNoShows.filter(isCallOne).length,
        call2PlusNoShows: currentNoShows.filter((call) => !isCallOne(call)).length,
        noShowRate: rate(currentNoShows.length, currentCalls.length),
        previousNoShowRate: rate(previousNoShows.length, previousCalls.length),
        weekOverWeekChange,
        estimatedOpportunityAtRisk: estimateValue(currentNoShows.length, closeRate, minPackageValue),
        avoidedNoShows,
        estimatedRevenueProtected: estimateValue(avoidedNoShows, closeRate, minPackageValue),
      },
      topReps,
      recentNoShows: currentNoShows
        .sort(sortCallsDesc)
        .slice(0, 12)
        .map(stripNoShowFlag),
      weekly,
    };
  } catch (error) {
    return {
      ...fallback,
      summary: {
        ...fallback.summary,
        configured: true,
        error:
          error instanceof Error
            ? error.message
            : "Rep no-show analytics could not read Airtable right now.",
      },
    };
  }
}

function getAirtableToken() {
  return (
    process.env.AIRTABLE_API_KEY ||
    process.env.AIRTABLE_ACCESS_TOKEN ||
    process.env.AIRTABLE_TOKEN ||
    ""
  ).trim();
}

async function fetchAirtableRecords(token: string, historyDays: number) {
  const baseId = process.env.AIRTABLE_BASE_ID || DEFAULT_AIRTABLE_BASE_ID;
  const tableId = process.env.AIRTABLE_ZOOM_CALLS_TABLE_ID || DEFAULT_AIRTABLE_TABLE_ID;
  const records: AirtableRecord[] = [];
  let offset = "";

  do {
    const params = new URLSearchParams();
    params.set("pageSize", "100");
    params.set(
      "filterByFormula",
      `AND({Processing Status} = 'Processed', OR(IS_AFTER({Ingested At}, DATEADD(NOW(), -${historyDays}, 'days')), IS_AFTER({Meeting Start Date}, DATEADD(NOW(), -${historyDays}, 'days'))))`,
    );
    params.set("sort[0][field]", "Ingested At");
    params.set("sort[0][direction]", "desc");
    AIRTABLE_FIELDS.forEach((field) => params.append("fields[]", field));
    if (offset) params.set("offset", offset);

    const response = await fetch(`https://api.airtable.com/v0/${baseId}/${tableId}?${params}`, {
      headers: {
        authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    const data = (await response.json()) as AirtableListResponse;
    if (!response.ok) {
      throw new Error(data.error?.message || "Airtable rejected the rep no-show analytics request.");
    }

    records.push(...(data.records || []));
    offset = data.offset || "";
  } while (offset && records.length < 5000);

  return records;
}

function normalizeAirtableRecord(record: AirtableRecord): NormalizedCall {
  const fields = record.fields || {};
  const repName = fieldString(fields, "Rep Name") || "Unknown rep";
  const aiDecisionReason = fieldString(fields, "AI Decision Reason");
  const attendanceStatus = extractAttendanceStatus(aiDecisionReason);

  return {
    id: record.id,
    repName,
    repSlug: slugify(repName),
    clientName: fieldString(fields, "Client Name") || "Client unavailable",
    callNumber: fieldString(fields, "Call #") || "Unknown",
    callDate:
      fieldDate(fields, "Meeting Start Date") ||
      fieldDate(fields, "Ingested At") ||
      record.createdTime ||
      null,
    meetingTitle: fieldString(fields, "Meeting Title"),
    meetingId: fieldString(fields, "Meeting ID"),
    meetingLink: fieldString(fields, "Meeting Link"),
    transcriptLink: fieldString(fields, "Meeting Transcript Link"),
    attendanceStatus,
    attendanceReason: aiDecisionReason,
    source: fieldString(fields, "Source"),
    noShow: isRepNoShow(attendanceStatus, aiDecisionReason),
  };
}

function extractAttendanceStatus(reason: string) {
  const match = reason.match(/attendance_status\s*=\s*([^:|]+)/i);
  return match?.[1]?.trim() || "";
}

function isEligibleCall(call: NormalizedCall) {
  return Boolean(call.callDate && call.repName);
}

function isRepNoShow(status: string, reason: string) {
  const normalizedStatus = normalizeText(status);
  const normalizedReason = normalizeText(reason);
  const text = normalizeText(`${status} ${reason}`);
  if (!text) return false;

  if (/\b(present|attended|joined|normal|ok|clear|none|no issue)\b/.test(normalizedStatus)) {
    return false;
  }

  if (/\b(prospect|client|customer)\b/.test(text) && !/\b(rep|sales|closer|host)\b/.test(text)) {
    return false;
  }

  const explicitStatuses = [
    "rep_no_show",
    "rep no show",
    "rep no-show",
    "sales_no_show",
    "sales no show",
    "sales no-show",
    "closer_no_show",
    "closer no show",
    "host_no_show",
    "host no show",
  ];

  if (explicitStatuses.some((needle) => normalizedStatus.includes(needle.replace(/_/g, " ")))) {
    return true;
  }

  if (/\b(rep|sales|closer|host|salesperson)\b.*\b(absent|missing|did not join|never joined|no audio)\b/.test(normalizedStatus)) {
    return true;
  }

  return [
    "rep absent",
    "rep did not join",
    "rep never joined",
    "rep missing",
    "no rep audio",
    "sales rep absent",
    "salesperson absent",
    "closer absent",
    "host absent",
    "waiting for rep",
    "waiting for the rep",
    "waiting for salesperson",
    "no salesperson joined",
  ].some((needle) => normalizedReason.includes(needle));
}

function buildRepRows(
  calls: NormalizedCall[],
  closeRate: number,
  minPackageValue: number,
): RepNoShowRepRow[] {
  const byRep = new Map<string, { repName: string; repSlug: string; calls: NormalizedCall[] }>();

  for (const call of calls) {
    const current = byRep.get(call.repSlug) || {
      repName: call.repName,
      repSlug: call.repSlug,
      calls: [],
    };
    current.calls.push(call);
    byRep.set(call.repSlug, current);
  }

  return Array.from(byRep.values())
    .map((rep) => {
      const repNoShows = rep.calls.filter((call) => call.noShow);
      return {
        repName: rep.repName,
        repSlug: rep.repSlug,
        eligibleCalls: rep.calls.length,
        noShows: repNoShows.length,
        call1NoShows: repNoShows.filter(isCallOne).length,
        noShowRate: rate(repNoShows.length, rep.calls.length),
        estimatedOpportunityAtRisk: estimateValue(repNoShows.length, closeRate, minPackageValue),
        latestNoShowAt: repNoShows.sort(sortCallsDesc)[0]?.callDate || null,
      };
    })
    .filter((rep) => rep.noShows > 0)
    .sort(
      (a, b) =>
        b.noShows - a.noShows ||
        b.estimatedOpportunityAtRisk - a.estimatedOpportunityAtRisk ||
        a.repName.localeCompare(b.repName),
    )
    .slice(0, 12);
}

function buildWeeklyTrend(
  calls: NormalizedCall[],
  generatedAt: Date,
  closeRate: number,
  minPackageValue: number,
): RepNoShowWeeklyPoint[] {
  const currentWeekStart = startOfWeek(generatedAt);
  return Array.from({ length: WEEK_COUNT }, (_, index) => {
    const weekStart = addDays(currentWeekStart, -7 * (WEEK_COUNT - 1 - index));
    const weekEnd = addDays(weekStart, 7);
    const weekCalls = calls.filter((call) => isInWindow(call.callDate, weekStart, weekEnd));
    const noShows = weekCalls.filter((call) => call.noShow).length;

    return {
      weekStart: weekStart.toISOString(),
      label: formatWeekLabel(weekStart),
      eligibleCalls: weekCalls.length,
      noShows,
      estimatedOpportunityAtRisk: estimateValue(noShows, closeRate, minPackageValue),
    };
  });
}

function getFallbackAnalytics(
  generatedAt: Date,
  periodDays: RepNoShowWindow,
  closeRate: number,
  minPackageValue: number,
): RepNoShowAnalytics {
  return {
    summary: {
      configured: Boolean(getAirtableToken()),
      generatedAt: generatedAt.toISOString(),
      periodDays,
      closeRate,
      minPackageValue,
      recordsRead: 0,
      eligibleCalls: 0,
      previousEligibleCalls: 0,
      repNoShows: 0,
      previousRepNoShows: 0,
      call1NoShows: 0,
      call2PlusNoShows: 0,
      noShowRate: 0,
      previousNoShowRate: 0,
      weekOverWeekChange: 0,
      estimatedOpportunityAtRisk: 0,
      avoidedNoShows: 0,
      estimatedRevenueProtected: 0,
    },
    topReps: [],
    recentNoShows: [],
    weekly: buildWeeklyTrend([], generatedAt, closeRate, minPackageValue),
  };
}

function stripNoShowFlag(call: NormalizedCall): RepNoShowCall {
  return {
    id: call.id,
    repName: call.repName,
    repSlug: call.repSlug,
    clientName: call.clientName,
    callNumber: call.callNumber,
    callDate: call.callDate,
    meetingTitle: call.meetingTitle,
    meetingId: call.meetingId,
    meetingLink: call.meetingLink,
    transcriptLink: call.transcriptLink,
    attendanceStatus: call.attendanceStatus,
    attendanceReason: call.attendanceReason,
    source: call.source,
  };
}

function isCallOne(call: Pick<RepNoShowCall, "callNumber">) {
  return normalizeText(call.callNumber).replace(/\s+/g, " ") === "call 1";
}

function fieldString(fields: Record<string, unknown>, key: string) {
  const value = fields[key];
  if (Array.isArray(value)) return value.map(String).join(", ").trim();
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function fieldDate(fields: Record<string, unknown>, key: string) {
  const value = fields[key];
  return typeof value === "string" ? value : "";
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseRate(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed > 1 ? parsed / 100 : parsed;
}

function parseMoney(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function rate(count: number, total: number) {
  return total > 0 ? count / total : 0;
}

function estimateValue(noShows: number, closeRate: number, minPackageValue: number) {
  return Math.round(noShows * closeRate * minPackageValue);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function isInWindow(value: string | null, start: Date, end: Date) {
  if (!value) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date >= start && date < end;
}

function startOfWeek(date: Date) {
  const weekStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = weekStart.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  weekStart.setUTCDate(weekStart.getUTCDate() + diff);
  return weekStart;
}

function formatWeekLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function sortCallsDesc(a: Pick<RepNoShowCall, "callDate">, b: Pick<RepNoShowCall, "callDate">) {
  return new Date(b.callDate || 0).getTime() - new Date(a.callDate || 0).getTime();
}

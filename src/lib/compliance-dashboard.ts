import { slugify } from "@/lib/slug";

const COMPLIANCE_SHEET_ID = "17yBNMgUT7rX2KjdvRFJHj8OrMTWnXrYSOCb46VtwUoc";
const REP_SUMMARY_SHEET = "Weekly Rep Summary";
const CATEGORY_SUMMARY_SHEET = "Weekly Category Summary";
const RAW_LOG_SHEET = "Raw Compliance Log";
const FETCH_TIMEOUT_MS = 10_000;

export const COMPLIANCE_COUNT_FILTERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export type ComplianceCountFilter = (typeof COMPLIANCE_COUNT_FILTERS)[number];

export type ComplianceSearchParams = {
  week?: string | string[];
  minCount?: string | string[];
  q?: string | string[];
};

type RepSummaryRow = {
  key: string;
  weekKey: string;
  week: string;
  status: string;
  rep: string;
  repSlug: string;
  category: string;
  categoryKey: string;
  count: number;
  severity: string;
  lastSeen: string;
  lastSeenTime: number;
  managerNotes: string;
};

export type ComplianceCategoryRow = {
  key: string;
  weekKey: string;
  week: string;
  status: string;
  category: string;
  categoryKey: string;
  totalCount: number;
  repsInvolved: number;
  severity: string;
  lastSeen: string;
  lastSeenTime: number;
  managerNotes: string;
};

export type ComplianceWeekOption = {
  key: string;
  label: string;
  status: string;
  startTime: number;
};

export type ComplianceRepGroup = {
  rep: string;
  repSlug: string;
  totalCount: number;
  severity: string;
  lastSeen: string;
  lastSeenTime: number;
  categories: Array<{
    name: string;
    count: number;
    severity: string;
  }>;
  managerNotes: string[];
};

export type ComplianceFlagDetail = {
  id: string;
  weekKey: string;
  date: string;
  dateTime: number;
  rep: string;
  repSlug: string;
  client: string;
  category: string;
  categoryKey: string;
  categoryKeys: string[];
  risk: string;
  severity: string;
  quote: string;
  transcriptUrl: string;
  decision: string;
  reportId: number | null;
  reportUrl: string | null;
};

export type ComplianceCategoryDrilldown = {
  category: string;
  categoryKey: string;
  totalCount: number;
  repsInvolved: number;
  reps: Array<{
    rep: string;
    repSlug: string;
    count: number;
    severity: string;
    lastSeen: string;
    lastSeenTime: number;
    detailCount: number;
  }>;
};

export type ComplianceDashboardSummary = {
  totalFlags: number;
  repsInvolved: number;
  categories: number;
  topIssue: {
    category: string;
    totalCount: number;
  } | null;
  topRep: {
    rep: string;
    totalCount: number;
  } | null;
  highestSeverity: string;
  highSeverityRows: number;
  highSeverityFlags: number;
  lastSeen: string;
};

export type ComplianceDashboardData = {
  generatedAt: string;
  sheetUrl: string;
  selectedWeek: ComplianceWeekOption | null;
  weeks: ComplianceWeekOption[];
  filters: {
    minCount: ComplianceCountFilter;
    search: string;
  };
  summary: ComplianceDashboardSummary;
  repGroups: ComplianceRepGroup[];
  categoryRows: ComplianceCategoryRow[];
  flagDetails: ComplianceFlagDetail[];
  categoryDrilldowns: ComplianceCategoryDrilldown[];
  reconciliationWarnings: string[];
  unfilteredRepCount: number;
  unfilteredCategoryCount: number;
  error?: string;
};

export async function getComplianceDashboardData(
  searchParams: ComplianceSearchParams = {},
): Promise<ComplianceDashboardData> {
  const generatedAt = new Date();
  const sheetUrl = `https://docs.google.com/spreadsheets/d/${COMPLIANCE_SHEET_ID}/edit`;
  const filters = readComplianceFilters(searchParams);
  const fallback = getFallbackDashboardData(generatedAt, sheetUrl, filters);

  try {
    const [repRecords, categoryRecords] = await Promise.all([
      fetchSheetRecords(REP_SUMMARY_SHEET, "Week"),
      fetchSheetRecords(CATEGORY_SUMMARY_SHEET, "Week"),
    ]);
    const rawRecords = await fetchOptionalSheetRecords(RAW_LOG_SHEET, "Date");
    const repRows = repRecords.map(normalizeRepSummaryRow).filter(isPresent);
    const categoryRows = categoryRecords.map(normalizeCategorySummaryRow).filter(isPresent);
    const rawRows = rawRecords.map(normalizeRawComplianceRow).filter(isPresent);
    const weeks = buildWeekOptions(repRows, categoryRows);
    const selectedWeek = selectWeek(weeks, readFirst(searchParams.week));

    if (!selectedWeek) {
      return {
        ...fallback,
        error: "The compliance sheet is readable, but no weekly summary rows were found.",
      };
    }

    const selectedRepRows = repRows.filter((row) => row.weekKey === selectedWeek.key);
    const selectedCategoryRows = categoryRows.filter((row) => row.weekKey === selectedWeek.key);
    const categoryLabelByKey = buildCategoryLabelMap(selectedCategoryRows);
    const selectedFlagDetails = rawRows
      .filter((row) => row.weekKey === selectedWeek.key)
      .map((row) => {
        const displayCategoryKey =
          row.categoryKeys.find((key) => categoryLabelByKey.has(key)) || row.categoryKey;

        return {
          ...row,
          category: categoryLabelByKey.get(displayCategoryKey) || row.category,
          categoryKey: displayCategoryKey,
        };
      });
    const detailCountByRepCategory = countDetailsByRepCategory(selectedFlagDetails);
    const repGroups = groupRepRows(selectedRepRows);
    const categoryDrilldowns = buildCategoryDrilldowns(
      selectedRepRows,
      selectedCategoryRows,
      detailCountByRepCategory,
    );
    const summary = buildSummary(selectedRepRows, selectedCategoryRows);
    const reconciliationWarnings = buildReconciliationWarnings(
      repGroups,
      selectedCategoryRows,
      selectedFlagDetails,
    );
    const filteredRepGroups = repGroups
      .filter((row) => row.totalCount >= filters.minCount)
      .filter((row) => matchesSearch(row, filters.search))
      .sort(sortRepGroups);
    const filteredCategoryRows = selectedCategoryRows
      .filter((row) => row.totalCount >= filters.minCount)
      .filter((row) => matchesSearch(row, filters.search))
      .sort(sortCategoryRows);

    return {
      generatedAt: generatedAt.toISOString(),
      sheetUrl,
      selectedWeek,
      weeks,
      filters,
      summary,
      repGroups: filteredRepGroups,
      categoryRows: filteredCategoryRows,
      flagDetails: selectedFlagDetails,
      categoryDrilldowns,
      reconciliationWarnings,
      unfilteredRepCount: repGroups.length,
      unfilteredCategoryCount: selectedCategoryRows.length,
    };
  } catch (error) {
    return {
      ...fallback,
      error:
        error instanceof Error
          ? error.message
          : "The compliance dashboard could not read the Google Sheet right now.",
    };
  }
}

function getFallbackDashboardData(
  generatedAt: Date,
  sheetUrl: string,
  filters: ComplianceDashboardData["filters"],
): ComplianceDashboardData {
  return {
    generatedAt: generatedAt.toISOString(),
    sheetUrl,
    selectedWeek: null,
    weeks: [],
    filters,
    summary: {
      totalFlags: 0,
      repsInvolved: 0,
      categories: 0,
      topIssue: null,
      topRep: null,
      highestSeverity: "None",
      highSeverityRows: 0,
      highSeverityFlags: 0,
      lastSeen: "",
    },
    repGroups: [],
    categoryRows: [],
    flagDetails: [],
    categoryDrilldowns: [],
    reconciliationWarnings: [],
    unfilteredRepCount: 0,
    unfilteredCategoryCount: 0,
  };
}

function readComplianceFilters(searchParams: ComplianceSearchParams) {
  const parsedMinCount = Number(readFirst(searchParams.minCount));
  const minCount = COMPLIANCE_COUNT_FILTERS.includes(parsedMinCount as ComplianceCountFilter)
    ? (parsedMinCount as ComplianceCountFilter)
    : 1;

  return {
    minCount,
    search: readFirst(searchParams.q).trim(),
  };
}

async function fetchSheetRecords(sheetName: string, requiredHeader: string) {
  const params = new URLSearchParams({
    tqx: "out:csv",
    sheet: sheetName,
    headers: "1",
  });
  const url = `https://docs.google.com/spreadsheets/d/${COMPLIANCE_SHEET_ID}/gviz/tq?${params}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Google Sheets returned ${response.status} for ${sheetName}.`);
    }

    const csv = await response.text();
    return recordsFromCsv(csv, sheetName, requiredHeader);
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchOptionalSheetRecords(sheetName: string, requiredHeader: string) {
  try {
    return await fetchSheetRecords(sheetName, requiredHeader);
  } catch (error) {
    console.warn(
      `Optional compliance sheet read failed for ${sheetName}: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
    return [];
  }
}

function recordsFromCsv(csv: string, sheetName: string, requiredHeader: string) {
  const rows = parseCsv(csv).filter((row) => row.some((cell) => cell.trim()));
  const [rawHeaders, ...body] = rows;
  const headers = rawHeaders?.map((header) => header.trim()) || [];

  if (!headers.includes(requiredHeader)) {
    throw new Error(`${sheetName} does not have the expected ${requiredHeader} header row.`);
  }

  return body.map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = row[index]?.trim() || "";
    });
    return record;
  });
}

function parseCsv(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  rows.push(row);
  return rows;
}

function normalizeRepSummaryRow(record: Record<string, string>): RepSummaryRow | null {
  const key = record.Key || "";
  const weekKey = getWeekKey(key, record.Week);
  const rep = record.Rep || "";
  const category = record["Compliance Category"] || "";

  if (!weekKey || !rep || !category) return null;

  const lastSeen = record["Last Seen"] || "";

  return {
    key,
    weekKey,
    week: record.Week || weekKey,
    status: record.Status || "",
    rep,
    repSlug: slugify(rep),
    category,
    categoryKey: categoryKey(category),
    count: parseCount(record.Count),
    severity: record["Highest Severity"] || "Review",
    lastSeen,
    lastSeenTime: parseSheetDate(lastSeen),
    managerNotes: record["Manager Notes"] || "",
  };
}

function normalizeCategorySummaryRow(
  record: Record<string, string>,
): ComplianceCategoryRow | null {
  const key = record.Key || "";
  const weekKey = getWeekKey(key, record.Week);
  const category = record["Compliance Category"] || "";

  if (!weekKey || !category) return null;

  const lastSeen = record["Last Seen"] || "";

  return {
    key,
    weekKey,
    week: record.Week || weekKey,
    status: record.Status || "",
    category,
    categoryKey: categoryKey(category),
    totalCount: parseCount(record["Total Count"]),
    repsInvolved: parseCount(record["Reps Involved"]),
    severity: record["Highest Severity"] || "Review",
    lastSeen,
    lastSeenTime: parseSheetDate(lastSeen),
    managerNotes: record["Manager Notes"] || "",
  };
}

function normalizeRawComplianceRow(record: Record<string, string>): ComplianceFlagDetail | null {
  const date = record.Date || "";
  const rep = record.Rep || "";
  const client = record.Client || "";
  const rawCategory = record.Category || record["Compliance Category"] || "";
  const quote = record.Quote || "";
  const dateTime = parseSheetDate(date);

  if (!dateTime || !rep || !rawCategory) return null;

  const keys = categoryKeysFromRawCategory(rawCategory);
  const key = keys[0] || categoryKey(rawCategory);

  return {
    id: [
      date,
      slugify(rep),
      normalizeText(client),
      key,
      normalizeText(quote).slice(0, 80),
    ].join("|"),
    weekKey: weekKeyFromTimestamp(dateTime),
    date,
    dateTime,
    rep,
    repSlug: slugify(rep),
    client: client || "Unknown client",
    category: humanizeCategory(rawCategory),
    categoryKey: key,
    categoryKeys: keys,
    risk: record.Risk || "",
    severity: severityFromRisk(record.Risk || ""),
    quote,
    transcriptUrl: record.Transcript || "",
    decision: record.Decision || "",
    reportId: null,
    reportUrl: null,
  };
}

function buildWeekOptions(
  repRows: RepSummaryRow[],
  categoryRows: ComplianceCategoryRow[],
): ComplianceWeekOption[] {
  const weeks = new Map<string, ComplianceWeekOption>();

  for (const row of [...repRows, ...categoryRows]) {
    const existing = weeks.get(row.weekKey);
    const startTime = parseIsoDay(row.weekKey);
    const option = {
      key: row.weekKey,
      label: row.week,
      status: row.status,
      startTime,
    };

    if (!existing) {
      weeks.set(row.weekKey, option);
      continue;
    }

    weeks.set(row.weekKey, {
      ...existing,
      label: existing.label || option.label,
      status: existing.status === "Final" ? existing.status : option.status || existing.status,
      startTime: Math.max(existing.startTime, option.startTime),
    });
  }

  return [...weeks.values()].sort((a, b) => b.startTime - a.startTime);
}

function selectWeek(weeks: ComplianceWeekOption[], requestedWeek: string) {
  if (!weeks.length) return null;
  return weeks.find((week) => week.key === requestedWeek) || weeks[0];
}

function groupRepRows(rows: RepSummaryRow[]): ComplianceRepGroup[] {
  const groups = new Map<string, ComplianceRepGroup>();

  for (const row of rows) {
    const group = groups.get(row.repSlug) || {
      rep: row.rep,
      repSlug: row.repSlug,
      totalCount: 0,
      severity: "None",
      lastSeen: "",
      lastSeenTime: 0,
      categories: [],
      managerNotes: [],
    };

    group.totalCount += row.count;
    group.severity = maxSeverity(group.severity, row.severity);
    if (row.lastSeenTime > group.lastSeenTime) {
      group.lastSeen = row.lastSeen;
      group.lastSeenTime = row.lastSeenTime;
    }
    group.categories.push({
      name: row.category,
      count: row.count,
      severity: row.severity,
    });
    if (row.managerNotes && !group.managerNotes.includes(row.managerNotes)) {
      group.managerNotes.push(row.managerNotes);
    }

    groups.set(row.repSlug, group);
  }

  return [...groups.values()].map((group) => ({
    ...group,
    categories: group.categories.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
  }));
}

function buildCategoryLabelMap(rows: ComplianceCategoryRow[]) {
  const labels = new Map<string, string>();
  for (const row of rows) labels.set(row.categoryKey, row.category);
  return labels;
}

function countDetailsByRepCategory(details: ComplianceFlagDetail[]) {
  const counts = new Map<string, number>();
  for (const detail of details) {
    for (const category of detail.categoryKeys.length ? detail.categoryKeys : [detail.categoryKey]) {
      const key = `${detail.repSlug}|${category}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return counts;
}

function buildCategoryDrilldowns(
  repRows: RepSummaryRow[],
  categoryRows: ComplianceCategoryRow[],
  detailCountByRepCategory: Map<string, number>,
): ComplianceCategoryDrilldown[] {
  const rowsByCategory = new Map<string, RepSummaryRow[]>();

  for (const row of repRows) {
    const rows = rowsByCategory.get(row.categoryKey) || [];
    rows.push(row);
    rowsByCategory.set(row.categoryKey, rows);
  }

  return categoryRows.map((category) => {
    const rows = rowsByCategory.get(category.categoryKey) || [];
    const reps = rows
      .map((row) => ({
        rep: row.rep,
        repSlug: row.repSlug,
        count: row.count,
        severity: row.severity,
        lastSeen: row.lastSeen,
        lastSeenTime: row.lastSeenTime,
        detailCount: detailCountByRepCategory.get(`${row.repSlug}|${row.categoryKey}`) || 0,
      }))
      .sort(
        (a, b) =>
          b.count - a.count ||
          severityRank(b.severity) - severityRank(a.severity) ||
          b.lastSeenTime - a.lastSeenTime ||
          a.rep.localeCompare(b.rep),
      );

    return {
      category: category.category,
      categoryKey: category.categoryKey,
      totalCount: category.totalCount,
      repsInvolved: category.repsInvolved,
      reps,
    };
  });
}

function buildSummary(
  repRows: RepSummaryRow[],
  categoryRows: ComplianceCategoryRow[],
): ComplianceDashboardSummary {
  const totalFlags = repRows.reduce((total, row) => total + row.count, 0);
  const repCounts = new Map<string, number>();
  for (const row of repRows) {
    repCounts.set(row.rep, (repCounts.get(row.rep) || 0) + row.count);
  }
  const topRep = [...repCounts.entries()].reduce<ComplianceDashboardSummary["topRep"]>(
    (top, [rep, totalCount]) =>
      !top || totalCount > top.totalCount ? { rep, totalCount } : top,
    null,
  );
  const repsInvolved = repCounts.size;
  const categories = categoryRows.length || new Set(repRows.map((row) => row.category)).size;
  const topIssue = getTopIssue(categoryRows, repRows);
  const highestSeverity = [...repRows, ...categoryRows].reduce(
    (severity, row) => maxSeverity(severity, row.severity),
    "None",
  );
  const highSeverityRows = repRows.filter((row) => severityRank(row.severity) >= severityRank("High")).length;
  const highSeverityFlags = repRows
    .filter((row) => severityRank(row.severity) >= severityRank("High"))
    .reduce((total, row) => total + row.count, 0);
  const latestRow = repRows.reduce<RepSummaryRow | null>(
    (latest, row) => (!latest || row.lastSeenTime > latest.lastSeenTime ? row : latest),
    null,
  );

  return {
    totalFlags,
    repsInvolved,
    categories,
    topIssue,
    topRep,
    highestSeverity,
    highSeverityRows,
    highSeverityFlags,
    lastSeen: latestRow?.lastSeen || "",
  };
}

function getTopIssue(
  categoryRows: ComplianceCategoryRow[],
  repRows: RepSummaryRow[],
): ComplianceDashboardSummary["topIssue"] {
  const topCategoryRow = categoryRows.reduce<ComplianceCategoryRow | null>(
    (top, row) => (!top || row.totalCount > top.totalCount ? row : top),
    null,
  );

  if (topCategoryRow) {
    return {
      category: topCategoryRow.category,
      totalCount: topCategoryRow.totalCount,
    };
  }

  const categoryCounts = new Map<string, number>();
  for (const row of repRows) {
    categoryCounts.set(row.category, (categoryCounts.get(row.category) || 0) + row.count);
  }

  return [...categoryCounts.entries()].reduce<ComplianceDashboardSummary["topIssue"]>(
    (top, [category, totalCount]) =>
      !top || totalCount > top.totalCount ? { category, totalCount } : top,
    null,
  );
}

function matchesSearch(
  row: ComplianceRepGroup | ComplianceCategoryRow,
  search: string,
) {
  if (!search) return true;
  const needle = search.toLowerCase();

  if ("rep" in row) {
    return [
      row.rep,
      row.severity,
      row.lastSeen,
      ...row.categories.map((category) => category.name),
      ...row.managerNotes,
    ]
      .join(" ")
      .toLowerCase()
      .includes(needle);
  }

  return [
    row.category,
    row.severity,
    row.lastSeen,
    row.managerNotes,
    row.status,
  ]
    .join(" ")
    .toLowerCase()
    .includes(needle);
}

function sortRepGroups(a: ComplianceRepGroup, b: ComplianceRepGroup) {
  return (
    b.totalCount - a.totalCount ||
    severityRank(b.severity) - severityRank(a.severity) ||
    b.lastSeenTime - a.lastSeenTime ||
    a.rep.localeCompare(b.rep)
  );
}

function sortCategoryRows(a: ComplianceCategoryRow, b: ComplianceCategoryRow) {
  return (
    b.totalCount - a.totalCount ||
    severityRank(b.severity) - severityRank(a.severity) ||
    b.lastSeenTime - a.lastSeenTime ||
    a.category.localeCompare(b.category)
  );
}

function getWeekKey(key: string, week: string) {
  const keyDate = key.split("|")[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(keyDate)) return keyDate;
  return week.trim();
}

function weekKeyFromTimestamp(timestamp: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));
  const year = Number(parts.find((part) => part.type === "year")?.value || 0);
  const month = Number(parts.find((part) => part.type === "month")?.value || 0);
  const day = Number(parts.find((part) => part.type === "day")?.value || 0);
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = date.getUTCDay();
  const mondayOffset = (dayOfWeek + 6) % 7;
  date.setUTCDate(date.getUTCDate() - mondayOffset);
  return date.toISOString().slice(0, 10);
}

function parseCount(value: string) {
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseIsoDay(value: string) {
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseSheetDate(value: string) {
  if (!value) return 0;
  const normalized = value
    .replace(/\sEDT$/, " GMT-0400")
    .replace(/\sEST$/, " GMT-0500")
    .replace(/\sPDT$/, " GMT-0700")
    .replace(/\sPST$/, " GMT-0800");
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function severityFromRisk(value: string) {
  const match = value.match(/\(([^)]+)\)/);
  if (match?.[1]) return match[1];
  const score = Number(value.match(/\d+/)?.[0] || 0);
  if (score >= 70) return "High";
  if (score >= 40) return "Medium";
  if (score > 0) return "Low";
  return "Review";
}

function maxSeverity(current: string, next: string) {
  return severityRank(next) > severityRank(current) ? next || current : current || next;
}

function categoryKey(value: string) {
  const normalized = normalizeText(value);
  const alias = CATEGORY_ALIASES.get(normalized);
  if (alias) return alias;
  return normalized
    .replace(/\band\b/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function categoryKeysFromRawCategory(value: string) {
  const normalized = normalizeText(value);
  const keys = new Set<string>();
  const add = (key: string) => {
    if (key) keys.add(key);
  };
  const hasAny = (...needles: string[]) => needles.some((needle) => normalized.includes(needle));

  if (
    hasAny(
      "roi",
      "business outcome",
      "business growth",
      "growth implication",
      "customer acquisition",
      "revenue implication",
    )
  ) {
    add("roi-business-outcome");
  }

  if (hasAny("third party platform", "platform placement", "platform language", "streaming", "prime", "apple")) {
    add("third-party-platform-placement");
  }

  if (hasAny("show longevity", "platform window", "hosting duration", "forward looking show")) {
    add("show-longevity-platform-window");
  }

  if (hasAny("recording consent", "missing consent", "confidentiality recording")) {
    add("missing-recording-consent");
  }

  if (hasAny("deliverable", "package claim", "package language")) {
    add("deliverable-package-claim");
  }

  if (
    hasAny(
      "refund",
      "payment contract",
      "contract terms",
      "payment terms",
      "deposit terms",
      "payment plan",
      "pre payment contract",
      "refund terms",
      "refund policy",
    )
  ) {
    add("refund-payment-contract-terms");
  }

  if (hasAny("view count", "performance claim", "performance guarantee", "view count guarantee")) {
    add("view-count-performance-claim");
  }

  if (hasAny("celebrity", "endorsement", "network association", "cast claim", "talent claim")) {
    add("celebrity-endorsement-claim");
  }

  if (hasAny("ftc", "legal deadline", "regulatory", "legal pressure", "mandate language")) {
    add("ftc-legal-pressure-language");
  }

  if (hasAny("loan", "credit", "financing", "financially vulnerable", "payment source concern")) {
    add("loan-credit-financing-encouragement");
  }

  if (hasAny("sensitive financial", "pii", "pci", "financial data", "data security")) {
    add("sensitive-financial-pii-on-recorded-call");
  }

  if (hasAny("secrecy", "side terms", "side term")) {
    add("secrecy-or-side-terms");
  }

  add(categoryKey(value));
  return [...keys];
}

function humanizeCategory(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "Uncategorized";
  if (!trimmed.includes("_") && !/^[a-z0-9-]+$/.test(trimmed)) return trimmed;
  return trimmed
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace(/\bRoi\b/g, "ROI")
    .replace(/\bFtc\b/g, "FTC")
    .replace(/\bPii\b/g, "PII");
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const CATEGORY_ALIASES = new Map<string, string>([
  ["roi results implications", "roi-business-outcome"],
  ["roi business outcome", "roi-business-outcome"],
  ["business outcome", "roi-business-outcome"],
  ["customer acquisition outcome implications", "roi-business-outcome"],
  ["platform streaming claims", "third-party-platform-placement"],
  ["third party platform placement", "third-party-platform-placement"],
  ["third party platform", "third-party-platform-placement"],
  ["missing recording consent", "missing-recording-consent"],
  ["recording consent", "missing-recording-consent"],
  ["confidentiality recording consent", "missing-recording-consent"],
  ["hosting duration", "show-longevity-platform-window"],
  ["show longevity platform window", "show-longevity-platform-window"],
  ["ftc legal pressure language", "ftc-legal-pressure-language"],
  ["ftc legal deadline pressure", "ftc-legal-pressure-language"],
  ["celebrity endorsement claim", "celebrity-endorsement-claim"],
  ["celebrity roster claims", "celebrity-endorsement-claim"],
  ["sensitive financial pii on recorded call", "sensitive-financial-pii-on-recorded-call"],
  ["pii on recording", "sensitive-financial-pii-on-recorded-call"],
  ["refund cancellation promise", "refund-cancellation-promise"],
  ["refund or cancellation promises", "refund-cancellation-promise"],
  ["refund payment contract", "refund-payment-contract-terms"],
  ["refund payment contract terms", "refund-payment-contract-terms"],
  ["unauthorized refund payment promise", "refund-payment-contract-terms"],
  ["view count performance claim", "view-count-performance-claim"],
  ["celebrity endorsement claim", "celebrity-endorsement-claim"],
  ["celebrity network association", "celebrity-endorsement-claim"],
  ["deliverable package claim", "deliverable-package-claim"],
  ["loan credit financing encouragement", "loan-credit-financing-encouragement"],
  ["secrecy or side terms", "secrecy-or-side-terms"],
]);

function buildReconciliationWarnings(
  repGroups: ComplianceRepGroup[],
  categoryRows: ComplianceCategoryRow[],
  details: ComplianceFlagDetail[],
) {
  const warnings: string[] = [];
  const rawByRep = new Map<string, number>();
  const rawByCategory = new Map<string, number>();

  for (const detail of details) {
    rawByRep.set(detail.repSlug, (rawByRep.get(detail.repSlug) || 0) + 1);
    for (const category of detail.categoryKeys.length ? detail.categoryKeys : [detail.categoryKey]) {
      rawByCategory.set(category, (rawByCategory.get(category) || 0) + 1);
    }
  }

  for (const rep of repGroups) {
    const rawCount = rawByRep.get(rep.repSlug) || 0;
    if (rawCount && rawCount !== rep.totalCount) {
      warnings.push(`${rep.rep}: summary shows ${rep.totalCount}, raw log shows ${rawCount}.`);
    }
  }

  for (const category of categoryRows) {
    const rawCount = rawByCategory.get(category.categoryKey) || 0;
    if (rawCount && rawCount !== category.totalCount) {
      warnings.push(`${category.category}: summary shows ${category.totalCount}, raw log shows ${rawCount}.`);
    }
  }

  return warnings.slice(0, 4);
}

function severityRank(value: string) {
  switch (value.trim().toLowerCase()) {
    case "high":
      return 4;
    case "medium":
      return 3;
    case "review":
      return 2;
    case "low":
      return 1;
    default:
      return 0;
  }
}

function readFirst(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value != null;
}

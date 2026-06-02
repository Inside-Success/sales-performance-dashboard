const COMPLIANCE_SHEET_ID = "17yBNMgUT7rX2KjdvRFJHj8OrMTWnXrYSOCb46VtwUoc";
const REP_SUMMARY_SHEET = "Weekly Rep Summary";
const CATEGORY_SUMMARY_SHEET = "Weekly Category Summary";
const FETCH_TIMEOUT_MS = 10_000;

export const COMPLIANCE_COUNT_FILTERS = [1, 2, 3, 5] as const;
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
  category: string;
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

export type ComplianceDashboardSummary = {
  totalFlags: number;
  repsInvolved: number;
  categories: number;
  highestSeverity: string;
  highSeverityRows: number;
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
      fetchSheetRecords(REP_SUMMARY_SHEET),
      fetchSheetRecords(CATEGORY_SUMMARY_SHEET),
    ]);
    const repRows = repRecords.map(normalizeRepSummaryRow).filter(isPresent);
    const categoryRows = categoryRecords.map(normalizeCategorySummaryRow).filter(isPresent);
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
    const repGroups = groupRepRows(selectedRepRows);
    const summary = buildSummary(selectedRepRows, selectedCategoryRows);
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
      highestSeverity: "None",
      highSeverityRows: 0,
      lastSeen: "",
    },
    repGroups: [],
    categoryRows: [],
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

async function fetchSheetRecords(sheetName: string) {
  const params = new URLSearchParams({
    tqx: "out:csv",
    sheet: sheetName,
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
    return recordsFromCsv(csv, sheetName);
  } finally {
    clearTimeout(timeout);
  }
}

function recordsFromCsv(csv: string, sheetName: string) {
  const rows = parseCsv(csv).filter((row) => row.some((cell) => cell.trim()));
  const [headers, ...body] = rows;

  if (!headers?.includes("Week")) {
    throw new Error(`${sheetName} does not have the expected weekly summary header row.`);
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
    category,
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
    totalCount: parseCount(record["Total Count"]),
    repsInvolved: parseCount(record["Reps Involved"]),
    severity: record["Highest Severity"] || "Review",
    lastSeen,
    lastSeenTime: parseSheetDate(lastSeen),
    managerNotes: record["Manager Notes"] || "",
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
    const group = groups.get(row.rep) || {
      rep: row.rep,
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

    groups.set(row.rep, group);
  }

  return [...groups.values()].map((group) => ({
    ...group,
    categories: group.categories.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
  }));
}

function buildSummary(
  repRows: RepSummaryRow[],
  categoryRows: ComplianceCategoryRow[],
): ComplianceDashboardSummary {
  const totalFlags = repRows.reduce((total, row) => total + row.count, 0);
  const repsInvolved = new Set(repRows.map((row) => row.rep)).size;
  const categories = categoryRows.length || new Set(repRows.map((row) => row.category)).size;
  const highestSeverity = [...repRows, ...categoryRows].reduce(
    (severity, row) => maxSeverity(severity, row.severity),
    "None",
  );
  const highSeverityRows = repRows.filter((row) => severityRank(row.severity) >= severityRank("High")).length;
  const latestRow = repRows.reduce<RepSummaryRow | null>(
    (latest, row) => (!latest || row.lastSeenTime > latest.lastSeenTime ? row : latest),
    null,
  );

  return {
    totalFlags,
    repsInvolved,
    categories,
    highestSeverity,
    highSeverityRows,
    lastSeen: latestRow?.lastSeen || "",
  };
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

function maxSeverity(current: string, next: string) {
  return severityRank(next) > severityRank(current) ? next || current : current || next;
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

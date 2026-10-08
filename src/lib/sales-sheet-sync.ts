import { z } from "zod";

export const SALES_SYNC_SHEET_ID = "1lBdE_LUKI8rzTvYc5vztSwKROJ7uIAOb5mNT9s4PeLA";
export const SALES_SYNC_SOURCE_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SALES_SYNC_SHEET_ID}/values:batchGet`;
export const SALES_SYNC_MAX_AGE_MS = 2 * 60 * 60 * 1000;
const COLUMNS = ["A", "C", "D", "H", "I", "J", "K"];
const payloadSchema = z.object({
  spreadsheetId: z.literal(SALES_SYNC_SHEET_ID),
  valueRanges: z.array(z.object({
    range: z.string(),
    majorDimension: z.literal("ROWS"),
    values: z.array(z.array(z.string().max(1000)).max(1)).max(50000),
  })).length(COLUMNS.length),
});

/** Only the seven analytics columns; no customer emails or source writes. */
export function salesSyncToCsv(payload: unknown) {
  const body = payloadSchema.parse(payload);
  const columns = COLUMNS.map((column) => {
    const matches = body.valueRanges.filter((range) =>
      new RegExp(`^'?Main'?!${column}1:${column}[1-9][0-9]*$`).test(range.range),
    );
    if (matches.length !== 1) throw new Error(`Missing or duplicate Main column ${column}.`);
    return matches[0].values;
  });
  const rowCount = Math.max(...columns.map((column) => column.length));
  return Array.from({ length: rowCount }, (_, row) =>
    columns.map((column) => `"${(column[row]?.[0] || "").replace(/"/g, '""')}"`).join(","),
  ).join("\n");
}

export function syncedSalesStatus(createdAt: string, now = Date.now()) {
  const timestamp = new Date(createdAt).getTime();
  return Number.isFinite(timestamp) && timestamp <= now + 60000 && now - timestamp <= SALES_SYNC_MAX_AGE_MS
    ? "synced_sheet" as const
    : "cached_snapshot" as const;
}

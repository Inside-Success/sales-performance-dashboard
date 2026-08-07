export type LiveSalesReadStats = {
  rowCount: number;
  paidRowCount: number;
  latestSalesDate: Date | null;
};

/**
 * The live Sheet is authoritative whenever it is structurally usable.
 * Historical snapshot size is intentionally not part of this decision:
 * legitimate edits, filters, and cleanup must not pin the dashboard to stale data.
 */
export function getLiveSalesReadErrors(stats: LiveSalesReadStats) {
  const errors: string[] = [];

  if (stats.rowCount === 0) {
    errors.push("The live read returned zero valid sales rows.");
  }

  if (stats.rowCount > 0 && stats.paidRowCount === 0) {
    errors.push("The live read returned zero paid sales rows.");
  }

  if (stats.rowCount > 0 && !stats.latestSalesDate) {
    errors.push("The live read did not include any parseable sales dates.");
  }

  return errors;
}

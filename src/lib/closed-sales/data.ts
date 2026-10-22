import "server-only";
import { neon } from "@neondatabase/serverless";
import { requireRepScoringAdmin } from "@/lib/rep-scoring/access";
import { libraryFilters, snapshotSchema } from "./schema";

// A small, immutable research snapshot. No calls to source systems or AI providers.
export async function getClosedSales(
  input: Record<string, string | string[] | undefined>,
) {
  await requireRepScoringAdmin();
  if (!process.env.DATABASE_URL)
    throw new Error("Library storage is unavailable");
  const sql = neon(process.env.DATABASE_URL);
  const rows =
    await sql`select payload from closed_sales_library_snapshots where id='six-month-2026-10-22'`;
  if (!rows.length) return null;
  const snapshot = snapshotSchema.parse(rows[0].payload);
  const filters = libraryFilters(input);
  const reps = [...new Set(snapshot.sales.map((s) => s.rep))].sort((a, b) =>
    a.localeCompare(b),
  );
  const matching = snapshot.sales.filter(
    (s) =>
      (!filters.category || s.category === filters.category) &&
      (!filters.rep || s.rep === filters.rep) &&
      (!filters.reports || s.reports.length > 0) &&
      (!filters.q ||
        `${s.client} ${s.rep} ${s.show}`
          .toLocaleLowerCase()
          .includes(filters.q.toLocaleLowerCase())),
  );
  const pages = Math.max(1, Math.ceil(matching.length / 25));
  const page = Math.min(filters.page, pages);
  return {
    filters: { ...filters, page },
    reps,
    pages,
    total: matching.length,
    entries: snapshot.sales.length,
    capturedAt: snapshot.capturedAt,
    from: snapshot.from,
    through: snapshot.through,
    rows: matching.slice((page - 1) * 25, page * 25),
  };
}

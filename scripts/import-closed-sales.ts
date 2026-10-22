/** Explicit, offline import only. Never called by the app or coaching workflows.
 * npx vite-node scripts/import-closed-sales.ts <private-input-dir> [--publish]
 * DATABASE_URL is supplied through the environment, never through arguments.
 */
import fs from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { buildSnapshot } from "../src/lib/closed-sales/collect";
const dir = process.argv[2];
if (!dir) throw new Error("Private input directory is required");
const entries = JSON.parse(
  fs.readFileSync(path.join(dir, "slack-entries.json"), "utf8"),
);
const reports = JSON.parse(
  fs.readFileSync(path.join(dir, "reports.json"), "utf8"),
);
const threads = JSON.parse(
  fs.readFileSync(path.join(dir, "threads.json"), "utf8"),
);
const snapshot = buildSnapshot(
  entries,
  reports,
  new Date().toISOString(),
  threads.length,
  threads,
);
fs.writeFileSync(path.join(dir, "snapshot.json"), JSON.stringify(snapshot), {
  mode: 0o600,
});
if (process.argv.includes("--publish")) {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
  const sql = neon(process.env.DATABASE_URL);
  await sql`create table if not exists closed_sales_library_snapshots (id text primary key, payload jsonb not null, updated_at timestamptz not null default now())`;
  await sql`insert into closed_sales_library_snapshots (id,payload) values ('six-month-2026-10-22',${JSON.stringify(snapshot)}::jsonb) on conflict(id) do update set payload=excluded.payload, updated_at=now()`;
  const check =
    await sql`select jsonb_array_length(payload->'sales') as count from closed_sales_library_snapshots where id='six-month-2026-10-22'`;
  if (Number(check[0]?.count) !== snapshot.sales.length)
    throw new Error("Stored library count mismatch");
}
console.log(
  JSON.stringify({
    published: process.argv.includes("--publish"),
    sourceEntries: snapshot.sourceEntries,
    sales: snapshot.sales.length,
    withRecordings: snapshot.sales.filter((s) => s.recordings.length).length,
    withReports: snapshot.sales.filter((s) => s.reports.length).length,
    reviewedThreads: snapshot.reviewedThreads,
  }),
);

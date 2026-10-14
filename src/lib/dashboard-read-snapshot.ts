import { formatMiamiDateTime } from "@/lib/format";
import "server-only";
import { neon } from "@neondatabase/serverless";
import { randomUUID } from "node:crypto";

export type SnapshotSpec<T> = { key: string; maxAgeSeconds: number; load: () => Promise<T> };
export type ReadSnapshot<T> = { data: T; fetchedAt: string; stale: boolean; refreshFailed: boolean };
let schema: Promise<void> | undefined;
function db() { return neon(process.env.DATABASE_URL!); }
async function ensureSnapshotTable() {
  if (!schema) schema = db().query(`create table if not exists dashboard_read_snapshots (
    key text primary key, payload jsonb, fetched_at timestamptz,
    lease_token text, lease_until timestamptz, failed_at timestamptz
  )`).then(() => undefined).catch(error => { schema = undefined; throw error; });
  await schema;
}
type Row = { payload: unknown; fetched_at: string | null; failed_at: string | null };
function result<T>(row: Row, spec: SnapshotSpec<T>): ReadSnapshot<T> {
  return { data: row.payload as T, fetchedAt: row.fetched_at!,
    stale: Date.now() - Date.parse(row.fetched_at!) > spec.maxAgeSeconds * 1000,
    refreshFailed: !!row.failed_at && Date.parse(row.failed_at) >= Date.parse(row.fetched_at!) };
}
async function readRow(key: string) {
  const rows = await db().query(`select payload, fetched_at::text, failed_at::text from dashboard_read_snapshots where key=$1`, [key]);
  return rows[0] as Row | undefined;
}
export async function getReadSnapshot<T>(spec: SnapshotSpec<T>): Promise<ReadSnapshot<T>> {
  if (!process.env.DATABASE_URL || process.env.MAGIC_MIKE_READ_SNAPSHOTS_ENABLED === "false")
    return { data: await spec.load(), fetchedAt: new Date().toISOString(), stale: false, refreshFailed: false };
  await ensureSnapshotTable();
  const row = await readRow(spec.key);
  // Stale successful data stays immediately available. Scheduled refresh owns source I/O.
  if (row?.payload != null && row.fetched_at) return result(row, spec);
  await refreshReadSnapshot(spec);
  const first = await readRow(spec.key);
  if (first?.payload != null && first.fetched_at) return result(first, spec);
  throw new Error("Data is being refreshed. Please try again shortly.");
}
export async function refreshReadSnapshot<T>(spec: SnapshotSpec<T>): Promise<string> {
  if (!process.env.DATABASE_URL) throw new Error("Snapshot storage is unavailable.");
  await ensureSnapshotTable();
  const token = randomUUID();
  const claim = await db().query(`insert into dashboard_read_snapshots(key,lease_token,lease_until)
    values($1,$2,now()+interval '330 seconds') on conflict(key) do update
    set lease_token=$2,lease_until=now()+interval '330 seconds'
    where (dashboard_read_snapshots.lease_until is null or dashboard_read_snapshots.lease_until<now())
      and (dashboard_read_snapshots.fetched_at is null or dashboard_read_snapshots.fetched_at<now()-make_interval(secs=>$3))
    returning key`, [spec.key, token, spec.maxAgeSeconds]);
  if (!claim.length) return "fresh_or_refreshing";
  try {
    const data = await spec.load();
    // Publish one complete read atomically; a lost lease cannot overwrite a newer snapshot.
    const saved = await db().query(`update dashboard_read_snapshots set payload=$3::jsonb,fetched_at=now(),
      failed_at=null,lease_token=null,lease_until=null where key=$1 and lease_token=$2 returning key`,
      [spec.key, token, JSON.stringify(data)]);
    return saved.length ? "refreshed" : "lease_lost";
  } catch (error) {
    await db().query(`update dashboard_read_snapshots set failed_at=now(),lease_token=null,lease_until=now()+interval '60 seconds'
      where key=$1 and lease_token=$2`, [spec.key, token]);
    console.error("dashboard_source_refresh_failed", { source: spec.key.split(":")[0], kind: error instanceof Error ? error.name : "unknown" });
    throw error;
  }
}
export function snapshotWarning(read: Pick<ReadSnapshot<unknown>, "stale" | "refreshFailed" | "fetchedAt">) {
  return read.stale || read.refreshFailed
    ? `Refresh is delayed. Showing the last successful source read from ${formatMiamiDateTime(read.fetchedAt)}.` : undefined;
}

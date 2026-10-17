import { gzipSync, gunzipSync } from "node:zlib";
import { unstable_cache } from "next/cache";
import { after } from "next/server";
import { formatMiamiDateTime } from "@/lib/format";
import "server-only";
import { neon } from "@neondatabase/serverless";
import { randomUUID } from "node:crypto";

export type SnapshotSpec<T> = {
  key: string;
  maxAgeSeconds: number;
  initializeOnRead?: boolean;
  initializeWaitMs?: number;
  refreshOnRead?: boolean;
  load: () => Promise<T>;
};
export type ReadSnapshot<T> = {
  data: T;
  fetchedAt: string;
  stale: boolean;
  refreshFailed: boolean;
};
let schema: Promise<void> | undefined;
function db() {
  return neon(process.env.DATABASE_URL!);
}
async function ensureSnapshotTable() {
  if (!schema)
    schema = db()
      .query(
        `create table if not exists dashboard_read_snapshots (
    key text primary key, payload jsonb, fetched_at timestamptz,
    lease_token text, lease_until timestamptz, failed_at timestamptz, last_requested_at timestamptz
  )`,
      )
      .then(() => undefined)
      .catch((error) => {
        schema = undefined;
        throw error;
      });
  await schema;
  await ensureActivityColumn();
}
let activityColumn: Promise<void> | undefined;
async function ensureActivityColumn() {
  if (!activityColumn)
    activityColumn = db()
      .query(
        "alter table dashboard_read_snapshots add column if not exists last_requested_at timestamptz",
      )
      .then(() => undefined)
      .catch((error) => {
        activityColumn = undefined;
        throw error;
      });
  await activityColumn;
}
class MissingSnapshot extends Error {}
class OversizedSnapshot extends Error {
  constructor(readonly row: Row) {
    super("Snapshot exceeds shared cache size budget");
  }
}
const cachedReadRow = unstable_cache(
  async (key: string) => {
    const row = await readRow(key);
    if (row?.payload == null || !row.fetched_at) throw new MissingSnapshot();
    const compressed = gzipSync(JSON.stringify(row)).toString("base64");
    // Keep comfortably below the framework cache entry limit; large reads remain usable.
    if (compressed.length > 1500000) throw new OversizedSnapshot(row);
    return compressed;
  },
  ["dashboard-successful-source-read-v2"],
  { revalidate: 30 },
);

type Row = {
  payload: unknown;
  fetched_at: string | null;
  failed_at: string | null;
};
function result<T>(row: Row, spec: SnapshotSpec<T>): ReadSnapshot<T> {
  return {
    data: row.payload as T,
    fetchedAt: row.fetched_at!,
    stale: Date.now() - Date.parse(row.fetched_at!) > spec.maxAgeSeconds * 1000,
    refreshFailed:
      !!row.failed_at &&
      Date.parse(row.failed_at) >= Date.parse(row.fetched_at!),
  };
}
async function readRow(key: string) {
  const rows = await db().query(
    `select payload, fetched_at::text, failed_at::text from dashboard_read_snapshots where key=$1`,
    [key],
  );
  return rows[0] as Row | undefined;
}
export async function getReadSnapshot<T>(
  spec: SnapshotSpec<T>,
): Promise<ReadSnapshot<T>> {
  if (
    !process.env.DATABASE_URL ||
    process.env.MAGIC_MIKE_READ_SNAPSHOTS_ENABLED === "false"
  )
    return {
      data: await spec.load(),
      fetchedAt: new Date().toISOString(),
      stale: false,
      refreshFailed: false,
    };
  await ensureSnapshotTable();
  try {
    await db().query(
      "update dashboard_read_snapshots set last_requested_at=now() where key=$1",
      [spec.key],
    );
  } catch {
    console.warn("dashboard_snapshot_activity_write_failed");
  }
  let row: Row | undefined;
  try {
    row = JSON.parse(
      gunzipSync(Buffer.from(await cachedReadRow(spec.key), "base64")).toString(
        "utf8",
      ),
    ) as Row;
  } catch (error) {
    if (error instanceof OversizedSnapshot) row = error.row;
    else if (!(error instanceof MissingSnapshot)) row = await readRow(spec.key);
  }
  // Stale successful data stays immediately available. Scheduled refresh owns source I/O.
  if (row?.payload != null && row.fetched_at) {
    const value = result<T>(row, spec);
    if (value.stale && spec.refreshOnRead !== false) {
      try {
        after(async () => {
          try {
            await refreshReadSnapshot(spec);
          } catch {
            /* Saved data remains available; source error is logged by refresher. */
          }
        });
      } catch {
        /* Direct scripts have no request context; scheduled refresh handles recent activity. */
      }
    }
    return value;
  }
  if (spec.initializeOnRead === false) {
    if (spec.refreshOnRead !== false)
      try {
        after(async () => {
          try {
            await refreshReadSnapshot(spec);
          } catch {
            /* Existing version remains the fallback. */
          }
        });
      } catch {
        /* Bootstrap/cron can prepare the new read outside a page request. */
      }
    throw new Error("The new source read is being prepared.");
  }
  await refreshReadSnapshot(spec);
  // A second cold request joins the first lease instead of displaying an error while it succeeds.
  const deadline =
    Date.now() + Math.min(20000, Math.max(0, spec.initializeWaitMs || 0));
  do {
    const first = await readRow(spec.key);
    if (first?.payload != null && first.fetched_at) return result(first, spec);
    if (
      Date.now() >= deadline ||
      (first?.failed_at && Date.parse(first.failed_at) >= Date.now() - 60000)
    )
      break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  } while (Date.now() <= deadline);
  throw new Error("Data is being refreshed. Please try again shortly.");
}
export async function refreshReadSnapshot<T>(
  spec: SnapshotSpec<T>,
  scheduled = false,
): Promise<string> {
  if (!process.env.DATABASE_URL)
    throw new Error("Snapshot storage is unavailable.");
  await ensureSnapshotTable();
  const token = randomUUID();
  const claim = await db().query(
    `insert into dashboard_read_snapshots(key,lease_token,lease_until,last_requested_at)
    select $1,$2,now()+interval '330 seconds',case when $4::bool then null else now() end
    where not $4::bool or exists(select 1 from dashboard_read_snapshots where key=$1 and last_requested_at>now()-interval '30 minutes') on conflict(key) do update
    set lease_token=$2,lease_until=now()+interval '330 seconds'
    where (dashboard_read_snapshots.lease_until is null or dashboard_read_snapshots.lease_until<now())
      and (dashboard_read_snapshots.fetched_at is null or dashboard_read_snapshots.fetched_at<now()-make_interval(secs=>$3))
    returning key`,
    [spec.key, token, spec.maxAgeSeconds, scheduled],
  );
  if (!claim.length) return "fresh_or_refreshing";
  try {
    const data = await spec.load();
    // Publish one complete read atomically; a lost lease cannot overwrite a newer snapshot.
    const saved = await db().query(
      `update dashboard_read_snapshots set payload=$3::jsonb,fetched_at=now(),
      failed_at=null,lease_token=null,lease_until=null where key=$1 and lease_token=$2 returning key`,
      [spec.key, token, JSON.stringify(data)],
    );
    return saved.length ? "refreshed" : "lease_lost";
  } catch (error) {
    await db().query(
      `update dashboard_read_snapshots set failed_at=now(),lease_token=null,lease_until=now()+interval '60 seconds'
      where key=$1 and lease_token=$2`,
      [spec.key, token],
    );
    console.error("dashboard_source_refresh_failed", {
      source: spec.key.split(":")[0],
      kind: error instanceof Error ? error.name : "unknown",
    });
    throw error;
  }
}
export function snapshotWarning(
  read: Pick<ReadSnapshot<unknown>, "stale" | "refreshFailed" | "fetchedAt">,
) {
  return read.stale || read.refreshFailed
    ? `${read.refreshFailed ? "Refresh is delayed." : "Fresh source data is being checked."} Showing the last successful source read from ${formatMiamiDateTime(read.fetchedAt)}.`
    : undefined;
}

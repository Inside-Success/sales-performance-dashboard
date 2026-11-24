import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { neon } from "@neondatabase/serverless";

// Reports are complete Zoom session lists. Aliases map a reviewed rep to an
// exact Zoom account email when their display name differs.
const [inputsDir, reportsFile, aliasesFile, mode] = process.argv.slice(2);
const read = async (file) => JSON.parse(await readFile(file, "utf8"));
const reports = await read(reportsFile);
const aliases = await read(aliasesFile);
const sql = neon(process.env.DATABASE_URL);
const rows = await sql`SELECT occurrence, digest, summary, review FROM call2_duration_pilot ORDER BY occurrence`;
const checked = [];
for (const file of (await readdir(inputsDir)).filter((f) => f.endsWith(".json"))) {
  const c = await read(join(inputsDir, file));
  const row = rows.find((r) => r.occurrence === c.uuid);
  const matches = reports.filter((r) => r.uuid === c.uuid);
  if (!row || matches.length !== 1 || row.summary.rep !== c.rep ||
      row.summary.cast !== c.cast || row.summary.total !== c.meetingEnd - c.meetingStart ||
      row.summary.recordingStart !== c.recordingStart) throw Error("Occurrence mismatch");
  const sessions = matches[0].sessions;
  const intervals = (participants) => participants.map((p) => {
    const start = Date.parse(p.join) / 1000, end = Date.parse(p.leave) / 1000;
    if (!Number.isInteger(start) || !Number.isInteger(end) || end < start ||
        start < c.meetingStart || end > c.meetingEnd) throw Error("Invalid Zoom session");
    return [start, end];
  }).sort(([a,b],[x,y]) => a-x || b-y);
  const cast = intervals(sessions.filter((p) => p.name === c.cast));
  const rep = intervals(sessions.filter((p) => p.name === c.rep ||
    (aliases[c.rep] && p.email === aliases[c.rep])));
  if (!rep.length || !cast.length || !isDeepStrictEqual(cast, c.castIntervals.toSorted(([a,b],[x,y]) => a-x || b-y))) {
    throw Error("Unverified participant identity for " + c.rep);
  }
  const overlaps = [];
  for (const [a,b] of cast) for (const [x,y] of rep) {
    const start = Math.max(a,x) - c.meetingStart, end = Math.min(b,y) - c.meetingStart;
    if (end > start) overlaps.push([start,end]);
  }
  const merged = [];
  for (const [start,end] of overlaps.sort(([a],[b]) => a-b)) {
    const last = merged.at(-1);
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start,end]);
  }
  if (!merged.length) throw Error("No shared attendance for attended call");
  checked.push({occurrence:c.uuid,digest:row.digest,shared:merged});
}
if (rows.length !== 20 || checked.length !== 20 || new Set(checked.map(r=>r.occurrence)).size !== 20) throw Error("Expected the frozen 20");
if (mode === "--publish") {
  const migrated = await sql`WITH input AS (SELECT * FROM jsonb_to_recordset(${JSON.stringify(checked)}::jsonb)
    AS i(occurrence text,digest text,shared jsonb)), eligible AS MATERIALIZED (
    SELECT p.occurrence,i.shared FROM call2_duration_pilot p JOIN input i USING(occurrence,digest)
    WHERE p.shared_intervals IS NULL OR p.shared_intervals=i.shared FOR UPDATE OF p)
    UPDATE call2_duration_pilot p SET shared_intervals=e.shared FROM eligible e
    WHERE p.occurrence=e.occurrence AND (SELECT count(*) FROM eligible)=20 RETURNING p.occurrence`;
  if (migrated.length !== 20) throw Error("Cohort changed");
  const saved = await sql`SELECT occurrence, digest, summary, review, shared_intervals FROM call2_duration_pilot ORDER BY occurrence`;
  if (!saved.every(({shared_intervals,...row},i) => isDeepStrictEqual(row,rows[i]) &&
    isDeepStrictEqual(shared_intervals, checked.find(r=>r.occurrence===row.occurrence)?.shared)) ||
    saved.length !== rows.length) throw Error("Readback mismatch");
}
console.log("Verified attendance for",checked.length,"pilot calls");

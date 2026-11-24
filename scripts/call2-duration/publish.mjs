import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
import { z } from "zod";

const integer = z.number().int().nonnegative();
const cue = z.object({
  id: integer,
  at: integer,
  playback: integer,
  text: z.string().min(1),
});
const summary = z.object({
  rep: z.string().min(1),
  cast: z.string().min(1),
  show: z.string().min(1),
  total: integer.positive(),
  attendance: integer.nullable(),
  outcome: z.string().min(1),
  date: z.string().datetime({ offset: true }),
  signal: cue.nullable(),
  recordingStart: z.number().positive(),
  recording: z
    .string()
    .url()
    .refine((value) => {
      const u = new URL(value);
      return (
        u.protocol === "https:" &&
        /(^|\.)zoom\.us$/.test(u.hostname) &&
        /^\/rec\/(play|share)\//.test(u.pathname)
      );
    }),
});
const format = z.object({
  occurrence: z.string().min(1),
  digest: z.string().regex(/^[a-f0-9]{64}$/),
  summary,
  cues: z.array(cue).min(1),
});
const files = process.argv.slice(2);
if (!files.length || files.length > 20)
  throw Error("Supply 1–20 reviewed pilot results");
const sql = neon(process.env.DATABASE_URL);
const calls = await Promise.all(
  files.map(async (file) =>
    format.parse(JSON.parse(await readFile(file, "utf8"))),
  ),
);
for (const { summary: s, cues } of calls) {
  if (
    new Set(cues.map((c) => c.id)).size !== cues.length ||
    cues.some((c) => c.at > s.total) ||
    (s.attendance ?? 0) > s.total ||
    (s.signal &&
      !cues.some((c) => JSON.stringify(c) === JSON.stringify(s.signal)))
  ) {
    throw Error("Pilot evidence or timing mismatch");
  }
}
await sql.transaction(
  calls.map(
    (
      c,
    ) => sql`INSERT INTO call2_duration_pilot (occurrence,digest,started_at,summary,cast_cues)
  VALUES (${c.occurrence},${c.digest},${c.summary.date},${JSON.stringify(c.summary)}::jsonb,${JSON.stringify(c.cues)}::jsonb)
  ON CONFLICT (occurrence) DO NOTHING`,
  ),
);
const saved =
  await sql`SELECT occurrence,digest,summary,cast_cues FROM call2_duration_pilot WHERE occurrence = ANY(${calls.map((c) => c.occurrence)}::text[])`;
for (const c of calls) {
  const r = saved.find((row) => row.occurrence === c.occurrence);
  if (
    !r ||
    r.digest !== c.digest ||
    JSON.stringify(summary.parse(r.summary)) !== JSON.stringify(c.summary) ||
    JSON.stringify(z.array(cue).parse(r.cast_cues)) !== JSON.stringify(c.cues)
  )
    throw Error("Stored result differs; inspect before publishing");
}
console.log("Verified stored pilot calls:", saved.length);

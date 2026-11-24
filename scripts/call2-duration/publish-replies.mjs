import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { neon } from "@neondatabase/serverless";

const [directory] = process.argv.slice(2);
async function readGroup(group) {
  const root = join(directory, group);
  const files = (await readdir(root)).filter((file) => file.endsWith(".json"));
  return Promise.all(
    files.map(async (file) =>
      JSON.parse(await readFile(join(root, file), "utf8")),
    ),
  );
}
const results = await readGroup("results");
const inputs = await readGroup("inputs");
const calls = results.map(({ occurrence, digest, summary, cues }) => {
  const input = inputs.find((item) => item.uuid === occurrence);
  if (
    !input ||
    input.rep !== summary.rep ||
    input.officialOutcome !== summary.outcome
  )
    throw Error("Pilot source mismatch");
  const speakers = [input.rep];
  if (input.rep === "Ahmed Iftikhar") speakers.push("Ahmed");
  const replies = {};
  for (const cue of cues) {
    const entry = input.entries[cue.id];
    if (!input.castSpeakers.includes(entry.speaker) || entry.text !== cue.text)
      throw Error("Cast cue mismatch");
    let index = cue.id + 1;
    while (
      index < input.entries.length &&
      input.castSpeakers.includes(input.entries[index].speaker)
    )
      index++;
    const turn = [];
    while (
      index < input.entries.length &&
      speakers.includes(input.entries[index].speaker)
    )
      turn.push(input.entries[index++].text);
    if (turn.length) replies[cue.id] = turn.join(" ");
  }
  return { occurrence, digest, summary, cues, replies };
});
if (new Set(calls.map((c) => c.occurrence)).size !== 20 || calls.length !== 20)
  throw Error("Expected the frozen 20-call cohort");
const sql = neon(process.env.DATABASE_URL);
const rows =
  await sql`SELECT occurrence,digest,cast_cues,summary FROM call2_duration_pilot`;
if (
  rows.length !== 20 ||
  calls.some(
    (c) =>
      !rows.some(
        (r) =>
          r.occurrence === c.occurrence &&
          r.digest === c.digest &&
          isDeepStrictEqual(r.cast_cues, c.cues) &&
          isDeepStrictEqual(r.summary, c.summary),
      ),
  )
)
  throw Error("Stored cohort differs from source");
await sql.transaction(
  calls.map(
    (c) =>
      sql`UPDATE call2_duration_pilot SET rep_replies = ${JSON.stringify(c.replies)}::jsonb WHERE occurrence = ${c.occurrence} AND digest = ${c.digest}`,
  ),
);
const saved =
  await sql`SELECT occurrence,rep_replies FROM call2_duration_pilot`;
if (
  !calls.every((c) =>
    isDeepStrictEqual(
      saved.find((r) => r.occurrence === c.occurrence)?.rep_replies,
      c.replies,
    ),
  )
)
  throw Error("Reply readback mismatch");
console.log(
  "Verified 20 calls. Marked calls with an immediate rep turn:",
  calls.filter((c) => c.summary.signal && c.replies[c.summary.signal.id])
    .length,
);

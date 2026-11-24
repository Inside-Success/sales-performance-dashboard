import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";

const [results, media] = process.argv.slice(2);
if (!results || !media)
  throw Error("Supply the private pilot results and audio directories");
const chunkSize = 524288;
const sql = neon(process.env.DATABASE_URL);
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function publish(name) {
  const r = JSON.parse(await fs.readFile(path.join(results, name), "utf8"));
  const id = r.occurrence;
  const [source] =
    await sql`SELECT digest FROM call2_duration_pilot WHERE occurrence=${id}`;
  if (source?.digest !== r.digest || sha(id) + ".json" !== name)
    throw Error("Unmatched pilot review");
  const file = await fs.readFile(path.join(media, sha(id) + ".mp3"));
  const hash = sha(file),
    size = file.length;
  const parts = Math.ceil(size / chunkSize);
  if (!size || size > 32 * 1024 * 1024)
    throw Error("Unexpected pilot audio size");
  // Part zero is the publication marker. Commit it only when every other part matches.
  for (let part = parts - 1; part >= 0; part--) {
    const bytes = file.subarray(part * chunkSize, (part + 1) * chunkSize);
    const [saved] =
      await sql`INSERT INTO call2_duration_audio_parts(occurrence,part,file_hash,total_bytes,audio)
      VALUES (${id},${part},${hash},${size},decode(${bytes.toString("base64")},'base64'))
      ON CONFLICT (occurrence,part) DO UPDATE SET file_hash=excluded.file_hash
      WHERE call2_duration_audio_parts.file_hash=excluded.file_hash
        AND call2_duration_audio_parts.total_bytes=excluded.total_bytes
        AND call2_duration_audio_parts.audio=excluded.audio
      RETURNING encode(sha256(audio),'hex') AS checksum`;
    if (saved?.checksum !== sha(bytes)) throw Error("Audio readback mismatch");
  }
  console.log("Verified audio", name.slice(0, 8), size);
}

const files = (await fs.readdir(results)).filter((f) => f.endsWith(".json"));
if (!files.length || files.length > 20)
  throw Error("Expected bounded pilot cohort");
for (let i = 0; i < files.length; i += 4)
  await Promise.all(files.slice(i, i + 4).map(publish));

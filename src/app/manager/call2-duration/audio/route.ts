import { neon } from "@neondatabase/serverless";
import { requireRepScoringAdmin } from "@/lib/rep-scoring/access";

export const dynamic = "force-dynamic";
const chunkSize = 524288;

async function serve(request: Request, head: boolean) {
  await requireRepScoringAdmin();
  const occurrence = new URL(request.url).searchParams.get("call");
  const db = neon(process.env.DATABASE_URL!);
  const headers = new Headers({
    "Cache-Control": "private, no-store",
    "Accept-Ranges": "bytes",
    "Content-Type": "audio/mpeg",
    "X-Content-Type-Options": "nosniff",
  });
  const [file] =
    await db`SELECT total_bytes FROM call2_duration_audio_parts WHERE occurrence=${occurrence} AND part=0`;
  if (!file) return new Response(null, { status: 404, headers });
  const size = Number(file.total_bytes);
  if (head) {
    headers.set("Content-Length", String(size));
    return new Response(null, { headers });
  }
  const range = request.headers.get("range");
  const match = range?.match(/^bytes=(\d*)-(\d*)$/);
  let first = 0,
    last = size - 1;
  if (match && (match[1] || match[2])) {
    first = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
    last = match[1] && match[2] ? Math.min(last, Number(match[2])) : last;
  }
  if (
    range &&
    (!match ||
      (!match[1] && !match[2]) ||
      !Number.isSafeInteger(first) ||
      !Number.isSafeInteger(last) ||
      first > last)
  ) {
    headers.set("Content-Range", "bytes */" + size);
    return new Response(null, { status: 416, headers });
  }
  if (match?.[1] && !match[2]) last = Math.min(last, first + chunkSize - 1);
  headers.set("Content-Length", String(last - first + 1));
  if (range) headers.set("Content-Range", `bytes ${first}-${last}/${size}`);
  let position = first;
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (request.signal.aborted) {
        controller.close();
        return;
      }
      const part = Math.floor(position / chunkSize);
      const [row] =
        await db`SELECT encode(audio,'base64') AS data FROM call2_duration_audio_parts WHERE occurrence=${occurrence} AND part=${part}`;
      if (!row) throw Error("Incomplete pilot audio");
      const bytes = Buffer.from(row.data, "base64");
      const offset = position % chunkSize;
      const slice = bytes.subarray(offset, offset + last - position + 1);
      if (!slice.length) throw Error("Invalid pilot audio range");
      controller.enqueue(slice);
      position += slice.length;
      if (position > last) controller.close();
    },
  });
  return new Response(stream, { status: range ? 206 : 200, headers });
}
export async function GET(request: Request) {
  return serve(request, false);
}
export async function HEAD(request: Request) {
  return serve(request, true);
}

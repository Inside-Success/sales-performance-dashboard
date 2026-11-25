import { neon } from "@neondatabase/serverless";
import { auth } from "@/auth";
import { isMagicMikeAdmin } from "@/lib/admin-access-policy";

export const dynamic = "force-dynamic";
const blockSize = 256 * 1024;
const privateHeaders = { "Cache-Control": "private, no-store", "Vary": "Cookie", "Accept-Ranges": "bytes" };

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isMagicMikeAdmin(session?.user?.email)) return new Response(null, { status: 403, headers: privateHeaders });
  const { id } = await params;
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(id)) return new Response(null, { status: 404 });
  const sql = neon(process.env.DATABASE_URL!);
  const [media] = await sql`SELECT size_bytes FROM training_clip_media WHERE id = ${id}`;
  if (!media) return new Response(null, { status: 404 });
  const size = Number(media.size_bytes);
  let start = 0;
  let end = size - 1;
  const range = request.headers.get("range");
  if (range !== null) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (match && (match[1] || match[2])) {
      start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
      end = match[1] && match[2] ? Math.min(end, Number(match[2])) : end;
    } else start = size;
    if (start > end || !Number.isSafeInteger(start))
      return new Response(null, { status: 416, headers: { ...privateHeaders, "Content-Range": `bytes */${size}` } });
  }
  let position = start;
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const part = Math.floor(position / blockSize);
      const [row] = await sql`SELECT encode(content, 'base64') AS data FROM training_clip_chunks
        WHERE media_id = ${id} AND part = ${part}`;
      if (!row) throw new Error("Missing clip segment");
      const bytes = Buffer.from(row.data, "base64");
      const slice = bytes.subarray(position % blockSize, Math.min(bytes.length, end - part * blockSize + 1));
      if (!slice.length) throw new Error("Incomplete clip segment");
      controller.enqueue(slice);
      position += slice.length;
      if (position > end) controller.close();
    },
  });
  return new Response(stream, { status: range ? 206 : 200, headers: {
    ...privateHeaders, "Content-Type": "video/mp4", "Content-Length": String(end - start + 1),
    ...(range ? { "Content-Range": `bytes ${start}-${end}/${size}` } : {}),
  } });
}

import { timingSafeEqual } from "node:crypto";
import { checkpointInput } from "@/lib/provider-checkpoint-policy";
import { providerCheckpoint } from "@/lib/provider-checkpoints";

export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(request: Request) {
  const expected = process.env.INGEST_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() || "";
  if (!expected || Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const text = await request.text();
    if (Buffer.byteLength(text) > 512_000) return Response.json({ error: "Payload too large" }, { status: 413 });
    const parsed = checkpointInput.safeParse(JSON.parse(text));
    if (!parsed.success) return Response.json({ error: "Invalid checkpoint request" }, { status: 400 });
    return Response.json(await providerCheckpoint(parsed.data), { headers: { "Cache-Control": "no-store" } });
  } catch {
    // Never reflect report content, database messages or credentials into public responses.
    return Response.json({ error: "Checkpoint unavailable or result refused" }, { status: 503 });
  }
}

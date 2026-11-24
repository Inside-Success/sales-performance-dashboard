import { neon } from "@neondatabase/serverless";
import { auth } from "@/auth";
import { isRepScoringAdmin } from "@/lib/rep-scoring/admin-allowlist";
import type { Cue } from "@/app/manager/call2-duration/data";

const reply = (body: object, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET(request: Request) {
  const session = await auth();
  if (!isRepScoringAdmin(session?.user?.email)) return reply({ error: "Admin access required." }, 403);
  const occurrence = new URL(request.url).searchParams.get("occurrence");
  if (!occurrence || occurrence.length > 64) return reply({ error: "Invalid call." }, 400);
  try {
    const sql = neon(process.env.DATABASE_URL!);
    const [row] = await sql`SELECT transcript_doc_id, COALESCE(review, summary)->'signal' AS cue
      FROM call2_duration_pilot WHERE occurrence=${occurrence}`;
    if (!row?.transcript_doc_id || !/^[\w-]+$/.test(row.transcript_doc_id)) return reply({ error: "Transcript unavailable." }, 404);
    const response = await fetch(`https://docs.google.com/document/d/${row.transcript_doc_id}/export?format=txt`, { cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!response.ok || !response.headers.get("content-type")?.startsWith("text/plain")) throw Error();
    const source = (await response.text()).replace(/\r\n/g, "\n");
    const marker = /^Full Transcript[ \t]*$/m.exec(source);
    if (!marker || !source.slice(0, marker.index).split("\n").includes("Zoom Meeting UUID: " + occurrence)) throw Error();
    const transcript = source.slice(marker.index + marker[0].length).trim();
    if (!transcript) throw Error();
    const cue: Cue | null = row.cue;
    // Google Docs groups consecutive Zoom cues from the same speaker into a turn.
    const turns = transcript.split("\n").flatMap((line, index) => {
      const match = /^\[(\d+):(\d+):([\d.]+)\] [^:]+: (.*)$/.exec(line);
      return match ? [{ index, start: Number(match[1])*3600 + Number(match[2])*60 + Number(match[3]), speech: match[4] }] : [];
    });
    const candidates = cue ? turns.filter((turn, i) =>
      turn.start <= cue.playback + 0.5 && (turns[i + 1]?.start ?? Infinity) > cue.playback - 0.5 &&
      turn.speech.includes(cue.text) && turn.speech.indexOf(cue.text) === turn.speech.lastIndexOf(cue.text)
    ) : [];
    return reply({ transcript, lineIndex: candidates.length === 1 ? candidates[0].index : -1 });

  } catch {
    return reply({ error: "Couldn’t load this call. Open the source transcript below." }, 502);
  }
}

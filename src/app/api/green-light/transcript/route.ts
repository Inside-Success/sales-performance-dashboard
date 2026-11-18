import { NextRequest, NextResponse } from "next/server";
import { badRequest, requireGreenLightUser, transcriptRequestSchema } from "@/lib/green-light/server";
import { isZoomRecordingLink } from "@/lib/green-light/shows";
import { traceGreenLight } from "@/lib/green-light/trace-store";
import { resolveZoomCallTranscript } from "@/lib/green-light/zoom-call-transcript";
import { resolveManualArchivedTranscript } from "@/lib/manual-transcript-archive";
import { resolveZoomTranscript } from "@/lib/zoom-transcript";

export const runtime = "nodejs";
export const maxDuration = 60;

const NOT_READY =
  "Zoom has no transcript for this recording yet. Try again in a few minutes, or use Paste transcript.";

export async function POST(request: NextRequest) {
  const user = await requireGreenLightUser();
  if (user instanceof NextResponse) return user;

  let zoomLink: string;
  try {
    zoomLink = transcriptRequestSchema.parse(await request.json()).zoom_link;
  } catch (error) {
    return badRequest(error);
  }
  if (!isZoomRecordingLink(zoomLink)) {
    return NextResponse.json(
      { ok: false, code: "invalid_link", error: "That is not a Zoom recording link. Paste the recording share link, or use Paste transcript." },
      { status: 400 },
    );
  }

  // 1. Zoom's current recording page (transcript endpoint named by the page's feature config).
  // 2. The shared Magic Mike resolver: older Zoom pages, then the signed-in rep's archived transcript.
  let transcript = "";
  try {
    transcript = (await resolveZoomCallTranscript(zoomLink))?.trim() || "";
  } catch (error) {
    console.error("Green light Zoom page transcript unavailable", error instanceof Error ? error.name : "UnknownError");
  }
  if (transcript.length < 120) {
    try {
      const result = await resolveZoomTranscript(zoomLink, (recording) => resolveManualArchivedTranscript(recording, user.email));
      transcript = result?.transcriptText?.trim() || "";
    } catch (error) {
      console.error("Green light Zoom fallback transcript unavailable", error instanceof Error ? error.name : "UnknownError");
    }
  }
  // Which recording was asked for and whether Zoom had its transcript (the text itself is kept with the letter).
  const found = transcript.length >= 120;
  traceGreenLight({
    event: "zoom",
    rep_email: user.email,
    rep_name: user.name,
    zoom_link: zoomLink,
    error: found ? undefined : NOT_READY,
    detail: { outcome: found ? "transcript_found" : "not_ready", transcript_chars: transcript.length },
  });
  if (!found) return NextResponse.json({ ok: false, code: "not_ready", error: NOT_READY }, { status: 422 });
  return NextResponse.json({ ok: true, transcript });
}

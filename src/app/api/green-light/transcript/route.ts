import { NextRequest, NextResponse } from "next/server";
import { badRequest, requireGreenLightUser, transcriptRequestSchema } from "@/lib/green-light/server";
import { isZoomRecordingLink } from "@/lib/green-light/shows";
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

  try {
    const result = await resolveZoomTranscript(zoomLink, (recording) => resolveManualArchivedTranscript(recording, user.email));
    const transcript = result?.transcriptText?.trim() || "";
    if (transcript.length < 120) return NextResponse.json({ ok: false, code: "not_ready", error: NOT_READY }, { status: 422 });
    return NextResponse.json({ ok: true, transcript });
  } catch (error) {
    console.error("Green light Zoom transcript unavailable", error instanceof Error ? error.name : "UnknownError");
    return NextResponse.json({ ok: false, code: "not_ready", error: NOT_READY }, { status: 422 });
  }
}

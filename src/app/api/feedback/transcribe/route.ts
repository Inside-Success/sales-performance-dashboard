import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { isAllowedAuthEmail, normalizeAuthEmail } from "@/lib/auth-utils";
import { getAskSalesFaqAccess } from "@/lib/ask-sales-faq/access";
import { getAskSalesFaqFeedbackContext, getManualFeedbackReport, getPerformanceCall } from "@/lib/db";
import { isEnhancedReport } from "@/lib/report-version";
import { audioExtension, audioMatchesContainer, VOICE_MAX_BYTES, VOICE_MAX_SECONDS, type VoiceContext } from "@/lib/feedback-voice";
import { finishVoiceRequest, reserveVoiceRequest } from "@/lib/feedback-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const voiceContextSchema: z.ZodType<VoiceContext> = z.discriminatedUnion("kind", [
  z.object({kind:z.literal("coaching"),reportType:z.enum(["official","manual"]),reportId:z.string().min(1).max(200)}),
  z.object({kind:z.literal("faq"),conversationId:z.string().min(1).max(160),messageId:z.string().min(1).max(160)}),
]);
const reply = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function POST(request: Request) {
  const session = await auth();
  const email = normalizeAuthEmail(session?.user?.email);
  if (!email || !isAllowedAuthEmail(email)) return reply("Sign in to record feedback.", 401);
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return reply("Open feedback on the dashboard.", 403);
  const apiKey = process.env.FEEDBACK_TRANSCRIPTION_OPENAI_API_KEY;
  if (!apiKey || process.env.FEEDBACK_VOICE_ENABLED !== "true") return reply("Voice feedback is unavailable. You can still type your feedback.", 503);
  if (Number(request.headers.get("content-length")) > VOICE_MAX_BYTES + 20_000) return reply("Recording is too large. Please make a shorter recording.", 413);
  let id: string | undefined;
  let started = 0;
  try {
    const form = await request.formData();
    const context = voiceContextSchema.parse(JSON.parse(String(form.get("context"))));
    id = z.string().uuid().parse(form.get("requestId"));
    const seconds = z.coerce.number().min(0.5).max(VOICE_MAX_SECONDS + 1).parse(form.get("seconds"));
    const audio = form.get("audio");
    if (!(audio instanceof File) || !audio.size) return reply("Recording is empty. Please record again.", 400);
    if (audio.size > VOICE_MAX_BYTES) return reply("Recording is too large. Please make a shorter recording.", 413);
    const extension = audioExtension(audio.type);
    if (!extension) return reply("This recording format is unsupported. Please type your feedback.", 415);
    if (context.kind === "faq") {
      const access = getAskSalesFaqAccess(session);
      if (!access.ok) return reply(access.message, access.status);
      const found = await getAskSalesFaqFeedbackContext({ messageId: context.messageId, conversationId: context.conversationId, viewerEmail: email, rating: "down", comment: null });
      if (!found) return reply("This answer is not available for your account.", 404);
    } else {
      const report = context.reportType === "official" ? await getPerformanceCall(context.reportId) : await getManualFeedbackReport(context.reportId);
      if (!report || !isEnhancedReport(report.source_payload.coaching_version)) return reply("Feedback is not available for this report.", 404);
    }
    const bytes = new Uint8Array(await audio.arrayBuffer());
    if (!audioMatchesContainer(bytes, extension)) return reply("This recording could not be read. Please record again.", 400);
    const hash = createHash("sha256").update(JSON.stringify(context)).update(bytes).digest("hex");
    const reserved = await reserveVoiceRequest(id, email, hash, context);
    if (reserved.state === "complete") return NextResponse.json({ text: reserved.text });
    if (reserved.state === "limited") return reply("Please wait before recording more feedback. You can still type.", 429);
    if (reserved.state === "conflict") return reply("This recording request does not match. Please record again.", 409);
    if (reserved.state === "held") return reply("This recording was already sent for transcription. It will not be charged again automatically. Please type your feedback or make a new recording.", 409);
    started = Date.now();
    const upload = new FormData();
    upload.set("model", "gpt-transcribe");
    upload.set("file", audio, `feedback.${extension}`);
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: upload, signal: AbortSignal.timeout(40_000) });
    const requestId = response.headers.get("x-request-id");
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      await finishVoiceRequest(id, "failed", null, requestId, data?.usage, Date.now() - started);
      return reply("Transcription could not finish. Please type your feedback or make a new recording.", 502);
    }
    const text = typeof data?.text === "string" ? data.text.trim() : "";
    if (!text || text.length > 4000) {
      await finishVoiceRequest(id, "failed", null, requestId, data?.usage, Date.now() - started);
      return reply(text ? "The transcript is too long. Please make a shorter recording." : "No clear speech was found. Please try speaking again or type your feedback.", 422);
    }
    await finishVoiceRequest(id, "complete", text, requestId, { provider: data?.usage ?? null, recordingSeconds: seconds, model: "gpt-transcribe" }, Date.now() - started);
    return NextResponse.json({ text });
  } catch (error) {
    if (id && started) await finishVoiceRequest(id, "uncertain", null, null, null, Date.now() - started).catch(() => undefined);
    if (error instanceof z.ZodError || error instanceof SyntaxError || error instanceof TypeError && !started) return reply("This recording could not be read. Please record again or type your feedback.", 400);
    console.error("Feedback transcription failed", { providerStarted: Boolean(started) });
    return reply("Transcription is unavailable right now. Your written feedback is unchanged.", 502);
  }
}

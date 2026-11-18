import "server-only";
import { after, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { normalizeAuthEmail } from "@/lib/auth-utils";
import {
  countContextWords,
  GREEN_LIGHT_MAX_FOCUS_TEXT_LENGTH,
  GREEN_LIGHT_MIN_TRANSCRIPT_LENGTH,
  GREEN_LIGHT_SHOW_VALUES,
  greenLightMinContextWords,
} from "@/lib/green-light/shows";

// The rep page reuses the editors' Green Light V2 n8n workflow. Requests go through these server
// routes, so the workflow address never reaches the browser and every call needs a signed-in user.
const WORKFLOW_BASE =
  process.env.GREEN_LIGHT_N8N_WEBHOOK_BASE ||
  "https://insidesuccess.app.n8n.cloud/webhook/green-light-v2-conditional-approval";

type Env = Record<string, string | undefined>;

/**
 * GREEN_LIGHT_LETTERS_DISABLED=true turns the feature off for everyone (rollback switch).
 * GREEN_LIGHT_LETTERS_PILOT_EMAILS limits it to the listed emails; unset means every signed-in user.
 */
export function canUseGreenLight(email: string | null | undefined, env: Env = process.env) {
  const normalized = normalizeAuthEmail(email);
  if (!normalized || env.GREEN_LIGHT_LETTERS_DISABLED === "true") return false;
  const pilot = (env.GREEN_LIGHT_LETTERS_PILOT_EMAILS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return pilot.length ? pilot.includes(normalized) : true;
}

/** Folder name under Drive "Reps": the Google account name, or the email prefix when it has none. */
export function repFolderName(name: string | null | undefined, email: string) {
  const clean = String(name || "")
    .replace(/[\u0000-\u001F\u007F\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)
    .trim();
  return clean || email.split("@")[0];
}

export type GreenLightUser = { email: string; name: string };

export async function requireGreenLightUser(): Promise<GreenLightUser | NextResponse> {
  const session = await auth();
  const email = normalizeAuthEmail(session?.user?.email);
  if (!email) {
    return NextResponse.json({ ok: false, code: "signed_out", error: "Your sign-in expired. Refresh the page to sign in again." }, { status: 401 });
  }
  if (!canUseGreenLight(email)) {
    return NextResponse.json({ ok: false, code: "not_allowed", error: "Green Light Letters is not available for this account." }, { status: 403 });
  }
  return { email, name: repFolderName(session?.user?.name, email) };
}

const name = z.string().trim().max(120);
const multiSchema = z
  .object({
    enabled: z.boolean(),
    letter_count: z.union([z.literal(1), z.literal(2)]),
    position: z.union([z.literal(1), z.literal(2)]),
    names: z.array(name).max(2),
  })
  .optional();

export const transcriptRequestSchema = z.object({ zoom_link: z.string().trim().min(10).max(2000) });

// The focus points box, one entry per line. No limit a rep would meet: the size check only stops a runaway paste.
const focusLines = z
  .array(z.string().trim().min(1))
  .max(20000)
  .refine((lines) => lines.reduce((total, line) => total + line.length + 1, 0) <= GREEN_LIGHT_MAX_FOCUS_TEXT_LENGTH + 20000);

export const generateRequestSchema = z
  .object({
    show: z.enum(GREEN_LIGHT_SHOW_VALUES),
    prospect_name: name.min(2),
    transcript: z.string().trim().max(600000),
    // "focus_points" = no call transcript yet: the letter is written from the focus points alone.
    input_type: z.enum(["zoom_link", "transcript", "focus_points"]),
    focus_points: focusLines,
    multi: multiSchema,
    // Only kept in the trace log, so a letter can be traced back to its recording.
    zoom_link: z.unknown().optional().transform((value) => (typeof value === "string" ? value.trim().slice(0, 2000) : undefined)),
  })
  .superRefine((input, context) => {
    const fail = (path: string) => context.addIssue({ code: "custom", path: [path], message: "invalid" });
    if (input.input_type !== "focus_points") {
      if (input.transcript.length < GREEN_LIGHT_MIN_TRANSCRIPT_LENGTH) fail("transcript");
      return;
    }
    if (input.transcript) fail("transcript");
    if (input.multi?.enabled) fail("multi");
    if (countContextWords(input.focus_points) < greenLightMinContextWords(input.show)) fail("focus_points");
  });

const draftFields = {
  show: z.enum(GREEN_LIGHT_SHOW_VALUES),
  draft_text: z.string().trim().min(500).max(60000),
  prospect_name: name,
  // Echoed back from the workflow: shortened rather than rejected, so a long note can never block a save.
  guest_name: z.string().transform((value) => value.trim().slice(0, 160)).optional(),
  doc_title: z.string().transform((value) => value.trim().slice(0, 200)).optional(),
  warnings: z.array(z.string()).transform((items) => items.slice(0, 30).map((item) => item.slice(0, 2000))).optional(),
  job_id: z.string().transform((value) => value.trim().slice(0, 80)).optional(),
  multi: multiSchema,
};

export const refineRequestSchema = z.object({
  ...draftFields,
  instructions: z.string().trim().min(3).max(1000),
  transcript: z.string().max(600000),
  // Set for a letter written without a transcript: the focus points it was written from.
  source_notes: z.string().max(GREEN_LIGHT_MAX_FOCUS_TEXT_LENGTH + 20000).optional(),
});

/**
 * What the refine step may check facts against. A letter written without a transcript has only
 * the rep's own text behind it, so that text is passed with the same limits the letter was written under.
 */
export function refineFactSource(transcript: string, sourceNotes: string | undefined) {
  const notes = String(sourceNotes || "").trim();
  if (transcript.trim() || !notes) return transcript;
  return [
    "There is no call transcript for this letter. The text below is what the casting manager wrote about the applicant, and it can include the applicant's application form answers. It is the only source of facts.",
    "Do not add any name, number, place, date, event or result that is not in it or already in the current draft.",
    "Never mention budget, investment, money the applicant can spend or contribute, a form, a survey, a consent or terms answer, or a season or show name written in the form.",
    "",
    notes,
  ].join("\n");
}

export const saveRequestSchema = z.object(draftFields);

export type MultiProspect = z.infer<typeof multiSchema>;

/** The multi-client fields the workflow already understands, unchanged from the editors' dashboard. */
export function multiClientFields(multi: MultiProspect, prospectName: string) {
  if (!multi?.enabled) {
    return { multi_client: false, multi_client_letter_count: 1, target_client_name: "", target_client_position: 1, client_names: [] as string[] };
  }
  return {
    multi_client: true,
    multi_client_letter_count: multi.letter_count,
    target_client_name: prospectName,
    target_client_position: multi.position,
    client_names: multi.names.filter(Boolean),
  };
}

export async function callWorkflow(
  suffix: "-start" | "-status" | "-refine" | "-save",
  options: { method: "GET" | "POST"; body?: unknown; query?: Record<string, string>; timeoutMs: number },
) {
  const url = new URL(`${WORKFLOW_BASE}${suffix}`);
  for (const [key, value] of Object.entries(options.query || {})) url.searchParams.set(key, value);
  const response = await fetch(url, {
    method: options.method,
    headers: options.method === "POST" ? { "content-type": "application/json" } : { accept: "application/json" },
    body: options.method === "POST" ? JSON.stringify(options.body ?? {}) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(options.timeoutMs),
  });
  const text = await response.text();
  let payload: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(text);
    payload = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : { message: text };
  } catch {
    payload = { message: text.slice(0, 500) };
  }
  return { ok: response.ok, status: response.status, payload };
}

export function workflowError(payload: Record<string, unknown>, fallback: string) {
  const message = [payload.error, payload.message].find((value) => typeof value === "string" && value.trim());
  return typeof message === "string" ? message.slice(0, 1200) : fallback;
}

export function badRequest(error: unknown) {
  const message = error instanceof z.ZodError ? "Some details are missing or too long. Check the form and try again." : "Invalid request.";
  return NextResponse.json({ ok: false, code: "invalid", error: message }, { status: 400 });
}

export function unreachable(action: string) {
  return NextResponse.json(
    { ok: false, code: "unreachable", error: `Could not ${action} right now. Try again in a moment; if it keeps happening, let Syed know.` },
    { status: 502 },
  );
}

export type GreenLightLogEvent = {
  event: "generate" | "refine" | "save";
  rep_name: string;
  rep_email: string;
  prospect_name?: string;
  show_type?: string;
  input_type?: string;
  focus_points?: string[];
  multi_prospect?: boolean;
  job_id?: string;
  doc_title?: string;
  document_url?: string;
  detail?: string;
};

/** Runs a logging task after the response has gone out. Failing to schedule it must never reach the rep. */
export function runAfterResponse(task: () => unknown) {
  try {
    after(task);
  } catch (error) {
    console.error("Green light log not scheduled", error instanceof Error ? error.name : "UnknownError");
  }
}

/** Best-effort activity log (hidden n8n table). A failure here must never affect the rep's letter. */
export async function logGreenLightEvent(event: GreenLightLogEvent) {
  const url = process.env.GREEN_LIGHT_LOG_WEBHOOK_URL;
  const secret = process.env.GREEN_LIGHT_LOG_SECRET;
  if (!url || !secret) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-green-light-log-secret": secret },
      body: JSON.stringify({ ...event, source: "magic-mike-rep-page", at: new Date().toISOString() }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
  } catch (error) {
    console.error("Green light activity log unavailable", error instanceof Error ? error.name : "UnknownError");
  }
}

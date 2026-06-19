import { resolveCloseSection } from "@/lib/close-section";
import type { JsonObject, ManualFeedbackReport, PerformanceCall } from "@/lib/types";

export const REPORT_CHAT_MODEL = "deepseek-v4-pro";

export type ReportChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const TRANSCRIPT_KEYS = [
  "cleaned_transcript",
  "transcript_text",
  "transcriptText",
  "meeting_transcript",
  "meetingTranscript",
  "transcript",
];

export function isReportChatEnabledForCall(call: Pick<PerformanceCall, "id" | "rep_slug">) {
  if (process.env.REPORT_CHAT_ENABLED !== "true") return false;
  return Boolean(call.id);
}

export function isReportChatEnabledForManualReport(
  report: Pick<ManualFeedbackReport, "public_id" | "rep_name" | "status">,
) {
  if (report.status !== "completed") return false;
  if (process.env.REPORT_CHAT_ENABLED !== "true") return false;
  return Boolean(report.public_id);
}

export async function fetchTranscriptText(call: PerformanceCall) {
  const payloadTranscript = extractTranscriptFromPayload(call.source_payload);
  if (payloadTranscript) {
    return {
      text: payloadTranscript,
      source: "source_payload",
    };
  }

  if (!call.transcript_link) {
    throw new Error("This report does not have a transcript link.");
  }

  const docId = extractGoogleDocId(call.transcript_link);
  const transcriptUrl = docId
    ? `https://docs.google.com/document/d/${docId}/export?format=txt`
    : call.transcript_link;

  const response = await fetch(transcriptUrl, {
    headers: {
      accept: "text/plain,text/vtt,*/*",
    },
  });

  if (!response.ok) {
    throw new Error("The transcript could not be loaded for this report.");
  }

  const transcript = cleanTranscriptText(await response.text());
  if (!transcript) {
    throw new Error("The transcript for this report was empty.");
  }

  return {
    text: transcript,
    source: docId ? "google_doc_export" : "direct_link",
  };
}

export async function fetchManualTranscriptText(report: ManualFeedbackReport) {
  const payloadTranscript = extractTranscriptFromPayload(report.source_payload);
  if (payloadTranscript) {
    return {
      text: payloadTranscript,
      source: "source_payload",
    };
  }

  const transcriptLink = report.transcript_drive_link || report.transcript_link;
  if (!transcriptLink) {
    throw new Error("This report does not have a transcript link.");
  }

  const docId = extractGoogleDocId(transcriptLink);
  const transcriptUrl = docId
    ? `https://docs.google.com/document/d/${docId}/export?format=txt`
    : transcriptLink;

  const response = await fetch(transcriptUrl, {
    headers: {
      accept: "text/plain,text/vtt,*/*",
    },
  });

  if (!response.ok) {
    throw new Error("The transcript could not be loaded for this report.");
  }

  const transcript = cleanTranscriptText(await response.text());
  if (!transcript) {
    throw new Error("The transcript for this report was empty.");
  }

  return {
    text: transcript,
    source: docId ? "google_doc_export" : "direct_link",
  };
}

export function buildReportChatMessages(
  call: PerformanceCall,
  transcriptText: string,
  history: ReportChatMessage[],
) {
  return buildMessages(buildReportContext(call, transcriptText), history);
}

export function buildManualReportChatMessages(
  report: ManualFeedbackReport,
  transcriptText: string,
  history: ReportChatMessage[],
) {
  return buildMessages(buildManualReportContext(report, transcriptText), history);
}

function buildMessages(reportContext: string, history: ReportChatMessage[]) {
  return [
    {
      role: "system" as const,
      content: [
        "You are the Magic Mike Bot report Q&A coach for Inside Success TV sales coaching reports.",
        "Answer only questions about the opened coaching report and its transcript.",
        "Use only the supplied coaching report fields and transcript. If the answer is not there, say you do not see it in this report or transcript.",
        "Default to short, direct answers: 1-3 sentences for normal questions, or up to 3 bullets when a list is useful.",
        "Give a longer answer only when the user explicitly asks for detail, examples, a script, a breakdown, or multiple steps.",
        "For casual memory or clarification questions, answer in one short sentence.",
        "This is coaching-only. Do not provide compliance, legal, regulatory, FTC, red-flag, policy-review, or lawsuit feedback. If asked for that, say this chat is only for sales coaching on this report.",
        "Do not mix compliance feedback with coaching feedback.",
        "Do not invent quotes, timestamps, facts, outcomes, objections, prices, packages, cast/show details, policies, or next steps.",
        "Use timestamps exactly as written when the transcript provides them. Do not create timestamps.",
        "Do not infer tone, body language, facial expression, or intent unless the transcript explicitly states it.",
        "Be fair to the sales rep. If a prospect had a genuine blocker, poor fit, approval need, payment access issue, or strong resistance, account for that in the coaching answer.",
        "Do not recommend custom deposits, invented payment plans, unusually low payments, contacting cast references, sending recordings, personal cell handling, invented package details, or exceptions outside the sales process.",
        "When giving multiple points, use simple markdown numbered or bulleted lists with each item on its own line. Do not return one long paragraph with inline numbering.",
      ].join("\n"),
    },
    {
      role: "user" as const,
      content: reportContext,
    },
    ...history.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  ];
}

function buildReportContext(call: PerformanceCall, transcriptText: string) {
  const closeSection = resolveCloseSection({
    whyNoClose: call.why_no_close,
    closeWorks: call.what_made_this_close_work,
  });
  const lines = [
    "Opened coaching report context:",
    fieldLine("Report type", "official coaching report"),
    fieldLine("Report ID", String(call.id)),
    fieldLine("Rep", call.rep_name),
    fieldLine("Client", call.client_name),
    fieldLine("Meeting title", call.meeting_title),
    fieldLine("Call date", call.call_date),
    fieldLine("Call status", call.call_status),
    "",
    "Visible coaching report fields:",
    fieldLine("Verdict", call.one_line_verdict),
    fieldLine("Biggest Strength", call.biggest_strength),
    fieldLine("What I'd Polish", call.biggest_fix),
    fieldLine("Coaching Tip", call.coaching_tip),
    fieldLine("Rudy's Note", call.rudys_note),
    fieldLine("What Went Well", call.what_went_well),
    fieldLine("What To Improve", call.what_to_improve),
    fieldLine(
      closeSection.type === "what_made_this_close_work"
        ? "What Made This Close Work"
        : "Why No Close",
      closeSection.value,
    ),
    fieldLine("Objections Surfaced", call.objections_surfaced),
    "",
    "Mandatory transcript text:",
    transcriptText,
  ];

  return lines.filter((line) => line !== null).join("\n");
}

function buildManualReportContext(report: ManualFeedbackReport, transcriptText: string) {
  const closeSection = resolveCloseSection({
    whyNoClose: report.why_no_close,
    closeWorks: report.what_made_this_close_work,
  });
  const lines = [
    "Opened coaching report context:",
    fieldLine("Report type", "self-submitted coaching report"),
    fieldLine("Report ID", report.public_id),
    fieldLine("Rep", report.rep_name),
    fieldLine("Client", report.client_name),
    fieldLine("Call status", report.call_status),
    fieldLine("Report status", report.status),
    "",
    "Visible coaching report fields:",
    fieldLine("Verdict", report.one_line_verdict),
    fieldLine("Biggest Strength", report.biggest_strength),
    fieldLine("What I'd Polish", report.biggest_fix),
    fieldLine("Coaching Tip", report.coaching_tip),
    fieldLine("Rudy's Note", report.rudys_note),
    fieldLine("What Went Well", report.what_went_well),
    fieldLine("What To Improve", report.what_to_improve),
    fieldLine(
      closeSection.type === "what_made_this_close_work"
        ? "What Made This Close Work"
        : "Why No Close",
      closeSection.value,
    ),
    fieldLine("Objections Surfaced", report.objections_surfaced),
    "",
    "Mandatory transcript text:",
    transcriptText,
  ];

  return lines.filter((line) => line !== null).join("\n");
}

function fieldLine(label: string, value: unknown) {
  const text = formatValue(value);
  return text ? `${label}: ${text}` : null;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.filter(Boolean).join("; ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value).trim();
}

function extractTranscriptFromPayload(payload: JsonObject | null | undefined) {
  if (!payload) return null;

  for (const key of TRANSCRIPT_KEYS) {
    const transcript = cleanTranscriptText(readNestedString(payload, key));
    if (isUsableTranscript(transcript)) return transcript;
  }

  return findTranscriptString(payload);
}

function readNestedString(value: unknown, key: string): string {
  if (!value || typeof value !== "object") return "";
  if (Object.prototype.hasOwnProperty.call(value, key)) {
    const found = (value as Record<string, unknown>)[key];
    return typeof found === "string" ? found : "";
  }

  for (const entry of Object.values(value)) {
    const nested = readNestedString(entry, key);
    if (nested) return nested;
  }

  return "";
}

function findTranscriptString(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;

  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") {
      const normalizedKey = key.toLowerCase();
      const looksLikeTranscriptField =
        normalizedKey.includes("transcript") &&
        !normalizedKey.includes("link") &&
        !normalizedKey.includes("url") &&
        !normalizedKey.includes("id");
      const transcript = cleanTranscriptText(entry);

      if (looksLikeTranscriptField && isUsableTranscript(transcript)) return transcript;
    }

    const nested = findTranscriptString(entry);
    if (nested) return nested;
  }

  return null;
}

function isUsableTranscript(value: string) {
  return value.length >= 80 && !/^https?:\/\//i.test(value);
}

function extractGoogleDocId(value: string | null) {
  const text = String(value || "").trim();
  if (!text) return null;

  const patterns = [
    /\/document\/d\/([a-zA-Z0-9_-]+)/,
    /\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }

  return /^[a-zA-Z0-9_-]{20,}$/.test(text) ? text : null;
}

function cleanTranscriptText(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getManualFeedbackReport, getPerformanceCall } from "@/lib/db";
import { resolveManualReportStatus } from "@/lib/manual-reports";
import {
  buildManualReportChatMessages,
  buildReportChatMessages,
  fetchManualTranscriptText,
  fetchTranscriptText,
  isReportChatEnabledForCall,
  isReportChatEnabledForManualReport,
  REPORT_CHAT_MODEL,
} from "@/lib/report-chat";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  reportType: z.enum(["official", "manual"]).default("official"),
  reportId: z.union([z.string(), z.number()]),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .min(1),
});

type DeepSeekResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

export async function POST(request: NextRequest) {
  let payload: z.infer<typeof requestSchema>;

  try {
    payload = requestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid chat request." }, { status: 400 });
  }

  const messages = payload.messages
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }))
    .filter((message) => message.content);

  const lastMessage = messages.at(-1);
  if (!lastMessage || lastMessage.role !== "user") {
    return NextResponse.json({ error: "Send a question before asking Magic Mike." }, { status: 400 });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Report chat is not configured yet." }, { status: 500 });
  }

  const reportContext = await resolveReportContext(payload.reportType, String(payload.reportId), messages);
  if ("response" in reportContext) return reportContext.response;

  const deepSeekResponse = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: REPORT_CHAT_MODEL,
      temperature: 0.2,
      max_tokens: 1200,
      messages: reportContext.messages,
    }),
  });

  let data: DeepSeekResponse | null = null;
  try {
    data = (await deepSeekResponse.json()) as DeepSeekResponse;
  } catch {
    data = null;
  }

  if (!deepSeekResponse.ok) {
    return NextResponse.json(
      { error: data?.error?.message || "Magic Mike could not answer right now." },
      { status: 502 },
    );
  }

  const answer = data?.choices?.[0]?.message?.content?.trim();
  if (!answer) {
    return NextResponse.json({ error: "Magic Mike returned an empty answer." }, { status: 502 });
  }

  return NextResponse.json({
    answer,
    model: REPORT_CHAT_MODEL,
  });
}

async function resolveReportContext(
  reportType: "official" | "manual",
  reportId: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
) {
  if (reportType === "manual") {
    const report = await getManualFeedbackReport(reportId);
    if (!report) {
      return { response: NextResponse.json({ error: "Report not found." }, { status: 404 }) };
    }

    const resolvedReport = resolveManualReportStatus(report);
    if (!isReportChatEnabledForManualReport(resolvedReport)) {
      return { response: NextResponse.json({ error: "Report chat is not enabled for this report." }, { status: 403 }) };
    }

    try {
      const transcript = await fetchManualTranscriptText(resolvedReport);
      return {
        messages: buildManualReportChatMessages(resolvedReport, transcript.text, messages),
      };
    } catch {
      return {
        response: NextResponse.json(
          { error: "Magic Mike could not load the transcript for this report." },
          { status: 400 },
        ),
      };
    }
  }

  const call = await getPerformanceCall(reportId);
  if (!call) {
    return { response: NextResponse.json({ error: "Report not found." }, { status: 404 }) };
  }

  if (!isReportChatEnabledForCall(call)) {
    return { response: NextResponse.json({ error: "Report chat is not enabled for this report." }, { status: 403 }) };
  }

  try {
    const transcript = await fetchTranscriptText(call);
    return {
      messages: buildReportChatMessages(call, transcript.text, messages),
    };
  } catch {
    return {
      response: NextResponse.json(
        { error: "Magic Mike could not load the transcript for this report." },
        { status: 400 },
      ),
    };
  }
}

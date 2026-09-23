import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getManualFeedbackReport, getPerformanceCall } from "@/lib/db";
import { resolveManualReportStatus } from "@/lib/manual-reports";
import {
  buildManualReportChatMessages,
  buildReportChatMessages,
  fetchManualTranscriptText,
  fetchTranscriptText,
  isReportChatEnabledForCall,
  isReportChatEnabledForManualReport,
  COACHING_REPORT_CHAT_MODEL,
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

type OpenAIResponse = {
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
};

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in to ask Magic Mike about this report." }, { status: 401 });
  }

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

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Report chat is not configured yet." }, { status: 500 });
  }

  const reportContext = await resolveReportContext(payload.reportType, String(payload.reportId), messages);
  if ("response" in reportContext) return reportContext.response;

  let modelResponse: Response;
  try {
    modelResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: COACHING_REPORT_CHAT_MODEL,
        input: reportContext.messages,
        reasoning: { effort: "none" },
        max_output_tokens: 1200,
        store: false,
      }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch {
    return NextResponse.json({ error: "Magic Mike could not connect right now. Please try again." }, { status: 502 });
  }

  let data: OpenAIResponse | null = null;
  try {
    data = (await modelResponse.json()) as OpenAIResponse;
  } catch {
    data = null;
  }

  if (!modelResponse.ok) {
    return NextResponse.json(
      { error: "Magic Mike could not answer right now. Please try again." },
      { status: 502 },
    );
  }

  const answer = data?.output
    ?.filter((item) => item.type === "message")
    .flatMap((item) => item.content || [])
    .filter((part) => part.type === "output_text")
    .map((part) => part.text || "")
    .join("\n")
    .trim();
  if (!answer) {
    return NextResponse.json({ error: "Magic Mike returned an empty answer." }, { status: 502 });
  }

  return NextResponse.json({
    answer,
    model: COACHING_REPORT_CHAT_MODEL,
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

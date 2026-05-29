import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  buildSalesAnalyticsChatMessages,
  type SalesAnalyticsChatMessage,
} from "@/lib/sales-analytics-chat";
import { getSalesCorrelationAnalytics, normalizeSalesCorrelationWindow } from "@/lib/sales-correlation";
import { REPORT_CHAT_MODEL } from "@/lib/report-chat";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  periodDays: z.union([z.string(), z.number()]).optional(),
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
    return NextResponse.json({ error: "Invalid analytics chat request." }, { status: 400 });
  }

  const messages = payload.messages
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }))
    .filter((message) => message.content)
    .slice(-8) as SalesAnalyticsChatMessage[];

  const lastMessage = messages.at(-1);
  if (!lastMessage || lastMessage.role !== "user") {
    return NextResponse.json({ error: "Send a question before asking Magic Mike." }, { status: 400 });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Sales analytics chat is not configured yet." }, { status: 500 });
  }

  const periodDays = normalizeSalesCorrelationWindow(String(payload.periodDays || ""));
  const analytics = await getSalesCorrelationAnalytics(periodDays);
  const chatMessages = buildSalesAnalyticsChatMessages(analytics, messages);

  const deepSeekResponse = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: REPORT_CHAT_MODEL,
      temperature: 0.15,
      max_tokens: 900,
      messages: chatMessages,
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

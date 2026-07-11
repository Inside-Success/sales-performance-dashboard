import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { AskSalesFaqChatMessage } from "@/lib/ask-sales-faq/types";
import { runAskSalesFaqV3 } from "@/lib/ask-sales-faq/v3/runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const requestSchema = z.object({
  name: z.string().trim().max(160).optional(),
  promptCount: z.number().int().min(1).max(80).optional(),
  limit: z.number().int().min(1).max(80).optional(),
  conversations: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(80),
        title: z.string().trim().min(1).max(160),
        prompts: z.array(z.string().trim().min(1).max(12000)).min(1).max(12),
      }),
    )
    .min(1)
    .max(8),
});

export async function POST(request: NextRequest) {
  // This endpoint is intentionally invisible in normal production. It is only
  // enabled on an isolated deployment that supplies both V3 and a one-time
  // benchmark flag. Vercel deployment protection remains the authentication
  // layer. It bypasses app auth/usage guards but performs no DB write.
  if (
    process.env.ASK_SALES_FAQ_RUNTIME_VERSION !== "v3" ||
    process.env.ASK_SALES_FAQ_BENCHMARK_ENABLED !== "true" ||
    request.headers.get("x-ask-sales-benchmark") !== "v3-isolated"
  ) {
    return new NextResponse(null, { status: 404 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid benchmark payload." }, { status: 400 });
  }

  let remaining = parsed.data.limit || parsed.data.promptCount || 80;
  const selected = parsed.data.conversations.map((conversation) => {
    const prompts = conversation.prompts.slice(0, Math.max(0, remaining));
    remaining -= prompts.length;
    return { ...conversation, prompts };
  }).filter((conversation) => conversation.prompts.length);
  const startedAt = Date.now();

  const conversations = await Promise.all(
    selected.map(async (conversation) => {
      const messages: AskSalesFaqChatMessage[] = [];
      const items = [];
      for (let index = 0; index < conversation.prompts.length; index += 1) {
        const question = conversation.prompts[index];
        const result = await runAskSalesFaqV3(question, [...messages, { role: "user", content: question }]);
        items.push({
          promptIndex: index + 1,
          question,
          answer: result.answer,
          structuredAnswer: result.structuredAnswer,
          outcome: result.outcome,
          needsRoute: result.needsRoute,
          routeReason: result.routeReason,
          provider: result.provider,
          model: result.model,
          latencyMs: result.latencyMs,
          source: result.source,
          errorClass: result.errorClass,
          runtimeMetadata: result.runtimeMetadata,
        });
        messages.push({ role: "user", content: question }, { role: "assistant", content: result.answer });
        if (messages.length > 10) messages.splice(0, messages.length - 10);
      }
      return { id: conversation.id, title: conversation.title, items };
    }),
  );

  const items = conversations.flatMap((conversation) => conversation.items);
  return NextResponse.json({
    ok: true,
    name: parsed.data.name || "Ask Sales FAQ V3 benchmark",
    durationMs: Date.now() - startedAt,
    promptCount: items.length,
    conversations,
  });
}

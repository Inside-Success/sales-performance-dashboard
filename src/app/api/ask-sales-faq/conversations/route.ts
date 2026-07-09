import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAskSalesFaqAccess } from "@/lib/ask-sales-faq/access";
import { decodeAskSalesFaqConversationCursor } from "@/lib/ask-sales-faq/conversation-history";
import { getAskSalesFaqConversations } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await auth();
  const access = getAskSalesFaqAccess(session);

  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.message, code: access.code }, { status: access.status });
  }

  try {
    const url = new URL(request.url);
    const rawCursor = url.searchParams.get("cursor");
    const cursor = decodeAskSalesFaqConversationCursor(rawCursor);
    if (rawCursor && !cursor) {
      return NextResponse.json({ ok: false, error: "Invalid conversation cursor." }, { status: 400 });
    }
    const query = String(url.searchParams.get("q") || "").replace(/\s+/g, " ").trim().slice(0, 120);
    const page = await getAskSalesFaqConversations(access.viewerEmail, {
      limit: 20,
      cursor,
      query,
    });
    return NextResponse.json({ ok: true, ...page });
  } catch (error) {
    console.error("Ask Sales FAQ conversation history failed", error);
    return NextResponse.json({ ok: true, conversations: [], nextCursor: null });
  }
}

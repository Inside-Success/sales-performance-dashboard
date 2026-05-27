import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hasDatabase, recordUsageEvent } from "@/lib/db";
import { USAGE_EVENT_NAMES } from "@/lib/usage-events";

export const runtime = "nodejs";

const usageEventSchema = z.object({
  event_name: z.enum(USAGE_EVENT_NAMES),
  source: z.string().max(80).optional().nullable(),
  target_rep_slug: z.string().max(160).optional().nullable(),
  target_rep_name: z.string().max(200).optional().nullable(),
  report_id: z.coerce.number().int().positive().optional().nullable(),
  manual_public_id: z.string().max(200).optional().nullable(),
  anonymous_session_id: z.string().max(120).optional().nullable(),
  path: z.string().max(500).optional().nullable(),
  referrer: z.string().max(500).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

export async function POST(request: NextRequest) {
  if (!hasDatabase()) {
    return NextResponse.json({ ok: true, disabled: true });
  }

  try {
    const body = usageEventSchema.parse(await request.json());

    await recordUsageEvent({
      ...body,
      user_agent: request.headers.get("user-agent") || null,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false }, { status: 202 });
  }
}

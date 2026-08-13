import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { acquireV7Run, completeV7Run, failV7Run, getV7Run, markV7RunDispatched } from "@/lib/rep-scoring/v7-run-lock";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action || "");
    const runKey = String(body.runKey || "");
    if (action === "status") return NextResponse.json({ ok: true, run: await getV7Run(runKey) });
    if (action === "acquire") {
      const result = await acquireV7Run({ runKey, scorerVersion: String(body.scorerVersion || ""), boundaryStart: String(body.boundaryStart || ""), targetCalls: Number(body.targetCalls) });
      return NextResponse.json({ ok: true, ...result }, { status: result.acquired ? 201 : 409 });
    }
    const token = String(body.token || "");
    if (action === "dispatched") return NextResponse.json({ ok: true, run: await markV7RunDispatched(runKey, token, Number(body.selectedCalls), Number(body.workerBatches)) });
    if (action === "progress") return NextResponse.json({ ok: true, run: await completeV7Run(runKey, token, { finalizedCalls: Number(body.finalizedCalls), scoredCalls: Number(body.scoredCalls), fairExclusions: Number(body.fairExclusions) }) });
    if (action === "fail") return NextResponse.json({ ok: true, run: await failV7Run(runKey, token, String(body.reason || "Unspecified pre-dispatch failure")) });
    return NextResponse.json({ ok: false, error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Run control failed" }, { status: 400 });
  }
}

function authorized(request: NextRequest) {
  const expected = process.env.INGEST_SECRET || "";
  const received = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!expected || !received) return false;
  const expectedBytes = Buffer.from(expected);
  const receivedBytes = Buffer.from(received);
  return expectedBytes.length === receivedBytes.length && timingSafeEqual(expectedBytes, receivedBytes);
}

import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { backfillProgress, claimBackfill, completeBackfill, failBackfillExecution } from "@/lib/rep-scoring/september-backfill";
export const runtime="nodejs";
export const maxDuration=60;
export async function POST(request: NextRequest) {
  const expected=Buffer.from(process.env.INGEST_SECRET || "");
  const received=Buffer.from((request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim());
  if(!expected.length || expected.length!==received.length || !timingSafeEqual(expected,received)) return NextResponse.json({ok:false},{status:401});
  try {
    const body=await request.json();
    if(body.action==="status") return NextResponse.json({ok:true,run:await backfillProgress()});
    if(body.action==="failure") return NextResponse.json(await failBackfillExecution(String(body.executionId || "")));
    if(body.action==="claim") return NextResponse.json(await claimBackfill(String(body.executionId || "")));
    if(body.action==="complete") return NextResponse.json(await completeBackfill(body));
    return NextResponse.json({ok:false},{status:400});
  } catch(error) {
    console.error("September backfill operation failed",error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ok:false,error:"Operation failed; saved execution must be reconciled before rerunning AI"},{status:500});
  }
}

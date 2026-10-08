import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prepareSalesSync } from "@/lib/sales-correlation";
import { saveSalesPerformanceSnapshot } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_PAYLOAD_BYTES = 4_000_000;

export async function POST(request: Request) {
  const secret = process.env.SALES_PERFORMANCE_SYNC_SECRET;
  if (!secret) return NextResponse.json({ error: "Sync unavailable" }, { status: 503 });
  const supplied = request.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;
  const suppliedBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(expected);
  if (suppliedBytes.length !== expectedBytes.length || !timingSafeEqual(suppliedBytes, expectedBytes)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (Number(request.headers.get("content-length")) > MAX_PAYLOAD_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }
  let snapshotInput;
  try {
    const text = await request.text();
    if (Buffer.byteLength(text) > MAX_PAYLOAD_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }
    snapshotInput = prepareSalesSync(JSON.parse(text));
  } catch {
    return NextResponse.json({ error: "Invalid sales read; previous data preserved" }, { status: 400 });
  }
  const saved = await saveSalesPerformanceSnapshot(snapshotInput);
  if (!saved) return NextResponse.json({ error: "Sales snapshot could not be saved" }, { status: 503 });
  return NextResponse.json({
    ok: true,
    snapshotId: saved.id,
    refreshedAt: saved.created_at,
    rowCount: saved.row_count,
    paidRowCount: saved.paid_row_count,
    newPaidRowCount: saved.new_paid_row_count,
    latestSalesDate: saved.latest_sales_date,
  });
}

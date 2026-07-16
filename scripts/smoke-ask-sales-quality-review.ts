import {
  getAskSalesQualityReviewOverview,
  getPendingAskSalesQualityAuditPackets,
} from "@/lib/ask-sales-faq/quality-review-store";

const packets = await getPendingAskSalesQualityAuditPackets(100);
const overview = await getAskSalesQualityReviewOverview();
const packetShapeSafe = packets.every((packet) =>
  packet.messageId &&
  packet.question &&
  packet.answer &&
  !Object.hasOwn(packet, "viewerEmail"),
);

console.log(JSON.stringify({
  ok: packetShapeSafe,
  pendingPackets: packets.length,
  storedCases: overview.summary.total,
  auditStart: overview.auditStart,
  packetShapeSafe,
}));

if (!packetShapeSafe) process.exit(1);

// Shared source-level retry policy. Business-write uncertainty must remain held.
export function retryable(message) {
  if (/\b401\b|\b403\b|\brefusal\b|invalid source/i.test(message)) return false;
  return /timeout|timed out|aborted|524|429|50[0234]|529|overload|rate.?limit|temporar|ECONNRESET|ETIMEDOUT|EAI_AGAIN|fetch failed|socket|connection.*closed|empty response|JSON parse|invalid structured|checkpoint (deferred|unavailable)/i.test(message);
}
export function queueFailure(sourceId, executionId, message, attempt=0, now=Date.now()) {
  if (!/^rec[A-Za-z0-9]+$/.test(sourceId)) throw Error("Invalid recovery source");
  const eligible=retryable(message);
  const delay=attempt>=3?86400000:[300000,900000,3600000][Math.max(0,attempt)];
  return {source_id:sourceId,execution_id:String(executionId),updated_at:new Date(now).toISOString(),report_id:"",
    status:eligible?"queued":"needs_review",attempts:attempt,
    message:(eligible?`retry_at=${new Date(now+delay).toISOString()} | `:"")+String(message).slice(0,900)};
}
export function dueCalls(rows, now=Date.now()) {
  return rows.filter(r=>r.status==="queued" && /^rec[A-Za-z0-9]+$/.test(r.source_id||""))
    .filter(r=>{const match=String(r.message||"").match(/^retry_at=([^ |]+)/);return !match || Date.parse(match[1])<=now;})
    .sort((a,b)=>Date.parse(a.updated_at)-Date.parse(b.updated_at)).slice(0,1);
}

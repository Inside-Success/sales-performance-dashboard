// Shared source-level retry policy. Business-write uncertainty must remain held.
import { failureDecision } from '../../src/lib/coaching-reliability-policy.mjs';
export function retryable(message) {
  return failureDecision(message).retryable;
}
export function queueFailure(sourceId, executionId, message, attempt=0, now=Date.now(), checkpoints=[]) {
  if (!/^rec[A-Za-z0-9]+$/.test(sourceId)) throw Error("Invalid recovery source");
  const decision=failureDecision(message,checkpoints,attempt,now);
  const eligible=decision.retryable;
  const delay=attempt>=3?86400000:[300000,900000,3600000][Math.max(0,attempt)];
  return {source_id:sourceId,execution_id:String(executionId),updated_at:new Date(now).toISOString(),report_id:"",
    status:eligible?"queued":"needs_review",attempts:attempt,
    message:(eligible?`retry_at=${new Date(Math.max(now+delay,decision.retryAt||0)).toISOString()} | `:"")+`kind=${decision.kind}${decision.stage?' stage='+decision.stage:''} | `+String(message).slice(0,850)};
}
export function dueCalls(rows, now=Date.now()) {
  return rows.filter(r=>r.status==="queued" && /^rec[A-Za-z0-9]+$/.test(r.source_id||""))
    .filter(r=>{const match=String(r.message||"").match(/^retry_at=([^ |]+)/);return !match || Date.parse(match[1])<=now;})
    .sort((a,b)=>Date.parse(a.updated_at)-Date.parse(b.updated_at)).slice(0,1);
}

import assert from "node:assert/strict";
import {queueFailure,dueCalls} from "./recovery-retry-policy.mjs";
const now=Date.parse("2026-10-15T16:00:00Z");
for(let attempt=0;attempt<6;attempt++) {
  const row=queueFailure("recTest","123","safety_screen: 524 timeout",attempt,now);
  assert.equal(row.status,"queued");assert.equal(row.attempts,attempt);
  assert.equal(dueCalls([row],now).length,0);
  assert.equal(dueCalls([row],now+86400001).length,1);
}
assert.equal(queueFailure("recTest","123","Report write detected; delivery uncertain",1,now).status,"needs_review");
assert.equal(queueFailure("recTest","123","401 Unauthorized",1,now).status,"needs_review");
assert.equal(dueCalls([{source_id:"recA",status:"completed",updated_at:new Date(now).toISOString()}],now).length,0);
assert.equal(dueCalls(["A","B"].map(x=>({source_id:"rec"+x,status:"queued",updated_at:new Date(now).toISOString()})),now).length,1);
console.log("Retry policy: six attempts remain durable, delayed retries, uncertain-write hold, auth hold and one-at-a-time selection passed.");

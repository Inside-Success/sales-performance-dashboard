// Shared deterministic recovery guards. Embedded in n8n Code nodes by the builder.
export const REVISION = 'unreviewed-draft-2026-10-09';
export function outputs(rd, name) {
  return (rd[name] || []).flatMap(run => (run.data?.main?.[0] || []).map(item => item.json).filter(Boolean));
}
export function selectFailures(lists, receipts) {
  if (lists.some(list => !Array.isArray(list.data))) throw Error('Invalid executions list');
  const seen = new Set(receipts.map(row => row.event_key));
  return [...new Map(lists.flatMap(list => list.data).map(e => [String(e.id), e])).values()]
    .filter(e => ['error', 'crashed'].includes(e.status) && e.startedAt >= '2026-09-16T00:00:00Z' && !seen.has('scan:' + e.id))
    .sort((a,b) => a.startedAt.localeCompare(b.startedAt)).slice(0,5);
}
export function makeDraft(prepared, generated, executionId) {
  const id = prepared?.state?.caseItem?.case_id;
  if (!/^rec[A-Za-z0-9]+$/.test(id || '') || generated?.ok !== true || !generated.parsed_json || generated.parse_error ||
      generated.request_id !== prepared?.provider_request?.request_id || generated.case_id !== id) return null;
  return {source_id:id, revision:REVISION, payload:JSON.stringify({source_id:id, execution_id:String(executionId),
    request:prepared.provider_request, generated})};
}
export function validateDraft(row, prepared, sourceId) {
  // An unreviewed draft always goes through the existing factual audit. A stale/mismatched
  // draft falls back to the current writer; it must never bypass review or block a call.
  if (row?.revision !== REVISION || row.source_id !== sourceId) return null;
  try {
    const saved=JSON.parse(row.payload);
    if (saved.source_id !== sourceId || prepared.state.caseItem.case_id !== sourceId ||
        JSON.stringify(saved.request) !== JSON.stringify(prepared.provider_request) ||
        !makeDraft(prepared,saved.generated,saved.execution_id)) return null;
    return saved.generated;
  } catch { return null; }
}
export function planMissing(e, receipts, now = new Date().toISOString()) {
  if (e.workflowId !== 'L8Nn7xncA9ZPDdWA' || !['error','crashed'].includes(e.status)) throw Error('Unexpected failed execution');
  const rd=e.data?.resultData?.runData || {};
  const seen=new Set(receipts.map(r=>r.source_id));
  const writes=outputs(rd,'Create a record').filter(r=>r.id);
  const written=new Set(writes.map(r=>r.fields?.source_airtable_record_id || r.source_airtable_record_id).filter(Boolean));
  const ambiguousWrites=writes.some(r=>!(r.fields?.source_airtable_record_id || r.source_airtable_record_id));
  const prepared=outputs(rd,'MM Build Coaching Request');
  const generated=outputs(rd,'MM Coaching Provider');
  const ids=new Set(); const out=[];
  for (const row of outputs(rd,'Normalize Airtable Row')) {
    const id=row['Source Airtable Record ID'];
    if (!/^rec[A-Za-z0-9]+$/.test(id||'') || row['Call #']==='Call 1' || seen.has(id) || ids.has(id)) continue;
    ids.add(id);
    const held=ambiguousWrites || written.has(id);
    const p=prepared.find(p=>p.state?.caseItem?.case_id===id);
    const matches=generated.filter(g=>g.request_id===p?.provider_request?.request_id && g.case_id===id);
    const draft=matches.length===1?makeDraft(p,matches[0],e.id):null;
    out.push({source_id:id,status:held?'needs_review':'queued',execution_id:String(e.id),
      message:held?'Report write detected; inspect partial delivery before retry.':`Execution ${e.status}; queued once against source and delivery receipts.`,
      attempts:0,report_id:'',updated_at:now,draft:held?null:draft});
  }
  return out;
}
export function staleClaims(rows, now=Date.now()) {
  return rows.filter(r=>r.status==='processing' && /^\d+$/.test(String(r.execution_id)) &&
    Number.isFinite(Date.parse(r.updated_at)) && now-Date.parse(r.updated_at)>25*60*1000)
    .sort((a,b)=>Date.parse(a.updated_at)-Date.parse(b.updated_at)).slice(0,1);
}
export function canHoldClaim(row, execution) {
  return row.status==='processing' && String(execution.id)===String(row.execution_id) &&
    execution.workflowId==='Zx3S5B1gYHRrbv2F' && ['crashed','error','success','canceled'].includes(execution.status);
}

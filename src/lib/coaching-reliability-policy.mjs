// Pure shared policy: embedded unchanged into n8n by the release builder.
export const CONTRACT_REVISION = 'coaching-contract-2026-10-18';
export function coachingStage(stage) {
  return ['call2_sonnet5_writer', 'call2_coaching_targeted_repair'].includes(stage);
}
export function normalizeCoaching(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  if (!Array.isArray(value.strengths)) return value;
  return {...value, strengths:value.strengths.map(row => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return row;
    // Known historical alias only. Never synthesize text or replace an observation.
    if (row.observation == null && typeof row.action === 'string' && row.action.trim()) {
      const {action, ...rest}=row;
      return {...rest, observation:action};
    }
    return row;
  })};
}
export function coachingContractErrors(value) {
  const errors=[];
  const text=v=>typeof v==='string' && Boolean(v.trim());
  const refs=v=>Array.isArray(v) && v.every(x=>typeof x==='string');
  if (!value || typeof value!=='object' || Array.isArray(value)) return ['missing structured coaching'];
  if (value.status==='refused') {
    if (!['call_1','prospect_no_show','rep_no_show','transcript_too_short','internal_training'].includes(value.call_status) || !text(value.refusal_reason)) errors.push('invalid exclusion');
    return errors;
  }
  if (value.status!=='completed' || value.call_status!=='scored') errors.push('invalid coaching status');
  if (!['confirmed','not_confirmed','unclear'].includes(value.outcome?.payment) || !text(value.outcome?.summary) || !refs(value.outcome?.evidence_ids) || !value.outcome.evidence_ids.length) errors.push('invalid outcome');
  for (const name of ['payment_actions','strengths','improvements','blockers','next_steps']) {
    if (!Array.isArray(value[name])) {errors.push('missing '+name);continue;}
    for (const row of value[name]) {
      if (!row || typeof row!=='object' || !text(row[name==='payment_actions'?'action':'observation']) || !refs(row.evidence_ids) || !row.evidence_ids.length) {errors.push('invalid '+name+' row');continue;}
      if (name==='improvements' && (!['material','optional'].includes(row.priority) || !text(row.possible_effect) || !text(row.better_action) || !text(row.counterevidence_summary) || !refs(row.counterevidence_ids))) errors.push('invalid improvement details');
    }
  }
  return [...new Set(errors)];
}
export function failureDecision(message, checkpoints=[], attempt=0, now=Date.now()) {
  const raw=String(message || 'Unknown coaching failure');
  const msg=(raw.split(/\|\s*Error:\s*/).pop() || raw).split(/\|\s*(?:Transcript chars|Meeting ID|Source Record|Execution ID):/)[0].trim();
  const httpCode=msg.match(/(?:^|\bHTTP\s+|\bstatus(?:Code)?\s*[:=]\s*)(401|403|429|500|502|503|504|524|529)\b/i)?.[1];
  // Prefer the original typed cause. Never search transcript/meeting numbers for HTTP codes.
  if (['401','403'].includes(httpCode) || /\brefusal\b|invalid source|source mismatch|ownership changed|uncertain|partial delivery|report write detected/i.test(msg)) return {kind:'safety_hold',retryable:false};
  const incomplete=checkpoints.filter(c=>['running','failed'].includes(c.status)).sort((a,b)=>Date.parse(b.updated_at)-Date.parse(a.updated_at))[0];
  if (/Error executing workflow|checkpoint deferred|task request timed out/i.test(msg) && incomplete) {
    if (incomplete.status==='running') return {kind:'checkpoint_incomplete',stage:incomplete.stage,retryable:true,retryAt:Math.max(now+60000,Date.parse(incomplete.lease_until)||now+300000)};
    const cause=failureDecision(incomplete.last_error,[],attempt,now);
    return {...cause,stage:incomplete.stage,retryAt:Math.max(now+60000,Date.parse(incomplete.next_attempt_at)||now+300000)};
  }
  if (/invalid coaching contract|Missing strength|draft remains invalid|Invalid transcript evidence|Invalid coaching audit|Incomplete improvement audit|Conflicting improvement audit|Incomplete factual audit|Invalid audited outcome/i.test(msg)) return {kind:'content_contract',retryable:attempt<2};
  if (['429','500','502','503','504','524','529'].includes(httpCode) || /timeout|timed out|aborted|overload|rate.?limit|temporar|ECONNRESET|ETIMEDOUT|EAI_AGAIN|fetch failed|socket|connection.*closed|empty response|JSON parse|invalid structured|checkpoint (deferred|unavailable)/i.test(msg)) return {kind:'transient',retryable:true};
  return {kind:'unknown',retryable:false};
}
export function coveragePlan(scan, receipts) {
  if(scan.status!=='ready' || !scan.token || !Array.isArray(scan.source_ids)) return null;
  const bySource=new Map(receipts.map(row=>[row.source_id,row]));
  const reported=new Set(scan.reported||[]);
  const delivered=new Set(scan.delivered_ids||[]);
  const missing=scan.source_ids.filter(id=>!delivered.has(id)&&bySource.get(id)?.status!=='excluded');
  // Queued/processing are unresolved, not success. Alert only when stale, or held for review.
  const attention=missing.filter(id=>{
    const row=bySource.get(id);
    return !row || !['queued','processing'].includes(row.status) || !row.updated_at || Date.now()-Date.parse(row.updated_at)>86400000;
  });
  return {token:scan.token,missing_ids:missing,notify:attention.filter(id=>!reported.has(id)),checked:scan.checked};
}

// Intake records these attendance-only outcomes as Processed/Call 2+ too.
// They do not require a coaching report. Never infer exclusions from prose.
export function coverageIntakeExclusion(reason) {
  const code=String(reason||'').match(/^([a-z_]+):/)?.[1];
  return ['sales_no_show','sales_rep_no_show','sales_too_short'].includes(code);
}

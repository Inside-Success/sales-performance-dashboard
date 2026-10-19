import {describe,it,expect} from 'vitest';
import {normalizeCoaching,coachingContractErrors,failureDecision,coveragePlan,coverageIntakeExclusion} from './coaching-reliability-policy.mjs';
const outcome={payment:'not_confirmed',summary:'No payment confirmed.',evidence_ids:['T1']};
const good=()=>({status:'completed',call_status:'scored',outcome,payment_actions:[],strengths:[{observation:'A supported observation',evidence_ids:['T1']}],improvements:[],blockers:[],next_steps:[]});
describe('saved coaching incident contracts',()=>{
  it('normalizes the observed action alias without changing text, evidence or the original',()=>{
    const row={...good(),strengths:[{action:'Exact saved wording',evidence_ids:['T1'],why_useful:'Exact effect'}]};
    const normalized=normalizeCoaching(row);
    expect(normalized.strengths[0]).toEqual({observation:'Exact saved wording',evidence_ids:['T1'],why_useful:'Exact effect'});
    expect(row.strengths[0]).toHaveProperty('action');expect(coachingContractErrors(normalized)).toEqual([]);
  });
  it('does not invent absent content, override existing observations or invent evidence',()=>{
    const row={...good(),strengths:[{observation:'Existing',action:'Other',evidence_ids:[]}]};
    expect(normalizeCoaching(row).strengths[0].observation).toBe('Existing');
    expect(coachingContractErrors(normalizeCoaching(row))).toContain('invalid strengths row');
    expect(coachingContractErrors({...good(),strengths:[{}]})).toContain('invalid strengths row');
  });
  it('allows genuinely empty improvements and strengths, preserves refusal routing',()=>{
    expect(coachingContractErrors({...good(),strengths:[]})).toEqual([]);
    expect(coachingContractErrors({status:'refused',call_status:'call_1',refusal_reason:'First call.'})).toEqual([]);
    expect(coachingContractErrors({status:'refused',call_status:'scored',refusal_reason:'Unknown'})).not.toEqual([]);
  });
  it('rejects bad outcome and incomplete improvement shapes',()=>{
    expect(coachingContractErrors({...good(),outcome:{...outcome,evidence_ids:[]}})).toContain('invalid outcome');
    expect(coachingContractErrors({...good(),improvements:[{observation:'Observation',evidence_ids:['T1']}]})).toContain('invalid improvement details');
  });
});
describe('incident retry causes',()=>{
  it.each([40503,50401,429,529,401,403])('ignores transcript length %s in decisions',n=>{
    const message=`AI grading pipeline failed | Execution ID: 123 | Error: Coaching draft remains invalid after one repair: Missing strength | Transcript chars: ${n} | Meeting ID: 503`;
    expect(failureDecision(message,[],2).kind).toBe('content_contract');
    expect(failureDecision(message,[],2).retryable).toBe(false);
  });
  it.each(['HTTP 503 Service Unavailable','429 - rate limited','Task request timed out','JSON parse failed','checkpoint unavailable'])('recognizes actual temporary cause %s',msg=>expect(failureDecision(msg).retryable).toBe(true));
  it.each(['HTTP 401 Unauthorized','403 - Forbidden','refusal','Report write detected; delivery uncertain','Source mismatch'])('holds unsafe retry %s',msg=>expect(failureDecision(msg).retryable).toBe(false));
  it('retains child stage and respects active leases, then retries an expired lease',()=>{
    const now=Date.parse('2026-10-18T14:10:00Z');
    const checkpoint={status:'running',stage:'call2_sonnet5_audit',updated_at:new Date(now).toISOString(),lease_until:new Date(now+150000).toISOString()};
    expect(failureDecision('Error executing workflow with item at index 0',[checkpoint],1,now)).toMatchObject({kind:'checkpoint_incomplete',stage:'call2_sonnet5_audit',retryable:true,retryAt:now+150000});
    expect(failureDecision('Error executing workflow with item at index 0',[checkpoint],1,now+200000).retryAt).toBe(now+260000);
  });
  it('uses a persisted child error but never treats an unknown error as permission to replay',()=>{
    expect(failureDecision('Error executing workflow with item at index 0',[{status:'failed',stage:'audit',last_error:'HTTP 503 Service Unavailable',updated_at:'2026-10-18',next_attempt_at:'2026-10-19'}],1).retryable).toBe(true);
    expect(failureDecision('Error executing workflow with item at index 0').retryable).toBe(false);
  });
});
describe('coverage outcomes are independent of n8n execution colour',()=>{
  it('flags absent receipts and false delivered receipts, not legitimate exclusions or queued work',()=>{
    const scan={status:'ready',token:'scan',source_ids:['recA','recB','recC','recD'],reported:[],checked:4};
    const plan=coveragePlan(scan,[{source_id:'recB',status:'excluded'},{source_id:'recC',status:'queued',updated_at:new Date().toISOString()},{source_id:'recD',status:'delivered'}]);
    expect(plan?.notify).toEqual(['recA','recD']);expect(plan?.missing_ids).toEqual(['recA','recC','recD']);
  });
  it('deduplicates alerts and rejects incomplete reads',()=>{
    expect(coveragePlan({status:'busy'},[])).toBe(null);
    expect(coveragePlan({status:'ready',token:'scan',source_ids:['recA'],reported:['recA']},[])?.notify).toEqual([]);
  });
});

describe('source intake exclusions',()=>{
  it('recognizes only exact existing no-report categories',()=>{
    for(const reason of ['sales_no_show: Waiting alone','sales_rep_no_show: Rep absent','sales_too_short: Two lines'])expect(coverageIntakeExclusion(reason)).toBe(true);
  });
  it('never excludes a real or disconnected call because its narrative mentions a no-show',()=>{
    for(const reason of ['valid_sales_call: Discussed a previous sales_no_show','sales_disconnected: Brief conversation','',null])expect(coverageIntakeExclusion(reason)).toBe(false);
  });
});

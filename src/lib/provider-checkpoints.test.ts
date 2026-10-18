import {beforeEach,describe,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({sql:vi.fn(),rejectOwner:false}));
vi.mock('@neondatabase/serverless',()=>({neon:()=>mocks.sql}));
import {providerCheckpoint} from './provider-checkpoints';
const token='b7b7aac3-0d5f-4f42-aa40-b875bd6689a4';
const identity={source_id:'recReal',stage:'call2_sonnet5_writer',provider:'anthropic' as const,request_hash:'a'.repeat(64),token};
const draft={status:'completed',call_status:'scored',outcome:{payment:'not_confirmed',summary:'Not paid',evidence_ids:['T1']},payment_actions:[],strengths:[],improvements:[],blockers:[],next_steps:[]};
beforeEach(()=>{
  vi.stubEnv('DATABASE_URL','isolated-test');mocks.rejectOwner=false;mocks.sql.mockReset();
  mocks.sql.mockImplementation(async(strings:TemplateStringsArray)=>{
    const q=strings.join('?');
    if(q.includes('returning checkpoint_key'))return mocks.rejectOwner?[]:[{checkpoint_key:'key'}];
    if(q.includes('select status,owner_token'))return [{status:'running',owner_token:'another-owner'}];
    return [];
  });
});
describe('provider storage preserves the bounded repair handoff',()=>{
  it('retains a parsed but invalid draft as failed so n8n can repair it without caching it as complete',async()=>{
    const result=await providerCheckpoint({action:'complete',...identity,result:{ok:true,parsed_json:{...draft,call_status:'transcript_too_short'},stop_reason:'end_turn'}});
    expect(result).toEqual({status:'rejected_contract',repair_required:true});
    const writes=mocks.sql.mock.calls.map(c=>(c[0] as TemplateStringsArray).join('?'));
    expect(writes.some(q=>q.includes("set status='failed',result="))).toBe(true);
    expect(writes.some(q=>q.includes("set status='completed'"))).toBe(false);
  });
  it('still completes valid drafts and refuses ownership changes for rejected drafts',async()=>{
    expect(await providerCheckpoint({action:'complete',...identity,result:{ok:true,parsed_json:draft,stop_reason:'end_turn'}})).toEqual({status:'completed'});
    mocks.rejectOwner=true;
    await expect(providerCheckpoint({action:'complete',...identity,result:{ok:true,parsed_json:{...draft,call_status:'transcript_too_short'}}})).rejects.toThrow('ownership changed');
  });
});

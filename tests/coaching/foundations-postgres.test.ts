import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
const state = vi.hoisted(()=>({db:null as PGlite | null}));
vi.mock('server-only',()=>({}));
vi.mock('@neondatabase/serverless',()=>({neon:()=>async(parts:TemplateStringsArray,...values:unknown[])=>{
 const query=parts.reduce((s,p,i)=>s+p+(i<values.length?'$'+(i+1):''),'');
 return (await state.db!.query(query,values)).rows;
}}));
import { providerCheckpoint } from '../../src/lib/provider-checkpoints';
let directory:string;
beforeAll(async()=>{directory=await mkdtemp(join(tmpdir(),'mm-isolated-pg-'));state.db=await PGlite.create(directory);vi.stubEnv('DATABASE_URL','isolated-engine-only');},30000);
afterAll(async()=>{await state.db?.close();await rm(directory,{recursive:true,force:true});vi.unstubAllEnvs();});
const identity=(source:string)=>({source_id:source,stage:'foundations_reviewer_v3',provider:'openai' as const,request_hash:'a'.repeat(64)});
const result={ok:true,provider_response_id:'saved-provider-receipt',request_id:'exact-request',stop_reason:'stop',parsed_json:{pass:true,findings:[],corrected_report:null}};
describe('real isolated PostgreSQL checkpoint persistence',()=>{
 it('grants one concurrent owner and refuses stale completion',async()=>{
  const id=identity('concurrent');
  const claims=await Promise.all(Array.from({length:8},()=>providerCheckpoint({action:'claim',...id})));
  const owners=claims.filter(x=>x.status==='acquired');expect(owners).toHaveLength(1);
  expect(claims.filter(x=>x.status==='deferred')).toHaveLength(7);
  await expect(providerCheckpoint({action:'complete',...id,token:randomUUID(),result})).rejects.toThrow('ownership changed');
  await providerCheckpoint({action:'complete',...id,token:owners[0].token!,result});
  await providerCheckpoint({action:'fail',...id,token:randomUUID(),error:'stale failure'});
  expect((await providerCheckpoint({action:'claim',...id})).status).toBe('cached');
 });
 it('preserves the exact cached response through a database restart',async()=>{
  await state.db!.close();state.db=await PGlite.create(directory);
  const cached=await providerCheckpoint({action:'claim',...identity('concurrent')});
  expect(cached.status).toBe('cached');expect(cached.result.provider_response_id).toBe(result.provider_response_id);
  expect((await providerCheckpoint({action:'claim',...identity('concurrent'),request_hash:'b'.repeat(64)})).status).toBe('acquired');
 });
 it('retains malformed paid output for repair and never caches it as completed',async()=>{
  const id=identity('malformed');const claim=await providerCheckpoint({action:'claim',...id});
  const rejected=await providerCheckpoint({action:'complete',...id,token:claim.token!,result:{...result,parsed_json:{pass:true,findings:[{issue:'contradiction'}],corrected_report:null}}});
  expect(rejected.status).toBe('rejected_contract');
  const rows=await state.db!.query<{status:string;result:{provider_response_id:string}}>('select status,result from coaching_provider_checkpoints where source_id=$1',['malformed']);
  expect(rows.rows[0].status).toBe('failed');expect(rows.rows[0].result.provider_response_id).toBe(result.provider_response_id);
 });
 it('does not let the old owner close a reacquired request',async()=>{
  const id=identity('expired');const old=await providerCheckpoint({action:'claim',...id});
  await state.db!.query("update coaching_provider_checkpoints set lease_until=now()-interval '1 minute' where source_id=$1",[id.source_id]);
  const next=await providerCheckpoint({action:'claim',...id});expect(next.status).toBe('acquired');expect(next.token).not.toBe(old.token);
  await expect(providerCheckpoint({action:'complete',...id,token:old.token!,result})).rejects.toThrow('ownership changed');
  await providerCheckpoint({action:'complete',...id,token:next.token!,result});
 });
});

it('resumes a terminal truncated safety receipt without another paid claim or treating it as approval',async()=>{
 const id={...identity('terminal-safety'),stage:'foundations_safety_v3',provider:'deepseek' as const};
 const claim=await providerCheckpoint({action:'claim',...id});
 const terminal={...result,stop_reason:'length',parsed_json:null,parse_error:'JSON parse failed',usage:{input_tokens:100,output_tokens:12000}};
 const saved=await providerCheckpoint({action:'complete',...id,token:claim.token!,result:terminal});
 expect(saved.status).toBe('repair_required');
 expect((await providerCheckpoint({action:'complete',...id,token:claim.token!,result:terminal})).status).toBe('repair_required');
 const resumed=await providerCheckpoint({action:'claim',...id});expect(resumed.status).toBe('repair_required');expect(resumed.result.provider_response_id).toBe(terminal.provider_response_id);
 const row=(await state.db!.query('select status,attempts from coaching_provider_checkpoints where source_id=$1',[id.source_id])).rows[0];expect(row).toMatchObject({status:'failed',attempts:1});
 await expect(providerCheckpoint({action:'complete',...id,token:randomUUID(),result:terminal})).rejects.toThrow('ownership changed');
 for(const [i,override] of [{provider_response_id:null},{stop_reason:'refusal'},{stop_reason:'error'},{usage:null},{ok:false}].entries()){
  const other={...id,source_id:'terminal-negative-'+i};const owner=await providerCheckpoint({action:'claim',...other});
  await expect(providerCheckpoint({action:'complete',...other,token:owner.token!,result:{...terminal,...override}})).rejects.toThrow('Invalid structured');
 }
});

it('replays the exact malformed writer receipt at zero new cost without reacquiring ownership',async()=>{
 const id={...identity('terminal-writer'),stage:'foundations_writer_v3',provider:'anthropic' as const};
 const claim=await providerCheckpoint({action:'claim',...id});
 const bad={...result,parsed_json:{version:'coaching-foundations-v3'},usage:{input_tokens:100,output_tokens:100},costs:{total_cost_usd:0.2}};
 expect((await providerCheckpoint({action:'complete',...id,token:claim.token!,result:bad})).status).toBe('rejected_contract');
 for(let i=0;i<2;i++){
  const replay=await providerCheckpoint({action:'claim',...id});expect(replay.status).toBe('repair_required');
  expect(replay.result.provider_response_id).toBe(bad.provider_response_id);expect(replay.result.costs.total_cost_usd).toBe(0);expect(replay.result.checkpoint_original_costs.total_cost_usd).toBe(0.2);
 }
 const rows=await state.db!.query<{status:string;attempts:number}>('select status,attempts from coaching_provider_checkpoints where source_id=$1',[id.source_id]);
 expect(rows.rows[0]).toEqual({status:'failed',attempts:1});
});

it('retains a truncated reviewer receipt and resumes it repeatedly without repurchase or approval',async()=>{
 const id=identity('terminal-reviewer'),claim=await providerCheckpoint({action:'claim',...id});
 const terminal={...result,ok:false,provider:'openai',stop_reason:'length',parsed_json:null,parse_error:'Invalid JSON object',usage:{input_tokens:100,output_tokens:12000},costs:{total_cost_usd:0.3}};
 expect((await providerCheckpoint({action:'complete',...id,token:claim.token!,result:terminal})).status).toBe('repair_required');
 for(let i=0;i<3;i++){const resumed=await providerCheckpoint({action:'claim',...id});expect(resumed.status).toBe('repair_required');expect(resumed.result.costs.total_cost_usd).toBe(0);expect(resumed.result.provider_response_id).toBe(terminal.provider_response_id);}
 expect((await state.db!.query('select status,attempts,last_error from coaching_provider_checkpoints where source_id=$1',[id.source_id])).rows[0]).toEqual({status:'failed',attempts:1,last_error:'Terminal reviewer response requires bounded repair'});
 await expect(providerCheckpoint({action:'complete',...id,token:randomUUID(),result:terminal})).rejects.toThrow('ownership changed');
});

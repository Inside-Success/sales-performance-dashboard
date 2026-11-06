import {describe,it,expect} from 'vitest';
import {createRequire} from 'node:module';
import {checkpointInput,validProviderResult} from '../../src/lib/provider-checkpoint-policy';
const require=createRequire(import.meta.url),{normalizeOpenAi,decodeOpenAi}=require('../../scripts/coaching-foundations/openai-provider.cjs');
const body={provider:'openai',request_id:'req',case_id:'recSource',call_purpose:'offline_transport_probe',model:'gpt-6.1-terra',max_tokens:12000,system:'policy',prompt:'source',pricing:{input_mtok:1,cache_read_mtok:.05,cache_write_mtok:1.25,output_mtok:5}};
const raw={id:'provider-receipt',model:body.model,usage:{prompt_tokens:100,completion_tokens:20,prompt_tokens_details:{cached_tokens:60}},choices:[{finish_reason:'stop',message:{content:'{"value":"reviewed elsewhere"}'}}]};
describe('offline OpenAI durable-provider adapter',()=>{
 it('accepts OpenAI in the existing exact-request checkpoint identity',()=>expect(checkpointInput.parse({action:'claim',source_id:'recSource',stage:'foundations_writer_v3',provider:'openai',request_hash:'a'.repeat(64)}).provider).toBe('openai'));
 it('preserves exact source/request identity and actual cached usage',()=>{
  const req=normalizeOpenAi(body),r=decodeOpenAi(raw,req);expect(r.request_id).toBe('req');expect(r.case_id).toBe('recSource');expect(r.provider_response_id).toBe(raw.id);expect(r.usage.input_tokens).toBe(40);expect(r.usage.cache_read_input_tokens).toBe(60);expect(r.costs.total_cost_usd).toBeCloseTo(.000143,9);expect(validProviderResult(r)).toBe(true);
 });
 it('does not turn missing receipts, truncation or refusals into reusable results',()=>{
  const req=normalizeOpenAi(body);for(const r of [{error:{message:'timeout'}},{...raw,usage:null},{...raw,choices:[{finish_reason:'length',message:{content:'{}'}}]},{...raw,choices:[{finish_reason:'stop',message:{refusal:'no',content:'{}'}}]}])expect(validProviderResult(decodeOpenAi(r,req))).toBe(false);
 });
 it('holds malformed output while preserving paid usage for reconciliation',()=>{
  const r=decodeOpenAi({...raw,choices:[{finish_reason:'stop',message:{content:'not JSON'}}]},normalizeOpenAi(body));expect(r.ok).toBe(false);expect(r.provider_response_id).toBe(raw.id);expect(r.costs.total_cost_usd).toBeGreaterThan(0);
 });
 it('holds malformed foundations payloads at the checkpoint boundary',()=>{const r=decodeOpenAi(raw,normalizeOpenAi({...body,call_purpose:'foundations_writer_v3'}));expect(validProviderResult(r)).toBe(false);});
 it('will not estimate absent usage or assume prices',()=>{
  expect(()=>normalizeOpenAi({...body,pricing:{}})).toThrow();expect(decodeOpenAi({...raw,usage:undefined},normalizeOpenAi(body)).ok).toBe(false);
 });
});
